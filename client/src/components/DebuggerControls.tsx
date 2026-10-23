import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight, 
  Zap,
  FastForward
} from 'lucide-react';
import { sfx } from '../utils/audio';

interface DebuggerControlsProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  speed: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onRestart: () => void;
  onStepChange: (stepIndex: number) => void;
  onSpeedChange: (speed: number) => void;
  onNextBreakpoint?: () => void;
}

export const DebuggerControls: React.FC<DebuggerControlsProps> = ({
  currentStep,
  totalSteps,
  isPlaying,
  speed,
  onPlayPause,
  onNext,
  onPrev,
  onFirst,
  onLast,
  onStepChange,
  onSpeedChange,
  onNextBreakpoint
}) => {
  const speeds = [0.5, 1, 2, 5, 10, 20];
  const maxStep = Math.max(0, totalSteps - 1);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    sfx.playClick();
    onStepChange(Number(e.target.value));
  };

  return (
    <div className="w-full bg-[#FFFFFF] border-t border-[#E5E2DC] px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-3 select-none z-30 shadow-xs">
      {/* 1. Step Navigation Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            sfx.playClick();
            onFirst();
          }}
          disabled={currentStep <= 0}
          className="p-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-[#1F1F1F] disabled:opacity-35 transition-colors shadow-xs"
          title="Jump to Start (Home)"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            sfx.playClick();
            onPrev();
          }}
          disabled={currentStep <= 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-xs font-sans font-medium text-[#1F1F1F] disabled:opacity-35 transition-colors shadow-xs"
          title="Step Backward (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev</span>
        </button>

        <button
          onClick={() => {
            sfx.playClick();
            onPlayPause();
          }}
          disabled={totalSteps <= 0}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-sans font-semibold transition-all shadow-xs ${
            isPlaying
              ? 'bg-[#C44545] hover:bg-[#A33636] text-[#FFFFFF]'
              : 'bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF]'
          } disabled:opacity-35`}
          title={isPlaying ? 'Pause playback (Space)' : 'Auto-play execution (Space)'}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        <button
          onClick={() => {
            sfx.playClick();
            onNext();
          }}
          disabled={currentStep >= maxStep}
          className="flex items-center gap-1 px-3 py-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-xs font-sans font-medium text-[#1F1F1F] disabled:opacity-35 transition-colors shadow-xs"
          title="Step Forward (Right Arrow / F10)"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Fast forward to next breakpoint */}
        {onNextBreakpoint && (
          <button
            onClick={() => {
              sfx.playClick();
              onNextBreakpoint();
            }}
            disabled={currentStep >= maxStep}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-xs font-sans font-medium text-[#C4702E] disabled:opacity-35 transition-colors shadow-xs"
            title="Fast Forward to Next Breakpoint"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">To Breakpoint</span>
          </button>
        )}

        <button
          onClick={() => {
            sfx.playClick();
            onLast();
          }}
          disabled={currentStep >= maxStep}
          className="p-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-[#1F1F1F] disabled:opacity-35 transition-colors shadow-xs"
          title="Jump to End (End)"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Scrubber Track & Step Counter */}
      <div className="flex-1 max-w-md w-full flex items-center gap-3">
        <input
          type="range"
          min="0"
          max={maxStep}
          value={currentStep}
          onChange={handleSliderChange}
          disabled={totalSteps <= 0}
          className="w-full h-1.5 bg-[#E5E2DC] rounded-lg appearance-none cursor-pointer accent-[#007ACC] disabled:opacity-35"
        />
        <div className="shrink-0 px-2.5 py-1 rounded bg-[#F5F5F3] border border-[#E5E2DC] text-[11px] font-mono font-medium text-[#1F1F1F]">
          Step <strong className="text-[#007ACC]">{totalSteps > 0 ? currentStep + 1 : 0}</strong> of {totalSteps}
        </div>
      </div>

      {/* 3. High-Speed Multipliers */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-[#F5F5F3] p-0.5 rounded border border-[#E5E2DC]">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => {
                sfx.playClick();
                onSpeedChange(s);
              }}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors flex items-center gap-0.5 ${
                speed === s
                  ? 'bg-[#007ACC] font-bold text-[#FFFFFF] shadow-xs'
                  : 'text-[#6B6B6B] hover:text-[#1F1F1F]'
              }`}
              title={s === 20 ? 'Turbo Mode (Ultra-fast)' : `${s}x speed`}
            >
              {s === 20 && <Zap className="w-2.5 h-2.5 fill-current" />}
              {s === 20 ? 'Turbo' : `${s}x`}
            </button>
          ))}
        </div>

        <div className="hidden xl:flex items-center gap-1 text-[11px] text-[#8A8780] font-sans">
          <kbd className="px-1 py-0.5 rounded bg-[#F5F5F3] border border-[#D4D0C8] font-mono text-[10px]">
            ←
          </kbd>
          <kbd className="px-1 py-0.5 rounded bg-[#F5F5F3] border border-[#D4D0C8] font-mono text-[10px]">
            →
          </kbd>
          <span>step</span>
          <span className="mx-0.5">•</span>
          <kbd className="px-1 py-0.5 rounded bg-[#F5F5F3] border border-[#D4D0C8] font-mono text-[10px]">
            Space
          </kbd>
          <span>play</span>
        </div>
      </div>
    </div>
  );
};
