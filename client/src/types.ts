export type Language = 'python' | 'c' | 'cpp' | 'java' | 'javascript';

export interface VariableValue {
  name: string;
  type: string;
  value: any;
  address?: string;
  pointsTo?: string | null;
  isUpdated?: boolean;
  isReference?: boolean;
}

export interface StackFrame {
  id: string;
  name: string;
  line: number;
  isGlobal?: boolean;
  variables: Record<string, VariableValue>;
}

export interface HeapObject {
  id: string;
  type: 'list' | 'dict' | 'array' | 'struct' | 'object' | 'instance' | 'tuple' | 'set';
  typeName: string;
  items?: VariableValue[];
  fields?: Record<string, VariableValue>;
  refCount?: number;
}

export interface StepExplanation {
  action: string;
  reason: string;
  memoryImpact: string;
  nextPrediction: string;
}

export interface LoopIterationInfo {
  loopType: 'for' | 'while' | 'do-while';
  line: number;
  iteration: number;
  condition: string;
  conditionResult: boolean;
  loopVariables: Record<string, any>;
}

export interface RecursionCallInfo {
  callId: string;
  parentId?: string | null;
  funcName: string;
  args: Record<string, any>;
  depth: number;
  startStep: number;
  returnStep?: number;
  returnValue?: any;
  status: 'active' | 'waiting' | 'returned';
}

export interface StepState {
  step: number;
  line: number;
  nextLine?: number;
  event: 'line' | 'call' | 'return' | 'exception' | 'stdout';
  callStack: StackFrame[];
  heap: Record<string, HeapObject>;
  stdout: string;
  stdoutDelta?: string;
  changedVariables?: string[];
  explanation: StepExplanation;
  returnValue?: any;
  loopInfo?: LoopIterationInfo;
  recursionInfo?: RecursionCallInfo;
}

export interface ExecutionError {
  type: string;
  message: string;
  line: number;
  explanation: string;
  suggestion: string;
}

export interface ExecutionTrace {
  language: Language;
  status: 'success' | 'error' | 'timeout';
  totalSteps: number;
  stdout: string;
  error?: ExecutionError | null;
  steps: StepState[];
}

export interface CodeTemplate {
  name: string;
  description: string;
  language: Language;
  code: string;
}
