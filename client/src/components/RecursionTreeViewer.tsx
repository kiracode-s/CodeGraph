import React, { useMemo, useState } from 'react';
import { 
  GitBranch, 
  CornerDownRight, 
  CheckCircle2, 
  Layers, 
  ArrowDown, 
  ArrowUp, 
  Sparkles, 
  Clock, 
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { StackFrame, StepState } from '../types';
import { sfx } from '../utils/audio';

interface RecursionTreeViewerProps {
  steps: StepState[];
  currentStepIndex: number;
  callStack: StackFrame[];
  onSelectStep?: (index: number) => void;
}

export interface CallTreeNode {
  id: string;
  funcName: string;
  args: Record<string, any>;
  depth: number;
  startStep: number;
  endStep?: number;
  returnValue?: any;
  parentId?: string | null;
  children: CallTreeNode[];
}

export const RecursionTreeViewer: React.FC<RecursionTreeViewerProps> = ({
  steps,
  currentStepIndex,
  callStack,
  onSelectStep
}) => {
  const [viewMode, setViewMode] = useState<'tree' | 'stack'>('tree');
  const currentStep = steps[currentStepIndex];

  // 1. Build the full call tree by analyzing call and return events across steps
  const { rootNodes, allNodes, maxDepth, totalCalls, baseCaseCount } = useMemo(() => {
    if (!steps || steps.length === 0) {
      return { rootNodes: [], allNodes: [], maxDepth: 0, totalCalls: 0, baseCaseCount: 0 };
    }

    const roots: CallTreeNode[] = [];
    const nodeMap = new Map<string, CallTreeNode>();
    const stackTracker: CallTreeNode[] = [];
    let callCounter = 0;
    let maxD = 0;
    let baseCases = 0;

    steps.forEach((step, stepIdx) => {
      const topFrame = step.callStack[step.callStack.length - 1];
      if (!topFrame || topFrame.isGlobal) return;

      const frameName = topFrame.name.replace(/\(\)$/, '');
      const frameDepth = step.callStack.length - 1; // 1-indexed for functions
      if (frameDepth > maxD) maxD = frameDepth;

      if (step.event === 'call') {
        callCounter++;
        // Extract arguments from variables in topFrame
        const args: Record<string, any> = {};
        Object.entries(topFrame.variables).forEach(([k, v]) => {
          if (!k.startsWith('__')) args[k] = v.value;
        });

        const parentNode = stackTracker[stackTracker.length - 1] || null;
        const newNode: CallTreeNode = {
          id: `call_${callCounter}_${frameName}`,
          funcName: frameName,
          args,
          depth: frameDepth,
          startStep: stepIdx,
          parentId: parentNode ? parentNode.id : null,
          children: []
        };

        nodeMap.set(newNode.id, newNode);
        stackTracker.push(newNode);

        if (parentNode) {
          parentNode.children.push(newNode);
        } else {
          roots.push(newNode);
        }
      } else if (step.event === 'return') {
        const activeNode = stackTracker.pop();
        if (activeNode) {
          activeNode.endStep = stepIdx;
          activeNode.returnValue = step.returnValue || step.explanation.reason?.match(/Returned value: (.*)/)?.[1] || 'done';
          if (activeNode.children.length === 0) {
            baseCases++;
          }
        }
      }
    });

    // Fallback: If no explicit call/return events were recorded, reconstruct from callStack
    if (roots.length === 0 && callStack.length > 1) {
      callStack.forEach((frame, idx) => {
        if (frame.isGlobal) return;
        const args: Record<string, any> = {};
        Object.entries(frame.variables).forEach(([k, v]) => {
          if (!k.startsWith('__')) args[k] = v.value;
        });

        const node: CallTreeNode = {
          id: frame.id || `frame_${idx}`,
          funcName: frame.name.replace(/\(\)$/, ''),
          args,
          depth: idx,
          startStep: 0,
          children: []
        };
        roots.push(node);
        nodeMap.set(node.id, node);
      });
      maxD = roots.length;
      callCounter = roots.length;
    }

    return {
      rootNodes: roots,
      allNodes: Array.from(nodeMap.values()),
      maxDepth: maxD,
      totalCalls: callCounter,
      baseCaseCount: baseCases
    };
  }, [steps]);

  // Determine current recursion phase
  const currentDepth = Math.max(0, callStack.length - 1);
  const activeFrame = callStack[callStack.length - 1];
  const isReturnEvent = currentStep?.event === 'return';
  const isBaseCase = isReturnEvent && activeFrame && (!currentStep?.callStack || currentStep.callStack.length <= 2 || currentStep.explanation.action.toLowerCase().includes('base'));
  const isWinding = !isReturnEvent && currentStep?.event === 'call';

  // Recursive node renderer
  const renderTreeNode = (node: CallTreeNode) => {
    const isStarted = currentStepIndex >= node.startStep;
    const isEnded = node.endStep !== undefined && currentStepIndex >= node.endStep;
    const isActive = isStarted && !isEnded && currentStep?.callStack[currentStep.callStack.length - 1]?.name.includes(node.funcName);
    const isWaiting = isStarted && !isEnded && !isActive;

    let statusStyle = 'bg-[#FAFAF8] border-[#E5E2DC] text-[#8A8780] opacity-50';
    let badge = 'Pending';
    let badgeColor = 'bg-[#F5F5F3] text-[#8A8780] border-[#E5E2DC]';

    if (isActive) {
      statusStyle = 'bg-[#FFFFFF] border-2 border-[#1B7D5F] shadow-md ring-2 ring-[#1B7D5F]/20 scale-102 z-10';
      badge = 'Executing Now';
      badgeColor = 'bg-[#F0F7F4] text-[#1B7D5F] border-[#D1EDE3] font-bold';
    } else if (isWaiting) {
      statusStyle = 'bg-[#FFFFFF] border-[#C4702E] shadow-xs text-[#1F1F1F]';
      badge = 'Waiting for Subcall';
      badgeColor = 'bg-[#FDF5F0] text-[#C4702E] border-[#FAE6D8]';
    } else if (isEnded) {
      statusStyle = 'bg-[#FFFFFF] border-[#A3DACA] shadow-xs text-[#1F1F1F]';
      badge = `Returned ➜ ${node.returnValue || ''}`;
      badgeColor = 'bg-[#D1EDE3] text-[#0F4D3A] border-[#A3DACA] font-semibold';
    }

    const argPairs = Object.entries(node.args).map(([k, v]) => `${k} = ${v}`).join(', ');

    return (
      <div key={node.id} className="flex flex-col items-start my-1.5 w-full">
        <div
          onClick={() => {
            if (onSelectStep && node.startStep !== undefined) {
              sfx.playClick();
              onSelectStep(node.startStep);
            }
          }}
          className={`p-3 rounded-lg border transition-all cursor-pointer font-sans w-full max-w-md ${statusStyle}`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#1F1F1F]">
              <CornerDownRight className="w-3.5 h-3.5 text-[#1B7D5F]" />
              <span>{node.funcName}({argPairs})</span>
            </div>

            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {badge}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#6B6B6B] mt-1 pt-1 border-t border-[#F5F5F3]">
            <span>Depth #{node.depth}</span>
            {isEnded && (
              <span className="text-[#0F4D3A] font-semibold bg-[#F0F7F4] px-1.5 rounded">
                Return Value: {node.returnValue}
              </span>
            )}
            {!isEnded && isStarted && (
              <span className="text-[#C4702E]">
                Frame Active on Stack
              </span>
            )}
          </div>
        </div>

        {/* Child Call Nodes with connecting branch lines */}
        {node.children.length > 0 && (
          <div className="pl-6 ml-3 border-l-2 border-[#D4D0C8] space-y-2 mt-2 w-full">
            {node.children.map(child => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FBFBFA] border border-[#E5E2DC] rounded-lg overflow-hidden select-none">
      {/* 1. Header Bar: Recursion Phase & Depth Telemetry */}
      <div className="px-4 py-2.5 bg-[#F5F5F3] border-b border-[#E5E2DC] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-sm text-[#1F1F1F]">
            Recursion Call Tree
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#D4D0C8] text-[#1F1F1F] font-semibold">
            Depth: {currentDepth} of {maxDepth}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher: Tree vs Stack */}
          <div className="flex items-center bg-[#FFFFFF] p-0.5 rounded border border-[#D4D0C8]">
            <button
              onClick={() => {
                sfx.playClick();
                setViewMode('tree');
              }}
              className={`px-2 py-0.5 text-[11px] font-sans rounded transition-colors ${
                viewMode === 'tree' ? 'bg-[#F5F5F3] font-bold text-[#1F1F1F]' : 'text-[#6B6B6B]'
              }`}
            >
              Tree Graph
            </button>
            <button
              onClick={() => {
                sfx.playClick();
                setViewMode('stack');
              }}
              className={`px-2 py-0.5 text-[11px] font-sans rounded transition-colors ${
                viewMode === 'stack' ? 'bg-[#F5F5F3] font-bold text-[#1F1F1F]' : 'text-[#6B6B6B]'
              }`}
            >
              Stack Slices
            </button>
          </div>
        </div>
      </div>

      {/* 2. Educational Recursion Phase Banner */}
      <div className="px-4 py-2 bg-[#FFFFFF] border-b border-[#E5E2DC] flex items-center justify-between text-xs font-sans">
        <div className="flex items-center gap-2">
          {isReturnEvent ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#D1EDE3] text-[#0F4D3A] border border-[#A3DACA] font-medium">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Unwinding Phase (Ascent) — Returning values & popping frames</span>
            </div>
          ) : isBaseCase ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FAE6D8] text-[#823E11] border border-[#F4CBAF] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Base Case Reached — Recursion branches terminate here!</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F0F7F4] text-[#1B7D5F] border border-[#D1EDE3] font-medium">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Winding Phase (Descent) — Calling self, pushing new frames</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[#6B6B6B]">
          <span>Total Calls: <strong className="text-[#1F1F1F]">{totalCalls}</strong></span>
          <span>•</span>
          <span>Max Depth: <strong className="text-[#1F1F1F]">{maxDepth}</strong></span>
        </div>
      </div>

      {/* 3. Main Content: Dynamic Tree Graph or Stack Slices */}
      <div className="flex-1 p-5 overflow-auto">
        {rootNodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8A8780] font-sans">
            <GitBranch className="w-7 h-7 mb-2 text-[#8A8780] opacity-40" />
            <span className="text-xs font-semibold text-[#4A4A4A]">No recursive function calls detected</span>
            <span className="text-[11px] text-[#A39E93] mt-1 max-w-xs">
              Load 'Recursive Factorial' or 'Fibonacci Sequence' from the Examples dropdown to inspect recursion step-by-step
            </span>
          </div>
        ) : viewMode === 'tree' ? (
          /* Tree Graph View */
          <div className="space-y-2">
            <div className="text-[11px] font-sans text-[#6B6B6B] mb-3 flex items-center justify-between">
              <span>Click any invocation node to navigate the debugger to that step:</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#1B7D5F]" /> Active</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C4702E]" /> Waiting</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3DA385]" /> Returned</span>
              </div>
            </div>
            {rootNodes.map(root => renderTreeNode(root))}
          </div>
        ) : (
          /* Stack Slices View */
          <div className="space-y-3">
            <div className="text-[11px] font-sans text-[#6B6B6B] mb-2">
              Active Call Stack Frames (High Memory to Low Memory):
            </div>
            {callStack.slice().reverse().map((frame, idx) => {
              const isTop = idx === 0;
              return (
                <div
                  key={frame.id || idx}
                  className={`p-3 rounded-lg border font-mono text-xs transition-all ${
                    isTop
                      ? 'bg-[#FFFFFF] border-2 border-[#1B7D5F] shadow-sm'
                      : 'bg-[#FFFFFF] border-[#E5E2DC]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[#1F1F1F]">
                      {frame.name}
                    </span>
                    <span className="text-[10px] text-[#6B6B6B]">
                      Line {frame.line} • {isTop ? 'TOP FRAME' : `Depth #${callStack.length - 1 - idx}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1 border-t border-[#F5F5F3] text-[11px]">
                    {Object.entries(frame.variables).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-[#F5F5F3] text-[#4A4A4A]">
                        <strong>{k}</strong>: {String(v.value)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Bottom Unwinding Sequence Breadcrumb */}
      {rootNodes.length > 0 && (
        <div className="px-4 py-2 bg-[#F5F5F3] border-t border-[#E5E2DC] flex items-center justify-between text-[11px] font-mono text-[#4A4A4A] overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-sans font-bold text-[#1F1F1F]">Activation Chain:</span>
            {callStack.map((f, i) => (
              <React.Fragment key={f.id || i}>
                <span className={`px-1.5 py-0.5 rounded ${i === callStack.length - 1 ? 'bg-[#1B7D5F] text-[#FFFFFF] font-bold' : 'bg-[#FFFFFF] border border-[#D4D0C8]'}`}>
                  {f.name}
                </span>
                {i < callStack.length - 1 && <ChevronRight className="w-3 h-3 text-[#8A8780]" />}
              </React.Fragment>
            ))}
          </div>

          {currentStep?.returnValue && (
            <div className="shrink-0 ml-3 text-[#0F4D3A] font-bold bg-[#D1EDE3] px-2 py-0.5 rounded border border-[#A3DACA]">
              Returned: {currentStep.returnValue}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
