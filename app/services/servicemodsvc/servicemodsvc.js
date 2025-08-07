import ServiceModSvcDB from "./servicemodsvc_db.js";
export default class ServiceModSvc {
    constructor(pgPoolI, redisSvcI, logger, config) {
        this.pgPoolI = pgPoolI;
        this.logger = logger;
        this.serviceModSvcDB = new ServiceModSvcDB(pgPoolI, redisSvcI, logger, config);
    }

    async GetUserFleetId(accountid, userid) {
        return this.serviceModSvcDB.getUserFleetId(accountid, userid);
    }

    async UserFleetValidation(accountid, userid, fleetid) {
        return this.serviceModSvcDB.userFleetValidation(accountid, userid, fleetid);
    }

    async GetServiceOverview(accountid, fleetids, cookie, startdate) {
        return this.serviceModSvcDB.getServiceOverview(accountid, fleetids, cookie, startdate);
    }

    async GetRecursiveFleets(fleetid, accountid) {
        return this.serviceModSvcDB.getRecursiveFleets(fleetid, accountid);
    }

    async GetAllVehiclesInService(accountid, fleetids, cookie) {
        return this.serviceModSvcDB.getAllVehiclesInService(accountid, fleetids, cookie);
    }

    async GetOverdueVehicles(accountid, fleetids, cookie) {
        return this.serviceModSvcDB.getOverdueVehicles(accountid, fleetids, cookie);
    }

    async GetInServiceVehicles(accountid, fleetids, cookie) {
        return this.serviceModSvcDB.getInServiceVehicles(accountid, fleetids, cookie);
    }

    async GetBookedVehicles(accountid, fleetids, cookie) {
        return this.serviceModSvcDB.getBookedVehicles(accountid, fleetids, cookie);
    }

    async GetRecentVehicles(accountid, fleetids, cookie, startdate) {
        return this.serviceModSvcDB.getRecentVehicles(accountid, fleetids, cookie, startdate);
    }

    async CreateVehicleServiceBooking(accountId, userId, vinno, chassisNumber, mobileNumber, serviceType, kilometer, modelDisplayName, parentGroup, locationCode, dealerName, dealerAddress, slot, cookie) {
        return this.serviceModSvcDB.createVehicleServiceBooking(accountId,
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
            cookie);
    }

    async ReschVehicleServiceBooking(accountId, userId, oldBookingId, mobileNumber, newServiceType, newKilometer, modelDisplayName, newParentGroup, newLocationCode, newDealerName, newDealerAddress, newSlot, cookie) {
        return this.serviceModSvcDB.reschVehicleServiceBooking(accountId, userId, oldBookingId, mobileNumber, newServiceType, newKilometer, modelDisplayName, newParentGroup, newLocationCode, newDealerName, newDealerAddress, newSlot, cookie);
    }

    async GetCancelReasons() {
        return this.serviceModSvcDB.getCancelReasons();
    }

    async CancelVehicleServiceBooking(accountId, mobileNumber, bookingId, vinno, chassisNumber, reason, cookie) {
        return this.serviceModSvcDB.cancelVehicleServiceBooking(accountId, mobileNumber, bookingId, vinno, chassisNumber, reason, cookie);
    }

    async ListDealers(chassisNumber, mobileNumber, latitude, longitude, modelDesc) {
        return this.serviceModSvcDB.listDealers(chassisNumber, mobileNumber, latitude, longitude, modelDesc);
    }

    async GetDealerSlots(chassisNumber, mobileNumber, parentCode, locationCode, epoch) {
        return this.serviceModSvcDB.getDealerSlots(chassisNumber, mobileNumber, parentCode, locationCode, epoch);
    }

    async GetVehicleServiceCostEstimate(vinno, chassisNumber, mobilenumber, selectedkm, model) {
            return this.serviceModSvcDB.getVehicleServiceCostEstimate(vinno, chassisNumber, mobilenumber, selectedkm, model);
    }

    async GetVehicleServiceStatus(accountid, vinno, chassisNumber, mobileNumber, bookingId) {
        return this.serviceModSvcDB.getVehicleServiceStatus(accountid, vinno, chassisNumber, mobileNumber, bookingId);
    }

    async GetInvoice(accountid, vinno, chassisNumber, mobileNumber, roBillNo, bookingid) {
        return this.serviceModSvcDB.getInvoice(accountid, vinno, chassisNumber, mobileNumber, roBillNo, bookingid);
    }

    async ListDealerSearch(chassisNumber, mobileNumber, modelDesc, itemIndex, pageSize, searchFilter) {
        return this.serviceModSvcDB.listDealerSearch(chassisNumber, mobileNumber, modelDesc, itemIndex, pageSize, searchFilter);
    }

    async GetServiceTypes(modelDesc) {
        return this.serviceModSvcDB.getServiceTypes(modelDesc);
    }

    async GetSOSReasons(vinno, chassisNumber, mobileNumber, model, cookie) {
        return this.serviceModSvcDB.getSOSReasons(vinno, chassisNumber, mobileNumber, model, cookie);
    }

    async VehicleOnboarding(chassisNumber, mobileno, model) {
        return this.serviceModSvcDB.vehicleOnboarding(chassisNumber, mobileno, model);
    }

    async GetRootFleetId(accountid) {
        return await this.serviceModSvcDB.getRootFleetId(accountid);
    }

    async GetVehicles(accountid, fleetid, recursive = false) {
        const vehicles = await this.serviceModSvcDB.getVehicles(
            accountid,
            fleetid,
            recursive
        );

        if (!vehicles) {
            return [];
        }
        return vehicles;
    }

    async RaiseSOS (userid, chassisNumber, mobileNumber, sosinfo) {
        return this.serviceModSvcDB.raiseSOS(userid, chassisNumber, mobileNumber, sosinfo);
    }

    async CheckAccountVehicle(accountid, vinno) {
        return this.serviceModSvcDB.checkAccountVehicle(accountid, vinno);
    }

    async GetVehicleServiceHistory(vinno) {
        return this.serviceModSvcDB.getVehicleServiceHistory(vinno);
    }

    async GetVehicleInfo(vinno, chassisNumber, mobileNumber, cookie) {
        return this.serviceModSvcDB.getVehicleInfo(vinno, chassisNumber, mobileNumber, cookie);
    }

    async GetSheduleJobTypes(modelDesc) {
        return this.serviceModSvcDB.getSheduleJobTypes(modelDesc);
    }

    getRequestId() {
        return this.serviceModSvcDB.getRequestIdForExternalUse();
    }

    async GetKilometers(vinno) {
        return this.serviceModSvcDB.getKilometer(vinno);
    }

    async GetMobileNumber(vinno) {
        return this.serviceModSvcDB.getMobileNumber(vinno);
    }

    async ListNearestDealersSearch(dealerInfo) {
        return this.serviceModSvcDB.listNearestDealersSearch(dealerInfo);
    }

    async FetchPendingVehicleOnboarding() {
        return this.serviceModSvcDB.fetchPendingVehicleOnboarding();
    }

    async MarkVehicleOnboarded(onboardingData) {
        return this.serviceModSvcDB.markVehicleOnboarded(onboardingData);
    }

    async MoveToErrorTable(onboardingData, errorresult, body) {
        return this.serviceModSvcDB.moveToErrorTable(onboardingData, errorresult, body);
    }

    async GetFleetId(vinno) {
        return this.serviceModSvcDB.getFleetId(vinno);
    }

    async CheckUserVehicleAccess(userid, accountid, vinno) {
        try {
            const fleetid = await this.CheckAccountVehicle(accountid, vinno);
            if (!fleetid) {
                throw new Error("Vehicle not found in the account");
            }

            const fleetids = await this.GetUserFleetId(accountid, userid);

            if (!fleetids.includes(fleetid)) {
                throw new Error("User not authorized to access this fleet");
            }

            return fleetid;
        } catch (error) {
            throw typeof error === "string" ? error : error.message;
        }
    }

    async GetExternalVehicleInfo(chassisNumber, mobileNumber) {
        return this.serviceModSvcDB.getExternalVehicleInfo(chassisNumber, mobileNumber);
    }
}