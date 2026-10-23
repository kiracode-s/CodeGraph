import React, { useMemo, useState, useEffect } from 'react';
import { 
  Activity, 
  Repeat, 
  GitFork, 
  ChevronRight,
  Sparkles,
  Table,
  Filter,
  CheckCircle2,
  ArrowDownRight,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';
import { StepState } from '../types';
import { sfx } from '../utils/audio';

interface FlowchartViewerProps {
  steps: StepState[];
  currentStepIndex: number;
  onSelectStep?: (index: number) => void;
}

interface IntelligentFlowNode {
  id: string;
  stepIndex: number;
  line: number;
  type: 'start' | 'process' | 'decision' | 'loop-condition' | 'call' | 'return' | 'end';
  label: string;
  detail: string;
  action: string;
  reason: string;
  memoryImpact: string;
  nextPrediction: string;
  changedVars: { name: string; val: any }[];
  isLoopBack?: boolean;
  iteration?: number;
  branchOutcome?: 'true' | 'false' | null;
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
  const [activeTab, setActiveTab] = useState<'flowchart' | 'thinking' | 'loopMatrix'>('flowchart');
  const [filterMilestonesOnly, setFilterMilestonesOnly] = useState<boolean>(false);

  const currentStep = steps[currentStepIndex];

  // Auto-scroll to active node
  useEffect(() => {
    if (activeTab === 'flowchart') {
      const activeEl = document.getElementById(`flow-node-${currentStepIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentStepIndex, activeTab]);

  // 1. Loop iteration analysis
  const { loopRecords, activeLoopIteration } = useMemo(() => {
    if (!steps || steps.length === 0) {
      return { loopRecords: [], activeLoopIteration: 1 };
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
      activeLoopIteration: currentIter
    };
  }, [steps, currentStepIndex]);

  // 2. Build Intelligent Flowchart Nodes with Reasoning & State Tracking
  const allNodes: IntelligentFlowNode[] = useMemo(() => {
    if (!steps || steps.length === 0) return [];

    const list: IntelligentFlowNode[] = [];

    // Start Node
    list.push({
      id: 'node-start',
      stepIndex: 0,
      line: steps[0]?.line || 1,
      type: 'start',
      label: 'PROGRAM START',
      detail: 'Initialize execution scope and runtime memory',
      action: 'Initialize Execution Environment',
      reason: 'Bootstraps global variables, imported modules, and runtime structures.',
      memoryImpact: 'Global frame initialized in call stack.',
      nextPrediction: 'Execute first statement.',
      changedVars: []
    });

    steps.forEach((step, idx) => {
      const isCall = step.event === 'call';
      const isReturn = step.event === 'return';
      const actionLower = (step.explanation?.action || '').toLowerCase();
      const reasonLower = (step.explanation?.reason || '').toLowerCase();
      const isLoop = actionLower.includes('loop') || actionLower.includes('for') || actionLower.includes('while');
      const isDecision = actionLower.includes('if') || actionLower.includes('branch') || actionLower.includes('condition');

      let type: IntelligentFlowNode['type'] = 'process';
      if (isCall) type = 'call';
      else if (isReturn) type = 'return';
      else if (isLoop) type = 'loop-condition';
      else if (isDecision) type = 'decision';

      // Track variable changes for this node
      const changed: { name: string; val: any }[] = [];
      const topFrame = step.callStack[step.callStack.length - 1];
      if (topFrame) {
        Object.entries(topFrame.variables).forEach(([k, v]) => {
          if (v.isUpdated) {
            changed.push({ name: k, val: v.value });
          }
        });
      }

      // Check loop back
      const prevStep = idx > 0 ? steps[idx - 1] : null;
      const isLoopBack = Boolean(prevStep && step.line <= prevStep.line && isLoop);

      // Determine branch outcome if decision
      let branchOutcome: 'true' | 'false' | null = null;
      if (isDecision) {
        if (reasonLower.includes('true') || actionLower.includes('entered') || actionLower.includes('true')) {
          branchOutcome = 'true';
        } else if (reasonLower.includes('false') || actionLower.includes('skipped') || actionLower.includes('else')) {
          branchOutcome = 'false';
        }
      }

      list.push({
        id: `node-${idx}`,
        stepIndex: idx,
        line: step.line,
        type,
        label: `Line ${step.line}: ${step.explanation?.action || 'Statement'}`,
        detail: step.explanation?.reason || `Execute line ${step.line}`,
        action: step.explanation?.action || `Execution step at line ${step.line}`,
        reason: step.explanation?.reason || 'Statement evaluated sequentially.',
        memoryImpact: step.explanation?.memoryImpact || (changed.length > 0 ? `Updated: ${changed.map(c => `${c.name}=${String(c.val)}`).join(', ')}` : 'No stack modification'),
        nextPrediction: step.explanation?.nextPrediction || 'Advance to next instruction in sequence.',
        changedVars: changed,
        isLoopBack,
        branchOutcome
      });
    });

    // End Node
    list.push({
      id: 'node-end',
      stepIndex: steps.length - 1,
      line: steps[steps.length - 1]?.line || 1,
      type: 'end',
      label: 'PROGRAM TERMINATION',
      detail: 'Execution halted successfully. Resources deallocated.',
      action: 'Process Terminated',
      reason: 'Reached end of code without unhandled exceptions.',
      memoryImpact: 'All call stack frames released.',
      nextPrediction: 'Execution completed.',
      changedVars: []
    });

    return list;
  }, [steps]);

  // Filter nodes if user only wants key milestones (decisions, loops, calls, mutations)
  const displayNodes = useMemo(() => {
    if (!filterMilestonesOnly) return allNodes;
    return allNodes.filter((n, idx) => {
      if (idx === 0 || idx === allNodes.length - 1) return true;
      if (n.stepIndex === currentStepIndex) return true;
      return n.type === 'decision' || n.type === 'loop-condition' || n.type === 'call' || n.type === 'return' || n.changedVars.length > 0;
    });
  }, [allNodes, filterMilestonesOnly, currentStepIndex]);

  if (!steps || steps.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#FBFBFA] border border-[#E5E2DC] rounded-lg text-[#8A8780] font-sans">
        <Activity className="w-8 h-8 mb-2 opacity-40 text-[#8A8780]" />
        <span className="text-xs font-semibold text-[#4A4A4A]">No control flow generated</span>
        <span className="text-[11px] text-[#A39E93] mt-1">
          Run or Visualize code to generate the intelligent control flow graph
        </span>
      </div>
    );
  }

  const activeNode = allNodes.find(n => n.stepIndex === currentStepIndex) || allNodes[1] || allNodes[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FFFFFF] border border-[#E5E2DC] rounded-lg overflow-hidden select-none">
      {/* 1. Header: View Switcher & AI Thinking Toggle */}
      <div className="px-4 py-2 bg-[#F5F5F3] border-b border-[#E5E2DC] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-sm text-[#1F1F1F] flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-[#007ACC]" />
            Control Flow & Thinking
          </span>
          {loopRecords.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FDF5F0] text-[#C4702E] border border-[#FAE6D8] font-semibold flex items-center gap-1">
              <Repeat className="w-3 h-3 text-[#C4702E]" />
              Loop #{activeLoopIteration}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Milestones filter toggle */}
          {activeTab === 'flowchart' && (
            <button
              onClick={() => setFilterMilestonesOnly(!filterMilestonesOnly)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-sans border transition-colors ${
                filterMilestonesOnly
                  ? 'bg-[#007ACC] text-[#FFFFFF] border-[#007ACC]'
                  : 'bg-[#FFFFFF] text-[#6B6B6B] border-[#D4D0C8] hover:bg-[#F5F5F3]'
              }`}
              title="Show only key decisions, loops, and variable changes"
            >
              <Filter className="w-3 h-3" />
              <span>Milestones Only</span>
            </button>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#FFFFFF] p-0.5 rounded border border-[#D4D0C8]">
            <button
              onClick={() => {
                sfx.playClick();
                setActiveTab('flowchart');
              }}
              className={`px-2.5 py-1 text-[11px] font-sans rounded transition-colors ${
                activeTab === 'flowchart' ? 'bg-[#007ACC] text-[#FFFFFF] font-semibold shadow-xs' : 'text-[#6B6B6B] hover:text-[#1F1F1F]'
              }`}
            >
              Flowchart
            </button>
            <button
              onClick={() => {
                sfx.playClick();
                setActiveTab('thinking');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-sans rounded transition-colors ${
                activeTab === 'thinking' ? 'bg-[#007ACC] text-[#FFFFFF] font-semibold shadow-xs' : 'text-[#6B6B6B] hover:text-[#1F1F1F]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#DCDCAA]" />
              <span>Thinking Logic</span>
            </button>
            {loopRecords.length > 0 && (
              <button
                onClick={() => {
                  sfx.playClick();
                  setActiveTab('loopMatrix');
                }}
                className={`px-2.5 py-1 text-[11px] font-sans rounded transition-colors ${
                  activeTab === 'loopMatrix' ? 'bg-[#007ACC] text-[#FFFFFF] font-semibold shadow-xs' : 'text-[#6B6B6B] hover:text-[#1F1F1F]'
                }`}
              >
                Loop Matrix
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Thinking Process Banner (Always visible summary of current step reasoning) */}
      <div className="px-4 py-2 bg-[#F9FAFB] border-b border-[#E5E2DC] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-2 h-2 rounded-full bg-[#007ACC] animate-pulse shrink-0" />
          <span className="font-semibold text-[#1F1F1F] font-mono text-[11px]">
            Step {currentStepIndex + 1}/{steps.length}:
          </span>
          <span className="text-[#4B5563] text-xs truncate">
            {activeNode.detail}
          </span>
        </div>
        {activeNode.changedVars.length > 0 && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {activeNode.changedVars.map(cv => (
              <span key={cv.name} className="px-1.5 py-0.5 rounded bg-[#EBF7F2] border border-[#D1EDE3] text-[#0F4D3A] font-mono text-[10px] font-semibold">
                {cv.name} = {String(cv.val)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. Main Views */}
      {activeTab === 'flowchart' ? (
        /* Visual Flowchart with Decision Diamonds & State Cards */
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center space-y-0 bg-[#FAFAFA]">
          {displayNodes.map((node, idx) => {
            const isCurrent = node.stepIndex === currentStepIndex;
            const isPast = node.stepIndex < currentStepIndex;
            const isDecision = node.type === 'decision';
            const isLoop = node.type === 'loop-condition';
            const isCall = node.type === 'call';
            const isReturn = node.type === 'return';

            return (
              <React.Fragment key={node.id}>
                {/* Node Container */}
                <div
                  id={`flow-node-${node.stepIndex}`}
                  onClick={() => {
                    if (onSelectStep && node.stepIndex >= 0) {
                      sfx.playClick();
                      onSelectStep(node.stepIndex);
                    }
                  }}
                  className={`relative max-w-md w-full p-3 rounded-lg border transition-all cursor-pointer font-sans shadow-xs ${
                    isCurrent
                      ? 'bg-[#FFFFFF] border-2 border-[#007ACC] shadow-md ring-2 ring-[#007ACC]/25 scale-102 z-10'
                      : isDecision
                      ? 'bg-[#FFFDF7] border-[#E8C468] hover:border-[#D4A325]'
                      : isLoop
                      ? 'bg-[#FDF9F5] border-[#E5A97D] hover:border-[#C4702E]'
                      : isPast
                      ? 'bg-[#FFFFFF] border-[#D4D0C8] text-[#1F1F1F] opacity-95'
                      : 'bg-[#F5F5F3] border-[#E5E2DC] text-[#8A8780] opacity-60'
                  }`}
                >
                  {/* Header Badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {node.type === 'start' && <span className="w-2.5 h-2.5 rounded-full bg-[#1B7D5F]" />}
                      {node.type === 'end' && <span className="w-2.5 h-2.5 rounded-full bg-[#C44545]" />}
                      {isDecision && <GitFork className="w-3.5 h-3.5 text-[#D4A325]" />}
                      {isLoop && <Repeat className="w-3.5 h-3.5 text-[#C4702E]" />}
                      {isCall && <Layers className="w-3.5 h-3.5 text-[#007ACC]" />}
                      {isReturn && <ArrowDownRight className="w-3.5 h-3.5 text-[#8A63D2]" />}
                      {node.type === 'process' && <span className="w-2 h-2 rounded-xs bg-[#6B6B6B]" />}

                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#6B6B6B]">
                        {isDecision ? 'DECISION / BRANCH' : isLoop ? 'LOOP ITERATION' : node.type} • Line {node.line}
                      </span>
                    </div>

                    {isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#EBF7F2] text-[#0F4D3A] border border-[#D1EDE3] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1B7D5F] animate-ping" />
                        Active Step
                      </span>
                    ) : node.branchOutcome ? (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        node.branchOutcome === 'true' ? 'bg-[#D1EDE3] text-[#0F4D3A]' : 'bg-[#FDE3E3] text-[#A33636]'
                      }`}>
                        Branch: {node.branchOutcome.toUpperCase()}
                      </span>
                    ) : null}
                  </div>

                  {/* Title & Explanation */}
                  <div className="text-xs font-semibold text-[#1F1F1F] font-mono mb-1 truncate">
                    {node.label}
                  </div>
                  <div className="text-[11px] text-[#6B6B6B] line-clamp-2 mb-1.5">
                    {node.detail}
                  </div>

                  {/* Variable Mutations Chips */}
                  {node.changedVars.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-[#F0EFE9]">
                      <span className="text-[10px] text-[#8A8780] font-sans">Mutation:</span>
                      {node.changedVars.map(cv => (
                        <span key={cv.name} className="px-1.5 py-0.2 rounded bg-[#EBF3FC] text-[#0062A3] font-mono text-[10px] font-medium border border-[#D0E2FB]">
                          {cv.name} ➜ {String(cv.val)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* SVG Arrow Connector */}
                {idx < displayNodes.length - 1 && (
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
                            fill={idx < currentStepIndex ? '#007ACC' : '#D4D0C8'}
                          />
                        </marker>
                      </defs>
                      <line
                        x1="16"
                        y1="0"
                        x2="16"
                        y2="24"
                        stroke={idx < currentStepIndex ? '#007ACC' : '#D4D0C8'}
                        strokeWidth={idx < currentStepIndex ? 2 : 1.5}
                        strokeDasharray={idx >= currentStepIndex ? '3 3' : undefined}
                        markerEnd={`url(#fc-arr-${idx})`}
                      />
                    </svg>

                    {node.isLoopBack && (
                      <div className="absolute right-8 top-1 text-[9px] font-mono text-[#C4702E] bg-[#FDF5F0] border border-[#FAE6D8] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>↺ Loop Recycle</span>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : activeTab === 'thinking' ? (
        /* Deep AI Thinking & Algorithmic Reasoning View */
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#FBFBFA]">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#EBF3FC] border border-[#B9D9FB] text-xs text-[#004B87]">
            <Sparkles className="w-4 h-4 text-[#007ACC] shrink-0" />
            <span>
              <strong>Algorithmic Thinking Engine:</strong> Explaining exact runtime intent, state mutations, and control logic for Step <strong>#{currentStepIndex + 1}</strong> (Line <strong>{activeNode.line}</strong>).
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Executive Intent */}
            <div className="p-4 rounded-lg border border-[#E5E2DC] bg-[#FFFFFF] shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1F1F1F] mb-2 uppercase tracking-wide">
                <Cpu className="w-4 h-4 text-[#007ACC]" />
                Executive Intent & Action
              </div>
              <p className="text-xs text-[#374151] leading-relaxed">
                {activeNode.action}
              </p>
              <div className="mt-3 p-2 rounded bg-[#F8F9FA] text-[11px] font-mono text-[#4B5563] border border-[#E5E7EB]">
                {activeNode.reason}
              </div>
            </div>

            {/* Box 2: Memory & Stack Impact */}
            <div className="p-4 rounded-lg border border-[#E5E2DC] bg-[#FFFFFF] shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1F1F1F] mb-2 uppercase tracking-wide">
                <Layers className="w-4 h-4 text-[#1B7D5F]" />
                Memory & Heap Mutation
              </div>
              <p className="text-xs text-[#374151] leading-relaxed">
                {activeNode.memoryImpact}
              </p>
              {activeNode.changedVars.length > 0 ? (
                <div className="mt-3 space-y-1">
                  {activeNode.changedVars.map(cv => (
                    <div key={cv.name} className="flex items-center justify-between px-2.5 py-1 rounded bg-[#EBF7F2] text-[#0F4D3A] font-mono text-xs border border-[#D1EDE3]">
                      <span>Variable <strong>{cv.name}</strong></span>
                      <span className="font-bold">{JSON.stringify(cv.val)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 p-2 rounded bg-[#F8F9FA] text-[11px] text-[#6B7280]">
                  No local stack variables modified in this step.
                </div>
              )}
            </div>

            {/* Box 3: Next Predictive Transition */}
            <div className="p-4 rounded-lg border border-[#E5E2DC] bg-[#FFFFFF] shadow-xs md:col-span-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1F1F1F] mb-2 uppercase tracking-wide">
                <TrendingUp className="w-4 h-4 text-[#C4702E]" />
                Predictive Next Transition
              </div>
              <p className="text-xs text-[#374151] leading-relaxed">
                {activeNode.nextPrediction}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Loop Matrix View */
        <div className="flex-1 p-5 overflow-auto space-y-4">
          <div className="text-[11px] font-sans text-[#6B6B6B] flex items-center justify-between">
            <span>Passes recorded across all loop cycles. Click any row to jump execution:</span>
            <span className="font-mono">{loopRecords.length} iterations</span>
          </div>

          <table className="w-full text-xs font-mono border-collapse bg-[#FFFFFF] border border-[#E5E2DC] rounded-lg overflow-hidden shadow-xs">
            <thead>
              <tr className="bg-[#F5F5F3] border-b border-[#E5E2DC] text-left text-[11px] text-[#6B6B6B]">
                <th className="py-2 px-3 font-semibold">Iteration</th>
                <th className="py-2 px-3 font-semibold">Step</th>
                <th className="py-2 px-3 font-semibold">Condition Test</th>
                <th className="py-2 px-3 font-semibold">Variable State Snapshot</th>
                <th className="py-2 px-3 font-semibold">Result</th>
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
                        ? 'bg-[#EBF3FC] font-bold text-[#004B87]'
                        : isPassed
                        ? 'hover:bg-[#FAFAF8] text-[#1F1F1F]'
                        : 'text-[#8A8780] hover:bg-[#FAFAF8]'
                    }`}
                  >
                    <td className="py-2 px-3 font-bold">
                      #{rec.iteration}
                    </td>
                    <td className="py-2 px-3 text-[#6B6B6B]">
                      Step {rec.stepIndex + 1}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        rec.conditionResult ? 'bg-[#D1EDE3] text-[#0F4D3A]' : 'bg-[#FDE3E3] text-[#A33636]'
                      }`}>
                        {rec.condition} ➜ {rec.conditionResult ? 'TRUE' : 'FALSE'}
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
                        <span className="text-[#007ACC] font-bold flex items-center gap-1 text-[10px]">
                          ● Current
                        </span>
                      ) : isPassed ? (
                        <span className="text-[#6B6B6B] text-[10px]">
                          Passed
                        </span>
                      ) : (
                        <span className="text-[#8A8780] text-[10px]">
                          Upcoming
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
