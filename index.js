import fs from "fs";
import winston from "winston";
import path from "path";
import DailyRotateFile from "winston-daily-rotate-file";

import config from "./app/config/config.js";
import PgPool from "./app/utils/pgpool.js";

import APIServer from "./app/apiserver.js";
import { swaggerDocs } from "./docs/swagger.js";

import HealthSvc from "./app/services/healthsvc/healthsvc.js";
import HealthHdlr from "./app/handlers/healthhdlr/healthhdlr.js";

import ServiceModSvc from "./app/services/servicemodsvc/servicemodsvc.js";
import ServiceModHdlr from "./app/handlers/servicemodhdlr/servicemodhdlr.js";
import RedisSvc from "./app/utils/redisutil.js";
import { initializeServiceModDB, startPolling } from "./app/utils/authexternalutils.js";


// 0. Config Related...
let apiserverport = config.apiserver.port;

// 1. Services...
let servicelogger = console;
let pgPoolI = new PgPool(config.pgdb, servicelogger);
let redisSvcI = new RedisSvc(config.redis, servicelogger);

let serviceModSvcI = new ServiceModSvc(pgPoolI, redisSvcI, servicelogger, config);
let healthSvcI = new HealthSvc();

// 2. Handlers...
let handlerloggerI = console;
let serviceModHdlrI = new ServiceModHdlr(serviceModSvcI, servicelogger);
let healthHdlrI = new HealthHdlr(healthSvcI);

let pathPrefix = config.pathPrefix;

// 3. Handler Map...
let apiRoutes = [ // TODO rename first fms to web
  [ pathPrefix + "/api/v1/fms/service/", serviceModHdlrI],
  [ pathPrefix + "/api/v1/fms/service/health/", healthHdlrI]
];

// 4. API Server...
let apiserverlogger = console;

let App = new APIServer(apiRoutes, config, apiserverlogger);

// 5. Initialize Swagger documentation
swaggerDocs(App.app);

initializeServiceModDB(serviceModSvcI, config);

startPolling();

App.Start(apiserverport);

