export default {
    pgdb: {
        host: "lmm.stgdb.nemo3",
        port: 5432,
        database: "lmmintellicar",
        schema: "stgfmscoresch",
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
    redis: {
        host: "lmm-intellicar-cluster.t9kbdt.clustercfg.aps1.cache.amazonaws.com",
        port: 6379,
    },
    schemas: {
        fmscoresch: "stgfmscoresch",
        service: "servicesch"
    },
    externalapi: {
        baseurl: "http://stg-nemo3-api-fms-internal-svc.intellicar-frontend1:10004/api/v1/fms",
        referer: "https://stg-nemo.mahindralastmilemobility.com:8443"
    },
    csrf: {
        maxAgeInSeconds: 1800,
    },
    pathPrefix: "",
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
        baseurl: "http://stg-nemo3-api-fms-internal-svc.intellicar-frontend1:10004",
        path: "/api/v1/platform/impersonation/insertlogs"
    },
};
