import fs from "fs";
import path from "path";

const BASE_PATH = "/observability";
const ROTATED_PATH = "/rotated_logs/";

let logRotatorConfig = {
  service: "default-service",
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxBackups: 5,
  checkIntervalMs: 2 * 1000, // 2 seconds
  logToConsole: false,
  logFiles: [],
  logId: "",
};

let rotatedDir = "";
let rotationInterval = null;
let maxAgeHours = 12 * 60 * 60 * 1000; // 12 hours

function getLogFilePath(service, environment, logId) {
  // service already includes env prefix (e.g. prod-nemo3-api-otp-svc)
  return path.resolve(
    BASE_PATH + "/" + service + "/logs/log-" + logId + ".log"
  );
}

function getMetricsFilePath(service, environment, logId) {
  // service already includes env prefix (e.g. prod-nemo3-api-otp-svc)
  return path.resolve(
    BASE_PATH + "/" + service + "/logs/metrics-" + logId + ".log"
  );
}

function getRotatedDirPath(service, environment) {
  // service already includes env prefix (e.g. prod-nemo3-api-otp-svc)
  return path.resolve(BASE_PATH + "/" + service + ROTATED_PATH);
}

function setupLogRotator({
  service = "default-service",
  maxSizeBytes = 10 * 1024 * 1024,
  maxBackups = 5,
  checkIntervalMs = 2 * 1000,
  logToConsole = false,
  environment = "LOCAL",
  logId = "",
} = {}) {
  logRotatorConfig = {
    service,
    maxSizeBytes,
    maxBackups,
    checkIntervalMs,
    logToConsole,
    environment,
    logFiles: [],
    logId,
  };

  if (logToConsole) {
    return;
  }
  rotatedDir = getRotatedDirPath(service, environment);
  logRotatorConfig.rotatedDir = rotatedDir;
  logRotatorConfig.logFiles.push(getLogFilePath(service, environment, logId));
  logRotatorConfig.logFiles.push(
    getMetricsFilePath(service, environment, logId)
  );
  console.log(logRotatorConfig.logFiles);
  console.log(rotatedDir);
  // Create rotated logs directory if it doesn't exist
  if (!fs.existsSync(rotatedDir)) {
    fs.mkdirSync(rotatedDir, { recursive: true });
  }
}

function rotateLogFile(logFile, rotatedDir, maxSizeBytes, maxBackups) {
  try {
    if (!fs.existsSync(logFile)) return;
    const { size } = fs.statSync(logFile);
    if (size < maxSizeBytes) return;

    const baseName = path.basename(logFile);

    // Delete the oldest backup if it exists
    const oldest = path.join(rotatedDir, `${baseName}.${maxBackups}`);
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest);
    }

    // Shift backups: .4 -> .5, .3 -> .4, etc.
    for (let i = maxBackups - 1; i >= 1; i--) {
      const src = path.join(rotatedDir, `${baseName}.${i}`);
      const dest = path.join(rotatedDir, `${baseName}.${i + 1}`);
      if (fs.existsSync(src)) {
        fs.renameSync(src, dest);
      }
    }

    // Move current log file to .1 in rotated dir
    const rotated = path.join(rotatedDir, `${baseName}.1`);
    fs.renameSync(logFile, rotated);

    // Create a new empty log file
    fs.closeSync(fs.openSync(logFile, "w"));
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Error rotating ${logFile}:`,
      err
    );
  }
}

function checkAndRotateAll() {
  for (const logFile of logRotatorConfig.logFiles) {
    rotateLogFile(
      logFile,
      logRotatorConfig.rotatedDir,
      logRotatorConfig.maxSizeBytes,
      logRotatorConfig.maxBackups
    );
  }
}

function cleanupOldFiles() {
  try {
    // service already includes env prefix (e.g. prod-nemo3-api-otp-svc)
    const logsDir = path.resolve(
      BASE_PATH + "/" + logRotatorConfig.service + "/logs"
    );
    const rotatedLogsDir = path.resolve(
      BASE_PATH + "/" + logRotatorConfig.service + "/rotated_logs"
    );

    const maxAgeMs = maxAgeHours;
    const cutoffTime = Date.now() - maxAgeMs;

    let deletedCount = 0;

    // ---------- CLEAN LOGS DIR ----------
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);

      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        if (
          stats.isFile() &&
          (file.startsWith("log-") || file.startsWith("metrics-"))
        ) {
          if (stats.mtime.getTime() < cutoffTime) {
            try {
              fs.unlinkSync(filePath);
              deletedCount++;
              console.log(
                `[${new Date().toISOString()}] Deleted log file: ${filePath}`
              );
            } catch (err) {
              console.error(`Error deleting ${filePath}`, err);
            }
          }
        }
      }
    }

    // ---------- CLEAN ROTATED LOGS DIR ----------
    if (fs.existsSync(rotatedLogsDir)) {
      const rotatedFiles = fs.readdirSync(rotatedLogsDir);

      for (const file of rotatedFiles) {
        const filePath = path.join(rotatedLogsDir, file);
        const stats = fs.statSync(filePath);

        // rotated files look like: log-xyz.log.1, metrics-xyz.log.2
        if (stats.isFile()) {
          if (stats.mtime.getTime() < cutoffTime) {
            try {
              fs.unlinkSync(filePath);
              deletedCount++;
              console.log(
                `[${new Date().toISOString()}] Deleted rotated file: ${filePath}`
              );
            } catch (err) {
              console.error(`Error deleting rotated file ${filePath}`, err);
            }
          }
        }
      }
    }

    if (deletedCount > 0) {
      console.log(
        `[${new Date().toISOString()}] Cleanup completed: ${deletedCount} files deleted`
      );
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error during cleanup:`, err);
  }
}

function startLogRotator() {
  if (rotationInterval) {
    return;
  }

  if (logRotatorConfig.logFiles.length === 0) {
    return;
  }

  rotationInterval = setInterval(
    checkAndRotateAll,
    logRotatorConfig.checkIntervalMs
  );

  // Also check immediately on start
  checkAndRotateAll();

  // Run cleanup immediately on start
  cleanupOldFiles();

  console.log(`[${new Date().toISOString()}] Log rotator started`);
}

function stopLogRotator() {
  if (rotationInterval) {
    clearInterval(rotationInterval);
    rotationInterval = null;
    console.log(`[${new Date().toISOString()}] Log rotator stopped`);
  } else {
    console.log(`[${new Date().toISOString()}] Log rotator was not running`);
  }
}

export { setupLogRotator, startLogRotator, stopLogRotator };
export default { setupLogRotator, startLogRotator, stopLogRotator };
