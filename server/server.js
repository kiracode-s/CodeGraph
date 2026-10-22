import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { DryRunEngine } from "./tracers/dryRunEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Helper to safely execute python tracer
function tracePython(code) {
  return new Promise((resolve) => {
    const pythonScript = path.join(__dirname, "tracers", "python_tracer.py");
    const pyProcess = spawn("python", [pythonScript], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000 // 5 second hard limit
    });

    let stdoutData = "";
    let stderrData = "";

    pyProcess.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    pyProcess.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    pyProcess.on("close", (code) => {
      if (stdoutData) {
        try {
          const parsed = JSON.parse(stdoutData);
          resolve(parsed);
          return;
        } catch (e) {
          // If JSON parse failed
        }
      }

      // If python failed or error
      resolve({
        language: "python",
        status: "error",
        totalSteps: 0,
        stdout: "",
        error: {
          type: "ExecutionError",
          message: stderrData || "Python tracer failed to execute",
          line: 1,
          explanation: "The Python runtime encountered an error during parsing or tracing.",
          suggestion: "Check your Python syntax and ensure standard libraries are used."
        },
        steps: []
      });
    });

    pyProcess.on("error", (err) => {
      // Fallback to simulation engine if python executable not found or failed
      const engine = new DryRunEngine("python", code);
      resolve(engine.run());
    });

    pyProcess.stdin.write(code);
    pyProcess.stdin.end();
  });
}

// C/C++ GCC check & execution with auto-deletion of temp files
async function compileAndCheckGCC(code, isCpp = false) {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const id = "tutor_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const srcFile = path.join(tempDir, `${id}.${isCpp ? "cpp" : "c"}`);
    const exeFile = path.join(tempDir, `${id}.exe`);

    try {
      fs.writeFileSync(srcFile, code, "utf-8");
    } catch (e) {
      resolve({ success: false, error: "Failed to write temp source" });
      return;
    }

    const compiler = isCpp ? "g++" : "gcc";
    const compileProc = spawn(compiler, ["-o", exeFile, srcFile], { timeout: 4000 });

    let compileErr = "";
    compileProc.stderr.on("data", (chunk) => {
      compileErr += chunk.toString();
    });

    compileProc.on("close", (exitCode) => {
      // Immediately delete source file
      try {
        if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile);
      } catch {}

      if (exitCode !== 0) {
        // Compile error detected by real GCC/G++
        try {
          if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
        } catch {}

        resolve({
          success: false,
          compilerError: compileErr
        });
        return;
      }

      // Successfully compiled! Run and clean immediately
      const runProc = spawn(exeFile, [], { timeout: 3000 });
      let output = "";
      runProc.stdout.on("data", (d) => (output += d.toString()));
      runProc.on("close", () => {
        try {
          if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
        } catch {}
        resolve({
          success: true,
          output: output
        });
      });
      runProc.on("error", () => {
        try {
          if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
        } catch {}
        resolve({ success: true, output: "" });
      });
    });

    compileProc.on("error", () => {
      try {
        if (fs.existsSync(srcFile)) fs.unlinkSync(srcFile);
        if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
      } catch {}
      resolve({ success: true, skippedCompiler: true });
    });
  });
}

// API: /api/visualize
app.post("/api/visualize", async (req, res) => {
  const { language = "python", code = "", options = {} } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "No code provided" });
  }

  const lang = language.toLowerCase();

  try {
    if (lang === "python") {
      // Run native Python tracer
      const trace = await tracePython(code);
      return res.json(trace);
    }

    if (lang === "c" || lang === "cpp") {
      // Step 1: Run dry run execution simulator to generate step-by-step memory/callstack frames
      const engine = new DryRunEngine(lang, code, options);
      const simulation = engine.run();

      // Step 2: In parallel, verify with GCC if available
      const gccResult = await compileAndCheckGCC(code, lang === "cpp");
      if (!gccResult.success && gccResult.compilerError) {
        // Parse GCC compiler error line
        const lineMatch = gccResult.compilerError.match(/:(\d+):\d+: error:\s*(.+)/);
        const errLine = lineMatch ? parseInt(lineMatch[1], 10) : 1;
        const errMsg = lineMatch ? lineMatch[2] : gccResult.compilerError;

        simulation.error = {
          type: "CompilerError",
          message: errMsg,
          line: errLine,
          explanation: `MinGW GCC detected compilation error: ${errMsg}`,
          suggestion: "Fix the syntax or declaration error indicated by the compiler."
        };
        simulation.status = "error";
      }

      return res.json(simulation);
    }

    // Java, JavaScript, or other languages
    const engine = new DryRunEngine(lang, code, options);
    const trace = engine.run();
    return res.json(trace);
  } catch (error) {
    return res.status(500).json({
      language: lang,
      status: "error",
      totalSteps: 0,
      stdout: "",
      error: {
        type: "InternalServerException",
        message: error.message || "An unexpected error occurred during execution",
        line: 1,
        explanation: "The server encountered an issue processing the execution trace.",
        suggestion: "Try running with the browser execution engine or check code input."
      },
      steps: []
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    supportedLanguages: ["python", "c", "cpp", "java", "javascript"]
  });
});

app.listen(PORT, () => {
  console.log(`[Tutor Backend] Server listening on http://localhost:${PORT}`);
});
