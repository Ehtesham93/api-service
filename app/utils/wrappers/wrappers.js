import axios from "axios";
import config from '../../config/config.js';
import PgPool from "../pgpool.js";
import https from 'https';
import { handleErrorMessage } from '../util.js';


const agent = new https.Agent({
    rejectUnauthorized: false, // disables cert validation — insecure!
});

axios.defaults.timeout = config.timeout.axiostimeout;

let servicelogger = console;
let pgPoolI = new PgPool(config.pgdb, servicelogger);

export async function getAuthToken(params, requestId) {
    try {
        if (!params.muserid) {
            throw new Error('userid missing/required');
        }

        const path = "/user/v2/auth/token";
        const METHOD = "POST";
        const response = await makeHttpRequest(path, { userId: params.muserid }, METHOD, null, requestId);
        return response.data.authToken;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to process the request, please try again.";
    }
}

export async function onboardExternalUser(params, requestId) {
    try {
        let req_params = ["userId", "mobileNumber", "flow", "isWhatsAppConsented", "registrationNumber", "chassisNumber", "modelGroup", "modelDescription"]
        if (Object.keys(params).length !== req_params.length || !req_params.every(key => Object.keys(params).includes(key))) {
            throw new Error('invalid/missing parameters');
        }
        const path = "/user/v2/auth/external";
        const METHOD = "POST";
        const response = await makeHttpRequest(path, params, METHOD, null, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to onboard the external user.";
    }
}

// export async function refreshAuthToken(params, requestId) {
//     try {
//         if (!params.refreshToken) {
//             throw new Error('refreshToken/accessToken is missing/required');
//         }

//         const response = await makeHttpRequest('/user/v2/auth/refresh-token', null, 'POST', null, requestId, { "key": "AuthToken", "value": params.refreshToken });
//         return response;
//     } catch (error) {
//         throw error;
//     }
// }

export async function getKilometers(params, token, requestId) {
    try {
        const requiredFields = ["mobileNumber", "chassisNumber"];
        if (Object.keys(params).length !== requiredFields.length || !requiredFields.every(key => key in params)) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/master/service-booking/kilometers";
        const METHOD = "POST";
        const response = await makeHttpRequest(path, params, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the kilometers list.";
    }
}

export async function getDealerServiceSlots(params, token, requestId) {
    try {
        const requiredFields = ["mobileNumber", "parentCode", "locationCode", "date", "chassis"];
        if (Object.keys(params).length !== requiredFields.length || !requiredFields.every(key => key in params)) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/master/service-booking/dealers/slots";
        const METHOD = "POST";
        const response = await makeHttpRequest(path, params, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the dealer service slots.";
    }
}

export async function searchNearestDealers(params, token, requestId) {
    try {
        const requiredFields = [
            "itemIndex",
            "modelGroupDesc",
            "pageSize",
            "searchFilter",
            "dealerType",
            "latitude",
            "longitude"
        ];

        if (Object.keys(params).length !== requiredFields.length || !requiredFields.every(key => key in params)) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/master/service-booking/dealers/search/nearest";
        const METHOD = "POST";
        const response = await makeHttpRequest(path, params, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to search the nearest dealers.";
    }
}

export async function searchDealers(params, token, requestId) {
    try {
        const requiredFields = [
            "itemIndex",
            "chassisNumber",
            "mobileNumber",
            "modelDesc",
            "pageSize",
            "searchFilter"
        ];

        if (Object.keys(params).length !== requiredFields.length || !requiredFields.every(key => key in params)) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/master/service-booking/dealers/search";
        const METHOD = "POST";
        const response = await makeHttpRequest(path, params, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to search the dealers.";
    }
}

export async function getDealers(params, token, requestId) {
    try {
        const requiredFields = [
            "chassis",
            "latitude",
            "longitude",
            "mobileNumber",
            "modelDesc"
        ];

        if (Object.keys(params).length !== requiredFields.length || !requiredFields.every(key => key in params)) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/master/service-booking/dealers";
        const METHOD = "POST";
        const response = await makeHttpRequest(path, params, METHOD, token, requestId);
        return response;
    } catch (error) {  
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the dealers list.";
    }
}

export async function getCancellationReasons(token, requestId) {
    try {
        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/master/service-booking/cancellation-reasons";
        const METHOD = "GET";

        const response = await makeHttpRequest(path, null, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the cancellation reasons.";
    }
}

export async function getAdditionalJobs(modelDesc, token, requestId) {
    try {
        if (!modelDesc) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const query = `?modelDesc=${encodeURIComponent(modelDesc)}`;
        const path = "/master/service-booking/additional-jobs" + query;
        const METHOD = "GET";
        const response = await makeHttpRequest(path, null, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the additional jobs.";
    }
}

export async function getSOSReasons(model, token, requestId) {
    try {
        if (!model) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const query = `?model=${encodeURIComponent(model)}`;
        const path = "/master/rsa/sos/reasons" + query; 
        const METHOD = "GET";

        const response = await makeHttpRequest(path, null, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the SOS reasons.";
    }
}


export async function getShieldSchemes(params, token, requestId) {
    try {
        const requiredParams = [
            "mobileNumber",
            "chassisNumber",
            "modelGroupDesc",
            "enteredKm",
            "emailId"
        ];

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const isValid = requiredParams.every(key => params.hasOwnProperty(key));
        if (!isValid) {
            throw new Error("Please provide valid parameters for external API call");
        }

        const path = "/rsa-shield-other/shield/schemes";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );

        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the RSA shield schemes.";
    }
}

export async function getShieldPaymentMetadata(params, token, requestId) {
    try {
        const requiredParams = [
            "address",
            "chassisNumber",
            "customerId",
            "dmsAmount",
            "email",
            "lastServiceKm",
            "mobileNumber",
            "name",
            "odometerReading",
            "purchaseDate",
            "registrationNumber",
            "schemeCategory",
            "schemeCode",
            "serviceTax",
            "shieldAmount",
            "shieldOption",
            "shieldValidFromDate",
            "shieldValidUpToDate",
            "shieldValidUpToKM",
            "vehicleName",
            "shieldDiscount"
        ];

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const isValid = requiredParams.every(key => params.hasOwnProperty(key));
        if (!isValid) {
            throw new Error("Please provide valid parameters for external API call");
        }

        const path = "/rsa-shield-other/shield/payment/metadata";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );

        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the RSA shield payment metadata.";
    }
}

export async function getServiceCostEstimations(params, token, requestId) {
    try {
        const requiredParams = [
            "mobileNumber",
            "chassisNumber",
            "selectedKM"
        ];

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const isValid = requiredParams.every(key => params.hasOwnProperty(key));
        if (!isValid) {
            throw new Error("Please provide valid parameters for external API call");
        }

        const path = "/rsa-shield-other/service-booking/estimations";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );

        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the service cost estimations.";
    }
}

export async function sendSosRequest(params, token, requestId) {
    try {
        const requiredParams = [
            "name",
            "mobileNumber",
            "chassisNumber",
            "latitude",
            "longitude",
            "sosSource",
            "message"
        ];

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const isValid = requiredParams.every(key => params.hasOwnProperty(key));
        if (!isValid) {
            throw new Error("Please provide valid parameters for external API call");
        }

        const path = "/rsa-shield-other/rsa/sos";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );

        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to send the SOS request.";
    }
}

export async function getRsaSchemes(params, token, requestId) {
    try {
        const requiredParams = [
            "mobileNumber",
            "chassisNumber",
            "modelGroupDesc"
        ];

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const isValid = requiredParams.every(key => params.hasOwnProperty(key));
        if (!isValid) {
            throw new Error("Please provide valid parameters for external API call");
        }

        const path = "/rsa-shield-other/rsa/schemes";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );

        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);
        throw error?.response?.data?.message || "Unable to fetch the RSA schemes.";
    }
}


export async function getRsaPaymentMetadata(params, token, requestId) {
    try {
        const requiredParams = [
            "mobileNumber",
            "chassisNumber",
            "customerId",
            "emailId",
            "name",
            "rsaPlan",
            "rsaAmount",
            "rsaAmountWithTax",
            "rsaAmountWithoutTax",
            "rsaDiscount",
            "rsaValidFromDate",
            "rsaValidUpToDate",
            "registrationNumber",
            "saleDate",
            "schemeCode",
            "schemeName",
            "serviceTax",
            "vehicleName"
        ];


        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const isValid = requiredParams.every(key => params.hasOwnProperty(key));
        if (!isValid) {
            throw new Error("Please provide valid parameters for external API call");
        }

        const path = "/rsa-shield-other/rsa/payment/metadata";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );

        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message); 
        throw error?.response?.data?.message || "Unable to fetch the RSA payment metadata.";
    }
}

export async function additionalJobs(params, token, requestId) {
    try {
        if (!params.modelDesc) {
            throw new Error('Please provide valid parameters for external API call');
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/master/service-booking/additional-jobs" + `?modelDesc=${params.modelDesc}`;
        const METHOD = "GET";

        const response = await makeHttpRequest(
            path,
            null,
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the additional jobs.";
    }
}

export async function bookServiceRequest(params, token, requestId) {
    try {
        const requiredFields = [
            "bookingType",
            "chassisNumber",
            "locationCode",
            "mobileNumber",
            "modelDesc",
            "parentGroup",
            "serviceType",
            "slot"
        ];
    
        for (const field of requiredFields) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
    
        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/service-booking";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            {
                ...params,
                "dropAddress": "",
                "maxiCare": [],
                "pickUpAddress": "",
                "scheduledJobs": [],
                "serviceNotes": [
                    "Nemo3.0"
                ],
            },
            METHOD,
            token,
            requestId,
            [{ "key": "ScMileId", "value": 1 }]
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to book the service.";
    }
}

export async function getServiceBookingStatus(params, token, requestId) {
    const requiredFields = ["mobileNumber", "chassisNumber"];

    try {

        for (const field of requiredFields) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/service-booking/status";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the service booking status for the vehicle.";
    }
}

export async function getServiceHistory(params, token, requestId) {
    const requiredFields = ["mobileNumber", "chassisNumber", "isThisYear"];
    try {
        for (const field of requiredFields) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/service-booking/repair-orders/all" + `?isThisYear=${params.isThisYear}`;
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            { mobileNumber: params.mobileNumber, chassisNumber: params.chassisNumber },
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the service history for the vehicle.";
    }
}

export async function fetchUserVehicleDetails(params, token, requestId) {
    const requiredFields = ["mobileNumber", "isOwnedVehicle", "chassisNumber"];

    try {

        for (const field of requiredFields) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/user/v2/vehicle";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the vehicle details.";
    }
}


export async function fetchAppointmentDetailsFromMobile(params, token, requestId) {
    const requiredFields = ["mobileNumber", "preInvoiceRoOpenDaysBefore"];

    try {

        for (const field of requiredFields) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/service-booking/appointments/detailFromMobile";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the appointment details.";
    }
}

export async function cancelAppointment(params, token, requestId) {
    const requiredFields = ["appointmentId", "chassisNumber", "dmsBookingId", "mobileNumber", "reason", "comments"];

    try {
        for (const field of requiredFields) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/service-booking/appointments/status";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to cancel the appointment.";
    }
}

export async function getVehicleDetails(params, token, requestId) {
    const requiredFields = ["mobileNumber", "chassisNumber", "isOwnedVehicle"];

    try {
        for (const field of requiredFields) {
            if (params[field] === undefined || params[field] === null) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        const path = "/user/v2/vehicle";
        const METHOD = "POST";

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the vehicle details.";
    }
}

export async function getNearestDealers(params, token, requestId) {
    const requiredFields = [
        "modelGroupDesc",
        "pageSize",
        "searchFilter",
        "dealerType",
        "latitude",
        "longitude"
    ];
    try {
        for (const field of requiredFields) {
            if (params[field] === null || params[field] === undefined) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!token) {
            throw new Error('Mahindra access token is missing');
        }

        params.itemIndex = 0;
        const path = "/master/service-booking/dealers/search/nearest";
        const METHOD = 'POST';

        const response = await makeHttpRequest(
            path,
            params,
            METHOD,
            token,
            requestId
        );
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the nearest dealers list.";
    }
}

export async function getRepairOrderBillDetails(params, token, requestId) {
    try {
        const requiredField = ["locationCode", "parentCode", "roBillNo", "chassisNumber", "mobileNumber"];
        for (const field of requiredField) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        const path = "/service-booking/repair-orders/bills";
        
        const METHOD = "POST";
        const response = await makeHttpRequest(path, params, METHOD, token, requestId);
        return response;
    } catch (error) {
        const errorMessage = handleErrorMessage(error);
        if (errorMessage) {
            throw errorMessage;
        }
        console.log(error?.response?.data?.message || error.message);        
        throw error?.response?.data?.message || "Unable to fetch the repair order bill details.";
    }
}

async function makeHttpRequest(path, params, method, token, requestId, ...args) {
    const url = `${config.mahindrasvc.baseurl}${path}`;
    let headers = {
        Platform: config.mahindrasvc.Platform,
        Source: config.mahindrasvc.Source,
        Type: config.mahindrasvc.Type,
        AppVersion: config.mahindrasvc.AppVersion,
        SdkVersion: config.mahindrasvc.SdkVersion,
        Accept: config.mahindrasvc.Accept,
        "x-api-key": config.mahindrasvc.xapikey,
    }
    if (token) {
        token = token.trim();
        headers.Authorization = `Bearer ${token}`;
    }

    if (method !== 'GET') {
        headers["Content-Type"] = config.mahindrasvc.ContentType;
    }

    if (args.length > 0) {
        for (let arg of args) {
            headers[arg.key] = arg.value;
        }
    }

    const start = new Date().getTime();

    try {
        switch (method) {
            case 'GET': {
                const response = await axios.get(url, {
                    params,
                    headers,
                    httpsAgent: agent
                });
                const end = new Date().getTime();
                externalApiLogger(requestId, start, end, path, params, response.data, response.status).catch(error => servicelogger.error(error));
                return response.data;
            }
            case 'POST': {
                const response = await axios.post(url, params, {
                    headers,
                    httpsAgent: agent
                });
                const end = new Date().getTime();
                externalApiLogger(requestId, start, end, path, params, response.data, response.status).catch(error => servicelogger.error(error));
                return response.data;
            }
            case 'PUT': {
                const response = await axios.put(url, params, {
                    headers,
                    httpsAgent: agent
                });
                const end = new Date().getTime();
                externalApiLogger(requestId, start, end, path, params, response.data, response.status).catch(error => servicelogger.error(error));
                return response.data;
            }
            case 'DELETE': {
                const response = await axios.delete(url, params, {
                    headers,
                    httpsAgent: agent
                });
                const end = new Date().getTime();
                externalApiLogger(requestId, start, end, path, params, response.data, response.status).catch(error => servicelogger.error(error));
                return response.data;
            }
            default: {
                throw new Error('Unable to make a request.');
            }
        }
    } catch (error) {
        const end = new Date().getTime();
        externalApiLogger(requestId, start, end, path, params, error?.response?.data || error?.response, error?.response?.status || 500).catch(error => servicelogger.error(error));
        throw error;
    }
}

async function externalApiLogger(requestId, start, end, path, requestPayload, responsePayload, status) {
    let duration = String(end - start);
    let query = `INSERT INTO ${config.schemas.service}.lmm_service_logs (request_id, endpoint, request_payload, status, created_at, duration, api_response) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    await pgPoolI.Query(query, [requestId, path, JSON.stringify(requestPayload), status < 300 && status >= 200 ? 1 : 0, new Date(), duration, JSON.stringify(responsePayload)]);
}


export async function connectToExternalApi(path, body, method = 'GET', cookie) {
    try {
        const url = `${config.externalapi.baseurl}${path}`;
        const response = await axios({
            url: url,
            method: method,
            data: body,
            headers: {
                "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Connection": "keep-alive",
                "Referer": config.externalapi.referer,
                "Cookie": cookie,
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "TE": "trailers"
            },
        });
        return response.data;
    } catch (error) {
        console.log(error.message);
        throw error.message || "Unable to process the request, please try again later.";
    }
}