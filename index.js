import config from "./app/config/config.js";
import PgPool from "./app/utils/pgpool.js";

import APIServer from "./app/apiserver.js";
import { swaggerDocs } from "./docs/swagger.js";

import HealthSvc from "./app/services/healthsvc/healthsvc.js";
import HealthHdlr from "./app/handlers/healthhdlr/healthhdlr.js";

import Wrapper from "./app/utils/wrappers.js";

import ServiceModSvc from "./app/services/servicemodsvc/servicemodsvc.js";
import ServiceModHdlr from "./app/handlers/servicemodhdlr/servicemodhdlr.js";

import { initializeServiceModDB, startPolling, updatePendingQueue } from "./app/utils/authexternalutils.js";

import { Logger } from "./lib/nemo3-lib-observability/index.js";

const logger = new Logger({
  environment: process.env.APP_ENV || "LOCAL",
  service: "nemo3-api-service-svc",
  instance: process.env.INSTANCE || "localhost",
  ip: process.env.IP || "127.0.0.1",
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
const healthSvcI = new HealthSvc();

// 2. Handlers...
const handlerloggerI = console;
const serviceModHdlrI = new ServiceModHdlr(serviceModSvcI, wrapperI, servicelogger, config);
const healthHdlrI = new HealthHdlr(healthSvcI);

const pathPrefix = config.pathPrefix;

// 3. Handler Map...
const apiRoutes = [ // TODO rename first fms to web
  [ pathPrefix + "/api/v1/fms/service/", serviceModHdlrI],
  [ pathPrefix + "/api/v1/fms/service/health/", healthHdlrI]
];

// 4. API Server...
const apiserverlogger = console;

const App = new APIServer(apiRoutes, config, apiserverlogger);

if(!config.logToConsole){
  App.app.use(logger.getMetrics().middleware());
  logger.start();
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

