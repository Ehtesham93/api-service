export default {
    pgdb: {
        host: "lmm.stgdb.nemo3",
        port: 5432,
        database: "lmmintellicar",
        schema: "devfmscoresch",
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
        fmscoresch: "devfmscoresch",
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
        vinno: "MA1AD2ZA7PJF25158",
        accidentalServiceImg: "https://d8zm4ywgfpzys.cloudfront.net/nemo3-service-images/servicetypes/accidental/accidental.png",
        repairServiceImg: "https://d8zm4ywgfpzys.cloudfront.net/nemo3-service-images/servicetypes/repair/repair.png",
        scheduledServiceImg: "https://d8zm4ywgfpzys.cloudfront.net/nemo3-service-images/servicetypes/scheduled/scheduled.png"
    },
    timeout: {
        axiostimeout: 60000,
        requesttimeout: 90000
    },
    enableServiceOnboarding: false
};
