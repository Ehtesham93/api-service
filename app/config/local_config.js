export default {
    pgdb: {
        host: "mahindra-tunnel.intellicar.io",
        port: 22041,
        database: "lmmintellicar",
        schema: "devfmscoresch",
        user: "lmmintellicar_admin",
        password: "Z52DWfsAZIBtnOK",
    },
    apiserver: {
        port: 10005,
    },
    logToConsole: true,
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
        fmscoresch: "devfmscoresch",
        service: "servicesch",
    },
    externalapi: {
        baseurl: "https://stg-nemo.mahindralastmilemobility.com:2083/api/v1/fms",
        referer: "https://stg-nemo.mahindralastmilemobility.com:2083"
    },
    pathPrefix: "",
    csrf: {
        maxAgeInSeconds: 1800,
    },
    hardCodeData: {
        mobileNumber: "7592800016",
        vinno: "MA1AD2ZA7PJF25158",
        accidentalServiceImg: "https://d8zm4ywgfpzys.cloudfront.net/nemo3-service-images/servicetypes/accidental/accidental.png",
        repairServiceImg: "https://d8zm4ywgfpzys.cloudfront.net/nemo3-service-images/servicetypes/repair/repair.png",
        scheduledServiceImg: "https://d8zm4ywgfpzys.cloudfront.net/nemo3-service-images/servicetypes/scheduled/scheduled.png"
    },
    timeout: {
        axiostimeout: 60000,
        requesttimeout: 90000
    },
    enableServiceOnboarding: false,
    impersonationlog: {
        baseurl: "http://dev-nemo3-api-fms-internal-svc.intellicar-frontend1:10004",
        path: "/api/v1/platform/impersonation/insertlogs"
    },
};
