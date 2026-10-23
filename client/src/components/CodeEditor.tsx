import React, { useRef, useState, useEffect } from 'react';
import { Play, Code2, Edit3, Sun, Moon } from 'lucide-react';
import { Language } from '../types';
import { sfx } from '../utils/audio';
import { tokenizeLine, getVSCodeTokenStyle } from '../utils/syntaxHighlight';

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
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  const [editorTheme, setEditorTheme] = useState<'vscode-dark' | 'vscode-light'>('vscode-dark');

  const lines = code.split('\n');

  const fileExtensions: Record<Language, string> = {
    python: 'main.py',
    c: 'solution.c',
    cpp: 'program.cpp',
    java: 'Main.java',
    javascript: 'app.js'
  };

  // Sync scroll between textarea and highlighted background
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (codeDisplayRef.current) {
      codeDisplayRef.current.scrollTop = e.currentTarget.scrollTop;
      codeDisplayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
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

  const isDark = editorTheme === 'vscode-dark';

  return (
    <div className={`flex flex-col h-full rounded-lg overflow-hidden border shadow-sm transition-colors duration-150 ${
      isDark ? 'bg-[#1E1E1E] border-[#333333] text-[#D4D4D4]' : 'bg-[#FFFFFF] border-[#E5E2DC] text-[#1F1F1F]'
    }`}>
      {/* VS Code Tab Header Bar */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b text-xs select-none ${
        isDark ? 'bg-[#252526] border-[#333333]' : 'bg-[#F5F5F3] border-[#E5E2DC]'
      }`}>
        <div className="flex items-center gap-2">
          {/* Active File Tab with VS Code style */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-t border-t-2 text-xs font-mono font-medium shadow-xs ${
            isDark
              ? 'bg-[#1E1E1E] border-t-[#007ACC] text-[#FFFFFF]'
              : 'bg-[#FFFFFF] border-t-[#007ACC] text-[#1F1F1F] border-x border-[#E5E2DC]'
          }`}>
            <Code2 className="w-3.5 h-3.5 text-[#4EC9B0]" />
            <span>{fileExtensions[language]}</span>
          </div>

          <span className={`text-[11px] font-mono hidden sm:inline ${
            isDark ? 'text-[#858585]' : 'text-[#6B6B6B]'
          }`}>
            {lines.length} lines • UTF-8
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Switcher Button */}
          <button
            onClick={() => setEditorTheme(isDark ? 'vscode-light' : 'vscode-dark')}
            className={`p-1 rounded transition-colors ${
              isDark ? 'text-[#CCCCCC] hover:bg-[#333333]' : 'text-[#6B6B6B] hover:bg-[#EAE8E2]'
            }`}
            title={`Switch to ${isDark ? 'VS Code Light+' : 'VS Code Dark+'}`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-[#DCDCAA]" /> : <Moon className="w-3.5 h-3.5 text-[#569CD6]" />}
          </button>

          {isVisualizing ? (
            <button
              onClick={() => {
                sfx.playClick();
                onToggleEdit();
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-sans transition-colors ${
                isDark
                  ? 'bg-[#2D2D2D] hover:bg-[#3E3E3E] text-[#CCCCCC] border border-[#444444]'
                  : 'bg-[#FFFFFF] hover:bg-[#F5F5F3] text-[#1F1F1F] border border-[#D4D0C8]'
              }`}
            >
              <Edit3 className="w-3 h-3 text-[#569CD6]" />
              <span>Edit Code</span>
            </button>
          ) : (
            <button
              onClick={() => {
                sfx.playClick();
                onVisualize();
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] text-xs font-sans font-medium transition-colors disabled:opacity-50 shadow-xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isLoading ? 'Compiling...' : 'Visualize (Ctrl+Enter)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Body: Gutter + Syntax Highlighted Canvas */}
      <div className={`relative flex-1 flex overflow-hidden ${
        isDark ? 'bg-[#1E1E1E]' : 'bg-[#FAFAF8]'
      }`}>
        {/* Line Numbers & Execution Gutter */}
        <div className={`w-14 select-none py-2 text-right font-mono text-xs flex flex-col shrink-0 border-r ${
          isDark ? 'bg-[#1E1E1E] border-[#333333] text-[#858585]' : 'bg-[#F5F5F3] border-[#E5E2DC] text-[#8A8780]'
        }`}>
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
                    ? isDark ? 'bg-[#1E3A2B] text-[#4EC9B0] font-bold' : 'bg-[#D1EDE3] text-[#0F4D3A] font-bold'
                    : isNext
                    ? isDark ? 'bg-[#3A2A1A] text-[#CE9178] font-bold' : 'bg-[#FAE6D8] text-[#A35A24] font-bold'
                    : isDark ? 'hover:bg-[#2A2D2E] text-[#858585]' : 'hover:bg-[#EAE8E2] text-[#8A8780]'
                }`}
                title={`Line ${lineNum} (Click to toggle breakpoint)`}
              >
                {/* Breakpoint Dot */}
                {isBreakpoint && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F14C4C] shrink-0 shadow-sm animate-pulse" />
                )}

                {/* Execution Arrows */}
                {isExecuted ? (
                  <span className="text-[#4EC9B0] font-bold text-xs" title="Line just executed">
                    ➜
                  </span>
                ) : isNext ? (
                  <span className="text-[#CE9178] font-bold text-xs" title="Next line to execute">
                    ➜
                  </span>
                ) : null}

                <span className="w-5 text-right">{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Code Content Area: Syntax Highlighted */}
        <div className="flex-1 relative overflow-hidden font-mono text-xs leading-6">
          {/* Synchronized Syntax Highlighted Rendering */}
          <div
            ref={codeDisplayRef}
            className="absolute inset-0 p-2 overflow-auto pointer-events-none whitespace-pre select-text font-mono text-xs leading-6"
            style={{ tabSize: 4 }}
          >
            {lines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const isExecuted = isVisualizing && activeLine === lineNum;
              const isNext = isVisualizing && nextLine === lineNum;
              const tokens = tokenizeLine(lineText, language);

              let rowHighlight = '';
              if (isExecuted) {
                rowHighlight = isDark
                  ? 'bg-[#1E3A2B]/70 border-l-4 border-[#4EC9B0] pl-1 font-semibold'
                  : 'bg-[#EBF7F2] border-l-4 border-[#1B7D5F] pl-1 font-semibold';
              } else if (isNext) {
                rowHighlight = isDark
                  ? 'bg-[#3A2A1A]/70 border-l-4 border-[#CE9178] pl-1 font-medium'
                  : 'bg-[#FDF6F0] border-l-4 border-[#C4702E] pl-1 font-medium';
              }

              return (
                <div
                  key={lineNum}
                  className={`h-6 flex items-center whitespace-pre transition-colors duration-100 ${rowHighlight}`}
                >
                  {tokens.length === 0 || lineText === '' ? (
                    <span className="opacity-0">{' '}</span>
                  ) : (
                    tokens.map((token, tIdx) => (
                      <span
                        key={tIdx}
                        className={isDark ? getVSCodeTokenStyle(token.type) : undefined}
                        style={!isDark ? getLightStyle(token.type) : undefined}
                      >
                        {token.text}
                      </span>
                    ))
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Editable Transparent Textarea on Top (Active when not visualizing) */}
          {!isVisualizing && (
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className={`absolute inset-0 w-full h-full p-2 resize-none outline-none font-mono text-xs leading-6 whitespace-pre border-none overflow-auto bg-transparent ${
                isDark ? 'text-transparent caret-[#FFFFFF]' : 'text-transparent caret-[#007ACC]'
              }`}
              style={{
                tabSize: 4,
                WebkitTextFillColor: 'transparent'
              }}
              placeholder="// Write code here..."
            />
          )}
        </div>
      </div>

      {/* Editor Footer: VS Code Status Bar */}
      <div className={`px-3 py-1 border-t flex items-center justify-between text-[11px] font-mono select-none ${
        isDark ? 'bg-[#007ACC] text-[#FFFFFF] border-[#007ACC]' : 'bg-[#F5F5F3] text-[#6B6B6B] border-[#E5E2DC]'
      }`}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-sans">
            <span className="font-bold text-[#4EC9B0]">➜</span> Executed
          </span>
          <span className="flex items-center gap-1 font-sans">
            <span className="font-bold text-[#CE9178]">➜</span> Next
          </span>
          <span className="hidden md:inline font-sans opacity-85">
            Click line number to toggle breakpoint
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="uppercase">{language}</span>
          <span>Spaces: 4</span>
          <span>{isVisualizing ? 'RUNNING' : 'READY'}</span>
        </div>
      </div>
    </div>
  );
};

// Auxiliary style mapping for Light theme
function getLightStyle(type: string): React.CSSProperties {
  switch (type) {
    case 'control':
      return { color: '#AF00DB', fontWeight: 600 };
    case 'keyword':
      return { color: '#0000FF', fontWeight: 600 };
    case 'type':
      return { color: '#267F99' };
    case 'function':
      return { color: '#795E26' };
    case 'string':
      return { color: '#A31515' };
    case 'number':
      return { color: '#098658' };
    case 'boolean':
      return { color: '#0000FF', fontWeight: 500 };
    case 'comment':
      return { color: '#008000', fontStyle: 'italic' };
    case 'operator':
      return { color: '#000000' };
    default:
      return { color: '#001080' };
  }
}
