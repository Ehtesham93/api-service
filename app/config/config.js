import stagingConfig from "./stg_config.js"
import developmentConfig from "./dev_config.js"
import localConfig from "./local_config.js"
let config = {};

console.log("APP_ENV: ", process.env.APP_ENV);

if (process.env.APP_ENV === "STAGING") {
    console.log("Using staging config");
    config = stagingConfig;
} else if (process.env.APP_ENV === "DEVELOPMENT") {
    console.log("Using development config");
    config = developmentConfig;
} else {
    console.log("Using local config");
    config = localConfig;
}

const ALLOWED_SCHEMAS = ['devfmscoresch', 'stgcoreschema', 'servicesch'];

function validateSchema(schemaName) {
  if (!ALLOWED_SCHEMAS.includes(schemaName)) {
    throw new Error(`Invalid or unsupported schema: ${schemaName}`);
  }
  return schemaName;
}

validateSchema(config.schemas.service);

export default config;