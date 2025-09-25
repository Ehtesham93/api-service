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
    emailsvc: {
        url: "https://email-service.intellicar.in",
        sendEmailPath: "/api/v1/email/send",
        accountid:
            "EA_F927E60B708F20D0F35AD667D34B3F3A8B28AB332A9F3FB384E631968867A48E",
        apikey: "EB_25F98EB56D926AFDEE768417F1A1CD712B40E632FCD9B91501BBD5C3571D66B4",
    },
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
        baseurl: "http://prod-nemo3-api-fms-svc.intellicar:10004/api/v1/fms",
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
    enableServiceOnboarding: true
};
