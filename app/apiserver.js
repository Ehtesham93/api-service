import { APIResponseError, APIResponseForbidden } from "./utils/responseutil.js";
import promiserouter from "express-promise-router";
import express from "express";
import bodyParser from "body-parser";
import compression from "compression";
import requestIp from "request-ip";
import cors from "cors";
import axios from "axios";
import cookieParser from "cookie-parser";
import { createTimeoutMiddleware } from "./utils/timeoututils.js";

export default class APIServer {
  constructor(apiroutehandlers, config, logger) {
    this.apiroutehandlers = apiroutehandlers;
    this.logger = logger;
    this.config = config;
    this.app = this.#getexpressapp();
  }

  Start(port) {
    // Add timeout middleware to handle request timeouts
    this.app.use(createTimeoutMiddleware(this.config.timeout.requesttimeout));

    // Register all route handlers with their respective paths
    for (const eachhandler of this.apiroutehandlers) {
      const newrouter = promiserouter();
      eachhandler[1].RegisterRoutes(newrouter);
      this.app.use(eachhandler[0], newrouter);
    }

    this.app.use((req, res, next) => this.#errornotfound(req, res, next));
    this.app.use((err, req, res, next) =>
      this.#errorhandler(err, req, res, next)
    );

    this.app.listen(port, () => {
      this.logger.info("App listening on port:" + port);
    });
  }

  // # Private functions...
  #getexpressapp() {
    const app = express();
    app.use((req, res, next) => {
      req.logger = this.logger;
      next();
    });
    app.use(compression());
    app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
    app.use(bodyParser.json({ type: "application/*+json", limit: "50mb" }));
    app.use(bodyParser.json());
    app.use(bodyParser.raw({ type: "application/vnd.custom-type" }));

    const metrics = this.logger.getMetrics?.();
    if (metrics?.middleware) {
      app.use(metrics.middleware());
    }

    const allowLocalhost = function (origin, callback) {
      const allowedOrigins = [
        /^https:\/\/localhost:\d+$/, // any port on localhost
        /^https:\/\/.*\.mahindralastmilemobility\.com(:\d+)?$/, // optional :port
      ];

      if (!origin) {
        return callback(null, true);
      }

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
    // Enable cookie parsing middleware
    app.use(cookieParser());
    // Enable request IP detection middleware
    app.use(requestIp.mw());
    app.use((req, res, next) => {
      const start = Date.now();
      const path = req.originalUrl || req.path;
      this.logger.info("HTTP request", {
        method: req.method,
        path,
        ip: req.clientIp || req.ip,
      });
      res.on("finish", () => {
        const status = res.statusCode;
        const meta = {
          method: req.method,
          path,
          status,
          duration_ms: Date.now() - start,
        };
        if (status >= 500) {
          this.logger.error("HTTP request failed", meta);
        } else if (status >= 400) {
          this.logger.warn("HTTP request client error", meta);
        } else {
          this.logger.info("HTTP request completed", meta);
        }
      });
      next();
    });
    app.all("/proxy/*", async (req, res) => {
      try {
        const targetUrl = req.path.replace(/^\/proxy\//, "https://");
        if (!targetUrl.startsWith("https://")) {
          return res.status(400).json({ error: "Invalid target URL" });
        }

        const forwardHeaders = {
          Platform: req.headers["platform"] || req.headers["Platform"],
          Source: req.headers["source"] || req.headers["Source"],
          Type: req.headers["type"] || req.headers["Type"],
          AppVersion: req.headers["appversion"] || req.headers["AppVersion"],
          SdkVersion: req.headers["sdkversion"] || req.headers["SdkVersion"],
          "x-api-key": req.headers["x-api-key"],
          "Content-Type": req.headers["content-type"] || "application/json",
          Accept: req.headers["accept"] || "application/json",
          Authorization:
            req.headers["authorization"] || req.headers["Authorization"],
        };

        const response = await axios({
          method: req.method,
          url:
            targetUrl +
            (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""),
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

  // Private method to handle 404 errors for non-existing routes
  #errornotfound(req, res, next) {
    this.logger.warn("No route found", {
      method: req.method,
      path: req.path,
    });
    APIResponseForbidden(
      req,
      res,
      "FORBIDDEN_API",
      { path: req.path },
      "non-existing path"
    );
  }

  #errorhandler(err, req, res, next) {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      this.logger.warn("invalid request body", {
        method: req.method,
        path: req.path,
      });
      return APIResponseError(
        req,
        res,
        400,
        "INPUT_ERROR",
        null,
        "Invalid request"
      );
    }
    this.logger.error("APIServer Error", err, {
      method: req.method,
      path: req.path,
    });
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
}
