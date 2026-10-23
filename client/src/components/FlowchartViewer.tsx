import React, { useMemo, useState, useEffect } from 'react';
import { 
  Activity, 
  Play, 
  ArrowDown, 
  RotateCcw, 
  CheckCircle2, 
  Repeat, 
  GitFork, 
  ChevronRight,
  TrendingUp,
  Table,
  Layers
} from 'lucide-react';
import { StepState } from '../types';
import { sfx } from '../utils/audio';

interface FlowchartViewerProps {
  steps: StepState[];
  currentStepIndex: number;
  onSelectStep?: (index: number) => void;
}

interface FlowNode {
  id: string;
  stepIndex: number;
  line: number;
  type: 'start' | 'process' | 'decision' | 'loop-condition' | 'loop-body' | 'call' | 'return' | 'end';
  label: string;
  detail: string;
  isLoopBack?: boolean;
  loopTargetStep?: number;
  iteration?: number;
}

interface LoopIterationRecord {
  iteration: number;
  stepIndex: number;
  line: number;
  condition: string;
  conditionResult: boolean;
  variables: Record<string, any>;
  outputDelta: string;
}

export const FlowchartViewer: React.FC<FlowchartViewerProps> = ({
  steps,
  currentStepIndex,
  onSelectStep
}) => {
  const [viewMode, setViewMode] = useState<'graph' | 'loopMatrix'>('graph');
  const currentStep = steps[currentStepIndex];
  const activeLine = currentStep?.line ?? -1;

  // Auto-scroll to active node on step transition in graph view
  useEffect(() => {
    if (viewMode === 'graph') {
      const activeEl = document.getElementById(`flow-node-${currentStepIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentStepIndex, viewMode]);

  // 1. Analyze loops across execution trace
  const { loopRecords, loopCount, activeLoopIteration } = useMemo(() => {
    if (!steps || steps.length === 0) {
      return { loopRecords: [], loopCount: 0, activeLoopIteration: 1 };
    }

    const records: LoopIterationRecord[] = [];
    const loopLineOccurrences = new Map<number, number>();
    let currentIter = 1;

    steps.forEach((step, idx) => {
      const actionLower = (step.explanation?.action || '').toLowerCase();
      const isLoopLine = actionLower.includes('loop') || actionLower.includes('for (') || actionLower.includes('while (');
      
      if (isLoopLine || step.loopInfo) {
        const count = (loopLineOccurrences.get(step.line) || 0) + 1;
        loopLineOccurrences.set(step.line, count);

        // Capture variable snapshot
        const vars: Record<string, any> = {};
        const topFrame = step.callStack[step.callStack.length - 1];
        if (topFrame) {
          Object.entries(topFrame.variables).forEach(([k, v]) => {
            if (!k.startsWith('__')) vars[k] = v.value;
          });
        }

        const cond = step.loopInfo?.condition || (step.explanation?.reason?.match(/condition: (.*)/)?.[1]) || `line ${step.line}`;
        const condRes = step.loopInfo ? step.loopInfo.conditionResult : !actionLower.includes('finished') && !actionLower.includes('terminat');

        records.push({
          iteration: step.loopInfo?.iteration || count,
          stepIndex: idx,
          line: step.line,
          condition: cond,
          conditionResult: condRes,
          variables: vars,
          outputDelta: step.stdoutDelta || ''
        });

        if (idx <= currentStepIndex) {
          currentIter = step.loopInfo?.iteration || count;
        }
      }
    });

    return {
      loopRecords: records,
      loopCount: records.length,
      activeLoopIteration: currentIter
    };
  }, [steps, currentStepIndex]);

  // 2. Build sequential & branching execution graph from steps
  const nodes: FlowNode[] = useMemo(() => {
    if (!steps || steps.length === 0) return [];

    const list: FlowNode[] = [];
    // Start node
    list.push({
      id: 'node-start',
      stepIndex: 0,
      line: steps[0]?.line || 1,
      type: 'start',
      label: 'PROGRAM START',
      detail: 'Initialize global execution environment'
    });

    steps.forEach((step, idx) => {
      const isCall = step.event === 'call';
      const isReturn = step.event === 'return';
      const actionLower = (step.explanation?.action || '').toLowerCase();
      const isLoop = actionLower.includes('loop') || actionLower.includes('for') || actionLower.includes('while');
      const isCondition = actionLower.includes('if') || actionLower.includes('branch');

      let type: FlowNode['type'] = 'process';
      if (isCall) type = 'call';
      else if (isReturn) type = 'return';
      else if (isLoop) type = 'loop-condition';
      else if (isCondition) type = 'decision';

      // Check if this step loops back to an earlier statement
      const prevStep = idx > 0 ? steps[idx - 1] : null;
      const isLoopBack = prevStep && step.line <= prevStep.line && isLoop;

      list.push({
        id: `node-${idx}`,
        stepIndex: idx,
        line: step.line,
        type,
        label: `Line ${step.line}: ${step.explanation?.action || 'Statement'}`,
        detail: step.explanation?.reason || `Execute line ${step.line}`,
        isLoopBack: Boolean(isLoopBack)
      });
    });

    // End node
    list.push({
      id: 'node-end',
      stepIndex: steps.length - 1,
      line: steps[steps.length - 1]?.line || 1,
      type: 'end',
      label: 'TERMINATION',
      detail: 'Program execution completed'
    });

    return list;
  }, [steps]);

  if (!steps || steps.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FBFBFA] border border-[#E5E2DC] rounded-lg text-[#8A8780] font-sans">
        <Activity className="w-8 h-8 mb-2 opacity-40 text-[#8A8780]" />
        <span className="text-xs font-semibold text-[#4A4A4A]">No control flow generated</span>
        <span className="text-[11px] text-[#A39E93] mt-1">
          Click 'Visualize Execution' to generate the dynamic control flow graph
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBFBFA] border border-[#E5E2DC] rounded-lg overflow-hidden select-none">
      {/* 1. Header Bar: Control Flow & Loop Mode Switcher */}
      <div className="px-4 py-2.5 bg-[#F5F5F3] border-b border-[#E5E2DC] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-sm text-[#1F1F1F]">
            Control Flow & Loops
          </span>
          {loopRecords.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FDF5F0] text-[#C4702E] border border-[#FAE6D8] font-semibold flex items-center gap-1">
              <Repeat className="w-3 h-3 text-[#C4702E]" />
              Loop Detected ({loopRecords.length} iterations)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {loopRecords.length > 0 && (
            <div className="flex items-center bg-[#FFFFFF] p-0.5 rounded border border-[#D4D0C8]">
              <button
                onClick={() => {
                  sfx.playClick();
                  setViewMode('graph');
                }}
                className={`px-2 py-0.5 text-[11px] font-sans rounded transition-colors ${
                  viewMode === 'graph' ? 'bg-[#F5F5F3] font-bold text-[#1F1F1F]' : 'text-[#6B6B6B]'
                }`}
              >
                Flowchart Graph
              </button>
              <button
                onClick={() => {
                  sfx.playClick();
                  setViewMode('loopMatrix');
                }}
                className={`px-2 py-0.5 text-[11px] font-sans rounded transition-colors ${
                  viewMode === 'loopMatrix' ? 'bg-[#F5F5F3] font-bold text-[#1F1F1F]' : 'text-[#6B6B6B]'
                }`}
              >
                Loop Iterations
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Educational Loop Progress Indicator (when loop is detected) */}
      {loopRecords.length > 0 && (
        <div className="px-4 py-2 bg-[#FFFFFF] border-b border-[#E5E2DC] flex items-center justify-between text-xs font-sans">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#1F1F1F] flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-[#1B7D5F]" />
              Active Loop Iteration: <strong className="text-[#1B7D5F] font-mono">#{activeLoopIteration}</strong>
            </span>
            <div className="w-32 h-1.5 bg-[#E5E2DC] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1B7D5F] transition-all duration-200"
                style={{ width: `${Math.min(100, (activeLoopIteration / Math.max(1, loopRecords.length)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#6B6B6B]">
            {activeLoopIteration >= loopRecords.length ? 'Loop Completed' : `Step through to inspect turn #${activeLoopIteration}`}
          </div>
        </div>
      )}

      {/* 3. Main View Switcher: Flowchart Graph vs Loop Iteration Matrix */}
      {viewMode === 'graph' ? (
        /* Flowchart Graph with Real SVG Loop-Back Connectors */
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center space-y-0">
          {nodes.map((node, idx) => {
            const isCurrent = node.stepIndex === currentStepIndex;
            const isPast = node.stepIndex < currentStepIndex;
            const isLoopType = node.type === 'loop-condition';
            const isDecision = node.type === 'decision';

            return (
              <React.Fragment key={node.id}>
                {/* Node Card */}
                <div
                  id={`flow-node-${node.stepIndex}`}
                  onClick={() => {
                    if (onSelectStep && node.stepIndex >= 0) {
                      sfx.playClick();
                      onSelectStep(node.stepIndex);
                    }
                  }}
                  className={`relative max-w-sm w-full p-3 rounded-lg border transition-all cursor-pointer font-sans shadow-xs ${
                    isCurrent
                      ? 'bg-[#FFFFFF] border-2 border-[#1B7D5F] shadow-md ring-2 ring-[#1B7D5F]/20 scale-102 z-10'
                      : isLoopType
                      ? 'bg-[#FFFFFF] border-[#C4702E] shadow-xs'
                      : isPast
                      ? 'bg-[#FFFFFF] border-[#D4D0C8] text-[#1F1F1F] opacity-90'
                      : 'bg-[#F5F5F3] border-[#E5E2DC] text-[#8A8780] opacity-60'
                  }`}
                >
                  {/* Node Status Badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {node.type === 'start' && <span className="w-2 h-2 rounded-full bg-[#1B7D5F]" />}
                      {node.type === 'loop-condition' && <Repeat className="w-3 h-3 text-[#C4702E]" />}
                      {node.type === 'decision' && <span className="w-2 h-2 rotate-45 bg-[#C4702E]" />}
                      {node.type === 'call' && <span className="w-2 h-2 rounded-xs bg-[#569CD6]" />}
                      {node.type === 'return' && <span className="w-2 h-2 rounded-full bg-[#A35A24]" />}
                      {node.type === 'end' && <span className="w-2 h-2 rounded-full bg-[#C44545]" />}
                      {node.type === 'process' && <span className="w-2 h-2 rounded-xs bg-[#6B6B6B]" />}

                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#6B6B6B]">
                        {node.type === 'loop-condition' ? 'LOOP PREDICATE' : node.type} • Line {node.line}
                      </span>
                    </div>

                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#F0F7F4] text-[#1B7D5F] border border-[#D1EDE3] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1B7D5F] animate-ping" />
                        Executing
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-[#1F1F1F] font-mono mb-1 truncate">
                    {node.label}
                  </div>
                  <div className="text-[11px] text-[#6B6B6B] line-clamp-2">
                    {node.detail}
                  </div>
                </div>

                {/* Connecting SVG Path Line & Loop-Back Visualizer */}
                {idx < nodes.length - 1 && (
                  <div className="flex flex-col items-center h-8 w-full relative">
                    <svg className="w-8 h-8 pointer-events-none" viewBox="0 0 32 32">
                      <defs>
                        <marker
                          id={`fc-arr-${idx}`}
                          viewBox="0 0 10 10"
                          refX="6"
                          refY="5"
                          markerWidth="5"
                          markerHeight="5"
                          orient="auto"
                        >
                          <path
                            d="M 0 1 L 9 5 L 0 9 z"
                            fill={idx < currentStepIndex ? '#1B7D5F' : '#D4D0C8'}
                          />
                        </marker>
                      </defs>
                      <line
                        x1="16"
                        y1="0"
                        x2="16"
                        y2="24"
                        stroke={idx < currentStepIndex ? '#1B7D5F' : '#D4D0C8'}
                        strokeWidth={idx < currentStepIndex ? 2 : 1.5}
                        strokeDasharray={idx >= currentStepIndex ? '3 3' : undefined}
                        markerEnd={`url(#fc-arr-${idx})`}
                      />
                    </svg>

                    {/* Loop Back Indicator if returning to loop condition */}
                    {node.isLoopBack && (
                      <div className="absolute right-12 top-1 text-[9px] font-mono text-[#C4702E] bg-[#FDF5F0] border border-[#FAE6D8] px-1.5 py-0.2 rounded-full flex items-center gap-1">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>↺ Loop Back</span>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        /* Loop Iteration Matrix Table View */
        <div className="flex-1 p-5 overflow-auto space-y-4">
          <div className="text-[11px] font-sans text-[#6B6B6B] flex items-center justify-between">
            <span>Every pass through the loop is recorded below. Click any row to jump the debugger to that pass:</span>
            <span className="font-mono">{loopRecords.length} passes total</span>
          </div>

          <table className="w-full text-xs font-mono border-collapse bg-[#FFFFFF] border border-[#E5E2DC] rounded-lg overflow-hidden shadow-xs">
            <thead>
              <tr className="bg-[#F5F5F3] border-b border-[#E5E2DC] text-left text-[11px] text-[#6B6B6B]">
                <th className="py-2 px-3 font-semibold">Pass #</th>
                <th className="py-2 px-3 font-semibold">Step</th>
                <th className="py-2 px-3 font-semibold">Condition Test</th>
                <th className="py-2 px-3 font-semibold">Variables State</th>
                <th className="py-2 px-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loopRecords.map((rec, rIdx) => {
                const isActiveRow = rec.iteration === activeLoopIteration;
                const isPassed = rec.stepIndex <= currentStepIndex;

                return (
                  <tr
                    key={rIdx}
                    onClick={() => {
                      if (onSelectStep) {
                        sfx.playClick();
                        onSelectStep(rec.stepIndex);
                      }
                    }}
                    className={`border-b border-[#F5F5F3] last:border-b-0 cursor-pointer transition-colors ${
                      isActiveRow
                        ? 'bg-[#F0F7F4] font-bold text-[#0F4D3A]'
                        : isPassed
                        ? 'hover:bg-[#FAFAF8] text-[#1F1F1F]'
                        : 'text-[#8A8780] hover:bg-[#FAFAF8]'
                    }`}
                  >
                    <td className="py-2 px-3 font-bold">
                      Iteration #{rec.iteration}
                    </td>
                    <td className="py-2 px-3 text-[#6B6B6B]">
                      Step {rec.stepIndex + 1}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        rec.conditionResult ? 'bg-[#D1EDE3] text-[#0F4D3A]' : 'bg-[#FDE3E3] text-[#A33636]'
                      }`}>
                        {rec.condition} ➜ {rec.conditionResult ? 'TRUE' : 'FALSE (EXIT)'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(rec.variables).map(([k, v]) => (
                          <span key={k} className="px-1.5 py-0.2 rounded bg-[#F5F5F3] text-[10px] text-[#4A4A4A]">
                            <strong>{k}</strong> = {String(v)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {isActiveRow ? (
                        <span className="text-[#1B7D5F] font-bold flex items-center gap-1 text-[10px]">
                          ● Current
                        </span>
                      ) : isPassed ? (
                        <span className="text-[#6B6B6B] text-[10px]">
                          Completed
                        </span>
                      ) : (
                        <span className="text-[#8A8780] text-[10px]">
                          Future
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
