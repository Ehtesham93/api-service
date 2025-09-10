export default {
    pgdb: {
        host: "rds-nemo-stage.c55qjjjzouym.ap-south-1.rds.amazonaws.com",
        port: 5432,
        database: "lmmintellicar",
        schema: "seedfmscoresch",
        user: "lmmintellicar_admin",
        password: "Z52DWfsAZIBtnOK",
    },
    apiserver: {
        port: 10004,
    },
    logToConsole: false,
    mahindrasvc: {
        baseurl: "https://api-mahindraforyou.mahindra.com/lmm",
        Accept: "application/json",
        ContentType: "application/json",
        Source: "LMM",
        Type: "CV",
        Platform: "ANDROID",
        SdkVersion: 1,
        AppVersion: 1,
        xapikey: "UmmC8ImZwM3n1B2CeC0lo7LMvNwRFh5i2tVWavSN",
    },
    schemas: {
        fmscoresch: "seedfmscoresch",
        service: "servicesch",
    },
    externalapi: {
        baseurl: "http://dev-nemo3-api-fms-svc.intellicar-frontend1:10004/api/v1/fms",
        referer: "https://stg-nemo.mahindralastmilemobility.com:2083"
    },
    csrf: {
        maxAgeInSeconds: 1800,
    },
    pathPrefix: "",
    hardCodeData: {
        mobileNumber: "7592800016",
        vinno: "MA1AD2ZA7PJF25158"
    },
    timeout: {
        axiostimeout: 60000,
        requesttimeout: 90000
    },
    enableServiceOnboarding: false
};
