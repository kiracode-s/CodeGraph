import React, { useRef } from 'react';
import { Play, Code2, ArrowRight, Edit3, Terminal, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { sfx } from '../utils/audio';

interface CodeEditorProps {
  language: Language;
  code: string;
  onChange: (newCode: string) => void;
  activeLine?: number;
  nextLine?: number;
  isVisualizing: boolean;
  onVisualize: () => void;
  onRun: () => void;
  onToggleEdit: () => void;
  breakpoints: number[];
  onToggleBreakpoint: (line: number) => void;
  isLoading: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  code,
  onChange,
  activeLine,
  nextLine,
  isVisualizing,
  onVisualize,
  onToggleEdit,
  breakpoints,
  onToggleBreakpoint,
  isLoading
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = code.split('\n');

  const fileExtensions: Record<Language, string> = {
    python: 'main.py',
    c: 'solution.c',
    cpp: 'program.cpp',
    java: 'Main.java',
    javascript: 'app.js'
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '    ' + val.substring(end);
      onChange(newVal);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onVisualize();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] border border-[#E5E2DC] rounded-lg overflow-hidden shadow-xs">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#F5F5F3] border-b border-[#E5E2DC] text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#D4D0C8] text-[#1F1F1F] font-mono font-medium shadow-xs">
            <Code2 className="w-3.5 h-3.5 text-[#1B7D5F]" />
            <span>{fileExtensions[language]}</span>
          </div>
          <span className="text-[11px] text-[#6B6B6B] font-mono hidden sm:inline">
            {lines.length} lines
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isVisualizing ? (
            <button
              onClick={() => {
                sfx.playClick();
                onToggleEdit();
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#D4D0C8] text-xs font-sans text-[#1F1F1F] hover:bg-[#F5F5F3] transition-colors"
            >
              <Edit3 className="w-3 h-3 text-[#6B6B6B]" />
              <span>Edit Code</span>
            </button>
          ) : (
            <button
              onClick={() => {
                sfx.playClick();
                onVisualize();
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#1B7D5F] hover:bg-[#16654D] text-[#FFFFFF] text-xs font-sans font-medium transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Visualize</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative flex-1 flex overflow-hidden bg-[#FAFAF8]">
        {/* Line Numbers & Execution Pointer Gutter */}
        <div className="w-14 bg-[#F5F5F3] border-r border-[#E5E2DC] select-none py-2 text-right font-mono text-xs flex flex-col shrink-0">
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isBreakpoint = breakpoints.includes(lineNum);
            const isExecuted = isVisualizing && activeLine === lineNum;
            const isNext = isVisualizing && nextLine === lineNum;

            return (
              <div
                key={lineNum}
                onClick={() => onToggleBreakpoint(lineNum)}
                className={`h-6 px-1 flex items-center justify-end gap-1 cursor-pointer transition-colors leading-6 ${
                  isExecuted
                    ? 'bg-[#D1EDE3] text-[#0F4D3A] font-bold'
                    : isNext
                    ? 'bg-[#FAE6D8] text-[#A35A24] font-bold'
                    : 'hover:bg-[#EAE8E2] text-[#8A8780]'
                }`}
                title={`Line ${lineNum} (Click to toggle breakpoint)`}
              >
                {/* Breakpoint Dot */}
                {isBreakpoint && (
                  <span className="w-2 h-2 rounded-full bg-[#C44545] shrink-0" />
                )}

                {/* PythonTutor Style Execution Indicator Arrows */}
                {isExecuted ? (
                  <span
                    className="text-[#1B7D5F] font-bold text-xs"
                    title="Line that just executed"
                  >
                    ➜
                  </span>
                ) : isNext ? (
                  <span
                    className="text-[#C4702E] font-bold text-xs"
                    title="Next line to execute"
                  >
                    ➜
                  </span>
                ) : null}

                <span className="w-5 text-right">{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Code Content Area */}
        <div className="flex-1 relative overflow-auto p-2 font-mono text-xs leading-6">
          {isVisualizing ? (
            /* Read-Only Visualizer Mode with PythonTutor Style Line Highlights */
            <div className="w-full min-w-full font-mono text-xs">
              {lines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const isExecuted = activeLine === lineNum;
                const isNext = nextLine === lineNum;

                let rowStyle = 'bg-transparent text-[#1F1F1F]';
                if (isExecuted) {
                  rowStyle = 'bg-[#EBF7F2] border-l-4 border-[#1B7D5F] text-[#0F4D3A] font-semibold';
                } else if (isNext) {
                  rowStyle = 'bg-[#FDF6F0] border-l-4 border-[#C4702E] text-[#823E11] font-medium';
                }

                return (
                  <div
                    key={lineNum}
                    className={`h-6 px-2 flex items-center whitespace-pre transition-colors duration-150 ${rowStyle}`}
                  >
                    {lineText || ' '}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Live Interactive Code Editor Mode */
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full h-full resize-none outline-none bg-transparent text-[#1F1F1F] font-mono text-xs leading-6 p-0 border-none whitespace-pre"
              placeholder="// Write code here..."
            />
          )}
        </div>
      </div>

      {/* Editor Footer: Legend & Status */}
      <div className="px-3 py-1.5 bg-[#F5F5F3] border-t border-[#E5E2DC] flex items-center justify-between text-[11px] text-[#6B6B6B] font-sans">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="text-[#1B7D5F] font-bold font-mono">➜</span> Line just executed
          </span>
          <span className="flex items-center gap-1">
            <span className="text-[#C4702E] font-bold font-mono">➜</span> Next line to execute
          </span>
        </div>
        <div className="text-[10px] font-mono text-[#8A8780]">
          {isVisualizing ? 'Visualization Active' : 'Press Ctrl+Enter to Visualize'}
        </div>
      </div>
    </div>
  );
};
