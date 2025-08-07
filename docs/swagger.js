import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerSpec1 = yaml.load(
    readFileSync(join(__dirname, "./swagger.external.yaml"), "utf8")
);

const swaggerSpec2 = yaml.load(
    readFileSync(join(__dirname, "./swagger.internal.yaml"), "utf8")
);

export const swaggerDocs = (app) => {
  app.use(
    "/fms/api/v1/service/external/api-docs",
    swaggerUi.serveFiles(swaggerSpec1),
    swaggerUi.setup(swaggerSpec1)
  );

  app.get("/fms/api/v1/service/external/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec1);
  });

  app.use(
    "/fms/api/v1/service/internal/api-docs",
    swaggerUi.serveFiles(swaggerSpec2),
    swaggerUi.setup(swaggerSpec2)
  );

  app.get("/fms/api/v1/service/internal/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec2);
  });
};
