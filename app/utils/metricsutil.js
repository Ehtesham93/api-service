const DB_METRICS_INTERVAL_MS = 10000;

function collectPostgres(gauge, pgPoolI) {
  const pool = pgPoolI?.Pool;
  if (!pool) return;
  gauge.set(pool.totalCount || 0, { db: "postgres", state: "total" });
  gauge.set(pool.idleCount || 0, { db: "postgres", state: "idle" });
  gauge.set(pool.waitingCount || 0, { db: "postgres", state: "waiting" });
  gauge.set(pgPoolI.activeQueries || 0, { db: "postgres", state: "active" });
}

export function startDbConnectionMetrics(logger, { pgPoolI } = {}) {
  const metrics = logger?.getMetrics?.();
  if (!metrics?.gauge) return;

  const gauge = metrics.gauge("db_connections", {
    help: "Number of database connections",
    labelNames: ["db", "state"],
  });

  const collect = () => {
    try {
      collectPostgres(gauge, pgPoolI);
    } catch (error) {
      logger.error("failed to collect postgres connection metrics", error);
    }
  };

  collect();
  return setInterval(collect, DB_METRICS_INTERVAL_MS);
}
