import React, { useState } from 'react';
import {
  Download,
  Settings,
  Play,
  Pause,
  Trash2,
  RotateCw,
  FolderDown,
} from 'lucide-react';
import { DownloadItem } from '../types';
import { MoviePoster } from '../components/MoviePoster';

interface DownloadsScreenProps {
  downloads: DownloadItem[];
  onPlayDownloaded: (movieId: string, episodeId?: string) => void;
  onPauseDownload: (downloadId: string) => void;
  onResumeDownload: (downloadId: string) => void;
  onSaveToDevice: (item: DownloadItem) => void;
  onDeleteDownload: (downloadId: string) => void;
  onFindMore: () => void;
  onOpenSettings: () => void;
}

type FilterTab = 'all' | 'active' | 'completed' | 'paused';

export const DownloadsScreen: React.FC<DownloadsScreenProps> = ({
  downloads,
  onPlayDownloaded,
  onPauseDownload,
  onResumeDownload,
  onSaveToDevice,
  onDeleteDownload,
  onFindMore,
  onOpenSettings,
}) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  const activeCount = downloads.filter(
    (d) => d.status === 'pending' || d.status === 'downloading'
  ).length;
  const completedCount = downloads.filter((d) => d.status === 'completed').length;
  const pausedOrFailedCount = downloads.filter(
    (d) => d.status === 'paused' || d.status === 'failed'
  ).length;

  const filteredDownloads = downloads.filter((item) => {
    if (filterTab === 'active') {
      return item.status === 'pending' || item.status === 'downloading';
    }
    if (filterTab === 'completed') {
      return item.status === 'completed';
    }
    if (filterTab === 'paused') {
      return item.status === 'paused' || item.status === 'failed';
    }
    return true;
  });

  const getDisplayPercent = (item: DownloadItem): number => {
    if (item.status === 'completed') return 100;
    if (item.status === 'pending') return 0;
    return Math.min(100, Math.max(0, Math.round(item.progress || 0)));
  };

  const renderConditionMeta = (item: DownloadItem) => {
    const pct = getDisplayPercent(item);

    if (item.status === 'pending') {
      return (
        <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
          <span className="text-amber-400">Pending</span>
          <span className="text-neutral-300">{pct}% / 100%</span>
        </div>
      );
    }

    if (item.status === 'downloading') {
      return (
        <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
          <span className="text-neutral-200">Downloading</span>
          <span className="text-white">{pct}% / 100%</span>
        </div>
      );
    }

    if (item.status === 'paused') {
      return (
        <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
          <span className="text-neutral-400">Paused</span>
          <span className="text-neutral-300">{pct}% / 100%</span>
        </div>
      );
    }

    if (item.status === 'failed') {
      return (
        <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
          <span className="text-red-400 truncate">{item.errorMessage || 'Download failed'}</span>
          <span className="text-neutral-400 shrink-0">{pct}% / 100%</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-2 text-xs font-semibold tabular-nums">
        <span className="text-[#46d369]">Completed</span>
        <span className="text-[#46d369]">100% / 100%</span>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-5xl mx-auto flex flex-col flex-1">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Downloads</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Offline movies &amp; episodes saved on your device
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="min-w-[44px] min-h-[44px] text-neutral-400 hover:text-white rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
            aria-label="Download Settings"
          >
            <Settings size={20} />
          </button>
        </div>

        {/* Downloads Grid or Empty State */}
        {downloads.length > 0 ? (
          <div className="flex flex-col gap-5">
            {/* Segmented Filter Control */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-neutral-900 border border-white/10 rounded-xl">
                {(
                  [
                    { id: 'all', label: `All (${downloads.length})` },
                    { id: 'active', label: `Downloading (${activeCount})` },
                    { id: 'completed', label: `Completed (${completedCount})` },
                    { id: 'paused', label: `Paused / Failed (${pausedOrFailedCount})` },
                  ] as const
                ).map((tab) => {
                  const isActive = filterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#E50914] text-white'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredDownloads.length === 0 ? (
              <div className="py-12 text-center bg-neutral-950/60 border border-white/5 rounded-2xl">
                <p className="text-sm font-semibold text-white mb-1">No downloads in this status</p>
                <p className="text-xs text-neutral-400">
                  Switch filter tabs above or download a movie from any title detail page.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDownloads.map((item) => {
                  const isActiveTransfer = item.status === 'pending' || item.status === 'downloading';
                  const isPausedOrFailed = item.status === 'paused' || item.status === 'failed';
                  const pct = getDisplayPercent(item);
                  const barColor =
                    item.status === 'completed'
                      ? 'bg-[#46d369]'
                      : item.status === 'paused'
                        ? 'bg-neutral-500'
                        : item.status === 'failed'
                          ? 'bg-red-500/70'
                          : 'bg-[#E50914]';

                  return (
                    <div
                      key={item.id}
                      data-testid={`download-item-${item.id}`}
                      className="p-4 bg-neutral-950 border border-white/10 rounded-xl flex items-center justify-between gap-4 group hover:border-white/25 transition-colors"
                    >
                      <div
                        className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                        onClick={() => {
                          if (item.status === 'completed') {
                            onPlayDownloaded(item.movieId, item.episodeId);
                          }
                        }}
                      >
                        <div className="relative w-14 h-20 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                          <MoviePoster title={item.title} posterUrl={item.posterUrl} />
                        </div>

                        <div className="flex flex-col min-w-0 flex-1 gap-1.5">
                          <div>
                            <span className="text-sm font-bold text-neutral-100 block truncate group-hover:text-white">
                              {item.title}
                            </span>
                            {item.subTitle && (
                              <span className="text-[11px] text-neutral-400 block truncate mt-0.5">
                                {item.subTitle}
                              </span>
                            )}
                          </div>

                          {renderConditionMeta(item)}

                          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${item.status === 'completed' ? 100 : Math.max(4, pct)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActiveTransfer && (
                          <button
                            type="button"
                            onClick={() => onPauseDownload(item.id)}
                            className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-700 text-white hover:border-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Pause download"
                            aria-label={`Pause download ${item.title}`}
                          >
                            <Pause size={15} />
                          </button>
                        )}

                        {isPausedOrFailed && (
                          <button
                            type="button"
                            onClick={() => onResumeDownload(item.id)}
                            className="w-10 h-10 rounded-full bg-[#E50914] text-white hover:bg-[#f40612] flex items-center justify-center transition-colors cursor-pointer"
                            title={item.status === 'failed' ? 'Retry download' : 'Resume download'}
                            aria-label={`${item.status === 'failed' ? 'Retry' : 'Resume'} download ${item.title}`}
                          >
                            <RotateCw size={15} />
                          </button>
                        )}

                        {item.status === 'completed' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onSaveToDevice(item)}
                              className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-200 hover:text-white hover:border-white flex items-center justify-center transition-colors cursor-pointer"
                              title="Save file to device"
                              aria-label={`Save ${item.title} to device`}
                            >
                              <FolderDown size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onPlayDownloaded(item.movieId, item.episodeId)}
                              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer"
                              title="Play offline"
                              aria-label={`Play ${item.title}`}
                            >
                              <Play size={15} className="fill-black ml-0.5" />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteDownload(item.id)}
                          className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete download"
                          aria-label={`Delete download ${item.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={onFindMore}
              className="w-full sm:w-auto sm:self-start px-6 py-2.5 mt-1 rounded-lg border border-neutral-700 hover:border-white text-xs font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer"
            >
              Find More to Download
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-14 bg-neutral-950/60 border border-white/5 rounded-2xl">
            <div className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center mb-6 shadow-inner">
              <Download size={36} className="text-neutral-400 stroke-[1.8]" />
            </div>

            <h2 className="text-lg font-bold text-white mb-2">
              Your downloads will appear here.
            </h2>
            <p className="text-xs text-neutral-400 max-w-xs mb-8">
              Download your favorite shows and movies to save onto your device and watch offline anytime.
            </p>

            <button
              type="button"
              onClick={onFindMore}
              className="px-8 h-11 bg-[#E50914] hover:bg-[#f40612] text-xs font-bold text-white rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              Find Something to Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
