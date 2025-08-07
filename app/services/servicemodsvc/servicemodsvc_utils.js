import * as wrapper from "../../utils/wrappers/wrappers.js";
import { v4 as uuidv4 } from "uuid";

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

const BATCH_SIZE = 500;

export class ServiceModSvcUtils {
    constructor(pgPoolI, logger, config) {
        this.pgPoolI = pgPoolI;
        this.config = config;
        this.logger = logger;
    }

    getRequestID() {
        return uuidv4();
    }

    async getUserFleetId(accountid, userid) {
        try {
            const query = `WITH RECURSIVE fleet_hierarchy AS (
                SELECT fleetid
                FROM ${this.config.schemas.fmsauthsch}.fleet_tree
                WHERE fleetid = ANY(SELECT fleetid FROM ${this.config.schemas.fmsauthsch}.user_fleet WHERE accountid = $1 AND userid = $2)
                AND isdeleted = false
                UNION ALL
                SELECT child.fleetid
                FROM ${this.config.schemas.fmsauthsch}.fleet_tree child
                INNER JOIN fleet_hierarchy parent ON child.pfleetid = parent.fleetid
                WHERE child.isdeleted = false
            ) SELECT fleetid FROM fleet_hierarchy`;
            const result = await this.pgPoolI.Query(query, [accountid, userid]);
            if (result.rows.length === 0) {
                throw new Error("User does not have access to any fleet");
            }
            return result.rows.map((row) => row.fleetid);
        } catch (e) {
            this.logger.error("Error in getUserFleetId", e);
            throw typeof e === "string" ? e : e.message || "Unable to get user fleetids";
        }
    }

    async getVehicleFleetId(accountid, vinno) {
        try {
            const query = `SELECT fleetid FROM fleet_vehicle WHERE accountid = $1 AND vinno = $2`;
            const result = await this.pgPoolI.Query(query, [accountid, vinno]);
            if (result.rows.length === 0) {
                throw new Error("Vehicle not found inside the fleet");
            }
            return result.rows[0]?.fleetid;
        } catch (e) {
            this.logger.error("Error in getVehicleFleetId", e);
            throw typeof e === "string"
                ? e : e?.message;
        }
    }

    async userFleetValidation(accountid, userid, fleetid) {
        try {
            const query = `WITH RECURSIVE fleet_hierarchy AS (
                SELECT fleetid
                FROM ${this.config.schemas.fmsauthsch}.fleet_tree
                WHERE fleetid = ANY(SELECT fleetid FROM user_fleet WHERE accountid = $1 AND userid = $2)
                AND isdeleted = false
                UNION ALL
                SELECT child.fleetid
                FROM ${this.config.schemas.fmsauthsch}.fleet_tree child
                INNER JOIN fleet_hierarchy parent ON child.pfleetid = parent.fleetid
                WHERE child.isdeleted = false
            ) SELECT fleetid FROM fleet_hierarchy WHERE fleetid = $3`;
            const result = await this.pgPoolI.Query(query, [
                accountid,
                userid,
                fleetid,
            ]);
            return result.rows.length > 0;
        } catch (e) {
            this.logger.error("Error in userFleetValidation", e);
            throw typeof e === "string"
                ? e
                : e?.message || new Error("Error in userFleetValidation");
        }
    }

    async getRecursiveFleets(fleetid, accountid) {
        try {
            const query = `
                            WITH RECURSIVE fleet_hierarchy AS (
                                SELECT pfleetid, fleetid, name, isdeleted, fleetinfo
                                FROM ${this.config.schemas.fmsauthsch}.fleet_tree
                                WHERE fleetid = $1
                                AND isdeleted = false
                                AND accountid = $2
                                UNION ALL
                                SELECT child.pfleetid, child.fleetid, child.name, child.isdeleted, child.fleetinfo
                                FROM ${this.config.schemas.fmsauthsch}.fleet_tree child
                                INNER JOIN fleet_hierarchy parent ON child.pfleetid = parent.fleetid
                            )
                            SELECT jsonb_agg(fleet_hierarchy) AS fleets
                            FROM fleet_hierarchy
                        `;
            /*
                return data like this:
                [
                    {
                        pfleetid: '...',
                        fleetid: '...',
                        name: '...',
                        isdeleted: false,
                        fleetinfo: {}
                    },
                    ...
                ]
            */
            const result = await this.pgPoolI.Query(query, [
                fleetid,
                accountid,
            ]);
            return result.rows[0].fleets;
        } catch (e) {
            this.logger.error("Error in getRecursiveFleets", e);
            throw typeof e === "string"
                ? e
                : e?.message || new Error("Error in getRecursiveFleets");
        }
    }

    async getFleetVehicles(fleetids) {
        try {
            const query = `SELECT 
                            vinno 
                        FROM fleet_vehicle 
                        WHERE fleetid = ANY($1)`;
            const result = await this.pgPoolI.Query(query, [fleetids]);
            return result.rows.map((row) => row.vinno);
        } catch (e) {
            this.logger.error("Error in getFleetVehicles", e);
            throw typeof e === "string"
                ? e
                : e?.message || new Error("Error in getFleetVehicles");
        }
    }

    async getVehicleDetails(vehicles) {
        const query = `SELECT 
                        v.vinno, 
                        vm.modelcode, 
                        vm.modeldisplayname,
                        COALESCE(v.license_plate, v.vinno) as regno
                    FROM vehicle v 
                    INNER JOIN vehicle_model vm ON v.modelcode = vm.modelcode 
                    WHERE vinno = ANY($1)`;
        const result = await this.pgPoolI.Query(query, [vehicles]);
        let vehicleDetails = new Map();
        result.rows.forEach((row) => {
            vehicleDetails.set(row.vinno, {
                vinno: row.vinno,
                regno: row.regno,
                modelcode: row.modelcode,
                modeldisplayname: row.modeldisplayname,
            });
        });
        return vehicleDetails;
    }

    async getServiceKilometersList() {
        const query = `SELECT distinct
                        kilometers 
                    FROM ${this.config.schemas.service}.service_kilometers
                    WHERE id != 23
                    ORDER BY kilometers ASC`;
        const result = await this.pgPoolI.Query(query);
        const serviceKilometersList = result.rows.map((row) => row.kilometers);
        return serviceKilometersList;
    }

    async verifyKilometer(kilometer, vinno) {
        const serviceKilometersList = await this.getServiceKilometersList();

        if (!lastServiceKm) {
            return "unknown";
        }

        const lastServiceKmIndex = serviceKilometersList.indexOf(lastServiceKm);
        const kilometerIndex = serviceKilometersList.indexOf(kilometer);
        if (kilometerIndex != lastServiceKmIndex + 1) {
            throw new Error("Service kilometer is not in the correct sequence");
        }
        return true;
    }

    async checkAccountVehicle(accountid, vinno) {
        try {
            const query = `SELECT fleetid FROM fleet_vehicle WHERE accountid = $1 AND vinno = $2`;
            const result = await this.pgPoolI.Query(query, [accountid, vinno]);
            if (result.rows.length === 0) {
                throw new Error(`No Vehicle with vinno ${vinno} found inside the account`);
            }
            return result.rows[0].fleetid;
        } catch (e) {
            this.logger.error("Error in checkAccountVehicle", e);
            throw typeof e === "string" ? e : e.message;
        }
    }

    async getVehiclesServiceHistory(vehicles, accountId) {
        try {
            const vehicleServiceHistoryQuery = ` 
                SELECT * FROM (
                    SELECT 
                            sbl.vinno,  
                            (sbl.meta->>'ro_bill_date')::timestamp as servicedate, 
                            (sbl.meta->>'dealer_name') as servicecenter, 
                            (sbl.meta->>'dealer_location') as servicelocation, 
                            (sbl.meta->>'odometer')::integer as serviceodo,
                            (sbl.meta->>'servicetype')::text as servicetype,
                            (sbl.meta->>'slot')::text as slot,
                            sbl.booking_status as bookingstatus, 
                            sbl.dms_ronumber as dmsronumber, 
                            sbl.request_id as bookingid, 
                            (sbl.meta->>'next_due_date')::date as nextduedate, 
                            sbl.booking_time as bookingtime,
                            sbl.created_at as createdat,
                            ROW_NUMBER() OVER (
                                PARTITION BY sbl.vinno 
                                ORDER BY 
                                    CASE sbl.booking_status 
                                        WHEN 'In Service' THEN 1
                                        WHEN 'Scheduled' THEN 2
                                        WHEN 'Completed' THEN 3
                                        ELSE 4
                                    END,
                                    sbl.created_at DESC
                            ) as rn
                        FROM ${this.config.schemas.service}.service_booking_logs sbl 
                        WHERE sbl.vinno = ANY($1)  
                          AND sbl.account_id = $2
                          AND sbl.booking_status IN ('In Service', 'Scheduled', 'Completed') 
                ) ranked
                WHERE rn = 1
            `;

            const vehiclesServiceHistory = await this.pgPoolI.Query(
                vehicleServiceHistoryQuery,
                [vehicles, accountId]
            );
            return vehiclesServiceHistory.rows;
        } catch (e) {
            this.logger.error("Error in getVehiclesServiceHistory", e);
            throw typeof e === "string"
                ? e
                : e?.message || new Error("Error in getVehiclesServiceHistory");
        }
    }

    filterVehicleServiceDetails(vehicleServiceDetails, serviceKilometersList, startdate) {
        const tabs = {
            overdue: [],
            inservice: [],
            booked: [],
            recent: [],
            all: [],
        };

        const MS_PER_DAY = 86_400_000;
        const today = new Date();
        const diffDays = (a, b = today) => Math.ceil((a - b) / MS_PER_DAY);
        const RECENT_WINDOW_DAYS = startdate ? diffDays(new Date(Number(startdate))) : 60;

        vehicleServiceDetails.forEach((src) => {
            const v = { ...src };
            Object.assign(v, {
                isbooknow: false,
                isestimate: false,
                isstatuscheck: false,
                isreshcedule: false,
                iscancel: false,
            });
            switch (v.bookingstatus) {
                case SERVICE_BOOKING_STATUS.RO_OPEN: {
                    v.bookingstatus = "In_Service";
                    v.isestimate = v.isstatuscheck = true;
                    delete v.duedate;
                    tabs.inservice.push({ ...v });
                    break;
                }
                case SERVICE_BOOKING_STATUS.BOOKED: {
                    v.bookingstatus = "Booked";
                    v.isreshcedule = v.iscancel = v.isstatuscheck = true;
                    delete v.duedate;
                    tabs.booked.push({ ...v });
                    break;
                }
                case SERVICE_BOOKING_STATUS.COMPLETED:
                    v.bookingstatus = "Completed";
                    break;
                default:
                    break;
            }
            if (v.bookingstatus === "Completed") {
                if (v.duedate) {
                    const daysDiff = diffDays(new Date(v.duedate));
                    if (daysDiff < 0) v.overduedays = Math.abs(daysDiff);
                    else v.nextduedays = daysDiff;
                }
                if (v.serviceodo && v.odometer) {
                    const nextKm = this.getnextservicekm(
                        v.serviceodo,
                        v.odometer,
                        serviceKilometersList
                    );
                    if (nextKm) {
                        if (v.odometer > nextKm)
                            v.overduekm = v.odometer - nextKm;
                        else v.nextduekm = nextKm - v.odometer;
                    }
                }
                if ((v.overduedays ?? 0) > 0 || (v.overduekm ?? 0) > 0) {
                    v.bookingstatus = "Overdue";
                    v.isbooknow = true;
                    v.bookingtime = null;
                    delete v.duedate;
                    tabs.overdue.push({ ...v });
                } else if (
                    v.servicedate &&
                    diffDays(new Date(v.servicedate)) >= -RECENT_WINDOW_DAYS
                ) {
                    v.bookingstatus = "Serviced";
                    v.isbooknow = true;
                    tabs.recent.push({ ...v });
                }
            }
            if (!["In_Service", "Booked"].includes(v.bookingstatus)) {
                v.isbooknow = true;
                v.bookingtime = null;
                v.servicetype = null;
                v.slot = null;
            }
            delete v.duedate;
            tabs.all.push({ ...v });
        });
        return tabs;
    }

    getnextservicekm(lastServiOdo, currentOdo, serviceIntervalList) {
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

    async getAllFilteredVehiclesInService(
        accountId,
        vehicles,
        requestId,
        cookie,
        startdate
    ) {
        try {
            //get the vehicle details
            const vehicleDetails = await this.getVehicleDetails(vehicles);

            //get the service kilometers list
            const serviceKilometersList = await this.getServiceKilometersList();

            //get the recent data for each vehicle
            const recentData = await this.getVehicleRecentData(
                vehicles,
                cookie,
                requestId
            );

            let vehiclesData = new Map();
            vehicles.map((vehicle) => {
                vehiclesData.set(vehicle, {
                    vinno: vehicle,
                    regno: vehicleDetails.get(vehicle).regno,
                    modelcode: vehicleDetails.get(vehicle).modelcode,
                    modeldisplayname:
                        vehicleDetails.get(vehicle).modeldisplayname,
                    odometer: Math.round(
                        recentData?.data?.candata[vehicle]?.odometer
                    ),
                    location: {
                        lat: recentData?.data?.gpsdata[vehicle]?.latitude,
                        lng: recentData?.data?.gpsdata[vehicle]?.longitude,
                    },
                    bookingid: null,
                    dmsronumber: null,
                    bookingstatus: null,
                    bookingtime: null,
                    slot: null,
                    servicetype: null,
                    servicedate: null,
                    serviceodo: null,
                    servicelocation: null,
                    servicecenter: null,
                    overduekm: null,
                    overduedays: null,
                    nextduedays: null,
                    nextduekm: null,
                    estimatecost: null,
                    isbooknow: false,
                    isestimate: false,
                    isreshcedule: false,
                    iscancel: false,
                    isstatuscheck: false,
                    duedate: null,
                });
            });

            //get the service history for each vehicle
            const vehiclesServiceHistory = await this.getVehiclesServiceHistory(
                vehicles,
                accountId
            );

            vehiclesServiceHistory.forEach((vehicleServiceData) => {
                vehiclesData.set(vehicleServiceData.vinno, {
                    ...vehiclesData.get(vehicleServiceData.vinno),
                    bookingid: vehicleServiceData.bookingid,
                    dmsronumber: vehicleServiceData.dmsronumber,
                    bookingstatus: vehicleServiceData.bookingstatus,
                    bookingtime: vehicleServiceData.bookingtime,
                    slot: vehicleServiceData.slot,
                    servicetype: vehicleServiceData.servicetype,
                    servicedate: vehicleServiceData.servicedate,
                    serviceodo: vehicleServiceData.serviceodo,
                    servicecenter: vehicleServiceData.servicecenter,
                    servicelocation: vehicleServiceData.servicelocation,
                    duedate: vehicleServiceData.nextduedate,
                });
            });

            //filter the vehicle service details
            const filteredVehicleServiceDetails =
                this.filterVehicleServiceDetails(
                    vehiclesData,
                    serviceKilometersList,
                    startdate
                );
            return filteredVehicleServiceDetails;
        } catch (e) {
            this.logger.error("Error in getAllFilteredVehiclesInService", e);
            throw typeof e === "string" ? e : e?.message || new Error("Error in getAllFilteredVehiclesInService");
        }
    }

    async getVehicleRecentData(vinnos, cookie, requestId) {
        try {
            const path = "/historydata/vehicle/latestdata";
            const METHOD = 'POST';
    
            if (!vinnos.length) {
                return { data: { candata: {}, gpsdata: {} } };
            }
            
            let batches = [];
            for (let i = 0; i < vinnos.length; i += BATCH_SIZE) {
                batches.push(vinnos.slice(i, i + BATCH_SIZE));
            }
    
            const batchPromises = batches.map(async (batch, batchIndex) => {
                try {
                    const body = { vinnos: batch };   
                    const vehicletelimatics = await wrapper.connectToExternalApi(path, body, METHOD, cookie);
                    return {
                        status: 'fulfilled',
                        data: vehicletelimatics
                    };
                } catch (error) {
                    this.logger.error(`Batch ${batchIndex} failed:`, error?.message || error);
                    return {
                        status: 'rejected',
                        error: error?.message || error
                    }
                }
            });
    
            const batchResults = await Promise.allSettled(batchPromises);
            
            let aggregatedData = { data: { candata: {}, gpsdata: {} } };
            let failedBatches = 0;
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const batchResult = result.value;
                    if (batchResult.status === 'fulfilled') {
                        if (batchResult.data?.data?.candata) {
                            Object.assign(aggregatedData.data.candata, batchResult.data.data.candata);
                        }
                        if (batchResult.data?.data?.gpsdata) {
                            Object.assign(aggregatedData.data.gpsdata, batchResult.data.data.gpsdata);
                        }
                    } else {
                        failedBatches++;
                        this.logger.error(`Batch ${index} failed:`, batchResult.error);
                    }
                }
            });
            this.logger.info(`Batch processing completed: ${batchResults.length - failedBatches} successful, ${failedBatches} failed`);
            return aggregatedData;
        } catch (e) {
            this.logger.error("Error in getVehicleRecentData", e.data?.message || e.message);
            throw e;
        }
    }
    async getMAuthToken(mobilenumber, requestId) {
        const authtokenreqdata = {
            muserid: `NEMO3.0-ADC-USERID-${mobilenumber}`,
        };
        const token = await wrapper.getAuthToken(authtokenreqdata, requestId);
        if (!token) {
            throw typeof token === "string" ? token : new Error("Mahindra token generation failed");
        }
        return token;
    }
}
