import React from 'react';
import { 
  Terminal, 
  Lightbulb, 
  AlertCircle, 
  CheckCircle, 
  Compass, 
  Info,
  Copy
} from 'lucide-react';
import { StepState, ExecutionError } from '../types';

interface InfoPanelProps {
  currentStep?: StepState;
  nextStep?: StepState;
  totalSteps: number;
  stdout: string;
  error?: ExecutionError | null;
  status: 'idle' | 'running' | 'visualizing' | 'completed' | 'error';
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  currentStep,
  nextStep,
  totalSteps,
  stdout,
  error,
  status
}) => {
  const currentLine = currentStep ? currentStep.line : null;
  const nextLine = nextStep ? nextStep.line : null;
  const activeFrame = currentStep?.callStack?.[currentStep.callStack.length - 1];

  const handleCopyStdout = () => {
    if (stdout) navigator.clipboard.writeText(stdout);
  };

  return (
    <div className="flex flex-col h-full space-y-3 font-sans text-xs overflow-y-auto pr-1 select-none">
      {/* 1. Step Explanation Card */}
      <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-[#E5E2DC]">
          <div className="flex items-center gap-1.5 font-serif font-bold text-xs text-[#1F1F1F]">
            <Info className="w-3.5 h-3.5 text-[#1B7D5F]" />
            <span>Step Details</span>
          </div>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
              error || status === 'error'
                ? 'bg-[#FDE3E3] text-[#A33636] border border-[#F9BFBF]'
                : status === 'completed'
                ? 'bg-[#D1EDE3] text-[#0F4D3A] border border-[#A3DACA]'
                : 'bg-[#F5F5F3] text-[#4A4A4A] border border-[#D4D0C8]'
            }`}
          >
            {error ? 'Error' : status}
          </span>
        </div>

        {currentStep ? (
          <div className="space-y-2.5 leading-relaxed text-[#4A4A4A]">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-[#555555] block mb-0.5">
                Action Executed
              </span>
              <p className="font-mono text-xs font-semibold text-[#1F1F1F] bg-[#F5F5F3] p-1.5 rounded border border-[#E5E2DC]">
                Line {currentLine}: {currentStep.explanation.action || 'Instruction executed'}
              </p>
            </div>

            {currentStep.explanation.reason && (
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#555555] block mb-0.5">
                  Semantic Explanation
                </span>
                <p className="text-xs text-[#1F1F1F]">
                  {currentStep.explanation.reason}
                </p>
              </div>
            )}

            {currentStep.explanation.memoryImpact && (
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#555555] block mb-0.5">
                  Memory Impact
                </span>
                <p className="text-xs text-[#16654D] bg-[#F0F7F4] p-1.5 rounded border border-[#D1EDE3]">
                  {currentStep.explanation.memoryImpact}
                </p>
              </div>
            )}

            {nextLine && (
              <div className="pt-2 border-t border-[#F5F5F3] text-[11px] text-[#4A4A4A] flex items-center gap-1 font-mono">
                <span className="text-[#A35A24] font-bold">➜</span>
                <span>Next up: Line {nextLine}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-[#4A4A4A]">
            <p className="text-xs">No execution active</p>
            <p className="text-[11px] text-[#595959] mt-0.5">
              Click 'Visualize Execution' to inspect state
            </p>
          </div>
        )}
      </div>

      {/* 2. Program Output Terminal Card */}
      <div className="flex-1 flex flex-col p-3 rounded-lg bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs min-h-[160px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E5E2DC]">
          <div className="flex items-center gap-1.5 font-serif font-bold text-xs text-[#1F1F1F]">
            <Terminal className="w-3.5 h-3.5 text-[#4A4A4A]" />
            <span>Program Output</span>
          </div>

          {stdout && (
            <button
              type="button"
              aria-label="Copy terminal output"
              onClick={handleCopyStdout}
              className="p-1 rounded hover:bg-[#F5F5F3] text-[#4A4A4A] hover:text-[#1F1F1F]"
              title="Copy output"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1 bg-[#1F1F1F] rounded p-2.5 font-mono text-xs text-[#D4D0C8] overflow-auto whitespace-pre">
          {stdout ? (
            <span className="text-[#A3DACA]">{stdout}</span>
          ) : (
            <span className="text-[#BCBAB5] italic font-sans text-[11px]">
              (No output produced yet)
            </span>
          )}
        </div>
      </div>

      {/* 3. Error Banner (if any) */}
      {error && (
        <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#F9BFBF] text-[#A33636]">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <AlertCircle className="w-4 h-4 text-[#C44545]" />
            <span>{error.type || 'Runtime Error'} on Line {error.line}</span>
          </div>
          <p className="text-xs font-mono">{error.message}</p>
          {error.suggestion && (
            <div className="mt-2 text-[11px] text-[#4A4A4A] bg-[#FFFFFF] p-2 rounded border border-[#F9BFBF]">
              <strong>Suggestion:</strong> {error.suggestion}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
