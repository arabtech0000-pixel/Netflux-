import {
  computeDownloadProgress,
  parseContentRangeTotalBytes,
  sanitizeMunoStreamUrl,
} from './logic';
import type { DownloadItem } from '../types';

const DB_NAME = 'netflux_offline_files';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const PROXY_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MiB per chunk (under Cloud Run 32 MiB cap)

interface PartialDownloadState {
  chunks: Uint8Array[];
  bytesDownloaded: number;
  totalBytes?: number;
}

const activeControllers = new Map<string, AbortController>();
const partialDownloads = new Map<string, PartialDownloadState>();
const activeObjectUrls = new Map<string, string>();

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open offline storage'));
  });
}

export async function saveDownloadedBlob(downloadId: string, blob: Blob): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, downloadId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to save offline video'));
    });
  } catch {
    // Non-fatal if browser quota/IndexedDB is restricted
  }
}

export async function getDownloadedBlob(downloadId: string): Promise<Blob | null> {
  try {
    const db = await openOfflineDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(downloadId);
      req.onsuccess = () => resolve((req.result as Blob | undefined) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function getDownloadedBlobUrl(downloadId: string): Promise<string | null> {
  const cached = activeObjectUrls.get(downloadId);
  if (cached) return cached;
  const blob = await getDownloadedBlob(downloadId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  activeObjectUrls.set(downloadId, url);
  return url;
}

export async function deleteDownloadedBlob(downloadId: string): Promise<void> {
  partialDownloads.delete(downloadId);
  const existingUrl = activeObjectUrls.get(downloadId);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
    activeObjectUrls.delete(downloadId);
  }
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(downloadId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore storage cleanup errors
  }
}

export function triggerDeviceFileSave(blob: Blob, fileName: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'Netflux-Video.mp4';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

export function triggerProxyFileSave(videoUrl: string, fileName: string): boolean {
  if (typeof document === 'undefined') return false;
  const cleanUrl = sanitizeMunoStreamUrl(videoUrl);
  if (!cleanUrl) return false;
  const a = document.createElement('a');
  a.href = `/api/stream?url=${encodeURIComponent(cleanUrl)}&download=1&filename=${encodeURIComponent(fileName || 'Netflux-Video.mp4')}`;
  a.download = fileName || 'Netflux-Video.mp4';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

export async function saveCompletedDownloadToDevice(
  item: DownloadItem,
  storageKey?: string
): Promise<boolean> {
  const fileName = item.fileName || `${item.title}.mp4`;
  const key = storageKey || item.id;
  const blob = await getDownloadedBlob(key);
  if (blob) {
    return triggerDeviceFileSave(blob, fileName);
  }
  if (item.videoUrl) {
    return triggerProxyFileSave(item.videoUrl, fileName);
  }
  return false;
}

export function pauseDownloadTask(storageKey: string): void {
  const controller = activeControllers.get(storageKey);
  if (controller) {
    controller.abort();
    activeControllers.delete(storageKey);
  }
}

export function pauseAllActiveDownloads(): void {
  for (const [, controller] of activeControllers.entries()) {
    controller.abort();
  }
  activeControllers.clear();
}

export function cancelDownloadTask(storageKey: string): void {
  pauseDownloadTask(storageKey);
  void deleteDownloadedBlob(storageKey);
}

export interface RunDownloadTaskOptions {
  id: string;
  storageKey?: string;
  videoUrl: string;
  fileName: string;
  onPatch: (patch: Partial<DownloadItem>) => void;
}

export async function startRealDownloadTask({
  id,
  storageKey,
  videoUrl,
  fileName,
  onPatch,
}: RunDownloadTaskOptions): Promise<void> {
  const taskKey = storageKey || id;
  const cleanUrl = sanitizeMunoStreamUrl(videoUrl);
  if (!cleanUrl) {
    onPatch({
      status: 'failed',
      errorMessage: 'No valid video stream available to download.',
    });
    return;
  }

  // Cancel any stale in-flight controller for this task key
  pauseDownloadTask(taskKey);

  const controller = new AbortController();
  activeControllers.set(taskKey, controller);
  const { signal } = controller;

  const partial = partialDownloads.get(taskKey) || {
    chunks: [],
    bytesDownloaded: 0,
    totalBytes: undefined,
  };
  partialDownloads.set(taskKey, partial);

  onPatch({
    status: 'pending',
    errorMessage: undefined,
    bytesDownloaded: partial.bytesDownloaded,
    totalBytes: partial.totalBytes,
    progress: computeDownloadProgress(partial.bytesDownloaded, partial.totalBytes),
  });

  const proxyBase = `/api/stream?url=${encodeURIComponent(cleanUrl)}`;

  try {
    // 1. Probe file size & whether direct CDN CORS streaming is allowed
    let useDirectCors = false;
    let totalBytes = partial.totalBytes;

    if (!totalBytes) {
      try {
        const directProbe = await fetch(cleanUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          referrerPolicy: 'no-referrer',
          signal,
        });
        if (directProbe.ok || directProbe.status === 206) {
          useDirectCors = true;
          const parsedTotal = parseContentRangeTotalBytes(
            directProbe.headers.get('content-range'),
            directProbe.headers.get('content-length'),
            directProbe.status
          );
          if (parsedTotal) totalBytes = parsedTotal;
          await directProbe.body?.cancel().catch(() => {});
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        useDirectCors = false;
      }
    }

    if (!totalBytes) {
      const proxyProbe = await fetch(proxyBase, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal,
      });
      if (!proxyProbe.ok && proxyProbe.status !== 206) {
        throw new Error(`Server returned HTTP ${proxyProbe.status}`);
      }
      const parsedTotal = parseContentRangeTotalBytes(
        proxyProbe.headers.get('content-range'),
        proxyProbe.headers.get('content-length'),
        proxyProbe.status
      );
      await proxyProbe.body?.cancel().catch(() => {});
      if (parsedTotal) {
        totalBytes = parsedTotal;
      } else {
        // Fallback to HEAD through proxy if 206 omitted Content-Range
        try {
          const headProbe = await fetch(proxyBase, { method: 'HEAD', signal });
          if (headProbe.ok) {
            const headTotal = parseContentRangeTotalBytes(
              headProbe.headers.get('content-range'),
              headProbe.headers.get('content-length'),
              headProbe.status
            );
            if (headTotal) totalBytes = headTotal;
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
        }
      }
    }

    partial.totalBytes = totalBytes;
    const totalMb = totalBytes ? Math.max(1, Math.round(totalBytes / (1024 * 1024))) : 0;

    onPatch({
      status: 'downloading',
      totalBytes,
      fileSizeMb: totalMb || 1,
      bytesDownloaded: partial.bytesDownloaded,
      progress: computeDownloadProgress(partial.bytesDownloaded, totalBytes),
    });

    let lastReportAt = 0;
    const emitProgress = (force = false) => {
      const now = Date.now();
      if (!force && now - lastReportAt < 250) return;
      lastReportAt = now;
      if (totalBytes && partial.bytesDownloaded > totalBytes) {
        totalBytes = undefined;
        partial.totalBytes = undefined;
      }
      const pct = totalBytes
        ? Math.min(99, computeDownloadProgress(partial.bytesDownloaded, totalBytes))
        : 0;
      onPatch({
        status: 'downloading',
        bytesDownloaded: partial.bytesDownloaded,
        totalBytes,
        fileSizeMb: totalBytes
          ? Math.max(1, Math.round(totalBytes / (1024 * 1024)))
          : Math.max(1, Math.round(partial.bytesDownloaded / (1024 * 1024))),
        progress: pct,
      });
    };

    // 2. Direct CORS streaming path if allowed by upstream CDN
    if (useDirectCors) {
      try {
        const headers: Record<string, string> = {};
        if (partial.bytesDownloaded > 0) {
          headers.Range = `bytes=${partial.bytesDownloaded}-`;
        }
        const resp = await fetch(cleanUrl, {
          method: 'GET',
          headers,
          referrerPolicy: 'no-referrer',
          signal,
        });
        if (!resp.ok && resp.status !== 206) {
          throw new Error(`Direct fetch HTTP ${resp.status}`);
        }
        if (!partial.totalBytes) {
          const parsed = parseContentRangeTotalBytes(
            resp.headers.get('content-range'),
            resp.headers.get('content-length'),
            resp.status
          );
          if (parsed) {
            totalBytes = parsed;
            partial.totalBytes = parsed;
          }
        }
        const reader = resp.body?.getReader();
        if (!reader) {
          throw new Error('ReadableStream unavailable');
        }
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            partial.chunks.push(value);
            partial.bytesDownloaded += value.byteLength;
            emitProgress();
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) throw err;
        // Fallback smoothly to chunked proxy transfer below
        useDirectCors = false;
      }
    }

    // 3. Reliable chunked proxy path (4 MiB per request) if direct CORS unavailable
    if (!useDirectCors) {
      let eof = false;
      while (!eof) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const start = partial.bytesDownloaded;
        const end = totalBytes
          ? Math.min(totalBytes - 1, start + PROXY_CHUNK_BYTES - 1)
          : start + PROXY_CHUNK_BYTES - 1;

        if (totalBytes && start >= totalBytes) {
          break;
        }

        const chunkResp = await fetch(proxyBase, {
          method: 'GET',
          headers: { Range: `bytes=${start}-${end}` },
          signal,
        });
        if (!chunkResp.ok && chunkResp.status !== 206) {
          if (chunkResp.status === 416 && partial.bytesDownloaded > 0) {
            eof = true;
            break;
          }
          throw new Error(`Download failed (HTTP ${chunkResp.status})`);
        }

        if (!totalBytes) {
          const parsed = parseContentRangeTotalBytes(
            chunkResp.headers.get('content-range'),
            chunkResp.headers.get('content-length'),
            chunkResp.status
          );
          if (parsed) {
            totalBytes = parsed;
            partial.totalBytes = parsed;
          }
        }

        const buf = new Uint8Array(await chunkResp.arrayBuffer());
        if (buf.byteLength === 0) {
          eof = true;
          break;
        }
        partial.chunks.push(buf);
        partial.bytesDownloaded += buf.byteLength;
        emitProgress(true);

        if (totalBytes && partial.bytesDownloaded >= totalBytes) {
          eof = true;
        } else if (buf.byteLength < end - start + 1 && !totalBytes) {
          eof = true;
        }
      }
    }

    // 4. Assemble final MP4 Blob, persist in IndexedDB for offline play, and save to device files
    const finalTotal = partial.totalBytes || partial.bytesDownloaded;
    const blobParts = partial.chunks.map((chunk) => {
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      return copy.buffer;
    });
    const finalBlob = new Blob(blobParts, { type: 'video/mp4' });
    await saveDownloadedBlob(taskKey, finalBlob);

    const savedToDevice = triggerDeviceFileSave(finalBlob, fileName);
    partialDownloads.delete(taskKey);
    activeControllers.delete(taskKey);

    onPatch({
      status: 'completed',
      progress: 100,
      bytesDownloaded: finalTotal,
      totalBytes: finalTotal,
      fileSizeMb: Math.max(1, Math.round(finalTotal / (1024 * 1024))),
      savedToDevice,
      errorMessage: undefined,
    });
  } catch (err: any) {
    activeControllers.delete(taskKey);
    if (err?.name === 'AbortError' || signal.aborted) {
      onPatch({
        status: 'paused',
        bytesDownloaded: partial.bytesDownloaded,
        totalBytes: partial.totalBytes,
        progress: computeDownloadProgress(partial.bytesDownloaded, partial.totalBytes),
      });
      return;
    }

    onPatch({
      status: 'failed',
      bytesDownloaded: partial.bytesDownloaded,
      totalBytes: partial.totalBytes,
      errorMessage: err?.message || 'Download interrupted. Tap retry to resume.',
    });
  }
}
