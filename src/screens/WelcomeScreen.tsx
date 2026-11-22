import React, { useEffect, useId, useMemo, useState } from 'react';
import { NetflixWordmark } from '../components/NetflixLogo';
import { buildJigsawPiecePath, generateJigsawGridSpecs } from '../services/logic';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  backdropPosters?: string[];
}

const FALLBACK_GRADIENTS: Array<[string, string]> = [
  ['#450a0a', '#09090b'],
  ['#3b0764', '#09090b'],
  ['#7f1d1d', '#1c1917'],
  ['#500724', '#09090b'],
  ['#451a03', '#09090b'],
  ['#172554', '#09090b'],
  ['#083344', '#09090b'],
  ['#1c1917', '#09090b'],
  ['#1e1b4b', '#09090b'],
];

const PIECE_W = 140;
const PIECE_H = 100;
const TAB_OVERHANG = 25;
const TAB_DEPTH = 18;

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
  onSignIn,
  backdropPosters = [],
}) => {
  const uid = useId().replace(/:/g, '');
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const cols = isDesktop ? 4 : 2;
  const rows = isDesktop ? 5 : 7;

  const pieces = useMemo(() => {
    const specs = generateJigsawGridSpecs(rows, cols);
    return specs.map((spec, idx) => {
      const path = buildJigsawPiecePath(PIECE_W, PIECE_H, spec, TAB_DEPTH);
      const bannerUrl =
        backdropPosters.length > 0 ? backdropPosters[idx % backdropPosters.length] : '';
      const [gradStart, gradEnd] = FALLBACK_GRADIENTS[idx % FALLBACK_GRADIENTS.length];
      return {
        ...spec,
        idx,
        path,
        bannerUrl,
        gradStart,
        gradEnd,
      };
    });
  }, [rows, cols, backdropPosters]);

  return (
    <div className="relative min-h-screen w-full bg-black flex flex-col justify-between overflow-hidden select-none">
      {/* Background Interlocking Movie Banner Jigsaw Puzzle */}
      <div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
        data-testid="welcome-puzzle-board"
      >
        <div
          className="w-full grid gap-[2px] opacity-85 scale-[1.04] origin-center"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {pieces.map((piece) => {
            const clipId = `puzzle-clip-${uid}-${piece.idx}`;
            const gradId = `puzzle-grad-${uid}-${piece.idx}`;

            return (
              <div
                key={piece.idx}
                data-testid="welcome-puzzle-piece"
                className="relative aspect-[7/5] overflow-visible"
                style={{
                  zIndex: piece.row * cols + piece.col,
                }}
              >
                <svg
                  viewBox={`${-TAB_OVERHANG} ${-TAB_OVERHANG} ${PIECE_W + TAB_OVERHANG * 2} ${PIECE_H + TAB_OVERHANG * 2}`}
                  className="absolute pointer-events-none overflow-visible drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
                  style={{
                    width: `${((PIECE_W + TAB_OVERHANG * 2) / PIECE_W) * 100}%`,
                    height: `${((PIECE_H + TAB_OVERHANG * 2) / PIECE_H) * 100}%`,
                    left: `${(-TAB_OVERHANG / PIECE_W) * 100}%`,
                    top: `${(-TAB_OVERHANG / PIECE_H) * 100}%`,
                  }}
                >
                  <defs>
                    <clipPath id={clipId}>
                      <path d={piece.path} />
                    </clipPath>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={piece.gradStart} />
                      <stop offset="100%" stopColor={piece.gradEnd} />
                    </linearGradient>
                  </defs>

                  <g clipPath={`url(#${clipId})`}>
                    <rect
                      x={-TAB_OVERHANG}
                      y={-TAB_OVERHANG}
                      width={PIECE_W + TAB_OVERHANG * 2}
                      height={PIECE_H + TAB_OVERHANG * 2}
                      fill={`url(#${gradId})`}
                    />
                    {piece.bannerUrl && (
                      <image
                        href={piece.bannerUrl}
                        x={-TAB_OVERHANG}
                        y={-TAB_OVERHANG}
                        width={PIECE_W + TAB_OVERHANG * 2}
                        height={PIECE_H + TAB_OVERHANG * 2}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                    <rect
                      x={-TAB_OVERHANG}
                      y={-TAB_OVERHANG}
                      width={PIECE_W + TAB_OVERHANG * 2}
                      height={PIECE_H + TAB_OVERHANG * 2}
                      fill="rgba(0,0,0,0.16)"
                    />
                  </g>

                  {/* Jigsaw Piece Seam Shadow + Crisp Highlight Bevel */}
                  <path
                    d={piece.path}
                    fill="none"
                    stroke="rgba(0,0,0,0.78)"
                    strokeWidth="3.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d={piece.path}
                    fill="none"
                    stroke="rgba(255,255,255,0.34)"
                    strokeWidth="1.35"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            );
          })}
        </div>

        {/* Contrast Scrims: keep top/mid puzzle clearly visible while anchoring foreground text */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/95" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black via-black/85 to-transparent" />
      </div>

      {/* Top Bar Branding */}
      <div className="relative z-10 w-full px-6 pt-5 flex items-center justify-between">
        <NetflixWordmark className="text-2xl" />
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <span>Privacy</span>
          <span aria-hidden="true">·</span>
          <span>Help</span>
        </div>
      </div>

      {/* Center / Bottom Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-6 pb-10 flex flex-col items-center text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight max-w-xs mb-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          Unlimited entertainment
        </h1>
        <p className="text-sm text-neutral-200 font-medium mb-8 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
          Watch anywhere. Cancel anytime.
        </p>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3.5">
          <button
            onClick={onGetStarted}
            className="w-full h-12 bg-[#E50914] hover:bg-[#f40612] active:scale-[0.98] text-white font-bold text-base rounded-md shadow-lg shadow-red-950/50 transition-all flex items-center justify-center"
          >
            Get Started
          </button>

          <button
            onClick={onSignIn}
            className="w-full py-2.5 text-neutral-200 hover:text-white font-semibold text-sm transition-colors text-center"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
