import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Navbar } from './components/Navbar';
import { CodeEditor } from './components/CodeEditor';
import { MemoryViewer } from './components/MemoryViewer';
import { DebuggerControls } from './components/DebuggerControls';
import { Language, ExecutionTrace, StepState } from './types';
import { CODE_TEMPLATES } from './templates';
import { DryRunEngine } from './tracers/dryRunEngine';
import { sfx } from './utils/audio';
import { downloadJsonTrace, exportElementSvg } from './utils/export';
import { Layers, Activity, GitBranch, Info, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

const FlowchartViewer = lazy(() => import('./components/FlowchartViewer').then(m => ({ default: m.FlowchartViewer })));
const RecursionTreeViewer = lazy(() => import('./components/RecursionTreeViewer').then(m => ({ default: m.RecursionTreeViewer })));
const InfoPanel = lazy(() => import('./components/InfoPanel').then(m => ({ default: m.InfoPanel })));

export const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('python');
  const [code, setCode] = useState<string>(CODE_TEMPLATES.python[0].code);
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'memory' | 'flowchart' | 'callstack' | 'info'>('memory');
  const [engineMode, setEngineMode] = useState<'backend' | 'browser'>('backend');
  const [isVisualizing, setIsVisualizing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'visualizing' | 'completed' | 'error'>('idle');
  const [isOutputCollapsed, setIsOutputCollapsed] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);
  // High-speed trace cache for 0ms re-execution
  const traceCache = useRef<Map<string, ExecutionTrace>>(new Map());

  // Switch language preset
  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    setCode(CODE_TEMPLATES[newLang][0].code);
    setIsVisualizing(false);
    setTrace(null);
    setCurrentStepIndex(0);
    setStatus('idle');
  };

  // Select a preset template
  const handleSelectTemplate = (newCode: string) => {
    setCode(newCode);
    setIsVisualizing(false);
    setTrace(null);
    setCurrentStepIndex(0);
    setStatus('idle');
  };

  // Reset workspace
  const handleReset = () => {
    setIsPlaying(false);
    setIsVisualizing(false);
    setTrace(null);
    setCurrentStepIndex(0);
    setStatus('idle');
  };

  // Run Visualization with Instant Cache & Fast Timeout Fallback
  const handleVisualize = async () => {
    setIsLoading(true);
    setStatus('running');

    const cacheKey = `${language}:${code}`;
    if (traceCache.current.has(cacheKey)) {
      const cached = traceCache.current.get(cacheKey)!;
      setTrace(cached);
      setCurrentStepIndex(0);
      setIsVisualizing(true);
      setStatus(cached.status === 'error' ? 'error' : 'visualizing');
      setIsLoading(false);
      sfx.playSuccess();
      return;
    }

    try {
      let executionResult: ExecutionTrace;

      if (engineMode === 'backend') {
        try {
          const apiBase = import.meta.env.VITE_API_URL || '';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s max backend wait

          const res = await fetch(`${apiBase}/api/visualize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language, code }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
          }
          executionResult = await res.json();
        } catch (fetchErr) {
          console.warn('[CodeTracer] Fast fallback to browser dry-run engine:', fetchErr);
          const localEngine = new DryRunEngine(language, code);
          executionResult = localEngine.run();
        }
      } else {
        const localEngine = new DryRunEngine(language, code);
        executionResult = localEngine.run();
      }

      // Save to memory cache for instant future lookups
      traceCache.current.set(cacheKey, executionResult);

      setTrace(executionResult);
      setCurrentStepIndex(0);
      setIsVisualizing(true);

      if (executionResult.status === 'error') {
        setStatus('error');
        sfx.playError();
      } else {
        setStatus('visualizing');
        sfx.playSuccess();
      }
    } catch (err: any) {
      console.error('Visualization error:', err);
      setStatus('error');
      sfx.playError();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRun = () => {
    handleVisualize();
  };

  // Stepping actions
  const handleNext = () => {
    if (!trace || !trace.steps || currentStepIndex >= trace.steps.length - 1) {
      setIsPlaying(false);
      setStatus('completed');
      return;
    }
    const nextIdx = currentStepIndex + 1;
    setCurrentStepIndex(nextIdx);
    sfx.playStep();

    if (nextIdx === trace.steps.length - 1) {
      setStatus('completed');
      import('canvas-confetti').then((m) => {
        m.default({
          particleCount: 30,
          spread: 60,
          origin: { y: 0.85 },
          colors: ['#007ACC', '#C4702E', '#3DA385']
        });
      });
    }
  };

  const handlePrev = () => {
    if (!trace || currentStepIndex <= 0) return;
    setCurrentStepIndex(currentStepIndex - 1);
    sfx.playStep();
    setStatus('visualizing');
  };

  const handleFirst = () => {
    setCurrentStepIndex(0);
    sfx.playClick();
    setStatus('visualizing');
  };

  const handleLast = () => {
    if (!trace || !trace.steps) return;
    setCurrentStepIndex(trace.steps.length - 1);
    sfx.playClick();
    setStatus('completed');
  };

  // Jump to Next Breakpoint for fast debugging through long loops
  const handleNextBreakpoint = () => {
    if (!trace?.steps) return;
    for (let i = currentStepIndex + 1; i < trace.steps.length; i++) {
      if (breakpoints.includes(trace.steps[i].line)) {
        setCurrentStepIndex(i);
        sfx.playStep();
        return;
      }
    }
    // If no more breakpoints, advance to last step
    setCurrentStepIndex(trace.steps.length - 1);
    sfx.playClick();
    setStatus('completed');
  };

  const handleToggleBreakpoint = (line: number) => {
    setBreakpoints((prev) =>
      prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]
    );
  };

  // Autoplay loop timer with Turbo 20x mode (25ms per step)
  useEffect(() => {
    if (isPlaying && trace?.steps) {
      const delay = speed >= 20 ? 25 : Math.max(70, Math.floor(1000 / speed));
      timerRef.current = window.setTimeout(() => {
        if (currentStepIndex < trace.steps.length - 1) {
          const nextIdx = currentStepIndex + 1;
          const nextStep = trace.steps[nextIdx];

          if (nextStep && breakpoints.includes(nextStep.line)) {
            setIsPlaying(false);
            setCurrentStepIndex(nextIdx);
            sfx.playClick();
            return;
          }

          setCurrentStepIndex(nextIdx);
          sfx.playStep();
        } else {
          setIsPlaying(false);
          setStatus('completed');
        }
      }, delay);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentStepIndex, trace, speed, breakpoints]);

  // Keyboard controls (Arrow keys, Space, and F-keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.code === 'Space' || e.key === 'F5') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight' || e.key === 'F10') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'Home') {
        e.preventDefault();
        handleFirst();
      } else if (e.code === 'End') {
        e.preventDefault();
        handleLast();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, trace]);

  // Current and next step states
  const currentStep: StepState | undefined = trace?.steps?.[currentStepIndex];
  const nextStep: StepState | undefined = trace?.steps?.[currentStepIndex + 1];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FBFBFA] text-[#1F1F1F] font-sans select-none antialiased">
      {/* 1. Header Navigation Bar */}
      <Navbar
        language={language}
        onLanguageChange={handleLanguageChange}
        onSelectTemplate={handleSelectTemplate}
        engineMode={engineMode}
        onToggleEngineMode={setEngineMode}
        onReset={handleReset}
        onExportSvg={() => exportElementSvg('visualization-center', `tutor_${language}_diagram`)}
        onExportJson={() => trace && downloadJsonTrace(trace)}
        isVisualizing={isVisualizing}
        onVisualize={handleVisualize}
        onToggleEdit={() => setIsVisualizing(false)}
        isLoading={isLoading}
      />

      {/* 2. Main 2-Panel Working Area (Side-by-Side on Desktop/Tablet) */}
      <main className="flex-1 flex flex-col md:flex-row gap-3 p-3 overflow-hidden min-h-0 bg-[#F5F5F3]">
        {/* Left Panel: Code Editor (40% width) */}
        <section aria-label="Code Editor" className="w-full md:w-[40%] lg:w-[38%] h-full min-h-0 flex flex-col shrink-0">
          <CodeEditor
            language={language}
            code={code}
            onChange={setCode}
            activeLine={currentStep?.line}
            nextLine={nextStep?.line}
            isVisualizing={isVisualizing}
            onVisualize={handleVisualize}
            onRun={handleRun}
            onToggleEdit={() => setIsVisualizing(false)}
            breakpoints={breakpoints}
            onToggleBreakpoint={handleToggleBreakpoint}
            isLoading={isLoading}
          />
        </section>

        {/* Right Panel: Visualization Center + Output (60% width) */}
        <section
          id="visualization-center"
          aria-label="Execution Visualization"
          className="w-full md:w-[60%] lg:w-[62%] h-full min-h-0 flex flex-col bg-[#FFFFFF] rounded-lg border border-[#E5E2DC] shadow-xs overflow-hidden"
        >
          {/* Visualization Tab Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#F5F5F3] border-b border-[#E5E2DC] shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Visualization Views">
              <button
                role="tab"
                aria-selected={activeTab === 'memory'}
                aria-label="Frames and Objects View"
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('memory');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium transition-colors ${
                  activeTab === 'memory'
                    ? 'bg-[#FFFFFF] text-[#1F1F1F] shadow-xs border border-[#D4D0C8] font-semibold'
                    : 'text-[#4A4A4A] hover:text-[#1F1F1F]'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#1B7D5F]" />
                <span>Frames & Objects</span>
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'flowchart'}
                aria-label="Flowchart and Loops View"
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('flowchart');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium transition-colors ${
                  activeTab === 'flowchart'
                    ? 'bg-[#FFFFFF] text-[#1F1F1F] shadow-xs border border-[#D4D0C8] font-semibold'
                    : 'text-[#4A4A4A] hover:text-[#1F1F1F]'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-[#C4702E]" />
                <span>Flowchart & Loops</span>
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'callstack'}
                aria-label="Recursion Tree View"
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('callstack');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium transition-colors ${
                  activeTab === 'callstack'
                    ? 'bg-[#FFFFFF] text-[#1F1F1F] shadow-xs border border-[#D4D0C8] font-semibold'
                    : 'text-[#4A4A4A] hover:text-[#1F1F1F]'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5 text-[#569CD6]" />
                <span>Recursion Tree</span>
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'info'}
                aria-label="Step Guide View"
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('info');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium transition-colors ${
                  activeTab === 'info'
                    ? 'bg-[#FFFFFF] text-[#1F1F1F] shadow-xs border border-[#D4D0C8] font-semibold'
                    : 'text-[#4A4A4A] hover:text-[#1F1F1F]'
                }`}
              >
                <Info className="w-3.5 h-3.5 text-[#4A4A4A]" />
                <span>Step Guide</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-[#4A4A4A] shrink-0 ml-2">
              {trace ? `${trace.totalSteps} steps` : 'Ready'}
            </div>
          </div>

          {/* Visualization Content Switcher */}
          <div className="flex-1 overflow-hidden p-2 min-h-0">
            <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-[#555555]">Loading module...</div>}>
              {activeTab === 'memory' && (
                <MemoryViewer
                  language={language}
                  callStack={currentStep?.callStack || []}
                  heap={currentStep?.heap || {}}
                  changedVariables={currentStep?.changedVariables || []}
                  activeStep={currentStepIndex}
                />
              )}
              {activeTab === 'flowchart' && (
                <FlowchartViewer
                  steps={trace?.steps || []}
                  currentStepIndex={currentStepIndex}
                  onSelectStep={(idx) => {
                    setCurrentStepIndex(idx);
                    setStatus('visualizing');
                  }}
                />
              )}
              {activeTab === 'callstack' && (
                <RecursionTreeViewer
                  steps={trace?.steps || []}
                  currentStepIndex={currentStepIndex}
                  callStack={currentStep?.callStack || []}
                  onSelectStep={(idx) => {
                    setCurrentStepIndex(idx);
                    setStatus('visualizing');
                  }}
                />
              )}
              {activeTab === 'info' && (
                <InfoPanel
                  currentStep={currentStep}
                  nextStep={nextStep}
                  totalSteps={trace?.totalSteps || 0}
                  stdout={currentStep?.stdout || trace?.stdout || ''}
                  error={trace?.error}
                  status={status}
                />
              )}
            </Suspense>
          </div>

          {/* PythonTutor Style Docked Program Output Console at bottom */}
          <div className="border-t border-[#E5E2DC] bg-[#FFFFFF] shrink-0">
            <button
              type="button"
              onClick={() => setIsOutputCollapsed(!isOutputCollapsed)}
              aria-expanded={!isOutputCollapsed}
              aria-label="Toggle Program Output Console"
              className="w-full text-left px-3 py-1.5 bg-[#F5F5F3] flex items-center justify-between text-xs font-sans cursor-pointer hover:bg-[#EAE8E2]/60 select-none border-0"
            >
              <div className="flex items-center gap-1.5 font-medium text-[#1F1F1F]">
                <Terminal className="w-3.5 h-3.5 text-[#4A4A4A]" />
                <span>Program Output (stdout)</span>
                {currentStep?.stdout && (
                  <span className="w-2 h-2 rounded-full bg-[#1B7D5F]" />
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#4A4A4A]">
                {currentStep?.explanation?.action && (
                  <span className="font-mono text-[10px] bg-[#E8E7E5] px-1.5 py-0.2 rounded truncate max-w-[240px]">
                    {currentStep.explanation.action}
                  </span>
                )}
                {isOutputCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {!isOutputCollapsed && (
              <div className="h-20 bg-[#1F1F1F] p-2.5 font-mono text-xs text-[#D4D0C8] overflow-auto whitespace-pre">
                {currentStep?.stdout || trace?.stdout ? (
                  <span className="text-[#A3DACA]">{currentStep?.stdout || trace?.stdout}</span>
                ) : (
                  <span className="text-[#A3A3A3] italic font-sans text-[11px]">
                    (No output produced yet)
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 3. Bottom Debugger Controls Bar */}
      <DebuggerControls
        currentStep={currentStepIndex}
        totalSteps={trace?.totalSteps || 0}
        isPlaying={isPlaying}
        speed={speed}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onNext={handleNext}
        onPrev={handlePrev}
        onFirst={handleFirst}
        onLast={handleLast}
        onRestart={() => {
          setCurrentStepIndex(0);
          setStatus('visualizing');
        }}
        onStepChange={(newStep) => {
          setCurrentStepIndex(newStep);
          setStatus('visualizing');
        }}
        onSpeedChange={setSpeed}
        onNextBreakpoint={handleNextBreakpoint}
      />
    </div>
  );
};
export default App;
