const specificErrorPatterns = {
    databaseError:
        /^(duplicate key|violates|syntax error|null value|invalid input|relation .* does not exist|column .* does not exist)/i,
    requestError400: /^(4\d{2}.*?Bad Request|400|Request.*400|Bad Request)/i,
    requestError401:
        /^(Unauthorized|Invalid token|Request.*401|401|Authentication failed|Token expired|Invalid credentials)/i,
    requestError403:
        /^(Forbidden|Permission denied|403|Request.*403|Access denied|Insufficient permissions)/i,
    requestError404:
        /^(Not Found|404|Request.*404|Resource not found|Endpoint not found)/i,
    requestError408:
        /^(Timeout|Request Timeout|408|Request.*408|Connection timeout|Operation timeout)/i,
    requestError429:
        /^(Too Many Requests|429|Request.*429|Rate limit exceeded|Throttling)/i,
    requestError500:
        /^(Internal Server Error|Request.*500|500|Server error|Application error)/i,
    requestError502:
        /^(Bad Gateway|502|Request.*502|Gateway error|Proxy error)/i,
    requestError503:
        /^(Service Unavailable|503|Request.*503|Service denied|Maintenance mode|Temporarily unavailable|Server overloaded|Backend service unavailable)/i,
    requestError504:
        /^(Gateway Timeout|504|Request.*504|Upstream timeout|Proxy timeout)/i,
    networkError:
        /^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNABORTED)/i,
    axiosError:
        /^(Request failed with status code|Network Error|timeout of|Request timeout|ERR_NETWORK)/i,
};

export function getChassisNumber(vinno) {
    return vinno.toString().substring(9, 17);
}

export function dateFormatter(date) {
    if (!isNaN(date)) {
        const day = date.getDate().toString().padStart(2, "0");
        const month = date.toLocaleDateString("en-GB", {
            timeZone: "Asia/Kolkata",
            month: "short",
        });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    }
    return null;
}

export function handleErrorMessage(error) {
    if (
        error.response?.data?.message ===
        "Cancel appointment failure :Appointment Already cancelled"
    ) {
        return "Cancel appointment failure :Appointment Already cancelled";
    } else if (error.response?.data?.message === "User info not found") {
        return "Please try again with different vehicle.";
    } else if (error?.message === "Mahindra access token is missing") {
        return "Unable to process the request, please try again.";
    }
    return null;
}

export function checkForDbOrRequestError(error) {
    let message = error?.message || error?.toString() || "";

    if (specificErrorPatterns.networkError.test(message)) {
        return "Network connection error, please check your internet connection and try again.";
    }
    if (specificErrorPatterns.axiosError.test(message)) {
        if (message.includes("503")) {
            return "Service temporarily unavailable, please try again later.";
        } else if (message.includes("timeout")) {
            return "Request timeout, please try again.";
        } else {
            return "Network error, please check your connection and try again.";
        }
    }

    if (specificErrorPatterns.databaseError.test(message)) {
        return "Something went wrong while processing the data. Please try again later.";
    }

    if (specificErrorPatterns.requestError400.test(message)) {
        return "Bad request, please check your request and try again.";
    } else if (specificErrorPatterns.requestError401.test(message)) {
        return "Unauthorized, please check your credentials and try again.";
    } else if (specificErrorPatterns.requestError403.test(message)) {
        return "Forbidden, please check your permissions and try again.";
    } else if (specificErrorPatterns.requestError404.test(message)) {
        return "Service not found, please try again later.";
    } else if (specificErrorPatterns.requestError408.test(message)) {
        return "Request timeout, please try again.";
    } else if (specificErrorPatterns.requestError429.test(message)) {
        return "Too many requests, please wait and try again.";
    } else if (specificErrorPatterns.requestError500.test(message)) {
        return "Internal server error, please try again later.";
    } else if (specificErrorPatterns.requestError502.test(message)) {
        return "Bad gateway, please try again later.";
    } else if (specificErrorPatterns.requestError503.test(message)) {
        return "Service temporarily unavailable, please try again later.";
    } else if (specificErrorPatterns.requestError504.test(message)) {
        return "Gateway timeout, please try again later.";
    }

    return null;
}

// TODO: Updates in this function based on the time zone, look into convertADCFormat function / dealer slots api
export function calculateAge(startEpoch, endEpoch) {
    if (startEpoch < 1e12) startEpoch *= 1000;
    if (endEpoch < 1e12) endEpoch *= 1000;

    let start = new Date(startEpoch);
    let end = new Date(endEpoch);

    if (start > end) [start, end] = [end, start];

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
    if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (days > 0 || parts.length === 0)
        parts.push(`${days} day${days !== 1 ? "s" : ""}`);

    return parts.join(", ");
}

export function convertToADCFormat(epochMillis) {
    // Add 5 hours 30 minutes (in ms) to epochMillis
    let istOffset = (5 * 60 * 60 * 1000) + (30 * 60 * 1000);
    let istEpoch = epochMillis + istOffset;

    // Calculate date parts manually
    let ms = istEpoch;
    let sec = Math.floor(ms / 1000);
    let s = sec % 60;
    let min = Math.floor(sec / 60);
    let m = min % 60;
    let hr = Math.floor(min / 60);
    let h = hr % 24;

    // Days since epoch
    let days = Math.floor(hr / 24);

    // Calculate year, month, day
    // Epoch starts at 1970-01-01
    let y = 1970;
    let monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];

    // Helper to check leap year
    function isLeap(year) {
        return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
    }

    // Find year
    while (true) {
        let daysInYear = isLeap(y) ? 366 : 365;
        if (days >= daysInYear) {
            days -= daysInYear;
            y++;
        } else {
            break;
        }
    }

    // Find month
    let mo = 0;
    while (true) {
        let dim = monthDays[mo];
        if (mo === 1 && isLeap(y)) dim = 29;
        if (days >= dim) {
            days -= dim;
            mo++;
        } else {
            break;
        }
    }
    let d = days + 1; // day of month

    // Format mm/dd/yyyy hh:mm:ss
    let mm = (mo + 1).toString().padStart(2, '0');
    let dd = d.toString().padStart(2, '0');
    let yyyy = y.toString();
    let HH = h.toString().padStart(2, '0');
    let MM = m.toString().padStart(2, '0');
    let SS = s.toString().padStart(2, '0');

    return `${mm}/${dd}/${yyyy} ${HH}:${MM}:${SS}`;
}

export function formatInvoiceObject(invoice, vinno) {
    let invoiceData = invoice.roInfo;
    let formattedInvoice = {};
    formattedInvoice.rono = invoiceData?.roNo || null;
    formattedInvoice.model = invoiceData?.model || null;
    formattedInvoice.regno = invoiceData?.regNo || null;
    formattedInvoice.rodate = invoiceData?.roDate
        ? dateFormatter(new Date(invoiceData.roDate))
        : null;
    formattedInvoice.saname = invoiceData?.saName || null;
    formattedInvoice.vinno = vinno;
    formattedInvoice.odometer = invoiceData?.mileage || null;
    formattedInvoice.phoneno = invoiceData?.phoneNo || null;
    formattedInvoice.address = "".concat(
        invoiceData?.address1 || "",
        ", ",
        invoiceData?.address2 || "",
        ", ",
        invoiceData?.address3 || ""
    );
    formattedInvoice.custname = invoiceData?.custName || null;
    formattedInvoice.robillno = invoiceData?.roBillNo || null;
    formattedInvoice.customerid = invoiceData?.customerId || null;
    formattedInvoice.netbillamt = invoiceData?.netBillAmt || null;
    formattedInvoice.parentname = invoiceData?.parentName || null;
    formattedInvoice.robilldate = invoiceData?.roBillDate
        ? dateFormatter(new Date(invoiceData.roBillDate))
        : null;
    formattedInvoice.taxdetails = invoiceData?.taxDetails || null;
    formattedInvoice.discountlab = invoiceData?.discountLab || null;
    formattedInvoice.labamttotal = invoiceData?.labAmtTotal || null;
    formattedInvoice.partdetails = invoiceData?.partDetails || null;
    formattedInvoice.roundoffamt = invoiceData?.roundOffAmt || null;
    formattedInvoice.servicetype = invoiceData?.serviceType || null;
    formattedInvoice.discountpart = invoiceData?.discountPart || null;
    formattedInvoice.locationname = invoiceData?.locationName || null;
    formattedInvoice.partamttotal = invoiceData?.partAmtTotal || null;
    formattedInvoice.labourdetails = invoiceData?.labourDetails || null;
    formattedInvoice.outstandingamt = invoiceData?.outstandingAmt || null;
    formattedInvoice.sacontactnumber = invoiceData?.saContactNumber || null;

    return { roinfo: formattedInvoice };
}

export function getDateFromEpoch(epochMillis) {
    epochMillis = epochMillis + (5.5 * 60 * 60 * 1000);
    const daysSinceEpoch = Math.floor(epochMillis / 86400000); // 1 day = 86400000 ms
    let days = daysSinceEpoch;

    // Start from 1970
    let year = 1970;

    // Step 1: Find the year
    while (true) {
        const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const daysInYear = isLeap ? 366 : 365;
        if (days >= daysInYear) {
            days -= daysInYear;
            year++;
        } else {
            break;
        }
    }

    // Step 2: Find the month
    const monthDays = [
        31,
        isLeapYear(year) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let month = 0;
    while (days >= monthDays[month]) {
        days -= monthDays[month];
        month++;
    }

    // Step 3: Remaining days are the date
    const day = days + 1;

    // Format as YYYY-MM-DD
    return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function getEpochFromDate(date) {
    // Expects date in "YYYY-MM-DD" format, returns epoch millis at 00:00:00.000 UTC of that day
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("Invalid date format. Expected YYYY-MM-DD");
    }
    const [yearStr, monthStr, dayStr] = date.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-based
    const day = parseInt(dayStr, 10);

    // Calculate days since 1970-01-01
    let days = 0;
    for (let y = 1970; y < year; y++) {
        days += isLeapYear(y) ? 366 : 365;
    }
    const monthDays = [
        31,
        isLeapYear(year) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    for (let m = 0; m < month - 1; m++) {
        days += monthDays[m];
    }
    days += (day - 1);

    return days * 86400000 - 5.5 * 60 * 60 * 1000;
}

export function getStringDateFromEpoch(epochMillis) {
    // Expects epochMillis as number, returns date in "DD mmm YY" format (e.g., "12 Jan 25")
    if (typeof epochMillis !== "number" || !isFinite(epochMillis)) {
        throw new Error("Invalid epochMillis. Must be a number.");
    }

    // Calculate total days since 1970-01-01
    let istOffset = (5 * 60 * 60 * 1000) + (30 * 60 * 1000);
    let istEpoch = epochMillis + istOffset;
    let days = Math.floor(istEpoch / 86400000);

    // Calculate year
    let year = 1970;
    while (true) {
        let yearDays = isLeapYear(year) ? 366 : 365;
        if (days >= yearDays) {
            days -= yearDays;
            year++;
        } else {
            break;
        }
    }

    // Calculate month and day
    const monthDays = [
        31,
        isLeapYear(year) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let month = 0;
    while (days >= monthDays[month]) {
        days -= monthDays[month];
        month++;
    }
    const day = days + 1;

    // Month names
    const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Format year as last two digits
    const yearShort = (year % 100).toString().padStart(2, "0");

    // Format as "DD mmm YY"
    return `${pad(day)} ${monthNames[month]} ${yearShort}`;
}

function isLeapYear(y) {
    return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

function pad(n) {
    return n.toString().padStart(2, "0");
}
