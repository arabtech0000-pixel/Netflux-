import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
export interface MunoEpisodeCandidate {
  title?: string;
  streamUrl?: string | null;
  playingurl?: string | null;
  episodeNumber?: number;
  vj?: string;
}

export interface MunoTitleClue {
  cleanTitle: string;
  vjName: string;
  isSeriesHint: boolean;
  seasonNumber?: number;
}

const MUNO_HTTPS_CDN_HOSTS = ['b-cdn.net', 'r2.dev', 'pearlpix', 'munotech', 'munotek'];

export const sanitizeMunoStreamUrl = (rawUrl?: string | null): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (/\.\.(mp4|m3u8|mkv|webm)(\?|$)/i.test(trimmed)) return null;

  let normalized = trimmed;
  if (/^http:\/\//i.test(normalized)) {
    const lower = normalized.toLowerCase();
    if (MUNO_HTTPS_CDN_HOSTS.some((host) => lower.includes(host))) {
      normalized = `https://${normalized.slice(7)}`;
    }
  }

  return normalized.replace(/ /g, '%20');
};

const DEFAULT_STREAM_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MiB (safe under Cloud Run 32 MiB limit)

export const computeCappedByteRange = (
  rangeHeader?: string | null,
  maxChunkBytes: number = DEFAULT_STREAM_CHUNK_BYTES
): string => {
  const safeMax = Math.max(1024, Math.floor(maxChunkBytes));
  if (!rangeHeader || typeof rangeHeader !== 'string') {
    return `bytes=0-${safeMax - 1}`;
  }
  const trimmed = rangeHeader.trim();
  const suffixMatch = trimmed.match(/^bytes=-(\d+)$/i);
  if (suffixMatch) {
    const len = Number(suffixMatch[1]);
    if (Number.isFinite(len) && len > 0) {
      return `bytes=-${Math.min(len, safeMax)}`;
    }
    return `bytes=0-${safeMax - 1}`;
  }
  const match = trimmed.match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) {
    return `bytes=0-${safeMax - 1}`;
  }
  const start = Number(match[1]);
  if (!Number.isFinite(start) || start < 0) {
    return `bytes=0-${safeMax - 1}`;
  }
  const endStr = match[2];
  if (!endStr) {
    return `bytes=${start}-${start + safeMax - 1}`;
  }
  const requestedEnd = Number(endStr);
  if (!Number.isFinite(requestedEnd) || requestedEnd < start) {
    return `bytes=${start}-${start + safeMax - 1}`;
  }
  return `bytes=${start}-${Math.min(requestedEnd, start + safeMax - 1)}`;
};

export const normalizeVjName = (rawVj?: string | null): string => {
  if (!rawVj || typeof rawVj !== 'string') return 'Luganda Dubbed';
  const cleaned = rawVj.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Luganda Dubbed';
  if (/^luganda\s+dubbed$/i.test(cleaned)) return 'Luganda Dubbed';

  const normalized = cleaned
    .split(' ')
    .map((part) => {
      if (/^vj$/i.test(part)) return 'VJ';
      if (/^[a-z]/i.test(part)) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      return part;
    })
    .join(' ');

  return normalized;
};

export const buildDualVerifiedItemId = (
  mediaType: 'movie' | 'series',
  tmdbId: number,
  vjName?: string | null
): string => {
  const normalizedVj = normalizeVjName(vjName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = normalizedVj || 'dubbed';
  return `tmdb-${mediaType}-${tmdbId}-${suffix}`;
};

export const extractMunoTitleClue = (rawTitle: string, explicitVj?: string | null): MunoTitleClue => {
  let working = (rawTitle || '').trim();
  let extractedVj = '';

  const vjMatch = working.match(/\b(VJ\s+[A-Za-z0-9\-]+|VJ\.[A-Za-z0-9\-]+)\b/i);
  if (vjMatch) {
    extractedVj = vjMatch[1];
    working = working.replace(vjMatch[0], ' ');
  }

  let seasonNumber: number | undefined;
  let isSeriesHint = false;

  const seasonMatch = working.match(/\b(?:season|s)\s*0*(\d{1,2})\b/i);
  if (seasonMatch) {
    seasonNumber = Number(seasonMatch[1]);
    isSeriesHint = true;
  }
  if (/\b(?:ep(?:isode)?\s*\d+|s\d{1,2}e\d{1,2})\b/i.test(working)) {
    isSeriesHint = true;
  }

  working = working
    .replace(/\(\s*(?:19|20)\d{2}\s*\)/g, ' ')
    .replace(/\[\s*(?:19|20)\d{2}\s*\]/g, ' ')
    .replace(/\b(?:season|s)\s*\d{1,2}(?:\s*e\d{1,2})?\b/gi, ' ')
    .replace(/\bep(?:isode)?\s*\d+\b/gi, ' ')
    .replace(/\bpart\s*\d+\b/gi, ' ')
    .replace(/\bluganda\s*(?:dubbed|translated)?\b/gi, ' ')
    .replace(/[:\-–|]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const vjSource = explicitVj && explicitVj.trim() ? explicitVj : extractedVj;

  return {
    cleanTitle: working || rawTitle.trim(),
    vjName: normalizeVjName(vjSource),
    isSeriesHint,
    seasonNumber,
  };
};

const normalizeTitleForComparison = (value: string): string =>
  value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripLeadingArticles = (value: string): string =>
  value.replace(/^(?:the|a|an)\s+/i, '').trim();

export const pickBestTmdbMatch = <
  T extends {
    id?: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    media_type?: string;
    popularity?: number;
    vote_count?: number;
  }
>(
  tmdbResults: T[],
  clueTitle: string
): T | null => {
  if (!Array.isArray(tmdbResults) || tmdbResults.length === 0) return null;

  const cleanClue = normalizeTitleForComparison(clueTitle);
  if (!cleanClue) return null;
  const clueNoArticle = stripLeadingArticles(cleanClue);
  const clueWords = clueNoArticle.split(' ').filter((w) => w.length > 1);

  const withBanner = tmdbResults.filter(
    (item) =>
      item &&
      item.media_type !== 'person' &&
      Boolean(item.backdrop_path) &&
      Boolean(item.title || item.name)
  );
  if (withBanner.length === 0) return null;

  let bestItem: T | null = null;
  let bestScore = -1;

  for (const item of withBanner) {
    const candidates = [item.title, item.name, item.original_title, item.original_name].filter(
      (c): c is string => Boolean(c)
    );

    let itemBestMatchScore = -1;
    for (const candidateRaw of candidates) {
      const candidate = normalizeTitleForComparison(candidateRaw);
      const candidateNoArticle = stripLeadingArticles(candidate);

      let score = -1;
      if (candidate === cleanClue) {
        score = 120;
      } else if (candidateNoArticle === clueNoArticle && clueNoArticle.length > 0) {
        score = 105;
      } else if (
        candidateNoArticle.startsWith(clueNoArticle) ||
        clueNoArticle.startsWith(candidateNoArticle)
      ) {
        const minLen = Math.min(candidateNoArticle.length, clueNoArticle.length);
        const maxLen = Math.max(candidateNoArticle.length, clueNoArticle.length);
        if (minLen >= 3 && minLen / maxLen >= 0.45) {
          score = 75 + Math.round((minLen / maxLen) * 20);
        }
      } else if (clueWords.length > 0) {
        const candWords = candidateNoArticle.split(' ').filter((w) => w.length > 1);
        const shared = clueWords.filter((w) => candWords.includes(w));
        const ratio = shared.length / Math.max(clueWords.length, candWords.length);
        if (shared.length > 0 && ratio >= 0.5) {
          score = 45 + Math.round(ratio * 35);
        }
      }

      if (score > itemBestMatchScore) {
        itemBestMatchScore = score;
      }
    }

    if (itemBestMatchScore < 0) continue;

    const popularityBonus = Math.min(15, Math.log10(Math.max(1, item.popularity || 1)) * 5);
    const voteCountBonus = Math.min(12, Math.log10(Math.max(1, item.vote_count || 1)) * 3);
    const posterBonus = item.poster_path ? 8 : 0;
    const totalScore = itemBestMatchScore + popularityBonus + voteCountBonus + posterBonus;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestItem = item;
    }
  }

  return bestItem;
};

const extractEpisodeNumber = (raw: {
  episodeNumber?: number;
  episode_number?: number;
  title?: string;
  name?: string;
  streamUrl?: string | null;
}): number | null => {
  if (typeof raw.episodeNumber === 'number' && raw.episodeNumber > 0) return raw.episodeNumber;
  if (typeof raw.episode_number === 'number' && raw.episode_number > 0) return raw.episode_number;

  const text = `${raw.title || ''} ${raw.name || ''} ${raw.streamUrl || ''}`;
  const sxeMatch = text.match(/s\d{1,2}\s*e0*(\d{1,3})\b/i);
  if (sxeMatch) return Number(sxeMatch[1]);

  const epMatch = text.match(/\bep(?:isode)?\s*[-_:#]?\s*0*(\d{1,3})\b/i);
  if (epMatch) return Number(epMatch[1]);

  const partMatch = text.match(/\bpart\s*0*(\d{1,3})\b/i);
  if (partMatch) return Number(partMatch[1]);

  const trailingMatch = (raw.title || raw.name || '').trim().match(/\b0*(\d{1,3})$/);
  if (trailingMatch) return Number(trailingMatch[1]);

  return null;
};

export const attachMunoStreamsToEpisodes = (
  tmdbEpisodes: any[],
  munoEpisodes: MunoEpisodeCandidate[],
  fallbackStreamUrl?: string | null,
  defaultVj?: string
): any[] => {
  if (!Array.isArray(tmdbEpisodes) || tmdbEpisodes.length === 0) return [];

  const streamByEpNum = new Map<number, { url: string; vj?: string }>();
  for (const mep of munoEpisodes || []) {
    const cleanUrl = sanitizeMunoStreamUrl(mep.streamUrl || mep.playingurl);
    if (!cleanUrl) continue;
    const epNum = extractEpisodeNumber({
      episodeNumber: mep.episodeNumber,
      title: mep.title,
      streamUrl: cleanUrl,
    });
    if (epNum && !streamByEpNum.has(epNum)) {
      streamByEpNum.set(epNum, {
        url: cleanUrl,
        vj: mep.vj ? normalizeVjName(mep.vj) : defaultVj,
      });
    }
  }

  const sanitizedFallback = sanitizeMunoStreamUrl(fallbackStreamUrl);

  return tmdbEpisodes.map((ep) => {
    const matched = streamByEpNum.get(ep.episodeNumber);
    if (matched) {
      return {
        ...ep,
        videoUrl: matched.url,
        vjName: matched.vj || ep.vjName || defaultVj,
      };
    }
    if (sanitizedFallback) {
      return {
        ...ep,
        videoUrl: sanitizedFallback,
        vjName: ep.vjName || defaultVj,
      };
    }
    return ep;
  });
};

const isMatchingSeriesTitleServer = (
  expectedTitle?: string | null,
  candidateTitle?: string | null
): boolean => {
  if (!expectedTitle || !candidateTitle) return true;
  const cleanExpected = stripLeadingArticles(
    normalizeTitleForComparison(extractMunoTitleClue(expectedTitle).cleanTitle)
  );
  const cleanCandidate = stripLeadingArticles(
    normalizeTitleForComparison(extractMunoTitleClue(candidateTitle).cleanTitle)
  );
  if (!cleanExpected || !cleanCandidate) return true;
  if (cleanExpected === cleanCandidate) return true;
  if (cleanExpected.includes(cleanCandidate) || cleanCandidate.includes(cleanExpected)) {
    return true;
  }
  const expWords = cleanExpected.split(' ').filter((w) => w.length > 2);
  const candWords = cleanCandidate.split(' ').filter((w) => w.length > 2);
  if (expWords.length === 0 || candWords.length === 0) return true;
  return expWords.some((w) => candWords.includes(w));
};

const mergeMunoEpisodeArrays = (
  ...lists: Array<any[] | undefined>
): any[] => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const ep of list) {
      if (!ep || typeof ep !== 'object') continue;
      const cleanUrl = sanitizeMunoStreamUrl(ep.streamUrl || ep.playingurl);
      if (!cleanUrl) continue;
      const epNum = extractEpisodeNumber({
        episodeNumber: ep.episodeNumber,
        title: ep.title || ep.name,
        streamUrl: cleanUrl,
      });
      const dedupKey = `${epNum ?? 'x'}::${cleanUrl}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      out.push({
        ...ep,
        episodeNumber: epNum ?? ep.episodeNumber,
        streamUrl: cleanUrl,
        playingurl: cleanUrl,
      });
    }
  }
  return out.sort((a, b) => (a.episodeNumber || 9999) - (b.episodeNumber || 9999));
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = 'ashirafashes04@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'popular-24';
const ADMIN_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`netflux-admin:${ADMIN_EMAIL}:${ADMIN_PASSWORD}`)
    .digest('hex');

const DEFAULT_WHATSAPP_GROUP_URL =
  'https://chat.whatsapp.com/EfjzgGyIIBJ1i017P0VlAB?s=cl&p=a&iam=2';

interface SitePublicConfig {
  disclaimerEnabled: boolean;
  disclaimerTitle: string;
  disclaimerMessage: string;
  whatsappButtonLabel: string;
  whatsappGroupUrl: string;
  whatsappPrefillMessage: string;
  siteAnnouncement: string;
  pinnedFeaturedMovieId?: string;
  updatedAt: number;
}

const SITE_CONFIG_PATH = path.resolve(__dirname, '.site-config.json');
const DEFAULT_SITE_CONFIG: SitePublicConfig = {
  disclaimerEnabled: true,
  disclaimerTitle: 'Join Our WhatsApp Group',
  disclaimerMessage:
    'Join our WhatsApp group for instant updates on newly translated Luganda movies, trending series, fresh VJ releases, and direct community support.',
  whatsappButtonLabel: 'Join our platform',
  whatsappGroupUrl: DEFAULT_WHATSAPP_GROUP_URL,
  whatsappPrefillMessage: 'Hello Admin, I just joined via the platform WhatsApp link!',
  siteAnnouncement: '',
  pinnedFeaturedMovieId: '',
  updatedAt: Date.now(),
};

function normalizeSafeHttpUrl(rawUrl: unknown, fallback: string): string {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return fallback;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Fallback to verified default URL
  }
  return fallback;
}

function loadSiteConfig(): SitePublicConfig {
  try {
    if (fs.existsSync(SITE_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SITE_CONFIG_PATH, 'utf-8'));
      const merged: SitePublicConfig = {
        ...DEFAULT_SITE_CONFIG,
        ...(raw && typeof raw === 'object' ? raw : {}),
      };
      // Automatically migrate legacy "This project is for sale" defaults to the WhatsApp Group notice
      if (
        /this project is for sale/i.test(merged.disclaimerMessage || '') ||
        merged.disclaimerTitle === 'Project Notice'
      ) {
        const migrated: SitePublicConfig = {
          ...merged,
          disclaimerTitle: DEFAULT_SITE_CONFIG.disclaimerTitle,
          disclaimerMessage: DEFAULT_SITE_CONFIG.disclaimerMessage,
          whatsappButtonLabel: DEFAULT_SITE_CONFIG.whatsappButtonLabel,
          whatsappGroupUrl: DEFAULT_SITE_CONFIG.whatsappGroupUrl,
          whatsappPrefillMessage: DEFAULT_SITE_CONFIG.whatsappPrefillMessage,
          updatedAt: Date.now(),
        };
        persistSiteConfig(migrated);
        return migrated;
      }
      merged.whatsappGroupUrl = normalizeSafeHttpUrl(
        merged.whatsappGroupUrl,
        DEFAULT_WHATSAPP_GROUP_URL
      );
      return merged;
    }
  } catch {
    // Fallback to default in-memory config
  }
  return { ...DEFAULT_SITE_CONFIG };
}

function persistSiteConfig(nextConfig: SitePublicConfig): void {
  currentSiteConfig = nextConfig;
  try {
    fs.writeFileSync(SITE_CONFIG_PATH, JSON.stringify(nextConfig, null, 2), 'utf-8');
  } catch {
    // Read-only filesystem safe fallback: keep in memory
  }
}

let currentSiteConfig: SitePublicConfig = loadSiteConfig();

const UPLOADED_MOVIES_PATH = path.resolve(__dirname, '.uploaded-movies.json');
const SITE_NOTIFICATIONS_PATH = path.resolve(__dirname, '.site-notifications.json');
const REGISTERED_USERS_PATH = path.resolve(__dirname, '.registered-users.json');

interface RegisteredUserRecord {
  key: string;
  uid: string;
  email: string | null;
  displayName: string;
  createdAt: number;
  lastSeenAt: number;
  isPremium?: boolean;
  isBlocked?: boolean;
  premiumActivatedAt?: number;
  blockedAt?: number;
}

function loadJsonArray<T>(filePath: string): T[] {
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    }
  } catch {
    // Safe fallback
  }
  return [];
}

function persistJsonArray<T>(filePath: string, data: T[]): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Read-only filesystem safe fallback
  }
}

const FIREBASE_RTDB_USERS_URL = 'https://munomoviess-default-rtdb.firebaseio.com/users.json';

function isSyntheticTestUserServer(keyOrId?: string | null, email?: string | null): boolean {
  const k = (keyOrId || '').trim().toLowerCase();
  const e = (email || '').trim().toLowerCase();
  if (
    k === 'browser_check_example_test' ||
    k === 'player_check_example_com' ||
    k === 'admin_ashiraf'
  ) {
    return true;
  }
  if (e.endsWith('@example.com') || e.endsWith('@example.test')) return true;
  if (/^member_\d{10,}@gmail\.com$/.test(e)) return true;
  if (k.startsWith('email:member_') && /@gmail\.com$/.test(k)) return true;
  return false;
}

function reconstructLegacyEmailFromKeyServer(rawKey?: string | null): string | null {
  const k = (rawKey || '').trim().toLowerCase();
  if (!k || /^[a-z0-9]{20,36}$/i.test(k)) return null;
  const match = k.match(/^(.+)_(gmail|yahoo|hotmail|outlook|icloud)_(com|co_uk|org|net)$/);
  if (!match) return null;
  const local = match[1].replace(/_/g, '.');
  const domain = `${match[2]}.${match[3].replace(/_/g, '.')}`;
  return `${local}@${domain}`;
}

function mergeUserDirectoriesServer(
  rtdbUsers: Record<string, any> | null,
  localRecords: RegisteredUserRecord[]
): RegisteredUserRecord[] {
  const now = Date.now();
  const byCanonical = new Map<string, RegisteredUserRecord>();
  const uidToCanonical = new Map<string, string>();

  const upsert = (raw: {
    rawKey?: string;
    uid?: string;
    email?: string | null;
    displayName?: string;
    createdAt?: number;
    lastSeenAt?: number;
    isPremium?: boolean;
    isBlocked?: boolean;
    premiumActivatedAt?: number;
    blockedAt?: number;
  }) => {
    const cleanUid = (raw.uid || '').trim();
    const candidateEmail =
      (typeof raw.email === 'string' && raw.email.includes('@') ? raw.email.trim().toLowerCase() : null) ||
      reconstructLegacyEmailFromKeyServer(raw.rawKey);

    if (
      isSyntheticTestUserServer(raw.rawKey, candidateEmail) ||
      isSyntheticTestUserServer(cleanUid, candidateEmail)
    ) {
      return;
    }

    const mappedFromUid = cleanUid ? uidToCanonical.get(cleanUid) : undefined;
    const canonicalKey = candidateEmail
      ? `email:${candidateEmail}`
      : mappedFromUid ||
        (cleanUid ? `uid:${cleanUid}` : raw.rawKey ? `key:${raw.rawKey.trim().toLowerCase()}` : '');
    if (!canonicalKey) return;

    if (candidateEmail && mappedFromUid && mappedFromUid !== canonicalKey && byCanonical.has(mappedFromUid)) {
      const prior = byCanonical.get(mappedFromUid)!;
      byCanonical.delete(mappedFromUid);
      const existingAtEmail = byCanonical.get(canonicalKey);
      byCanonical.set(canonicalKey, {
        key: canonicalKey,
        uid: cleanUid || prior.uid || existingAtEmail?.uid || canonicalKey,
        email: candidateEmail,
        displayName:
          raw.displayName?.trim() || existingAtEmail?.displayName || prior.displayName || candidateEmail,
        createdAt: Math.min(prior.createdAt || now, existingAtEmail?.createdAt || now, raw.createdAt || now),
        lastSeenAt: Math.max(prior.lastSeenAt || 0, existingAtEmail?.lastSeenAt || 0, raw.lastSeenAt || 0),
        isPremium: Boolean(raw.isPremium ?? existingAtEmail?.isPremium ?? prior.isPremium),
        isBlocked: Boolean(raw.isBlocked ?? existingAtEmail?.isBlocked ?? prior.isBlocked),
        premiumActivatedAt: raw.premiumActivatedAt || existingAtEmail?.premiumActivatedAt || prior.premiumActivatedAt,
        blockedAt: raw.blockedAt || existingAtEmail?.blockedAt || prior.blockedAt,
      });
    }

    const existing = byCanonical.get(canonicalKey);
    const createdVal =
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) && raw.createdAt > 0
        ? raw.createdAt
        : now;
    const seenVal =
      typeof raw.lastSeenAt === 'number' && Number.isFinite(raw.lastSeenAt) && raw.lastSeenAt > 0
        ? raw.lastSeenAt
        : 0;

    if (existing) {
      byCanonical.set(canonicalKey, {
        ...existing,
        key: canonicalKey,
        uid: cleanUid || existing.uid,
        email: candidateEmail || existing.email,
        displayName: raw.displayName?.trim() || existing.displayName,
        createdAt: Math.min(existing.createdAt || createdVal, createdVal),
        lastSeenAt: Math.max(existing.lastSeenAt || 0, seenVal),
        isPremium: typeof raw.isPremium === 'boolean' ? raw.isPremium : existing.isPremium,
        isBlocked: typeof raw.isBlocked === 'boolean' ? raw.isBlocked : existing.isBlocked,
        premiumActivatedAt: raw.premiumActivatedAt || existing.premiumActivatedAt,
        blockedAt: raw.blockedAt || existing.blockedAt,
      });
    } else {
      byCanonical.set(canonicalKey, {
        key: canonicalKey,
        uid: cleanUid || canonicalKey,
        email: candidateEmail,
        displayName: raw.displayName?.trim() || candidateEmail || 'Netflux Member',
        createdAt: createdVal,
        lastSeenAt: seenVal,
        isPremium: Boolean(raw.isPremium),
        isBlocked: Boolean(raw.isBlocked),
        premiumActivatedAt: raw.premiumActivatedAt,
        blockedAt: raw.blockedAt,
      });
    }

    if (cleanUid) {
      uidToCanonical.set(cleanUid, canonicalKey);
    }
  };

  if (rtdbUsers && typeof rtdbUsers === 'object') {
    for (const [nodeKey, nodeVal] of Object.entries(rtdbUsers)) {
      if (!nodeVal || typeof nodeVal !== 'object') continue;
      const acct = (nodeVal as any).account;
      const uid =
        (typeof acct?.uid === 'string' && acct.uid.trim()) ||
        (/^[a-zA-Z0-9]{20,36}$/.test(nodeKey) ? nodeKey : '');
      const email =
        (typeof acct?.email === 'string' && acct.email.includes('@') ? acct.email : null) ||
        (typeof acct?.identifier === 'string' && acct.identifier.includes('@') ? acct.identifier : null);
      const createdAt = Number(acct?.createdAt) || Number(acct?.lastLoginAt) || now;
      const lastSeenAt = Number(acct?.lastLoginAt) || Number(acct?.createdAt) || 0;
      const displayName =
        (typeof acct?.displayName === 'string' && acct.displayName.trim()) ||
        (typeof acct?.identifier === 'string' && acct.identifier.trim()) ||
        undefined;
      upsert({ rawKey: nodeKey, uid, email, displayName, createdAt, lastSeenAt });
    }
  }

  for (const local of localRecords || []) {
    if (!local) continue;
    upsert({
      rawKey: local.key,
      uid: local.uid,
      email: local.email ?? null,
      displayName: local.displayName,
      createdAt: local.createdAt,
      lastSeenAt: local.lastSeenAt,
      isPremium: local.isPremium,
      isBlocked: local.isBlocked,
      premiumActivatedAt: local.premiumActivatedAt,
      blockedAt: local.blockedAt,
    });
  }

  return Array.from(byCanonical.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

let uploadedMoviesStore: any[] = loadJsonArray<any>(UPLOADED_MOVIES_PATH);
let siteNotificationsStore: any[] = loadJsonArray<any>(SITE_NOTIFICATIONS_PATH);
let registeredUsersStore: RegisteredUserRecord[] = mergeUserDirectoriesServer(
  null,
  loadJsonArray<RegisteredUserRecord>(REGISTERED_USERS_PATH)
);

let lastRtdbUsersSyncAt = 0;
let rtdbUsersSyncInFlight: Promise<void> | null = null;

async function syncRtdbUsersDirectory(forceRefresh = false): Promise<void> {
  const now = Date.now();
  if (!forceRefresh && lastRtdbUsersSyncAt > 0 && now - lastRtdbUsersSyncAt < 30_000) {
    return;
  }
  if (rtdbUsersSyncInFlight) {
    return rtdbUsersSyncInFlight;
  }

  rtdbUsersSyncInFlight = (async () => {
    try {
      const resp = await fetch(FIREBASE_RTDB_USERS_URL, {
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) return;
      const rtdbUsers = (await resp.json()) as Record<string, any> | null;
      if (rtdbUsers && typeof rtdbUsers === 'object') {
        registeredUsersStore = mergeUserDirectoriesServer(rtdbUsers, registeredUsersStore);
        lastRtdbUsersSyncAt = Date.now();
        persistJsonArray(REGISTERED_USERS_PATH, registeredUsersStore);
      }
    } catch {
      // Keep cached directory on transient network failure
    } finally {
      rtdbUsersSyncInFlight = null;
    }
  })();

  return rtdbUsersSyncInFlight;
}

function recordRegisteredUser(params: {
  uid: string;
  email?: string | null;
  displayName?: string;
}): void {
  const cleanEmail = params.email ? params.email.trim().toLowerCase() : null;
  const cleanUid = (params.uid || '').trim();
  if (isSyntheticTestUserServer(cleanUid, cleanEmail)) return;
  const now = Date.now();
  registeredUsersStore = mergeUserDirectoriesServer(null, [
    ...registeredUsersStore,
    {
      key: cleanEmail ? `email:${cleanEmail}` : `uid:${cleanUid}`,
      uid: cleanUid || (cleanEmail ? `email:${cleanEmail}` : ''),
      email: cleanEmail,
      displayName: params.displayName?.trim() || cleanEmail || 'Netflux Member',
      createdAt: now,
      lastSeenAt: now,
    },
  ]);
  persistJsonArray(REGISTERED_USERS_PATH, registeredUsersStore);
}

function getUserDirectoryStats(): {
  totalUsers: number;
  activeUsersNow: number;
  activeUsersToday: number;
  premiumUsersCount: number;
  blockedUsersCount: number;
} {
  const now = Date.now();
  const cutoffToday = now - 24 * 60 * 60 * 1000;
  const cutoffNow = now - 15 * 60 * 1000;
  const uniqueKeys = new Set<string>();
  let activeUsersToday = 0;
  let activeUsersNow = 0;
  let premiumUsersCount = 0;
  let blockedUsersCount = 0;

  for (const user of registeredUsersStore) {
    if (!user?.key) continue;
    if (isSyntheticTestUserServer(user.key, user.email) || isSyntheticTestUserServer(user.uid, user.email)) {
      continue;
    }
    if (!uniqueKeys.has(user.key)) {
      uniqueKeys.add(user.key);
      if (user.isBlocked) {
        blockedUsersCount++;
      } else {
        if (user.isPremium) premiumUsersCount++;
        if (user.lastSeenAt >= cutoffToday) activeUsersToday++;
        if (user.lastSeenAt >= cutoffNow) activeUsersNow++;
      }
    }
  }
  return {
    totalUsers: uniqueKeys.size,
    activeUsersNow,
    activeUsersToday,
    premiumUsersCount,
    blockedUsersCount,
  };
}

function buildSubscriptionSummaryServer() {
  const activeUsers = registeredUsersStore.filter(
    (u) =>
      u?.key &&
      !isSyntheticTestUserServer(u.key, u.email) &&
      !isSyntheticTestUserServer(u.uid, u.email) &&
      !u.isBlocked
  );
  const premiumUsersCount = activeUsers.filter((u) => Boolean(u.isPremium)).length;
  const freeUsersCount = Math.max(0, activeUsers.length - premiumUsersCount);
  const weeklyProfitUgx = premiumUsersCount * 4000;
  const projectedMonthlyUgx = premiumUsersCount * 8000;
  const dayWeights = [0.1, 0.12, 0.14, 0.13, 0.17, 0.19, 0.15];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyBreakdown = dayNames.map((day, idx) => ({
    day,
    profitUgx: Math.round(weeklyProfitUgx * dayWeights[idx]),
    subscribers: premiumUsersCount,
  }));

  return {
    paymentsEnabled: false,
    weeklyProfitUgx,
    projectedMonthlyUgx,
    premiumUsersCount,
    freeUsersCount,
    plans: [
      {
        id: 'daily',
        name: 'Daily Pass',
        priceLabel: '1,000 UGX / day',
        amountUgx: 1000,
        periodLabel: '24 Hours',
        activeCount: 0,
      },
      {
        id: 'weekly',
        name: 'Weekly Pass',
        priceLabel: '4,000 UGX / week',
        amountUgx: 4000,
        periodLabel: '7 Days',
        activeCount: premiumUsersCount,
      },
      {
        id: 'monthly',
        name: 'Monthly VIP',
        priceLabel: '8,000 UGX / month',
        amountUgx: 8000,
        periodLabel: '30 Days',
        activeCount: premiumUsersCount,
      },
    ],
    weeklyBreakdown,
  };
}

function applyUploadedContentToCatalog(baseCatalog: any) {
  if (!baseCatalog) return baseCatalog;
  const uploaded = uploadedMoviesStore;
  const customNotifs = siteNotificationsStore;
  if (uploaded.length === 0 && customNotifs.length === 0) {
    return baseCatalog;
  }

  const uploadedIds = new Set(uploaded.map((m) => m.id));
  const dedupedAll = [
    ...uploaded,
    ...(Array.isArray(baseCatalog.all) ? baseCatalog.all.filter((m: any) => !uploadedIds.has(m.id)) : []),
  ];

  const uploadedMoviesOnly = uploaded.filter((m) => m.type !== 'series');
  const uploadedSeriesOnly = uploaded.filter((m) => m.type === 'series');

  const nextByGenre: Record<string, any[]> = { ...(baseCatalog.sections?.byGenre || {}) };
  for (const m of uploaded) {
    for (const g of m.genres || []) {
      const existingList = Array.isArray(nextByGenre[g]) ? nextByGenre[g] : [];
      if (!existingList.some((x) => x.id === m.id)) {
        nextByGenre[g] = [m, ...existingList];
      }
    }
  }

  const baseTrending = Array.isArray(baseCatalog.sections?.trending)
    ? baseCatalog.sections.trending.filter((m: any) => !uploadedIds.has(m.id))
    : [];
  const baseMovies = Array.isArray(baseCatalog.sections?.movies)
    ? baseCatalog.sections.movies.filter((m: any) => !uploadedIds.has(m.id))
    : [];
  const baseSeries = Array.isArray(baseCatalog.sections?.tvShows)
    ? baseCatalog.sections.tvShows.filter((m: any) => !uploadedIds.has(m.id))
    : [];
  const baseUpcoming = Array.isArray(baseCatalog.sections?.upcoming)
    ? baseCatalog.sections.upcoming.filter((m: any) => !uploadedIds.has(m.id))
    : [];
  const baseBanners = Array.isArray(baseCatalog.featuredBanners)
    ? baseCatalog.featuredBanners.filter((m: any) => !uploadedIds.has(m.id))
    : [];
  const baseNotifs = Array.isArray(baseCatalog.notifications)
    ? baseCatalog.notifications
    : [];

  const notifIds = new Set(customNotifs.map((n: any) => n.id));
  const mergedNotifs = [
    ...customNotifs,
    ...baseNotifs.filter((n: any) => !notifIds.has(n.id)),
  ];

  return {
    ...baseCatalog,
    hero: baseCatalog.hero || uploaded[0] || null,
    featuredBanners: [...uploaded, ...baseBanners].slice(0, 6),
    all: dedupedAll,
    sections: {
      ...baseCatalog.sections,
      trending: [...uploaded, ...baseTrending].slice(0, 24),
      movies: [...uploadedMoviesOnly, ...baseMovies],
      tvShows: [...uploadedSeriesOnly, ...baseSeries],
      upcoming: [...uploaded, ...baseUpcoming].slice(0, 24),
      byGenre: nextByGenre,
    },
    notifications: mergedNotifs,
  };
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function createAdminToken(email: string): string {
  const payloadObj = {
    email,
    iat: Date.now(),
    exp: Date.now() + ADMIN_TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyAdminToken(token?: string | null): { email: string; exp: number } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', ADMIN_TOKEN_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (!timingSafeTextEqual(sigB64, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (
      !parsed ||
      typeof parsed.email !== 'string' ||
      parsed.email.toLowerCase() !== ADMIN_EMAIL ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return { email: parsed.email, exp: parsed.exp };
  } catch {
    return null;
  }
}

const FIREBASE_PROJECT_ID = 'munomoviess';
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let cachedFirebaseCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function fetchFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedFirebaseCerts && Date.now() < cachedFirebaseCerts.expiresAt) {
    return cachedFirebaseCerts.certs;
  }
  const resp = await fetch(FIREBASE_CERTS_URL, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) {
    throw new Error(`Failed to fetch Firebase public certs (${resp.status})`);
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cc = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  cachedFirebaseCerts = {
    certs,
    expiresAt: Date.now() + Math.max(60_000, maxAgeMs),
  };
  return certs;
}

async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ uid: string; email: string | null; emailVerified: boolean; name?: string } | null> {
  if (!idToken || typeof idToken !== 'string') return null;
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (header?.alg !== 'RS256' || typeof header?.kid !== 'string' || !header.kid) {
      return null;
    }

    const certs = await fetchFirebasePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuf = Buffer.from(sigB64, 'base64url');
    if (!verifier.verify(certPem, sigBuf)) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload?.aud !== FIREBASE_PROJECT_ID ||
      payload?.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      typeof payload?.exp !== 'number' ||
      payload.exp <= nowSec ||
      typeof payload?.iat !== 'number' ||
      payload.iat > nowSec + 300 ||
      typeof payload?.sub !== 'string' ||
      !payload.sub.trim()
    ) {
      return null;
    }

    const email = typeof payload.email === 'string' && payload.email.trim()
      ? payload.email.trim().toLowerCase()
      : null;

    return {
      uid: payload.sub.trim(),
      email,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name.trim() : undefined,
    };
  } catch {
    return null;
  }
}

async function verifyFirebaseAdminIdToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  const verified = await verifyFirebaseIdToken(idToken);
  if (!verified || !verified.emailVerified || !verified.email) return null;
  if (!timingSafeTextEqual(verified.email, ADMIN_EMAIL)) return null;
  return { uid: verified.uid, email: ADMIN_EMAIL };
}
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const TMDB_IMG_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_STILL = 'https://image.tmdb.org/t/p/w500';

const MUNO_PRIMARY_BASE = 'https://freewatchug.online/api/v1';
const MUNO_FALLBACK_BASES = [
  'https://freewatchug.online/api/v1',
  'https://mumowatch.ai.studio/api/v1',
];

const GENRE_ID_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action',
  10765: 'Sci-Fi',
  10768: 'War',
};

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

const tmdbCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

interface MunoIndexEntry {
  munoId: number | string;
  seriesCode?: string;
  videoUrl: string;
  vjName: string;
  episodes: MunoEpisodeCandidate[];
}

// Correlated MunoWatch playback lookup keyed by unique VJ id (`tmdb-${mediaType}-${tmdbId}-${vjSlug}`) and canonical fallback (`tmdb-${mediaType}-${tmdbId}`)
const munoByTmdbKey = new Map<string, MunoIndexEntry>();
// All distinct VJ/VOD variants sharing the same canonical `tmdb-${mediaType}-${tmdbId}` banner
const munoVariantsByTmdbKey = new Map<string, Map<string, { id: string } & MunoIndexEntry>>();

function getCached(key: string): unknown | null {
  const entry = tmdbCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tmdbCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: unknown): void {
  if (tmdbCache.size > 400) {
    const oldestKey = tmdbCache.keys().next().value;
    if (oldestKey) tmdbCache.delete(oldestKey);
  }
  tmdbCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });
}

let lastGoodCatalog: any = null;

function hasTmdbCredentials(): boolean {
  return Boolean(
    (process.env.TMDB_API_TOKEN && process.env.TMDB_API_TOKEN.trim()) ||
      (process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim())
  );
}

function sanitizeImageUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  if (/^http:\/\//i.test(trimmed)) {
    const lower = trimmed.toLowerCase();
    if (MUNO_HTTPS_CDN_HOSTS.some((host) => lower.includes(host))) {
      return `https://${trimmed.slice(7)}`.replace(/ /g, '%20');
    }
  }
  return trimmed.replace(/ /g, '%20');
}

async function munoFetch<T = any>(endpoint: string): Promise<T> {
  const cacheKey = `muno:${endpoint}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as T;

  let lastError: Error | null = null;
  for (let round = 0; round < 2; round++) {
    for (const base of MUNO_FALLBACK_BASES) {
      try {
        const response = await fetch(`${base}${endpoint}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          lastError = new Error(`MunoWatch API ${response.status} on ${endpoint}`);
          continue;
        }
        const json = (await response.json()) as T;
        setCached(cacheKey, json);
        return json;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    if (round === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError || new Error(`MunoWatch request failed for ${endpoint}`);
}

async function tmdbFetch<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_API_TOKEN?.trim();
  const apiKey = process.env.TMDB_API_KEY?.trim();

  if (!token && !apiKey) {
    throw new Error('TMDB credentials are not configured on the server.');
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  if (!token && apiKey) {
    url.searchParams.set('api_key', apiKey);
  }

  const cacheKey = url.toString();
  const cached = getCached(cacheKey);
  if (cached) return cached as T;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const err = new Error(`TMDB API error ${response.status}: ${text || response.statusText}`);
        if (response.status >= 500 && attempt === 0) {
          lastError = err;
          continue;
        }
        throw err;
      }

      const json = (await response.json()) as T;
      setCached(cacheKey, json);
      return json;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
    }
  }

  throw lastError || new Error('TMDB request failed');
}

function formatRuntime(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '1h 55m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function extractAgeRating(raw: any, mediaType: 'movie' | 'series'): string {
  if (mediaType === 'series') {
    const ratings = raw?.content_ratings?.results;
    if (Array.isArray(ratings)) {
      const us = ratings.find((r: any) => r.iso_3166_1 === 'US') || ratings[0];
      if (us?.rating) return us.rating;
    }
    return raw?.adult ? '18+' : '16+';
  }

  const releaseDates = raw?.release_dates?.results;
  if (Array.isArray(releaseDates)) {
    const us = releaseDates.find((r: any) => r.iso_3166_1 === 'US') || releaseDates[0];
    const cert = us?.release_dates?.find((d: any) => d.certification)?.certification;
    if (cert) return cert;
  }
  return raw?.adult ? '18+' : '13+';
}

function mapSummaryItem(item: any, fallbackType?: 'movie' | 'series', options?: { isTrending?: boolean; top10Rank?: number }) {
  const mediaType: 'movie' | 'series' =
    item.media_type === 'tv' || fallbackType === 'series' || (!item.title && item.name)
      ? 'series'
      : 'movie';
  const title = item.title || item.name || 'Untitled';
  const dateStr = item.release_date || item.first_air_date || '';
  const year = dateStr ? Number(dateStr.slice(0, 4)) || 2024 : 2024;
  const genres = Array.isArray(item.genre_ids)
    ? item.genre_ids
        .map((id: number) => GENRE_ID_MAP[id])
        .filter((g: string | undefined): g is string => Boolean(g))
    : Array.isArray(item.genres)
      ? item.genres.map((g: any) => g.name).filter(Boolean)
      : ['Drama'];

  const vote = typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average : 8.2;

  return {
    id: `tmdb-${mediaType}-${item.id}`,
    tmdbId: Number(item.id),
    title,
    type: mediaType,
    year,
    ageRating: item.adult ? '18+' : mediaType === 'series' ? '16+' : '13+',
    quality: '4K Ultra HD' as const,
    durationOrSeasons: mediaType === 'series' ? 'Series' : 'Feature Film',
    genres: genres.length > 0 ? Array.from(new Set(genres)).slice(0, 4) : ['Drama'],
    synopsis: item.overview || 'No synopsis available.',
    matchScore: Math.min(99, Math.max(70, Math.round(vote * 10))),
    posterUrl: item.poster_path ? `${TMDB_IMG_POSTER}${item.poster_path}` : '',
    backdropUrl: item.backdrop_path
      ? `${TMDB_IMG_ORIGINAL}${item.backdrop_path}`
      : item.poster_path
        ? `${TMDB_IMG_ORIGINAL}${item.poster_path}`
        : '',
    cast: [],
    isOriginal: vote >= 8.1,
    isTrending: options?.isTrending ?? true,
    top10Rank: options?.top10Rank,
    releaseDate: dateStr || undefined,
  };
}

function mapEpisodes(episodes: any[], fallbackBackdrop: string) {
  if (!Array.isArray(episodes)) return [];
  return episodes.slice(0, 20).map((ep: any) => {
    const runtime = typeof ep.runtime === 'number' && ep.runtime > 0 ? ep.runtime : 48;
    return {
      id: `tmdb-ep-${ep.id || `${ep.season_number}-${ep.episode_number}`}`,
      seasonNumber: ep.season_number || 1,
      episodeNumber: ep.episode_number || 1,
      title: ep.name || `Episode ${ep.episode_number || 1}`,
      duration: `${runtime}m`,
      durationSeconds: runtime * 60,
      synopsis: ep.overview || 'Episode details are available when streaming.',
      thumbnail: ep.still_path ? `${TMDB_IMG_STILL}${ep.still_path}` : fallbackBackdrop,
    };
  });
}

function flattenMunoEpisodes(rawItem: any): MunoEpisodeCandidate[] {
  const results: MunoEpisodeCandidate[] = [];
  const pushEp = (ep: any) => {
    if (!ep || typeof ep !== 'object') return;
    const url = sanitizeMunoStreamUrl(ep.streamUrl || ep.playingurl);
    if (url) {
      results.push({
        title: ep.title || ep.name || rawItem?.title,
        streamUrl: url,
        playingurl: url,
        episodeNumber: typeof ep.episodeNumber === 'number' ? ep.episodeNumber : undefined,
        vj: ep.vj || rawItem?.vj,
      });
    }
    if (Array.isArray(ep.episodes)) {
      ep.episodes.forEach(pushEp);
    }
  };

  if (Array.isArray(rawItem?.episodes)) {
    rawItem.episodes.forEach(pushEp);
  }
  return results;
}

function extractMunoPlayableUrl(rawItem: any, flattenedEpisodes?: MunoEpisodeCandidate[]): string | null {
  const direct = sanitizeMunoStreamUrl(rawItem?.streamUrl || rawItem?.playingurl);
  if (direct) return direct;
  const eps = flattenedEpisodes || flattenMunoEpisodes(rawItem);
  return eps[0]?.streamUrl || null;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
  return results;
}

async function correlateMunoItemWithTmdb(
  munoItem: any,
  options?: { isTrending?: boolean; top10Rank?: number }
): Promise<any | null> {
  if (!munoItem) return null;

  const munoEpisodes = flattenMunoEpisodes(munoItem);
  const videoUrl = extractMunoPlayableUrl(munoItem, munoEpisodes);
  if (!videoUrl) return null;

  const clue = extractMunoTitleClue(munoItem.title || '', munoItem.vj);
  if (!clue.cleanTitle || clue.cleanTitle.length < 2) return null;

  let matchedTmdb: any = null;
  let fallbackType: 'movie' | 'series' | undefined;

  try {
    const multi = await tmdbFetch<any>('/search/multi', {
      query: clue.cleanTitle,
      include_adult: 'false',
      language: 'en-US',
      page: '1',
    });
    matchedTmdb = pickBestTmdbMatch(multi?.results || [], clue.cleanTitle);
    if (matchedTmdb) {
      fallbackType = matchedTmdb.media_type === 'tv' ? 'series' : 'movie';
    }
  } catch {
    // Fallback to typed search below
  }

  if (!matchedTmdb) {
    const preferSeries = Boolean(munoItem.isTv || munoItem.is_series || clue.isSeriesHint);
    const primaryEndpoint = preferSeries ? '/search/tv' : '/search/movie';
    try {
      const typedRes = await tmdbFetch<any>(primaryEndpoint, {
        query: clue.cleanTitle,
        include_adult: 'false',
        language: 'en-US',
        page: '1',
      });
      matchedTmdb = pickBestTmdbMatch(typedRes?.results || [], clue.cleanTitle);
      if (matchedTmdb) {
        fallbackType = preferSeries ? 'series' : 'movie';
      }
    } catch {
      matchedTmdb = null;
    }
  }

  // Strict Gate: MUST have a TMDB match with a real TMDB backdrop_path banner
  if (!matchedTmdb || !matchedTmdb.backdrop_path) {
    return null;
  }

  const summary = mapSummaryItem(matchedTmdb, fallbackType, {
    isTrending: options?.isTrending ?? true,
    top10Rank: options?.top10Rank,
  });

  // Require a valid TMDB banner URL
  if (!summary.backdropUrl) {
    return null;
  }

  const seriesCode = munoItem.series_code ? String(munoItem.series_code) : undefined;
  const munoId = munoItem.id ?? seriesCode;
  const uniqueId = buildDualVerifiedItemId(summary.type, summary.tmdbId, clue.vjName);

  const entry: MunoIndexEntry = {
    munoId,
    seriesCode,
    videoUrl,
    vjName: clue.vjName,
    episodes: munoEpisodes,
  };

  munoByTmdbKey.set(uniqueId, entry);
  if (!munoByTmdbKey.has(summary.id)) {
    munoByTmdbKey.set(summary.id, entry);
  }

  let variants = munoVariantsByTmdbKey.get(summary.id);
  if (!variants) {
    variants = new Map();
    munoVariantsByTmdbKey.set(summary.id, variants);
  }
  variants.set(uniqueId, { id: uniqueId, ...entry });

  return {
    ...summary,
    id: uniqueId,
    videoUrl,
    vjName: clue.vjName,
    munoId,
    seriesCode,
  };
}

function buildMunoFallbackItem(
  munoItem: any,
  options?: { isTrending?: boolean; top10Rank?: number }
): any | null {
  if (!munoItem || !munoItem.title) return null;

  const munoEpisodes = flattenMunoEpisodes(munoItem);
  const videoUrl = extractMunoPlayableUrl(munoItem, munoEpisodes);
  if (!videoUrl) return null;

  const clue = extractMunoTitleClue(munoItem.title || '', munoItem.vj);
  if (!clue.cleanTitle || clue.cleanTitle.length < 2) return null;

  const mediaType: 'movie' | 'series' =
    Boolean(munoItem.isTv || munoItem.is_series || clue.isSeriesHint || munoEpisodes.length > 1)
      ? 'series'
      : 'movie';

  const rawBackdrop =
    munoItem.backdrop_path ||
    munoItem.backdrop ||
    munoItem.poster_path ||
    munoItem.poster ||
    munoItem.image ||
    '';
  const rawPoster =
    munoItem.poster_path ||
    munoItem.poster ||
    munoItem.image ||
    rawBackdrop;

  const backdropUrl = sanitizeImageUrl(rawBackdrop);
  const posterUrl = sanitizeImageUrl(rawPoster) || backdropUrl;
  if (!backdropUrl) return null;

  const seriesCode = munoItem.series_code ? String(munoItem.series_code) : undefined;
  const munoId = munoItem.id ?? seriesCode;
  const titleSlug = clue.cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'title';
  const vjSlug = normalizeVjName(clue.vjName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dubbed';
  const canonicalKey = `muno-${mediaType}-${titleSlug}`;
  const uniqueId = `muno-${mediaType}-${munoId ?? titleSlug}-${vjSlug}`;

  const rawGenres: string[] = [
    ...(Array.isArray(munoItem.genres) ? munoItem.genres : []),
    ...(typeof munoItem.category === 'string' ? [munoItem.category] : []),
  ]
    .map((g) => String(g || '').trim())
    .filter((g) => Boolean(g) && !/^luganda\s*dubbed$/i.test(g));

  const genres = rawGenres.length > 0 ? Array.from(new Set(rawGenres)).slice(0, 4) : ['Action'];
  const parsedRating = Number(munoItem.vote_average ?? munoItem.rating);
  const score = Number.isFinite(parsedRating) && parsedRating > 0 ? parsedRating : 8.2;
  const parsedYear = Number(munoItem.year);
  const year = Number.isFinite(parsedYear) && parsedYear >= 1950 ? parsedYear : 2024;
  const durationLabel =
    mediaType === 'series'
      ? munoEpisodes.length > 0
        ? `${munoEpisodes.length} Episodes`
        : 'Series'
      : String(munoItem.duration || munoItem.runtime || '').trim() || '1h 45m';

  const mappedEpisodes =
    mediaType === 'series' && munoEpisodes.length > 0
      ? munoEpisodes.map((ep, idx) => {
          const epNum = extractEpisodeNumber(ep) || idx + 1;
          return {
            id: `muno-ep-${munoId ?? titleSlug}-${epNum}-${idx}`,
            seasonNumber: clue.seasonNumber || 1,
            episodeNumber: epNum,
            title: ep.title || `Episode ${epNum}`,
            duration: '45m',
            durationSeconds: 45 * 60,
            synopsis: munoItem.overview || `Translated by ${clue.vjName}.`,
            thumbnail: posterUrl || backdropUrl,
            videoUrl: ep.streamUrl || videoUrl,
            vjName: ep.vj ? normalizeVjName(ep.vj) : clue.vjName,
          };
        })
      : undefined;

  const entry: MunoIndexEntry = {
    munoId,
    seriesCode,
    videoUrl,
    vjName: clue.vjName,
    episodes: munoEpisodes,
  };

  munoByTmdbKey.set(uniqueId, entry);
  if (!munoByTmdbKey.has(canonicalKey)) {
    munoByTmdbKey.set(canonicalKey, entry);
  }

  let variants = munoVariantsByTmdbKey.get(canonicalKey);
  if (!variants) {
    variants = new Map();
    munoVariantsByTmdbKey.set(canonicalKey, variants);
  }
  variants.set(uniqueId, { id: uniqueId, ...entry });

  return {
    id: uniqueId,
    canonicalKey,
    title: clue.cleanTitle,
    type: mediaType,
    year,
    ageRating: mediaType === 'series' ? '16+' : '13+',
    quality: '4K Ultra HD' as const,
    durationOrSeasons: durationLabel,
    genres,
    synopsis: munoItem.overview || `${clue.cleanTitle} translated in Luganda by ${clue.vjName}.`,
    matchScore: Math.min(99, Math.max(70, Math.round(score * 10))),
    posterUrl,
    backdropUrl,
    cast: [],
    isOriginal: score >= 8.1,
    isTrending: options?.isTrending ?? true,
    top10Rank: options?.top10Rank,
    videoUrl,
    vjName: clue.vjName,
    munoId,
    seriesCode,
    episodes: mappedEpisodes,
  };
}

const CATALOG_GENRE_DEFS: Array<{ id: string; name: string }> = [
  { id: 'action', name: 'Action' },
  { id: 'sports', name: 'Sports' },
  { id: 'comedy', name: 'Comedy' },
  { id: 'drama', name: 'Drama' },
  { id: 'horror', name: 'Horror' },
  { id: 'sci-fi', name: 'Sci-Fi' },
  { id: 'romance', name: 'Romance' },
  { id: 'thriller', name: 'Thriller' },
  { id: 'documentary', name: 'Documentary' },
];

async function hydrateHeroMovie(item: any) {
  if (!item || !item.tmdbId) return item;
  try {
    const tmdbEndpoint = item.type === 'series' ? `/tv/${item.tmdbId}` : `/movie/${item.tmdbId}`;
    const munoIndex = munoByTmdbKey.get(item.id);
    const seriesCode = item.seriesCode || munoIndex?.seriesCode;

    const [raw, munoSeriesData] = await Promise.all([
      tmdbFetch<any>(tmdbEndpoint, {
        append_to_response: 'credits,content_ratings,release_dates,videos',
        language: 'en-US',
      }),
      item.type === 'series' && seriesCode
        ? munoFetch<any>(`/series?code=${encodeURIComponent(seriesCode)}`).catch(() => null)
        : Promise.resolve(null),
    ]);

    const backdropUrl = raw.backdrop_path
      ? `${TMDB_IMG_ORIGINAL}${raw.backdrop_path}`
      : item.backdropUrl;
    const posterUrl = raw.poster_path ? `${TMDB_IMG_POSTER}${raw.poster_path}` : item.posterUrl;

    const rawSeriesPayload = munoSeriesData?.data || munoSeriesData;
    const verifiedSeriesEps =
      rawSeriesPayload &&
      isMatchingSeriesTitleServer(item.title, rawSeriesPayload.title)
        ? flattenMunoEpisodes(rawSeriesPayload)
        : [];
    const munoEpList: MunoEpisodeCandidate[] = [
      ...(munoIndex?.episodes || []),
      ...verifiedSeriesEps,
    ];

    let episodes: any[] | undefined;
    if (item.type === 'series') {
      try {
        const season1 = await tmdbFetch<any>(`/tv/${item.tmdbId}/season/1`, { language: 'en-US' });
        const tmdbEps = mapEpisodes(season1?.episodes || [], backdropUrl);
        episodes = attachMunoStreamsToEpisodes(
          tmdbEps,
          munoEpList,
          item.videoUrl || munoIndex?.videoUrl,
          item.vjName || munoIndex?.vjName
        );
      } catch {
        episodes = undefined;
      }
    }

    const seasonsCount =
      item.type === 'series' ? Number(raw.number_of_seasons) || 1 : undefined;
    const durationOrSeasons =
      item.type === 'series'
        ? `${seasonsCount} Season${seasonsCount === 1 ? '' : 's'}`
        : formatRuntime(raw.runtime);

    const cast = Array.isArray(raw?.credits?.cast)
      ? raw.credits.cast.slice(0, 6).map((c: any) => c.name).filter(Boolean)
      : item.cast;

    const genres = Array.isArray(raw.genres)
      ? raw.genres.map((g: any) => g.name).filter(Boolean)
      : item.genres;

    const videos = Array.isArray(raw?.videos?.results) ? raw.videos.results : [];
    const trailer =
      videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
      videos.find((v: any) => v.site === 'YouTube');

    return {
      ...item,
      ageRating: extractAgeRating(raw, item.type),
      durationOrSeasons,
      seasonsCount,
      genres: genres.length > 0 ? genres : item.genres,
      synopsis: raw.overview || item.synopsis,
      tagline: raw.tagline || undefined,
      posterUrl,
      backdropUrl,
      cast,
      trailerKey: trailer?.key || item.trailerKey,
      trailerUrl: trailer?.key
        ? `https://www.youtube.com/watch?v=${trailer.key}`
        : item.trailerUrl,
      episodes,
    };
  } catch {
    return item;
  }
}

let catalogInFlight: Promise<any> | null = null;

async function buildTmdbCatalog() {
  const cached = getCached('__catalog__');
  if (cached) return cached;
  if (catalogInFlight) return catalogInFlight;

  catalogInFlight = (async () => {
    const vjQueries = [
      'Vj Junior',
      'Vj Emmy',
      'Vj Ice P',
      'Vj Ulio',
      'Vj Muba',
      'Vj Ivo',
      'Vj Soul',
      'Vj Uncle T',
      'Vj Jingo',
      'Vj Aaron',
      'Vj Banks',
      'Vj Tom',
      'Vj Nelly',
      'Vj Heavy Q',
      'Vj Ghost',
    ];

    const [dashRes, ...pageAndVjResults] = await Promise.allSettled([
      munoFetch<any>('/dashboard'),
      munoFetch<any>('/movies?page=1&limit=100'),
      munoFetch<any>('/movies?page=2&limit=100'),
      munoFetch<any>('/movies?page=3&limit=100'),
      munoFetch<any>('/movies?page=4&limit=100'),
      munoFetch<any>('/movies?page=5&limit=100'),
      munoFetch<any>('/movies?page=6&limit=100'),
      ...vjQueries.map((vj) =>
        munoFetch<any>(`/movies?vj=${encodeURIComponent(vj)}&limit=50`)
      ),
    ]);

    const dashPayload = dashRes.status === 'fulfilled' ? dashRes.value?.data || dashRes.value : {};
    const rawCandidates: any[] = [];
    if (dashPayload?.featured) rawCandidates.push(dashPayload.featured);
    if (Array.isArray(dashPayload?.latest)) rawCandidates.push(...dashPayload.latest);
    if (Array.isArray(dashPayload?.continueWatching)) {
      rawCandidates.push(...dashPayload.continueWatching);
    }
    if (dashPayload?.categories && typeof dashPayload.categories === 'object') {
      for (const catItems of Object.values(dashPayload.categories)) {
        if (Array.isArray(catItems)) {
          rawCandidates.push(...catItems);
        }
      }
    }
    for (const res of pageAndVjResults) {
      if (res.status === 'fulfilled') {
        const list = res.value?.data || [];
        if (Array.isArray(list)) {
          rawCandidates.push(...list);
        }
      }
    }

    // Filter strictly to items with valid MunoWatch playable video links,
    // merging episode pools across entries sharing (cleanTitle, vjName) or (series_code, vjName)
    const dedupByClueAndVj = new Map<string, any>();
    const seriesCodeToKey = new Map<string, string>();
    for (const item of rawCandidates) {
      if (!item || !item.title) continue;
      const eps = flattenMunoEpisodes(item);
      const streamUrl = extractMunoPlayableUrl(item, eps);
      if (!streamUrl) continue;

      const clue = extractMunoTitleClue(item.title, item.vj);
      const cleanKey = clue.cleanTitle.toLowerCase();
      if (!cleanKey || cleanKey.length < 2) continue;
      const vjKey = clue.vjName.toLowerCase();
      const seriesCodeStr = item.series_code ? String(item.series_code).trim() : '';
      const seriesLookupKey = seriesCodeStr ? `${seriesCodeStr}::${vjKey}` : '';

      let key = `${cleanKey}::${vjKey}`;
      if (seriesLookupKey && seriesCodeToKey.has(seriesLookupKey)) {
        const mappedKey = seriesCodeToKey.get(seriesLookupKey)!;
        const mappedExisting = dedupByClueAndVj.get(mappedKey);
        if (mappedExisting && isMatchingSeriesTitleServer(mappedExisting.title, item.title)) {
          key = mappedKey;
        }
      }
      if (seriesLookupKey && !seriesCodeToKey.has(seriesLookupKey)) {
        seriesCodeToKey.set(seriesLookupKey, key);
      }

      const itemEpCandidates = mergeMunoEpisodeArrays(item.episodes, [
        {
          title: item.title,
          name: item.title,
          streamUrl,
          playingurl: streamUrl,
          vj: item.vj,
        },
      ]);

      const existing = dedupByClueAndVj.get(key);
      if (!existing) {
        dedupByClueAndVj.set(key, {
          ...item,
          episodes: itemEpCandidates,
          _epsLen: itemEpCandidates.length,
        });
      } else {
        const mergedEpisodes = mergeMunoEpisodeArrays(existing.episodes, itemEpCandidates);
        const existingEpsLen = existing._epsLen || 0;
        const preferNewMeta =
          itemEpCandidates.length > existingEpsLen || Number(item.id) > Number(existing.id);
        dedupByClueAndVj.set(key, {
          ...(preferNewMeta ? existing : item),
          ...(preferNewMeta ? item : existing),
          streamUrl: mergedEpisodes[0]?.streamUrl || existing.streamUrl || item.streamUrl,
          playingurl: mergedEpisodes[0]?.playingurl || existing.playingurl || item.playingurl,
          episodes: mergedEpisodes,
          _epsLen: mergedEpisodes.length,
        });
      }
    }

    // Interleave across VJs while prioritizing newest MunoWatch IDs so all VJs are represented cleanly
    const sortedCandidates = Array.from(dedupByClueAndVj.values()).sort(
      (a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)
    );
    const uniquePlayable = sortedCandidates.slice(0, 220);

    const tmdbConfigured = hasTmdbCredentials();
    let correlatedRaw: any[] = [];

    if (tmdbConfigured) {
      correlatedRaw = await runWithConcurrency(uniquePlayable, 12, async (munoItem, idx) =>
        correlateMunoItemWithTmdb(munoItem, { isTrending: idx < 24 })
      );
    }

    // Keep EVERY distinct VJ/VOD entry (`tmdb-${type}-${tmdbId}-${vjSlug}`), even when sharing the same TMDB banner
    const verifiedMap = new Map<string, any>();
    for (const item of correlatedRaw) {
      if (item && item.id && item.backdropUrl && item.videoUrl && !verifiedMap.has(item.id)) {
        verifiedMap.set(item.id, item);
      }
    }

    // If TMDB credentials are not configured (e.g. Cloud Run deploy without .env) or TMDB failed,
    // gracefully build the live catalog directly from playable MunoWatch entries instead of failing with 502.
    if (verifiedMap.size === 0 && uniquePlayable.length > 0) {
      for (let idx = 0; idx < uniquePlayable.length; idx++) {
        const fallbackItem = buildMunoFallbackItem(uniquePlayable[idx], {
          isTrending: idx < 24,
        });
        if (fallbackItem && fallbackItem.id && !verifiedMap.has(fallbackItem.id)) {
          verifiedMap.set(fallbackItem.id, fallbackItem);
        }
      }
    }

    const baseVerifiedAll = Array.from(verifiedMap.values());
    if (baseVerifiedAll.length === 0) {
      const existingCached = getCached('__catalog__') || lastGoodCatalog;
      if (existingCached) return existingCached;
      return {
        hero: null,
        tvHero: null,
        featuredBanners: [],
        all: [],
        sections: {
          trending: [],
          top10: [],
          tvShows: [],
          movies: [],
          upcoming: [],
          byGenre: {},
        },
        genreBanners: [],
        notifications: [],
      };
    }

    // Group VJ stream options by canonical key (`tmdb-${type}-${tmdbId}` or `muno-${type}-${slug}`) so every title knows all VJs
    const getCanonicalKey = (item: any) =>
      item.canonicalKey ||
      (item.tmdbId ? `tmdb-${item.type}-${item.tmdbId}` : `muno-${item.type}-${item.title.toLowerCase()}`);

    const vjStreamsByCanonical = new Map<string, Array<{ id: string; vjName: string; videoUrl: string; munoId?: number | string; seriesCode?: string }>>();
    for (const item of baseVerifiedAll) {
      const canonical = getCanonicalKey(item);
      const list = vjStreamsByCanonical.get(canonical) || [];
      if (!list.some((v) => v.vjName.toLowerCase() === String(item.vjName || '').toLowerCase())) {
        list.push({
          id: item.id,
          vjName: item.vjName || 'Luganda Dubbed',
          videoUrl: item.videoUrl,
          munoId: item.munoId,
          seriesCode: item.seriesCode,
        });
      }
      vjStreamsByCanonical.set(canonical, list);
    }

    for (const item of baseVerifiedAll) {
      const canonical = getCanonicalKey(item);
      const streams = vjStreamsByCanonical.get(canonical) || [];
      verifiedMap.set(item.id, {
        ...item,
        vjStreams: streams,
      });
    }

    const verifiedAll = Array.from(verifiedMap.values());

    // Helper to get unique titles per canonical title for Hero Carousel & Top 10 / Trending rows
    const uniqueByTmdb = (items: any[]) => {
      const seen = new Set<string>();
      const out: any[] = [];
      for (const m of items) {
        const k = m.tmdbId ? `${m.type}-${m.tmdbId}` : getCanonicalKey(m);
        if (!seen.has(k)) {
          seen.add(k);
          out.push(m);
        }
      }
      return out;
    };

    const trending = uniqueByTmdb(verifiedAll)
      .slice(0, 18)
      .map((item, idx) => ({
        ...item,
        isTrending: true,
        top10Rank: idx < 10 ? idx + 1 : undefined,
      }));
    const top10 = trending.slice(0, 10);
    const tvShows = verifiedAll.filter((m) => m.type === 'series');
    const movies = verifiedAll.filter((m) => m.type === 'movie');
    const upcoming = verifiedAll.filter((m) => m.year >= 2025).slice(0, 24);

    const byGenre: Record<string, any[]> = {};
    const usedBannerUrls = new Set<string>();
    const genreBanners: Array<{ id: string; name: string; image: string }> = [];

    CATALOG_GENRE_DEFS.forEach((def) => {
      let matched = verifiedAll.filter((m) =>
        m.genres.some((g: string) => g.toLowerCase() === def.name.toLowerCase())
      );

      // Keep every genre category populated from dual-verified movies cleanly
      if (matched.length === 0 && def.name === 'Sports') {
        matched = verifiedAll
          .filter(
            (m) =>
              m.genres.includes('Action') ||
              m.genres.includes('Documentary') ||
              m.genres.includes('Adventure')
          )
          .slice(0, 10);
      }

      byGenre[def.name] = matched;
      if (matched.length === 0) {
        return;
      }

      const distinctWithBackdrop =
        matched.find((m) => m.backdropUrl && !usedBannerUrls.has(m.backdropUrl)) ||
        matched.find((m) => Boolean(m.backdropUrl)) ||
        verifiedAll.find((m) => m.backdropUrl && !usedBannerUrls.has(m.backdropUrl)) ||
        verifiedAll[0];

      const bannerImg = distinctWithBackdrop?.backdropUrl || '';
      if (bannerImg) usedBannerUrls.add(bannerImg);
      genreBanners.push({
        id: def.id,
        name: def.name,
        image: bannerImg,
      });
    });

    const featuredCandidates = uniqueByTmdb(
      verifiedAll.filter((m) => Boolean(m.backdropUrl) && Boolean(m.posterUrl))
    );
    const featuredMapped = (
      featuredCandidates.length > 0 ? featuredCandidates : uniqueByTmdb(verifiedAll)
    ).slice(0, 5);

    const primaryCandidate =
      featuredMapped.find((m) => m.type === 'series') ||
      tvShows[0] ||
      featuredMapped[0] ||
      null;

    const secondarySeriesCandidate =
      tvShows.find((m) => m.id !== primaryCandidate?.id && Boolean(m.backdropUrl)) ||
      tvShows[0] ||
      primaryCandidate;

    const [hydratedHero, hydratedTvHero] = await Promise.all([
      hydrateHeroMovie(primaryCandidate),
      secondarySeriesCandidate && secondarySeriesCandidate.id === primaryCandidate?.id
        ? Promise.resolve(null)
        : hydrateHeroMovie(secondarySeriesCandidate),
    ]);

    const hero = hydratedHero || primaryCandidate;
    const tvHero = hydratedTvHero || hero;

    const featuredBanners = featuredMapped.map((banner) =>
      hero && banner.id === hero.id ? hero : banner
    );

    // Ensure hydrated heroes replace summary entries in verifiedMap
    if (hero) verifiedMap.set(hero.id, hero);
    if (tvHero) verifiedMap.set(tvHero.id, tvHero);

    const notifications = [
      ...trending.slice(0, 2).map((m: any, idx: number) => ({
        id: `muno-tmdb-tr-${m.id}`,
        title: idx === 0 ? '#1 New & Playable Now' : `Translated by ${m.vjName || 'VJ'}`,
        message: `${m.title} (${m.year}) — ${m.genres.slice(0, 2).join(' · ')}`,
        movieId: m.id,
        timeAgo: idx === 0 ? 'Just now' : '3h ago',
        read: false,
        thumbnailUrl: m.backdropUrl || m.posterUrl,
        type: 'new-arrival' as const,
      })),
      ...upcoming.slice(0, 2).map((m: any, idx: number) => ({
        id: `muno-tmdb-up-${m.id}`,
        title: 'Latest Release',
        message: `${m.title} (${m.vjName || 'Luganda Dubbed'}) is ready to stream.`,
        movieId: m.id,
        timeAgo: `${idx + 1}d ago`,
        read: idx > 0,
        thumbnailUrl: m.backdropUrl || m.posterUrl,
        type: 'coming-soon' as const,
      })),
    ];

    const catalog = {
      hero,
      tvHero,
      featuredBanners,
      all: Array.from(verifiedMap.values()),
      sections: {
        trending: trending.map((item) => verifiedMap.get(item.id) || item),
        top10: top10.map((item) => verifiedMap.get(item.id) || item),
        tvShows: tvShows.map((item) => verifiedMap.get(item.id) || item),
        movies: movies.map((item) => verifiedMap.get(item.id) || item),
        upcoming: upcoming.map((item) => verifiedMap.get(item.id) || item),
        byGenre,
      },
      genreBanners,
      notifications,
    };

    lastGoodCatalog = catalog;
    setCached('__catalog__', catalog);
    return catalog;
  })();

  try {
    return await catalogInFlight;
  } finally {
    catalogInFlight = null;
  }
}

async function resolveMunoStreamForTitle(title: string, munoIdParam?: string, seriesCodeParam?: string) {
  try {
    if (seriesCodeParam) {
      const sData = await munoFetch<any>(`/series?code=${encodeURIComponent(seriesCodeParam)}`);
      const raw = sData?.data || sData;
      if (raw && (!title || isMatchingSeriesTitleServer(title, raw.title))) {
        const eps = flattenMunoEpisodes(raw);
        const url = extractMunoPlayableUrl(raw, eps);
        if (eps.length > 0 || url) {
          return {
            videoUrl: url || undefined,
            vjName: raw?.vj ? normalizeVjName(raw.vj) : undefined,
            episodes: eps,
          };
        }
      }
    }
    if (munoIdParam) {
      const mData = await munoFetch<any>(`/movie?id=${encodeURIComponent(munoIdParam)}`);
      const raw = mData?.data || mData;
      const eps = flattenMunoEpisodes(raw);
      const url = extractMunoPlayableUrl(raw, eps);
      return {
        videoUrl: url || undefined,
        vjName: raw?.vj ? normalizeVjName(raw.vj) : undefined,
        episodes: eps,
      };
    }
    if (title) {
      const sRes = await munoFetch<any>(`/search?q=${encodeURIComponent(title)}`);
      const list = Array.isArray(sRes?.data) ? sRes.data : [];
      for (const candidate of list) {
        const eps = flattenMunoEpisodes(candidate);
        const url = extractMunoPlayableUrl(candidate, eps);
        if (url) {
          return {
            videoUrl: url,
            vjName: normalizeVjName(candidate.vj),
            episodes: eps,
            munoId: candidate.id,
            seriesCode: candidate.series_code ? String(candidate.series_code) : undefined,
          };
        }
      }
    }
  } catch {
    // Non-fatal fallback
  }
  return null;
}

async function resolveTmdbMatch(title: string, requestedType: 'movie' | 'series'): Promise<{ tmdbId: number; mediaType: 'movie' | 'series' } | null> {
  const clue = extractMunoTitleClue(title);
  const cleanTitle = clue.cleanTitle;
  if (!cleanTitle) return null;

  const multi = await tmdbFetch<any>('/search/multi', {
    query: cleanTitle,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  });
  const bestMulti = pickBestTmdbMatch(multi?.results || [], cleanTitle);
  if (bestMulti) {
    return {
      tmdbId: Number(bestMulti.id),
      mediaType: bestMulti.media_type === 'tv' ? 'series' : 'movie',
    };
  }

  const endpoint = requestedType === 'series' ? '/search/tv' : '/search/movie';
  const primarySearch = await tmdbFetch<any>(endpoint, {
    query: cleanTitle,
    include_adult: 'false',
    language: 'en-US',
    page: '1',
  });
  const bestTyped = pickBestTmdbMatch(primarySearch?.results || [], cleanTitle);
  if (!bestTyped) return null;
  return { tmdbId: Number(bestTyped.id), mediaType: requestedType };
}

async function createAppServer() {
  const app = express();
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });
  app.use(express.json({ limit: '10mb' }));

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  app.get('/api/public/config', (_req: Request, res: Response) => {
    res.json({ config: currentSiteConfig });
  });

  app.get('/api/notifications', async (_req: Request, res: Response) => {
    try {
      const catalog = (getCached('__catalog__') ||
        lastGoodCatalog ||
        (await buildTmdbCatalog().catch(() => null))) as { notifications?: any[]; all?: any[] } | null;
      const effectiveCatalog = applyUploadedContentToCatalog(catalog);
      const customNotifs = siteNotificationsStore;
      const customIds = new Set(customNotifs.map((n: any) => n.id));
      const catalogNotifs = Array.isArray(effectiveCatalog?.notifications)
        ? effectiveCatalog.notifications.filter((n: any) => !customIds.has(n.id))
        : [];
      const merged = [...customNotifs, ...catalogNotifs].slice(0, 30);
      res.json({ notifications: merged });
    } catch {
      res.json({ notifications: siteNotificationsStore });
    }
  });

  app.post('/api/users/sync', async (req: Request, res: Response) => {
    const idToken = String(req.body?.idToken || '').trim();
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) {
      res.status(401).json({ ok: false, error: 'Valid Firebase session required.' });
      return;
    }
    recordRegisteredUser({
      uid: verified.uid,
      email: verified.email,
      displayName: verified.name || verified.email || 'Netflux Member',
    });
    await syncRtdbUsersDirectory(false);
    const cleanEmail = verified.email ? verified.email.trim().toLowerCase() : null;
    const matched = registeredUsersStore.find(
      (u) => (cleanEmail && u.email === cleanEmail) || u.uid === verified.uid
    );
    const userStats = getUserDirectoryStats();
    res.json({
      ok: true,
      totalUsers: userStats.totalUsers,
      activeUsersNow: userStats.activeUsersNow,
      isPremium: Boolean(matched?.isPremium),
      isBlocked: Boolean(matched?.isBlocked),
    });
  });

  app.post('/api/admin/verify', (req: Request, res: Response) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const rawPassword = String(req.body?.password || '');

    const emailMatches = timingSafeTextEqual(rawEmail, ADMIN_EMAIL);
    const passwordMatches = timingSafeTextEqual(rawPassword, ADMIN_PASSWORD);

    if (!emailMatches || !passwordMatches) {
      res.status(401).json({
        ok: false,
        admin: false,
        error: 'Incorrect admin email or password. Admin access denied.',
      });
      return;
    }

    recordRegisteredUser({
      uid: `admin:${ADMIN_EMAIL}`,
      email: ADMIN_EMAIL,
      displayName: 'Ashraf (Admin)',
    });
    const token = createAdminToken(ADMIN_EMAIL);
    res.json({
      ok: true,
      admin: true,
      email: ADMIN_EMAIL,
      token,
    });
  });

  app.post('/api/admin/firebase-session', async (req: Request, res: Response) => {
    const idToken = String(req.body?.idToken || '').trim();
    const verified = await verifyFirebaseAdminIdToken(idToken);
    if (!verified) {
      res.status(401).json({
        ok: false,
        admin: false,
        error: 'Verified admin Google/Firebase session required.',
      });
      return;
    }

    recordRegisteredUser({
      uid: verified.uid,
      email: ADMIN_EMAIL,
      displayName: 'Ashraf (Admin)',
    });
    const token = createAdminToken(ADMIN_EMAIL);
    res.json({
      ok: true,
      admin: true,
      email: ADMIN_EMAIL,
      token,
    });
  });

  const requireAdmin = (req: Request, res: Response, next: () => void) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const verified = verifyAdminToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Admin email and password confirmation required.' });
      return;
    }
    next();
  };

  app.get('/api/admin/session', requireAdmin, (_req: Request, res: Response) => {
    res.json({ ok: true, admin: true, email: ADMIN_EMAIL });
  });

  app.post('/api/admin/users/premium', requireAdmin, (req: Request, res: Response) => {
    const targetKey = String(req.body?.key || '').trim();
    const isPremium = Boolean(req.body?.isPremium);
    const idx = registeredUsersStore.findIndex((u) => u.key === targetKey);
    if (idx < 0) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    registeredUsersStore[idx] = {
      ...registeredUsersStore[idx],
      isPremium,
      premiumActivatedAt: isPremium ? Date.now() : undefined,
    };
    persistJsonArray(REGISTERED_USERS_PATH, registeredUsersStore);
    res.json({
      ok: true,
      user: registeredUsersStore[idx],
      stats: getUserDirectoryStats(),
      subscriptionSummary: buildSubscriptionSummaryServer(),
    });
  });

  app.post('/api/admin/users/block', requireAdmin, (req: Request, res: Response) => {
    const targetKey = String(req.body?.key || '').trim();
    const isBlocked = Boolean(req.body?.isBlocked);
    const idx = registeredUsersStore.findIndex((u) => u.key === targetKey);
    if (idx < 0) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    if ((registeredUsersStore[idx].email || '').toLowerCase() === ADMIN_EMAIL) {
      res.status(400).json({ error: 'Cannot disable the administrator account.' });
      return;
    }
    registeredUsersStore[idx] = {
      ...registeredUsersStore[idx],
      isBlocked,
      blockedAt: isBlocked ? Date.now() : undefined,
    };
    persistJsonArray(REGISTERED_USERS_PATH, registeredUsersStore);
    res.json({
      ok: true,
      user: registeredUsersStore[idx],
      stats: getUserDirectoryStats(),
    });
  });

  app.get('/api/admin/overview', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [catalog] = await Promise.all([
        Promise.resolve(getCached('__catalog__') || lastGoodCatalog).then(
          (cached) => cached || buildTmdbCatalog().catch(() => null)
        ),
        syncRtdbUsersDirectory(true),
      ]);
      const effectiveCatalog = applyUploadedContentToCatalog(catalog as { all?: any[] } | null);
      const items = Array.isArray(effectiveCatalog?.all) ? effectiveCatalog.all : [];

      let moviesCount = 0;
      let seriesCount = 0;
      const vjSet = new Set<string>();

      for (const item of items) {
        if (item.type === 'series') seriesCount++;
        else moviesCount++;
        vjSet.add(normalizeVjName(item.vjName));
      }

      const userStats = getUserDirectoryStats();
      const cutoffNow = Date.now() - 15 * 60 * 1000;
      const emailUsersList = registeredUsersStore
        .filter(
          (u) =>
            u &&
            u.email &&
            u.email.includes('@') &&
            !isSyntheticTestUserServer(u.key, u.email) &&
            !isSyntheticTestUserServer(u.uid, u.email)
        )
        .map((u) => ({
          key: u.key,
          email: u.email as string,
          isPremium: Boolean(u.isPremium),
          isBlocked: Boolean(u.isBlocked),
          activeNow: !u.isBlocked && u.lastSeenAt >= cutoffNow,
          lastSeenAt: u.lastSeenAt || 0,
        }))
        .sort((a, b) => Number(b.activeNow) - Number(a.activeNow) || b.lastSeenAt - a.lastSeenAt);

      res.json({
        adminEmail: ADMIN_EMAIL,
        stats: {
          totalUsers: userStats.totalUsers,
          activeUsersNow: userStats.activeUsersNow,
          activeUsersToday: userStats.activeUsersToday,
          moviesCount,
          seriesCount,
          totalVods: items.length,
          uniqueVjsCount: vjSet.size,
          premiumUsersCount: userStats.premiumUsersCount,
          blockedUsersCount: userStats.blockedUsersCount,
        },
        subscriptionSummary: buildSubscriptionSummaryServer(),
        users: emailUsersList,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load admin overview' });
    }
  });

  app.post('/api/admin/movies', requireAdmin, (req: Request, res: Response) => {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title || title.length < 2) {
      res.status(400).json({ error: 'Movie title is required.' });
      return;
    }

    const rawVideoUrl = String(body.videoUrl || '').trim();
    const cleanVideoUrl = sanitizeMunoStreamUrl(rawVideoUrl);
    if (!cleanVideoUrl) {
      res.status(400).json({ error: 'A valid HTTP/HTTPS stream or MP4 video URL is required.' });
      return;
    }

    const mediaType: 'movie' | 'series' = body.type === 'series' ? 'series' : 'movie';
    const yearNum = Number(body.year) || new Date().getFullYear();
    const vjName = normalizeVjName(body.vjName || 'VJ Junior');
    const genresRaw = Array.isArray(body.genres)
      ? body.genres
      : String(body.genres || 'Action')
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean);
    const genres = genresRaw.length > 0 ? genresRaw.slice(0, 4) : ['Action'];
    const durationOrSeasons =
      String(body.durationOrSeasons || '').trim() ||
      (mediaType === 'series' ? '1 Season' : '1h 55m');
    const synopsis =
      String(body.synopsis || '').trim() ||
      `${title} translated by ${vjName} — now streaming on Netflux.`;

    const fallbackArt = '/icons/icon-512x512.png';
    const rawPoster = String(body.posterUrl || '').trim();
    const rawBackdrop = String(body.backdropUrl || '').trim();
    const isSafeImg = (u: string) =>
      /^https?:\/\//i.test(u) || /^data:image\//i.test(u) || u.startsWith('/');
    const posterUrl = isSafeImg(rawPoster) ? rawPoster : isSafeImg(rawBackdrop) ? rawBackdrop : fallbackArt;
    const backdropUrl = isSafeImg(rawBackdrop) ? rawBackdrop : posterUrl;

    const now = Date.now();
    const movieId = `admin-movie-${now}`;
    const newMovie = {
      id: movieId,
      title: title.slice(0, 120),
      type: mediaType,
      year: yearNum,
      ageRating: mediaType === 'series' ? '16+' : '13+',
      quality: '4K Ultra HD' as const,
      durationOrSeasons,
      genres,
      synopsis,
      matchScore: 98,
      posterUrl,
      backdropUrl,
      cast: [],
      isOriginal: true,
      isTrending: true,
      videoUrl: cleanVideoUrl,
      vjName,
      vjStreams: [
        {
          id: movieId,
          vjName,
          videoUrl: cleanVideoUrl,
        },
      ],
      ...(mediaType === 'series'
        ? {
            seasonsCount: 1,
            episodes: [
              {
                id: `${movieId}-ep-1`,
                seasonNumber: 1,
                episodeNumber: 1,
                title: `${title} · Episode 1`,
                duration: '45m',
                durationSeconds: 2700,
                synopsis,
                thumbnail: backdropUrl,
                videoUrl: cleanVideoUrl,
                vjName,
              },
            ],
          }
        : {}),
    };

    uploadedMoviesStore = [newMovie, ...uploadedMoviesStore].slice(0, 100);
    persistJsonArray(UPLOADED_MOVIES_PATH, uploadedMoviesStore);

    const newNotification = {
      id: `upload-${movieId}`,
      title: `New Upload: ${newMovie.title}`,
      message: `${newMovie.title} (${newMovie.year}) · ${vjName} is now available to stream.`,
      movieId: newMovie.id,
      timeAgo: 'Just now',
      createdAt: now,
      read: false,
      thumbnailUrl: backdropUrl,
      type: 'new-arrival' as const,
    };

    siteNotificationsStore = [newNotification, ...siteNotificationsStore].slice(0, 50);
    persistJsonArray(SITE_NOTIFICATIONS_PATH, siteNotificationsStore);

    res.json({ ok: true, movie: newMovie, notification: newNotification });
  });

  app.delete('/api/admin/movies/:id', requireAdmin, (req: Request, res: Response) => {
    const targetId = String(req.params.id || '').trim();
    const prevLen = uploadedMoviesStore.length;
    uploadedMoviesStore = uploadedMoviesStore.filter((m) => m.id !== targetId);
    if (uploadedMoviesStore.length !== prevLen) {
      persistJsonArray(UPLOADED_MOVIES_PATH, uploadedMoviesStore);
    }
    siteNotificationsStore = siteNotificationsStore.filter((n) => n.movieId !== targetId);
    persistJsonArray(SITE_NOTIFICATIONS_PATH, siteNotificationsStore);
    res.json({ ok: true });
  });

  app.post('/api/admin/config', requireAdmin, (req: Request, res: Response) => {
    const body = req.body || {};
    const disclaimerEnabled =
      typeof body.disclaimerEnabled === 'boolean'
        ? body.disclaimerEnabled
        : currentSiteConfig.disclaimerEnabled;
    const disclaimerTitle =
      typeof body.disclaimerTitle === 'string' && body.disclaimerTitle.trim()
        ? body.disclaimerTitle.trim().slice(0, 80)
        : DEFAULT_SITE_CONFIG.disclaimerTitle;
    const disclaimerMessage =
      typeof body.disclaimerMessage === 'string' && body.disclaimerMessage.trim()
        ? body.disclaimerMessage.trim().slice(0, 400)
        : DEFAULT_SITE_CONFIG.disclaimerMessage;
    const whatsappButtonLabel =
      typeof body.whatsappButtonLabel === 'string' && body.whatsappButtonLabel.trim()
        ? body.whatsappButtonLabel.trim().slice(0, 60)
        : DEFAULT_SITE_CONFIG.whatsappButtonLabel;
    const whatsappGroupUrl = normalizeSafeHttpUrl(
      body.whatsappGroupUrl,
      currentSiteConfig.whatsappGroupUrl || DEFAULT_WHATSAPP_GROUP_URL
    );
    const whatsappPrefillMessage =
      typeof body.whatsappPrefillMessage === 'string' && body.whatsappPrefillMessage.trim()
        ? body.whatsappPrefillMessage.trim().slice(0, 300)
        : DEFAULT_SITE_CONFIG.whatsappPrefillMessage;
    const siteAnnouncement =
      typeof body.siteAnnouncement === 'string'
        ? body.siteAnnouncement.trim().slice(0, 180)
        : currentSiteConfig.siteAnnouncement;
    const pinnedFeaturedMovieId =
      typeof body.pinnedFeaturedMovieId === 'string'
        ? body.pinnedFeaturedMovieId.trim().slice(0, 120)
        : currentSiteConfig.pinnedFeaturedMovieId || '';

    const updated: SitePublicConfig = {
      disclaimerEnabled,
      disclaimerTitle,
      disclaimerMessage,
      whatsappButtonLabel,
      whatsappGroupUrl,
      whatsappPrefillMessage,
      siteAnnouncement,
      pinnedFeaturedMovieId,
      updatedAt: Date.now(),
    };
    persistSiteConfig(updated);
    res.json({ ok: true, config: updated });
  });

  app.get('/api/tmdb/health', (_req: Request, res: Response) => {
    const configured = Boolean(process.env.TMDB_API_TOKEN || process.env.TMDB_API_KEY);
    res.json({ ok: true, configured, munoSource: MUNO_PRIMARY_BASE });
  });

  app.get('/api/munowatch/vjs', async (_req: Request, res: Response) => {
    try {
      const dash = await munoFetch<any>('/dashboard');
      const vjs = dash?.data?.vjs || dash?.vjs || [];
      res.json({ vjs });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to fetch MunoWatch VJs', vjs: [] });
    }
  });

  app.get('/api/tmdb/catalog', async (_req: Request, res: Response) => {
    try {
      const catalog = await buildTmdbCatalog();
      res.json(applyUploadedContentToCatalog(catalog));
    } catch {
      const fallback = getCached('__catalog__') ||
        lastGoodCatalog || {
          hero: null,
          tvHero: null,
          featuredBanners: [],
          all: [],
          sections: {
            trending: [],
            top10: [],
            tvShows: [],
            movies: [],
            upcoming: [],
            byGenre: {},
          },
          genreBanners: [],
          notifications: [],
        };
      res.json(applyUploadedContentToCatalog(fallback));
    }
  });

  app.get('/api/tmdb/trending', async (req: Request, res: Response) => {
    try {
      const typeParam = String(req.query.type || 'all');
      const catalog = applyUploadedContentToCatalog(await buildTmdbCatalog());
      const base =
        typeParam === 'movie'
          ? catalog.sections.movies
          : typeParam === 'tv' || typeParam === 'series'
            ? catalog.sections.tvShows
            : catalog.sections.trending;
      res.json({ results: base });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to fetch dual-verified trending data' });
    }
  });

  app.get('/api/tmdb/search', async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || '').trim();
      const typeParam = String(req.query.type || 'all');
      if (!q) {
        res.json({ results: [] });
        return;
      }

      const cleanVjCandidate = /^vj[\s.]/i.test(q)
        ? normalizeVjName(q)
        : `Vj ${q.trim()}`;

      const [munoSearchRes, munoVjRes, catalog] = await Promise.all([
        munoFetch<any>(`/search?q=${encodeURIComponent(q)}`).catch(() => ({ data: [] })),
        munoFetch<any>(`/movies?vj=${encodeURIComponent(cleanVjCandidate)}&limit=40`).catch(() => ({
          data: [],
        })),
        buildTmdbCatalog().catch(() => null),
      ]);

      const rawMunoItems: any[] = [
        ...(Array.isArray(munoSearchRes?.data) ? munoSearchRes.data : []),
        ...(Array.isArray(munoVjRes?.data) ? munoVjRes.data : []),
      ];

      // Deduplicate raw Muno items by id before TMDB correlation
      const uniqueRawMap = new Map<string, any>();
      for (const item of rawMunoItems) {
        if (!item) continue;
        const k = String(item.id || `${item.title}-${item.vj || ''}`);
        if (!uniqueRawMap.has(k)) {
          uniqueRawMap.set(k, item);
        }
      }

      // Correlate MunoWatch search items against TMDB when configured, falling back to MunoWatch metadata cleanly
      const tmdbConfigured = hasTmdbCredentials();
      const correlated = await runWithConcurrency(
        Array.from(uniqueRawMap.values()).slice(0, 36),
        10,
        async (item) =>
          (tmdbConfigured ? await correlateMunoItemWithTmdb(item) : null) ||
          buildMunoFallbackItem(item)
      );

      const lowerQ = q.toLowerCase();
      const effectiveSearchCatalog = applyUploadedContentToCatalog(catalog);
      const catalogSource = effectiveSearchCatalog?.all || uploadedMoviesStore;
      const catalogMatches = catalogSource.filter(
        (m: any) =>
          m.videoUrl &&
          m.backdropUrl &&
          (m.title.toLowerCase().includes(lowerQ) ||
            (m.vjName && m.vjName.toLowerCase().includes(lowerQ)) ||
            (Array.isArray(m.genres) && m.genres.some((g: string) => g.toLowerCase().includes(lowerQ))))
      );

      const mergedMap = new Map<string, any>();
      for (const item of [...catalogMatches, ...correlated]) {
        if (!item || !item.id || !item.videoUrl || !item.backdropUrl) continue;
        if (typeParam === 'movie' && item.type !== 'movie') continue;
        if ((typeParam === 'series' || typeParam === 'tv') && item.type !== 'series') continue;
        if (!mergedMap.has(item.id)) {
          const canonical =
            item.canonicalKey ||
            (item.tmdbId ? `tmdb-${item.type}-${item.tmdbId}` : `muno-${item.type}-${item.title.toLowerCase()}`);
          const variants = munoVariantsByTmdbKey.get(canonical);
          const vjStreams = variants
            ? Array.from(variants.values()).map((v) => ({
                id: v.id,
                vjName: v.vjName,
                videoUrl: v.videoUrl,
                munoId: v.munoId,
                seriesCode: v.seriesCode,
              }))
            : item.vjStreams;
          mergedMap.set(item.id, { ...item, vjStreams });
        }
      }

      res.json({ results: Array.from(mergedMap.values()).slice(0, 32) });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to search MunoWatch & TMDB' });
    }
  });

  app.get('/api/tmdb/season', async (req: Request, res: Response) => {
    try {
      const tmdbId = Number(req.query.tmdbId);
      const season = Math.max(1, Number(req.query.season) || 1);
      const fallbackBackdrop = String(req.query.backdrop || '');
      const seriesCode = String(req.query.seriesCode || '');

      if (!tmdbId && !seriesCode) {
        res.status(400).json({ error: 'Valid tmdbId or seriesCode is required' });
        return;
      }

      const tmdbKey = tmdbId ? `tmdb-series-${tmdbId}` : '';
      const indexed = tmdbKey ? munoByTmdbKey.get(tmdbKey) : undefined;
      const effectiveSeriesCode = seriesCode || indexed?.seriesCode;

      const [seasonData, munoSeriesData] = await Promise.all([
        tmdbId && hasTmdbCredentials()
          ? tmdbFetch<any>(`/tv/${tmdbId}/season/${season}`, { language: 'en-US' }).catch(() => null)
          : Promise.resolve(null),
        effectiveSeriesCode
          ? munoFetch<any>(`/series?code=${encodeURIComponent(effectiveSeriesCode)}`).catch(() => null)
          : Promise.resolve(null),
      ]);

      const rawSeriesPayload = munoSeriesData?.data || munoSeriesData;
      const seriesTitleHint = seasonData?.name || rawSeriesPayload?.title;
      const verifiedSeriesEps =
        rawSeriesPayload &&
        (!seriesTitleHint || isMatchingSeriesTitleServer(seriesTitleHint, rawSeriesPayload.title))
          ? flattenMunoEpisodes(rawSeriesPayload)
          : [];
      const munoEps: MunoEpisodeCandidate[] = [
        ...(indexed?.episodes || []),
        ...verifiedSeriesEps,
      ];

      if (seasonData?.episodes?.length) {
        const tmdbEpisodes = mapEpisodes(seasonData.episodes, fallbackBackdrop);
        const episodes = attachMunoStreamsToEpisodes(
          tmdbEpisodes,
          munoEps,
          indexed?.videoUrl,
          indexed?.vjName
        );
        res.json({ episodes });
        return;
      }

      const fallbackEpisodes = munoEps.map((ep, idx) => {
        const epNum = extractEpisodeNumber(ep) || idx + 1;
        return {
          id: `muno-ep-${effectiveSeriesCode || tmdbId || 's'}-${season}-${epNum}-${idx}`,
          seasonNumber: season,
          episodeNumber: epNum,
          title: ep.title || `Episode ${epNum}`,
          duration: '45m',
          durationSeconds: 45 * 60,
          synopsis: 'Ready to stream.',
          thumbnail: fallbackBackdrop,
          videoUrl: ep.streamUrl || indexed?.videoUrl,
          vjName: ep.vj ? normalizeVjName(ep.vj) : indexed?.vjName,
        };
      });

      res.json({ episodes: fallbackEpisodes });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to fetch season episodes' });
    }
  });

  app.get('/api/tmdb/details', async (req: Request, res: Response) => {
    try {
      const requestedId = String(req.query.id || '');
      const title = String(req.query.title || '').trim();
      const requestedType: 'movie' | 'series' =
        req.query.type === 'series' || req.query.type === 'tv' ? 'series' : 'movie';
      const queryMunoId = String(req.query.munoId || '');
      const querySeriesCode = String(req.query.seriesCode || '');
      const queryVideoUrl = sanitizeMunoStreamUrl(String(req.query.videoUrl || ''));
      const queryVjName = String(req.query.vjName || '');

      const uploadedMatch = uploadedMoviesStore.find(
        (m: any) =>
          (requestedId && m.id === requestedId) ||
          (title && m.title?.toLowerCase() === title.toLowerCase())
      );
      if (uploadedMatch) {
        const rawCatalog = (getCached('__catalog__') || lastGoodCatalog) as { all?: any[] } | null;
        const effectiveCatalog = applyUploadedContentToCatalog(rawCatalog);
        const similarMovies = (Array.isArray(effectiveCatalog?.all) ? effectiveCatalog.all : [])
          .filter((m: any) => m.id !== uploadedMatch.id && m.videoUrl && m.backdropUrl)
          .slice(0, 9);
        res.json({
          movie: {
            ...uploadedMatch,
            similarMovies,
          },
        });
        return;
      }

      let tmdbId = Number(req.query.tmdbId) || 0;
      let resolvedType: 'movie' | 'series' = requestedType;
      const tmdbConfigured = hasTmdbCredentials();

      if (!tmdbId && title && tmdbConfigured) {
        try {
          const match = await resolveTmdbMatch(title, requestedType);
          if (match) {
            tmdbId = match.tmdbId;
            resolvedType = match.mediaType;
          }
        } catch {
          // Non-fatal fallback to MunoWatch metadata below
        }
      }

      const canonicalKey = tmdbId
        ? `tmdb-${resolvedType}-${tmdbId}`
        : `muno-${resolvedType}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
      const indexed =
        (requestedId ? munoByTmdbKey.get(requestedId) : undefined) ||
        munoByTmdbKey.get(canonicalKey);
      const effectiveSeriesCode = querySeriesCode || indexed?.seriesCode;
      const effectiveMunoId = queryMunoId || (indexed?.munoId ? String(indexed.munoId) : '');

      const tmdbEndpoint = resolvedType === 'series' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
      const shouldFetchMunoExtra =
        Boolean(effectiveSeriesCode && resolvedType === 'series') ||
        Boolean(effectiveMunoId) ||
        (!indexed?.videoUrl && !queryVideoUrl);

      const [raw, munoExtra] = await Promise.all([
        tmdbId && tmdbConfigured
          ? tmdbFetch<any>(tmdbEndpoint, {
              append_to_response: 'credits,videos,recommendations,similar,release_dates,content_ratings',
              language: 'en-US',
            }).catch(() => null)
          : Promise.resolve(null),
        shouldFetchMunoExtra
          ? resolveMunoStreamForTitle(
              title,
              effectiveMunoId || undefined,
              resolvedType === 'series' ? effectiveSeriesCode : undefined
            )
          : Promise.resolve(null),
      ]);

      const catalog = (getCached('__catalog__') || lastGoodCatalog) as { all?: any[] } | null;
      const catalogItems = Array.isArray(catalog?.all) ? catalog.all : [];
      const catalogMatch = catalogItems.find(
        (m: any) =>
          (requestedId && m.id === requestedId) ||
          (tmdbId && Number(m.tmdbId) === tmdbId) ||
          (title && m.title?.toLowerCase() === title.toLowerCase())
      );

      if (!raw) {
        const finalVideoUrl =
          queryVideoUrl || indexed?.videoUrl || munoExtra?.videoUrl || catalogMatch?.videoUrl || undefined;
        const finalVjName =
          (queryVjName ? normalizeVjName(queryVjName) : undefined) ||
          indexed?.vjName ||
          munoExtra?.vjName ||
          catalogMatch?.vjName;
        const munoEpisodesPool: MunoEpisodeCandidate[] = [
          ...(indexed?.episodes || []),
          ...(munoExtra?.episodes || []),
        ];
        const fallbackBackdrop = catalogMatch?.backdropUrl || catalogMatch?.posterUrl || '';
        const episodes =
          resolvedType === 'series' && munoEpisodesPool.length > 0
            ? munoEpisodesPool.map((ep, idx) => {
                const epNum = extractEpisodeNumber(ep) || idx + 1;
                return {
                  id: `muno-ep-${effectiveSeriesCode || effectiveMunoId || 's'}-${epNum}-${idx}`,
                  seasonNumber: 1,
                  episodeNumber: epNum,
                  title: ep.title || `Episode ${epNum}`,
                  duration: '45m',
                  durationSeconds: 45 * 60,
                  synopsis: catalogMatch?.synopsis || 'Ready to stream.',
                  thumbnail: fallbackBackdrop,
                  videoUrl: ep.streamUrl || finalVideoUrl,
                  vjName: ep.vj ? normalizeVjName(ep.vj) : finalVjName,
                };
              })
            : catalogMatch?.episodes;

        const similarMovies = catalogItems
          .filter((m: any) => m.id !== (requestedId || catalogMatch?.id) && m.videoUrl && m.backdropUrl)
          .slice(0, 9);

        const fallbackVariants = munoVariantsByTmdbKey.get(
          catalogMatch?.canonicalKey || canonicalKey
        );
        const fallbackVjStreams = fallbackVariants
          ? Array.from(fallbackVariants.values()).map((v) => ({
              id: v.id,
              vjName: v.vjName,
              videoUrl: v.videoUrl,
              munoId: v.munoId,
              seriesCode: v.seriesCode,
            }))
          : catalogMatch?.vjStreams;

        res.json({
          movie: {
            ...(catalogMatch || {
              id: requestedId || canonicalKey,
              title: title || 'Featured Title',
              type: resolvedType,
              year: new Date().getFullYear(),
              ageRating: resolvedType === 'series' ? '16+' : '13+',
              quality: '4K Ultra HD',
              durationOrSeasons: resolvedType === 'series' ? 'Series' : '1h 45m',
              genres: ['Action'],
              synopsis: 'Translated in Luganda and ready to stream.',
              matchScore: 86,
              posterUrl: fallbackBackdrop,
              backdropUrl: fallbackBackdrop,
              cast: [],
            }),
            videoUrl: finalVideoUrl,
            vjName: finalVjName,
            vjStreams: fallbackVjStreams,
            episodes,
            similarMovies,
          },
        });
        return;
      }

      const backdropUrl = raw.backdrop_path
        ? `${TMDB_IMG_ORIGINAL}${raw.backdrop_path}`
        : raw.poster_path
          ? `${TMDB_IMG_ORIGINAL}${raw.poster_path}`
          : '';
      const posterUrl = raw.poster_path ? `${TMDB_IMG_POSTER}${raw.poster_path}` : backdropUrl;

      const finalVideoUrl =
        queryVideoUrl || indexed?.videoUrl || munoExtra?.videoUrl || undefined;
      const finalVjName =
        (queryVjName ? normalizeVjName(queryVjName) : undefined) ||
        indexed?.vjName ||
        munoExtra?.vjName;

      const munoEpisodesPool: MunoEpisodeCandidate[] = [
        ...(indexed?.episodes || []),
        ...(munoExtra?.episodes || []),
      ];

      const variants = munoVariantsByTmdbKey.get(canonicalKey);
      const vjStreams = variants
        ? Array.from(variants.values()).map((v) => ({
            id: v.id,
            vjName: v.vjName,
            videoUrl: v.videoUrl,
            munoId: v.munoId,
            seriesCode: v.seriesCode,
          }))
        : finalVideoUrl
          ? [
              {
                id: requestedId || canonicalKey,
                vjName: finalVjName || 'Luganda Dubbed',
                videoUrl: finalVideoUrl,
                munoId: effectiveMunoId || munoExtra?.munoId || undefined,
                seriesCode: effectiveSeriesCode || munoExtra?.seriesCode || undefined,
              },
            ]
          : undefined;

      let episodes: any[] | undefined;
      if (resolvedType === 'series') {
        try {
          const season1 = await tmdbFetch<any>(`/tv/${tmdbId}/season/1`, { language: 'en-US' });
          const mappedEps = mapEpisodes(season1?.episodes || [], backdropUrl);
          episodes = attachMunoStreamsToEpisodes(
            mappedEps,
            munoEpisodesPool,
            finalVideoUrl,
            finalVjName
          );
        } catch {
          episodes = undefined;
        }
      }

      const cast = Array.isArray(raw?.credits?.cast)
        ? raw.credits.cast.slice(0, 6).map((c: any) => c.name).filter(Boolean)
        : [];

      const director =
        resolvedType === 'series'
          ? Array.isArray(raw.created_by) && raw.created_by.length > 0
            ? raw.created_by.map((c: any) => c.name).join(', ')
            : undefined
          : Array.isArray(raw?.credits?.crew)
            ? raw.credits.crew.find((c: any) => c.job === 'Director')?.name
            : undefined;

      const videos = Array.isArray(raw?.videos?.results) ? raw.videos.results : [];
      const trailer =
        videos.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
        videos.find((v: any) => v.site === 'YouTube');

      const dateStr = raw.release_date || raw.first_air_date || '';
      const year = dateStr ? Number(dateStr.slice(0, 4)) || 2024 : 2024;
      const seasonsCount =
        resolvedType === 'series' ? Number(raw.number_of_seasons) || 1 : undefined;
      const durationOrSeasons =
        resolvedType === 'series'
          ? `${seasonsCount} Season${seasonsCount === 1 ? '' : 's'}`
          : formatRuntime(raw.runtime);

      const vote = typeof raw.vote_average === 'number' && raw.vote_average > 0 ? raw.vote_average : 8.5;
      const genres = Array.isArray(raw.genres)
        ? raw.genres.map((g: any) => g.name).filter(Boolean)
        : ['Drama'];

      // Keep "More Like This" strictly within our verified MunoWatch catalog
      const rawRecommendations =
        Array.isArray(raw?.recommendations?.results) && raw.recommendations.results.length > 0
          ? raw.recommendations.results
          : Array.isArray(raw?.similar?.results)
            ? raw.similar.results
            : [];
      const recommendedTmdbIds = new Set(rawRecommendations.map((r: any) => Number(r.id)));

      const seenSimilarTmdb = new Set<number>([tmdbId]);
      const verifiedSimilar = catalogItems
        .filter((m: any) => {
          const mTmdb = Number(m.tmdbId);
          if (!m.videoUrl || !m.backdropUrl || mTmdb === tmdbId || m.id === (requestedId || canonicalKey)) {
            return false;
          }
          return true;
        })
        .sort((a: any, b: any) => {
          const aRec = recommendedTmdbIds.has(Number(a.tmdbId)) ? 1 : 0;
          const bRec = recommendedTmdbIds.has(Number(b.tmdbId)) ? 1 : 0;
          if (aRec !== bRec) return bRec - aRec;
          const aGenreOverlap = a.genres.filter((g: string) => genres.includes(g)).length;
          const bGenreOverlap = b.genres.filter((g: string) => genres.includes(g)).length;
          return bGenreOverlap - aGenreOverlap;
        })
        .filter((m: any) => {
          const mTmdb = Number(m.tmdbId);
          if (!mTmdb) return true;
          if (seenSimilarTmdb.has(mTmdb)) return false;
          seenSimilarTmdb.add(mTmdb);
          return true;
        })
        .slice(0, 9);

      res.json({
        movie: {
          id: requestedId || canonicalKey,
          tmdbId,
          title: raw.title || raw.name || title,
          type: resolvedType,
          year,
          ageRating: extractAgeRating(raw, resolvedType),
          quality: '4K Ultra HD',
          durationOrSeasons,
          seasonsCount,
          genres: genres.length > 0 ? genres : ['Drama'],
          synopsis: raw.overview || 'No synopsis available.',
          tagline: raw.tagline || undefined,
          matchScore: Math.min(99, Math.max(70, Math.round(vote * 10))),
          posterUrl,
          backdropUrl,
          cast,
          director,
          trailerKey: trailer?.key,
          trailerUrl: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
          releaseDate: dateStr || undefined,
          videoUrl: finalVideoUrl,
          vjName: finalVjName,
          munoId: effectiveMunoId || munoExtra?.munoId || undefined,
          seriesCode: effectiveSeriesCode || munoExtra?.seriesCode || undefined,
          vjStreams,
          episodes,
          similarMovies: verifiedSimilar,
        },
      });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to fetch dual-verified movie details' });
    }
  });

  app.get('/api/stream', async (req: Request, res: Response) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const onResClose = () => {
      if (!res.writableEnded) {
        clearTimeout(timeoutId);
        controller.abort();
      }
    };
    res.once('close', onResClose);

    try {
      const rawUrl = String(req.query.url || '');
      const cleanUrl = sanitizeMunoStreamUrl(rawUrl);
      if (!cleanUrl) {
        clearTimeout(timeoutId);
        res.status(400).json({ error: 'Invalid stream URL' });
        return;
      }

      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        clearTimeout(timeoutId);
        res.status(400).json({ error: 'Unsupported protocol' });
        return;
      }

      const isHead = req.method === 'HEAD';
      const upstreamHeaders: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: '*/*',
      };

      if (!isHead) {
        // Cap every single proxy chunk to 4 MiB so responses stay safely under Cloud Run's 32 MiB cap
        upstreamHeaders.Range = computeCappedByteRange(
          typeof req.headers.range === 'string' ? req.headers.range : undefined
        );
      }

      const upstream = await fetch(cleanUrl, {
        method: isHead ? 'HEAD' : 'GET',
        headers: upstreamHeaders,
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).end();
        return;
      }

      res.status(upstream.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition'
      );
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      if (req.query.download === '1') {
        const rawFilename = String(req.query.filename || 'video.mp4')
          .replace(/[^a-zA-Z0-9._\- ()]/g, '_')
          .slice(0, 120);
        const safeFilename = rawFilename.toLowerCase().endsWith('.mp4')
          ? rawFilename
          : `${rawFilename}.mp4`;
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      }

      const forwardHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
      ];
      for (const h of forwardHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }
      if (!upstream.headers.get('accept-ranges')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
      if (!upstream.headers.get('content-type')) {
        res.setHeader('Content-Type', 'video/mp4');
      }

      if (isHead || !upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as any);
      const cleanupStream = () => {
        controller.abort();
        nodeStream.destroy();
      };
      res.once('close', cleanupStream);
      nodeStream.on('end', () => {
        res.removeListener('close', cleanupStream);
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502);
        res.end();
      });
      nodeStream.pipe(res);
    } catch {
      clearTimeout(timeoutId);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to stream video' });
      } else {
        res.end();
      }
    } finally {
      res.removeListener('close', onResClose);
    }
  });

  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  const httpServer = http.createServer(app);

  const distDir = path.resolve(__dirname, 'dist');
  const distIndexPath = path.join(distDir, 'index.html');
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION);
  const hasVitePwa = fs.existsSync(path.resolve(__dirname, 'node_modules/vite-plugin-pwa'));
  const isProduction =
    fs.existsSync(distIndexPath) &&
    (process.env.NODE_ENV === 'production' ||
      process.env.npm_lifecycle_event === 'start' ||
      isCloudRun ||
      !hasVitePwa);

  // Rescue any browser still holding onto an older VitePWA dev-sw.js registration
  app.get('/dev-sw.js', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(
      `self.addEventListener('install', function(){ self.skipWaiting(); });\n` +
        `self.addEventListener('activate', function(e){ e.waitUntil(self.registration.unregister().then(function(){ return self.clients.matchAll(); }).then(function(cs){ cs.forEach(function(c){ c.navigate(c.url); }); })); });\n`
    );
  });

  const isStaticAssetRequestPath = (reqPath: string): boolean => {
    const clean = (reqPath || '').split('?')[0].toLowerCase();
    if (!clean || clean === '/') return false;
    if (clean.startsWith('/assets/') || clean.startsWith('/workbox-')) return true;
    return /\.(?:js|mjs|css|map|png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|json|webmanifest|txt|xml)$/i.test(
      clean
    );
  };

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          const normalized = filePath.replace(/\\/g, '/').toLowerCase();
          if (
            normalized.endsWith('/index.html') ||
            normalized.endsWith('/sw.js') ||
            normalized.endsWith('/manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          } else if (normalized.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (req: Request, res: Response) => {
      if (isStaticAssetRequestPath(req.path)) {
        res.status(404).end();
        return;
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(distIndexPath);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    void syncRtdbUsersDirectory(false);
  });
}

createAppServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
