export default class ImpersonationLogUtil {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  ImpersonationLogMiddleware = () => {
    return (req, res, next) => {
      res.once("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.impersonationLogUtilI(req).catch((error) => {
            this.logger.error("Impersonation log failed:", error);
          });
        }
      });
      next();
    };
  };

  impersonationLogUtilI = async (req) => {
    if(!req.impersonation) {
      return;
    }
    const cookie = req.headers["Cookie"] || req.headers["cookie"];
    const action = `${req.method} ${req.baseUrl}${req.path}`;
    const actiondescription = req.body || null;
    const baseurl = this.config.impersonationlog.baseurl;
    const path = this.config.impersonationlog.path;
    try{
        const response = await axios.request({
            url: `${baseurl}/${path}`,
            method: "POST",
            data: {
                action: action,
                actiondescription: actiondescription,
            },
            headers: {
                "Cookie": cookie,
                "accept": "application/json"
            }
        });
        return response.data;
    } catch (error) {
        this.logger.error("Error in impersonationLogUtilI: ", error.toString());
        throw {
            errcode: "INTERNAL_SERVER_ERROR",
            errmsg: error?.response?.err?.msg || null
        };
    }
  };
}