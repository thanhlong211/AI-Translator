const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { spawn } = require("child_process");

const OCR_OUTPUT_MARKER = "__OCR_JSON__";
const OCR_PROTOCOL_VERSION = 2;

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
}

function isoNow() {
  return new Date().toISOString();
}

function compactError(error) {
  const message =
    error instanceof Error
      ? error.message
      : String(error || "Unknown OCR worker error");

  return message.replace(/\s+/g, " ").trim().slice(0, 600);
}

class OcrWorkerManager {
  constructor(options = {}) {
    if (typeof options.getOcrDirectory !== "function") {
      throw new TypeError("getOcrDirectory is required.");
    }

    this.getOcrDirectory = options.getOcrDirectory;
    this.logger = options.logger || console;
    this.spawnImpl = options.spawnImpl || spawn;
    this.platform = options.platform || process.platform;
    this.env = options.env || process.env;

    this.startupTimeoutMs = clampInteger(
      this.env.AI_TRANSLATOR_OCR_STARTUP_TIMEOUT_MS,
      180000,
      10000,
      600000
    );

    this.requestTimeoutMs = clampInteger(
      this.env.AI_TRANSLATOR_OCR_REQUEST_TIMEOUT_MS,
      90000,
      5000,
      300000
    );

    this.maxQueue = clampInteger(
      this.env.AI_TRANSLATOR_OCR_MAX_QUEUE,
      24,
      1,
      200
    );

    this.maxAutomaticRestarts = clampInteger(
      this.env.AI_TRANSLATOR_OCR_MAX_RESTARTS,
      5,
      1,
      20
    );

    this.restartWindowMs = 60000;
    this.restartDelayMs = 750;

    this.child = null;
    this.lineReader = null;
    this.startPromise = null;
    this.startResolve = null;
    this.startReject = null;
    this.startTimer = null;
    this.restartTimer = null;
    this.intentionalStop = false;
    this.disposed = false;

    this.queue = [];
    this.activeJob = null;
    this.draining = false;
    this.nextRequestId = 1;
    this.restartTimestamps = [];

    this.state = "stopped";
    this.runtimeInfo = null;
    this.lastError = "";
    this.lastErrorAt = null;
    this.lastReadyAt = null;
    this.lastRequestAt = null;
    this.lastSuccessAt = null;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalRestarts = 0;
  }

  _log(level, message, detail) {
    const method =
      level === "error"
        ? "error"
        : level === "warn"
          ? "warn"
          : "log";

    if (!this.logger || typeof this.logger[method] !== "function") {
      return;
    }

    if (detail === undefined) {
      this.logger[method](`[OCR] ${message}`);
      return;
    }

    this.logger[method](`[OCR] ${message}`, detail);
  }

  _setError(error) {
    this.lastError = compactError(error);
    this.lastErrorAt = isoNow();
  }

  _runtimePaths() {
    const directory = path.resolve(this.getOcrDirectory());
    const workerPath = path.join(directory, "worker.py");

    const explicitPython = String(
      this.env.AI_TRANSLATOR_OCR_PYTHON || ""
    ).trim();

    const candidates = [];

    if (explicitPython) {
      candidates.push(path.resolve(explicitPython));
    }

    if (this.platform === "win32") {
      candidates.push(
        path.join(directory, "runtime", "python", "python.exe"),
        path.join(directory, ".venv", "Scripts", "python.exe")
      );
    } else {
      candidates.push(
        path.join(directory, "runtime", "python", "bin", "python3"),
        path.join(directory, ".venv", "bin", "python3"),
        path.join(directory, ".venv", "bin", "python")
      );
    }

    const pythonPath =
      candidates.find((candidate) => fs.existsSync(candidate)) ||
      candidates[0];

    return {
      directory,
      workerPath,
      pythonPath,
      pythonSource: explicitPython ? "override" : "bundled"
    };
  }

  _validateRuntime(paths) {
    if (!fs.existsSync(paths.workerPath)) {
      throw new Error(
        "Không tìm thấy OCR worker. Hãy cài lại AI Translator hoặc chạy script chuẩn bị OCR runtime."
      );
    }

    if (!paths.pythonPath || !fs.existsSync(paths.pythonPath)) {
      throw new Error(
        "Không tìm thấy Python runtime cho OCR. Hãy chạy desktop/ocr/prepare-runtime.ps1 trước khi test."
      );
    }
  }

  getHealth() {
    const paths = this._runtimePaths();

    return {
      status: this.state,
      ready: this.state === "ready" || this.state === "busy",
      busy: this.state === "busy",
      queued: this.queue.length,
      pid: this.child?.pid || null,
      protocol: this.runtimeInfo?.protocol || null,
      expectedProtocol: OCR_PROTOCOL_VERSION,
      runtime: {
        pythonConfigured: Boolean(
          paths.pythonPath && fs.existsSync(paths.pythonPath)
        ),
        workerConfigured: fs.existsSync(paths.workerPath),
        pythonSource: paths.pythonSource,
        pythonVersion: this.runtimeInfo?.pythonVersion || null,
        paddleOcrVersion: this.runtimeInfo?.paddleOcrVersion || null,
        paddlePaddleVersion: this.runtimeInfo?.paddlePaddleVersion || null,
        startupMs: this.runtimeInfo?.startupMs ?? null
      },
      limits: {
        requestTimeoutMs: this.requestTimeoutMs,
        maxQueue: this.maxQueue
      },
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      restartCount: this.totalRestarts,
      lastReadyAt: this.lastReadyAt,
      lastRequestAt: this.lastRequestAt,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError || null
    };
  }

  async start() {
    if (this.disposed) {
      throw new Error("OCR worker manager đã dừng.");
    }

    if (
      this.child &&
      !this.child.killed &&
      (this.state === "ready" || this.state === "busy")
    ) {
      return this.getHealth();
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    if (this.child && !this.child.killed) {
      this._terminateChild("stale-start");
    }

    const paths = this._runtimePaths();

    try {
      this._validateRuntime(paths);
    } catch (error) {
      this.state = "degraded";
      this._setError(error);
      throw error;
    }

    this.intentionalStop = false;
    this.state = "starting";
    this.runtimeInfo = null;

    this.startPromise = new Promise((resolve, reject) => {
      this.startResolve = resolve;
      this.startReject = reject;
    });

    this.startTimer = setTimeout(() => {
      const error = new Error(
        `OCR engine khởi động quá thời gian (${Math.round(this.startupTimeoutMs / 1000)} giây).`
      );

      this._setError(error);
      this.state = "degraded";
      this._rejectStart(error);
      this._terminateChild("startup-timeout");
    }, this.startupTimeoutMs);

    this.startTimer.unref?.();

    try {
      this.child = this.spawnImpl(
        paths.pythonPath,
        ["-X", "utf8", paths.workerPath],
        {
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...this.env,
            PYTHONUTF8: "1",
            PYTHONIOENCODING: "utf-8",
            PYTHONUNBUFFERED: "1"
          }
        }
      );
    } catch (error) {
      this._setError(error);
      this.state = "degraded";
      this._rejectStart(error);
      throw error;
    }

    this._log("info", "engine starting", {
      pythonSource: paths.pythonSource,
      startupTimeoutMs: this.startupTimeoutMs
    });

    const child = this.child;

    this.lineReader = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity
    });

    this.lineReader.on("line", (line) => {
      if (this.child === child) {
        this._handleLine(line);
      }
    });

    child.stderr.on("data", (data) => {
      if (this.child !== child) {
        return;
      }

      const text = String(data || "").trim();
      if (text) {
        this._log("warn", "worker stderr", text.slice(-1200));
      }
    });

    child.on("error", (error) => {
      if (this.child !== child) {
        return;
      }

      this._setError(error);
      this._log("error", "process error", compactError(error));
      this._handleProcessEnded(child, null, error);
    });

    child.on("close", (code, signal) => {
      this._handleProcessEnded(child, code, null, signal);
    });

    return this.startPromise;
  }

  _resolveStart() {
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }

    if (this.startResolve) {
      this.startResolve(this.getHealth());
    }

    this.startResolve = null;
    this.startReject = null;
    this.startPromise = null;
  }

  _rejectStart(error) {
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }

    if (this.startReject) {
      this.startReject(error);
    }

    this.startResolve = null;
    this.startReject = null;
    this.startPromise = null;
  }

  _handleLine(line) {
    if (!line.startsWith(OCR_OUTPUT_MARKER)) {
      const clean = String(line || "").trim();
      if (clean) {
        this._log("info", "worker", clean.slice(0, 1000));
      }
      return;
    }

    const raw = line.slice(OCR_OUTPUT_MARKER.length);
    let message;

    try {
      message = JSON.parse(raw);
    } catch (error) {
      this._log("warn", "invalid worker message", raw.slice(0, 500));
      return;
    }

    if (message.type === "fatal") {
      const error = new Error(
        String(message.error || "OCR engine không thể khởi động.")
      );
      this._setError(error);
      this.state = "degraded";
      this._rejectStart(error);
      return;
    }

    if (message.type === "ready") {
      const protocol = Number(message.protocol || 1);
      if (protocol !== OCR_PROTOCOL_VERSION) {
        const error = new Error(
          `OCR protocol không tương thích (worker=${protocol}, desktop=${OCR_PROTOCOL_VERSION}).`
        );
        this._setError(error);
        this.state = "degraded";
        this._rejectStart(error);
        this._terminateChild("protocol-mismatch");
        return;
      }

      this.runtimeInfo = {
        protocol,
        pythonVersion: message.pythonVersion || null,
        paddleOcrVersion: message.paddleOcrVersion || null,
        paddlePaddleVersion: message.paddlePaddleVersion || null,
        startupMs: Number(message.startupMs || 0)
      };

      this.state = this.activeJob ? "busy" : "ready";
      this.lastReadyAt = isoNow();
      this.lastError = "";
      this._resolveStart();
      this._log("info", "engine ready", this.runtimeInfo);
      this._drain();
      return;
    }

    if (message.type === "result") {
      this._finishActiveJob(message);
      return;
    }
  }

  request(imagePath, options = {}) {
    const cleanPath = String(imagePath || "").trim();
    if (!cleanPath) {
      return Promise.reject(new Error("Thiếu đường dẫn ảnh OCR."));
    }

    if (this.disposed) {
      return Promise.reject(new Error("OCR engine đã dừng."));
    }

    const outstanding = this.queue.length + (this.activeJob ? 1 : 0);
    if (outstanding >= this.maxQueue) {
      return Promise.reject(
        new Error("OCR đang bận. Vui lòng chờ tác vụ hiện tại hoàn tất rồi thử lại.")
      );
    }

    const id = String(this.nextRequestId++);
    const timeoutMs = clampInteger(
      options.timeoutMs,
      this.requestTimeoutMs,
      5000,
      300000
    );

    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        imagePath: cleanPath,
        timeoutMs,
        attempt: 0,
        resolve,
        reject,
        timeout: null,
        settled: false
      });

      this._drain();
    });
  }

  async _drain() {
    if (
      this.disposed ||
      this.draining ||
      this.activeJob ||
      this.queue.length === 0
    ) {
      return;
    }

    this.draining = true;

    try {
      try {
        await this.start();
      } catch (error) {
        const job = this.queue.shift();
        if (job) {
          this.totalFailures += 1;
          job.reject(error);
        }

        if (this.queue.length > 0) {
          this._scheduleRestart("start-failed");
        }
        return;
      }

      if (!this.child || this.child.killed || this.state === "degraded") {
        this._scheduleRestart("not-ready");
        return;
      }

      const job = this.queue.shift();
      if (!job) {
        return;
      }

      this.activeJob = job;
      this.state = "busy";
      this.lastRequestAt = isoNow();
      this.totalRequests += 1;

      job.timeout = setTimeout(() => {
        if (this.activeJob !== job || job.settled) {
          return;
        }

        const error = new Error(
          `OCR xử lý quá thời gian (${Math.round(job.timeoutMs / 1000)} giây).`
        );

        this._setError(error);
        this._retryOrRejectActive(error, "request-timeout");
        this._recycleWorker("request-timeout");
      }, job.timeoutMs);

      job.timeout.unref?.();

      const payload = JSON.stringify({
        id: job.id,
        action: "ocr",
        imagePath: job.imagePath
      }) + "\n";

      this.child.stdin.write(payload, "utf8", (error) => {
        if (!error || this.activeJob !== job || job.settled) {
          return;
        }

        this._setError(error);
        this._retryOrRejectActive(error, "stdin-write");
        this._recycleWorker("stdin-write");
      });
    } finally {
      this.draining = false;

      if (!this.activeJob && this.queue.length > 0 && !this.disposed) {
        queueMicrotask(() => this._drain());
      }
    }
  }

  _finishActiveJob(message) {
    const job = this.activeJob;
    if (!job || String(message.id) !== String(job.id)) {
      this._log("warn", "result without matching request", String(message.id || ""));
      return;
    }

    if (job.timeout) {
      clearTimeout(job.timeout);
    }

    this.activeJob = null;
    job.settled = true;

    if (!message.success) {
      this.totalFailures += 1;
      const error = new Error(
        String(message.error || "OCR worker thất bại.")
      );
      this._setError(error);
      job.reject(error);
    } else {
      this.lastSuccessAt = isoNow();
      this.lastError = "";
      job.resolve(message.result);
    }

    this.state = "ready";
    this._drain();
  }

  _retryOrRejectActive(error, reason) {
    const job = this.activeJob;
    if (!job) {
      return;
    }

    if (job.timeout) {
      clearTimeout(job.timeout);
      job.timeout = null;
    }

    this.activeJob = null;

    if (job.attempt < 1 && !this.disposed) {
      job.attempt += 1;
      job.id = String(this.nextRequestId++);
      this.queue.unshift(job);
      this._log("warn", "request retry scheduled", {
        reason,
        attempt: job.attempt + 1
      });
      return;
    }

    if (!job.settled) {
      job.settled = true;
      this.totalFailures += 1;
      job.reject(error);
    }
  }

  _handleProcessEnded(child, code, processError, signal) {
    if (this.child !== child) {
      return;
    }

    const wasIntentional = this.intentionalStop || this.disposed;
    const error = processError || new Error(
      `OCR worker đã dừng${code == null ? "" : ` (mã ${code})`}${signal ? `, signal ${signal}` : ""}.`
    );

    this._cleanupChildReferences();

    if (this.startPromise) {
      this._rejectStart(error);
    }

    if (this.activeJob) {
      this._retryOrRejectActive(error, "worker-exit");
    }

    if (wasIntentional) {
      this.state = "stopped";
      return;
    }

    this._setError(error);
    this.state = "degraded";
    this._log("warn", "engine stopped unexpectedly", compactError(error));
    this._scheduleRestart("worker-exit");
  }

  _cleanupChildReferences() {
    if (this.lineReader) {
      try {
        this.lineReader.close();
      } catch {
        // Ignore an already-closed readline interface.
      }
    }

    this.lineReader = null;
    this.child = null;
  }

  _restartBudgetAvailable() {
    const threshold = Date.now() - this.restartWindowMs;
    this.restartTimestamps = this.restartTimestamps.filter(
      (timestamp) => timestamp >= threshold
    );

    return this.restartTimestamps.length < this.maxAutomaticRestarts;
  }

  _scheduleRestart(reason) {
    if (this.disposed || this.intentionalStop || this.restartTimer) {
      return;
    }

    if (!this._restartBudgetAvailable()) {
      this.state = "degraded";
      this._setError(
        new Error("OCR engine dừng lặp lại quá nhiều lần. Hãy mở Settings > Nâng cao và khởi động lại OCR.")
      );
      this._log("error", "automatic restart limit reached");
      return;
    }

    this.restartTimestamps.push(Date.now());
    this.totalRestarts += 1;

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start()
        .then(() => this._drain())
        .catch((error) => {
          this._setError(error);
          this.state = "degraded";
          if (this.queue.length > 0) {
            this._scheduleRestart("restart-failed");
          }
        });
    }, this.restartDelayMs);

    this._log("warn", "automatic restart scheduled", reason);
  }

  _terminateChild(reason) {
    if (!this.child || this.child.killed) {
      return;
    }

    this._log("warn", "terminating worker", reason);
    try {
      this.child.kill();
    } catch {
      // Process may have already ended.
    }
  }

  _recycleWorker(reason) {
    this.state = "degraded";
    this._terminateChild(reason);
    this._scheduleRestart(reason);
  }

  async restart(reason = "manual") {
    if (this.disposed) {
      throw new Error("OCR worker manager đã dừng.");
    }

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    this.restartTimestamps = [];
    this.intentionalStop = true;

    if (this.activeJob) {
      const error = new Error("OCR engine đang được khởi động lại.");
      this._retryOrRejectActive(error, "manual-restart");
    }

    if (this.child && !this.child.killed) {
      try {
        this.child.stdin.write(
          JSON.stringify({ action: "shutdown" }) + "\n"
        );
      } catch {
        // Ignore and kill below.
      }
      this._terminateChild(reason);
    }

    this._cleanupChildReferences();
    this._rejectStart(new Error("OCR engine được khởi động lại."));
    this.intentionalStop = false;
    this.state = "stopped";
    this.totalRestarts += 1;

    const health = await this.start();
    this._drain();
    return health;
  }

  dispose() {
    this.disposed = true;
    this.intentionalStop = true;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }

    const error = new Error("AI Translator đang thoát.");

    if (this.activeJob && !this.activeJob.settled) {
      if (this.activeJob.timeout) {
        clearTimeout(this.activeJob.timeout);
      }
      this.activeJob.settled = true;
      this.activeJob.reject(error);
      this.activeJob = null;
    }

    while (this.queue.length) {
      const job = this.queue.shift();
      if (job && !job.settled) {
        job.settled = true;
        job.reject(error);
      }
    }

    if (this.child && !this.child.killed) {
      try {
        this.child.stdin.write(
          JSON.stringify({ action: "shutdown" }) + "\n"
        );
      } catch {
        // Ignore and kill below.
      }
      this._terminateChild("app-quit");
    }

    this._cleanupChildReferences();
    this.state = "stopped";
  }
}

module.exports = {
  OcrWorkerManager,
  OCR_PROTOCOL_VERSION,
  OCR_OUTPUT_MARKER
};
