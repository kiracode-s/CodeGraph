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

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*";
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "2mb" }));

// Helper to spawn a python process with timeout
function runPythonProcess(cmd, scriptPath, code) {
  return new Promise((resolve, reject) => {
    const pyProcess = spawn(cmd, [scriptPath], {
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

    pyProcess.on("close", () => {
      resolve({ stdoutData, stderrData });
    });

    pyProcess.on("error", (err) => {
      reject(err);
    });

    pyProcess.stdin.write(code);
    pyProcess.stdin.end();
  });
}

// Safely execute python tracer with multi-environment binary fallback
async function tracePython(code) {
  const pythonScript = path.join(__dirname, "tracers", "python_tracer.py");
  const candidates = process.env.PYTHON_BIN
    ? [process.env.PYTHON_BIN]
    : process.platform === "win32"
    ? ["python", "python3", "py"]
    : ["python3", "python"];

  for (const cmd of candidates) {
    try {
      const { stdoutData, stderrData } = await runPythonProcess(cmd, pythonScript, code);
      if (stdoutData) {
        try {
          const parsed = JSON.parse(stdoutData);
          return parsed;
        } catch (e) {
          // JSON parse failed, treat as error below
        }
      }

      return {
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
      };
    } catch (err) {
      // Continue to next binary candidate if ENOENT
      continue;
    }
  }

  // Fallback to simulation engine if python executable not found or failed
  const engine = new DryRunEngine("python", code);
  return engine.run();
}

// C/C++ GCC check & execution with cross-platform binary handling
async function compileAndCheckGCC(code, isCpp = false) {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const id = "tutor_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const isWin = process.platform === "win32";
    const srcExt = isCpp ? ".cpp" : ".c";
    const exeExt = isWin ? ".exe" : ".out";
    const srcFile = path.join(tempDir, `${id}${srcExt}`);
    const exeFile = path.join(tempDir, `${id}${exeExt}`);

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

// Java compiler & execution check with sandboxed temporary directory
async function compileAndCheckJava(code) {
  return new Promise((resolve) => {
    const tempDir = os.tmpdir();
    const match = code.match(/(?:public\s+)?class\s+([A-Za-z0-9_]+)/);
    const className = match ? match[1] : "Main";
    const subDir = path.join(tempDir, "java_" + Date.now() + "_" + Math.floor(Math.random() * 10000));

    try {
      fs.mkdirSync(subDir, { recursive: true });
      const srcFile = path.join(subDir, `${className}.java`);
      fs.writeFileSync(srcFile, code, "utf-8");

      const compileProc = spawn("javac", [srcFile], { timeout: 5000 });
      let compileErr = "";
      compileProc.stderr.on("data", (chunk) => {
        compileErr += chunk.toString();
      });

      compileProc.on("close", (exitCode) => {
        if (exitCode !== 0) {
          try { fs.rmSync(subDir, { recursive: true, force: true }); } catch {}
          resolve({ success: false, compilerError: compileErr });
          return;
        }

        const runProc = spawn("java", ["-cp", subDir, className], { timeout: 3000 });
        let output = "";
        runProc.stdout.on("data", (d) => (output += d.toString()));
        runProc.on("close", () => {
          try { fs.rmSync(subDir, { recursive: true, force: true }); } catch {}
          resolve({ success: true, output });
        });
        runProc.on("error", () => {
          try { fs.rmSync(subDir, { recursive: true, force: true }); } catch {}
          resolve({ success: true, output: "" });
        });
      });

      compileProc.on("error", () => {
        try { fs.rmSync(subDir, { recursive: true, force: true }); } catch {}
        resolve({ success: true, skippedCompiler: true });
      });
    } catch (e) {
      resolve({ success: true, skippedCompiler: true });
    }
  });
}

// In-memory cache on server for high-speed sub-millisecond responses
const serverTraceCache = new Map();

// API: /api/visualize
app.post("/api/visualize", async (req, res) => {
  const { language = "python", code = "", options = {} } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "No code provided" });
  }

  const lang = language.toLowerCase();
  const cacheKey = `${lang}:${code}`;

  if (serverTraceCache.has(cacheKey)) {
    return res.json(serverTraceCache.get(cacheKey));
  }

  try {
    let resultTrace;

    if (lang === "python") {
      // Run native Python tracer
      resultTrace = await tracePython(code);
    } else if (lang === "c" || lang === "cpp") {
      // Step 1: Run dry run execution simulator to generate step-by-step memory/callstack frames
      const engine = new DryRunEngine(lang, code, options);
      const simulation = engine.run();

      // Step 2: In parallel, verify with GCC if available
      const gccResult = await compileAndCheckGCC(code, lang === "cpp");
      if (!gccResult.success && gccResult.compilerError) {
        const lineMatch = gccResult.compilerError.match(/:(\d+):\d+: error:\s*(.+)/);
        const errLine = lineMatch ? parseInt(lineMatch[1], 10) : 1;
        const errMsg = lineMatch ? lineMatch[2] : gccResult.compilerError;

        simulation.error = {
          type: "CompilerError",
          message: errMsg,
          line: errLine,
          explanation: `GCC detected compilation error: ${errMsg}`,
          suggestion: "Fix the syntax or declaration error indicated by the compiler."
        };
        simulation.status = "error";
      } else if (gccResult.success && typeof gccResult.output === "string" && gccResult.output.length > 0) {
        simulation.stdout = gccResult.output;
        if (simulation.steps && simulation.steps.length > 0) {
          simulation.steps[simulation.steps.length - 1].stdout = gccResult.output;
        }
      }
      resultTrace = simulation;
    } else if (lang === "java") {
      const engine = new DryRunEngine("java", code, options);
      const simulation = engine.run();

      const javaResult = await compileAndCheckJava(code);
      if (!javaResult.success && javaResult.compilerError) {
        const lineMatch = javaResult.compilerError.match(/:(\d+):\s*error:\s*(.+)/);
        const errLine = lineMatch ? parseInt(lineMatch[1], 10) : 1;
        const errMsg = lineMatch ? lineMatch[2] : javaResult.compilerError;

        simulation.error = {
          type: "JavaCompilerError",
          message: errMsg,
          line: errLine,
          explanation: `javac detected compilation error: ${errMsg}`,
          suggestion: "Fix the Java syntax or type error indicated by javac."
        };
        simulation.status = "error";
      } else if (javaResult.success && typeof javaResult.output === "string" && javaResult.output.length > 0) {
        simulation.stdout = javaResult.output;
        if (simulation.steps && simulation.steps.length > 0) {
          simulation.steps[simulation.steps.length - 1].stdout = javaResult.output;
        }
      }
      resultTrace = simulation;
    } else {
      // JavaScript and other languages
      const engine = new DryRunEngine(lang, code, options);
      resultTrace = engine.run();
    }

    if (serverTraceCache.size < 500) {
      serverTraceCache.set(cacheKey, resultTrace);
    }
    return res.json(resultTrace);
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

// Serve static client assets if built (Production Monolith mode)
const distPath = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(distPath)) {
  console.log(`[Tutor Backend] Production mode: Serving static client from ${distPath}`);
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CodeGraph Backend</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 3rem; line-height: 1.6; max-width: 640px; margin: 0 auto; color: #1f1f1f; background: #fbfbfa; }
            h2 { color: #1b7d5f; }
            code { background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <h2>CodeGraph API Server</h2>
          <p>Backend API status: <strong>Online</strong></p>
          <p>Frontend production bundle not found in <code>client/dist</code>. To build the frontend bundle, run:</p>
          <pre><code>npm run build</code></pre>
          <p><a href="/api/health">Verify /api/health endpoint</a></p>
        </body>
      </html>
    `);
  });
}

const server = app.listen(PORT, () => {
  console.log(`[Tutor Backend] Server listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("[Tutor Backend] SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[Tutor Backend] SIGINT received. Shutting down gracefully...");
  server.close(() => {
    process.exit(0);
  });
});
