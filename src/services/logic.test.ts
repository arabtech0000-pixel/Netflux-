import test from 'node:test';
import assert from 'node:assert/strict';
import {
  searchMovies,
  filterMoviesByGenre,
  filterMoviesByType,
  toggleMyList,
  recordWatchProgress,
  calculateProgressPercent,
  formatTime,
  advanceDownload,
  validateEmailOrPhone,
  validateRegistrationForm,
  mergeTmdbMovieDetails,
  toFirebaseAuthEmail,
  mapFirebaseAuthError,
  sanitizeUserDataForRtdb,
  generateJigsawGridSpecs,
  buildJigsawPiecePath,
  resolvePostSplashScreen,
  shouldFallbackToGoogleRedirect,
  canOfferGoogleTabOrRedirectFallback,
  ADMIN_WHATSAPP_NUMBER,
  WHATSAPP_GROUP_URL,
  DEFAULT_DISCLAIMER_CONFIG,
  resolveWhatsappGroupUrl,
  buildAdminWhatsAppUrl,
  computeBufferedPercent,
  clampVolume,
  getNextPlaybackSpeed,
  shouldRotateForLandscape,
  sanitizeMunoStreamUrl,
  normalizeVjName,
  extractMunoTitleClue,
  pickBestTmdbMatch,
  extractEpisodeNumber,
  attachMunoStreamsToEpisodes,
  buildDualVerifiedItemId,
  computeCappedByteRange,
  parseDurationToSeconds,
  detectPwaPlatform,
  resolvePwaInstallAction,
  buildDownloadFileName,
  parseContentRangeTotalBytes,
  computeDownloadProgress,
  formatBytesLabel,
  normalizeStoredDownloads,
  ADMIN_EMAIL,
  normalizeEmail,
  isAdminEmail,
  canDisplayAdminButton,
  validateAdminConfirmationInput,
  computeAdminCatalogSummary,
  filterAdminCatalog,
  formatNotificationTimeAgo,
  mergeIncomingNotifications,
  normalizeAccountScopeKey,
  buildScopedStorageKey,
  buildScopedDownloadBlobKey,
  createFreshAccountSeedData,
  isSyntheticTestUser,
  aggregateUserDirectoryStats,
  isStaticAssetRequestPath,
  computeSubscriptionProfitSummary,
  filterAdminUsersByEmail,
  canBlockAdminUser,
  shouldPreferDirectHttpsStream,
  getInitialStreamMode,
  resolveEffectiveVideoSrc,
  isMatchingSeriesTitle,
  mergeMunoEpisodesPool,
} from './logic';
import { Movie, Episode, DownloadItem, WatchProgress, NotificationItem, Profile, AppSettings } from '../types';

const SAMPLE_MOVIES: Movie[] = [
  {
    id: 'm1',
    title: 'Stranger Things',
    type: 'series',
    year: 2016,
    ageRating: '16+',
    quality: '4K Ultra HD',
    durationOrSeasons: '4 Seasons',
    genres: ['Sci-Fi', 'Horror'],
    synopsis: 'Supernatural mystery in Hawkins.',
    matchScore: 98,
    posterUrl: '/poster1.jpg',
    backdropUrl: '/backdrop1.jpg',
    cast: ['Millie Bobby Brown', 'Winona Ryder'],
    director: 'The Duffer Brothers',
    tags: ['Ominous'],
  },
  {
    id: 'm2',
    title: 'Extraction',
    type: 'movie',
    year: 2020,
    ageRating: '18+',
    quality: '4K Ultra HD',
    durationOrSeasons: '1h 56m',
    genres: ['Action', 'Thriller'],
    synopsis: 'Hardened mercenary mission.',
    matchScore: 93,
    posterUrl: '/poster2.jpg',
    backdropUrl: '/backdrop2.jpg',
    cast: ['Chris Hemsworth'],
  },
];

test('searchMovies matches by title, genre, cast, and tags', () => {
  const resultTitle = searchMovies(SAMPLE_MOVIES, 'stranger');
  assert.equal(resultTitle.length, 1);
  assert.equal(resultTitle[0].id, 'm1');

  const resultGenre = searchMovies(SAMPLE_MOVIES, 'action');
  assert.equal(resultGenre.length, 1);
  assert.equal(resultGenre[0].id, 'm2');

  const resultCast = searchMovies(SAMPLE_MOVIES, 'hemsworth');
  assert.equal(resultCast.length, 1);
  assert.equal(resultCast[0].id, 'm2');

  const resultEmpty = searchMovies(SAMPLE_MOVIES, '');
  assert.equal(resultEmpty.length, 0);
});

test('filterMoviesByGenre filters accurately', () => {
  const sciFi = filterMoviesByGenre(SAMPLE_MOVIES, 'Sci-Fi');
  assert.equal(sciFi.length, 1);
  assert.equal(sciFi[0].id, 'm1');

  const all = filterMoviesByGenre(SAMPLE_MOVIES, 'all');
  assert.equal(all.length, 2);
});

test('filterMoviesByType separates movies and series', () => {
  const movies = filterMoviesByType(SAMPLE_MOVIES, 'movie');
  assert.equal(movies.length, 1);
  assert.equal(movies[0].id, 'm2');

  const series = filterMoviesByType(SAMPLE_MOVIES, 'series');
  assert.equal(series.length, 1);
  assert.equal(series[0].id, 'm1');
});

test('toggleMyList adds or removes items safely', () => {
  const initial = ['m1'];
  const added = toggleMyList(initial, 'm2');
  assert.deepEqual(added, ['m1', 'm2']);

  const removed = toggleMyList(added, 'm1');
  assert.deepEqual(removed, ['m2']);
});

test('calculateProgressPercent clamps between 0 and 100', () => {
  assert.equal(calculateProgressPercent(30, 60), 50);
  assert.equal(calculateProgressPercent(0, 100), 0);
  assert.equal(calculateProgressPercent(120, 100), 100);
  assert.equal(calculateProgressPercent(50, 0), 0);
});

test('formatTime formats seconds into MM:SS and HH:MM:SS', () => {
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(1457), '24:17');
  assert.equal(formatTime(3665), '1:01:05');
});

test('recordWatchProgress updates existing movie or appends new', () => {
  const current: WatchProgress[] = [
    {
      movieId: 'm1',
      title: 'Stranger Things',
      currentTime: 100,
      duration: 2000,
      posterUrl: '/p1.jpg',
      lastWatchedAt: 1000,
    },
  ];

  const updated = recordWatchProgress(current, {
    movieId: 'm1',
    title: 'Stranger Things',
    currentTime: 500,
    duration: 2000,
    posterUrl: '/p1.jpg',
    lastWatchedAt: 2000,
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].currentTime, 500);

  const withNew = recordWatchProgress(updated, {
    movieId: 'm2',
    title: 'Extraction',
    currentTime: 300,
    duration: 1800,
    posterUrl: '/p2.jpg',
    lastWatchedAt: 3000,
  });

  assert.equal(withNew.length, 2);
  assert.equal(withNew[0].movieId, 'm2');
});

test('advanceDownload advances progress and completes at 100%', () => {
  const item: DownloadItem = {
    id: 'd1',
    movieId: 'm1',
    title: 'Stranger Things',
    posterUrl: '/p1.jpg',
    fileSizeMb: 350,
    status: 'downloading',
    progress: 50,
    downloadedAt: Date.now(),
  };

  const nextStep = advanceDownload(item, 30);
  assert.equal(nextStep.progress, 80);
  assert.equal(nextStep.status, 'downloading');

  const completed = advanceDownload(nextStep, 30);
  assert.equal(completed.progress, 100);
  assert.equal(completed.status, 'completed');
});

test('validateEmailOrPhone accepts valid emails and mobile numbers and rejects invalid input', () => {
  assert.equal(validateEmailOrPhone('ashraf@example.com'), true);
  assert.equal(validateEmailOrPhone('+256 772 123456'), true);
  assert.equal(validateEmailOrPhone('0772123456'), true);
  assert.equal(validateEmailOrPhone(''), false);
  assert.equal(validateEmailOrPhone('not-an-email'), false);
  assert.equal(validateEmailOrPhone('12345'), false);
  assert.equal(validateEmailOrPhone('user@domain'), false);
});

test('validateRegistrationForm enforces email/phone, password length, and matching confirm password', () => {
  assert.equal(
    validateRegistrationForm({
      identifier: '+256772123456',
      password: 'secret',
      confirmPassword: 'secret',
    }),
    null
  );
  assert.equal(
    validateRegistrationForm({
      identifier: 'ashraf@example.com',
      password: 'secret',
      confirmPassword: 'secret',
    }),
    null
  );
  assert.match(
    validateRegistrationForm({
      identifier: 'bad',
      password: 'secret',
      confirmPassword: 'secret',
    }) || '',
    /email address or mobile number/i
  );
  assert.match(
    validateRegistrationForm({
      identifier: 'ashraf@example.com',
      password: '123',
      confirmPassword: '123',
    }) || '',
    /at least 6 characters/i
  );
  assert.match(
    validateRegistrationForm({
      identifier: 'ashraf@example.com',
      password: 'secret',
      confirmPassword: 'different',
    }) || '',
    /do not match/i
  );
});

test('mergeTmdbMovieDetails enriches movie with TMDB metadata while preserving local id and badges', () => {
  const merged = mergeTmdbMovieDetails(
    {
      ...SAMPLE_MOVIES[0],
      isOriginal: true,
      top10Rank: 1,
    },
    {
      id: 'tmdb-series-66732',
      tmdbId: 66732,
      backdropUrl: 'https://image.tmdb.org/t/p/original/hero.jpg',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      trailerKey: 'b9EkMc79ZSU',
      cast: ['Millie Bobby Brown', 'Finn Wolfhard', 'David Harbour'],
      seasonsCount: 4,
    }
  );

  assert.equal(merged.id, 'm1');
  assert.equal(merged.tmdbId, 66732);
  assert.equal(merged.isOriginal, true);
  assert.equal(merged.top10Rank, 1);
  assert.equal(merged.backdropUrl, 'https://image.tmdb.org/t/p/original/hero.jpg');
  assert.equal(merged.trailerKey, 'b9EkMc79ZSU');
  assert.equal(merged.cast.length, 3);
});

test('toFirebaseAuthEmail normalizes emails and converts phone numbers cleanly', () => {
  assert.equal(toFirebaseAuthEmail('  Ashraf@Example.com '), 'ashraf@example.com');
  assert.equal(toFirebaseAuthEmail('+256 772 123456'), '256772123456@phone.munomoviess.app');
  assert.equal(toFirebaseAuthEmail('0772123456'), '0772123456@phone.munomoviess.app');
});

test('mapFirebaseAuthError returns readable messages for known Firebase Auth codes', () => {
  assert.match(mapFirebaseAuthError('auth/email-already-in-use'), /already exists/i);
  assert.match(mapFirebaseAuthError('auth/invalid-credential'), /incorrect/i);
  assert.match(mapFirebaseAuthError('auth/weak-password'), /at least 6/i);
  assert.match(
    mapFirebaseAuthError('auth/unauthorized-domain', undefined, 'example.run.app'),
    /example\.run\.app/
  );
  assert.equal(mapFirebaseAuthError('unknown', 'Custom fallback'), 'Custom fallback');
});

test('sanitizeUserDataForRtdb strips undefined fields recursively for Realtime Database compatibility', () => {
  const dirty = {
    title: 'Stranger Things',
    episodeInfo: undefined,
    nested: {
      a: 1,
      b: undefined,
    },
    items: [{ id: '1', note: undefined }],
  };
  const clean = sanitizeUserDataForRtdb(dirty);
  assert.equal('episodeInfo' in clean, false);
  assert.equal('b' in clean.nested, false);
  assert.equal('note' in clean.items[0], false);
  assert.equal(clean.title, 'Stranger Things');
});

test('generateJigsawGridSpecs creates interlocking edge polarities across grid', () => {
  const rows = 4;
  const cols = 4;
  const specs = generateJigsawGridSpecs(rows, cols);
  assert.equal(specs.length, rows * cols);

  const byCoord = (r: number, c: number) => specs[r * cols + c];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = byCoord(r, c);
      if (r === 0) assert.equal(piece.top, 0);
      if (r === rows - 1) assert.equal(piece.bottom, 0);
      if (c === 0) assert.equal(piece.left, 0);
      if (c === cols - 1) assert.equal(piece.right, 0);

      if (c < cols - 1) {
        const rightNeighbor = byCoord(r, c + 1);
        assert.equal(piece.right, -rightNeighbor.left);
        assert.notEqual(piece.right, 0);
      }
      if (r < rows - 1) {
        const bottomNeighbor = byCoord(r + 1, c);
        assert.equal(piece.bottom, -bottomNeighbor.top);
        assert.notEqual(piece.bottom, 0);
      }
    }
  }
});

test('buildJigsawPiecePath builds a valid closed SVG path with curves for tabs and blanks', () => {
  const path = buildJigsawPiecePath(140, 100, { top: 0, right: 1, bottom: -1, left: 0 }, 18);
  assert.equal(path.startsWith('M 0 0'), true);
  assert.equal(path.endsWith('Z'), true);
  assert.equal(path.includes('C '), true);
});

test('resolvePostSplashScreen routes new users to welcome and returning device users directly into app', () => {
  assert.equal(
    resolvePostSplashScreen({ hasAuthUser: false, storedSession: null }),
    'welcome'
  );
  assert.equal(
    resolvePostSplashScreen({
      hasAuthUser: false,
      storedSession: { identifier: 'user@example.com', onboardingComplete: false, signedInAt: 1000 },
    }),
    'profile-select'
  );
  assert.equal(
    resolvePostSplashScreen({
      hasAuthUser: false,
      storedSession: { identifier: 'user@example.com', onboardingComplete: true, signedInAt: 1000 },
    }),
    'home'
  );
  assert.equal(
    resolvePostSplashScreen({ hasAuthUser: true, storedSession: null }),
    'home'
  );
});

test('Google auth error mappings and redirect/tab fallback decisions cover popup, COOP, and iframe cases', () => {
  assert.match(mapFirebaseAuthError('auth/cancelled-popup-request'), /cancelled/i);
  assert.match(mapFirebaseAuthError('auth/web-storage-unsupported'), /storage/i);
  assert.match(mapFirebaseAuthError('auth/account-exists-with-different-credential'), /password/i);

  assert.equal(
    shouldFallbackToGoogleRedirect({ errorCode: 'auth/popup-blocked', isInIframe: false }),
    true
  );
  assert.equal(
    shouldFallbackToGoogleRedirect({ errorCode: 'auth/web-storage-unsupported', isInIframe: false }),
    true
  );
  assert.equal(
    shouldFallbackToGoogleRedirect({ errorCode: 'auth/popup-blocked', isInIframe: true }),
    false
  );
  assert.equal(
    shouldFallbackToGoogleRedirect({ errorCode: 'auth/unauthorized-domain', isInIframe: false }),
    false
  );

  assert.equal(canOfferGoogleTabOrRedirectFallback('auth/popup-closed-by-user'), true);
  assert.equal(canOfferGoogleTabOrRedirectFallback('auth/internal-error'), true);
  assert.equal(canOfferGoogleTabOrRedirectFallback('auth/unauthorized-domain'), false);
});

test('buildAdminWhatsAppUrl formats direct admin WhatsApp link without modal popups', () => {
  const defaultUrl = buildAdminWhatsAppUrl();
  assert.equal(defaultUrl.startsWith(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=`), true);
  assert.equal(decodeURIComponent(defaultUrl.split('?text=')[1]), 'Hello Netflux Admin, I need help.');

  const customUrl = buildAdminWhatsAppUrl('Account sign in issue');
  assert.equal(customUrl, `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=Account%20sign%20in%20issue`);

  const saleUrl = buildAdminWhatsAppUrl("Hello Admin, I'm interested in your project that is for sale.");
  assert.equal(saleUrl.startsWith(`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=`), true);
  assert.match(decodeURIComponent(saleUrl.split('?text=')[1]), /interested in your project/i);
});

test('computeBufferedPercent, clampVolume, getNextPlaybackSpeed, and shouldRotateForLandscape work reliably', () => {
  assert.equal(computeBufferedPercent(0, 0), 0);
  assert.equal(computeBufferedPercent(50, 100, 20), 70);
  assert.equal(computeBufferedPercent(90, 100, 30), 100);

  assert.equal(clampVolume(-0.4), 0);
  assert.equal(clampVolume(1.5), 1);
  assert.equal(clampVolume(0.65), 0.65);

  assert.equal(getNextPlaybackSpeed(1), 1.25);
  assert.equal(getNextPlaybackSpeed(1.5), 0.5);
  assert.equal(getNextPlaybackSpeed(2), 1);

  assert.equal(shouldRotateForLandscape(390, 844), true);
  assert.equal(shouldRotateForLandscape(1440, 900), false);
  assert.equal(shouldRotateForLandscape(0, 800), false);
});

test('sanitizeMunoStreamUrl upgrades known CDN http links, encodes spaces, and rejects invalid URLs', () => {
  assert.equal(
    sanitizeMunoStreamUrl('http://munotek.b-cdn.net/2cc3e/0bf/Avengers 1 .Jr.mp4'),
    'https://munotek.b-cdn.net/2cc3e/0bf/Avengers%201%20.Jr.mp4'
  );
  assert.equal(
    sanitizeMunoStreamUrl('https://munotech2.b-cdn.net/subaru/Rise%20of%20The%20Footsoldier.mp4'),
    'https://munotech2.b-cdn.net/subaru/Rise%20of%20The%20Footsoldier.mp4'
  );
  assert.equal(sanitizeMunoStreamUrl('https://cdn.example.com/movie..mp4'), null);
  assert.equal(sanitizeMunoStreamUrl('ftp://invalid.example.com/test.mp4'), null);
  assert.equal(sanitizeMunoStreamUrl(''), null);
});

test('extractMunoTitleClue cleans raw MunoWatch titles, seasons, colons, and extracts normalized VJ', () => {
  const s = extractMunoTitleClue('Terminal List Season 2:', 'Vj Junior');
  assert.equal(s.cleanTitle, 'Terminal List');
  assert.equal(s.vjName, 'VJ Junior');
  assert.equal(s.isSeriesHint, true);
  assert.equal(s.seasonNumber, 2);

  const m = extractMunoTitleClue('AVENGERS DOOMSDAY VJ.EMMY (2025)');
  assert.equal(m.cleanTitle, 'AVENGERS DOOMSDAY');
  assert.equal(m.vjName, 'VJ Emmy');
  assert.equal(m.isSeriesHint, false);

  assert.equal(normalizeVjName(undefined), 'Luganda Dubbed');
});

test('pickBestTmdbMatch enforces strict backdrop_path banner requirement and matches clues accurately', () => {
  const noBannerOnly = [
    { id: 101, title: 'Omuzigo', backdrop_path: null, poster_path: '/poster.jpg', popularity: 50 },
  ];
  assert.equal(pickBestTmdbMatch(noBannerOnly, 'Omuzigo'), null);

  const mixed = [
    { id: 1, title: 'The Avengers', backdrop_path: null, poster_path: '/p1.jpg', popularity: 100 },
    { id: 24428, title: 'The Avengers', backdrop_path: '/avengers-banner.jpg', poster_path: '/p2.jpg', popularity: 90 },
    { id: 99, title: 'Avengers Confidential', backdrop_path: '/conf-banner.jpg', poster_path: '/p3.jpg', popularity: 20 },
  ];
  const matched = pickBestTmdbMatch(mixed, 'Avengers');
  assert.equal(matched?.id, 24428);

  const unrelated = [
    { id: 777, title: 'Completely Different Film', backdrop_path: '/b.jpg', poster_path: '/p.jpg', popularity: 200 },
  ];
  assert.equal(pickBestTmdbMatch(unrelated, 'Terminal List'), null);
});

test('extractEpisodeNumber and attachMunoStreamsToEpisodes correlate episode streams cleanly', () => {
  assert.equal(
    extractEpisodeNumber({ title: 'The Terminal List S02E02 WARRIOR IN A GARDEN' }),
    2
  );
  assert.equal(extractEpisodeNumber({ title: 'Omuzigo - EPISODE 30' }), 30);
  assert.equal(extractEpisodeNumber({ title: 'Theri Part 1' }), 1);

  const tmdbEps: Episode[] = [
    {
      id: 'ep-1',
      seasonNumber: 2,
      episodeNumber: 1,
      title: 'Episode One',
      duration: '50m',
      durationSeconds: 3000,
      synopsis: 'Ep 1',
      thumbnail: 'https://image.tmdb.org/t/p/w500/ep1.jpg',
    },
    {
      id: 'ep-2',
      seasonNumber: 2,
      episodeNumber: 2,
      title: 'Warrior In A Garden',
      duration: '52m',
      durationSeconds: 3120,
      synopsis: 'Ep 2',
      thumbnail: 'https://image.tmdb.org/t/p/w500/ep2.jpg',
    },
  ];

  const mergedEps = attachMunoStreamsToEpisodes(
    tmdbEps,
    [
      {
        title: 'The Terminal List S02E02 WARRIOR IN A GARDEN',
        playingurl: 'http://munotech3.b-cdn.net/mbaata/S02E02.mp4',
        vj: 'Vj Junior',
      },
    ],
    'https://munotech3.b-cdn.net/mbaata/S02E01.mp4',
    'VJ Junior'
  );

  assert.equal(mergedEps[0].videoUrl, 'https://munotech3.b-cdn.net/mbaata/S02E01.mp4');
  assert.equal(mergedEps[1].videoUrl, 'https://munotech3.b-cdn.net/mbaata/S02E02.mp4');
  assert.equal(mergedEps[1].vjName, 'VJ Junior');
});

test('mergeTmdbMovieDetails preserves MunoWatch streamUrl, vjName, munoId, seriesCode, and vjStreams', () => {
  const base: Movie = {
    ...SAMPLE_MOVIES[0],
    videoUrl: 'https://munotech2.b-cdn.net/show.mp4',
    vjName: 'VJ Junior',
    munoId: 67490,
    seriesCode: '97791',
    vjStreams: [
      { id: 'v1', vjName: 'VJ Junior', videoUrl: 'https://munotech2.b-cdn.net/show.mp4' },
      { id: 'v2', vjName: 'VJ Emmy', videoUrl: 'https://munotech2.b-cdn.net/show-emmy.mp4' },
    ],
  };
  const merged = mergeTmdbMovieDetails(base, {
    tmdbId: 66732,
    backdropUrl: 'https://image.tmdb.org/t/p/original/hero.jpg',
    cast: ['Actor One'],
  });
  assert.equal(merged.videoUrl, 'https://munotech2.b-cdn.net/show.mp4');
  assert.equal(merged.vjName, 'VJ Junior');
  assert.equal(merged.munoId, 67490);
  assert.equal(merged.seriesCode, '97791');
  assert.equal(merged.vjStreams?.length, 2);
});

test('buildDualVerifiedItemId generates distinct IDs per VJ sharing the same TMDB banner', () => {
  const idJunior = buildDualVerifiedItemId('movie', 24428, 'Vj Junior');
  const idEmmy = buildDualVerifiedItemId('movie', 24428, 'VJ.EMMY');
  assert.equal(idJunior, 'tmdb-movie-24428-vj-junior');
  assert.equal(idEmmy, 'tmdb-movie-24428-vj-emmy');
  assert.notEqual(idJunior, idEmmy);
});

test('computeCappedByteRange caps open-ended and oversized HTTP ranges for serverless streaming', () => {
  const maxChunk = 4 * 1024 * 1024;
  assert.equal(computeCappedByteRange(undefined, maxChunk), `bytes=0-${maxChunk - 1}`);
  assert.equal(computeCappedByteRange('bytes=0-', maxChunk), `bytes=0-${maxChunk - 1}`);
  assert.equal(
    computeCappedByteRange('bytes=1048576-', maxChunk),
    `bytes=1048576-${1048576 + maxChunk - 1}`
  );
  assert.equal(computeCappedByteRange('bytes=0-1023', maxChunk), 'bytes=0-1023');
  assert.equal(
    computeCappedByteRange('bytes=0-999999999', maxChunk),
    `bytes=0-${maxChunk - 1}`
  );
  assert.equal(computeCappedByteRange('bytes=-5000', maxChunk), 'bytes=-5000');
  assert.equal(computeCappedByteRange('bytes=-99999999', maxChunk), `bytes=-${maxChunk}`);
});

test('parseDurationToSeconds parses movie runtimes accurately and avoids locking to 1h 58m', () => {
  assert.equal(parseDurationToSeconds('2h 10m', 'movie'), 7800);
  assert.equal(parseDurationToSeconds('1h 45m', 'movie'), 6300);
  assert.equal(parseDurationToSeconds('95m', 'movie'), 5700);
  assert.equal(parseDurationToSeconds('2 Seasons', 'series'), 2700);
  assert.equal(parseDurationToSeconds(undefined, 'movie'), 5400);
});

test('searchMovies also finds titles by vjName', () => {
  const withVj: Movie[] = [
    ...SAMPLE_MOVIES,
    { ...SAMPLE_MOVIES[1], id: 'm3', title: 'Hidden Strike', vjName: 'VJ Jingo' },
  ];
  const res = searchMovies(withVj, 'jingo');
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'm3');
});

test('detectPwaPlatform detects standalone mode, iOS devices, and embedded iframes accurately', () => {
  const iosSafari = detectPwaPlatform(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
    false,
    false,
    false
  );
  assert.equal(iosSafari.isIOS, true);
  assert.equal(iosSafari.isStandalone, false);
  assert.equal(iosSafari.isEmbeddedIframe, false);

  const iosInstalled = detectPwaPlatform('iPhone', false, true, false);
  assert.equal(iosInstalled.isStandalone, true);

  const androidStandalone = detectPwaPlatform('Mozilla/5.0 (Linux; Android 14)', true, false, false);
  assert.equal(androidStandalone.isIOS, false);
  assert.equal(androidStandalone.isStandalone, true);
});

test('resolvePwaInstallAction selects correct install UX path', () => {
  assert.equal(resolvePwaInstallAction(true, true, false), 'installed');
  assert.equal(resolvePwaInstallAction(false, true, false), 'native-prompt');
  assert.equal(resolvePwaInstallAction(false, false, true), 'ios-guide');
  assert.equal(resolvePwaInstallAction(false, false, false), 'browser-guide');
});

test('buildDownloadFileName, parseContentRangeTotalBytes, computeDownloadProgress, and formatBytesLabel work accurately', () => {
  assert.equal(buildDownloadFileName('Avengers: Doomsday?'), 'Avengers Doomsday.mp4');
  assert.equal(
    buildDownloadFileName('Terminal List', { seasonNumber: 2, episodeNumber: 4 }),
    'Terminal List - S02E04.mp4'
  );

  assert.equal(parseContentRangeTotalBytes('bytes 0-0/456789123', '1', 206), 456789123);
  assert.equal(parseContentRangeTotalBytes(null, '1', 206), null);
  assert.equal(parseContentRangeTotalBytes(null, '104857600', 200), 104857600);
  assert.equal(parseContentRangeTotalBytes(null, '104857600'), 104857600);
  assert.equal(parseContentRangeTotalBytes('bytes */*', null), null);

  assert.equal(computeDownloadProgress(50, 200), 25);
  assert.equal(computeDownloadProgress(300, 200), 100);
  assert.equal(computeDownloadProgress(10, 0), 0);

  assert.equal(formatBytesLabel(420 * 1024 * 1024), '420 MB');
  assert.equal(formatBytesLabel(1.5 * 1024 * 1024 * 1024), '1.50 GB');
  assert.equal(formatBytesLabel(512 * 1024), '512 KB');
});

test('normalizeStoredDownloads converts interrupted pending or downloading items to paused on reload', () => {
  const stored: DownloadItem[] = [
    { ...SAMPLE_MOVIES[0], id: 'd1', movieId: 'm1', posterUrl: '', fileSizeMb: 500, status: 'pending', progress: 0, downloadedAt: 1 },
    { ...SAMPLE_MOVIES[0], id: 'd2', movieId: 'm2', posterUrl: '', fileSizeMb: 500, status: 'downloading', progress: 42, downloadedAt: 2 },
    { ...SAMPLE_MOVIES[0], id: 'd3', movieId: 'm3', posterUrl: '', fileSizeMb: 500, status: 'completed', progress: 100, downloadedAt: 3 },
  ];
  const normalized = normalizeStoredDownloads(stored);
  assert.equal(normalized[0].status, 'paused');
  assert.equal(normalized[1].status, 'paused');
  assert.equal(normalized[2].status, 'completed');
});

test('isAdminEmail and canDisplayAdminButton strictly allow only ashirafashes04@gmail.com', () => {
  assert.equal(ADMIN_EMAIL, 'ashirafashes04@gmail.com');
  assert.equal(normalizeEmail('  AshirafAshes04@GMAIL.com  '), 'ashirafashes04@gmail.com');
  assert.equal(isAdminEmail('ashirafashes04@gmail.com'), true);
  assert.equal(isAdminEmail('  ASHIRAFASHES04@GMAIL.COM '), true);
  assert.equal(isAdminEmail('ashirafashes04+fake@gmail.com'), false);
  assert.equal(isAdminEmail('other@gmail.com'), false);
  assert.equal(isAdminEmail(''), false);

  // Firebase Auth email takes strict precedence over session storage
  assert.equal(
    canDisplayAdminButton({
      authEmail: 'ashirafashes04@gmail.com',
      sessionIdentifier: 'other@gmail.com',
    }),
    true
  );
  assert.equal(
    canDisplayAdminButton({
      authEmail: 'other@gmail.com',
      sessionIdentifier: 'ashirafashes04@gmail.com',
    }),
    false
  );
  assert.equal(
    canDisplayAdminButton({
      authEmail: null,
      sessionIdentifier: 'ashirafashes04@gmail.com',
    }),
    true
  );
  assert.equal(
    canDisplayAdminButton({
      authEmail: null,
      sessionIdentifier: '+256755048870',
    }),
    false
  );
  assert.equal(canDisplayAdminButton({ authEmail: null, sessionIdentifier: null }), false);
});

test('validateAdminConfirmationInput rejects non-admin emails and empty passwords', () => {
  assert.equal(
    validateAdminConfirmationInput({
      email: 'ashirafashes04@gmail.com',
      password: 'sample-password',
    }),
    null
  );
  assert.match(
    validateAdminConfirmationInput({
      email: 'user@example.com',
      password: 'sample-password',
    }) || '',
    /restricted/i
  );
  assert.match(
    validateAdminConfirmationInput({
      email: 'ashirafashes04@gmail.com',
      password: '',
    }) || '',
    /password/i
  );
});

test('computeAdminCatalogSummary and filterAdminCatalog summarize and filter catalog rows cleanly', () => {
  const catalogSample: Movie[] = [
    { ...SAMPLE_MOVIES[0], vjName: 'Vj Junior' },
    { ...SAMPLE_MOVIES[1], vjName: 'VJ Emmy' },
    { ...SAMPLE_MOVIES[1], id: 'm3', title: 'Omuzigo', vjName: 'VJ Junior' },
  ];

  const summary = computeAdminCatalogSummary(catalogSample);
  assert.equal(summary.totalTitles, 3);
  assert.equal(summary.moviesCount, 2);
  assert.equal(summary.seriesCount, 1);
  assert.equal(summary.uniqueVjsCount, 2);
  assert.deepEqual(summary.vjBreakdown[0], { vjName: 'VJ Junior', count: 2 });

  assert.equal(filterAdminCatalog(catalogSample, { type: 'movie' }).length, 2);
  assert.equal(filterAdminCatalog(catalogSample, { vjName: 'VJ Emmy' }).length, 1);
  assert.equal(filterAdminCatalog(catalogSample, { query: 'stranger' }).length, 1);
  assert.equal(filterAdminCatalog(catalogSample, { query: 'nonexistent' }).length, 0);
});

test('formatNotificationTimeAgo and mergeIncomingNotifications keep new movie upload alerts active without duplicating dismissed items', () => {
  const baseNow = 1_700_000_000_000;
  assert.equal(formatNotificationTimeAgo(baseNow - 20_000, 'fallback', baseNow), 'Just now');
  assert.equal(formatNotificationTimeAgo(baseNow - 5 * 60_000, 'fallback', baseNow), '5m ago');
  assert.equal(formatNotificationTimeAgo(baseNow - 3 * 3600_000, 'fallback', baseNow), '3h ago');
  assert.equal(formatNotificationTimeAgo(baseNow - 2 * 86400_000, 'fallback', baseNow), '2d ago');

  const existing: NotificationItem[] = [
    {
      id: 'old-1',
      title: 'Old Movie',
      message: 'Already read',
      movieId: 'm1',
      timeAgo: '2d ago',
      createdAt: baseNow - 200_000,
      read: true,
      thumbnailUrl: '/p1.jpg',
      type: 'new-arrival',
    },
  ];
  const incoming: NotificationItem[] = [
    {
      id: 'old-1',
      title: 'Old Movie',
      message: 'Duplicate unread incoming',
      movieId: 'm1',
      timeAgo: '2d ago',
      createdAt: baseNow - 200_000,
      read: false,
      thumbnailUrl: '/p1.jpg',
      type: 'new-arrival',
    },
    {
      id: 'dismissed-1',
      title: 'Cleared Movie',
      message: 'User dismissed this earlier',
      movieId: 'm2',
      timeAgo: '1d ago',
      createdAt: baseNow - 100_000,
      read: false,
      thumbnailUrl: '/p2.jpg',
      type: 'new-arrival',
    },
    {
      id: 'upload-new-99',
      title: 'New Upload: Extraction 3',
      message: 'Extraction 3 (VJ Junior) is now streaming.',
      movieId: 'admin-movie-99',
      timeAgo: 'Just now',
      createdAt: baseNow,
      read: false,
      thumbnailUrl: '/p3.jpg',
      type: 'new-arrival',
    },
  ];

  const { merged, newlyAdded } = mergeIncomingNotifications({
    current: existing,
    incoming,
    dismissedIds: ['dismissed-1'],
  });

  assert.equal(newlyAdded.length, 1);
  assert.equal(newlyAdded[0].id, 'upload-new-99');
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'upload-new-99');
  assert.equal(merged[1].read, true); // Existing read status preserved
});

test('normalizeAccountScopeKey and buildScopedStorageKey isolate distinct accounts even when both select Ashraf (p1)', () => {
  const userA = normalizeAccountScopeKey({ uid: 'uid-user-a', identifier: 'alice@example.com' });
  const userB = normalizeAccountScopeKey({ uid: 'uid-user-b', identifier: 'bob@example.com' });
  assert.notEqual(userA, userB);

  // Two different users both picking profile 'p1' (Ashraf) must get disjoint storage keys
  assert.notEqual(
    buildScopedStorageKey('netflix_my_list', userA, 'p1'),
    buildScopedStorageKey('netflix_my_list', userB, 'p1')
  );
  assert.notEqual(
    buildScopedStorageKey('netflix_downloads', userA, 'p1'),
    buildScopedStorageKey('netflix_downloads', userB, 'p1')
  );
  assert.notEqual(
    buildScopedDownloadBlobKey(userA, 'p1', 'dl-movie-1'),
    buildScopedDownloadBlobKey(userB, 'p1', 'dl-movie-1')
  );

  // Different profiles inside the SAME account must also get disjoint keys
  assert.notEqual(
    buildScopedStorageKey('netflix_my_list', userA, 'p1'),
    buildScopedStorageKey('netflix_my_list', userA, 'p3')
  );
  assert.notEqual(
    buildScopedStorageKey('netflix_downloads', userA, 'p1'),
    buildScopedStorageKey('netflix_downloads', userA, 'p3')
  );
  assert.notEqual(
    buildScopedDownloadBlobKey(userA, 'p1', 'dl-movie-1'),
    buildScopedDownloadBlobKey(userA, 'p3', 'dl-movie-1')
  );

  // Phone vs equivalent canonical normalization without uid stays consistent
  assert.equal(
    normalizeAccountScopeKey({ identifier: '+256 772 123456' }),
    normalizeAccountScopeKey({ identifier: '+256772123456' })
  );
});

test('createFreshAccountSeedData guarantees empty personal lists and downloads for every new account', () => {
  const sampleProfiles: Profile[] = [
    { id: 'p1', name: 'Ashraf', avatarColor: '#1E88E5', avatarBg: 'bg-blue-600', avatarIcon: 'smile', isKids: false },
    { id: 'p3', name: 'David', avatarColor: '#FB8C00', avatarBg: 'bg-amber-500', avatarIcon: 'smile', isKids: false },
  ];
  const sampleSettings: AppSettings = {
    playbackQuality: 'Auto',
    autoPlayNextEpisode: true,
    autoPlayPreviews: true,
    dataSaver: 'Automatic',
    downloadsWifiOnly: true,
    smartDownloads: true,
    downloadQuality: 'High',
    subtitleSize: 'Medium',
    subtitleColor: 'White',
    subtitleBg: 'Semi-Transparent',
    notificationsPush: true,
    notificationsEmail: false,
    appLanguage: 'English',
  };

  const fresh = createFreshAccountSeedData(sampleProfiles, sampleSettings);
  assert.deepEqual(fresh.watchlist, []);
  assert.deepEqual(fresh.downloads, []);
  assert.deepEqual(fresh.continueWatching, []);
  assert.deepEqual(fresh.recentSearches, []);
  assert.deepEqual(fresh.reminders, []);
  assert.deepEqual(fresh.paymentMethods, []);
  assert.equal(fresh.activeProfileId, 'p1');
  assert.equal(fresh.profiles.length, 2);
  // Cloned instances shouldn't mutate the input template
  fresh.profiles[0].name = 'Custom';
  assert.equal(sampleProfiles[0].name, 'Ashraf');
});

test('DEFAULT_DISCLAIMER_CONFIG and resolveWhatsappGroupUrl provide WhatsApp group invite with Instant Updates and safe URL validation', () => {
  assert.equal(DEFAULT_DISCLAIMER_CONFIG.disclaimerTitle, 'Join Our WhatsApp Group');
  assert.equal(DEFAULT_DISCLAIMER_CONFIG.disclaimerBadge, 'Instant Updates');
  assert.equal(DEFAULT_DISCLAIMER_CONFIG.whatsappButtonLabel, 'Join our platform');
  assert.equal(/for sale/i.test(DEFAULT_DISCLAIMER_CONFIG.disclaimerMessage), false);
  assert.equal(/instant update/i.test(DEFAULT_DISCLAIMER_CONFIG.disclaimerMessage), true);

  assert.equal(resolveWhatsappGroupUrl(undefined), WHATSAPP_GROUP_URL);
  assert.equal(resolveWhatsappGroupUrl(''), WHATSAPP_GROUP_URL);
  assert.equal(resolveWhatsappGroupUrl('javascript:alert(1)'), WHATSAPP_GROUP_URL);
  assert.equal(resolveWhatsappGroupUrl('data:text/html,hi'), WHATSAPP_GROUP_URL);
  assert.equal(
    resolveWhatsappGroupUrl('https://chat.whatsapp.com/CustomGroup123'),
    'https://chat.whatsapp.com/CustomGroup123'
  );
});

test('aggregateUserDirectoryStats merges Firebase RTDB users and local sync records while deduplicating and excluding synthetic test entries', () => {
  const now = 1_800_000_000_000;
  const recent = now - 2 * 60 * 60 * 1000;
  const old = now - 5 * 24 * 60 * 60 * 1000;

  assert.equal(isSyntheticTestUser('browser_check_example_test', null), true);
  assert.equal(isSyntheticTestUser('uid123', 'member_1795261511995@gmail.com'), true);
  assert.equal(isSyntheticTestUser('uid456', 'realuser@gmail.com'), false);

  const summary = aggregateUserDirectoryStats({
    nowMs: now,
    rtdbUsers: {
      uidUserOne123456789012345: {
        account: {
          uid: 'uidUserOne123456789012345',
          email: 'real1@gmail.com',
          displayName: 'Real One',
          createdAt: old,
          lastLoginAt: recent,
        },
      },
      uidUserTwo123456789012345: {
        account: {
          uid: 'uidUserTwo123456789012345',
          email: 'real2@gmail.com',
          displayName: 'Real Two',
          createdAt: old,
          lastLoginAt: old,
        },
      },
      // Legacy sanitized email node matching existing email should deduplicate
      real1_gmail_com: {
        profiles: [{ id: 'p1', name: 'Ashraf' }],
      },
      // Legacy non-duplicate email node should still be counted
      legacyuser_gmail_com: {
        profiles: [{ id: 'p1', name: 'David' }],
      },
      // Synthetic test keys should be ignored
      browser_check_example_test: { watchlist: [] },
      admin_ashiraf: { watchlist: [] },
    },
    localRecords: [
      {
        key: 'email:member_1795261511995@gmail.com',
        uid: 'nLjwskugbUQHU29bG1nzBPNGgAz1',
        email: 'member_1795261511995@gmail.com',
        displayName: 'Test Member',
        createdAt: recent,
        lastSeenAt: recent,
      },
      {
        key: 'email:real1@gmail.com',
        uid: 'uidUserOne123456789012345',
        email: 'real1@gmail.com',
        displayName: 'Real One',
        createdAt: old,
        lastSeenAt: now - 1000,
      },
      {
        key: 'email:ashirafashes04@gmail.com',
        uid: 'admin:ashirafashes04@gmail.com',
        email: 'ashirafashes04@gmail.com',
        displayName: 'Ashraf (Admin)',
        createdAt: old,
        lastSeenAt: recent,
      },
    ],
  });

  // Expected unique real users: real1@gmail.com, real2@gmail.com, legacyuser@gmail.com, ashirafashes04@gmail.com
  assert.equal(summary.totalUsers, 4);
  // Active in last 24h: real1@gmail.com and ashirafashes04@gmail.com
  assert.equal(summary.activeUsersToday, 2);
});

test('isStaticAssetRequestPath prevents missing JS/CSS/SW chunks from falling back to index.html', () => {
  assert.equal(isStaticAssetRequestPath('/assets/index-oldhash.js'), true);
  assert.equal(isStaticAssetRequestPath('/workbox-abc123.js'), true);
  assert.equal(isStaticAssetRequestPath('/dev-sw.js?dev-sw'), true);
  assert.equal(isStaticAssetRequestPath('/manifest.webmanifest'), true);
  assert.equal(isStaticAssetRequestPath('/'), false);
  assert.equal(isStaticAssetRequestPath('/admin'), false);
  assert.equal(isStaticAssetRequestPath('/tv-shows'), false);
});

test('computeSubscriptionProfitSummary, filterAdminUsersByEmail, and canBlockAdminUser work cleanly', () => {
  const summary = computeSubscriptionProfitSummary({
    users: [
      { isPremium: true, isBlocked: false },
      { isPremium: true, isBlocked: false },
      { isPremium: false, isBlocked: false },
      { isPremium: true, isBlocked: true },
    ],
  });
  assert.equal(summary.paymentsEnabled, false);
  assert.equal(summary.premiumUsersCount, 2);
  assert.equal(summary.freeUsersCount, 1);
  assert.equal(summary.weeklyProfitUgx, 8000);
  assert.equal(summary.projectedMonthlyUgx, 16000);
  assert.equal(summary.weeklyBreakdown.length, 7);

  const users = [
    { email: 'alice@gmail.com', isPremium: true, isBlocked: false },
    { email: 'bob@gmail.com', isPremium: false, isBlocked: true },
    { email: 'ashirafashes04@gmail.com', isPremium: true, isBlocked: false },
  ];
  assert.equal(filterAdminUsersByEmail(users, 'alice', 'all').length, 1);
  assert.equal(filterAdminUsersByEmail(users, '', 'premium').length, 2);
  assert.equal(filterAdminUsersByEmail(users, '', 'blocked')[0].email, 'bob@gmail.com');
  assert.equal(canBlockAdminUser('ashirafashes04@gmail.com'), false);
  assert.equal(canBlockAdminUser('bob@gmail.com'), true);
});

test('stream mode helpers and mergeMunoEpisodesPool support instant episode switching safely', () => {
  const directSafeUrl = 'https://pub-123.r2.dev/movies/S02E02.mp4';
  const hotlinkCdnUrl = 'https://munotech3.b-cdn.net/mbaata/S02E02.mp4';
  const proxyOnlyUrl = 'http://cdn.example.com/ep1.mp4';

  assert.equal(shouldPreferDirectHttpsStream(directSafeUrl), true);
  assert.equal(shouldPreferDirectHttpsStream(hotlinkCdnUrl), false);
  assert.equal(shouldPreferDirectHttpsStream(proxyOnlyUrl), false);
  assert.equal(getInitialStreamMode(directSafeUrl), 'direct');
  assert.equal(getInitialStreamMode(hotlinkCdnUrl), 'proxy');
  assert.equal(getInitialStreamMode(proxyOnlyUrl), 'proxy');
  assert.equal(resolveEffectiveVideoSrc(directSafeUrl, 'direct'), directSafeUrl);
  assert.equal(
    resolveEffectiveVideoSrc(hotlinkCdnUrl, 'proxy'),
    `/api/stream?url=${encodeURIComponent(hotlinkCdnUrl)}`
  );
  assert.equal(resolveEffectiveVideoSrc('blob:http://localhost/123', 'proxy'), 'blob:http://localhost/123');

  assert.equal(isMatchingSeriesTitle('My Strange Hero', 'Nemesis 6'), false);
  assert.equal(isMatchingSeriesTitle('Terminal List Season 2:', 'The Terminal List'), true);

  const merged = mergeMunoEpisodesPool(
    [{ title: 'Show Ep 2', streamUrl: 'https://harvetz.b-cdn.net/ep2.mp4' }],
    [
      { title: 'Show Ep 1', streamUrl: 'https://harvetz.b-cdn.net/ep1.mp4' },
      { title: 'Show Ep 2 duplicate', streamUrl: 'https://harvetz.b-cdn.net/ep2.mp4' },
    ]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].episodeNumber, 1);
  assert.equal(merged[1].episodeNumber, 2);
});




