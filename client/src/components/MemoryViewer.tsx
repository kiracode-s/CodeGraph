import React, { useState, useEffect, useRef } from 'react';
import { Layers, Database, Hash, ArrowUpRight } from 'lucide-react';
import { StackFrame, HeapObject, VariableValue, Language } from '../types';

interface MemoryViewerProps {
  language: Language;
  callStack: StackFrame[];
  heap: Record<string, HeapObject>;
  changedVariables?: string[];
  activeStep: number;
}

interface ArrowConnection {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  active: boolean;
}

export const MemoryViewer: React.FC<MemoryViewerProps> = ({
  language,
  callStack,
  heap,
  changedVariables = [],
  activeStep
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<ArrowConnection[]>([]);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);

  const heapKeys = Object.keys(heap);

  // Recalculate pointer arrows whenever stack, heap, or step changes
  useEffect(() => {
    const updateArrows = () => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newArrows: ArrowConnection[] = [];

      callStack.forEach((frame) => {
        Object.entries(frame.variables).forEach(([varName, varVal]) => {
          const targetKey = varVal.pointsTo || (varVal.isReference ? String(varVal.value) : null);
          if (!targetKey) return;

          // Check if target exists in heap
          const targetObj = heap[targetKey] || Object.values(heap).find(h => h.id === targetKey);
          const targetIdKey = targetObj ? (heap[targetKey] ? targetKey : targetObj.id) : targetKey;

          const anchorEl = document.getElementById(`anchor-${frame.id || 'frame'}-${varName}`);
          const targetEl = document.getElementById(`heap-obj-${targetIdKey}`);

          if (anchorEl && targetEl) {
            const anchorRect = anchorEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();

            const fromX = anchorRect.left + anchorRect.width / 2 - containerRect.left + containerRef.current.scrollLeft;
            const fromY = anchorRect.top + anchorRect.height / 2 - containerRect.top + containerRef.current.scrollTop;
            const toX = targetRect.left - containerRect.left + containerRef.current.scrollLeft;
            const toY = targetRect.top + Math.min(30, targetRect.height / 2) - containerRect.top + containerRef.current.scrollTop;

            newArrows.push({
              id: `${frame.id}-${varName}->${targetIdKey}`,
              fromX,
              fromY,
              toX,
              toY,
              active: hoveredTarget === targetIdKey || hoveredTarget === varName
            });
          }
        });
      });

      // Also connect pointers inside heap objects (e.g. linked list next pointers)
      Object.entries(heap).forEach(([srcKey, heapObj]) => {
        if (heapObj.fields) {
          Object.entries(heapObj.fields).forEach(([fieldName, fieldVal]) => {
            const nextTarget = fieldVal.pointsTo || (fieldVal.isReference ? String(fieldVal.value) : null);
            if (!nextTarget || nextTarget === 'NULL' || nextTarget === 'null' || nextTarget === '0x0') return;

            const anchorEl = document.getElementById(`heap-field-anchor-${srcKey}-${fieldName}`);
            const targetEl = document.getElementById(`heap-obj-${nextTarget}`);

            if (anchorEl && targetEl) {
              const anchorRect = anchorEl.getBoundingClientRect();
              const targetRect = targetEl.getBoundingClientRect();

              const fromX = anchorRect.left + anchorRect.width / 2 - containerRect.left + containerRef.current.scrollLeft;
              const fromY = anchorRect.top + anchorRect.height / 2 - containerRect.top + containerRef.current.scrollTop;
              const toX = targetRect.left - containerRect.left + containerRef.current.scrollLeft;
              const toY = targetRect.top + 20 - containerRect.top + containerRef.current.scrollTop;

              newArrows.push({
                id: `heap-${srcKey}-${fieldName}->${nextTarget}`,
                fromX,
                fromY,
                toX,
                toY,
                active: hoveredTarget === nextTarget || hoveredTarget === srcKey
              });
            }
          });
        }
      });

      setArrows(newArrows);
    };

    const timer = setTimeout(updateArrows, 60);
    window.addEventListener('resize', updateArrows);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateArrows);
    };
  }, [callStack, heap, activeStep, hoveredTarget]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex flex-col md:flex-row gap-6 h-full p-4 overflow-auto bg-[#FBFBFA] rounded-lg border border-[#E5E2DC]"
    >
      {/* SVG Canvas for Dynamic Pointer Arrows */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        style={{ minWidth: '100%', minHeight: '100%' }}
      >
        <defs>
          <marker
            id="tutor-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#1B7D5F" />
          </marker>
          <marker
            id="tutor-arrow-hover"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#C4702E" />
          </marker>
        </defs>

        {arrows.map((arr) => {
          const dx = arr.toX - arr.fromX;
          const curvature = Math.max(30, Math.min(100, Math.abs(dx) * 0.45));
          const cx1 = arr.fromX + curvature;
          const cy1 = arr.fromY;
          const cx2 = arr.toX - curvature;
          const cy2 = arr.toY;
          const pathD = `M ${arr.fromX} ${arr.fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${arr.toX} ${arr.toY}`;

          return (
            <path
              key={arr.id}
              d={pathD}
              fill="none"
              stroke={arr.active ? '#C4702E' : '#1B7D5F'}
              strokeWidth={arr.active ? 2.5 : 1.75}
              strokeDasharray={arr.active ? undefined : 'none'}
              markerEnd={arr.active ? 'url(#tutor-arrow-hover)' : 'url(#tutor-arrow)'}
              className="transition-all duration-150"
            />
          );
        })}
      </svg>

      {/* LEFT COLUMN: Stack Frames */}
      <div className="flex-1 flex flex-col min-w-[280px] z-10">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E5E2DC]">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-[#1F1F1F]">
              Frames
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-[#F5F5F3] text-[#4A4A4A] border border-[#D4D0C8]">
              {callStack.length} active
            </span>
          </div>
          <span className="text-[11px] font-sans text-[#6B6B6B]">
            Call Stack Activation
          </span>
        </div>

        {callStack.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8A8780] border border-dashed border-[#D4D0C8] rounded-lg">
            <Layers className="w-6 h-6 mb-2 text-[#8A8780] opacity-50" />
            <span className="text-xs font-sans">No active stack frames</span>
            <span className="text-[11px] text-[#A39E93] mt-1">
              Start the execution to view variable scopes
            </span>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1">
            {callStack.map((frame, frameIdx) => {
              const isGlobal = frame.isGlobal || frameIdx === 0;
              const isCurrent = frameIdx === callStack.length - 1;
              const varEntries = Object.entries(frame.variables);

              return (
                <div
                  key={frame.id || frameIdx}
                  className={`frame-card shadow-xs transition-all ${
                    isCurrent ? 'ring-1 ring-[#1B7D5F]/30' : ''
                  }`}
                >
                  {/* Frame Header */}
                  <div
                    className={`frame-header flex items-center justify-between ${
                      isGlobal ? 'frame-header-global' : 'frame-header-local'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs">
                        {frame.name || (isGlobal ? 'Global frame' : 'frame')}
                      </span>
                      {isGlobal ? (
                        <span className="text-[9px] uppercase px-1 rounded bg-[#D4D0C8] text-[#1F1F1F]">
                          Global
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase px-1 rounded bg-[#A3DACA] text-[#0F4D3A]">
                          Local
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-[#6B6B6B]">
                      Line {frame.line}
                    </span>
                  </div>

                  {/* Variables Table (PythonTutor style) */}
                  <div className="p-2 bg-[#FFFFFF]">
                    {varEntries.length === 0 ? (
                      <div className="text-[11px] font-mono text-[#8A8780] italic py-1 px-1">
                        (No local variables)
                      </div>
                    ) : (
                      <table className="w-full text-xs font-mono border-collapse">
                        <tbody>
                          {varEntries.map(([varName, varVal]) => {
                            const isUpdated = changedVariables.includes(varName) || varVal.isUpdated;
                            const isPointer =
                              Boolean(varVal.pointsTo) ||
                              varVal.isReference ||
                              varVal.type.includes('*') ||
                              varVal.type === 'pointer' ||
                              (typeof varVal.value === 'string' && (varVal.value.startsWith('0x') || varVal.value.startsWith('heap_')));

                            const targetAddr = varVal.pointsTo || (isPointer ? String(varVal.value) : null);

                            return (
                              <tr
                                key={varName}
                                onMouseEnter={() => targetAddr && setHoveredTarget(targetAddr)}
                                onMouseLeave={() => setHoveredTarget(null)}
                                className={`border-b border-[#F5F5F3] last:border-b-0 transition-colors ${
                                  isUpdated ? 'bg-[#F0F7F4]' : 'hover:bg-[#FAFAF8]'
                                }`}
                              >
                                {/* Variable Name */}
                                <td className="py-1.5 px-2 font-semibold text-[#1F1F1F] w-1/3">
                                  {varName}
                                </td>

                                {/* Variable Value or Pointer Anchor */}
                                <td className="py-1.5 px-2 text-right">
                                  {isPointer && targetAddr && targetAddr !== 'NULL' && targetAddr !== 'null' && targetAddr !== '0x0' ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <span className="text-[10px] text-[#6B6B6B] font-mono">
                                        ref
                                      </span>
                                      {/* Pointer Anchor Dot for SVG line */}
                                      <div
                                        id={`anchor-${frame.id || 'frame'}-${varName}`}
                                        className="w-3.5 h-3.5 rounded-full bg-[#1B7D5F] flex items-center justify-center text-[8px] text-[#FFFFFF] shadow-xs cursor-pointer hover:scale-110 transition-transform"
                                        title={`Points to object: ${targetAddr}`}
                                      >
                                        ●
                                      </div>
                                    </div>
                                  ) : isPointer ? (
                                    <span className="text-[#C44545] font-semibold text-[11px]">
                                      NULL
                                    </span>
                                  ) : (
                                    <span
                                      className={`px-1.5 py-0.5 rounded ${
                                        isUpdated
                                          ? 'bg-[#D1EDE3] text-[#0F4D3A] font-bold'
                                          : 'text-[#1F1F1F]'
                                      }`}
                                    >
                                      {typeof varVal.value === 'object'
                                        ? JSON.stringify(varVal.value)
                                        : String(varVal.value)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Heap Objects */}
      <div className="flex-1 flex flex-col min-w-[280px] z-10">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E5E2DC]">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-[#1F1F1F]">
              Objects
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-[#F5F5F3] text-[#4A4A4A] border border-[#D4D0C8]">
              {heapKeys.length} on heap
            </span>
          </div>
          <span className="text-[11px] font-sans text-[#6B6B6B]">
            Dynamic Heap Memory
          </span>
        </div>

        {heapKeys.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8A8780] border border-dashed border-[#D4D0C8] rounded-lg">
            <Database className="w-6 h-6 mb-2 text-[#8A8780] opacity-50" />
            <span className="text-xs font-sans">Heap memory is empty</span>
            <span className="text-[11px] text-[#A39E93] mt-1">
              Lists, arrays, objects, and structs will appear here
            </span>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1">
            {heapKeys.map((addr) => {
              const obj = heap[addr];
              const isHovered = hoveredTarget === addr || hoveredTarget === obj.id;
              const isList = obj.type === 'list' || obj.type === 'array';
              const items = obj.items || [];
              const fields = obj.fields || {};

              return (
                <div
                  key={addr}
                  id={`heap-obj-${addr}`}
                  onMouseEnter={() => setHoveredTarget(addr)}
                  onMouseLeave={() => setHoveredTarget(null)}
                  className={`heap-card shadow-xs transition-all ${
                    isHovered ? 'ring-2 ring-[#C4702E] border-[#C4702E]' : 'border-[#E5E2DC]'
                  }`}
                >
                  {/* Object Header */}
                  <div className="px-3 py-1.5 bg-[#F5F5F3] border-b border-[#E5E2DC] flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[#1F1F1F]">
                      {obj.typeName || obj.type}
                    </span>
                    <span className="text-[10px] text-[#6B6B6B]">
                      {addr}
                    </span>
                  </div>

                  {/* List / Array: Grid Display (PythonTutor style) */}
                  {isList && (
                    <div className="p-3 bg-[#FFFFFF] overflow-x-auto">
                      <div className="inline-flex border border-[#D4D0C8] rounded">
                        {items.length === 0 ? (
                          <div className="px-3 py-1.5 text-xs text-[#8A8780] font-mono">
                            [ empty list ]
                          </div>
                        ) : (
                          items.map((item, idx) => (
                            <div
                              key={idx}
                              className="border-r border-[#D4D0C8] last:border-r-0 flex flex-col text-center font-mono"
                            >
                              {/* Index Header */}
                              <div className="px-3 py-1 text-[10px] bg-[#F5F5F3] text-[#6B6B6B] border-b border-[#D4D0C8]">
                                {idx}
                              </div>
                              {/* Value Cell */}
                              <div className="px-3 py-2 text-xs font-semibold text-[#1F1F1F] bg-[#FFFFFF]">
                                {String(item.value)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dict / Struct / Object / Instance: Key-Value Table */}
                  {!isList && (
                    <div className="p-2 bg-[#FFFFFF]">
                      <table className="w-full text-xs font-mono border-collapse">
                        <tbody>
                          {Object.entries(fields).map(([fieldName, fieldVal]) => {
                            const isRef = fieldVal.isReference || Boolean(fieldVal.pointsTo);
                            const nextTarget = fieldVal.pointsTo || (isRef ? String(fieldVal.value) : null);

                            return (
                              <tr
                                key={fieldName}
                                className="border-b border-[#F5F5F3] last:border-b-0 hover:bg-[#FAFAF8]"
                              >
                                <td className="py-1.5 px-2 font-medium text-[#4A4A4A] w-1/3">
                                  {fieldName}
                                </td>
                                <td className="py-1.5 px-2 text-right">
                                  {isRef && nextTarget && nextTarget !== 'NULL' && nextTarget !== 'null' && nextTarget !== '0x0' ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <span className="text-[10px] text-[#6B6B6B]">ref</span>
                                      <div
                                        id={`heap-field-anchor-${addr}-${fieldName}`}
                                        className="w-3.5 h-3.5 rounded-full bg-[#1B7D5F] flex items-center justify-center text-[8px] text-[#FFFFFF] shadow-xs cursor-pointer"
                                        title={`Points to: ${nextTarget}`}
                                      >
                                        ●
                                      </div>
                                    </div>
                                  ) : isRef ? (
                                    <span className="text-[#C44545] font-semibold text-[11px]">
                                      NULL
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-[#1F1F1F]">
                                      {String(fieldVal.value)}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};
