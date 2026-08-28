import config from "./app/config/config.js";
import PgPool from "./app/utils/pgpool.js";

import APIServer from "./app/apiserver.js";
import { swaggerDocs } from "./docs/swagger.js";

import HealthSvc from "./app/services/healthsvc/healthsvc.js";
import HealthHdlr from "./app/handlers/healthhdlr/healthhdlr.js";

import Wrapper from "./app/utils/wrappers.js";

import ServiceModSvc from "./app/services/servicemodsvc/servicemodsvc.js";
import ServiceModHdlr from "./app/handlers/servicemodhdlr/servicemodhdlr.js";
import ImpersonationLogUtil from "./app/utils/impersonationlogutil.js";
import {
  initializeServiceModDB,
  startPolling,
  updatePendingQueue,
  stopPolling,
} from "./app/utils/authexternalutils.js";
import { startDbConnectionMetrics } from "./app/utils/metricsutil.js";

import { randomUUID } from "crypto";
import { Logger } from "./lib/nemo3-lib-observability/index.js";

function resolveTaskId() {
  const fromEnv = process.env.TASK_ID?.trim();
  if (fromEnv && fromEnv !== "null" && fromEnv !== "undefined") {
    return fromEnv;
  }
  const arn = process.env.TASK_ARN?.trim();
  if (arn && arn !== "null" && arn !== "undefined") {
    const suffix = arn.split("/").pop();
    if (suffix) return suffix;
  }
  return randomUUID();
}

const taskId = resolveTaskId();

const logger = new Logger({
  environment: process.env.APP_ENV || "LOCAL",
  service: process.env.SERVICE_NAME || "nemo3-api-service-svc",
  instance: taskId,
  ip: process.env.TASK_IP || "127.0.0.1",
  loglevel: "info",
  logToConsole: config.logToConsole || false,
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  maxBackups: 5,
  checkIntervalMs: 2 * 1000,
  autoInstrument: true,
  flushInterval: 5000,
});

// 0. Config Related...
const apiserverport = config.apiserver.port;

// 1. Services...
const servicelogger = logger;
const pgPoolI = new PgPool(config.pgdb, servicelogger);
const wrapperI = new Wrapper(pgPoolI, config, servicelogger);

const serviceModSvcI = new ServiceModSvc(pgPoolI, servicelogger, config);
const healthSvcI = new HealthSvc(
  pgPoolI,
  servicelogger,
  config.logToConsole ? null : logger.getMetrics(),
);

// 2. Handlers...
let impersonationLogUtilI = new ImpersonationLogUtil(config, servicelogger);
const serviceModHdlrI = new ServiceModHdlr(
  serviceModSvcI,
  wrapperI,
  servicelogger,
  config,
  impersonationLogUtilI,
);
const healthHdlrI = new HealthHdlr(healthSvcI, servicelogger);

const pathPrefix = config.pathPrefix;

// 3. Handler Map...
const apiRoutes = [
  // TODO rename first fms to web
  [pathPrefix + "/api/v1/fms/service/", serviceModHdlrI],
  [pathPrefix + "/api/v1/fms/service/health/", healthHdlrI],
  ["/api/v1/health", healthHdlrI],
];

// 4. API Server...
const App = new APIServer(apiRoutes, config, servicelogger);

if (!config.logToConsole) {
  logger.getMetrics().instrumentDatabase?.(pgPoolI.Pool);
  logger.start();
  startDbConnectionMetrics(logger, { pgPoolI });
}

// 5. Initialize Swagger documentation
swaggerDocs(App.app);

// Initialize service module database and start polling if enabled
initializeServiceModDB(serviceModSvcI, config, logger);

// Start polling for service onboarding if enabled in configuration
if (config.enableServiceOnboarding) {
  startPolling();
  updatePendingQueue();
}

// Start the API server on the configured port
App.Start(apiserverport);

const gracefulShutdown = async () => {
  try {
    stopPolling();
    const pgErr = await pgPoolI.End();
    if (pgErr) {
      servicelogger.error("Database pool close error", pgErr);
    }
    if (!config.logToConsole) {
      servicelogger.info("Graceful shutdown initiated...");
      logger.stop();
      logger.flush();
    }
    process.exit(0);
  } catch (error) {
    servicelogger.error("Error during graceful shutdown", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown());
process.on("SIGTERM", () => gracefulShutdown());
process.on("uncaughtException", (error) => {
  servicelogger.error("uncaught exception", error);
});
process.on("unhandledRejection", (reason) => {
  if (reason instanceof Error) {
    servicelogger.error("unhandled rejection", reason);
    return;
  }
  servicelogger.error("unhandled rejection", { reason: String(reason) });
});
