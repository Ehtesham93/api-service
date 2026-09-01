export default class HealthSvc {
  constructor(pgPoolI, logger, metrics) {
    this.pgPoolI = pgPoolI;
    this.logger = logger;
    this.healthGauge = metrics?.gauge?.("health_status", {
      help: "Service health status (1=ok, 0=unhealthy)",
      labelNames: ["check"],
    });
  }

  async GetHealthStatus() {
    const postgres = await this.#checkPostgres();
    const ok = postgres.ok;
    this.#setGauge("postgres", postgres.ok);
    this.#setGauge("overall", ok);
    return {
      status: ok ? "OK" : "UNHEALTHY",
      timestamp: Date.now(),
      checks: { postgres },
    };
  }

  #setGauge(check, ok) {
    this.healthGauge?.set(ok ? 1 : 0, { check });
  }

  async #checkPostgres() {
    try {
      await this.pgPoolI.Query("SELECT 1");
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }
}
