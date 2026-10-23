import React, { useState } from 'react';
import { 
  Play, 
  RotateCcw, 
  HelpCircle, 
  Download, 
  Volume2, 
  VolumeX, 
  Code2, 
  BookOpen, 
  ChevronDown,
  Layers,
  Sparkles,
  Server,
  Laptop
} from 'lucide-react';
import { Language } from '../types';
import { CODE_TEMPLATES } from '../templates';
import { sfx } from '../utils/audio';

interface NavbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onSelectTemplate: (code: string) => void;
  engineMode: 'backend' | 'browser';
  onToggleEngineMode: (mode: 'backend' | 'browser') => void;
  onReset: () => void;
  onExportSvg: () => void;
  onExportJson: () => void;
  isVisualizing: boolean;
  onVisualize: () => void;
  onToggleEdit: () => void;
  isLoading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  language,
  onLanguageChange,
  onSelectTemplate,
  engineMode,
  onToggleEngineMode,
  onReset,
  onExportSvg,
  onExportJson,
  isVisualizing,
  onVisualize,
  onToggleEdit,
  isLoading
}) => {
  const [soundOn, setSoundOn] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const toggleSound = () => {
    sfx.enabled = !soundOn;
    setSoundOn(!soundOn);
    if (!soundOn) sfx.playClick();
  };

  const languages: { id: Language; label: string; ext: string }[] = [
    { id: 'python', label: 'Python 3', ext: '.py' },
    { id: 'c', label: 'C (GCC)', ext: '.c' },
    { id: 'cpp', label: 'C++', ext: '.cpp' },
    { id: 'java', label: 'Java', ext: '.java' },
    { id: 'javascript', label: 'JavaScript', ext: '.js' }
  ];

  return (
    <>
      <header className="w-full bg-[#FBFBFA] border-b border-[#E5E2DC] px-4 py-2.5 flex items-center justify-between select-none z-30">
        {/* Left: Editorial Masthead */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#1B7D5F] text-[#FBFBFA] flex items-center justify-center font-serif font-bold text-sm shadow-sm">
              λ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-bold text-base tracking-tight text-[#1F1F1F]">
                  Code Tracer
                </h1>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#F0F7F4] text-[#1B7D5F] border border-[#D1EDE3]">
                  v2.5
                </span>
              </div>
              <p className="text-[11px] text-[#6B6B6B] font-sans">
                Visual step-by-step program execution & memory frames
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-[#E5E2DC] hidden md:block" />

          {/* Language Selector Pills */}
          <div className="hidden sm:flex items-center gap-1 bg-[#F5F5F3] p-1 rounded-md border border-[#E5E2DC]" role="group" aria-label="Select Programming Language">
            {languages.map((lang) => {
              const isActive = language === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`Select ${lang.label}`}
                  onClick={() => {
                    sfx.playClick();
                    onLanguageChange(lang.id);
                  }}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all ${
                    isActive
                      ? 'bg-[#FFFFFF] text-[#1F1F1F] shadow-xs border border-[#D4D0C8] font-semibold'
                      : 'text-[#4A4A4A] hover:text-[#1F1F1F] hover:bg-[#EAE8E2]/50'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center/Right: Action Controls */}
        <div className="flex items-center gap-2">
          {/* Example Programs Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={showTemplates}
              aria-label="Example Programs"
              onClick={() => {
                sfx.playClick();
                setShowTemplates(!showTemplates);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-xs font-sans font-medium text-[#1F1F1F] transition-all shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#4A4A4A]" />
              <span>Examples</span>
              <ChevronDown className="w-3 h-3 text-[#4A4A4A]" />
            </button>

            {showTemplates && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowTemplates(false)}
                />
                <div className="absolute left-0 mt-1.5 w-72 bg-[#FFFFFF] border border-[#E5E2DC] rounded-lg shadow-lg z-50 p-1.5 max-h-80 overflow-y-auto">
                  <div className="px-2.5 py-1.5 text-[11px] font-mono font-semibold text-[#4A4A4A] border-b border-[#E5E2DC]">
                    {language.toUpperCase()} EXAMPLES
                  </div>
                  {CODE_TEMPLATES[language]?.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        onSelectTemplate(tmpl.code);
                        setShowTemplates(false);
                      }}
                      className="w-full text-left p-2 rounded hover:bg-[#F5F5F3] transition-colors group"
                    >
                      <div className="text-xs font-semibold text-[#1F1F1F] group-hover:text-[#1B7D5F]">
                        {tmpl.name}
                      </div>
                      <div className="text-[11px] text-[#4A4A4A] line-clamp-1">
                        {tmpl.description}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Engine Selector */}
          <button
            type="button"
            aria-label={`Execution Engine: ${engineMode === 'backend' ? 'Local Backend' : 'Browser Simulator'}, click to switch`}
            onClick={() => {
              sfx.playClick();
              onToggleEngineMode(engineMode === 'backend' ? 'browser' : 'backend');
            }}
            title={engineMode === 'backend' ? 'Running on local engine server' : 'Running simulated trace in browser'}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-xs font-mono text-[#4A4A4A] transition-all shadow-xs"
          >
            {engineMode === 'backend' ? (
              <>
                <Server className="w-3.5 h-3.5 text-[#1B7D5F]" />
                <span>Engine: Local Backend</span>
              </>
            ) : (
              <>
                <Laptop className="w-3.5 h-3.5 text-[#C4702E]" />
                <span>Engine: Browser Simulator</span>
              </>
            )}
          </button>

          {/* Primary Action Button: Visualize / Edit */}
          {isVisualizing ? (
            <button
              type="button"
              aria-label="Edit Code"
              onClick={() => {
                sfx.playClick();
                onToggleEdit();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#F5F5F3] hover:bg-[#EAE8E2] border border-[#D4D0C8] text-xs font-sans font-semibold text-[#1F1F1F] transition-all shadow-xs"
            >
              <Code2 className="w-3.5 h-3.5 text-[#4A4A4A]" />
              <span>Edit Code</span>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Visualize Execution"
              onClick={() => {
                sfx.playClick();
                onVisualize();
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#1B7D5F] hover:bg-[#16654D] text-xs font-sans font-semibold text-[#FFFFFF] transition-all shadow-xs disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin" />
                  <span>Tracer Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Visualize Execution</span>
                </>
              )}
            </button>
          )}

          {/* Export Menu */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={showExport}
              aria-label="Export Visualization"
              onClick={() => {
                sfx.playClick();
                setShowExport(!showExport);
              }}
              className="p-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-[#4A4A4A] transition-all shadow-xs"
              title="Export visualization"
            >
              <Download className="w-4 h-4" />
            </button>

            {showExport && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExport(false)}
                />
                <div className="absolute right-0 mt-1.5 w-44 bg-[#FFFFFF] border border-[#E5E2DC] rounded-lg shadow-lg z-50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      onExportSvg();
                      setShowExport(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[#1F1F1F] hover:bg-[#F5F5F3] rounded"
                  >
                    Export SVG Diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onExportJson();
                      setShowExport(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-[#1F1F1F] hover:bg-[#F5F5F3] rounded"
                  >
                    Export Execution JSON
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Reset Workspace */}
          <button
            type="button"
            aria-label="Reset Code and Memory"
            onClick={() => {
              sfx.playClick();
              onReset();
            }}
            className="p-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-[#4A4A4A] transition-all shadow-xs"
            title="Reset code & memory"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
            aria-pressed={soundOn}
            onClick={toggleSound}
            className={`p-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] transition-all shadow-xs ${
              soundOn ? 'text-[#1B7D5F]' : 'text-[#595959]'
            }`}
            title={soundOn ? 'Sound effects enabled' : 'Mute sound effects'}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Help Button */}
          <button
            type="button"
            aria-label="How it works and documentation"
            onClick={() => {
              sfx.playClick();
              setShowHelp(true);
            }}
            className="p-1.5 rounded border border-[#E5E2DC] bg-[#FFFFFF] hover:bg-[#F5F5F3] text-[#4A4A4A] transition-all shadow-xs"
            title="How it works"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Guide Modal */}
      {showHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-guide-title"
          className="fixed inset-0 bg-[#000000]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#D4D0C8] rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E2DC]">
              <h2 id="modal-guide-title" className="font-serif font-bold text-lg text-[#1F1F1F]">
                How Code Tracer Works
              </h2>
              <button
                type="button"
                aria-label="Close guide modal"
                onClick={() => setShowHelp(false)}
                className="text-[#4A4A4A] hover:text-[#1F1F1F] font-mono text-sm px-2 py-0.5"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-[#4A4A4A] font-sans leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded bg-[#F0F7F4] text-[#1B7D5F] font-mono font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <p>
                  <strong>Code Execution:</strong> Your code is executed either locally with real runtime inspectors (Python sys.settrace / GDB for C/C++) or inside the browser's dry-run engine.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded bg-[#F0F7F4] text-[#1B7D5F] font-mono font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <p>
                  <strong>Execution Arrows (PythonTutor Standard):</strong>
                  <br />
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[#1B7D5F] bg-[#F0F7F4] px-1.5 py-0.5 rounded mr-1">
                    ➜ Green
                  </span>
                  indicates the line that has <em>just executed</em>.
                  <br />
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[#C4702E] bg-[#FDF5F0] px-1.5 py-0.5 rounded mr-1">
                    ➜ Amber
                  </span>
                  indicates the line that will execute <em>next</em>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded bg-[#F0F7F4] text-[#1B7D5F] font-mono font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <p>
                  <strong>Frames & Heap Objects:</strong> Local and global variables appear in their respective activation frames. Lists, objects, and structs live on the heap with real pointer arrows connecting them.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded bg-[#F0F7F4] text-[#1B7D5F] font-mono font-bold flex items-center justify-center shrink-0">
                  4
                </span>
                <p>
                  <strong>Debugger Controls:</strong> Use <kbd className="px-1 py-0.5 bg-[#F5F5F3] border border-[#D4D0C8] rounded font-mono">←</kbd> and <kbd className="px-1 py-0.5 bg-[#F5F5F3] border border-[#D4D0C8] rounded font-mono">→</kbd> keys to step through code, or press <kbd className="px-1 py-0.5 bg-[#F5F5F3] border border-[#D4D0C8] rounded font-mono">Space</kbd> to autoplay.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-1.5 rounded bg-[#1B7D5F] text-[#FFFFFF] text-xs font-semibold hover:bg-[#16654D] transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
