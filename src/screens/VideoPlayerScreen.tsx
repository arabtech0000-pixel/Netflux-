import React, { useState } from 'react';
import { Movie, Episode, WatchProgress } from '../types';
import { NetflixPlayer } from '../components/NetflixPlayer';

interface VideoPlayerScreenProps {
  movie: Movie;
  episode?: Episode;
  initialTime?: number;
  initialAudioLang?: string;
  onBack: () => void;
  onProgressUpdate: (progress: WatchProgress) => void;
  onCastClick: () => void;
  onSelectEpisode?: (episode: Episode) => void;
  onNextEpisode?: () => void;
}

export const VideoPlayerScreen: React.FC<VideoPlayerScreenProps> = ({
  movie,
  episode,
  initialTime = 0,
  initialAudioLang = 'English [Original]',
  onBack,
  onProgressUpdate,
  onCastClick,
  onSelectEpisode,
  onNextEpisode,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true);

  return (
    <NetflixPlayer
      movie={movie}
      episode={episode}
      episodes={movie.episodes || []}
      initialTime={initialTime}
      initialAudioLang={initialAudioLang}
      isPlaying={isPlaying}
      isFullscreen={isFullscreen}
      variant="fullscreen"
      onPlayPause={setIsPlaying}
      onToggleFullscreen={(next) => {
        setIsFullscreen(next);
        if (!next) {
          onBack();
        }
      }}
      onBack={onBack}
      onCastClick={onCastClick}
      onSelectEpisode={onSelectEpisode}
      onNextEpisode={onNextEpisode}
      onProgressUpdate={onProgressUpdate}
    />
  );
};
