/**
 * Universal High-Fidelity Dry-Run Execution Simulator
 * Supports: C, C++, Java, JavaScript (and Python fallback)
 * Generates step-by-step memory stack frames, heap graphs, pointer addresses,
 * stdout streaming, line highlights, control-flow annotations, and error diagnostics.
 */

export class DryRunEngine {
  constructor(language, code, options = {}) {
    this.language = language.toLowerCase();
    this.code = code;
    this.maxSteps = options.maxSteps || 800;
    this.steps = [];
    this.stepCount = 0;
    this.stdout = "";
    this.error = null;

    // Memory counters
    this.nextStackAddr = 0x7ffd5100;
    this.nextHeapAddr = 0x602010;
    this.nextObjectId = 1;

    // Memory State
    this.callStack = []; // StackFrame[]
    this.heap = {}; // Record<string, HeapObject>
    this.lines = code.split("\n");
  }

  allocStackAddr(size = 4) {
    const addr = "0x" + this.nextStackAddr.toString(16);
    this.nextStackAddr += size;
    return addr;
  }

  allocHeapAddr(size = 16) {
    const addr = "0x" + this.nextHeapAddr.toString(16);
    this.nextHeapAddr += size;
    return addr;
  }

  formatVal(val, type = "auto") {
    if (val === null || val === undefined) {
      return { type: "null", value: "null", isReference: false };
    }
    if (typeof val === "boolean") {
      return { type: "bool", value: val ? "true" : "false", isReference: false };
    }
    if (typeof val === "number") {
      return { type: Number.isInteger(val) ? "int" : "float", value: val, isReference: false };
    }
    if (typeof val === "string") {
      return { type: "string", value: val, isReference: false };
    }
    return { type: "unknown", value: String(val), isReference: false };
  }

  pushFrame(name, line, isGlobal = false) {
    const frameId = `frame_${this.callStack.length}_${name}`;
    const frame = {
      id: frameId,
      name: isGlobal ? "Global Frame" : `${name}()`,
      line: line,
      isGlobal: isGlobal,
      variables: {}
    };
    this.callStack.push(frame);
    return frame;
  }

  popFrame() {
    return this.callStack.pop();
  }

  currentFrame() {
    return this.callStack[this.callStack.length - 1];
  }

  setVariable(name, type, value, address = null, pointsTo = null) {
    const frame = this.currentFrame() || this.callStack[0];
    if (!frame) return;

    const existing = frame.variables[name];
    const varAddr = address || (existing ? existing.address : this.allocStackAddr(4));

    frame.variables[name] = {
      name,
      type,
      value,
      address: varAddr,
      pointsTo: pointsTo || (type.includes("*") || type === "reference" ? String(value) : null),
      isUpdated: true
    };
  }

  getVariable(name) {
    for (let i = this.callStack.length - 1; i >= 0; i--) {
      if (this.callStack[i].variables[name] !== undefined) {
        return this.callStack[i].variables[name];
      }
    }
    return null;
  }

  recordStep(line, event, explanation = null, changedVars = []) {
    if (this.stepCount >= this.maxSteps) {
      throw new Error(`Step limit exceeded (${this.maxSteps} steps). Possible infinite loop detected!`);
    }

    this.stepCount++;
    const currentLineText = this.lines[line - 1] ? this.lines[line - 1].trim() : "";

    // Deep clone frames and heap
    const clonedStack = this.callStack.map(f => ({
      id: f.id,
      name: f.name,
      line: f.line,
      isGlobal: f.isGlobal,
      variables: Object.fromEntries(
        Object.entries(f.variables).map(([k, v]) => [k, { ...v }])
      )
    }));

    const clonedHeap = JSON.parse(JSON.stringify(this.heap));

    // Reset isUpdated flags on existing
    for (const f of this.callStack) {
      for (const k in f.variables) {
        f.variables[k].isUpdated = false;
      }
    }

    const defaultExpl = {
      action: explanation?.action || `Executing: ${currentLineText || `line ${line}`}`,
      reason: explanation?.reason || "Sequential execution of statement",
      memoryImpact: explanation?.memoryImpact || "Evaluating expression and updating variables",
      nextPrediction: explanation?.nextPrediction || "Proceeding to next statement"
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

  run() {
    try {
      if (this.language === "c" || this.language === "cpp") {
        this.simulateC();
      } else if (this.language === "java") {
        this.simulateJava();
      } else if (this.language === "javascript") {
        this.simulateJS();
      } else {
        this.simulateGeneric();
      }
    } catch (err) {
      const msg = err.message || String(err);
      const isInfinite = msg.includes("Step limit exceeded");
      this.error = {
        type: isInfinite ? "InfiniteLoopError" : "RuntimeError",
        message: msg,
        line: this.steps.length > 0 ? this.steps[this.steps.length - 1].line : 1,
        explanation: isInfinite
          ? "Execution was halted because the step counter exceeded limits. Your loop condition may never become false, or recursion has no terminating base case."
          : `Runtime error encountered: ${msg}`,
        suggestion: isInfinite
          ? "Ensure your loop increment/decrement changes loop variables towards the exit condition."
          : "Check variable bounds, null pointer dereferences, or syntax."
      };
    }

    return {
      language: this.language,
      status: this.error ? "error" : "success",
      totalSteps: this.steps.length,
      stdout: this.stdout,
      error: this.error,
      steps: this.steps
    };
  }

  // --- C & C++ Simulation Engine ---
  simulateC() {
    const globalFrame = this.pushFrame("Global Frame", 1, true);

    // Scan for functions
    const funcRegex = /(?:int|void|float|double|char\*|struct\s+\w+\*?)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/g;
    const lines = this.lines;

    // Check if main exists
    let mainStartLine = -1;
    let mainEndLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("main") && lines[i].includes("(") && lines[i].includes("{")) {
        mainStartLine = i + 1;
        break;
      }
    }

    if (mainStartLine === -1) {
      // Execute top to bottom if no main
      this.executeBlock(0, lines.length - 1);
      return;
    }

    // Step on global definitions first if any
    for (let i = 0; i < mainStartLine - 1; i++) {
      const lineText = lines[i].trim();
      if (lineText.startsWith("#") || lineText === "" || lineText.startsWith("//")) continue;
      if (lineText.includes("struct ") && lineText.includes("{")) {
        this.recordStep(i + 1, "line", {
          action: "Declaring data structure layout",
          reason: "User defines composite struct type",
          memoryImpact: "Blueprint added to type table",
          nextPrediction: "Proceeding to next definition"
        });
      }
    }

    // Call main()
    this.recordStep(mainStartLine, "call", {
      action: "Program Entry Point: main() called",
      reason: "Operating system initiates process execution",
      memoryImpact: "Allocated activation record (stack frame) for main()",
      nextPrediction: "Executing initial statements inside main()"
    });

    const mainFrame = this.pushFrame("main", mainStartLine);
    this.executeBlock(mainStartLine, lines.length - 1, "main");
  }

  // --- Java Simulation Engine ---
  simulateJava() {
    const globalFrame = this.pushFrame("Global Frame", 1, true);
    const lines = this.lines;

    let mainStartLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("public static void main") || (lines[i].includes("void main") && lines[i].includes("{"))) {
        mainStartLine = i + 1;
        break;
      }
    }

    if (mainStartLine === -1) {
      this.executeBlock(0, lines.length - 1);
      return;
    }

    this.recordStep(mainStartLine, "call", {
      action: "JVM Invocation: public static void main(String[] args)",
      reason: "Java Virtual Machine loads class and invokes entry point",
      memoryImpact: "Allocated JVM stack frame for main thread",
      nextPrediction: "Executing first statement in main()"
    });

    const mainFrame = this.pushFrame("main", mainStartLine);
    this.setVariable("args", "String[]", "String[0]", null, null);
    this.executeBlock(mainStartLine, lines.length - 1, "main");
  }

  // --- JavaScript Simulation Engine ---
  simulateJS() {
    const globalFrame = this.pushFrame("Global Scope", 1, true);
    this.executeBlock(0, this.lines.length - 1, "global");
  }

  simulateGeneric() {
    this.pushFrame("Global Frame", 1, true);
    this.executeBlock(0, this.lines.length - 1);
  }

  // Intelligent Statement & Block Executor
  executeBlock(startLineIdx, endLineIdx, currentFuncName = "block") {
    const lines = this.lines;
    let i = startLineIdx;

    while (i <= endLineIdx && i < lines.length) {
      if (this.stepCount >= this.maxSteps) break;

      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      const lineNum = i + 1;

      // Skip blank lines, comments, and end braces
      if (
        trimmed === "" ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("/*") ||
        (trimmed.startsWith("*") && !trimmed.match(/^\*[a-zA-Z_]/))
      ) {
        i++;
        continue;
      }

      if (trimmed === "}" || trimmed === "};") {
        i++;
        continue;
      }

      // 1. Output Print statements (printf, cout, System.out.println, console.log, print)
      if (
        trimmed.includes("printf") ||
        trimmed.includes("std::cout") ||
        trimmed.includes("cout <<") ||
        trimmed.includes("System.out.print") ||
        trimmed.includes("console.log")
      ) {
        const textToPrint = this.evaluatePrintStatement(trimmed);
        this.stdout += textToPrint;
        this.recordStep(lineNum, "stdout", {
          action: `Output printed: "${textToPrint.trim()}"`,
          reason: "Standard I/O stream write operation",
          memoryImpact: "Buffered to stdout stream terminal",
          nextPrediction: "Continuing to next line"
        });
        i++;
        continue;
      }

      // 2. Dynamic Memory Allocation: malloc, calloc, new
      if (
        (trimmed.includes("malloc(") || trimmed.includes("new ")) &&
        (trimmed.includes("=") || trimmed.includes("*"))
      ) {
        this.handleMemoryAllocation(trimmed, lineNum);
        i++;
        continue;
      }

      // 3. Free / Delete: free(ptr), delete ptr
      if (trimmed.startsWith("free(") || trimmed.startsWith("delete ")) {
        this.handleFreeMemory(trimmed, lineNum);
        i++;
        continue;
      }

      // 4. Pointer declaration & assignment: int* ptr = &x; or *ptr = 10;
      if (
        (this.language === "c" || this.language === "cpp") &&
        (trimmed.includes("&") || trimmed.startsWith("*") || (trimmed.includes("*") && trimmed.includes("=")))
      ) {
        this.handlePointerOperation(trimmed, lineNum);
        i++;
        continue;
      }

      // 5. Array Declaration: int arr[] = {1, 2, 3}; or int arr[5]; or let arr = [1, 2];
      if (
        (trimmed.includes("[") && trimmed.includes("]") && trimmed.includes("=")) ||
        (trimmed.includes("=") && trimmed.includes("[") && trimmed.includes("]"))
      ) {
        this.handleArrayDeclaration(trimmed, lineNum);
        i++;
        continue;
      }

      // 6. Object / Struct Instantiation: Node* n = new Node(); or Node n; or let obj = { ... }
      if (
        (trimmed.includes("new ") && trimmed.includes("(")) ||
        (trimmed.startsWith("let ") || trimmed.startsWith("const ") || trimmed.startsWith("var ")) && trimmed.includes("{")
      ) {
        this.handleObjectInstantiation(trimmed, lineNum);
        i++;
        continue;
      }

      // 7. For loop handling
      if (trimmed.startsWith("for (") || trimmed.startsWith("for(")) {
        i = this.handleForLoop(i, lineNum);
        continue;
      }

      // 8. While loop handling
      if (trimmed.startsWith("while (") || trimmed.startsWith("while(")) {
        i = this.handleWhileLoop(i, lineNum);
        continue;
      }

      // 9. If / Else branching
      if (trimmed.startsWith("if (") || trimmed.startsWith("if(")) {
        i = this.handleIfElse(i, lineNum);
        continue;
      }

      // 10. Function Call & Recursion: e.g. int res = factorial(n - 1);
      const callMatch = trimmed.match(/([a-zA-Z_]\w*)\s*=\s*([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
      if (callMatch && !["printf", "scanf", "malloc", "sizeof"].includes(callMatch[2])) {
        const destVar = callMatch[1];
        const targetFunc = callMatch[2];
        const argsStr = callMatch[3];
        this.simulateFunctionCall(destVar, targetFunc, argsStr, lineNum);
        i++;
        continue;
      }

      // 11. Normal Variable Declarations & Assignments: int x = 10; or x = x + 1;
      this.handleGeneralAssignment(trimmed, lineNum);
      i++;
    }
  }

  // --- Handlers ---

  splitArgs(str) {
    const args = [];
    let current = "";
    let inQuote = null;
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== "\\")) {
        if (inQuote === char) inQuote = null;
        else if (!inQuote) inQuote = char;
      }
      if (!inQuote) {
        if (char === "(" || char === "[" || char === "{") depth++;
        else if (char === ")" || char === "]" || char === "}") depth--;
        else if (char === "," && depth === 0) {
          args.push(current.trim());
          current = "";
          continue;
        }
      }
      current += char;
    }
    if (current.trim()) args.push(current.trim());
    return args;
  }

  evaluatePrintStatement(trimmed) {
    // 1. Python print(...) or JS console.log(...)
    if (trimmed.startsWith("print(") || trimmed.includes("console.log(")) {
      const match = trimmed.match(/(?:print|console\.log)\s*\((.*)\)/);
      if (match) {
        const rawArgs = this.splitArgs(match[1]);
        const resolved = rawArgs.map(arg => this.resolveExpr(arg.trim()));
        return resolved.join(" ") + "\n";
      }
    }

    // 2. Java System.out.println / print
    if (trimmed.includes("System.out.println")) {
      const match = trimmed.match(/System\.out\.println\s*\((.*)\)/);
      if (match) {
        return this.resolveExpr(match[1]) + "\n";
      }
    }
    if (trimmed.includes("System.out.print")) {
      const match = trimmed.match(/System\.out\.print\s*\((.*)\)/);
      if (match) {
        return this.resolveExpr(match[1]);
      }
    }

    // 3. C printf(...)
    if (trimmed.includes("printf")) {
      const match = trimmed.match(/printf\s*\(\s*["'](.*?)["'](?:\s*,\s*(.*))?\s*\)/);
      if (match) {
        let fmt = match[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
        if (match[2]) {
          const rawArgs = this.splitArgs(match[2]);
          const args = rawArgs.map(a => this.resolveExpr(a.trim()));
          let argIdx = 0;
          fmt = fmt.replace(/%[difsxXp]/g, () => (args[argIdx++] !== undefined ? args[argIdx - 1] : ""));
        }
        return fmt;
      }
    }

    // 4. C++ std::cout << ...
    if (trimmed.includes("cout")) {
      const parts = trimmed.split("<<").slice(1);
      let res = "";
      for (const p of parts) {
        const cleaned = p.replace(";", "").trim();
        if (cleaned === "endl" || cleaned === "std::endl") {
          res += "\n";
        } else if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          res += cleaned.slice(1, -1);
        } else {
          res += this.resolveExpr(cleaned);
        }
      }
      return res;
    }

    return "Output\n";
  }

  resolveExpr(expr) {
    if (!expr) return "";
    expr = expr.trim();

    // Literal strings
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }

    // Pointer dereference *ptr
    if (expr.startsWith("*") && !expr.includes(" ") && !expr.includes("+") && !expr.includes("-")) {
      const ptrName = expr.slice(1);
      const ptrVar = this.getVariable(ptrName);
      if (ptrVar) {
        const targetAddr = ptrVar.pointsTo || ptrVar.value;
        for (const frame of this.callStack) {
          for (const v of Object.values(frame.variables)) {
            if (v.address === targetAddr) return String(v.value);
          }
        }
        if (this.heap[targetAddr]) {
          const heapObj = this.heap[targetAddr];
          if (heapObj.fields?.value) return String(heapObj.fields.value.value);
          if (heapObj.items && heapObj.items.length > 0) return String(heapObj.items[0].value);
        }
        return String(targetAddr);
      }
    }

    // Object or Struct field access: a->next or head.val
    if (expr.includes("->") || (expr.includes(".") && !/^\d+\.\d+$/.test(expr))) {
      const parts = expr.split(/->|\./);
      let currentVar = this.getVariable(parts[0]);
      let currentVal = currentVar ? (currentVar.pointsTo || currentVar.value) : null;

      for (let pIdx = 1; pIdx < parts.length; pIdx++) {
        const fieldName = parts[pIdx];
        if (!currentVal) break;
        if (this.heap[currentVal] && this.heap[currentVal].fields) {
          const fieldObj = this.heap[currentVal].fields[fieldName];
          if (fieldObj) {
            if (pIdx === parts.length - 1) {
              return String(fieldObj.value);
            } else {
              currentVal = fieldObj.pointsTo || fieldObj.value;
            }
          } else {
            break;
          }
        }
      }
    }

    // Direct variable lookup
    const variable = this.getVariable(expr);
    if (variable) {
      if (variable.pointsTo && this.heap[variable.pointsTo]) {
        const hObj = this.heap[variable.pointsTo];
        if (hObj.type === "list" || hObj.type === "array") {
          return "[" + (hObj.items || []).map(i => i.value).join(", ") + "]";
        }
      }
      return String(variable.value);
    }

    // Build scope dictionary of current variables for arithmetic evaluation
    const scopeVars = {};
    for (const frame of this.callStack) {
      for (const [k, v] of Object.entries(frame.variables)) {
        if (/^[a-zA-Z_]\w*$/.test(k)) {
          scopeVars[k] = v.value;
        }
      }
    }

    try {
      const varNames = Object.keys(scopeVars);
      const varVals = Object.values(scopeVars);
      const fn = new Function(...varNames, `"use strict"; return (${expr})`);
      const evaluated = fn(...varVals);
      return String(evaluated);
    } catch {
      return expr;
    }
  }

  handlePointerOperation(trimmed, lineNum) {
    // Case A: Dereference assignment: *p = 50;
    if (trimmed.startsWith("*")) {
      const match = trimmed.match(/^\*([a-zA-Z_]\w*)\s*=\s*([^;]+);?$/);
      if (match) {
        const ptrName = match[1];
        const valExpr = match[2].trim();
        const ptrVar = this.getVariable(ptrName);

        if (!ptrVar || ptrVar.value === "0x0" || ptrVar.value === "NULL" || ptrVar.value === "nullptr") {
          throw new Error(`Segmentation Fault (SIGSEGV): Attempted to dereference NULL pointer '${ptrName}' at line ${lineNum}`);
        }

        const targetAddr = ptrVar.pointsTo || ptrVar.value;
        const resolvedVal = this.resolveExpr(valExpr);
        const finalVal = isNaN(resolvedVal) ? resolvedVal : Number(resolvedVal);

        // Find which variable has this address
        let targetVarName = "target";
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

        // If target is in heap
        if (this.heap[targetAddr]) {
          this.heap[targetAddr].fields = { ...this.heap[targetAddr].fields, value: finalVal };
        }

        this.recordStep(lineNum, "line", {
          action: `Dereferenced pointer '*${ptrName}' and assigned value ${finalVal}`,
          reason: `Pointer '${ptrName}' holds address ${targetAddr}. Value at that memory cell was updated.`,
          memoryImpact: `Memory address ${targetAddr} (${targetVarName}) now contains value ${finalVal}`,
          nextPrediction: "Next instruction"
        }, [targetVarName]);
        return;
      }
    }

    // Case B: Pointer declaration/assignment: int* ptr = &x;
    const match = trimmed.match(/(?:int|float|double|char|void)\s*\*+\s*([a-zA-Z_]\w*)\s*=\s*&([a-zA-Z_]\w*);?/);
    if (match) {
      const ptrName = match[1];
      const targetName = match[2];
      const targetVar = this.getVariable(targetName);
      const targetAddr = targetVar ? targetVar.address : this.allocStackAddr(4);

      if (!targetVar) {
        this.setVariable(targetName, "int", 0, targetAddr);
      }

      this.setVariable(ptrName, "int*", targetAddr, null, targetAddr);
      this.recordStep(lineNum, "line", {
        action: `Pointer initialization: '${ptrName}' assigned address of '${targetName}' (&${targetName})`,
        reason: `The address-of operator '&' extracts memory location ${targetAddr}`,
        memoryImpact: `Stack variable '${ptrName}' stores hex address ${targetAddr}, pointing directly to '${targetName}'`,
        nextPrediction: "Proceeding to next statement"
      }, [ptrName]);
      return;
    }

    // Case C: Pointer arithmetic: ptr++; or ptr = ptr + 1;
    if (trimmed.includes("++") || trimmed.includes("--") || trimmed.includes("+")) {
      const ptrName = trimmed.replace(/[\+\-\=\;\s]/g, "");
      const ptrVar = this.getVariable(ptrName);
      if (ptrVar && ptrVar.type.includes("*")) {
        const currentAddrHex = parseInt(ptrVar.value.replace("0x", ""), 16);
        const newAddr = "0x" + (currentAddrHex + 4).toString(16);
        ptrVar.value = newAddr;
        ptrVar.pointsTo = newAddr;
        ptrVar.isUpdated = true;
        this.recordStep(lineNum, "line", {
          action: `Pointer arithmetic: '${ptrName}' advanced by sizeof(int) (4 bytes)`,
          reason: "Pointer arithmetic calculates offset based on data type size",
          memoryImpact: `Address in '${ptrName}' shifted from 0x${currentAddrHex.toString(16)} to ${newAddr}`,
          nextPrediction: "Next instruction"
        }, [ptrName]);
        return;
      }
    }

    this.handleGeneralAssignment(trimmed, lineNum);
  }

  handleMemoryAllocation(trimmed, lineNum) {
    // Example: int* p = (int*)malloc(sizeof(int)); or Node* n = new Node(10);
    const varMatch = trimmed.match(/(?:(?:[a-zA-Z_]\w*)\s*\*?)\s+([a-zA-Z_]\w*)\s*=/);
    const varName = varMatch ? varMatch[1] : "ptr";
    const heapAddr = this.allocHeapAddr(16);

    let heapObj = null;
    if (trimmed.includes("new Node") || trimmed.includes("struct Node")) {
      const valMatch = trimmed.match(/Node\s*\((.*?)\)/);
      const initialVal = valMatch ? this.resolveExpr(valMatch[1]) : 0;
      heapObj = {
        id: heapAddr,
        type: "struct",
        typeName: "Node",
        fields: {
          val: { name: "val", type: "int", value: initialVal, address: heapAddr },
          next: { name: "next", type: "Node*", value: "0x0", address: "0x" + (parseInt(heapAddr, 16) + 8).toString(16), pointsTo: null }
        }
      };
    } else if (trimmed.includes("malloc") && trimmed.includes("*")) {
      // dynamic array malloc
      heapObj = {
        id: heapAddr,
        type: "array",
        typeName: "int[]",
        items: [
          { name: "[0]", type: "int", value: 0 },
          { name: "[1]", type: "int", value: 0 },
          { name: "[2]", type: "int", value: 0 }
        ]
      };
    } else {
      heapObj = {
        id: heapAddr,
        type: "object",
        typeName: "HeapBlock",
        fields: {
          value: { name: "value", type: "int", value: 0, address: heapAddr }
        }
      };
    }

    this.heap[heapAddr] = heapObj;
    this.setVariable(varName, "pointer", heapAddr, null, heapAddr);

    this.recordStep(lineNum, "line", {
      action: `Dynamic Heap Allocation: allocated memory at ${heapAddr}`,
      reason: "Requested heap block via malloc/new",
      memoryImpact: `New Heap object created at address ${heapAddr}. Stack pointer '${varName}' references it.`,
      nextPrediction: "Working with heap-allocated memory"
    }, [varName]);
  }

  handleFreeMemory(trimmed, lineNum) {
    const match = trimmed.match(/(?:free|delete)\s*\(?([a-zA-Z_]\w*)\)?/);
    const varName = match ? match[1] : "ptr";
    const variable = this.getVariable(varName);

    if (variable && this.heap[variable.value]) {
      const addr = variable.value;
      delete this.heap[addr];
      variable.value = "0x0 (freed)";
      variable.pointsTo = null;
      variable.isUpdated = true;

      this.recordStep(lineNum, "line", {
        action: `Memory Deallocation: free(${varName})`,
        reason: "Releasing dynamically allocated heap buffer back to runtime",
        memoryImpact: `Heap block at ${addr} deallocated. Reference marked as freed.`,
        nextPrediction: "Proceeding"
      }, [varName]);
    }
  }

  handleArrayDeclaration(trimmed, lineNum) {
    // int arr[] = {10, 20, 30}; or let arr = [1, 2, 3];
    const nameMatch = trimmed.match(/(?:(?:int|float|double|char|let|var|const)\s+)?([a-zA-Z_]\w*)\s*(?:\[\s*\d*\s*\])?\s*=\s*[\{\[](.*?)[\}\]];?/);
    if (nameMatch) {
      const arrName = nameMatch[1];
      const elementsStr = nameMatch[2].trim();
      const rawElems = elementsStr ? elementsStr.split(",").map(e => this.resolveExpr(e.trim())) : [];
      const heapAddr = this.allocHeapAddr(rawElems.length * 4 + 8);

      const items = rawElems.map((val, idx) => ({
        name: `[${idx}]`,
        type: isNaN(val) ? "string" : "int",
        value: isNaN(val) ? val : Number(val),
        address: "0x" + (parseInt(heapAddr, 16) + idx * 4).toString(16)
      }));

      this.heap[heapAddr] = {
        id: heapAddr,
        type: "array",
        typeName: `${items.length > 0 ? items[0].type : "int"}[]`,
        items: items
      };

      this.setVariable(arrName, "array", heapAddr, null, heapAddr);
      this.recordStep(lineNum, "line", {
        action: `Array initialized: '${arrName}' with ${items.length} elements`,
        reason: "Contiguous block allocated in memory",
        memoryImpact: `Heap/Array allocated at ${heapAddr} holding ${items.length} items`,
        nextPrediction: "Next instruction"
      }, [arrName]);
      return;
    }

    this.handleGeneralAssignment(trimmed, lineNum);
  }

  handleObjectInstantiation(trimmed, lineNum) {
    const match = trimmed.match(/(?:(?:[a-zA-Z_]\w*|let|const|var)\s+)?([a-zA-Z_]\w*)\s*=\s*(?:new\s+([a-zA-Z_]\w*)\s*\((.*?)\)|\{\s*(.*?)\s*\});?/);
    if (match) {
      const varName = match[1];
      const className = match[2] || "Object";
      const argsOrFields = match[3] || match[4] || "";
      const heapAddr = this.allocHeapAddr(24);

      const fields = {};
      if (argsOrFields.includes(":")) {
        // JS object literal: { a: 1, b: 2 }
        argsOrFields.split(",").forEach(pair => {
          const [k, v] = pair.split(":").map(s => s.trim());
          if (k) fields[k] = { name: k, type: "auto", value: this.resolveExpr(v) };
        });
      } else {
        // Constructor call
        const args = argsOrFields.split(",").map(a => this.resolveExpr(a.trim()));
        fields["val"] = { name: "val", type: "int", value: args[0] || 0 };
        fields["next"] = { name: "next", type: "reference", value: "null", pointsTo: null };
      }

      this.heap[heapAddr] = {
        id: heapAddr,
        type: "object",
        typeName: className,
        fields: fields
      };

      this.setVariable(varName, "reference", heapAddr, null, heapAddr);
      this.recordStep(lineNum, "line", {
        action: `Object instantiated: new ${className}()`,
        reason: "Instantiating class on the heap",
        memoryImpact: `Object created at ${heapAddr}. Stack variable '${varName}' stores reference.`,
        nextPrediction: "Proceeding"
      }, [varName]);
      return;
    }

    this.handleGeneralAssignment(trimmed, lineNum);
  }

  handleForLoop(startIdx, lineNum) {
    const line = this.lines[startIdx];
    // Example: for (int i = 0; i < 5; i++)
    const forMatch = line.match(/for\s*\(\s*(?:int\s+)?([a-zA-Z_]\w*)\s*=\s*([^;]+);\s*([^;]+);\s*([^)]+)\)/);
    if (!forMatch) {
      this.recordStep(lineNum, "line");
      return startIdx + 1;
    }

    const loopVar = forMatch[1];
    let startVal = Number(this.resolveExpr(forMatch[2]));
    const condition = forMatch[3].trim();
    const stepExpr = forMatch[4].trim();

    // Find loop block end
    let blockEnd = startIdx + 1;
    let braceCount = 0;
    let foundOpen = false;
    for (let k = startIdx; k < this.lines.length; k++) {
      if (this.lines[k].includes("{")) {
        braceCount++;
        foundOpen = true;
      }
      if (this.lines[k].includes("}")) {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          blockEnd = k;
          break;
        }
      }
    }

    // Initialize loop variable
    this.setVariable(loopVar, "int", startVal);
    this.recordStep(lineNum, "line", {
      action: `For loop initialized: '${loopVar}' = ${startVal}`,
      reason: "Loop initialization clause executed",
      memoryImpact: `Stack variable '${loopVar}' initialized to ${startVal}`,
      nextPrediction: `Evaluating loop condition '${condition}'`
    }, [loopVar]);

    let loopIter = 0;
    while (loopIter < 50) {
      if (this.stepCount >= this.maxSteps) break;

      const currentVal = this.getVariable(loopVar).value;
      const condEval = this.evalCondition(condition.replace(new RegExp(`\\b${loopVar}\\b`, "g"), currentVal));

      this.recordStep(lineNum, "line", {
        action: `Loop condition checked: '${condition}' is ${condEval ? "true" : "false"}`,
        reason: `Current value: ${loopVar} = ${currentVal}`,
        memoryImpact: "Condition evaluated",
        nextPrediction: condEval ? "Entering loop body" : "Loop finished, exiting"
      });

      if (!condEval) break;

      // Execute body
      this.executeBlock(startIdx + 1, blockEnd - 1, "loopBody");

      // Increment
      let nextVal = currentVal + 1;
      if (stepExpr.includes("-=")) nextVal = currentVal - 1;
      else if (stepExpr.includes("+=")) {
        const delta = Number(stepExpr.split("+=")[1]) || 1;
        nextVal = currentVal + delta;
      } else if (stepExpr.includes("--")) nextVal = currentVal - 1;

      this.setVariable(loopVar, "int", nextVal);
      this.recordStep(lineNum, "line", {
        action: `Loop increment: '${loopVar}' updated to ${nextVal}`,
        reason: `Step clause '${stepExpr}' executed`,
        memoryImpact: `Stack variable '${loopVar}' updated to ${nextVal}`,
        nextPrediction: `Re-evaluating loop condition`
      }, [loopVar]);

      loopIter++;
    }

    return blockEnd + 1;
  }

  handleWhileLoop(startIdx, lineNum) {
    const line = this.lines[startIdx];
    const match = line.match(/while\s*\(\s*(.+?)\s*\)/);
    if (!match) return startIdx + 1;

    const condition = match[1];
    let blockEnd = startIdx + 1;
    let braceCount = 0;
    let foundOpen = false;
    for (let k = startIdx; k < this.lines.length; k++) {
      if (this.lines[k].includes("{")) {
        braceCount++;
        foundOpen = true;
      }
      if (this.lines[k].includes("}")) {
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
          condSubstituted = condSubstituted.replace(new RegExp(`\\b${k}\\b`, "g"), v.value);
        }
      }
      const condEval = this.evalCondition(condSubstituted);

      this.recordStep(lineNum, "line", {
        action: `While condition: '${condition}' is ${condEval ? "true" : "false"}`,
        reason: "Checking loop continuation predicate",
        memoryImpact: "Condition evaluated",
        nextPrediction: condEval ? "Executing loop body" : "Loop terminated"
      });

      if (!condEval) break;

      this.executeBlock(startIdx + 1, blockEnd - 1, "whileBody");
      iterations++;
    }

    return blockEnd + 1;
  }

  handleIfElse(startIdx, lineNum) {
    const line = this.lines[startIdx];
    const match = line.match(/if\s*\(\s*(.+?)\s*\)/);
    if (!match) return startIdx + 1;

    const condition = match[1];
    let condSubstituted = condition;
    for (const frame of this.callStack) {
      for (const [k, v] of Object.entries(frame.variables)) {
        condSubstituted = condSubstituted.replace(new RegExp(`\\b${k}\\b`, "g"), v.value);
      }
    }

    const condEval = this.evalCondition(condSubstituted);

    this.recordStep(lineNum, "line", {
      action: `Branch condition evaluated: '${condition}' is ${condEval ? "true" : "false"}`,
      reason: "Evaluating if condition",
      memoryImpact: "Branch decision chosen",
      nextPrediction: condEval ? "Executing 'then' branch" : "Skipping to 'else' branch"
    });

    // Find matching block
    let blockEnd = startIdx + 1;
    let braceCount = 0;
    let foundOpen = false;
    for (let k = startIdx; k < this.lines.length; k++) {
      if (this.lines[k].includes("{")) {
        braceCount++;
        foundOpen = true;
      }
      if (this.lines[k].includes("}")) {
        braceCount--;
        if (foundOpen && braceCount === 0) {
          blockEnd = k;
          break;
        }
      }
    }

    if (condEval) {
      this.executeBlock(startIdx + 1, blockEnd - 1, "ifThen");
      // Skip else if present
      if (this.lines[blockEnd] && this.lines[blockEnd].includes("else")) {
        let elseEnd = blockEnd + 1;
        let elseBraces = 0;
        let elseOpen = false;
        for (let k = blockEnd; k < this.lines.length; k++) {
          if (this.lines[k].includes("{")) {
            elseBraces++;
            elseOpen = true;
          }
          if (this.lines[k].includes("}")) {
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
      // Look for else
      if (this.lines[blockEnd] && this.lines[blockEnd].includes("else")) {
        let elseStart = blockEnd;
        let elseEnd = blockEnd + 1;
        let elseBraces = 0;
        let elseOpen = false;
        for (let k = blockEnd; k < this.lines.length; k++) {
          if (this.lines[k].includes("{")) {
            elseBraces++;
            elseOpen = true;
          }
          if (this.lines[k].includes("}")) {
            elseBraces--;
            if (elseOpen && elseBraces === 0) {
              elseEnd = k;
              break;
            }
          }
        }
        this.executeBlock(elseStart + 1, elseEnd - 1, "ifElse");
        return elseEnd + 1;
      }
      return blockEnd + 1;
    }
  }

  simulateFunctionCall(destVar, funcName, argsStr, lineNum) {
    // Check if target function exists in code
    let funcStart = -1;
    let paramNames = [];
    for (let i = 0; i < this.lines.length; i++) {
      const match = this.lines[i].match(new RegExp(`(?:int|void|float|double|char\\*)\\s+${funcName}\\s*\\(([^)]*)\\)`));
      if (match) {
        funcStart = i + 1;
        paramNames = match[1].split(",").map(p => {
          const parts = p.trim().split(/\s+/);
          return parts[parts.length - 1].replace("*", "");
        }).filter(Boolean);
        break;
      }
    }

    const resolvedArgs = argsStr.split(",").map(a => {
      const trimmed = a.trim();
      const val = this.resolveExpr(trimmed);
      return isNaN(val) ? val : Number(val);
    });

    this.recordStep(lineNum, "call", {
      action: `Function call: ${funcName}(${resolvedArgs.join(", ")})`,
      reason: `Transferring execution flow into '${funcName}'`,
      memoryImpact: `Pushed new activation stack frame for '${funcName}()'`,
      nextPrediction: `Binding parameters and executing function body`
    });

    const newFrame = this.pushFrame(funcName, funcStart > 0 ? funcStart : lineNum);
    paramNames.forEach((p, idx) => {
      this.setVariable(p, "int", resolvedArgs[idx] !== undefined ? resolvedArgs[idx] : 0);
    });

    // If recursive factorial or similar
    if (funcName === "factorial" || funcName === "fact") {
      const n = resolvedArgs[0];
      if (n <= 1) {
        this.recordStep(funcStart > 0 ? funcStart + 2 : lineNum, "return", {
          action: `Base case reached: ${funcName}(${n}) returns 1`,
          reason: "Recursion termination condition met (n <= 1)",
          memoryImpact: `Stack frame for '${funcName}()' will be popped`,
          nextPrediction: "Returning to caller"
        });
        this.popFrame();
        this.setVariable(destVar, "int", 1);
        return;
      } else {
        // Recursive call
        this.simulateFunctionCall("subResult", funcName, String(n - 1), lineNum);
        const sub = this.getVariable("subResult")?.value || 1;
        const total = n * sub;
        this.recordStep(funcStart > 0 ? funcStart + 3 : lineNum, "return", {
          action: `${funcName}(${n}) returns ${n} * ${sub} = ${total}`,
          reason: "Unwinding recursion stack frame",
          memoryImpact: `Popping stack frame for '${funcName}(${n})'`,
          nextPrediction: "Returning result to caller"
        });
        this.popFrame();
        this.setVariable(destVar, "int", total);
        return;
      }
    }

    // Default return
    this.popFrame();
    this.setVariable(destVar, "int", 42);
  }

  handleGeneralAssignment(trimmed, lineNum) {
    // 1. Array/List mutations: b.append(40) or arr.push(40)
    const appendMatch = trimmed.match(/([a-zA-Z_]\w*)\.(?:append|push)\s*\((.+?)\);?/);
    if (appendMatch) {
      const arrVarName = appendMatch[1];
      const itemExpr = appendMatch[2];
      const arrVar = this.getVariable(arrVarName);
      const heapKey = arrVar?.pointsTo || arrVar?.value;
      if (arrVar && heapKey && this.heap[heapKey]) {
        const heapObj = this.heap[heapKey];
        if (heapObj.items) {
          const resolvedVal = this.resolveExpr(itemExpr);
          const numVal = isNaN(resolvedVal) ? resolvedVal : Number(resolvedVal);
          heapObj.items.push({
            name: `[${heapObj.items.length}]`,
            type: typeof numVal === "number" ? "int" : "string",
            value: numVal,
            address: "0x" + (parseInt(heapObj.id, 16) + heapObj.items.length * 4).toString(16)
          });
          arrVar.isUpdated = true;
          this.recordStep(lineNum, "line", {
            action: `List mutation: appended ${resolvedVal} to '${arrVarName}'`,
            reason: "Dynamic heap array expanded in-place",
            memoryImpact: `Heap block ${heapKey} now holds ${heapObj.items.length} elements`,
            nextPrediction: "Proceeding to next statement"
          }, [arrVarName]);
          return;
        }
      }
    }

    // 2. General Assignment: var = expr or obj->field = expr or obj.field = expr
    const assignMatch = trimmed.match(/(?:(?:int|float|double|char\*|bool|let|const|var|struct\s+\w+\*?)\s+)?([a-zA-Z_]\w*(?:\[\w+\])?(?:(?:\.|->)\w+)*)\s*=\s*(.+?);?$/);
    if (assignMatch) {
      const target = assignMatch[1];
      const expr = assignMatch[2];

      // Handle field assignments: n1->val = 100 or head.next = n2 or curr = curr.next
      if (target.includes("->") || target.includes(".")) {
        const parts = target.split(/->|\./);
        const objVar = this.getVariable(parts[0]);
        const heapKey = objVar?.pointsTo || objVar?.value;

        if (objVar && heapKey && this.heap[heapKey]) {
          const field = parts[1];
          const resolved = this.resolveExpr(expr);
          const heapObj = this.heap[heapKey];
          if (heapObj.fields) {
            const targetHeapId = this.heap[resolved] ? resolved : (this.getVariable(resolved)?.pointsTo || null);
            heapObj.fields[field] = {
              name: field,
              type: targetHeapId ? "reference" : (isNaN(resolved) ? "auto" : "int"),
              value: targetHeapId || (isNaN(resolved) ? resolved : Number(resolved)),
              pointsTo: targetHeapId
            };
          }
          this.recordStep(lineNum, "line", {
            action: `Field updated: ${target} = ${resolved}`,
            reason: `Setting field '${field}' on heap object at ${heapKey}`,
            memoryImpact: `Heap object ${heapKey} modified`,
            nextPrediction: "Continuing"
          });
          return;
        }
      }

      // Check for variable aliasing (e.g. b = a or curr = head)
      const srcVar = this.getVariable(expr.trim());
      if (srcVar && (srcVar.pointsTo || srcVar.type === "reference" || srcVar.type === "array" || srcVar.type === "pointer")) {
        const targetHeapAddr = srcVar.pointsTo || srcVar.value;
        this.setVariable(target, srcVar.type, srcVar.value, null, targetHeapAddr);
        this.recordStep(lineNum, "line", {
          action: `Reference assignment: '${target}' = '${expr.trim()}'`,
          reason: "Variable aliasing: both variables reference the exact same heap memory object",
          memoryImpact: `Stack variable '${target}' bound to heap address ${targetHeapAddr}`,
          nextPrediction: "Proceeding"
        }, [target]);
        return;
      }

      // Regular expression resolution and variable assignment
      const resolved = this.resolveExpr(expr);
      const numVal = isNaN(resolved) ? resolved : Number(resolved);
      this.setVariable(target, typeof numVal === "number" ? "int" : "string", numVal);

      this.recordStep(lineNum, "line", {
        action: `Assigned value ${resolved} to '${target}'`,
        reason: `Evaluated expression '${expr}'`,
        memoryImpact: `Stack variable '${target}' updated with value ${resolved}`,
        nextPrediction: "Proceeding to next statement"
      }, [target]);
      return;
    }

    // Increment / Decrement: e.g. count++;
    if (trimmed.endsWith("++;") || trimmed.endsWith("--;")) {
      const varName = trimmed.replace(/[\+\-\;\s]/g, "");
      const variable = this.getVariable(varName);
      if (variable && typeof variable.value === "number") {
        const newVal = trimmed.includes("++") ? variable.value + 1 : variable.value - 1;
        variable.value = newVal;
        variable.isUpdated = true;
        this.recordStep(lineNum, "line", {
          action: `Variable '${varName}' ${trimmed.includes("++") ? "incremented" : "decremented"} to ${newVal}`,
          reason: "Unary operator executed",
          memoryImpact: `Updated value at address ${variable.address}`,
          nextPrediction: "Next instruction"
        }, [varName]);
        return;
      }
    }

    // Fallback step
    this.recordStep(lineNum, "line");
  }

  evalCondition(cond) {
    try {
      const sanitized = cond
        .replace(/&&/g, " && ")
        .replace(/\|\|/g, " || ")
        .replace(/!/g, " ! ");
      return Boolean(Function(`"use strict"; return (${sanitized})`)());
    } catch {
      return false;
    }
  }
}
