import * as Wrappers from "../app/utils/wrappers.js";
import { v4 as uuidv4 } from 'uuid';

const requestId = uuidv4();
const mobile = "9424469525";
const chassisNumber = "MJK32370";
const model = "TREO";
const accountid = "81861428-fe9c-4937-9d7e-ea5bb5c700d8";
let token;
let refreshToken;

try {
    const res = await Wrappers.getAuthToken({ accountid, muserid: "NEMO3.0-ADC-USERID-9410748307" }, requestId);
    if (res) {
        console.log('getAuthToken working');
        token = res;
    } else {
        console.log('getAuthToken not working');
    }
} catch (error) {
    console.log('getAuthToken not working', error);
}

// try {
//     let res = await Wrappers.onboardExternalUser({ userId, mobileNumber: mobile, flow: "OWNED", isWhatsAppConsented: true, registrationNumber: chassisNumber, chassisNumber, modelGroup: model, modelDescription: model }, requestId);
//     if (Object.keys(res).includes('message')
//         && Object.values(res).includes("External user info update success"))
//         console.log('onboardExternalUser working');
//     else {
//         console.log('onboardExternalUser not working');
//     }
// } catch (error) {
//     console.log('onboardExternalUser not working');
// }

// try {
//     let res = await Wrappers.refreshAuthToken({ refreshToken }, token, requestId);
//     if (Object.keys(res).includes('data')
//         && Object.keys(res.data).includes('authToken'))
//         console.log('refreshAuthToken working');
//     else {
//         console.log('refreshAuthToken not working');
//     }
// } catch (error) {
//     console.log('refreshAuthToken not working');
// }

try {
    const res = await Wrappers.getKilometers({ mobileNumber: mobile, chassisNumber }, token, requestId);
    if (Object.keys(res).includes('data')
        && Object.values(res).includes("Data fetch success"))
        {console.log('getKilometers working');}
    else {
        console.log('getKilometers not working');
    }
} catch (error) {
    console.log('getKilometers not working');
}

try {
    const res = await Wrappers.searchNearestDealers({
        "itemIndex": 0,
        "modelGroupDesc": model,
        "pageSize": 10,
        "searchFilter": "",
        "dealerType": "",
        "latitude": "12.9121",
        "longitude": "77.6446"
    }, token, requestId);
    if (Object.keys(res).includes('data')
        && Object.values(res)[1].length > 0)
        {console.log('searchNearestDealers working');}
    else {
        console.log('searchNearestDealers not working');
    }
} catch (error) {
    console.log('searchNearestDealers not working');
}

let parentCode;
let locationCode;

try {
    const res = await Wrappers.searchDealers({
        "chassisNumber": chassisNumber,
        "itemIndex": 0,
        "mobileNumber": mobile,
        "modelDesc": model,
        "pageSize": 10,
        "searchFilter": "KAR "
    }, token, requestId);
    if (Object.keys(res).includes('data')
        && Object.values(res)[1].length > 0) {
        console.log('searchDealers working');
        parentCode = Object.values(res)[1][0].parentGroup;
        locationCode = Object.values(res)[1][0].locationCode;
    } else {
        console.log('searchDealers not working');
    }
} catch (error) {
    console.log('searchDealers not working');
}

function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const yyyy = tomorrow.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

try {
    const res = await Wrappers.getDealerServiceSlots({
        "mobileNumber": mobile,
        "parentCode": parentCode,
        "locationCode": locationCode,
        "date": getTomorrowDate(),
        "chassis": chassisNumber
    }, token, requestId);
    if (
        res &&
        res.data &&
        res.data[getTomorrowDate()] &&
        Array.isArray(res.data[getTomorrowDate()]) &&
        res.data[getTomorrowDate()].length > 0
    )
        {console.log('getDealerServiceSlots working');}
    else {
        console.log('getDealerServiceSlots not working');
    }
}
catch (error) {
    console.log('getDealerServiceSlots not working');
}

try {
    const res = await Wrappers.getDealers({
        "chassis": chassisNumber,
        "latitude": "12.94715 ",
        "longitude": "77.57888",
        "mobileNumber": mobile,
        "modelDesc": model
    }, token, requestId);
    if (
        res &&
        res.data &&
        Array.isArray(res.data) &&
        res.data.length > 0
    ) {
        console.log('getDealers working');
    } else {
        console.log('getDealers not working');
    }
} catch (error) {
    console.log('getDealers not working');
}

try {
    const res = await Wrappers.getCancellationReasons(token, requestId);
    if (
        res &&
        res.data &&
        Array.isArray(res.data) &&
        res.data.length > 0
    ) {
        console.log('getCancellationReasons working');
    } else {
        console.log('getCancellationReasons not working');
    }
} catch (error) {
    console.log('getCancellationReasons not working');
}

try {
    const res = await Wrappers.getAdditionalJobs(model, token, requestId);
    if (
        res &&
        res.data &&
        Array.isArray(res.data.maxicare) &&
        res.data.scheduledJob && Array.isArray(res.data.scheduledJob.jobs) &&
        res.data.serviceType && Array.isArray(res.data.serviceType.types)
    ) {
        console.log('getAdditionalJobs working');
    } else {
        console.log('getAdditionalJobs not working');
    }
} catch (error) {
    console.log('getAdditionalJobs not working');
}

try {
    const res = await Wrappers.getSOSReasons(model, token, requestId);
    if (
        res &&
        res.data &&
        Array.isArray(res.data) &&
        res.data.length > 0
    ) {
        console.log('getSOSReasons working');
    } else {
        console.log('getSOSReasons not working');
    }
} catch (error) {
    console.log('getSOSReasons not working');
}

try {
    const res = await Wrappers.getShieldSchemes({
        "mobileNumber": mobile,
        "chassisNumber": chassisNumber,
        "modelGroupDesc": model,
        "enteredKm": "1000",
        "emailId": "kumar.pranesh@mahindra.com"
    }, token, requestId);
    if (
        res &&
        res.data &&
        Array.isArray(res.data.applicableSchemes)
    ) {
        console.log('getShieldSchemes working');
    } else {
        console.log('getShieldSchemes not working');
    }
} catch (error) {
    console.log('getShieldSchemes not working');
}

try {
    const res = await Wrappers.getShieldPaymentMetadata({
        "address": "hkdbjdhbf",
        "chassisNumber": chassisNumber,
        "customerId": "JANJ134",
        "dmsAmount": "4323",
        "email": "sudeep.dsouza@mahindra.com",
        "lastServiceKm": "134",
        "mobileNumber": mobile,
        "name": "Sudeep",
        "odometerReading": "1",
        "purchaseDate": "12-09-2021",
        "registrationNumber": "AUS1234",
        "schemeCategory": "KJB",
        "schemeCode": "KHJBS12",
        "serviceTax": "13",
        "shieldAmount": "123",
        "shieldOption": "12",
        "shieldValidFromDate": "12-09-2023",
        "shieldValidUpToDate": "12-09-2023",
        "shieldValidUpToKM": "123",
        "vehicleName": "AHBD",
        "shieldDiscount": ""
    }, token, requestId);
    if (
        res &&
        res.data &&
        res.data.accountDetails &&
        typeof res.data.accountDetails.orderId === 'string'
    ) {
        console.log('getShieldPaymentMetadata working');
    } else {
        console.log('getShieldPaymentMetadata not working');
    }
} catch (error) {
    console.log('getShieldPaymentMetadata not working');
}

try {
    const res = await Wrappers.sendSosRequest({
        "name": "P",
        "mobileNumber": mobile,
        "chassisNumber": chassisNumber,
        "latitude": "18.750622",
        "longitude": "73.877190",
        "sosSource": "WYH_SOS_VEHIC_NOT_START",
        "message": ""
    }, token, requestId);
    if (
        res &&
        typeof res.message === 'string' &&
        res.message.includes('SOS request raised') &&
        typeof res.data === 'string' &&
        res.data.includes('SOS Tracking number')
    ) {
        console.log('sendSosRequest working');
    } else {
        console.log('sendSosRequest not working');
    }
} catch (error) {
    console.log('sendSosRequest not working');
}

try {
    const res = await Wrappers.getRsaPaymentMetadata({
        "mobileNumber": mobile,
        "chassisNumber": chassisNumber,
        "customerId": "CUST123",
        "emailId": "sudeep@gmail.com",
        "name": "Sudeep",
        "rsaPlan": "RSA123",
        "rsaAmount": "123.21",
        "rsaAmountWithTax": "12.21",
        "rsaAmountWithoutTax": "12.31",
        "rsaDiscount": "12",
        "rsaValidFromDate": "12-02-2023",
        "rsaValidUpToDate": "12-02-2027",
        "registrationNumber": "AUS1234",
        "saleDate": "12-09-2024",
        "schemeCode": "ASD123",
        "schemeName": "ADBH",
        "serviceTax": "123",
        "vehicleName": "XUV500"
    }, token, requestId);
    if (
        res &&
        res.data &&
        res.data.accountDetails &&
        typeof res.data.accountDetails.orderId === 'string'
    ) {
        console.log('getRsaPaymentMetadata working');
    } else {
        console.log('getRsaPaymentMetadata not working');
    }
} catch (error) {
    console.log('getRsaPaymentMetadata not working');
}

function getTomorrowDate2() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const yyyy = tomorrow.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
}

try {
    const res = await Wrappers.bookServiceRequest({
        "bookingType": "REGULAR",
        "chassisNumber": chassisNumber,
        "dropAddress": "",
        "locationCode": "UN07",
        "maxiCare": [],
        "mobileNumber": mobile,
        "modelDesc": model,
        "parentGroup": "UN001",
        "pickUpAddress": "",
        "scheduledJobs": [],
        "serviceNotes": [
            "test"
        ],
        "serviceType": "repair_bev_ev",
        "slot": `${getTomorrowDate2()} 13:00:00`
    }, token, requestId);
    if (
        res &&
        res.message === "Service booked successfully" &&
        res.data === "Service booked successfully"
    ) {
        console.log('bookServiceRequest working');
    } else {
        console.log('bookServiceRequest not working');
    }
} catch (error) {
    console.log('bookServiceRequest not working');
}

let appointmentId;
let dmsBookingId;

try {
    const res = await Wrappers.getServiceBookingStatus({
        "mobileNumber": mobile,
        "chassisNumber": chassisNumber
    }, token, requestId);
    if (
        res &&
        res.message === "Service status details" &&
        res.data &&
        res.data.appointmentBooking &&
        typeof res.data.appointmentBooking.appointmentId === 'number'
    ) {
        console.log('getServiceBookingStatus working');
        appointmentId = res.data.appointmentBooking.appointmentId;
        dmsBookingId = res.data.appointmentBooking.dmsBookingId;
    } else {
        console.log('getServiceBookingStatus not working');
    }
} catch (error) {
    console.log('getServiceBookingStatus not working');
}

let reason;

try {
    const res = await Wrappers.getCancellationReasons(token, requestId);
    if (
        res &&
        res.data &&
        Array.isArray(res.data) &&
        res.data.length > 0
    ) {
        console.log('getCancelReasons working');
        reason = res.data[1].value;
    } else {
        console.log('getCancelReasons not working');
    }
} catch (error) {
    console.log('getCancelReasons not working', error);
}

try {
    const res = await Wrappers.additionalJobs({ modelDesc: model }, token, requestId);
    if (
        res &&
        res.data &&
        res.data.scheduledJob &&
        Array.isArray(res.data.scheduledJob.jobs) &&
        res.data.serviceType &&
        Array.isArray(res.data.serviceType.types)
    ) {
        console.log('additionalJobs working');
    } else {
        console.log('additionalJobs not working');
    }
} catch (error) {
    console.log('additionalJobs not working');
}

try {
    const res = await Wrappers.cancelAppointment({
        "appointmentId": appointmentId,
        "chassisNumber": chassisNumber,
        "dmsBookingId": dmsBookingId,
        "mobileNumber": mobile,
        "reason": reason,
        "comments": "test"
    }, token, requestId);
    if (
        res &&
        res.data.message === "Booking has been cancelled successfully"
    ) {
        console.log('cancelAppointment working');
    } else {
        console.log('cancelAppointment not working');
    }
} catch (error) {
    console.log('cancelAppointment not working');
}

try {
    const res = await Wrappers.getServiceHistory({
        "mobileNumber": mobile,
        "chassisNumber": chassisNumber,
        "isThisYear": true
    }, token, requestId);
    if (
        res &&
        res.data &&
        res.message === "Service history details"
    ) {
        console.log('getServiceHistory working');
    } else {
        console.log('getServiceHistory not working');
    }
} catch (error) {
    console.log('getServiceHistory not working');
}