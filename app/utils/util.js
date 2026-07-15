import { APIResponseBadRequest, APIResponseForbidden, APIResponseInternalErr, APIResponseNotFound } from '../utils/responseutil.js';

// Object containing user-friendly error messages and their corresponding response functions
const userFriendlyErrorMessages = {
    USER_FLEET_NOT_FOUND: {
        code: 'USER_FLEET_NOT_FOUND',
        message: 'User fleet not found',
        ResponseFn: APIResponseForbidden,
    },
    VEHICLE_FLEET_NOT_FOUND: {
        code: 'VEHICLE_FLEET_NOT_FOUND',
        message: 'Vehicle fleet not found',
        ResponseFn: APIResponseForbidden,
    },
    USER_FLEET_ACCESS_DENIED: {
        code: 'USER_FLEET_ACCESS_DENIED',
        message: 'You are not authorized to access this fleet',
        ResponseFn: APIResponseForbidden,
    },
    NO_SERVICE_TYPES_FOUND: {
        code: 'NO_SERVICE_TYPES_FOUND',
        message: 'No service types found',
        ResponseFn: APIResponseBadRequest,
    },
    INVALID_VIN_NUMBER: {
        code: 'INVALID_VIN_NUMBER',
        message: 'Please send the valid registration number',
        ResponseFn: APIResponseBadRequest,
    },
    MOBILE_NUMBER_NOT_FOUND: {
        code: 'MOBILE_NUMBER_NOT_FOUND',
        message: 'Mobile number not found for the vehicle',
        ResponseFn: APIResponseBadRequest,
    },
    NO_CANCEL_REASONS_FOUND: {
        code: 'NO_CANCEL_REASONS_FOUND',
        message: 'No cancel reasons found',
        ResponseFn: APIResponseBadRequest,
    },
    NO_SLOTS_FOUND: {
        code: 'NO_SLOTS_FOUND',
        message: 'No slots found for the dealer',
        ResponseFn: APIResponseBadRequest,
    },
    VEHICLE_NOT_FOUND: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'The vehicle does not exist in the system',
        ResponseFn: APIResponseBadRequest,
    },
    USER_NOT_FOUND: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        ResponseFn: APIResponseForbidden,
    },
    SOS_REQUEST_FAILED: {
        code: 'SOS_REQUEST_FAILED',
        message: 'Unable to send the SOS request for all the issues.',
        ResponseFn: APIResponseInternalErr,
    },
    SERVICE_HISTORY_NOT_FOUND: {
        code: 'SERVICE_HISTORY_NOT_FOUND',
        message: 'Service history not found for the service',
        ResponseFn: APIResponseNotFound,
    },
    NO_ACTIVE_BOOKING: {
        code: 'NO_ACTIVE_BOOKING',
        message: 'No active booking found for the vehicle, unable to get the service status.',
        ResponseFn: APIResponseNotFound,
    },
    VEHICLE_ALREADY_BOOKED: {
        code: 'VEHICLE_ALREADY_BOOKED',
        message: 'Vehicle already booked for a service. Please cancel the existing booking and try again.',
        ResponseFn: APIResponseBadRequest
    },
    INVALID_SLOT: {
        code: 'INVALID_SLOT',
        message: 'Invalid slot. Please select a valid slot.',
        ResponseFn: APIResponseBadRequest
    },
    BOOKING_FAILED: {
        code: 'BOOKING_FAILED',
        message: 'Unable to book the service. Please try again after sometime.',
        ResponseFn: APIResponseInternalErr
    },
    CANNOT_BE_RESCHEDULED: {
        code: 'CANNOT_BE_RESCHEDULED',
        message: 'The service cannot be rescheduled as it is already in service.',
        ResponseFn: APIResponseBadRequest
    },
    RESCHEDULE_FAILED: {
        code: 'RESCHEDULE_FAILED',
        message: 'Unable to reschedule the service. Please try again after sometime.',
        ResponseFn: APIResponseInternalErr
    },
    CANNOT_BE_CANCELLED: {
        code: 'CANNOT_BE_CANCELLED',
        message: 'The service cannot be cancelled as it is already in service.',
        ResponseFn: APIResponseBadRequest
    },
    BOOKING_NOT_FOUND: {
        code: 'BOOKING_NOT_FOUND',
        message: 'No active booking found for the vehicle.',
        ResponseFn: APIResponseNotFound
    },
    CANCEL_BOOKING_FAILED: {
        code: 'CANCEL_BOOKING_FAILED',
        message: 'Unable to cancel the service. Please try again after sometime.',
        ResponseFn: APIResponseInternalErr
    },
    ALREADY_CANCELLED: {
        code: 'ALREADY_CANCELLED',
        message: 'The service is already cancelled. Please refresh the page.',
        ResponseFn: APIResponseBadRequest
    },
    NO_DEALER_FOUND: {
        code: 'NO_DEALER_FOUND',
        message: 'No dealer is found for the model, please choose another vehicle',
        ResponseFn: APIResponseNotFound
    },
    USER_OVERVIEW_ACCESS_DENIED: {
        code: 'USER_OVERVIEW_ACCESS_DENIED',
        message: "You do not have permission to access the overview or list of vehicles",
        ResponseFn: APIResponseForbidden
    },
    USER_DEALER_ACCESS_DENIED: {
        code: 'USER_DEALER_ACCESS_DENIED',
        message: "You do not have permission to access the dealer list",
        ResponseFn: APIResponseForbidden
    },
    USER_BOOKING_ACCESS_DENIED: {
        code: 'USER_BOOKING_ACCESS_DENIED',
        message: "You do not have permission to book a service",
        ResponseFn: APIResponseForbidden
    },
    USER_STATUS_ACCESS_DENIED: {
        code: 'USER_STATUS_ACCESS_DENIED',
        message: "You do not have permission to check the service status",
        ResponseFn: APIResponseForbidden
    },
    USER_RESCHEDULE_ACCESS_DENIED: {
        code: 'USER_RESCHEDULE_ACCESS_DENIED',
        message: "You do not have permission to reschedule a service",
        ResponseFn: APIResponseForbidden
    },
    USER_CANCEL_ACCESS_DENIED: {
        code: 'USER_CANCEL_ACCESS_DENIED',
        message: "You do not have permission to cancel a service",
        ResponseFn: APIResponseForbidden
    },
    USER_HISTORY_ACCESS_DENIED: {
        code: 'USER_HISTORY_ACCESS_DENIED',
        message: "You do not have permission to access the service history",
        ResponseFn: APIResponseForbidden
    },
    VEHICLE_INFO_ACCESS_DENIED: {
        code: 'VEHICLE_INFO_ACCESS_DENIED',
        message: "You do not have permission to access the vehicle information",
        ResponseFn: APIResponseForbidden
    },
    USER_INVOICE_ACCESS_DENIED: {
        code: 'USER_INVOICE_ACCESS_DENIED',
        message: "You do not have permission to access the invoice",
        ResponseFn: APIResponseForbidden
    },
    SOS_ACCESS_DENIED: {
        code: 'SOS_ACCESS_DENIED',
        message: "You do not have permission to access the SOS",
        ResponseFn: APIResponseForbidden
    },
    SOS_REASONS_NOT_FOUND: {
        code: 'SOS_REASONS_NOT_FOUND',
        message: "No Such SOS reason found",
        ResponseFn: APIResponseBadRequest
    },
    PERMISSION_DENIED: {
        code: 'PERMISSION_DENIED',
        message: "You do not have permission to access this resource.",
        ResponseFn: APIResponseForbidden
    },
    MODULE_NOT_FOUND: {
        code: 'MODULE_NOT_FOUND',
        message: "Service module not found",
        ResponseFn: APIResponseForbidden
    },
    BOOK_DETAILS_SAME: {
        code: 'BOOK_DETAILS_SAME',
        message: 'The service details are same as the existing booking. Please choose a different service type or dealer or booking time.',
        ResponseFn: APIResponseBadRequest
    },
    RESCHEDULE_STATUS_ERROR: {
        code: 'RESCHEDULE_STATUS_ERROR',
        message: 'Unable to get the service status. Failed to reschedule the service.',
        ResponseFn: APIResponseInternalErr
    },
    CANCEL_STATUS_ERROR: {
        code: 'CANCEL_STATUS_ERROR',
        message: 'Unable to get the service status. Failed to cancel the service.',
        ResponseFn: APIResponseInternalErr
    }
};

// Extract chassis number from VIN (last 8 characters)
export function getChassisNumber(vinno) {
    return vinno.toString().substring(9, 17);
}

// Format date to DD MMM YYYY format in IST timezone
export function dateFormatter(date) {
    if (!isNaN(date)) {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
        });
        const parts = formatter.formatToParts(date);
        const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
        return `${map.day} ${map.month} ${map.year}`;
    }
    return null;
}

// Convert epoch milliseconds to IST formatted string
export function convertEpochToIST(epochMillis, dateandtime = true) {
    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23', // 24-hour format
    });

    // Format parts separately
    const parts = formatter.formatToParts(new Date(epochMillis));
    const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    if (dateandtime) {
        return `${map.day} ${map.month} ${map.year} | ${map.hour}:${map.minute}:${map.second}`;
    } else {
        return `${map.day} ${map.month} ${map.year}`;
    }
}

export function convertToADCFormat(epochMillis) {
    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23', // 24-hour format
    });

    // Format parts separately
    const parts = formatter.formatToParts(new Date(epochMillis));
    const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return `${map.month}/${map.day}/${map.year} ${map.hour}:${map.minute}:${map.second}`;
}

export function calculateAge(startEpoch, endEpoch) {
    if (startEpoch < 1e12) { startEpoch *= 1000; }
    if (endEpoch < 1e12) { endEpoch *= 1000; }

    let start = new Date(startEpoch);
    let end = new Date(endEpoch);

    if (start > end) {
        return null;
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
        months--;
        const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
        days += prevMonth.getDate();
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    const parts = [];
    if (years > 0) { parts.push(`${years} year${years > 1 ? 's' : ''}`); }
    if (months > 0) { parts.push(`${months} month${months > 1 ? 's' : ''}`); }
    if (days > 0 || parts.length === 0) { parts.push(`${days} day${days !== 1 ? 's' : ''}`); }

    return parts.join(', ');
}

export function formatInvoiceObject(invoice, vinno, regno) {
    const formattedInvoice = {};
    formattedInvoice.rono = invoice?.roNo || null;
    formattedInvoice.model = invoice?.model || null;
    formattedInvoice.regno = regno || null;
    formattedInvoice.rodate = invoice?.roDate ? dateFormatter(new Date(invoice.roDate)) : null;
    formattedInvoice.saname = invoice?.saName || null;
    formattedInvoice.vinno = vinno;
    formattedInvoice.odometer = invoice?.mileage || null;
    formattedInvoice.phoneno = invoice?.phoneNo || null;
    formattedInvoice.address = ''.concat( invoice?.address1 || '', ', ', invoice?.address2 || '', ', ', invoice?.address3 || '');
    formattedInvoice.custname = invoice?.custName || null;
    formattedInvoice.robillno = invoice?.roBillNo || null;
    formattedInvoice.customerid = invoice?.customerId || null;
    formattedInvoice.netbillamt = invoice?.netBillAmt || null;
    formattedInvoice.parentname = invoice?.parentName || null;
    formattedInvoice.robilldate = invoice?.roBillDate ? dateFormatter(new Date(convertDateFormat(invoice.roBillDate))) : null;
    formattedInvoice.taxdetails = invoice?.taxDetails || null;
    formattedInvoice.discountlab = invoice?.discountLab || null;
    formattedInvoice.labamttotal = invoice?.labAmtTotal || null;
    formattedInvoice.partdetails = invoice?.partDetails || null;
    formattedInvoice.roundoffamt = invoice?.roundOffAmt || null;
    formattedInvoice.servicetype = invoice?.serviceType || null;
    formattedInvoice.discountpart = invoice?.discountPart || null;
    formattedInvoice.locationname = invoice?.locationName || null;
    formattedInvoice.partamttotal = invoice?.partAmtTotal || null;
    formattedInvoice.labourdetails = invoice?.labourDetails || null;
    formattedInvoice.outstandingamt = invoice?.outstandingAmt || null;
    formattedInvoice.sacontactnumber = invoice?.saContactNumber || null;

    return { roinfo: formattedInvoice };
}


export function convertDateFormat(dateString) {
    if (!dateString) return null;
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateString.match(dateRegex);
    if (match) {
        const [, day, month, year] = match;
        return `${month}/${day}/${year}`;
    }
    return dateString;
}



export function userFriendlyError(errorCode) {
    return (
        userFriendlyErrorMessages[errorCode] || {
            code: "INTERNAL_SERVER_ERROR",
            message: 'Something went wrong.',
            ResponseFn: APIResponseInternalErr,
        }
    );
}


export function getPreviousBookingStatus(activeBooking, vinno) {
    if (!activeBooking[0].servicestatus) {
        return null;
    }

    if (activeBooking[0].servicestatus === 'Booked') {
        return {
            isstatuscheck: true,
            vinno: vinno,
            isbooknow: false,
            iscompleted: false,
            iscancel: true,
            isreschdule: true,
            status: activeBooking[0].servicestatus,
            dealername: activeBooking[0]?.dealername || null,
            dealeraddress: activeBooking[0]?.dealerlocation || null
        }
    } else if (activeBooking[0].servicestatus === 'In Service') {
        return {
            isstatuscheck: true,
            vinno: vinno,
            isbooknow: false,
            iscompleted: false,
            iscancel: false,
            isreschdule: false,
            status: activeBooking[0].servicestatus,
            dealername: activeBooking[0]?.dealername || null,
            dealeraddress: activeBooking[0]?.dealerlocation || null
        }
    }
    return null;
}

export function getADCModel(modelDisplayName) {
    const treoModelDisplayName = ["treo cart", "treo grand", "treo zor", "treo yaari", "treo", "treo plus"];
    const zeoModelDisplayName = ["mahindra zeo", "zeo"];
    if (modelDisplayName && treoModelDisplayName.includes(modelDisplayName.toLowerCase()))
        return "TREO"
    else if (modelDisplayName && zeoModelDisplayName.includes(modelDisplayName.toLowerCase()))
        return "ZEO"
    else 
        return "A301";
}


export function checkUserPerms(userPermissions, requiredPermissions, mode = "any") {
    if (!userPermissions || !Array.isArray(userPermissions)) {
      return false;
    }
  
    if (!requiredPermissions || !Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
      return false;
    }
  
    if (mode === "all") {
      return requiredPermissions.every((perm) => userPermissions.includes(perm));
    } else {
      return requiredPermissions.some((perm) => userPermissions.includes(perm));
    }
}
