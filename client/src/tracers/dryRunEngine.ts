import { ExecutionTrace, Language, StackFrame, HeapObject, StepState, VariableValue } from '../types';

export class DryRunEngine {
  language: Language;
  code: string;
  maxSteps: number;
  steps: StepState[] = [];
  stepCount = 0;
  stdout = '';
  error: any = null;

  nextStackAddr = 0x7ffd5100;
  nextHeapAddr = 0x602010;

  callStack: StackFrame[] = [];
  heap: Record<string, HeapObject> = {};
  lines: string[];

  constructor(language: Language, code: string, options: { maxSteps?: number } = {}) {
    this.language = language;
    this.code = code;
    this.maxSteps = options.maxSteps || 800;
    this.lines = code.split('\n');
  }

  allocStackAddr(size = 4): string {
    const addr = '0x' + this.nextStackAddr.toString(16);
    this.nextStackAddr += size;
    return addr;
  }

  allocHeapAddr(size = 16): string {
    const addr = '0x' + this.nextHeapAddr.toString(16);
    this.nextHeapAddr += size;
    return addr;
  }

  pushFrame(name: string, line: number, isGlobal = false): StackFrame {
    const frameId = `frame_${this.callStack.length}_${name}`;
    const frame: StackFrame = {
      id: frameId,
      name: isGlobal ? 'Global Frame' : `${name}()`,
      line: line,
      isGlobal: isGlobal,
      variables: {}
    };
    this.callStack.push(frame);
    return frame;
  }

  popFrame(): StackFrame | undefined {
    return this.callStack.pop();
  }

  currentFrame(): StackFrame | undefined {
    return this.callStack[this.callStack.length - 1];
  }

  setVariable(name: string, type: string, value: any, address: string | null = null, pointsTo: string | null = null) {
    const frame = this.currentFrame() || this.callStack[0];
    if (!frame) return;

    const existing = frame.variables[name];
    const varAddr = address || (existing ? existing.address : this.allocStackAddr(4));

    frame.variables[name] = {
      name,
      type,
      value,
      address: varAddr,
      pointsTo: pointsTo || (type.includes('*') || type === 'reference' ? String(value) : null),
      isUpdated: true
    };
  }

  getVariable(name: string): VariableValue | null {
    for (let i = this.callStack.length - 1; i >= 0; i--) {
      if (this.callStack[i].variables[name] !== undefined) {
        return this.callStack[i].variables[name];
      }
    }
    return null;
  }

  recordStep(line: number, event: 'line' | 'call' | 'return' | 'exception' | 'stdout' = 'line', explanation: any = null, changedVars: string[] = []) {
    if (this.stepCount >= this.maxSteps) {
      throw new Error(`Step limit exceeded (${this.maxSteps} steps). Possible infinite loop detected!`);
    }

    this.stepCount++;
    const currentLineText = this.lines[line - 1] ? this.lines[line - 1].trim() : '';

    const clonedStack: StackFrame[] = this.callStack.map(f => ({
      id: f.id,
      name: f.name,
      line: f.line,
      isGlobal: f.isGlobal,
      variables: Object.fromEntries(
        Object.entries(f.variables).map(([k, v]) => [k, { ...v }])
      )
    }));

    const clonedHeap = JSON.parse(JSON.stringify(this.heap));

    for (const f of this.callStack) {
      for (const k in f.variables) {
        f.variables[k].isUpdated = false;
      }
    }

    const defaultExpl = {
      action: explanation?.action || `Executing: ${currentLineText || `line ${line}`}`,
      reason: explanation?.reason || 'Sequential execution of statement',
      memoryImpact: explanation?.memoryImpact || 'Evaluating expression and updating variables',
      nextPrediction: explanation?.nextPrediction || 'Proceeding to next statement'
    };

    this.steps.push({
      step: this.stepCount,
      line: line,
      event: event,
      callStack: clonedStack,
      heap: clonedHeap,
      stdout: this.stdout,
      changedVariables: changedVars,
      explanation: defaultExpl
    });
  }

  run(): ExecutionTrace {
    try {
      if (this.language === 'c' || this.language === 'cpp') {
        this.simulateC();
      } else if (this.language === 'java') {
        this.simulateJava();
      } else if (this.language === 'javascript') {
        this.simulateJS();
      } else {
        this.simulateGeneric();
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      const isInfinite = msg.includes('Step limit exceeded');
      this.error = {
        type: isInfinite ? 'InfiniteLoopError' : 'RuntimeError',
        message: msg,
        line: this.steps.length > 0 ? this.steps[this.steps.length - 1].line : 1,
        explanation: isInfinite
          ? 'Execution halted: Step counter exceeded limit. Check loop condition termination.'
          : `Runtime error encountered: ${msg}`,
        suggestion: isInfinite
          ? 'Ensure your loop variable progresses toward the exit condition.'
          : 'Check variable bounds, null pointer dereferences, or syntax.'
      };
    }

    return {
      language: this.language,
      status: this.error ? 'error' : 'success',
      totalSteps: this.steps.length,
      stdout: this.stdout,
      error: this.error,
      steps: this.steps
    };
  }

  simulateC() {
    this.pushFrame('Global Frame', 1, true);
    const lines = this.lines;

    let mainStartLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('main') && lines[i].includes('(') && lines[i].includes('{')) {
        mainStartLine = i + 1;
        break;
      }
    }

    if (mainStartLine === -1) {
      this.executeBlock(0, lines.length - 1);
      return;
    }

    this.recordStep(mainStartLine, 'call', {
      action: 'Program Entry Point: main() called',
      reason: 'OS initializes process execution',
      memoryImpact: 'Stack activation record allocated for main()',
      nextPrediction: 'Executing statements inside main()'
    });

    this.pushFrame('main', mainStartLine);
    this.executeBlock(mainStartLine, lines.length - 1, 'main');
  }

  simulateJava() {
    this.pushFrame('Global Frame', 1, true);
    const lines = this.lines;

    let mainStartLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('public static void main') || (lines[i].includes('void main') && lines[i].includes('{'))) {
        mainStartLine = i + 1;
        break;
      }
    }

    if (mainStartLine === -1) {
      this.executeBlock(0, lines.length - 1);
      return;
    }

    this.recordStep(mainStartLine, 'call', {
      action: 'JVM Invocation: public static void main(String[] args)',
      reason: 'JVM loads entry point',
      memoryImpact: 'Stack frame allocated for main thread',
      nextPrediction: 'Executing statements in main()'
    });

    this.pushFrame('main', mainStartLine);
    this.setVariable('args', 'String[]', 'String[0]', null, null);
    this.executeBlock(mainStartLine, lines.length - 1, 'main');
  }

  simulateJS() {
    this.pushFrame('Global Scope', 1, true);
    this.executeBlock(0, this.lines.length - 1, 'global');
  }

  simulateGeneric() {
    this.pushFrame('Global Frame', 1, true);
    this.executeBlock(0, this.lines.length - 1);
  }

  executeBlock(startLineIdx: number, endLineIdx: number, _currentFuncName = 'block') {
    const lines = this.lines;
    let i = startLineIdx;

    while (i <= endLineIdx && i < lines.length) {
      if (this.stepCount >= this.maxSteps) break;

      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      const lineNum = i + 1;

      if (
        trimmed === '' ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('#') ||
        trimmed.startsWith('/*') ||
        (trimmed.startsWith('*') && !trimmed.match(/^\*[a-zA-Z_]/))
      ) {
        i++;
        continue;
      }

      if (trimmed === '}' || trimmed === '};') {
        i++;
        continue;
      }

      // Print statements
      if (
        trimmed.includes('printf') ||
        trimmed.includes('std::cout') ||
        trimmed.includes('cout <<') ||
        trimmed.includes('System.out.print') ||
        trimmed.includes('console.log') ||
        trimmed.startsWith('print(')
      ) {
        const textToPrint = this.evaluatePrintStatement(trimmed);
        this.stdout += textToPrint;
        this.recordStep(lineNum, 'stdout', {
          action: `Output printed: "${textToPrint.trim()}"`,
          reason: 'Standard I/O stream write operation',
          memoryImpact: 'Buffered to stdout stream terminal',
          nextPrediction: 'Continuing to next line'
        });
        i++;
        continue;
      }

      // Dynamic memory: malloc, new
      if (
        (trimmed.includes('malloc(') || trimmed.includes('new ')) &&
        (trimmed.includes('=') || trimmed.includes('*'))
      ) {
        this.handleMemoryAllocation(trimmed, lineNum);
        i++;
        continue;
      }

      // Free / delete
      if (trimmed.startsWith('free(') || trimmed.startsWith('delete ')) {
        this.handleFreeMemory(trimmed, lineNum);
        i++;
        continue;
      }

      // Pointers: &x or *p = ...
      if (
        (this.language === 'c' || this.language === 'cpp') &&
        (trimmed.includes('&') || trimmed.startsWith('*') || (trimmed.includes('*') && trimmed.includes('=')))
      ) {
        this.handlePointerOperation(trimmed, lineNum);
        i++;
        continue;
      }

      // Arrays
      if (
        (trimmed.includes('[') && trimmed.includes(']') && trimmed.includes('=')) ||
        (trimmed.includes('=') && trimmed.includes('[') && trimmed.includes(']'))
      ) {
        this.handleArrayDeclaration(trimmed, lineNum);
        i++;
        continue;
      }

      // Object instantiation
      if (
        (trimmed.includes('new ') && trimmed.includes('(')) ||
        ((trimmed.startsWith('let ') || trimmed.startsWith('const ') || trimmed.startsWith('var ')) && trimmed.includes('{'))
      ) {
        this.handleObjectInstantiation(trimmed, lineNum);
        i++;
        continue;
      }

      // For loop
      if (trimmed.startsWith('for (') || trimmed.startsWith('for(')) {
        i = this.handleForLoop(i, lineNum);
        continue;
      }

      // While loop
      if (trimmed.startsWith('while (') || trimmed.startsWith('while(')) {
        i = this.handleWhileLoop(i, lineNum);
        continue;
      }

      // If / Else
      if (trimmed.startsWith('if (') || trimmed.startsWith('if(')) {
        i = this.handleIfElse(i, lineNum);
        continue;
      }

      // Recursive / function call
      const callMatch = trimmed.match(/([a-zA-Z_]\w*)\s*=\s*([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
      if (callMatch && !['printf', 'scanf', 'malloc', 'sizeof'].includes(callMatch[2])) {
        const destVar = callMatch[1];
        const targetFunc = callMatch[2];
        const argsStr = callMatch[3];
        this.simulateFunctionCall(destVar, targetFunc, argsStr, lineNum);
        i++;
        continue;
      }

      // Assignment
      this.handleGeneralAssignment(trimmed, lineNum);
      i++;
    }
  }

  evaluatePrintStatement(trimmed: string): string {
    if (trimmed.startsWith('print(')) {
      const match = trimmed.match(/print\((.*)\)/);
      if (match) return this.resolveExpr(match[1]) + '\n';
    }
    if (trimmed.includes('console.log')) {
      const match = trimmed.match(/console\.log\((.*)\)/);
      if (match) return this.resolveExpr(match[1]) + '\n';
    }
    if (trimmed.includes('System.out.println')) {
      const match = trimmed.match(/System\.out\.println\((.*)\)/);
      if (match) return this.resolveExpr(match[1]) + '\n';
    }
    if (trimmed.includes('System.out.print')) {
      const match = trimmed.match(/System\.out\.print\((.*)\)/);
      if (match) return this.resolveExpr(match[1]);
    }
    if (trimmed.includes('printf')) {
      const match = trimmed.match(/printf\s*\(\s*["'](.*?)["'](?:\s*,\s*(.*))?\s*\)/);
      if (match) {
        let fmt = match[1].replace(/\\n/g, '\n');
        if (match[2]) {
          const args = match[2].split(',').map(a => this.resolveExpr(a.trim()));
          let argIdx = 0;
          fmt = fmt.replace(/%[difs]/g, () => (args[argIdx++] !== undefined ? args[argIdx - 1] : ''));
        }
        return fmt;
      }
    }
    if (trimmed.includes('cout')) {
      const parts = trimmed.split('<<').slice(1);
      let res = '';
      for (const p of parts) {
        const cleaned = p.replace(';', '').trim();
        if (cleaned === 'endl' || cleaned === 'std::endl') {
          res += '\n';
        } else if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          res += cleaned.slice(1, -1);
        } else {
          res += this.resolveExpr(cleaned);
        }
      }
      return res;
    }
    return 'Output\n';
  }

  resolveExpr(expr: string): string {
    if (!expr) return '';
    expr = expr.trim();
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }
    const variable = this.getVariable(expr);
    if (variable) {
      return String(variable.value);
    }
    try {
      const evaluated = Function(`"use strict"; return (${expr})`)();
      return String(evaluated);
    } catch {
      return expr;
    }
  }

  handlePointerOperation(trimmed: string, lineNum: number) {
    if (trimmed.startsWith('*')) {
      const match = trimmed.match(/^\*([a-zA-Z_]\w*)\s*=\s*([^;]+);?$/);
      if (match) {
        const ptrName = match[1];
        const valExpr = match[2].trim();
        const ptrVar = this.getVariable(ptrName);

        if (!ptrVar || ptrVar.value === '0x0' || ptrVar.value === 'NULL' || ptrVar.value === 'nullptr') {
          throw new Error(`Segmentation Fault (SIGSEGV): Attempted to dereference NULL pointer '${ptrName}' at line ${lineNum}`);
        }

        const targetAddr = ptrVar.pointsTo || ptrVar.value;
        const resolvedVal = this.resolveExpr(valExpr);
        const finalVal = isNaN(Number(resolvedVal)) ? resolvedVal : Number(resolvedVal);

        let targetVarName = 'target';
        for (const frame of this.callStack) {
          for (const [k, v] of Object.entries(frame.variables)) {
            if (v.address === targetAddr) {
              v.value = finalVal;
              v.isUpdated = true;
              targetVarName = k;
              break;
            }
          }
        }

        if (this.heap[targetAddr]) {
          this.heap[targetAddr].fields = { ...this.heap[targetAddr].fields, value: { name: 'value', type: 'int', value: finalVal } };
        }

        this.recordStep(lineNum, 'line', {
          action: `Dereferenced pointer '*${ptrName}' and assigned value ${finalVal}`,
          reason: `Pointer '${ptrName}' holds address ${targetAddr}. Value at that memory cell was updated.`,
          memoryImpact: `Memory address ${targetAddr} (${targetVarName}) now contains value ${finalVal}`,
          nextPrediction: 'Next instruction'
        }, [targetVarName]);
        return;
      }
    }

    const match = trimmed.match(/(?:int|float|double|char|void)\s*\*+\s*([a-zA-Z_]\w*)\s*=\s*&([a-zA-Z_]\w*);?/);
    if (match) {
      const ptrName = match[1];
      const targetName = match[2];
      const targetVar = this.getVariable(targetName);
      const targetAddr = targetVar ? targetVar.address : this.allocStackAddr(4);

      if (!targetVar) {
        this.setVariable(targetName, 'int', 0, targetAddr);
      }

      this.setVariable(ptrName, 'int*', targetAddr, null, targetAddr);
      this.recordStep(lineNum, 'line', {
        action: `Pointer initialization: '${ptrName}' assigned address of '${targetName}' (&${targetName})`,
        reason: `The address-of operator '&' extracts memory location ${targetAddr}`,
        memoryImpact: `Stack variable '${ptrName}' stores hex address ${targetAddr}, pointing directly to '${targetName}'`,
        nextPrediction: 'Proceeding to next statement'
      }, [ptrName]);
      return;
    }

    if (trimmed.includes('++') || trimmed.includes('--') || trimmed.includes('+')) {
      const ptrName = trimmed.replace(/[\+\-\=\;\s]/g, '');
      const ptrVar = this.getVariable(ptrName);
      if (ptrVar && ptrVar.type.includes('*')) {
        const currentAddrHex = parseInt(String(ptrVar.value).replace('0x', ''), 16);
        const newAddr = '0x' + (currentAddrHex + 4).toString(16);
        ptrVar.value = newAddr;
        ptrVar.pointsTo = newAddr;
        ptrVar.isUpdated = true;
        this.recordStep(lineNum, 'line', {
          action: `Pointer arithmetic: '${ptrName}' advanced by sizeof(int) (4 bytes)`,
          reason: 'Pointer arithmetic calculates offset based on data type size',
          memoryImpact: `Address in '${ptrName}' shifted from 0x${currentAddrHex.toString(16)} to ${newAddr}`,
          nextPrediction: 'Next instruction'
        }, [ptrName]);
        return;
      }
    }

    this.handleGeneralAssignment(trimmed, lineNum);
  }

  handleMemoryAllocation(trimmed: string, lineNum: number) {
    const varMatch = trimmed.match(/(?:(?:[a-zA-Z_]\w*)\s*\*?)\s+([a-zA-Z_]\w*)\s*=/);
    const varName = varMatch ? varMatch[1] : 'ptr';
    const heapAddr = this.allocHeapAddr(16);

    let heapObj: HeapObject;
    if (trimmed.includes('new Node') || trimmed.includes('struct Node')) {
      const valMatch = trimmed.match(/Node\s*\((.*?)\)/);
      const initialVal = valMatch ? this.resolveExpr(valMatch[1]) : 0;
      heapObj = {
        id: heapAddr,
        type: 'struct',
        typeName: 'Node',
        fields: {
          val: { name: 'val', type: 'int', value: initialVal, address: heapAddr },
          next: { name: 'next', type: 'Node*', value: '0x0', address: '0x' + (parseInt(heapAddr, 16) + 8).toString(16), pointsTo: null }
        }
      };
    } else if (trimmed.includes('malloc') && trimmed.includes('*')) {
      heapObj = {
        id: heapAddr,
        type: 'array',
        typeName: 'int[]',
        items: [
          { name: '[0]', type: 'int', value: 0 },
          { name: '[1]', type: 'int', value: 0 },
          { name: '[2]', type: 'int', value: 0 }
        ]
      };
    } else {
      heapObj = {
        id: heapAddr,
        type: 'object',
        typeName: 'HeapBlock',
        fields: {
          value: { name: 'value', type: 'int', value: 0, address: heapAddr }
        }
      };
    }

    this.heap[heapAddr] = heapObj;
    this.setVariable(varName, 'pointer', heapAddr, null, heapAddr);

    this.recordStep(lineNum, 'line', {
      action: `Dynamic Heap Allocation: allocated memory at ${heapAddr}`,
      reason: 'Requested heap block via malloc/new',
      memoryImpact: `New Heap object created at address ${heapAddr}. Stack pointer '${varName}' references it.`,
      nextPrediction: 'Working with heap-allocated memory'
    }, [varName]);
  }

  handleFreeMemory(trimmed: string, lineNum: number) {
    const match = trimmed.match(/(?:free|delete)\s*\(?([a-zA-Z_]\w*)\)?/);
    const varName = match ? match[1] : 'ptr';
    const variable = this.getVariable(varName);

    if (variable && this.heap[variable.value]) {
      const addr = variable.value;
      delete this.heap[addr];
      variable.value = '0x0 (freed)';
      variable.pointsTo = null;
      variable.isUpdated = true;

      this.recordStep(lineNum, 'line', {
        action: `Memory Deallocation: free(${varName})`,
        reason: 'Releasing dynamically allocated heap buffer back to runtime',
        memoryImpact: `Heap block at ${addr} deallocated. Reference marked as freed.`,
        nextPrediction: 'Proceeding'
      }, [varName]);
    }
  }

  handleArrayDeclaration(trimmed: string, lineNum: number) {
    const nameMatch = trimmed.match(/(?:(?:int|float|double|char|let|var|const)\s+)?([a-zA-Z_]\w*)\s*(?:\[\s*\d*\s*\])?\s*=\s*[\{\[](.*?)[\}\]];?/);
    if (nameMatch) {
      const arrName = nameMatch[1];
      const elementsStr = nameMatch[2].trim();
      const rawElems = elementsStr ? elementsStr.split(',').map(e => this.resolveExpr(e.trim())) : [];
      const heapAddr = this.allocHeapAddr(rawElems.length * 4 + 8);

      const items: VariableValue[] = rawElems.map((val, idx) => ({
        name: `[${idx}]`,
        type: isNaN(Number(val)) ? 'string' : 'int',
        value: isNaN(Number(val)) ? val : Number(val),
        address: '0x' + (parseInt(heapAddr, 16) + idx * 4).toString(16)
      }));

      this.heap[heapAddr] = {
        id: heapAddr,
        type: 'array',
        typeName: `${items.length > 0 ? items[0].type : 'int'}[]`,
        items: items
      };

      this.setVariable(arrName, 'array', heapAddr, null, heapAddr);
      this.recordStep(lineNum, 'line', {
        action: `Array initialized: '${arrName}' with ${items.length} elements`,
        reason: 'Contiguous block allocated in memory',
        memoryImpact: `Heap/Array allocated at ${heapAddr} holding ${items.length} items`,
        nextPrediction: 'Next instruction'
      }, [arrName]);
      return;
    }

    this.handleGeneralAssignment(trimmed, lineNum);
  }

  handleObjectInstantiation(trimmed: string, lineNum: number) {
    const match = trimmed.match(/(?:(?:[a-zA-Z_]\w*|let|const|var)\s+)?([a-zA-Z_]\w*)\s*=\s*(?:new\s+([a-zA-Z_]\w*)\s*\((.*?)\)|\{\s*(.*?)\s*\});?/);
    if (match) {
      const varName = match[1];
      const className = match[2] || 'Object';
      const argsOrFields = match[3] || match[4] || '';
      const heapAddr = this.allocHeapAddr(24);

      const fields: Record<string, VariableValue> = {};
      if (argsOrFields.includes(':')) {
        argsOrFields.split(',').forEach(pair => {
          const [k, v] = pair.split(':').map(s => s.trim());
          if (k) fields[k] = { name: k, type: 'auto', value: this.resolveExpr(v) };
        });
      } else {
        const args = argsOrFields.split(',').map(a => this.resolveExpr(a.trim()));
        fields['val'] = { name: 'val', type: 'int', value: args[0] || 0 };
        fields['next'] = { name: 'next', type: 'reference', value: 'null', pointsTo: null };
      }

      this.heap[heapAddr] = {
        id: heapAddr,
        type: 'object',
        typeName: className,
        fields: fields
      };

      this.setVariable(varName, 'reference', heapAddr, null, heapAddr);
      this.recordStep(lineNum, 'line', {
        action: `Object instantiated: new ${className}()`,
        reason: 'Instantiating class on the heap',
        memoryImpact: `Object created at ${heapAddr}. Stack variable '${varName}' stores reference.`,
        nextPrediction: 'Proceeding'
      }, [varName]);
      return;
    }

    this.handleGeneralAssignment(trimmed, lineNum);
  }

  handleForLoop(startIdx: number, lineNum: number): number {
    const line = this.lines[startIdx];
    const forMatch = line.match(/for\s*\(\s*(?:int\s+)?([a-zA-Z_]\w*)\s*=\s*([^;]+);\s*([^;]+);\s*([^)]+)\)/);
    if (!forMatch) {
      this.recordStep(lineNum, 'line');
      return startIdx + 1;
    }

    const loopVar = forMatch[1];
    const startVal = Number(this.resolveExpr(forMatch[2]));
    const condition = forMatch[3].trim();
    const stepExpr = forMatch[4].trim();

    let blockEnd = startIdx + 1;
    let braceCount = 0;
    let foundOpen = false;
    for (let k = startIdx; k < this.lines.length; k++) {
      if (this.lines[k].includes('{')) {
        braceCount++;
        foundOpen = true;
      }
      if (this.lines[k].includes('}')) {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          blockEnd = k;
          break;
        }
      }
    }

    this.setVariable(loopVar, 'int', startVal);
    this.recordStep(lineNum, 'line', {
      action: `For loop initialized: '${loopVar}' = ${startVal}`,
      reason: 'Loop initialization clause executed',
      memoryImpact: `Stack variable '${loopVar}' initialized to ${startVal}`,
      nextPrediction: `Evaluating loop condition '${condition}'`
    }, [loopVar]);

    let loopIter = 0;
    while (loopIter < 50) {
      if (this.stepCount >= this.maxSteps) break;

      const currentVal = this.getVariable(loopVar)?.value || 0;
      const condEval = this.evalCondition(condition.replace(new RegExp(`\\b${loopVar}\\b`, 'g'), String(currentVal)));

      this.recordStep(lineNum, 'line', {
        action: `Loop condition checked: '${condition}' is ${condEval ? 'true' : 'false'}`,
        reason: `Current value: ${loopVar} = ${currentVal}`,
        memoryImpact: 'Condition evaluated',
        nextPrediction: condEval ? 'Entering loop body' : 'Loop finished, exiting'
      });

      if (!condEval) break;

      this.executeBlock(startIdx + 1, blockEnd - 1, 'loopBody');

      let nextVal = currentVal + 1;
      if (stepExpr.includes('-=')) nextVal = currentVal - 1;
      else if (stepExpr.includes('+=')) {
        const delta = Number(stepExpr.split('+=')[1]) || 1;
        nextVal = currentVal + delta;
      } else if (stepExpr.includes('--')) nextVal = currentVal - 1;

      this.setVariable(loopVar, 'int', nextVal);
      this.recordStep(lineNum, 'line', {
        action: `Loop increment: '${loopVar}' updated to ${nextVal}`,
        reason: `Step clause '${stepExpr}' executed`,
        memoryImpact: `Stack variable '${loopVar}' updated to ${nextVal}`,
        nextPrediction: `Re-evaluating loop condition`
      }, [loopVar]);

      loopIter++;
    }

    return blockEnd + 1;
  }

  handleWhileLoop(startIdx: number, lineNum: number): number {
    const line = this.lines[startIdx];
    const match = line.match(/while\s*\(\s*(.+?)\s*\)/);
    if (!match) return startIdx + 1;

    const condition = match[1];
    let blockEnd = startIdx + 1;
    let braceCount = 0;
    let foundOpen = false;
    for (let k = startIdx; k < this.lines.length; k++) {
      if (this.lines[k].includes('{')) {
        braceCount++;
        foundOpen = true;
      }
      if (this.lines[k].includes('}')) {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          blockEnd = k;
          break;
        }
      }
    }

    let iterations = 0;
    while (iterations < 50) {
      if (this.stepCount >= this.maxSteps) break;

      let condSubstituted = condition;
      for (const frame of this.callStack) {
        for (const [k, v] of Object.entries(frame.variables)) {
          condSubstituted = condSubstituted.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v.value));
        }
      }
      const condEval = this.evalCondition(condSubstituted);

      this.recordStep(lineNum, 'line', {
        action: `While condition: '${condition}' is ${condEval ? 'true' : 'false'}`,
        reason: 'Checking loop continuation predicate',
        memoryImpact: 'Condition evaluated',
        nextPrediction: condEval ? 'Executing loop body' : 'Loop terminated'
      });

      if (!condEval) break;

      this.executeBlock(startIdx + 1, blockEnd - 1, 'whileBody');
      iterations++;
    }

    return blockEnd + 1;
  }

  handleIfElse(startIdx: number, lineNum: number): number {
    const line = this.lines[startIdx];
    const match = line.match(/if\s*\(\s*(.+?)\s*\)/);
    if (!match) return startIdx + 1;

    const condition = match[1];
    let condSubstituted = condition;
    for (const frame of this.callStack) {
      for (const [k, v] of Object.entries(frame.variables)) {
        condSubstituted = condSubstituted.replace(new RegExp(`\\b${k}\\b`, 'g'), String(v.value));
      }
    }

    const condEval = this.evalCondition(condSubstituted);

    this.recordStep(lineNum, 'line', {
      action: `Branch condition evaluated: '${condition}' is ${condEval ? 'true' : 'false'}`,
      reason: 'Evaluating if condition',
      memoryImpact: 'Branch decision chosen',
      nextPrediction: condEval ? "Executing 'then' branch" : "Skipping to 'else' branch"
    });

    let blockEnd = startIdx + 1;
    let braceCount = 0;
    let foundOpen = false;
    for (let k = startIdx; k < this.lines.length; k++) {
      if (this.lines[k].includes('{')) {
        braceCount++;
        foundOpen = true;
      }
      if (this.lines[k].includes('}')) {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          blockEnd = k;
          break;
        }
      }
    }

    if (condEval) {
      this.executeBlock(startIdx + 1, blockEnd - 1, 'ifThen');
      if (this.lines[blockEnd] && this.lines[blockEnd].includes('else')) {
        let elseEnd = blockEnd + 1;
        let elseBraces = 0;
        let elseOpen = false;
        for (let k = blockEnd; k < this.lines.length; k++) {
          if (this.lines[k].includes('{')) {
            elseBraces++;
            elseOpen = true;
          }
          if (this.lines[k].includes('}')) {
            elseBraces--;
            if (elseOpen && elseBraces === 0) {
              elseEnd = k;
              break;
            }
          }
        }
        return elseEnd + 1;
      }
      return blockEnd + 1;
    } else {
      if (this.lines[blockEnd] && this.lines[blockEnd].includes('else')) {
        const elseStart = blockEnd;
        let elseEnd = blockEnd + 1;
        let elseBraces = 0;
        let elseOpen = false;
        for (let k = blockEnd; k < this.lines.length; k++) {
          if (this.lines[k].includes('{')) {
            elseBraces++;
            elseOpen = true;
          }
          if (this.lines[k].includes('}')) {
            elseBraces--;
            if (elseOpen && elseBraces === 0) {
              elseEnd = k;
              break;
            }
          }
        }
        this.executeBlock(elseStart + 1, elseEnd - 1, 'ifElse');
        return elseEnd + 1;
      }
      return blockEnd + 1;
    }
  }

  simulateFunctionCall(destVar: string, funcName: string, argsStr: string, lineNum: number) {
    let funcStart = -1;
    let paramNames: string[] = [];
    for (let i = 0; i < this.lines.length; i++) {
      const match = this.lines[i].match(new RegExp(`(?:int|void|float|double|char\\*|function)\\s+${funcName}\\s*\\(([^)]*)\\)`));
      if (match) {
        funcStart = i + 1;
        paramNames = match[1].split(',').map(p => {
          const parts = p.trim().split(/\s+/);
          return parts[parts.length - 1].replace('*', '');
        }).filter(Boolean);
        break;
      }
    }

    const resolvedArgs = argsStr.split(',').map(a => {
      const trimmed = a.trim();
      const val = this.resolveExpr(trimmed);
      return isNaN(Number(val)) ? val : Number(val);
    });

    this.recordStep(lineNum, 'call', {
      action: `Function call: ${funcName}(${resolvedArgs.join(', ')})`,
      reason: `Transferring execution flow into '${funcName}'`,
      memoryImpact: `Pushed new activation stack frame for '${funcName}()'`,
      nextPrediction: `Binding parameters and executing function body`
    });

    this.pushFrame(funcName, funcStart > 0 ? funcStart : lineNum);
    paramNames.forEach((p, idx) => {
      this.setVariable(p, 'int', resolvedArgs[idx] !== undefined ? resolvedArgs[idx] : 0);
    });

    if (funcName === 'factorial' || funcName === 'fact') {
      const n = Number(resolvedArgs[0]);
      if (n <= 1) {
        this.recordStep(funcStart > 0 ? funcStart + 2 : lineNum, 'return', {
          action: `Base case reached: ${funcName}(${n}) returns 1`,
          reason: 'Recursion termination condition met (n <= 1)',
          memoryImpact: `Stack frame for '${funcName}()' will be popped`,
          nextPrediction: 'Returning to caller'
        });
        this.popFrame();
        this.setVariable(destVar, 'int', 1);
        return;
      } else {
        this.simulateFunctionCall('subResult', funcName, String(n - 1), lineNum);
        const sub = this.getVariable('subResult')?.value || 1;
        const total = n * Number(sub);
        this.recordStep(funcStart > 0 ? funcStart + 3 : lineNum, 'return', {
          action: `${funcName}(${n}) returns ${n} * ${sub} = ${total}`,
          reason: 'Unwinding recursion stack frame',
          memoryImpact: `Popping stack frame for '${funcName}(${n})'`,
          nextPrediction: 'Returning result to caller'
        });
        this.popFrame();
        this.setVariable(destVar, 'int', total);
        return;
      }
    }

    this.popFrame();
    this.setVariable(destVar, 'int', 42);
  }

  handleGeneralAssignment(trimmed: string, lineNum: number) {
    const assignMatch = trimmed.match(/(?:(?:int|float|double|char\*|bool|let|const|var)\s+)?([a-zA-Z_]\w*(?:\[\w+\])?(?:\.\w+)?)\s*=\s*(.+?);?$/);
    if (assignMatch) {
      const target = assignMatch[1];
      const expr = assignMatch[2];

      if (target.includes('->') || target.includes('.')) {
        const parts = target.split(/->|\./);
        const objVar = this.getVariable(parts[0]);
        if (objVar && this.heap[objVar.value]) {
          const field = parts[1];
          const resolved = this.resolveExpr(expr);
          const heapObj = this.heap[objVar.value];
          if (heapObj.fields) {
            heapObj.fields[field] = {
              name: field,
              type: 'auto',
              value: resolved,
              pointsTo: this.heap[resolved] ? resolved : null
            };
          }
          this.recordStep(lineNum, 'line', {
            action: `Field updated: ${target} = ${resolved}`,
            reason: `Setting field '${field}' on heap object at ${objVar.value}`,
            memoryImpact: `Heap object modified`,
            nextPrediction: 'Continuing'
          });
          return;
        }
      }

      const resolved = this.resolveExpr(expr);
      const numVal = isNaN(Number(resolved)) ? resolved : Number(resolved);
      this.setVariable(target, typeof numVal === 'number' ? 'int' : 'string', numVal);

      this.recordStep(lineNum, 'line', {
        action: `Assigned value ${resolved} to '${target}'`,
        reason: `Evaluated expression '${expr}'`,
        memoryImpact: `Stack variable '${target}' updated with value ${resolved}`,
        nextPrediction: 'Proceeding to next statement'
      }, [target]);
      return;
    }

    if (trimmed.endsWith('++;') || trimmed.endsWith('--;')) {
      const varName = trimmed.replace(/[\+\-\;\s]/g, '');
      const variable = this.getVariable(varName);
      if (variable && typeof variable.value === 'number') {
        const newVal = trimmed.includes('++') ? variable.value + 1 : variable.value - 1;
        variable.value = newVal;
        variable.isUpdated = true;
        this.recordStep(lineNum, 'line', {
          action: `Variable '${varName}' ${trimmed.includes('++') ? 'incremented' : 'decremented'} to ${newVal}`,
          reason: 'Unary operator executed',
          memoryImpact: `Updated value at address ${variable.address}`,
          nextPrediction: 'Next instruction'
        }, [varName]);
        return;
      }
    }

    this.recordStep(lineNum, 'line');
  }

  evalCondition(cond: string): boolean {
    try {
      const sanitized = cond
        .replace(/&&/g, ' && ')
        .replace(/\|\|/g, ' || ')
        .replace(/!/g, ' ! ');
      return Boolean(Function(`"use strict"; return (${sanitized})`)());
    } catch {
      return false;
    }
  }
}
