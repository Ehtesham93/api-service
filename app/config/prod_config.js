export default {
    pgdb: {
        host: "nemo-rds-cluster.cluster-crxro9saq2rc.ap-south-1.rds.amazonaws.com",
        port: 5432,
        database: "lmm_intellicar_nemo3",
        schema: "prodfmscoresch",
        user: "lmmintellicar_admin",
        password: "wCUxbhkhYQt70RJ9",
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
        host: "lmm-intellicar-nemo3.lxuktw.clustercfg.aps1.cache.amazonaws.com",
        port: 6379,
    },
    schemas: {
        fmscoresch: "prodfmscoresch",
        service: "servicesch"
    },
    externalapi: {
        baseurl: "http://prod-nemo3-api-fms-internal-svc.intellicar:10004/api/v1/fms",
        referer: "https://nemo.mahindralastmilemobility.com"
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
    enableServiceOnboarding: true,
    impersonationlog: {
        baseurl: "http://prod-nemo3-api-fms-internal-svc.intellicar:10004",
        path: "/api/v1/platform/impersonation/insertlogs"
    },
};
