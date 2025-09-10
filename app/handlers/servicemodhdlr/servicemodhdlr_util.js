import { v4 as uuidv4 } from 'uuid';
import { dateFormatter } from '../../utils/util.js';

const SERVICE_BOOKING_STATUS = {
    CANCELLED: 'Cancelled', // cancelled by user, appointmentBooking.bookingCancel != 'Confirmed'
    RO_OPEN: 'In Service', //appointmentBooking.bookingCancel == 'Confirmed', appointmentBooking.roBillDetail is not null and appointmentBooking.roBillDetail.status == 'open' || appointmentBooking.roBillDetail.status == 'closed' and appointmentBooking.roBillDetail.roBillNum is null and preinvoice api is success
    BOOKED: 'Booked', //create booking is success,  appointmentBooking.bookingCancel == 'Confirmed' and appointmentBooking.roBillDetail is null
    FAILED: 'Failed', //create booking is failed,  appointmentBooking.bookingCancel != 'Confirmed'
    OVERDUE: 'Overdue',
    COMPLETED: 'Completed', //appointmentBooking.roBillDetail.status == 'closed', appointmentBooking.roBillDetail.roBillNum is not null, email invoice api is success and ro bill date is more than 60 days
};

export function getRequestId() {
    return uuidv4();
}

export function filterVehicleServiceDetails(vehicleServiceDetails, serviceKilometersList, startDate = Date.now() - 3 * 30 * 24 * 60 * 60 * 1000) {
    const tabs = { overdue: [], inservice: [], booked: [], serviced: [], all: [] };
    const MS_PER_DAY = 86_400_000;
    const today = new Date();
    const diffDays = (a, b = today) => Math.ceil((a - b) / MS_PER_DAY);
    const RECENT_WINDOW_DAYS = diffDays(new Date(Number(startDate)));

    vehicleServiceDetails.forEach((src) => {
        const v = { ...src, isbooknow: false, isestimate: false, isstatuscheck: false, isreshcedule: false, iscancel: false };

        switch (v.bookingstatus) {
            case SERVICE_BOOKING_STATUS.RO_OPEN:
                v.bookingstatus = 'In_Service';
                v.isestimate = v.isstatuscheck = true;
                delete v.duedate;
                tabs.inservice.push({ ...v });
                break;
            case SERVICE_BOOKING_STATUS.BOOKED:
                v.bookingstatus = 'Booked';
                v.isreshcedule = v.iscancel = v.isstatuscheck = true;
                delete v.duedate;
                tabs.booked.push({ ...v });
                break;
            case SERVICE_BOOKING_STATUS.COMPLETED:
                v.bookingstatus = 'Completed';
                break;
        }

        if (v.bookingstatus === 'Completed') {
            if (v.duedate) {
                const daysDiff = diffDays(new Date(v.duedate));
                if (daysDiff < 0) {v.overduedays = Math.abs(daysDiff);}
                else {v.nextduedays = daysDiff;}
            }
            if (v.serviceodo != null && v.odometer != null) {
                const nextKm = getnextservicekm(v.serviceodo, v.odometer, serviceKilometersList);
                if (nextKm) {
                    if (v.odometer > nextKm) {
                        v.overduekm = v.odometer - nextKm;
                        v.overduekm = v.overduekm + " km";
                    }
                    else {
                        v.nextduekm = nextKm - v.odometer;
                        v.nextduekm = v.nextduekm + " km";
                    }
                }
            }
            if ((v.overduedays ?? 0) > 0 || (v.overduekm ?? 0) > 0) {
                v.bookingstatus = 'Overdue';
                v.isbooknow = true;
                v.bookingtime = null;
                delete v.duedate;
                v.servicedate = v.servicedate ? dateFormatter(new Date(v.servicedate)) : null;
                tabs.overdue.push({ ...v });
            } else if (v.servicedate && diffDays(new Date(v.servicedate)) >= -RECENT_WINDOW_DAYS) {
                v.bookingstatus = 'Serviced';
                v.isbooknow = true;
                v.bookingtime = v.bookingtime ? dateFormatter(new Date(v.bookingtime)) : null;
                v.servicedate = v.servicedate ? dateFormatter(new Date(v.servicedate)) : null;
                v.nextduedate = null;
                tabs.serviced.push({ ...v });
            }
        }

        if (!['In_Service', 'Booked'].includes(v.bookingstatus)) {
            v.isbooknow = true;
            v.bookingtime = null;
            v.servicetype = null;
            v.slot = null;
        }
        delete v.duedate;
        v.bookingtime = v.bookingtime ? dateFormatter(new Date(v.bookingtime)) : null;
        v.servicedate = v.servicedate ? dateFormatter(new Date(v.servicedate)) : null;
        tabs.all.push({ ...v });
    });

    return tabs;
}

function getnextservicekm(lastServiOdo, currentOdo, serviceIntervalList) {
    if (lastServiOdo) {
        for (let i = 0; i < serviceIntervalList.length - 1; i++) {
            if (
                lastServiOdo >= serviceIntervalList[i] &&
                lastServiOdo < serviceIntervalList[i + 1]
            ) {
                return (
                    lastServiOdo +
                    (serviceIntervalList[i + 1] - serviceIntervalList[i])
                );
            }
        }
    } else {
        return serviceIntervalList[serviceIntervalList.length - 1];
    }
}
