export default class ServiceModSvcDB {
    constructor(pgPoolI, logger, config) {
        this.pgPoolI = pgPoolI;
        this.logger = logger;
        this.config = config;
    }

    async startTransaction() {
        try {
            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw err;
            }
            return txclient;
        } catch (error) {
            throw error;
        }
    }

    async commitTransaction(txclient) {
        try {
            await this.pgPoolI.TxCommit(txclient);
        } catch (error) {
            throw error;
        }
    }

    async rollbackTransaction(txclient) {
        try {
            await this.pgPoolI.TxRollback(txclient);
        } catch (error) {
            throw error;
        }
    }

    async getUserFleets(accountid, userid) {
        try {
            const allFleetsQuery = `
              SELECT * FROM ${this.config.schemas.fmscoresch}.get_all_fleets_path_from_root($1, $2)
            `;
            const allFleets = await this.pgPoolI.Query(allFleetsQuery, [accountid, userid]);
            if (allFleets.rowCount === 0) {
                return null;
            }

            const accessibleFleetsQuery = `
              SELECT DISTINCT fleetid 
              FROM ${this.config.schemas.fmscoresch}.fleet_user_role 
              WHERE accountid = $1 AND userid = $2
            `;
            const accessibleFleets = await this.pgPoolI.Query(accessibleFleetsQuery, [accountid, userid]);
            if (accessibleFleets.rowCount === 0) {
                return null;
            }

            const accessibleFleetIds = accessibleFleets.rows.map((row) => row.fleetid);

            const childFleetsQuery = `
              WITH RECURSIVE fleet_children AS (
                SELECT ft.fleetid
                FROM ${this.config.schemas.fmscoresch}.fleet_tree ft
                WHERE ft.accountid = $1
                  AND ft.fleetid = ANY($2)
                  AND ft.isdeleted = false
      
                UNION ALL
      
                SELECT ft.fleetid
                FROM ${this.config.schemas.fmscoresch}.fleet_tree ft
                JOIN fleet_children fc ON ft.pfleetid = fc.fleetid
                WHERE ft.accountid = $1 AND ft.isdeleted = false
      
              )
              SELECT DISTINCT fleetid FROM fleet_children;
            `;

            const allAllowedFleets = await this.pgPoolI.Query(childFleetsQuery, [accountid, accessibleFleetIds]);
            const allowedFleetIds = new Set(allAllowedFleets?.rows?.map((row) => row.fleetid) || []);
            const filteredFleets = allFleets?.rows?.filter((fleet) => allowedFleetIds.has(fleet.fleetid)) || [];
            const fleets = filteredFleets?.map((obj) => obj.fleetid) || [];

            return fleets;
        } catch (error) {
            throw error;
        }
    }

    async getVehicleFleet(accountId, vinno) {
        try {
            const query = `SELECT fleetid FROM ${this.config.schemas.fmscoresch}.fleet_vehicle WHERE accountid = $1 AND vinno = $2`;
            const result = await this.pgPoolI.Query(query, [accountId, vinno]);
            const fleetid = result.rows[0]?.fleetid || null;
            return fleetid;
        } catch (error) {
            this.logger.error('Error in getVehicleFleet', error.toString());
            throw error;
        }
    }

    async getOnboardingPendingQueue(vinno) {
        try {
            const query = `SELECT 
                                    vinno,
                                    mobileno, 
                                    muserid, 
                                    createdat 
                                FROM ${this.config.schemas.service}.onboarding_pending_queue 
                                WHERE vinno = $1;`;
            const result = await this.pgPoolI.Query(query, [vinno]);
            const onboardingQueue = result.rows;
            if (onboardingQueue.length > 0) {
                return onboardingQueue[0];
            }
            return null;
        } catch (error) {
            throw error;
        }
    }

    // I can do an upsert here, when conflict happens, update the mobileno and muserid but i ll go with the insert and update approach for now
    async createOnboardingPendingQueue(vinno, mobileno) {
        try {
            const query = `INSERT INTO ${this.config.schemas.service}.onboarding_pending_queue 
                            (vinno, mobileno, muserid)
                            VALUES ($1, $2, $3);`;
            await this.pgPoolI.Query(query, [vinno, mobileno, `NEMO3.0-ADC-USERID-${mobileno}`]);
            return;
        } catch (error) {
            throw error;
        }
    }

    async updateOnboardingPendingQueue(vinno, mobileno) {
        try {
            const query = `UPDATE ${this.config.schemas.service}.onboarding_pending_queue SET mobileno = $1, muserid = $2 WHERE vinno = $3`;
            await this.pgPoolI.Query(query, [mobileno, `NEMO3.0-ADC-USERID-${mobileno}`, vinno]);
        } catch (error) {
            throw error;
        }
    }

    async deleteOnboardingPendingQueue(txclient, vinno, mobileno) {
        try {
            const query = `DELETE FROM ${this.config.schemas.service}.onboarding_pending_queue WHERE vinno = $1 AND mobileno = $2`;
            await txclient.query(query, [vinno, mobileno]);
        } catch (error) {
            throw error;
        }
    }

    async updateVehicleMobileno(txclient, vinno, mobileno) {
        try {
            const query = `UPDATE ${this.config.schemas.fmscoresch}.vehicle SET mobile = $1 WHERE vinno = $2;`;
            await txclient.query(query, [mobileno, vinno]);
        } catch (error) {
            throw error;
        }
    }

    async fetchPendingVehicleOnboarding() {
        try {
            let query = `SELECT count(*) as total FROM ${this.config.schemas.service}.onboarding_pending_queue`;
            const totalPendingOnboards = await this.pgPoolI.Query(query);

            if (totalPendingOnboards.rows[0].total === 0) {
                return { data: null, total: 0 };
            }

            query = `SELECT vinno, mobileno, muserid FROM ${this.config.schemas.service}.onboarding_pending_queue ORDER BY createdat LIMIT 1`;
            const pendingOnboards = await this.pgPoolI.Query(query);
            return { data: pendingOnboards.rows[0], total: totalPendingOnboards.rows[0].total };
        } catch (err) {
            this.logger.error('Error in fetchPendingVehicleOnboarding: ', err);
            throw 'Fetch pending vehicle to onboard failed, please try again later.';
        }
    }

    async markVehicleOnboarded(txclient, vinno, mobileno, muserid, responsebody) {
        try {
            const query = `INSERT INTO ${this.config.schemas.service}.onboarding_done (vinno, mobileno, muserid, responsebody) VALUES ($1, $2, $3, $4)`;
            await txclient.query(query, [vinno, mobileno, muserid, responsebody]);
            this.logger.info(`muserid ${muserid} onboarded`);
            return;
        } catch (error) {
            this.logger.error('Error in markVehicleOnboarded: ', error.toString());
            throw error;
        }
    }

    async moveToErrorTable(txclient, onboardingData, errorResult) {
        try {
            const query = `INSERT INTO ${this.config.schemas.service}.onboarding_error (vinno, mobileno, muserid, requestbody, responsebody) VALUES ($1, $2, $3, $4, $5)`;
            await txclient.query(query, [onboardingData.vinno, onboardingData.mobileNumber, onboardingData.userId, JSON.stringify(onboardingData), JSON.stringify(errorResult)]);
            this.logger.info(`muserid ${onboardingData.userId} moved to error table`);
        } catch (error) {
            this.logger.error('Error in moveToErrorTable: ', error.toString());
            throw error;
        }
    }

    async getFleetVehicles(fleetids) {
        try {
            const query = `SELECT 
                            vinno 
                        FROM ${this.config.schemas.fmscoresch}.fleet_vehicle 
                        WHERE fleetid = ANY($1)`;
            const result = await this.pgPoolI.Query(query, [fleetids]);
            const fleetVehicles = result.rows.map((row) => row.vinno);
            return fleetVehicles;
        } catch (error) {
            throw error;
        }
    }

    async getServiceKilometersList() {
        try {
            const query = `SELECT
                        kilometer
                    FROM ${this.config.schemas.service}.service_kilometer
                    ORDER BY kilometer ASC`;
            const result = await this.pgPoolI.Query(query);
            const serviceKilometersList = result.rows.map((row) => row.kilometer);
            return serviceKilometersList;
        } catch (error) {
            this.logger.error('Error in getServiceKilometersList', error);
            throw error;
        }
    }

    async getVehicleServiceDetails(vehicles) {
        try {
            const vehicleServiceHistoryQuery = ` 
                SELECT * FROM (
                    SELECT 
                        vinno,  
                        servicedate, 
                        servicecenter, 
                        servicelocation, 
                        serviceodo,
                        servicetype,
                        slot,
                        bookingstatus, 
                        dmsronumber, 
                        bookingid, 
                        nextduedate, 
                        bookingtime,
                        createdat,
                        ROW_NUMBER() OVER (
                            PARTITION BY vinno 
                            ORDER BY 
                                CASE bookingstatus 
                                    WHEN 'In Service' THEN 1
                                    WHEN 'Booked' THEN 2
                                    WHEN 'Completed' THEN 3
                                    ELSE 4
                                END,
                                createdat DESC
                        ) as rn
                    FROM (
                        SELECT 
                            asb.vinno,  
                            NULL as servicedate,
                            (asb.dealermeta->>'dealername') as servicecenter, 
                            (asb.dealermeta->>'dealerlocation') as servicelocation, 
                            (asb.bookingmeta->>'odometer')::integer as serviceodo,
                            (asb.bookingmeta->>'servicetype')::text as servicetype,
                            asb.slot,
                            asb.servicestatus as bookingstatus, 
                            asb.ronumber as dmsronumber, 
                            asb.requestid as bookingid, 
                            NULL as nextduedate,
                            asb.bookingtime,
                            asb.createdat
                        FROM ${this.config.schemas.service}.active_service_booking asb 
                        WHERE asb.vinno = ANY($1)  
                        
                        UNION ALL
                        
                        SELECT 
                            sdh.vinno,  
                            sdh.robilldate as servicedate, 
                            sdh.dealername as servicecenter, 
                            sdh.dealerlocation as servicelocation, 
                            sdh.odometer as serviceodo,
                            NULL as servicetype,
                            sdh.slot,
                            'Completed' as bookingstatus, 
                            sdh.ronumber as dmsronumber, 
                            sdh.requestid as bookingid, 
                            sdh.nextduedate as nextduedate, 
                            sdh.bookingtime,
                            sdh.createdat
                        FROM ${this.config.schemas.service}.service_done_history sdh
                        WHERE sdh.vinno = ANY($1)
                    ) combined_data
                ) ranked
                WHERE rn = 1
            `;

            const vehiclesServiceDetails = await this.pgPoolI.Query(vehicleServiceHistoryQuery, [vehicles]);
            const serviceDetails = vehiclesServiceDetails.rows;
            return serviceDetails;
        } catch (error) {
            this.logger.error('Error in getVehicleServiceDetails', error);
            throw error;
        }
    }

    async getVehicleServiceHistory(vinno) {
        //single
        try {
            const query = `
                    SELECT 
                        sh.vinno, 
                        sh.robilldate as invoicedate,
                        sh.dealername as servicecenter,
                        sh.odometer as odometer,
                        sh.netbillamt as invoice,
                        sh.robillnumber as robillnumber,
                        sh.bookingtime as bookingtime,
                        sh.requestid as bookingid
                    FROM ${this.config.schemas.service}.service_done_history sh
                    WHERE sh.vinno = $1
                    ORDER BY sh.bookingtime DESC`;
            const result = await this.pgPoolI.Query(query, [vinno]);
            const serviceHistory = result.rows;
            return serviceHistory;
        } catch (error) {
            this.logger.error('Error in getVehicleServiceHistory', error.toString());
            throw error;
        }
    }

    async getVehicleInfo(vinno) {
        try {
            const vehicleDetail = await this.getSingleVehicleDetail(vinno);
            const lastServiceDetail = await this.getLastServiceDetails(vinno);
            return {
                vehicleDetail,
                lastServiceDetail,
            };
        } catch (error) {
            this.logger.error('Error in getVehicleInfo', error.toString());
            throw error;
        }
    }

    async getSingleVehicleDetail(vinno) {
        try {
            const query = `SELECT
                            vehicle.delivered_date,
                            vehicle.modelcode,
                            vehicle_model.modeldisplayname,
                            COALESCE(vehicle.license_plate, vehicle.vinno) as regno
                        FROM ${this.config.schemas.fmscoresch}.vehicle
                        INNER JOIN ${this.config.schemas.fmscoresch}.vehicle_model ON vehicle.modelcode = vehicle_model.modelcode 
                        WHERE vehicle.vinno = $1`;
            const vehicleDetail = await this.pgPoolI.Query(query, [vinno]);
            return vehicleDetail.rows || [];
        } catch (error) {
            this.logger.error('Error in getSingleVehicleDetail', error.toString());
            throw error;
        }
    }

    async getLastServiceDetails(vinno) {
        try {
            const query = `SELECT robilldate as invoicedate,
                            dealername,
                            odometer as lastserviceodo, 
                            netbillamt as lastserviceamount
                        FROM ${this.config.schemas.service}.service_done_history
                        WHERE vinno = $1
                        ORDER BY bookingtime
                        DESC LIMIT 1`;
            const result = await this.pgPoolI.Query(query, [vinno]);
            return result.rows || [];
        } catch (error) {
            this.logger.error('Error in getLastServiceDetails', error.toString());
            throw error;
        }
    }

    async getServiceTypes() {
        try {
            const query = `SELECT id, description FROM ${this.config.schemas.service}.servicetype;`;
            const result = await this.pgPoolI.Query(query);
            return result.rows;
        } catch (error) {
            this.logger.error('Error in getServiceTypes', error.toString());
            throw error;
        }
    }

    async getDealerSlots() {
        try {
            const query = `SELECT slots, slotoffset FROM ${this.config.schemas.service}.dealer_slot;`;
            const result = await this.pgPoolI.Query(query);
            return result.rows;
        } catch (error) {
            this.logger.error('Error in getDealerSlots', error.toString());
            throw error;
        }
    }

    async getVehicleDetails(vehicles) {
        try {
            const query = `SELECT 
                        v.vinno, 
                        vm.modelcode, 
                        vm.modeldisplayname,
                        COALESCE(v.license_plate, v.vinno) as regno
                    FROM ${this.config.schemas.fmscoresch}.vehicle v 
                    INNER JOIN ${this.config.schemas.fmscoresch}.vehicle_model vm ON v.modelcode = vm.modelcode
                    WHERE vinno = ANY($1)`;
            const result = await this.pgPoolI.Query(query, [vehicles]);
            const vehicleDetails = new Map();
            result.rows.forEach((row) => {
                vehicleDetails.set(row.vinno, {
                    vinno: row.vinno,
                    regno: row.regno,
                    modelcode: row.modelcode,
                    modeldisplayname: row.modeldisplayname,
                });
            });
            return vehicleDetails;
        } catch (error) {
            this.logger.error('Error in getVehicleDetails', error);
            throw error;
        }
    }

    async getActiveBooking(vinno) {
        try {
            const query = `SELECT
                        vinno,
                        bookingtime,
                        slot, 
                        requestid,
                        appointmentid,
                        dmsbookingid,
                        ronumber,
                        servicestatus,
                        dealermeta ->> 'dealercode' as dealercode,
                        dealermeta ->> 'locationcode' as locationcode,
                        dealermeta ->> 'dealername' as dealername,
                        dealermeta ->> 'dealerlocation' as dealerlocation,
                        bookingmeta ->> 'odometer' as odometer,
                        bookingmeta ->> 'servicetype' as servicetype
                    FROM ${this.config.schemas.service}.active_service_booking 
                    WHERE vinno = $1;`;
            const result = await this.pgPoolI.Query(query, [vinno]);
            const data = result.rows;
            return data;
        } catch (error) {
            this.logger.error('Error in getActiveBooking', error.toString());
            throw error;
        }
    }

    async createActiveBooking(client, vinno, bookingTime, slot, requestId, serviceStatus, dealerMeta, bookingMeta, userId) {
        try {
            if (!client) {
                throw new Error('Client is not provided');
            }
            const query = `INSERT INTO ${this.config.schemas.service}.active_service_booking (vinno, bookingtime, slot, requestid, servicestatus, dealermeta, bookingmeta, createdat, createdby ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
            await client.query(query, [vinno, new Date(bookingTime), slot, requestId, serviceStatus, dealerMeta, bookingMeta, new Date(), userId]);
        } catch (error) {
            this.logger.error('Error in createActiveBooking', error.toString());
            throw error;
        }
    }

    async updateActiveBooking(client, requestId, bookingTime, slot, serviceStatus, dealerMeta, bookingMeta, userId) {
        try {
            const query = `UPDATE ${this.config.schemas.service}.active_service_booking SET bookingtime = $1, slot = $2, servicestatus = $3, dealermeta = $4, bookingmeta = $5, createdat = $6, createdby = $7 WHERE requestid = $8`;
            await client.query(query, [new Date(bookingTime), slot, serviceStatus, dealerMeta, bookingMeta, new Date(), userId, requestId]);
        } catch (error) {
            this.logger.error('Error in updateActiveBooking', error.toString());
            throw error;
        }
    }

    async updateActiveBookingAppointment(client, requestId, appointmentId, dmsBookingId) {
        try {
            if (client) {
                const query = `UPDATE ${this.config.schemas.service}.active_service_booking SET appointmentid = $1, dmsbookingid = $2 WHERE requestid = $3`;
                await client.query(query, [appointmentId, dmsBookingId, requestId]);
            } else {
                const query = `UPDATE ${this.config.schemas.service}.active_service_booking SET appointmentid = $1, dmsbookingid = $2 WHERE requestid = $3`;
                await this.pgPoolI.Query(query, [appointmentId, dmsBookingId, requestId]);
            }
        } catch (error) {
            this.logger.error('Error in updateActiveBookingAppointment', error.toString());
            throw error;
        }
    }

    async deleteActiveBooking(client, requestId) {
        try {
            if (!client) {
                throw new Error('Client is not provided');
            }
            const query = `DELETE FROM ${this.config.schemas.service}.active_service_booking WHERE requestid = $1`;
            await client.query(query, [requestId]);
        } catch (error) {
            this.logger.error('Error in deleteActiveBooking', error.toString());
            throw error;
        }
    }

    async createAccountBookingHistory(client, accountId, fleetId, vinno, bookingTime, requestId) {
        try {
            if (!client) {
                throw new Error('Client is not provided');
            }
            const query = `INSERT INTO ${this.config.schemas.service}.account_booking_history (accountid, fleetid, vinno, bookingtime, requestid) VALUES ($1, $2, $3, $4, $5)`;
            await client.query(query, [accountId, fleetId, vinno, new Date(bookingTime), requestId]);
        } catch (error) {
            this.logger.error('Error in createAccoutntBookingHistory', error.toString());
            throw error;
        }
    }

    async createServiceBookingLog(client, vinno, requestId, updatedAt, updatedBy, serviceStatus, servicemeta) {
        try {
            if (client) {
                const query = `INSERT INTO ${this.config.schemas.service}.service_booking_log (vinno, requestid, updatedat, updatedby, servicestatus, statusmeta) VALUES ($1, $2, $3, $4, $5, $6)`;
                await client.query(query, [vinno, requestId, updatedAt, updatedBy, serviceStatus, servicemeta]);
            } else {
                const query = `INSERT INTO ${this.config.schemas.service}.service_booking_log (vinno, requestid, updatedat, updatedby, servicestatus, statusmeta) VALUES ($1, $2, $3, $4, $5, $6)`;
                await this.pgPoolI.Query(query, [vinno, requestId, updatedAt, updatedBy, serviceStatus, servicemeta]);
            }
        } catch (error) {
            this.logger.error('Error in createServiceBookingLog', error.toString());
            throw error;
        }
    }

    async updateActiveBookingRo(client, requestId, roNumber, serviceStatus) {
        try {
            if (!client) {
                throw new Error('Client is not provided');
            }
            const query = `UPDATE ${this.config.schemas.service}.active_service_booking SET ronumber = $1, servicestatus = $2 WHERE requestid = $3`;
            await client.query(query, [roNumber, serviceStatus, requestId]);
        } catch (error) {
            this.logger.error('Error in updateActiveBookingRo', error.toString());
            throw error;
        }
    }

    async createAccoutntBookingHistory(client, accountId, fleetId, vinno, bookingTime, requestId) {
        try {
            if (!client) {
                throw new Error('Client is not provided');
            }
            const query = `INSERT INTO ${this.config.schemas.service}.account_booking_history (accountid, fleetid, vinno, bookingtime, requestid) VALUES ($1, $2, $3, $4, $5)`;
            await client.query(query, [accountId, fleetId, vinno, new Date(bookingTime), requestId]);
        } catch (error) {
            this.logger.error('Error in createAccoutntBookingHistory', error.toString());
            throw error;
        }
    }

    async getInvoice(vinno, bookingid) {
        try {
            const query = `SELECT robillnumber, parentcode, locationcode, invoice FROM ${this.config.schemas.service}.service_done_history WHERE vinno = $1 AND requestid = $2;`;
            const result = await this.pgPoolI.Query(query, [vinno, bookingid]);
            return result.rows;
        } catch (error) {
            this.logger.error('Error in getInvoice', error.toString());
            throw error;
        }
    }

    async getSoSDetails(vinno) {
        try {
            const sosReasons = await this.getSOSReasons();
            const vehicleDetails = await this.getSingleVehicleDetail(vinno);
            return {
                sosReasons,
                vehicleDetails,
            };
        } catch (error) {
            this.logger.error('Error in getSosDetails', error.toString());
            throw error;
        }
    }

    async getSOSReasons() {
        try {
            const query = `SELECT sosid, name, value FROM ${this.config.schemas.service}.sos_reason;`;
            const result = await this.pgPoolI.Query(query);
            return result.rows;
        } catch (error) {
            this.logger.error('Error in getSOSReasons', error.toString());
            throw error;
        }
    }

    async getUserInfo(userId) {
        try {
            const query = `SELECT displayname, userinfo FROM users WHERE userid = $1 AND isdeleted = false; `;
            const user = await this.pgPoolI.Query(query, [userId]);
            return user.rows;
        } catch (error) {
            this.logger.error('Error in getUserInfo', error.toString());
            throw error;
        }
    }

    async getCancelReasons() {
        try {
            const query = `SELECT cancellationid as id, name, value FROM ${this.config.schemas.service}.cancel_reason;`;
            const result = await this.pgPoolI.Query(query);
            return result.rows;
        } catch (error) {
            this.logger.error('Error in getCancelReasons', error.toString());
            throw error;
        }
    }

    async getMobileNumber(vinno) {
        try {
            const query = `SELECT mobile FROM vehicle WHERE vinno = $1`;
            const result = await this.pgPoolI.Query(query, [vinno]);
            return result.rows;
        } catch (error) {
            this.logger.error('Error in getMobileNumber', error.toString());
            throw error;
        }
    }

    async createServiceDoneHistory(client, userid, vinno, svcInsertData) {
        try {
            let { bookingTime, bookingId, dmsBookingId, roNumber, roBillNumber, roBillDate, netBillAmt, odometer, parentCode, locationCode, dealerName, dealerLocation, nextServiceDate, slot } = svcInsertData;
            roBillDate = new Date(roBillDate);
            if (nextServiceDate) {
                nextServiceDate = new Date(nextServiceDate);
            }
            const query = `INSERT INTO ${this.config.schemas.service}.service_done_history(vinno, bookingtime, requestid, dmsbookingid, ronumber, robillnumber, robilldate, netbillamt, odometer, parentcode, locationcode, dealername, dealerlocation, next_service_date, slot, createdby) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`;
            if (client) {
                await client.query(query, [vinno, bookingTime, bookingId, dmsBookingId, roNumber,roBillNumber, roBillDate, netBillAmt, odometer, parentCode, locationCode, dealerName, dealerLocation, nextServiceDate, slot, userid]);
            } else {
                await this.pgPoolI.Query(query, [vinno, bookingTime, bookingId, dmsBookingId, roBillNumber, roBillNumber, roBillDate, netBillAmt, odometer, parentCode, locationCode, dealerName, dealerLocation, nextServiceDate, slot, userid]);
            }
        } catch (error) {
            this.logger.error('Error in createServiceDoneHistory: ', error.toString());
            throw error;
        }
    }

    async updateInvoice(client, vinno, bookingid, invoice) {
        try {
            const query = `UPDATE ${this.config.schemas.service}.service_done_history SET invoice = $1 WHERE vinno = $2 AND requestid = $3`;
            if (client) {
                await client.query(query, [invoice, vinno, bookingid]);
            } else {
                await this.pgPoolI.Query(query, [invoice, vinno, bookingid]);
            }
        } catch (error) {
            this.logger.error('Error in updateInvoice: ', error.toString());
            throw error;
        }
    }

    async getServiceModuleDetails() {
        try {
            const query = `SELECT moduleid FROM ${this.config.schemas.fmscoresch}.module where modulecode = $1;`;
            const result = await this.pgPoolI.Query(query, ['service']);
            return result.rows;
        } catch (error) {
            this.logger.error('Error in getServiceModuleDetails: ', error.toString());
            throw error;
        }
    }
}
