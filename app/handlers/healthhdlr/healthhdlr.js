import {
  APIResponseInternalErr,
  APIResponseOK,
} from "../../utils/responseutil.js";

export default class HealthHdlr {
  constructor(healthSvcI, logger) {
    this.healthSvcI = healthSvcI;
    this.logger = logger;
  }

  GetHealthStatus = async (req, res) => {
    try {
      const healthStatus = await this.healthSvcI.GetHealthStatus();
      if (healthStatus.status !== "OK") {
        this.logger.error("health check failed", {
          errcode: "HEALTH_STATUS_ERR",
          message: JSON.stringify(healthStatus.checks),
        });
        return res.status(503).send({
          err: { errcode: "HEALTH_STATUS_ERR" },
          data: healthStatus,
          msg: "health check failed",
        });
      }
      return APIResponseOK(req, res, healthStatus, "Health Status Ready!");
    } catch (error) {
      this.logger.error("health status query failed", error);
      return APIResponseInternalErr(
        req,
        res,
        "HEALTH_STATUS_ERR",
        error.toString(),
        "health status query failed",
      );
    }
  };

  RegisterRoutes(router) {
    router.get("/check", this.GetHealthStatus);
  }
}
