import stagingConfig from "./stg_config.js"
import developmentConfig from "./dev_config.js"
import localConfig from "./local_config.js"
import productionConfig from "./prod_config.js"
let config = {};

console.log("APP_ENV: ", process.env.APP_ENV);
if (process.env.APP_ENV === "PRODUCTION") {
    console.log("Using production config");
    config = productionConfig;
}else if (process.env.APP_ENV === "STAGING") {
    console.log("Using staging config");
    config = stagingConfig;
} else if (process.env.APP_ENV === "DEVELOPMENT") {
    console.log("Using development config");
    config = developmentConfig;
} else {
    console.log("Using local config");
    config = localConfig;
}

const SECRET_OVERRIDES = [
  ["PGDB_USR", "pgdb", "user"],
  ["PGDB_PSW", "pgdb", "password"],
  ["MAHINDRA_XAPIKEY", "mahindrasvc", "xapikey"],
];

for (const [envName, section, field] of SECRET_OVERRIDES) {
  const value = process.env[envName];
  if (value && value.trim() && config[section]) {
    config[section][field] = value.trim();
  }
}

const ALLOWED_SCHEMAS = ['devfmscoresch', 'stgcoreschema', 'servicesch', 'prodfmscoresch'];

function validateSchema(schemaName) {
  if (!ALLOWED_SCHEMAS.includes(schemaName)) {
    throw new Error(`Invalid or unsupported schema: ${schemaName}`);
  }
  return schemaName;
}

validateSchema(config.schemas.service);

export default config;