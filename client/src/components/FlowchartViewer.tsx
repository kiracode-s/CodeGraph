import React, { useMemo } from 'react';
import { Activity, Play, ArrowDown, GitBranch, CornerDownRight, CheckCircle2 } from 'lucide-react';
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
  type: 'start' | 'process' | 'decision' | 'call' | 'return' | 'end';
  label: string;
  detail: string;
  nextStepIndex?: number;
  branchTrueStepIndex?: number;
  branchFalseStepIndex?: number;
}

export const FlowchartViewer: React.FC<FlowchartViewerProps> = ({
  steps,
  currentStepIndex,
  onSelectStep
}) => {
  const currentStep = steps[currentStepIndex];
  const activeLine = currentStep?.line ?? -1;

  // Auto-scroll to active node on step transition
  React.useEffect(() => {
    const activeEl = document.getElementById(`flow-node-${currentStepIndex}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStepIndex]);

  // Build sequential & branching execution graph from steps
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

    // Group steps by significant transitions
    steps.forEach((step, idx) => {
      const isCall = step.event === 'call';
      const isReturn = step.event === 'return';
      const actionLower = (step.explanation.action || '').toLowerCase();
      const isCondition = actionLower.includes('if') || actionLower.includes('condition') || actionLower.includes('while') || actionLower.includes('for');

      let type: FlowNode['type'] = 'process';
      if (isCall) type = 'call';
      else if (isReturn) type = 'return';
      else if (isCondition) type = 'decision';

      list.push({
        id: `node-${idx}`,
        stepIndex: idx,
        line: step.line,
        type,
        label: `Line ${step.line}: ${step.explanation.action || 'Statement'}`,
        detail: step.explanation.reason || `Execute line ${step.line}`
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
        <span className="text-xs font-semibold text-[#4A4A4A]">No flowchart generated</span>
        <span className="text-[11px] text-[#A39E93] mt-1">
          Click 'Visualize Execution' to generate the dynamic control flow graph
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBFBFA] border border-[#E5E2DC] rounded-lg overflow-hidden select-none">
      {/* Flowchart Header */}
      <div className="px-4 py-2.5 bg-[#F5F5F3] border-b border-[#E5E2DC] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-sm text-[#1F1F1F]">
            Control Flow Graph
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#D4D0C8] text-[#4A4A4A]">
            {nodes.length} nodes
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#6B6B6B] font-sans">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1B7D5F]" /> Active Block
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#D4D0C8]" /> Visited
          </span>
        </div>
      </div>

      {/* Connected Flowchart Canvas */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center space-y-0">
        {nodes.map((node, idx) => {
          const isCurrent = node.stepIndex === currentStepIndex;
          const isPast = node.stepIndex < currentStepIndex;
          const isFuture = node.stepIndex > currentStepIndex;

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
                    : isPast
                    ? 'bg-[#FFFFFF] border-[#D4D0C8] text-[#1F1F1F] opacity-90'
                    : 'bg-[#F5F5F3] border-[#E5E2DC] text-[#8A8780] opacity-60'
                }`}
              >
                {/* Node Status Badge */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {node.type === 'start' && (
                      <span className="w-2 h-2 rounded-full bg-[#1B7D5F]" />
                    )}
                    {node.type === 'decision' && (
                      <span className="w-2 h-2 rotate-45 bg-[#C4702E]" />
                    )}
                    {node.type === 'call' && (
                      <span className="w-2 h-2 rounded-xs bg-[#569CD6]" />
                    )}
                    {node.type === 'return' && (
                      <span className="w-2 h-2 rounded-full bg-[#A35A24]" />
                    )}
                    {node.type === 'end' && (
                      <span className="w-2 h-2 rounded-full bg-[#C44545]" />
                    )}
                    {node.type === 'process' && (
                      <span className="w-2 h-2 rounded-xs bg-[#6B6B6B]" />
                    )}

                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#6B6B6B]">
                      {node.type} • Line {node.line}
                    </span>
                  </div>

                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#F0F7F4] text-[#1B7D5F] border border-[#D1EDE3] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1B7D5F] animate-ping" />
                      Executing
                    </span>
                  )}
                </div>

                {/* Node Label & Description */}
                <div className="text-xs font-semibold text-[#1F1F1F] font-mono mb-1 truncate">
                  {node.label}
                </div>
                <div className="text-[11px] text-[#6B6B6B] line-clamp-2">
                  {node.detail}
                </div>
              </div>

              {/* Connecting SVG Path Line with Arrowhead to Next Node */}
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
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
