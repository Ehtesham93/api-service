import ServiceModSvcDB from './servicemodsvc_db.js';
export default class ServiceModSvc {
    constructor(pgPoolI, logger, config) {
        this.pgPoolI = pgPoolI;
        this.logger = logger;
        this.serviceModSvcDB = new ServiceModSvcDB(pgPoolI, logger, config);
    }

    // Database transaction management methods
    async StartTransaction() {
        return this.serviceModSvcDB.startTransaction();
    }

    async CommitTransaction(txclient) {
        return this.serviceModSvcDB.commitTransaction(txclient);
    }

    async RollbackTransaction(txclient) {
        return this.serviceModSvcDB.rollbackTransaction(txclient);
    }

    // User and fleet management methods
    async GetUserFleets(accountid, userid) {
        try {
            return await this.serviceModSvcDB.getUserFleets(accountid, userid);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetVehicleFleet(accountId, vinno) {
        try {
            return await this.serviceModSvcDB.getVehicleFleet(accountId, vinno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetMobileNumber(vinno) {
        try {
            return await this.serviceModSvcDB.getMobileNumber(vinno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    // Vehicle onboarding queue management methods
    async GetOnboardingPendingQueue(vinno) {
        try {
            return await this.serviceModSvcDB.getOnboardingPendingQueue(vinno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    // Vehicle onboarding queue management methods
    async GetOnboardingDoneEntries(vinno, mobileno){
        try {
            return await this.serviceModSvcDB.getOnboardingDoneEntries(vinno, mobileno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async CreateOnboardingPendingQueue(vinno, mobileno) {
        try {
            return await this.serviceModSvcDB.createOnboardingPendingQueue(vinno, mobileno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async UpdateOnboardingPendingQueue(vinno, mobileno) {
        try {
            return await this.serviceModSvcDB.updateOnboardingPendingQueue(vinno, mobileno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            }
        }
    }

    async FetchPendingVehicleOnboarding() {
        return this.serviceModSvcDB.fetchPendingVehicleOnboarding();
    }

    async MarkVehicleOnboarded(txclient, vinno, mobileno, muserid, responsebody) {
        return this.serviceModSvcDB.markVehicleOnboarded(txclient, vinno, mobileno, muserid, responsebody);
    }

    async MoveToErrorTable(txclient, onboardingData, errorresult) {
        return this.serviceModSvcDB.moveToErrorTable(txclient, onboardingData, errorresult);
    }

    // Fleet and vehicle service management methods
    async GetFleetVehicles(fleetids) {
        try {
            return await this.serviceModSvcDB.getFleetVehicles(fleetids);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetServiceKilometersList() {
        try {
            return await this.serviceModSvcDB.getServiceKilometersList();
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetVehicleServiceDetails(vehicles) {
        try {
            return await this.serviceModSvcDB.getVehicleServiceDetails(vehicles);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetServiceTypes() {
        try {
            return await this.serviceModSvcDB.getServiceTypes();
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetDealerSlots() {
        try {
            return await this.serviceModSvcDB.getDealerSlots();
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    // Booking and vehicle details management methods
    async GetActiveBooking(vinno) {
        try {
            return await this.serviceModSvcDB.getActiveBooking(vinno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetVehicleDetails(vinnos) {
        try {
            return await this.serviceModSvcDB.getVehicleDetails(vinnos);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async CreateServiceBookingLog(client, vinno, requestId, updatedAt, updatedBy, serviceStatus, servicemeta) {
        try {
            return await this.serviceModSvcDB.createServiceBookingLog(client, vinno, requestId, updatedAt, updatedBy, serviceStatus, servicemeta);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async CreateActiveBooking(client, vinno, bookingTime, slot, requestId, serviceStatus, dealerMeta, bookingMeta, userId) {
        try {
            return await this.serviceModSvcDB.createActiveBooking(client, vinno, bookingTime, slot, requestId, serviceStatus, dealerMeta, bookingMeta, userId);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }
    async CreateAccountBookingHistory(client, accountId, fleetId, vinno, bookingTime, requestId) {
        try {
            return await this.serviceModSvcDB.createAccountBookingHistory(client, accountId, fleetId, vinno, bookingTime, requestId);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            }
        }
    }

    async UpdateActiveBookingAppointment(client, requestId, appointmentId, dmsBookingId) {
        try {
            return await this.serviceModSvcDB.updateActiveBookingAppointment(client, requestId, appointmentId, dmsBookingId);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async UpdateActiveBooking(client, requestId, bookingTime, slot, serviceStatus, dealerMeta, bookingMeta, userId) {
        try {
            return await this.serviceModSvcDB.updateActiveBooking(client, requestId, bookingTime, slot, serviceStatus, dealerMeta, bookingMeta, userId);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async UpdateActiveBookingRo(client, requestId, roNumber, serviceStatus) {
        try {
            return await this.serviceModSvcDB.updateActiveBookingRo(client, requestId, roNumber, serviceStatus);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async DeleteActiveBooking(client, requestId) {
        try {
            return await this.serviceModSvcDB.deleteActiveBooking(client, requestId);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetCancelReasons() {
        try {
            return await this.serviceModSvcDB.getCancelReasons();
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async CancelVehicleServiceBooking(accountId, mobileNumber, bookingId, vinno, chassisNumber, reason, cookie) {
        return this.serviceModSvcDB.cancelVehicleServiceBooking(accountId, mobileNumber, bookingId, vinno, chassisNumber, reason, cookie);
    }

    async GetVehicleServiceStatus(accountid, vinno, chassisNumber, mobileNumber, bookingId) {
        try {
            return await this.serviceModSvcDB.getVehicleServiceStatus(accountid, vinno, chassisNumber, mobileNumber, bookingId);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetInvoice(vinno, bookingid) {
        try {
            return await this.serviceModSvcDB.getInvoice(vinno, bookingid);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    async GetSoSDetails(vinno) {
        return this.serviceModSvcDB.getSoSDetails(vinno);
    }

    async GetSOSReasons() {
        return this.serviceModSvcDB.getSOSReasons();
    }

    async GetUserInfo(userId) {
        try {
            return await this.serviceModSvcDB.getUserInfo(userId);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetVehicleServiceHistory(vinno) {
        try {
            return await this.serviceModSvcDB.getVehicleServiceHistory(vinno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async GetVehicleInfo(vinno) {
        try {
            return await this.serviceModSvcDB.getVehicleInfo(vinno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async CreateServiceDoneHistory(client, userid, vinno, svcInsertData) {
        try {
            return this.serviceModSvcDB.createServiceDoneHistory(client, userid, vinno, svcInsertData);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    }

    async UpdateInvoice(client, vinno, bookingid, invoice) {
        try {
            return this.serviceModSvcDB.updateInvoice(client, vinno, bookingid, invoice);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    async GetSingleVehicleDetail(vinno) {
        try {
            return await this.serviceModSvcDB.getSingleVehicleDetail(vinno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    async GetServiceModuleDetails () {
        try {
            return await this.serviceModSvcDB.getServiceModuleDetails();
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    async DeleteOnboardingPendingQueue(txclient, vinno, mobileno) {
        try {
            return await this.serviceModSvcDB.deleteOnboardingPendingQueue(txclient, vinno, mobileno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            }
        }
    }

    async UpdateVehicleMobileno(txclient, vinno, mobileno) {
        try {
            return await this.serviceModSvcDB.updateVehicleMobileno(txclient, vinno, mobileno);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            }
        }
    }

    async GetVehicleOnboardingHistory(vinno) {
        try {
            const status = await this.serviceModSvcDB.getVehicleOnboardingHistory(vinno);
            let result = {};
            let tablerows = [];
            if(status.success.length > 0){
                for(const row of status.success){
                    if(!row.updatedat) {
                        row.updatedat = row.createdat;
                    }
                    tablerows.push({
                        ...row,
                        status: 'SUCCESS',
                    })
                }
            } 
            if(status.failed.length > 0){
                for(const row of status.failed){
                    if(!row.updatedat) {
                        row.updatedat = row.createdat;
                    }
                    tablerows.push({
                        ...row,
                        status: 'FAILED',
                    })
                }
            } 
            if(tablerows.length === 0){
                return {
                    "historydata": []
                }
            }
            result = {
                "historydata": tablerows
            }
            return result;
        } catch (error) {
            throw error;
        }
    }


    async GetVehicleOnboardingStatus(vinno) {
        try {
            const status = await this.serviceModSvcDB.getVehicleOnboardingStatus(vinno);
            let result = {};
            let statusdata = [];
            if(status.status === 'SUCCESS' || status.status === 'FAILED' || status.status === 'NODATA'){
                statusdata.push({
                    ...status.data,
                    "status": status.status
                });
            }else {
                statusdata.push({
                    ...status.data
                });
            }

            result = {
                "statusdata": statusdata,
                "allowupdate": status.allowupdate
            }
            return result;
        } catch (error) {
            throw error;
        }
    }


    async FetchProcessingStateEntries(){
        try{
            return await this.serviceModSvcDB.fetchProcessingStateEntries();
        }catch(error){
            throw error;
        }
    }

    async UpdateEntriesToPending(){
        try{
            return await this.serviceModSvcDB.updateToPending();
        }catch(error){
            throw error;
        }
    }
}
