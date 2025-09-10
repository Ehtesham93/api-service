import { APIResponseError, APIResponseForbidden } from "./utils/responseutil.js";
import promiserouter from "express-promise-router";
import express from "express";
import bodyParser from "body-parser";
import compression from "compression";
import morgan from "morgan";
import requestIp from "request-ip";
import cors from "cors";
import axios from "axios";
import cookieParser from "cookie-parser";
// import fileUpload from "express-fileupload";
import { createTimeoutMiddleware } from "./utils/timeoututils.js";
import { stopPolling } from "./utils/authexternalutils.js";

export default class APIServer {
  constructor(apiroutehandlers, config, logger) {
    this.apiroutehandlers = apiroutehandlers;
    this.logger = logger;
    this.config = config;
    this.app = this.#getexpressapp();
  }

  Start(port) {
    this.app.use(createTimeoutMiddleware(this.config.timeout.requesttimeout));

    for (const eachhandler of this.apiroutehandlers) {
      const newrouter = promiserouter();
      eachhandler[1].RegisterRoutes(newrouter);
      this.app.use(eachhandler[0], newrouter);
    }

    this.app.use(this.#errornotfound);
    this.app.use(this.#errorhandler);

    const server = this.app.listen(port, () => {
      this.logger.info("App listening on port:" + port);
    });

    process.on("SIGINT", () => {
      stopPolling();
      this.#gracefulShutdown("SIGINT", server)
    });
    process.on("SIGTERM", () => {
      stopPolling();
      this.#gracefulShutdown("SIGTERM", server)
    });
  }

  // # Private functions...
  #getexpressapp() {
    const app = express();
    app.use(compression());
    app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
    app.use(bodyParser.json({ type: "application/*+json", limit: "50mb" }));
    app.use(bodyParser.json());
    app.use(bodyParser.raw({ type: "application/vnd.custom-type" }));
    app.use(
      morgan(
        ":remote-addr :method :url :status :res[content-length] - :response-time ms",
        { stream: { write: (x) => this.logger.info(x) } }
      )
    );
    const allowLocalhost = function (origin, callback) {
      const allowedOrigins = [
        /^http:\/\/localhost:\d+$/,
        /^https:\/\/localhost:\d+$/,
        /^https:\/\/.*\.mahindraelectric\.com:\d+$/,
        /^https:\/\/.*\.mahindralastmilemobility\.com:\d+$/,
      ];

      if (!origin) {return callback(null, true);}

      const isAllowed = allowedOrigins.some((pattern) =>
        pattern.test(origin)
      );
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    };

    app.use(
      cors({
        origin: allowLocalhost,
        credentials: true, // allow sending cookies
      })
    );
    app.use(cookieParser());
    app.use(requestIp.mw());
    // app.use(
    //   fileUpload({
    //     debug: true,
    //     limits: { fileSize: 1024 * 1024 * 1024 },
    //     useTempFiles: true,
    //     tempFileDir: "/tmp/",
    //     createParentPath: true,
    //     uriDecodeFileNames: true,
    //     safeFileNames: true,
    //     preserveExtension: 4,
    //     abortOnLimit: true,
    //     uploadTimeout: 15000,
    //   })
    // );
    app.all('/proxy/*', async (req, res) => {
      try {
        const targetUrl = req.path.replace(/^\/proxy\//, 'https://');
        if (!targetUrl.startsWith('https://')) {
          return res.status(400).json({ error: 'Invalid target URL' });
        }

        const forwardHeaders = {
          'Platform': req.headers['platform'] || req.headers['Platform'],
          'Source': req.headers['source'] || req.headers['Source'],
          'Type': req.headers['type'] || req.headers['Type'],
          'AppVersion': req.headers['appversion'] || req.headers['AppVersion'],
          'SdkVersion': req.headers['sdkversion'] || req.headers['SdkVersion'],
          'x-api-key': req.headers['x-api-key'],
          'Content-Type': req.headers['content-type'] || 'application/json',
          'Accept': req.headers['accept'] || 'application/json',
          'Authorization': req.headers['authorization'] || req.headers['Authorization']
        };

        const response = await axios({
          method: req.method,
          url: targetUrl + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
          headers: forwardHeaders,
          data: req.body,
          validateStatus: () => true,
        });

        res.status(response.status).set(response.headers).send(response.data);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
    return app;
  }

  #errornotfound(req, res, next) {
    // If we have reached here, we will throw an error..
    APIResponseForbidden(
      req,
      res,
      "FORBIDDEN_API",
      { path: req.path },
      "non-existing path"
    );
  }

  #errorhandler(err, req, res, next) {
    let errstr = JSON.stringify(err);

    if ("toString" in err) {
      errstr = err.toString();
    }

    APIResponseError(
      req,
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      errstr,
      "internal server error"
    );
  }

  #gracefulShutdown(signal, server) {
    try {
      if(!this.config.logToConsole){
        this.logger.info(`\nReceived ${signal}. Initiating graceful server shutdown...`);
        this.logger.stop();
        this.logger.flush();
      }
  
      server.close(() => {
        console.log(`\n ${signal} received. Server closed successfully.`);
        process.exit(0);
      });
    } catch (error) {
      console.log("Error in graceful shutdown", error);
      process.exit(1);
    }
  }
}
