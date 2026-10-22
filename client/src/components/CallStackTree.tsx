import React from 'react';
import { GitBranch, CornerDownRight, CheckCircle2 } from 'lucide-react';
import { StackFrame } from '../types';

interface CallStackTreeProps {
  callStack: StackFrame[];
}

export const CallStackTree: React.FC<CallStackTreeProps> = ({ callStack }) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBFBFA] border border-[#E5E2DC] rounded-lg overflow-hidden select-none">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#F5F5F3] border-b border-[#E5E2DC] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-sm text-[#1F1F1F]">
            Call Stack Hierarchy
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#D4D0C8] text-[#4A4A4A]">
            Depth: {callStack.length}
          </span>
        </div>
        <span className="text-[11px] font-sans text-[#6B6B6B]">
          Nested execution contexts
        </span>
      </div>

      {callStack.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8A8780] font-sans">
          <GitBranch className="w-6 h-6 mb-2 text-[#8A8780] opacity-50" />
          <span className="text-xs font-semibold text-[#4A4A4A]">No active stack frames</span>
          <span className="text-[11px] text-[#A39E93] mt-1">
            Function calls and recursive frames will show as a nested tree
          </span>
        </div>
      ) : (
        <div className="flex-1 p-6 space-y-3 overflow-y-auto">
          {callStack.map((frame, idx) => {
            const isTop = idx === callStack.length - 1;
            const indent = idx * 24;

            return (
              <div
                key={frame.id || idx}
                style={{ marginLeft: `${indent}px` }}
                className={`p-3.5 rounded-lg border transition-all font-sans shadow-xs ${
                  isTop
                    ? 'bg-[#FFFFFF] border-2 border-[#1B7D5F] shadow-sm ring-1 ring-[#1B7D5F]/20'
                    : 'bg-[#FFFFFF] border-[#D4D0C8] opacity-90'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <CornerDownRight className="w-4 h-4 text-[#1B7D5F]" />
                    <span className="text-xs font-bold text-[#1F1F1F]">
                      {frame.name}
                    </span>
                    <span className="text-[11px] text-[#6B6B6B]">
                      (Line {frame.line})
                    </span>
                  </div>

                  {isTop ? (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#F0F7F4] text-[#1B7D5F] border border-[#D1EDE3]">
                      Active Scope
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#8A8780]">
                      Depth #{idx}
                    </span>
                  )}
                </div>

                {/* Local variables summary preview */}
                {Object.keys(frame.variables).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#F5F5F3] flex flex-wrap gap-2 text-[11px] font-mono">
                    {Object.entries(frame.variables).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded bg-[#F5F5F3] border border-[#E5E2DC] text-[#4A4A4A]"
                      >
                        <strong className="text-[#1F1F1F]">{k}</strong> = {String(v.value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
