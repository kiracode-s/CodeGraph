"""
Advanced Python Tracer for PythonTutor Advanced.
Executes user code with sys.settrace, capturing step-by-step:
- Stack frames (global & local scopes)
- Primitive and Heap variables (lists, dicts, custom objects, sets)
- Exact line numbers and control events
- Stdout accumulation
- Dynamic educational annotations
- Exception capture and diagnostics
"""

import sys
import json
import inspect
import types
import io

MAX_STEPS = 1000

class PythonTracer:
    def __init__(self, user_code):
        self.user_code = user_code
        self.steps = []
        self.step_count = 0
        self.stdout_buffer = io.StringIO()
        self.orig_stdout = sys.stdout
        self.last_stdout_len = 0
        self.error_info = None
        self.completed = False

    def is_user_frame(self, frame):
        # We only trace code executed in '<string>' or user script
        return frame.f_code.co_filename == '<string>'

    def format_value(self, val, heap_collector):
        # Primitives
        if val is None or isinstance(val, (int, float, bool, str)):
            return {
                "type": type(val).__name__,
                "value": val,
                "isReference": False
            }
        
        # Check if it is a module, function, or built-in to keep view clean
        if isinstance(val, (types.ModuleType, types.FunctionType, types.BuiltinFunctionType)):
            return {
                "type": "function",
                "value": f"<func {getattr(val, '__name__', str(val))}>",
                "isReference": False
            }
        
        # Heap objects: list, tuple, set, dict, custom instance
        obj_id = f"0x{id(val):x}"
        if obj_id not in heap_collector:
            val_type = type(val).__name__
            if isinstance(val, (list, tuple)):
                heap_collector[obj_id] = {
                    "id": obj_id,
                    "type": "list" if isinstance(val, list) else "tuple",
                    "typeName": val_type,
                    "items": []
                }
                # populate after adding to break circular references
                heap_collector[obj_id]["items"] = [
                    self.format_value(item, heap_collector) for item in val
                ]
            elif isinstance(val, dict):
                heap_collector[obj_id] = {
                    "id": obj_id,
                    "type": "dict",
                    "typeName": "dict",
                    "fields": {}
                }
                heap_collector[obj_id]["fields"] = {
                    str(k): self.format_value(v, heap_collector) for k, v in val.items()
                }
            elif isinstance(val, set):
                heap_collector[obj_id] = {
                    "id": obj_id,
                    "type": "set",
                    "typeName": "set",
                    "items": [self.format_value(item, heap_collector) for item in val]
                }
            elif hasattr(val, '__dict__'):
                # Custom class instance
                heap_collector[obj_id] = {
                    "id": obj_id,
                    "type": "instance",
                    "typeName": val_type,
                    "fields": {}
                }
                fields = {}
                for k, v in val.__dict__.items():
                    if not k.startswith('__'):
                        fields[k] = self.format_value(v, heap_collector)
                heap_collector[obj_id]["fields"] = fields
            else:
                return {
                    "type": val_type,
                    "value": str(val),
                    "isReference": False
                }

        return {
            "type": "reference",
            "value": obj_id,
            "targetId": obj_id,
            "isReference": True
        }

    def capture_state(self, frame, event, arg=None):
        if self.step_count >= MAX_STEPS:
            raise RuntimeError(f"Step limit of {MAX_STEPS} reached. Possible infinite loop detected!")

        self.step_count += 1
        current_stdout = self.stdout_buffer.getvalue()
        stdout_delta = current_stdout[self.last_stdout_len:]
        self.last_stdout_len = len(current_stdout)

        heap_collector = {}
        call_stack = []

        # Traverse frames up to root
        cur = frame
        while cur:
            if self.is_user_frame(cur):
                frame_name = cur.f_code.co_name
                is_global = frame_name == '<module>'
                display_name = "Global Frame" if is_global else f"{frame_name}()"

                variables = {}
                # Filter out standard internals
                raw_vars = cur.f_locals
                for var_name, var_val in raw_vars.items():
                    if var_name.startswith('__') and var_name.endswith('__'):
                        continue
                    variables[var_name] = self.format_value(var_val, heap_collector)

                call_stack.append({
                    "id": f"frame_{id(cur)}",
                    "name": display_name,
                    "line": cur.f_lineno,
                    "isGlobal": is_global,
                    "variables": variables
                })
            cur = cur.f_back

        # Reverse so global frame is first, current active frame is last
        call_stack.reverse()

        # Explanation logic
        curr_line = frame.f_lineno
        explanation = self.generate_explanation(curr_line, event, frame, arg)

        self.steps.append({
            "step": self.step_count,
            "line": curr_line,
            "event": event,
            "callStack": call_stack,
            "heap": heap_collector,
            "stdout": current_stdout,
            "stdoutDelta": stdout_delta,
            "explanation": explanation
        })

    def generate_explanation(self, line, event, frame, arg):
        action = f"Executing line {line}"
        reason = "Normal sequential execution"
        memory = "Evaluating expressions"
        next_pred = "Proceeding to next statement"

        if event == 'call':
            func_name = frame.f_code.co_name
            action = f"Call function '{func_name}()'"
            reason = f"Entering scope of function '{func_name}'"
            memory = f"New stack frame allocated for '{func_name}()'"
            next_pred = f"Executing first statement of '{func_name}()'"
        elif event == 'return':
            action = f"Return from function '{frame.f_code.co_name}()'"
            reason = f"Returned value: {repr(arg)}"
            memory = f"Stack frame for '{frame.f_code.co_name}()' will be popped and deallocated"
            next_pred = "Returning to caller"
        elif event == 'exception':
            exc_type, exc_val, _ = arg
            action = f"Exception raised: {exc_type.__name__}"
            reason = str(exc_val)
            memory = "Execution halted due to unhandled exception"
            next_pred = "Looking for exception handler"

        return {
            "action": action,
            "reason": reason,
            "memoryImpact": memory,
            "nextPrediction": next_pred
        }

    def trace_dispatch(self, frame, event, arg):
        if not self.is_user_frame(frame):
            return self.trace_dispatch
        
        if event in ('line', 'call', 'return', 'exception'):
            self.capture_state(frame, event, arg)

        return self.trace_dispatch

    def run(self):
        sys.stdout = self.stdout_buffer
        global_scope = {
            "__name__": "__main__",
            "__builtins__": __builtins__
        }

        try:
            compiled = compile(self.user_code, '<string>', 'exec')
            sys.settrace(self.trace_dispatch)
            exec(compiled, global_scope)
        except Exception as e:
            tb = sys.exc_info()[2]
            line_no = 1
            while tb:
                if tb.tb_frame.f_code.co_filename == '<string>':
                    line_no = tb.tb_lineno
                tb = tb.tb_next

            exc_name = type(e).__name__
            msg = str(e)

            suggestions = {
                "ZeroDivisionError": "Check the divisor expression to ensure it does not evaluate to zero.",
                "IndexError": "Check array/list length before accessing index. Remember indices start at 0.",
                "KeyError": "Verify that the key exists in the dictionary or use .get(key, default).",
                "TypeError": "Ensure the types being operated on are compatible.",
                "NameError": "Make sure variables or functions are defined before they are used.",
                "RecursionError": "Verify base case in recursive function to ensure recursion terminates."
            }

            self.error_info = {
                "type": exc_name,
                "message": msg,
                "line": line_no,
                "explanation": f"A {exc_name} occurred at line {line_no}: {msg}",
                "suggestion": suggestions.get(exc_name, "Review logic and variable values at the error line.")
            }
        finally:
            sys.settrace(None)
            sys.stdout = self.orig_stdout
            self.completed = True

        return {
            "language": "python",
            "status": "error" if self.error_info else "success",
            "totalSteps": len(self.steps),
            "stdout": self.stdout_buffer.getvalue(),
            "error": self.error_info,
            "steps": self.steps
        }

if __name__ == "__main__":
    import fileinput
    user_code = sys.stdin.read()
    tracer = PythonTracer(user_code)
    result = tracer.run()
    print(json.dumps(result))
