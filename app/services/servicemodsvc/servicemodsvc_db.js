import * as wrapper from "../../utils/wrappers/wrappers.js";
import { ServiceModSvcUtils } from "./servicemodsvc_utils.js";
import * as utils from "../../utils/util.js";

const SERVICE_BOOKING_STATUS = {
    CANCELLED: "Cancelled", // cancelled by user, appointmentBooking.bookingCancel != 'Confirmed'
    RO_OPEN: "In Service", //appointmentBooking.bookingCancel == 'Confirmed', appointmentBooking.roBillDetail is not null and appointmentBooking.roBillDetail.status == 'open' || appointmentBooking.roBillDetail.status == 'closed' and appointmentBooking.roBillDetail.roBillNum is null and preinvoice api is success
    BOOKED: "Scheduled", //create booking is success,  appointmentBooking.bookingCancel == 'Confirmed' and appointmentBooking.roBillDetail is null
    FAILED: "Failed", //create booking is failed,  appointmentBooking.bookingCancel != 'Confirmed'
    OVERDUE: "Overdue",
    RECENT: "Completed", //appointmentBooking.roBillDetail.status == 'closed', appointmentBooking.roBillDetail.roBillNum is not null, email invoice api is success and ro bill date is less than 60 days
    COMPLETED: "Completed", //appointmentBooking.roBillDetail.status == 'closed', appointmentBooking.roBillDetail.roBillNum is not null, email invoice api is success and ro bill date is more than 60 days
    PENDING: "Pending",
};

const ONBOARDING_STATUS = {
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
};

export default class ServiceModSvcDB {
    constructor(pgPoolI, redisSvcI, logger, config) {
        this.pgPoolI = pgPoolI;
        this.redisSvcI = redisSvcI;
        //GPS info - gpsinfo.vinno
        //CAN info - caninfo.vinno
        this.logger = logger;
        this.config = config;
        this.serviceModSvcUtils = new ServiceModSvcUtils(
            pgPoolI,
            logger,
            config
        );
    }

    async userFleetValidation(accountid, userid, fleetid) {
        return this.serviceModSvcUtils.userFleetValidation(
            accountid,
            userid,
            fleetid
        );
    }

    async getUserFleetId(accountid, userid) {
        return this.serviceModSvcUtils.getUserFleetId(accountid, userid);
    }

    async getRecursiveFleets(fleetid, accountid) {
        return this.serviceModSvcUtils.getRecursiveFleets(fleetid, accountid);
    }

    async getFleetVehicles(fleetids) {
        return this.serviceModSvcUtils.getFleetVehicles(fleetids);
    }

    async checkAccountVehicle(accountid, vinno) {
        return this.serviceModSvcUtils.checkAccountVehicle(accountid, vinno);
    }

    getRequestIdForExternalUse() {
        return this.serviceModSvcUtils.getRequestID();
    }

    async vehicleOnboarding(chassisNumber, mobileNumber, model) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const checkquery = `SELECT 
                                    muserid, 
                                    chassis_number, 
                                    mobileno, 
                                    onboarding_status 
                                FROM ${this.config.schemas.service}.onboarding_queue 
                                WHERE muserid = $1 AND chassis_number = $2 AND mobileno = $3`;
            const result = await this.pgPoolI.Query(checkquery, [
                `NEMO3.0-ADC-USERID-${mobileNumber}`,
                chassisNumber,
                mobileNumber,
            ]);
            if (result.rows.length > 0) {
                if (
                    result.rows[0].onboarding_status ===
                    ONBOARDING_STATUS.PENDING
                ) {
                    throw new Error("Onboarding request already exists");
                }
                if (
                    result.rows[0].onboarding_status ===
                    ONBOARDING_STATUS.COMPLETED
                ) {
                    throw new Error("Onboarding request already completed");
                }
            }
            const query = `INSERT INTO ${this.config.schemas.service}.onboarding_queue 
                            (muserid, mobileno, chassis_number, onboarding_status, requestid, model) 
                            VALUES ($1, $2, $3, $4, $5, $6)`;
            await this.pgPoolI.Query(query, [
                `NEMO3.0-ADC-USERID-${mobileNumber}`,
                mobileNumber,
                chassisNumber,
                ONBOARDING_STATUS.PENDING,
                requestId,
                !model ? "TREO" : model,
            ]);
            return "Onboarding request submitted successfully";
        } catch (e) {
            this.logger.error("Error in vehicleOnboarding", e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async fetchPendingVehicleOnboarding() {
        try {
            const query = `SELECT muserid, chassis_number, mobileno, model FROM ${this.config.schemas.service}.onboarding_queue WHERE onboarding_status = $1`;
            const result = await this.pgPoolI.Query(query, [
                ONBOARDING_STATUS.PENDING,
            ]);
            return result.rows;
        } catch (err) {
            this.logger.error("Error in fetchPendingVehicleOnboarding: ", err);
            throw "Fetch pending vehicle to onboard failed, please try again later.";
        }
    }

    async markVehicleOnboarded(onboardingData) {
        try {
            const query = `UPDATE ${this.config.schemas.service}.onboarding_queue SET onboarding_status = $1 WHERE muserid = $2 AND chassis_number = $3 AND mobileno = $4`;
            const result = await this.pgPoolI.Query(query, [
                ONBOARDING_STATUS.COMPLETED,
                onboardingData.muserid,
                onboardingData.chassis_number,
                onboardingData.mobileno,
            ]);
            this.logger.info(`muserid ${onboardingData.muserid} onboarded`);
            return result.rows;
        } catch (err) {
            this.logger.error("Error in markVehicleOnboarded: ", err);
        }
    }

    async moveToErrorTable(onboarddata, errorresult, body) {
        const [txclient, err] = await this.pgPoolI.StartTransaction();
        if (err) {
            this.logger.error("Error in moveToErrorTable: ", err);
            return;
        }
        try {
            let query = `
                SELECT  
                    requestid 
                FROM ${this.config.schemas.service}.onboarding_queue
                WHERE muserid = $1 
                AND chassis_number = $2 
                AND mobileno = $3
                `;
            let result = await txclient.query(query, [
                onboarddata.muserid,
                onboarddata.chassis_number,
                onboarddata.mobileno,
            ]);
            if (result.rows.length === 0) {
                this.logger.info(`muserid ${onboarddata.muserid} not found`);
                this.pgPoolI.TxRollback(txclient);
                return;
            }
            const requestid = result.rows[0].requestid;
            query = `
                SELECT 
                    muserid, 
                    chassis_number, 
                    mobileno 
                FROM ${this.config.schemas.service}.onboarding_queue_error 
                WHERE muserid = $1 
                AND chassis_number = $2 
                AND mobileno = $3`;
            result = await txclient.query(query, [
                onboarddata.muserid,
                onboarddata.chassis_number,
                onboarddata.mobileno,
            ]);
            const params = [];
            if (result.rows.length === 0) {
                query = `INSERT INTO ${this.config.schemas.service}.onboarding_queue_error (muserid, chassis_number, mobileno, requestid, request_body, response) VALUES ($1, $2, $3, $4, $5, $6)`;
                params.push(
                    onboarddata.muserid,
                    onboarddata.chassis_number,
                    onboarddata.mobileno,
                    requestid,
                    JSON.stringify(body),
                    JSON.stringify(errorresult)
                );
            } else {
                query = `UPDATE ${this.config.schemas.service}.onboarding_queue_error SET requestid = $1, request_body = $2, response = $3 WHERE muserid = $4 AND chassis_number = $5 AND mobileno = $6`;
                params.push(
                    requestid,
                    JSON.stringify(body),
                    JSON.stringify(errorresult),
                    onboarddata.muserid,
                    onboarddata.chassis_number,
                    onboarddata.mobileno
                );
            }

            await txclient.query(query, params);

            query = `DELETE FROM ${this.config.schemas.service}.onboarding_queue WHERE muserid = $1 AND chassis_number = $2 AND mobileno = $3`;
            await txclient.query(query, [
                onboarddata.muserid,
                onboarddata.chassis_number,
                onboarddata.mobileno,
            ]);

            await this.pgPoolI.TxCommit(txclient);
            this.logger.info(
                `muserid ${onboarddata.muserid} moved to error table`
            );
        } catch (error) {
            this.logger.error("Error in moveToErrorTable: ", error);
            await this.pgPoolI.TxRollback(txclient);
        }
    }

    async getServiceOverview(accountId, fleetIds, cookie, startdate) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();

            //get all vehicles in the fleetids
            const vehicles = await this.serviceModSvcUtils.getFleetVehicles(
                fleetIds
            );

            let filteredVehicles = {
                all: [],
                overdue: [],
                booked: [],
                inservice: [],
                recent: [],
            };

            if (vehicles.length !== 0) {
                filteredVehicles =
                    await this.serviceModSvcUtils.getAllFilteredVehiclesInService(
                        accountId,
                        vehicles,
                        requestId,
                        cookie,
                        startdate
                    );
            }

            let allVehicles = filteredVehicles.all.length;
            let overdueVehicles = filteredVehicles.overdue.length;
            let bookedVehicles = filteredVehicles.booked.length;
            let inServiceVehicles = filteredVehicles.inservice.length;
            let recentVehicles = filteredVehicles.recent.length;

            return [
                {
                    tabid: "all",
                    tabname: "ALL",
                    value: allVehicles,
                },
                {
                    tabid: "overdue",
                    tabname: "OVERDUE",
                    value: overdueVehicles,
                },
                {
                    tabid: "booked",
                    tabname: "BOOKED",
                    value: bookedVehicles,
                },
                {
                    tabid: "inservice",
                    tabname: "IN SERVICE",
                    value: inServiceVehicles,
                },
                {
                    tabid: "serviced",
                    tabname: "SERVICED",
                    value: recentVehicles,
                },
            ];
        } catch (e) {
            this.logger.error("Error in getServiceOverview", e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getVehicleServiceHistory(vinno) {
        try {
            const query = `
                    SELECT 
                        sh.vinno, 
                        sh.ro_bill_date as invoicedate,
                        sh.dealer_location as servicecenter,
                        sh.odometer as odo,
                        sh.net_bill_amt as invoice,
                        sh.ro_bill_number as robillnumber,
                        sh.booking_time as bookingtime,
                        sh.status as status,
                        sh.request_id as bookingid
                    FROM ${this.config.schemas.service}.service_history sh
                    WHERE sh.vinno = $1 AND sh.status = $2
                    ORDER BY sh.created_at DESC`;
            const result = await this.pgPoolI.Query(query, [
                vinno,
                SERVICE_BOOKING_STATUS.COMPLETED,
            ]);
            let serviceHistory = result.rows;
            serviceHistory = serviceHistory.map((item) => {
                return {
                    ...item,
                    invoicedate: item.invoicedate
                        ? utils.dateFormatter(new Date(item.invoicedate))
                        : null,
                    bookingtime: item.bookingtime
                        ? utils.dateFormatter(new Date(item.bookingtime))
                        : null,
                };
            });
            return serviceHistory;
        } catch (e) {
            this.logger.error("Error in getVehicleServiceHistory", e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getAllVehiclesInService(accountId, fleetIds, cookie) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();

            //get all vehicles in the fleetids
            const vehicles = await this.serviceModSvcUtils.getFleetVehicles(
                fleetIds
            );
            if (vehicles.length === 0) {
                return [];
            }
            const filteredVehicles =
                await this.serviceModSvcUtils.getAllFilteredVehiclesInService(
                    accountId,
                    vehicles,
                    requestId,
                    cookie
                );
            let allVehicles = [...filteredVehicles.all];
            allVehicles = allVehicles.map((item) => {
                return {
                    ...item,
                    bookingtime: item.bookingtime
                        ? utils.dateFormatter(new Date(item.bookingtime))
                        : null,
                    servicedate: item.servicedate
                        ? utils.dateFormatter(new Date(item.servicedate))
                        : null,
                };
            });
            return allVehicles;
        } catch (e) {}
    }

    async getServiceTypes(modelDesc) {
        try {
            let typesdata = [];
            let query = `SELECT id, description FROM ${this.config.schemas.service}.servicetypes`;
            let result = await this.pgPoolI.Query(query);
            let response = result.rows;
            for (let i = 0; i < response.length; i++) {
                if (response[i].description === "Accidental") {
                    typesdata.push({
                        img: "https://i.ibb.co/W16KMxC/image.png",
                        servicetype: response[i].description,
                        id: response[i].id,
                    });
                } else if (response[i].description === "Repair") {
                    typesdata.push({
                        img: "https://i.ibb.co/WWVF17Pf/image.png",
                        servicetype: response[i].description,
                        id: response[i].id,
                    });
                } else if (response[i].description === "Scheduled") {
                    typesdata.push({
                        img: "https://i.ibb.co/TxXh0RK0/image.png",
                        servicetype: response[i].description,
                        id: response[i].id,
                    });
                }
            }
            return typesdata;
        } catch (e) {
            this.logger.error("Error in getServiceTypes", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getInvoice(
        accountid,
        vinno,
        chassisNumber,
        mobileNumber,
        roBillNumber,
        bookingid
    ) {
        try {
            let query = `SELECT fleetid FROM fleet_vehicle WHERE accountid = $1 AND vinno = $2;`;
            const isFleetExists = await this.pgPoolI.Query(query, [
                accountid,
                vinno,
            ]);
            if (!isFleetExists) {
                throw new Error("Vehicle not found in the fleet");
            }

            const fleetid = isFleetExists.rows[0].fleetid;

            let parentCode = "MV001";
            let locationCode = "MV01";

            if (!this.config.overrideInvoiceChecks) {
                query = `SELECT invoice FROM ${this.config.schemas.service}.service_booking_logs WHERE account_id = $1 AND fleet_id = $2 AND vinno = $3 AND request_id = $4`;
                const invoice = await this.pgPoolI.Query(query, [
                    accountid,
                    fleetid,
                    vinno,
                    bookingid,
                ]);
                if (invoice.rows.length === 0) {
                    throw new Error("No booking found for this vehicle");
                }

                const invoiceData = invoice.rows[0].invoice;
                if (Object.keys(invoiceData).length) {
                    return utils.formatInvoiceObject(invoiceData, vinno);
                }
                query = `
            SELECT dealer_code, location_code  FROM ${this.config.schemas.service}.service_history
            WHERE request_id = $1 AND vinno = $2`;
                const result = await this.pgPoolI.Query(query, [
                    bookingid,
                    vinno,
                ]);
                if (result.rows.length === 0) {
                    throw new Error(
                        "No service history found for the booking date"
                    );
                }
                parentCode = result.rows[0].dealer_code;
                locationCode = result.rows[0].location_code;
            }

            const requestId = this.serviceModSvcUtils.getRequestID();
            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );

            const invoiceReqData = {
                locationCode: locationCode,
                parentCode: parentCode,
                roBillNo: [roBillNumber],
                chassisNumber: chassisNumber,
                mobileNumber: mobileNumber,
            };

            const roBillDetailResult = await wrapper.getRepairOrderBillDetails(
                invoiceReqData,
                token,
                requestId
            );
            const invoiceData = utils.formatInvoiceObject(
                roBillDetailResult.data,
                vinno
            );
            this.updateInvoiceStatus(
                accountid,
                fleetid,
                vinno,
                bookingid,
                invoiceData
            );
            return invoiceData;
        } catch (error) {
            this.logger.error("Error in getInvoice", error.message || error);
            throw typeof error === "string" ? error : error.message;
        }
    }

    async updateInvoiceStatus(
        accountid,
        fleetid,
        vinno,
        bookingId,
        invoiceData
    ) {
        try {
            let query = `
            UPDATE ${this.config.schemas.service}.service_booking_logs 
            SET invoice = $1, booking_status = $2
            WHERE account_id = $3 AND fleet_id = $4 AND vinno = $5 AND request_id = $6`;
            await this.pgPoolI.Query(query, [
                JSON.stringify(invoiceData),
                SERVICE_BOOKING_STATUS.COMPLETED,
                accountid,
                fleetid,
                vinno,
                bookingId,
            ]);
        } catch (error) {
            this.logger.error("Error in updateInvoiceStatus", error);
        }
    }

    async getOverdueVehicles(accountId, fleetId, cookie) {
        const requestId = this.serviceModSvcUtils.getRequestID();

        //get all vehicles in the fleetids
        const vehicles = await this.serviceModSvcUtils.getFleetVehicles(
            fleetId
        );
        if (vehicles.length === 0) {
            return [];
        }
        const filteredVehicles =
            await this.serviceModSvcUtils.getAllFilteredVehiclesInService(
                accountId,
                vehicles,
                requestId,
                cookie
            );
        let overdueVehicles = [...filteredVehicles.overdue];
        return overdueVehicles;
    }

    async getInServiceVehicles(accountId, fleetId, cookie) {
        const requestId = this.serviceModSvcUtils.getRequestID();

        //get all vehicles in the fleetids
        const vehicles = await this.serviceModSvcUtils.getFleetVehicles(
            fleetId
        );
        if (vehicles.length === 0) {
            return [];
        }
        const filteredVehicles =
            await this.serviceModSvcUtils.getAllFilteredVehiclesInService(
                accountId,
                vehicles,
                requestId,
                cookie
            );
        let inServiceVehicles = [...filteredVehicles.inservice];
        inServiceVehicles = inServiceVehicles.map((item) => {
            return {
                ...item,
                bookingtime: item.bookingtime
                    ? utils.dateFormatter(new Date(item.bookingtime))
                    : null,
            };
        });
        return inServiceVehicles;
    }

    async getBookedVehicles(accountId, fleetId, cookie) {
        const requestId = this.serviceModSvcUtils.getRequestID();

        //get all vehicles in the fleetids
        const vehicles = await this.serviceModSvcUtils.getFleetVehicles(
            fleetId
        );
        if (vehicles.length === 0) {
            return [];
        }
        const filteredVehicles =
            await this.serviceModSvcUtils.getAllFilteredVehiclesInService(
                accountId,
                vehicles,
                requestId,
                cookie
            );
        let bookedVehicles = [...filteredVehicles.booked];
        bookedVehicles = bookedVehicles.map((item) => {
            return {
                ...item,
                bookingtime: item.bookingtime
                    ? utils.dateFormatter(new Date(item.bookingtime))
                    : null,
            };
        });
        return bookedVehicles;
    }

    async getRecentVehicles(accountId, fleetId, cookie, startdate) {
        const requestId = this.serviceModSvcUtils.getRequestID();

        //get all vehicles in the fleetids
        const vehicles = await this.serviceModSvcUtils.getFleetVehicles(
            fleetId
        );
        if (vehicles.length === 0) {
            return [];
        }
        const filteredVehicles =
            await this.serviceModSvcUtils.getAllFilteredVehiclesInService(
                accountId,
                vehicles,
                requestId,
                cookie,
                startdate
            );
        let recentVehicles = [...filteredVehicles.recent];
        recentVehicles = recentVehicles.map((item) => {
            return {
                ...item,
                bookingtime: item.bookingtime
                    ? utils.dateFormatter(new Date(item.bookingtime))
                    : null,
                servicedate: item.servicedate
                    ? utils.dateFormatter(new Date(item.servicedate))
                    : null,
            };
        });
        return recentVehicles;
    }

    async createVehicleServiceBooking(
        accountId,
        userId,
        vinno,
        chassisNumber,
        mobileNumber,
        serviceType,
        kilometer,
        modelDisplayName,
        parentGroup,
        locationCode,
        dealerName,
        dealerAddress,
        slot,
        cookie,
        isResch = false
    ) {
        try {
            //Get the fleetid from the vin number
            const fleetId = await this.serviceModSvcUtils.getVehicleFleetId(
                accountId,
                vinno
            );
            const requestId = this.serviceModSvcUtils.getRequestID();

            //Check if the vehicle is already booked for service on the booking date
            let query1 = `SELECT
                        account_id,
                        fleet_id,
                        vinno, 
                        request_id,
                        booking_api_response
                    FROM ${this.config.schemas.service}.service_booking_logs 
                    WHERE account_id = $1
                    AND fleet_id = $2
                    AND vinno = $3
                    AND booking_status IN ('Scheduled', 'In Service');`;
            let result = await this.pgPoolI.Query(query1, [
                accountId,
                fleetId,
                vinno,
            ]);
            if (result.rows.length > 0 && !isResch) {
                throw new Error(
                    "Vehicle is already booked for service on the booking date"
                );
            }
            const [vehicleLatestData, vehicleDetails] = await Promise.all([
                this.serviceModSvcUtils.getVehicleRecentData(
                    [vinno],
                    cookie,
                    requestId
                ),
                this.serviceModSvcUtils.getVehicleDetails([vinno]),
            ]);
            const vehicleOdometer =
                vehicleLatestData?.data?.candata[vinno]?.odometer || null;

            if (serviceType === "scheduled_lmm_cv") {
                if (!vehicleOdometer) {
                    throw new Error(
                        "Vehicle odometer is not found, please use other service type"
                    );
                }
            }

            const selectedServiceType = serviceType
                .replace(/_/g, " ")
                .split(" ")[0]
                .toUpperCase();
            let selectedSlot = slot.split(" ")[1];
            selectedSlot =
                utils.dateFormatter(new Date(slot.split(" ")[0])) +
                " | " +
                selectedSlot;

            //Insert the booking details into the database
            let query2 = `INSERT INTO ${this.config.schemas.service}.service_booking_logs (
                        account_id,
                        fleet_id,
                        vinno,
                        request_id,
                        dms_booking_id,
                        dms_ronumber,
                        booking_status,
                        request_time,
                        booking_time,
                        cancel_time,
                        meta
                        )  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;

            await this.pgPoolI.Query(query2, [
                accountId,
                fleetId,
                vinno,
                requestId,
                null,
                null,
                SERVICE_BOOKING_STATUS.PENDING,
                new Date(),
                null,
                null,
                {
                    dealer_code: parentGroup,
                    location_code: locationCode,
                    dealer_name: dealerName,
                    dealer_location: dealerAddress,
                    odometer: vehicleOdometer,
                    servicetype: selectedServiceType,
                    slot: selectedSlot,
                },
            ]);

            //Get the booking details from the bookinginfo
            const data = {
                bookingType: "REGULAR",
                chassisNumber,
                mobileNumber,
                modelDesc: modelDisplayName,
                serviceType: serviceType,
                locationCode: locationCode,
                parentGroup: parentGroup,
                slot: slot,
            };

            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );

            //Book the service
            let bookingResponse;
            try {
                bookingResponse = await wrapper.bookServiceRequest(
                    data,
                    token,
                    requestId
                );
                if (bookingResponse.message != "Service booked successfully") {
                    throw new Error(
                        "Invalid booking response from booking api"
                    );
                }
            } catch (bookingError) {
                let query3 = `UPDATE 
                            ${this.config.schemas.service}.service_booking_logs 
                        SET booking_status = $1 
                        WHERE request_id = $2 
                            AND account_id = $3 
                            AND fleet_id = $4 
                            AND vinno = $5`;

                await this.pgPoolI.Query(query3, [
                    SERVICE_BOOKING_STATUS.FAILED,
                    requestId,
                    accountId,
                    fleetId,
                    vinno,
                ]);

                this.logger.error("Booking API failed:", bookingError);
                throw typeof bookingError === "string"
                    ? bookingError
                    : bookingError.message;
            }

            const bookingTime = slot.split(" ")[0]; //07/25/2025 12:00:00

            try {
                // Update the booking status
                let query4 = `UPDATE 
                        ${this.config.schemas.service}.service_booking_logs 
                    SET booking_status = $1 , booking_time = $2, booking_api_response = $3 
                    WHERE request_id = $4 
                        AND account_id = $5 
                        AND fleet_id = $6 
                        AND vinno = $7`;

                await this.pgPoolI.Query(query4, [
                    SERVICE_BOOKING_STATUS.BOOKED,
                    bookingTime,
                    JSON.stringify(bookingResponse),
                    requestId,
                    accountId,
                    fleetId,
                    vinno,
                ]);
            } catch (error) {
                // PostgreSQL unique violation error code is 23505
                if (error.code === "23505") {
                    throw new Error(
                        "Vehicle is already booked for service on the booking date"
                    );
                }
                throw error;
            }

            // Return the result first
            const bookingResult = {
                vinno: vinno,
                modelcode: vehicleDetails.get(vinno)?.modelcode,
                modeldisplayname: vehicleDetails.get(vinno)?.modeldisplayname,
                odometer: vehicleOdometer,
                location: {
                    lat: vehicleLatestData?.data?.gpsdata[vinno]?.latitude,
                    lng: vehicleLatestData?.data?.gpsdata[vinno]?.longitude,
                },
                bookingid: requestId,
                bookingstatus: SERVICE_BOOKING_STATUS.BOOKED,
                bookingtime: bookingTime
                    ? utils.dateFormatter(new Date(bookingTime))
                    : null,
                slot: selectedSlot,
                servicetype: selectedServiceType,
                isbooknow: false,
                ispreinvoice: false,
                isinvoice: false,
                isreshcedule: true,
                iscancel: true,
                isstatuscheck: true,
            };

            // Process the status update async
            this.processBookingStatusUpdate(
                accountId,
                fleetId,
                vinno,
                requestId,
                chassisNumber,
                mobileNumber,
                token,
                bookingTime,
                bookingResponse
            ).catch((err) => {
                this.logger.error("Error in async booking status update:", err);
            });

            return bookingResult;
        } catch (e) {
            this.logger.error(
                "Error in createVehicleServiceBooking",
                e.message || e
            );
            throw typeof e === "string" ? e : e.message;
        }
    }

    async processBookingStatusUpdate(
        accountId,
        fleetId,
        vinno,
        requestId,
        chassisNumber,
        mobileNumber,
        token,
        bookingTime,
        bookingResponse
    ) {
        try {
            let getBookingStatusResponse = null;
            let dmsBookingId = null;
            let serviceApiResponse = {};

            try {
                const getbookingsvcreqdata = {
                    chassisNumber: chassisNumber,
                    mobileNumber: mobileNumber,
                };
                // Get the booking status from the service center
                getBookingStatusResponse =
                    await wrapper.getServiceBookingStatus(
                        getbookingsvcreqdata,
                        token,
                        requestId
                    );
                serviceApiResponse = getBookingStatusResponse.data;
                dmsBookingId =
                    getBookingStatusResponse.data.appointmentBooking
                        ?.dmsBookingId;
            } catch (statusError) {
                this.logger.error("Error getting booking status:", statusError);
            }

            let ro_status = SERVICE_BOOKING_STATUS.BOOKED;
            if (Object.keys(serviceApiResponse).length > 0) {
                if (
                    !serviceApiResponse.appointmentBooking ||
                    serviceApiResponse.appointmentBooking?.bookingCancel !=
                        "Confirmed"
                ) {
                    ro_status = SERVICE_BOOKING_STATUS.CANCELLED;
                }

                // Update the booking status
                let query5 = `UPDATE 
                        ${this.config.schemas.service}.service_booking_logs 
                    SET dms_booking_id = $1, 
                        service_status_api_response = $2,
                        booking_status = $3
                    WHERE request_id = $4 
                        AND account_id = $5 
                        AND fleet_id = $6 
                        AND vinno = $7`;
                await this.pgPoolI.Query(query5, [
                    dmsBookingId,
                    JSON.stringify(serviceApiResponse),
                    ro_status,
                    requestId,
                    accountId,
                    fleetId,
                    vinno,
                ]);
            }
        } catch (error) {
            this.logger.error("Error in processBookingStatusUpdate:", error);
        }
    }

    async getCancelReasons() {
        try {
            let query = `SELECT cancellationid as id, name, value FROM ${this.config.schemas.service}.cancel_reasons;`;
            const result = await this.pgPoolI.Query(query);
            if (result.rows.length === 0) {
                return [];
            }

            return result.rows;
        } catch (e) {
            this.logger.error("Error in getCancelReasons", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async listDealers(mobileNumber, chassis, latitude, longitude, modelDesc) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );

            const listDealersReqData = {
                chassis,
                latitude,
                longitude,
                mobileNumber,
                modelDesc,
            };
            const dealers = await wrapper.getDealers(
                listDealersReqData,
                token,
                requestId
            );

            return { message: dealers["message"], dealerList: dealers["data"] };
        } catch (e) {
            this.logger.error("Error in listDealers", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async cancelVehicleServiceBooking(
        accountId,
        mobileNumber,
        bookingId,
        vinno,
        chassisNumber,
        reason,
        cookie
    ) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );
            //Get the fleetid from the vin number
            const fleetId = await this.serviceModSvcUtils.getVehicleFleetId(
                accountId,
                vinno
            );
            const vehicleLatestData =
                await this.serviceModSvcUtils.getVehicleRecentData(
                    [vinno],
                    cookie,
                    requestId
                );
            const vehicleDetails =
                await this.serviceModSvcUtils.getVehicleDetails([vinno]);

            //Get the current service details from the database
            let query = `SELECT 
                            booking_status, 
                            service_status_api_response 
                        FROM ${this.config.schemas.service}.service_booking_logs 
                        WHERE account_id = $1 
                            AND fleet_id = $2 
                            AND request_id = $3`;
            let currentservicedetails = await this.pgPoolI.Query(query, [
                accountId,
                fleetId,
                bookingId,
            ]);
            if (currentservicedetails?.rows?.length === 0) {
                throw new Error("Invalid bookingId");
            }

            let bookingStatus =
                currentservicedetails?.rows[0]?.booking_status || null;
            let serviceStatusApiResponse =
                currentservicedetails?.rows[0]?.service_status_api_response
                    ?.data || null;

            if (
                bookingStatus &&
                bookingStatus === SERVICE_BOOKING_STATUS.CANCELLED
            ) {
                throw new Error("Service booking already cancelled");
            }
            if (
                bookingStatus &&
                bookingStatus === SERVICE_BOOKING_STATUS.FAILED
            ) {
                throw new Error("Service booking was failed");
            }

            //Get the service details from the service center if not found in the database
            if (!serviceStatusApiResponse) {
                try {
                    const getServiceBookingStatusReqData = {
                        chassisNumber,
                        mobileNumber,
                    };
                    currentservicedetails =
                        await wrapper.getServiceBookingStatus(
                            getServiceBookingStatusReqData,
                            token,
                            requestId
                        );
                    serviceStatusApiResponse = currentservicedetails?.data;
                } catch (e) {
                    this.logger.error(
                        "Error in getServiceBookingStatus",
                        e.message || e
                    );
                    throw typeof e === "string" ? e : e.message;
                }
            }

            //If the service details are not found, throw an error
            if (!serviceStatusApiResponse) {
                throw new Error(
                    "Unable to process the request, please try again later"
                );
            }

            //if the ro details are generated, update the booking status to in_service
            if (
                serviceStatusApiResponse?.roBillDetail &&
                Object.keys(serviceStatusApiResponse?.roBillDetail).length > 0
            ) {
                let query = `UPDATE 
                                ${this.config.schemas.service}.service_booking_logs 
                            SET booking_status = $1,
                                dms_booking_id = $2,
                                dms_ronumber = $3,
                                service_status_api_response = $4
                            WHERE request_id = $5 
                                AND account_id = $6 
                                AND fleet_id = $7`;
                await this.pgPoolI.Query(query, [
                    SERVICE_BOOKING_STATUS.RO_OPEN,
                    serviceStatusApiResponse?.appointmentBooking?.dmsBookingId,
                    serviceStatusApiResponse?.roBillDetail?.roNum,
                    JSON.stringify(serviceStatusApiResponse),
                    bookingId,
                    accountId,
                    fleetId,
                ]);

                throw new Error(
                    "Cannot cancel the booking, service is in progress"
                );
            }

            //If the appointment booking is not found, update the booking status to cancelled and throw an error
            if (
                !serviceStatusApiResponse?.appointmentBooking ||
                serviceStatusApiResponse?.appointmentBooking?.bookingCancel !==
                    "Confirmed"
            ) {
                let query = `UPDATE 
                                    ${this.config.schemas.service}.service_booking_logs 
                                SET booking_status = $1 
                                WHERE request_id = $2 
                                    AND account_id = $3 
                                    AND fleet_id = $4`;

                await this.pgPoolI.Query(query, [
                    SERVICE_BOOKING_STATUS.CANCELLED,
                    bookingId,
                    accountId,
                    fleetId,
                ]);

                return {
                    vinno: vinno,
                    modelcode: vehicleDetails?.get(vinno)?.modelcode,
                    modeldisplayname:
                        vehicleDetails?.get(vinno)?.modeldisplayname,
                    odometer:
                        vehicleLatestData?.data?.candata[vinno]?.odometer || 0,
                    location: {
                        lat: vehicleLatestData?.data?.gpsdata[vinno]?.latitude,
                        lng: vehicleLatestData?.data?.gpsdata[vinno]?.longitude,
                    },
                    bookingstatus: SERVICE_BOOKING_STATUS.CANCELLED,
                    isbooknow: true,
                    ispreinvoice: false,
                    isinvoice: false,
                    isreshcedule: false,
                    iscancel: false,
                    isstatuscheck: false,
                };
            }

            const appointmentId =
                serviceStatusApiResponse?.appointmentBooking?.appointmentId;
            const dmsBookingId =
                serviceStatusApiResponse?.appointmentBooking?.dmsBookingId;

            //Cancel the appointment
            let response;
            try {
                const cancelAppointmentReqData = {
                    appointmentId,
                    chassisNumber,
                    dmsBookingId,
                    mobileNumber,
                    reason,
                    comments: "From Nemo3.0",
                };
                response = await wrapper.cancelAppointment(
                    cancelAppointmentReqData,
                    token,
                    requestId
                );
            } catch (err) {
                if (
                    err ==
                    "Cancel appointment failure :Appointment Already cancelled"
                ) {
                    let query = `UPDATE 
                                    ${this.config.schemas.service}.service_booking_logs 
                                SET booking_status = $1 
                                WHERE request_id = $2 
                                    AND account_id = $3 
                                    AND fleet_id = $4`;

                    await this.pgPoolI.Query(query, [
                        SERVICE_BOOKING_STATUS.CANCELLED,
                        bookingId,
                        accountId,
                        fleetId,
                    ]);

                    return {
                        vinno: vinno,
                        modelcode: vehicleDetails?.get(vinno)?.modelcode,
                        modeldisplayname:
                            vehicleDetails?.get(vinno)?.modeldisplayname,
                        odometer:
                            vehicleLatestData?.data?.candata[vinno]?.odometer ||
                            0,
                        location: {
                            lat: vehicleLatestData?.data?.gpsdata[vinno]
                                ?.latitude,
                            lng: vehicleLatestData?.data?.gpsdata[vinno]
                                ?.longitude,
                        },
                        bookingstatus: SERVICE_BOOKING_STATUS.CANCELLED,
                        isbooknow: true,
                        ispreinvoice: false,
                        isinvoice: false,
                        isreshcedule: false,
                        iscancel: false,
                        isstatuscheck: false,
                    };
                }
                throw typeof err === "string"
                    ? err
                    : err?.message || new Error("Error in cancelAppointment");
            }

            if (
                response?.data?.message ===
                "Booking has been cancelled successfully"
            ) {
                let query = `UPDATE 
                                ${this.config.schemas.service}.service_booking_logs 
                            SET booking_status = $1 
                            WHERE request_id = $2 
                                AND account_id = $3 
                                AND fleet_id = $4`;

                await this.pgPoolI.Query(query, [
                    SERVICE_BOOKING_STATUS.CANCELLED,
                    bookingId,
                    accountId,
                    fleetId,
                ]);
            } else {
                throw new Error(
                    "Unable to cancel the appointment, please check the status of the booking."
                );
            }
            return {
                vinno: vinno,
                modelcode: vehicleDetails?.get(vinno)?.modelcode,
                modeldisplayname: vehicleDetails?.get(vinno)?.modeldisplayname,
                odometer:
                    vehicleLatestData?.data?.candata[vinno]?.odometer || 0,
                location: {
                    lat: vehicleLatestData?.data?.gpsdata[vinno]?.latitude,
                    lng: vehicleLatestData?.data?.gpsdata[vinno]?.longitude,
                },
                bookingstatus: SERVICE_BOOKING_STATUS.CANCELLED,
                isbooknow: true,
                ispreinvoice: false,
                isinvoice: false,
                isreshcedule: false,
                iscancel: false,
                isstatuscheck: false,
            };
        } catch (e) {
            this.logger.error(
                "Error in cancelVehicleServiceBooking",
                e.message || e
            );
            throw typeof e === "string" ? e : e.message;
        }
    }

    async listDealers(chassisNumber, mobileNumber, lat, long, modelDesc) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );

            const listDealersReqData = {
                chassis: chassisNumber,
                mobileNumber: mobileNumber,
                latitude: lat,
                longitude: long,
                modelDesc,
            };
            const dealers = await wrapper.getDealers(
                listDealersReqData,
                token,
                requestId
            );

            return { message: dealers["message"], dealerList: dealers["data"] };
        } catch (e) {
            this.logger.error("Error in listDealers", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getDealerSlots(
        chassisNumber,
        mobileNumber,
        parentCode,
        locationCode,
        epoch
    ) {
        try {
            const query = `SELECT slots, slot_offset FROM ${this.config.schemas.service}.dealer_slots;`;
            const result = await this.pgPoolI.Query(query);
            let timeslots = [];

            if (result.rows.length === 0) {
                throw new Error("No slots found for the given date");
            }

            const slots = result.rows;
            for (const slot of slots) {
                let epochbookingtime = epoch + (slot.slot_offset * 3600 * 1000);
                timeslots.push({
                    slot: slot.slots,
                    epochbookingtime: epochbookingtime
                });
            }

            const bookingdate = utils.getStringDateFromEpoch(epoch);

            return { bookingdate, timeslots };
        } catch (e) {
            this.logger.error("Error in getDealerSlots", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getVehicleServiceCostEstimate(
        vinno,
        chassisNumber,
        mobileNumber,
        selectedkm,
        model
    ) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );

            const getVehicleServiceCostEstimateReqData = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
                selectedKM: selectedkm,
            };
            const getVehicleServiceCostEstimateResponse =
                await wrapper.getServiceCostEstimations(
                    getVehicleServiceCostEstimateReqData,
                    token,
                    requestId
                );

            if (!getVehicleServiceCostEstimateResponse.data) {
                throw new Error("No data found");
            }

            const estimatedata = getVehicleServiceCostEstimateResponse.data;
            const partsamt = estimatedata.partDetails.reduce(
                (acc, item) => acc + parseInt(item["totalAmt"]),
                0
            );
            const labour = estimatedata.labourDetails.reduce(
                (acc, item) => acc + parseInt(item["charges"]),
                0
            );
            const totalamount = partsamt + labour;

            return {
                vehicleno: vinno,
                vehiclemodel: model,
                costestimate: {
                    parts: partsamt,
                    labor: labour,
                    total: totalamount,
                },
                estmationdetails: estimatedata,
            };
        } catch (error) {
            this.logger.error(
                "Error in getVehicleServiceCostEstimate: ",
                error.message || error
            );
            throw typeof error === "string" ? error : error.message;
        }
    }

    async listDealerSearch(
        chassisNumber,
        mobileNumber,
        modelDesc,
        itemIndex,
        pageSize,
        searchFilter
    ) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );

            const searchDealerReqData = {
                chassisNumber,
                mobileNumber,
                modelDesc,
                itemIndex,
                pageSize,
                searchFilter,
            };
            let dealerSearchResponse = await wrapper.searchDealers(
                searchDealerReqData,
                token,
                requestId
            );

            return {
                message: dealerSearchResponse["message"],
                dealerList: dealerSearchResponse["data"],
            };
        } catch (e) {
            this.logger.error("Error in listDealerSearch", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getSOSReasons(vinno, chassisNumber, mobileNumber, model, cookie) {
        let errorreasons = {};
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const vehicleRecentDataReqData = [vinno];
            let sosreasons = null;
            let vehicleRecentData = null;
            let vehicleInfo = null;
            let vehicleModelInfo = null;
            let purchasedate = null;
            let vehicleage = null;
            let modelcode = null;
            let modeldisplayname = null;
            let sosReasonsQuery = `SELECT sosid, name, value FROM ${this.config.schemas.service}.sos_reasons;`;
            let vehicleDetailsQuery = `SELECT COALESCE(license_plate, vinno) as regno, delivered_date FROM vehicle WHERE vinno = $1`;
            let vehicleModelQuery = `
                    SELECT 
                        vehicle.modelcode,
                        vehicle_model.modeldisplayname
                    FROM vehicle 
                    INNER JOIN ${this.config.schemas.fmsauthsch}.vehicle_model ON vehicle.modelcode = vehicle_model.modelcode 
                    WHERE vinno = $1`;

            const [
                sosreasonsresult,
                vehicleDetailsResult,
                vehicleModelResult,
                vehicleRecentDataResult
            ] = await Promise.allSettled([
                this.pgPoolI.Query(sosReasonsQuery),
                this.pgPoolI.Query(vehicleDetailsQuery, [vinno]),
                this.pgPoolI.Query(vehicleModelQuery, [vinno]),
                this.serviceModSvcUtils.getVehicleRecentData(vehicleRecentDataReqData, cookie, requestId)
            ]);

            if (sosreasonsresult.status === "rejected") {
                this.logger.error("Error in getSOSReasons", sosreasonsresult.reason);
                errorreasons.sosreasonsfailure = sosreasonsresult.reason;
            } else {
                sosreasons = sosreasonsresult.value.rows;
            }

            if (vehicleRecentDataResult.status === "rejected") {
                this.logger.error("Error in connectToExternalApi", vehicleRecentDataResult.reason.data?.message);
                errorreasons.vehicletelimaticsfailure = vehicleRecentDataResult.reason;
            } else {
                vehicleRecentData = vehicleRecentDataResult.value;
            }

            if (vehicleDetailsResult.status === "rejected") {
                this.logger.error("Error in getVehicleDetails", vehicleDetailsResult.reason);
                errorreasons.vehicledetailsfailure = vehicleDetailsResult.reason;
            } else {
                vehicleInfo = vehicleDetailsResult.value.rows[0];
                if (!vehicleInfo.delivered_date) {
                    purchasedate = null;
                } else {
                    purchasedate = new Date(vehicleInfo.delivered_date).toLocaleDateString();
                    vehicleage = utils.calculateAge(new Date(purchasedate).getTime(), new Date().getTime());
                }
            }

            if (vehicleModelResult.status === "rejected") {
                this.logger.error("Error in getVehicleModel", vehicleModelResult.reason);
                errorreasons.vehicledetailsfailure = vehicleModelResult.reason;
            } else {
                vehicleModelInfo = vehicleModelResult.value.rows[0];
                modelcode = vehicleModelInfo.modelcode;
                modeldisplayname = vehicleModelInfo.modeldisplayname;
            }

            if (!Object.keys(errorreasons).length) {
                errorreasons = null;
            }

            let odo = null;
            if (vehicleRecentData?.data?.candata[vinno]?.odometer) {
                odo = vehicleRecentData?.data?.candata[vinno]?.odometer + " km";
            }

            return {
                vehicledetails: {
                    odometer: vehicleRecentData?.data?.candata[vinno]?.odometer || null, // TODO: Remove this after testing
                    odo: odo || "NA",
                    regno: vehicleInfo?.regno || "NA",
                    vinno: vinno,
                    rsadetails: "NA",
                    purchasedate: purchasedate ? utils.dateFormatter(new Date(purchasedate)) : "NA",
                    ageofvehicle: null, // TODO: Remove this after testing
                    vehicleage: vehicleage|| "NA",
                    inwarranty: null,
                    warranty: "NA",
                    modecode: modelcode || "NA",
                    modeldisplayname: modeldisplayname || "NA",
                },
                sosreasons: sosreasons,
                lat: vehicleRecentData?.data?.gpsdata[vinno]?.latitude || 17.6867174,
                lng: vehicleRecentData?.data?.gpsdata[vinno]?.longitude || 77.5822892,
            };
        } catch (e) {
            this.logger.error("Error in getSOSReasons", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getRootFleetId(accountid) {
        try {
            let query = `SELECT 
                            fleetid 
                        FROM account_fleet 
                        WHERE accountid = $1 
                            AND isroot = true
                        `;
            let result = await this.pgPoolI.Query(query, [accountid]);
            if (result.rowCount !== 1) {
                return null;
            }
            return result.rows[0].fleetid;
        } catch (e) {
            this.logger.error("Error in getRootFleetId", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getVehicles(accountid, fleetid, recursive = false) {
        try {
            let query;
            if (recursive) {
                query = `
          WITH RECURSIVE fleet_hierarchy AS (
            SELECT ft.accountid, ft.fleetid, ft.name
            FROM fleet_tree ft
            WHERE ft.accountid = $1 AND ft.fleetid = $2 AND ft.isdeleted = false
    
            UNION ALL
    
            SELECT ft.accountid, ft.fleetid, ft.name
            FROM fleet_tree ft
            JOIN fleet_hierarchy fh ON ft.accountid = fh.accountid AND ft.pfleetid = fh.fleetid
            WHERE ft.isdeleted = false
          )
          SELECT fv.accountid, fv.fleetid, fv.vinno, COALESCE(v.license_plate, v.vinno) as regno, fv.isowner, fv.accvininfo, 
                 fv.assignedat, fv.updatedat, u1.displayname as assignedby, u2.displayname as updatedby,
                 v.vehiclevariant, v.vehiclemodel, v.vehicleinfo, af.isroot
          FROM fleet_vehicle fv
          JOIN vehicle v ON fv.vinno = v.vinno
          JOIN users u1 ON fv.assignedby = u1.userid
          JOIN users u2 ON fv.updatedby = u2.userid
          JOIN account_fleet af ON fv.accountid = af.accountid AND fv.fleetid = af.fleetid
          JOIN fleet_hierarchy fh ON fv.accountid = fh.accountid AND fv.fleetid = fh.fleetid
          ORDER BY fv.assignedat DESC
        `;
            } else {
                query = `
          SELECT fv.accountid, fv.fleetid, fv.vinno, COALESCE(v.license_plate, v.vinno) as regno, fv.isowner, fv.accvininfo, 
                 fv.assignedat, fv.updatedat, u1.displayname as assignedby, u2.displayname as updatedby,
                 v.vehiclevariant, v.vehiclemodel, v.vehicleinfo, af.isroot
          FROM fleet_vehicle fv
          JOIN vehicle v ON fv.vinno = v.vinno
          JOIN users u1 ON fv.assignedby = u1.userid
          JOIN users u2 ON fv.updatedby = u2.userid
          JOIN account_fleet af ON fv.accountid = af.accountid AND fv.fleetid = af.fleetid
          WHERE fv.accountid = $1 AND fv.fleetid = $2
          ORDER BY fv.assignedat DESC
        `;
            }

            let result = await this.pgPoolI.Query(query, [accountid, fleetid]);
            if (result.rowCount === 0) {
                return [];
            }
            return result.rows;
        } catch (e) {
            this.logger.error("Error in getVehicles", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async raiseSOS(userId, chassisNumber, mobileNumber, sosinfo) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const query = `SELECT displayname FROM users WHERE userid = $1; `;
            const user = await this.pgPoolI.Query(query, [userId]);

            if (user.rows.length === 0) {
                throw new Error("User not found");
            }

            const userName = user.rows[0].displayname;
            const { vinno, model, latitude, longitude, issue, description } =
                sosinfo;

            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                requestId
            );
            if (!token) {
                throw new Error("Token generation failed");
            }

            const baseraisesosreqdata = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
                latitude: latitude,
                longitude: longitude,
                message: description,
                name: userName,
            };

            const sospromises = issue.map(async (issuetype) => {
                try {
                    const raisesosreqdata = {
                        ...baseraisesosreqdata,
                        sosSource: issuetype,
                    };
                    const response = await wrapper.sendSosRequest(
                        raisesosreqdata,
                        token,
                        requestId
                    );
                    return { id: issuetype, response, status: "fulfilled" };
                } catch (error) {
                    this.logger.error(
                        `Error in raiseSOS for issue ${issuetype}:`,
                        error
                    );
                    return {
                        id: issuetype,
                        error: error.message || error,
                        status: "rejected",
                    };
                }
            });

            const results = await Promise.allSettled(sospromises);

            const responseList = [];
            results.forEach((result, index) => {
                if (result.status === "fulfilled") {
                    const innerResult = result.value;
                    if (innerResult.status === "fulfilled") {
                        responseList.push({
                            id: innerResult.id,
                            response: innerResult.response,
                        });
                    } else {
                        this.logger.error(
                            `SOS request failed for issue ${innerResult.id}:`,
                            innerResult.error
                        );
                    }
                } else {
                    this.logger.error(
                        `SOS request promise rejected for issue ${issue[index]}:`,
                        result.reason
                    );
                }
            });

            if (!responseList.length) {
                throw new Error("SOS request failed");
            }
            return responseList;
        } catch (e) {
            this.logger.error("Error in raiseSOS", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getSheduleJobTypes(modelDesc) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            try {
                const token = await this.serviceModSvcUtils.getMAuthToken(
                    this.config.hardCodeData.mobileNumber,
                    requestId
                );
                const additionaljobsreqdata = {
                    modelDesc,
                };
                const response = await wrapper.additionalJobs(
                    additionaljobsreqdata,
                    token,
                    requestId
                );
                return response.data.scheduledJob.jobs;
            } catch (e) {
                this.logger.error(
                    "Error fetching additional jobs",
                    e.message || e
                );
                throw typeof e === "string" ? e : e.message;
            }
        } catch (e) {
            this.logger.error("Error in getSheduleJobTypes", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async reschVehicleServiceBooking(
        accountId,
        userId,
        oldBookingId,
        mobileNumber,
        newServiceType,
        newKilometer,
        modelDisplayName,
        newParentGroup,
        newLocationCode,
        newDealerName,
        newDealerAddress,
        newSlot,
        cookie
    ) {
        try {
            let query1 = `SELECT 
                            vinno
                        FROM ${this.config.schemas.service}.service_booking_logs 
                        WHERE request_id = $1 
                            AND booking_status IN ('Scheduled', 'In Service')`;
            const result = await this.pgPoolI.Query(query1, [oldBookingId]);
            if (result.rows.length === 0) {
                throw new Error("Booking not found");
            }

            const vinno = result.rows[0].vinno;
            const chassisNumber = utils.getChassisNumber(vinno);

            let query2 = `UPDATE ${this.config.schemas.service}.service_booking_logs 
                SET booking_status = $1 
                WHERE request_id = $2`;

            await this.pgPoolI.Query(query2, [
                SERVICE_BOOKING_STATUS.CANCELLED,
                oldBookingId,
            ]);
            try {
                const bookingResponse = await this.createVehicleServiceBooking(
                    accountId,
                    userId,
                    vinno,
                    chassisNumber,
                    mobileNumber,
                    newServiceType,
                    newKilometer,
                    modelDisplayName,
                    newParentGroup,
                    newLocationCode,
                    newDealerName,
                    newDealerAddress,
                    newSlot,
                    cookie,
                    true
                );

                return bookingResponse;
            } catch (e) {
                let query3 = `UPDATE ${this.config.schemas.service}.service_booking_logs 
                SET booking_status = $1 
                WHERE request_id = $2`;
                await this.pgPoolI.Query(query3, [
                    SERVICE_BOOKING_STATUS.BOOKED,
                    oldBookingId,
                ]);

                this.logger.error("Error in reschVehicleServiceBooking", e);
                const errorMessage = utils.checkForDbOrRequestError(e);
                if (errorMessage) {
                    throw errorMessage;
                }
                throw typeof e === "string" ? e : e.message;
            }
        } catch (e) {
            this.logger.error(
                "Error in reschVehicleServiceBooking",
                e.message || e
            );
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getVehicleInfo(vinno, chassisNumber, mobileNumber, cookie) {
        try {
            let vehicledetails = null;
            let inwarranty = null;
            let warrantyexpiredate = null;
            let vehicletelimatics = null;
            let lastservice = null;
            let modelcode = null;
            let modeldisplayname = null;
            let ageofvehicle = null;
            let vehicleage = null;
            let purchasedate = null;
            let regno = null;
            let rsaexpiredate = null;
            let rsashieldexpiredate = null;
            let warranty = null;

            let query = `SELECT delivered_date FROM vehicle WHERE vinno = $1`;
            let result = await this.pgPoolI.Query(query, [vinno]);
            if (result.rows.length === 0) {
                throw new Error("No vehicle found");
            }

            if (!result.rows[0].delivered_date) {
                purchasedate = null;
                ageofvehicle = null;
            } else {
                purchasedate = new Date(result.rows[0].delivered_date).toLocaleDateString();
                vehicleage = utils.calculateAge(new Date(purchasedate).getTime(), new Date().getTime());
            }

            let token = null;
            const requestId = this.serviceModSvcUtils.getRequestID();
            try {
                token = await this.serviceModSvcUtils.getMAuthToken(
                    mobileNumber,
                    requestId
                );
            } catch (error) {
                this.logger.error("Error in getVehicleInfo", error);
            }

            const vehicledetailsreqdata = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
                isOwnedVehicle: true,
            };

            const [vehicledetailsresult, vehicletelimaticsresult] =
                await Promise.allSettled([
                    wrapper.getVehicleDetails(
                        vehicledetailsreqdata,
                        token,
                        requestId
                    ),
                    this.serviceModSvcUtils.getVehicleRecentData(
                        [vinno],
                        cookie,
                        requestId
                    ),
                ]);

            if (vehicledetailsresult.status === "rejected") {
                this.logger.error(
                    `Vehicle details failed: ${vehicledetailsresult.reason}`
                );
            } else {
                vehicledetails = vehicledetailsresult.value;
                if (vehicledetails?.data?.ownedVehicleModel?.length === 0) {
                    this.logger.error("Vehicle not found");
                } else {
                    warrantyexpiredate =
                        vehicledetails?.data?.ownedVehicleModel[0]
                            ?.orgnlWarntyExpryDate;
                    if (warrantyexpiredate) {
                        if (
                            Date.now() > new Date(warrantyexpiredate).getTime()
                        ) {
                            warranty = "Warranty Expired";
                            inwarranty = false;
                        } else {
                            warranty = "In Warranty";
                            inwarranty = true;
                        }
                    }
                }
            }

            if (vehicletelimaticsresult.status === "rejected") {
                this.logger.error(
                    `Vehicle telematics failed: ${vehicletelimaticsresult.reason}`
                );
            } else {
                vehicletelimatics = vehicletelimaticsresult.value;
            }

            query = `
                        SELECT 
                            ro_bill_date as invoicedate,
                            dealer_name, 
                            odometer as lastserviceodo, 
                            net_bill_amt as lastserviceamount 
                        FROM ${this.config.schemas.service}.service_history
                        WHERE vinno = $1
                        ORDER BY invoicedate
                        DESC LIMIT 1`;
            result = await this.pgPoolI.Query(query, [vinno]);
            if (result.rows.length === 0) {
                this.logger.error("No service history found");
            } else {
                lastservice = result.rows[0];
            }

            query = `SELECT 
                        vehicle.modelcode,
                        vehicle_model.modeldisplayname,
                        COALESCE(vehicle.license_plate, vehicle.vinno) as regno
                    FROM vehicle 
                    INNER JOIN ${this.config.schemas.fmsauthsch}.vehicle_model ON vehicle.modelcode = vehicle_model.modelcode 
                    WHERE vinno = $1`;
            try {
                const mcode = await this.pgPoolI.Query(query, [vinno]);
                modelcode = mcode.rows[0].modelcode;
                modeldisplayname = mcode.rows[0].modeldisplayname;
                regno = mcode.rows[0].regno;
            } catch (e) {
                this.logger.error("error fetching the model code: ", e);
            }

            purchasedate = purchasedate
                ? utils.dateFormatter(new Date(purchasedate))
                : null;
            let insuranceDate =
                vehicledetails?.data?.ownedVehicleModel[0]?.insuranceExpirydt;
            let insurance = insuranceDate
                ? utils.dateFormatter(new Date(insuranceDate))
                : null;
            let rsaDetails =
                vehicledetails?.data?.ownedVehicleModel[0]?.rsaDetails;
            let shieldDetails =
                vehicledetails?.data?.ownedVehicleModel[0]?.shieldDetails;
            let isrsaactive = null;
            let isrsasheildactive = null;
            let lastserviceamt = null;
            let lastserviceodo = null;
            let invoicedate = lastservice?.invoicedate
                ? utils.dateFormatter(new Date(lastservice.invoicedate))
                : null;

            if (
                rsaDetails &&
                rsaDetails.length > 0 &&
                rsaDetails[0].rsaExpryDate
            ) {
                rsaexpiredate = utils.dateFormatter(
                    new Date(rsaDetails[0].rsaExpryDate)
                );
                isrsaactive =
                    new Date(rsaDetails[0].rsaExpryDate).getTime() >
                    new Date().getTime();
            }
            if (
                shieldDetails &&
                shieldDetails.length > 0 &&
                shieldDetails[0].schemeExpDate
            ) {
                rsashieldexpiredate = utils.dateFormatter(
                    new Date(shieldDetails[0].schemeExpDate)
                );
                isrsasheildactive =
                    new Date(shieldDetails[0].schemeExpDate).getTime() >
                    new Date().getTime();
            }

            if (lastservice?.lastserviceamount) {
                lastserviceamt = parseFloat(lastservice?.lastserviceamount);
            }

            if (lastservice?.lastserviceodo) {
                lastserviceodo = parseFloat(lastservice?.lastserviceodo);
            }
            let rsaType = null;
            if (rsaexpiredate) {
                rsaType = "RSA";
            } else if (rsashieldexpiredate) {
                rsaType = "RSA Shield";
            }

            warrantyexpiredate = warrantyexpiredate ? utils.dateFormatter(new Date(warrantyexpiredate)) : null;

            return {
                vehicledetails: {
                    odo: vehicletelimatics?.data?.candata[vinno]?.odometer || null,
                    regno: regno || "NA",
                    vinno: vinno || "NA",
                    purchasedate: purchasedate,
                    ageofvehicle: ageofvehicle, // TODO: Remove this after testing
                    vehicleage: vehicleage || "NA",
                    insuranceexpdate: insurance || "NA",
                    inwarranty: inwarranty || null,
                    warranty: warranty || "NA",
                    warrantyexpiredate: warrantyexpiredate || "NA",
                    lastserviceodo: lastserviceodo,
                    lastservicecost: lastserviceamt,    
                    lastservicedate: invoicedate || null,
                    lastservicecenter: lastservice?.dealer_name || "NA",
                    modelcode: modelcode || "NA",
                    modeldisplayname: modeldisplayname || "NA",
                    rsaexpiredate: rsaexpiredate,
                    rsashieldexpiredate: rsashieldexpiredate,
                    isrsaactive: isrsaactive,
                    isrsasheildactive: isrsasheildactive,
                    rsa: {
                        expiredate: rsaexpiredate || rsashieldexpiredate || "NA",
                        rsatype: rsaType,
                        isactive: isrsaactive || isrsasheildactive || null
                    }
                },
            };
        } catch (e) {
            this.logger.error("Error in getVehicleDetails", e.message || e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getMobileNumber(vinno) {
        const query = `SELECT mobile FROM vehicle WHERE vinno = $1`;
        const result = await this.pgPoolI.Query(query, [vinno]);
        if (result.rows.length === 0) {
            throw new Error("Vehicle not found");
        }
        return result?.rows[0]?.mobile || null;
    }

    async getKilometer(vinno) {
        try {
            const kiloMap = new Map();
            const serviceKilometersList =
                await this.serviceModSvcUtils.getServiceKilometersList();
            serviceKilometersList.forEach((km) => {
                kiloMap.set(km, false);
            });
            const vehicleServiceHistory =
                await this.serviceModSvcUtils.getVehiclesServiceHistory([
                    vinno,
                ]);
            const lastServiceKm = vehicleServiceHistory.find(
                (vehicle) => vehicle.vinno === vinno
            )?.kilometers;

            if (!lastServiceKm) {
                kiloMap.forEach((value, key) => {
                    kiloMap.set(key, true);
                });
                return Object.fromEntries(kiloMap);
            }

            const nextServiceKm = serviceKilometersList.find(
                (km) => km > lastServiceKm
            );
            kiloMap.set(nextServiceKm, true);
            return Object.fromEntries(kiloMap);
        } catch (error) {
            this.logger.error(
                "Error in getKilometer: ",
                error.message || error
            );
            throw typeof error === "string" ? error : error.message;
        }
    }

    async listNearestDealersSearch(dealerInfo) {
        try {
            const requestId = this.serviceModSvcUtils.getRequestID();
            const token = await this.serviceModSvcUtils.getMAuthToken(
                this.config.hardCodeData.mobileNumber,
                requestId
            );

            const {
                modelgroupdesc,
                pagesize,
                searchfilter,
                dealertype,
                latitude,
                longitude,
            } = dealerInfo;
            const listnearestdealersreqdata = {
                modelGroupDesc: modelgroupdesc,
                pageSize: pagesize,
                searchFilter: searchfilter,
                dealerType: dealertype,
                latitude: latitude,
                longitude: longitude,
            };
            const response = await wrapper.getNearestDealers(
                listnearestdealersreqdata,
                token,
                requestId
            );
            const result = response?.data;
            return result;
        } catch (error) {
            this.logger.error(
                "Error in listNearestDealersSearch: ",
                error.message || error
            );
            throw typeof error === "string" ? error : error.message;
        }
    }

    async getVehicleServiceStatus(
        accountid,
        vinno,
        chassisNumber,
        mobileNumber,
        bookingId
    ) {
        let [txclient, err] = await this.pgPoolI.StartTransaction();
        if (err) {
            throw new Error("Error in Starting Transaction");
        }
        try {
            const fleetid = await this.getFleetId(accountid, vinno);

            let query = `SELECT meta, booking_time FROM ${this.config.schemas.service}.service_booking_logs WHERE account_id = $1 AND fleet_id = $2 AND vinno = $3 AND request_id = $4`;
            const bookingResult = await txclient.query(query, [
                accountid,
                fleetid,
                vinno,
                bookingId,
            ]);
            if (bookingResult.rows.length === 0) {
                throw new Error("No Booking found for this vehicle");
            }

            const bookingMeta = bookingResult.rows[0].meta;
            const bookingTime = bookingResult.rows[0].booking_time;

            const token = await this.serviceModSvcUtils.getMAuthToken(
                mobileNumber,
                bookingId
            );

            const getvehicleservicereqdata = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
            };

            const getVehicleServiceResult =
                await wrapper.getServiceBookingStatus(
                    getvehicleservicereqdata,
                    token,
                    bookingId
                );
            const appointmentDetails =
                getVehicleServiceResult?.data?.appointmentBooking;

            if (!appointmentDetails) {
                throw new Error("No appointment details found");
            }

            const dmsbookingid = appointmentDetails?.dmsBookingId;

            const roBillDetails = getVehicleServiceResult?.data?.roBillDetail;
            let statusUpdate = true;
            statusUpdate = await this.updateBookingLogs(
                txclient,
                accountid,
                fleetid,
                vinno,
                bookingId,
                null,
                dmsbookingid,
                SERVICE_BOOKING_STATUS.BOOKED,
                null
            );
            if (!statusUpdate) {
                await this.pgPoolI.TxCommit(txclient);
                return statusUpdate;
            }
            if (
                !roBillDetails &&
                appointmentDetails?.bookingCancel === "Confirmed"
            ) {
                await this.pgPoolI.TxCommit(txclient);
                return {
                    isstatuscheck: true,
                    isbooknow: false,
                    iscompleted: false,
                    vinno: vinno,
                    iscancel: true,
                    isreschdule: true,
                    status: "Booked",
                    dealerName: appointmentDetails?.dealerName || null,
                    dealerAddress: appointmentDetails?.dealerAddress || null,
                };
            } else if (
                !roBillDetails &&
                appointmentDetails?.bookingCancel !== "Confirmed"
            ) {
                statusUpdate = await this.updateBookingLogs(
                    txclient,
                    accountid,
                    fleetid,
                    vinno,
                    bookingId,
                    null,
                    dmsbookingid,
                    SERVICE_BOOKING_STATUS.CANCELLED,
                    null
                );
                if (!statusUpdate) {
                    await this.pgPoolI.TxRollback(txclient);
                    return statusUpdate;
                }
                await this.pgPoolI.TxCommit(txclient);
                return {
                    isstatuscheck: false,
                    vinno: vinno,
                    isbooknow: true,
                    iscompleted: false,
                    iscancel: false,
                    isreschdule: false,
                    status: SERVICE_BOOKING_STATUS.CANCELLED,
                    dealerName: appointmentDetails?.dealerName || null,
                    dealerAddress: appointmentDetails?.dealerAddress || null,
                };
            }

            const dmsronumber = roBillDetails?.roNum;
            let status = "Booked";
            let roBillGenerated = false;
            let recentRoInfos = null;
            if (roBillDetails?.status === "Open") {
                status = SERVICE_BOOKING_STATUS.RO_OPEN;
            }
            if (roBillDetails?.status === "Closed") {
                status = "In Service";
                const serviceHistoryReqData = {
                    mobileNumber: mobileNumber,
                    chassisNumber: chassisNumber,
                    isThisYear: true,
                };
                let { isRoBillGenerated, listRoInfos } =
                    await this.getRecentRoBillDetails(
                        serviceHistoryReqData,
                        token,
                        bookingId,
                        dmsronumber
                    );
                roBillGenerated = isRoBillGenerated;
                recentRoInfos = listRoInfos;
            }

            if (!roBillGenerated) {
                statusUpdate = await this.updateBookingLogs(
                    txclient,
                    accountid,
                    fleetid,
                    vinno,
                    bookingId,
                    dmsronumber,
                    dmsbookingid,
                    SERVICE_BOOKING_STATUS.RO_OPEN,
                    null
                );
                if (!statusUpdate) {
                    await this.pgPoolI.TxRollback(txclient);
                    return statusUpdate;
                }
                await this.pgPoolI.TxCommit(txclient);
                return {
                    isstatuscheck: true,
                    isbooknow: false,
                    iscompleted: false,
                    vinno: vinno,
                    iscancel: false,
                    isreschdule: false,
                    status: status,
                    dealerName: appointmentDetails?.dealerName || null,
                    dealerAddress: appointmentDetails?.dealerAddress || null,
                };
            }

            try {
                // These we written considering the case where the user has multiple ro bills for a single booking.
                if (recentRoInfos?.length) {
                    let roBillNo = recentRoInfos[0]?.roBillNum;
                    let roBillDate = recentRoInfos[0]?.roBillDate;
                    let nextDueDate = nextServiceDetails?.nextDueDate;
                    let netBillAmt = recentRoInfos[0]?.netBillAmt;
                    let dealerCode = roBillDetails?.parentCode;
                    let dealerLocation = roBillDetails?.dealersAddress;
                    let dealerName = appointmentDetails?.dealerName;
                    let locationCode = roBillDetails?.locationCode;
                    let odometer = bookingMeta?.odometer;
                    let bookTime = bookingTime;
                    let status = SERVICE_BOOKING_STATUS.COMPLETED;
                    query = `INSERT INTO ${this.config.schemas.service}.service_history(vinno, dealer_code, dealer_name, dealer_location, status, odometer, ro_number, ro_bill_number, ro_bill_date, net_bill_amt, request_id, next_due_date, booking_time, location_code) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;
                    await txclient.query(query, [
                        vinno,
                        dealerCode,
                        dealerName || " ",
                        dealerLocation,
                        status,
                        odometer,
                        dmsronumber,
                        roBillNo,
                        roBillDate,
                        netBillAmt,
                        bookingId,
                        nextDueDate,
                        bookTime,
                        locationCode,
                    ]);
                    statusUpdate = await this.updateBookingLogs(
                        txclient,
                        accountid,
                        fleetid,
                        vinno,
                        bookingId,
                        dmsronumber,
                        dmsbookingid,
                        SERVICE_BOOKING_STATUS.COMPLETED,
                        roBillDate
                    );
                    if (!statusUpdate) {
                        await this.pgPoolI.TxRollback(txclient);
                        return statusUpdate;
                    }
                } else {
                    statusUpdate = await this.updateBookingLogs(
                        txclient,
                        accountid,
                        fleetid,
                        vinno,
                        bookingId,
                        dmsronumber,
                        dmsbookingid,
                        SERVICE_BOOKING_STATUS.RO_OPEN,
                        null
                    );
                    if (!statusUpdate) {
                        await this.pgPoolI.TxRollback(txclient);
                        return statusUpdate;
                    }
                    await this.pgPoolI.TxCommit(txclient);
                    return {
                        isstatuscheck: true,
                        isbooknow: false,
                        iscompleted: false,
                        vinno: vinno,
                        iscancel: false,
                        isreschdule: false,
                        status: SERVICE_BOOKING_STATUS.RO_OPEN,
                        dealerName: appointmentDetails?.dealerName || null,
                        dealerAddress:
                            appointmentDetails?.dealerAddress || null,
                    };
                }
                await this.pgPoolI.TxCommit(txclient);
            } catch (error) {
                this.logger.error(
                    "Error in getVehicleServiceStatus: ",
                    error.message || error
                );
                await this.pgPoolI.TxRollback(txclient);
                return {
                    error: "Status Updation Failed.",
                };
            }

            return {
                isstatuscheck: false,
                isbooknow: true,
                iscompleted: true,
                vinno: vinno,
                iscancel: false,
                isreschdule: false,
                status: status,
                dealerName: appointmentDetails?.dealerName || null,
                dealerAddress: appointmentDetails?.dealerAddress || null,
            };
        } catch (error) {
            await this.pgPoolI.TxRollback(txclient);
            this.logger.error(
                "Error in getVehicleServiceStatus: ",
                error.message || error
            );
            throw typeof error === "string" ? error : error.message;
        }
    }

    async updateBookingLogs(
        txclient,
        accountid,
        fleetid,
        vinno,
        bookingId,
        dmsronumber,
        dmsbookingid,
        status,
        roBillDate
    ) {
        try {
            const query = `
            UPDATE ${this.config.schemas.service}.service_booking_logs
            SET dms_ronumber = $1, 
                dms_booking_id = $2, 
                booking_status = $3, 
                meta = CASE 
                    WHEN $4 IS NOT NULL 
                    THEN jsonb_set(COALESCE(meta, '{}'::jsonb), '{ro_bill_date}', to_jsonb($4), true)
                    ELSE meta
                END
            WHERE account_id = $5 AND fleet_id = $6 AND vinno = $7 AND request_id = $8;
        `;

            await txclient.query(query, [
                dmsronumber,
                dmsbookingid,
                status,
                roBillDate,
                accountid,
                fleetid,
                vinno,
                bookingId,
            ]);
            return true;
        } catch (error) {
            return {
                error: "Couldn't update booking logs, please try again.",
            };
        }
    }

    async getRecentRoBillDetails(
        serviceHistoryReqData,
        token,
        bookingId,
        dmsronumber
    ) {
        try {
            const serviceHistoryResult = await wrapper.getServiceHistory(
                serviceHistoryReqData,
                token,
                bookingId
            );
            const roInfos = serviceHistoryResult?.data?.roInfos;
            let recentRoInfos = null;
            let roBillGenerated = false;
            if (roInfos?.length > 0) {
                const matchingRoInfos = roInfos.filter(
                    (roInfo) => roInfo.roNum === dmsronumber
                );
                const now = new Date();
                let minDiff = Infinity;
                let closestDate = null;
                matchingRoInfos.forEach((roInfo) => {
                    const roDate = new Date(roInfo.roBillDate);
                    if (roDate > now) return;
                    const diff = now - roDate;
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestDate = roDate;
                    }
                });

                recentRoInfos = matchingRoInfos.filter((roInfo) => {
                    const roDate = new Date(roInfo.roBillDate);
                    return roDate.getTime() === closestDate?.getTime();
                });
                if (recentRoInfos.length > 0) {
                    roBillGenerated = true;
                } else {
                    roBillGenerated = false;
                }
            } else {
                roBillGenerated = false;
            }
            return {
                listRoInfos: recentRoInfos,
                isRoBillGenerated: roBillGenerated,
            };
        } catch (error) {
            throw error;
        }
    }

    async getFleetId(accountid, vinno) {
        try {
            let query = `SELECT fleetid FROM fleet_vehicle WHERE accountid = $1 AND vinno = $2`;
            let result = await this.pgPoolI.Query(query, [accountid, vinno]);
            if (result.rows.length === 0) {
                throw new Error("No fleet found for this vehicle");
            }
            return result.rows[0].fleetid;
        } catch (error) {
            this.logger.error("Error in getFleetId: ", error);
            throw error.message;
        }
    }

    async getExternalVehicleInfo(chassisNumber, mobileNumber) {
        try {
            let token;
            const requestId = this.serviceModSvcUtils.getRequestID();
            token = await this.serviceModSvcUtils.getMAuthToken(mobileNumber, requestId);
            const vehicledetailsreqdata = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
                isOwnedVehicle: true
            };
            let warrantyexpiredate = null;
            let warranty = null;
            let inwarranty = null;
            let rsaexpiredate = null;
            let rsashieldexpiredate = null;
            let isrsaactive = null;
            let insuranceexpdate = null;
            let isinsuranceactive = null;
            let rsaDetails = null;
            let rsaShieldDetails = null;
            let rsaType = null;
            let response;
            const vehicledetailsresult = await wrapper.getVehicleDetails(vehicledetailsreqdata, token, requestId);
            const vehicledetails = vehicledetailsresult.data.ownedVehicleModel;
            if (vehicledetails?.length === 0) {
                throw new Error("Vehicle details not found");
            } else {
                warrantyexpiredate = vehicledetails[0]?.orgnlWarntyExpryDate ? utils.dateFormatter(new Date(vehicledetails[0]?.orgnlWarntyExpryDate)) : "NA";
                if (warrantyexpiredate) {
                    if (Date.now() > new Date(warrantyexpiredate).getTime()) {
                        warranty = "Warranty Expired";
                        inwarranty = false;
                    } else {
                        warranty = "In Warranty";
                        inwarranty = true;
                    }
                }

                rsaDetails = vehicledetails[0]?.rsaDetails;
                rsaShieldDetails = vehicledetails[0]?.shieldDetails;

                if (rsaDetails?.length > 0) {
                    rsaexpiredate = rsaDetails[0]?.rsaExpryDate ? utils.dateFormatter(new Date(rsaDetails[0]?.rsaExpryDate)) : "NA";
                    rsaType = "RSA";
                    isrsaactive = true;
                } else if (rsaShieldDetails?.length > 0) {
                    rsashieldexpiredate = rsaShieldDetails[0]?.schemeExpDate ? utils.dateFormatter(new Date(rsaShieldDetails[0]?.schemeExpDate)) : "NA";
                    rsaType = "RSA Shield";
                    isrsaactive = true;
                }

                if (vehicledetails[0]?.insuranceExpirydt) {
                    insuranceexpdate = vehicledetails[0].insuranceExpirydt ? utils.dateFormatter(new Date(vehicledetails[0].insuranceExpirydt)) : "NA";
                    isinsuranceactive = true;
                }

                response = {
                    warranty: {
                        expiredate: warrantyexpiredate || "NA",
                        warranty: warranty || "NA",
                        inwarranty: inwarranty
                    },
                    rsa: {
                        expiredate: rsaexpiredate || rsashieldexpiredate || "NA",
                        rsatype: rsaType || "NA",
                        isrsaactive: isrsaactive
                    },
                    insurance: {
                        expiredate: insuranceexpdate || "NA",
                        isinsuranceactive: isinsuranceactive,
                    }
                }
            }
            return response;
        } catch (error) {
            this.logger.error("Error in getExternalVehicleInfo: ", error);
            throw typeof error === "string" ? error : error.message;
        }
    }
}
