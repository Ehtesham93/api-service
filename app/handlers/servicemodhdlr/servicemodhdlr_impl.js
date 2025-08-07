import * as utils from "../../utils/util.js";

export default class ServiceHdlrImpl {
    constructor(serviceModSvcI, logger) {
        this.serviceModSvcI = serviceModSvcI;
        this.logger = logger;
    }

    VehicleOnboardingLogic = async (accountid, userid, vinno, mobileno, model) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number");
            }

            return await this.serviceModSvcI.VehicleOnboarding(chassisNumber, mobileno, model);
        } catch (e) {
            this.logger.error("Error in VehicleOnboarding: ", e.message || e);
            const errorMessage = utils.checkForDbOrRequestError(e);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof e === 'string' ? e : e.message;
        }
    }

    GetRecursiveFleetsLogic = async (fleetid, accountid) => {
        const fleetsData = await this.serviceModSvcI.GetRecursiveFleets(fleetid, accountid);
        return fleetsData;
    }

    UserFleetValidationLogic = async (accountid, userid, fleetid) => {
        return await this.serviceModSvcI.UserFleetValidation(accountid, userid, fleetid);
    }

    GetServiceOverviewLogic = async (accountid, userid, isRecursive, fleetid, cookie, startdate) => {

        if (fleetid && !await this.UserFleetValidationLogic(accountid, userid, fleetid)) {
            throw new Error("User not authorized to access this fleet");
        }

        let fleetids = [fleetid];
        if (isRecursive) {
            const fleetsData = await this.GetRecursiveFleetsLogic(fleetid, accountid);
            fleetids = fleetsData.map(fleet => fleet.fleetid);
        }
        return await this.serviceModSvcI.GetServiceOverview(accountid, fleetids, cookie, startdate);
    }

    GetVehiclesInServiceLogic = async (accountid, userid, isRecursive, fleetid, tabid, cookie, startdate) => {
        if (fleetid && !await this.UserFleetValidationLogic(accountid, userid, fleetid)) {
            throw new Error("User not authorized to access this fleet");
        }

        let fleetids = [fleetid];
        if (isRecursive) {
            const fleetsData = await this.GetRecursiveFleetsLogic(fleetid, accountid);
            fleetids = fleetsData.map(fleet => fleet.fleetid);
        }
        let response = [];
        if (tabid === "all") {
            response = await this.GetAllVehiclesInServiceLogic(accountid, fleetids, cookie);
        } else if (tabid === "overdue") {
            response = await this.GetOverdueVehiclesLogic(accountid, fleetids, cookie);
        } else if (tabid === "inservice") {
            response = await this.GetInServiceVehiclesLogic(accountid, fleetids, cookie);
        } else if (tabid === "booked") {
            response = await this.GetBookedVehiclesLogic(accountid, fleetids, cookie);
        } else if (tabid === "serviced") {
            response = await this.GetRecentVehiclesLogic(accountid, fleetids, cookie, startdate);
        }
        return response;
    }

    GetAllVehiclesInServiceLogic = async (accountid, fleetids, cookie) => {
        return await this.serviceModSvcI.GetAllVehiclesInService(accountid, fleetids, cookie);
    }

    GetOverdueVehiclesLogic = async (accountid, fleetids, cookie) => {
        return await this.serviceModSvcI.GetOverdueVehicles(accountid, fleetids, cookie);
    }

    GetInServiceVehiclesLogic = async (accountid, fleetids, cookie) => {
        return await this.serviceModSvcI.GetInServiceVehicles(accountid, fleetids, cookie);
    }

    GetBookedVehiclesLogic = async (accountid, fleetids, cookie) => {
        return await this.serviceModSvcI.GetBookedVehicles(accountid, fleetids, cookie);
    }

    GetRecentVehiclesLogic = async (accountid, fleetids, cookie, startdate) => {
        return await this.serviceModSvcI.GetRecentVehicles(accountid, fleetids, cookie, startdate);
    }

    GetVehicleServiceHistoryLogic = async (accountid, userid, vinno) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);
            return await this.serviceModSvcI.GetVehicleServiceHistory(vinno);
        } catch (error) {
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetVehicleServiceStatusLogic = async (accountid, userid, vinno, bookingId) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number.");
            }

            return await this.serviceModSvcI.GetVehicleServiceStatus(accountid, vinno, chassisNumber, mobileNumber, bookingId);
        } catch (error) {
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetInvoiceLogic = async (accountid, userid, vinno, roBillNo, bookingid) => {
        try {
            if (roBillNo.trim() === "" || bookingid.trim() === "") {
                throw new Error("Ro Bill Number or Booking ID should not be empty")
            }
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number");
            }
            return await this.serviceModSvcI.GetInvoice(accountid, vinno, chassisNumber, mobileNumber.trim(), roBillNo.trim(), bookingid.trim());
        } catch (error) {
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetServiceTypesLogic = async (accountid, modelDesc) => {
        return await this.serviceModSvcI.GetServiceTypes(modelDesc);
    }

    CreateVehicleServiceBookingLogic = async ( accountId,
        userid,
        vinno,
        serviceType,
        kilometer,
        modelDisplayName,
        parentGroup,
        locationCode,
        dealerName,
        dealerAddress,
        slot,
        cookie ) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountId, vinno);
            const bookingDate = utils.convertToADCFormat(slot);
            const chassisNumber = utils.getChassisNumber(vinno);
            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            return await this.serviceModSvcI.CreateVehicleServiceBooking(accountId, userid, vinno, chassisNumber, mobileNumber, serviceType, kilometer, modelDisplayName, parentGroup, locationCode, dealerName, dealerAddress, bookingDate, cookie);
        } catch (error) {
            this.logger.error("Error in CreateVehicleServiceBooking: ", error.message || error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    ReschVehicleServiceBookingLogic = async (accountId, userId, vinno, oldBookingId, newServiceType, newKilometer, modelDisplayName, newParentGroup, newLocationCode, newDealerName, newDealerAddress, newSlot, cookie) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userId, accountId, vinno);
            const newBookingDate = utils.convertToADCFormat(newSlot);
            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            return await this.serviceModSvcI.ReschVehicleServiceBooking(accountId, userId, oldBookingId, mobileNumber, newServiceType, newKilometer, modelDisplayName, newParentGroup, newLocationCode, newDealerName, newDealerAddress, newBookingDate, cookie);
        } catch (error) {
            this.logger.error("Error in ReschVehicleServiceBooking: ", error.message || error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetCancelReasonsLogic = async () => {
        return await this.serviceModSvcI.GetCancelReasons();
    }

    CancelVehicleServiceBookingLogic = async (accountid, userid, bookingid, vinno, reason, cookie) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);
            const chassisNumber = utils.getChassisNumber(vinno);
            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            return await this.serviceModSvcI.CancelVehicleServiceBooking(accountid, mobileNumber, bookingid, vinno, chassisNumber, reason, cookie);
        } catch (error) {
            this.logger.error("Error in CancelVehicleServiceBooking: ", error.message || error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetVehicleServiceCostEstimateLogic = async (accountid, userid, vinno, selectedkm, model) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if(!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number.");
            }
            
            return await this.serviceModSvcI.GetVehicleServiceCostEstimate(vinno, chassisNumber, mobileNumber, selectedkm, model);  
        } catch (error) {
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    ListDealersLogic = async (accountid, userid, vinno, latitude, longitude, modelDesc) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle.");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number.");
            }

            return await this.serviceModSvcI.ListDealers(chassisNumber, mobileNumber,  latitude, longitude, modelDesc);
        } catch (error) {
            this.logger.error("Error in ListDealers: ", error.message || error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetDealerSlotsLogic = async (accountid, userid, vinno, parentCode, locationCode, date) => {
        try {
            console.log("date", date);
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle.");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number.");
            }

            //date is epoch with some time. but timezone should be kolkata.
            const formattedDate = utils.getDateFromEpoch(date);
            const epoch = utils.getEpochFromDate(formattedDate);

            return await this.serviceModSvcI.GetDealerSlots(chassisNumber, mobileNumber, parentCode, locationCode, epoch);
        } catch (error) {
            this.logger.error("Error in GetDealerSlots: ", error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    ListDealerSearchLogic = async (accountid, userid, vinno, modelDesc, itemIndex, pageSize, searchFilter) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle.");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number.");
            }

            return await this.serviceModSvcI.ListDealerSearch(chassisNumber, mobileNumber, modelDesc, itemIndex, pageSize, searchFilter);
        } catch (error) {
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetSOSReasonsLogic = async (accountid, userid, vinno, model, cookie) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle.");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number.");
            }

            return await this.serviceModSvcI.GetSOSReasons(vinno, chassisNumber, mobileNumber, model, cookie);
        } catch (error) {
            this.logger.error("Error in GetSOSReasons: ", error.message || error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    RaiseSOSLogic = async (accountid, userid, sosinfo) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, sosinfo.vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(sosinfo.vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle");
            }

            const chassisNumber = utils.getChassisNumber(sosinfo.vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number");
            }

            return await this.serviceModSvcI.RaiseSOS(userid, chassisNumber, mobileNumber, sosinfo);
        } catch (e) {
            this.logger.error("Error in RaiseSOS: ", e);
            const errorMessage = utils.checkForDbOrRequestError(e);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof e === 'string' ? e : e.message;
        }
    }

    CheckAccountVehicleLogic = async (accountid, vinno) => {
        return await this.serviceModSvcI.checkAccountVehicle(accountid, vinno);
    }

    GetVehicleInfoLogic = async (accountid, userid, vinno, cookie) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);

            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            if (!mobileNumber) {
                throw new Error("Mobile number not found for the vehicle.");
            }

            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw new Error("Invalid VIN number.");
            }

            return await this.serviceModSvcI.GetVehicleInfo(vinno, chassisNumber, mobileNumber, cookie);
        } catch (e) {
            this.logger.error("Error in GetVehicleInfo: ", e.message || e);
            const errorMessage = utils.checkForDbOrRequestError(e);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof e === 'string' ? e : e.message;
        }
    }

    GetSheduleJobTypesLogic = async (accountid, modelDesc) => {
        return await this.serviceModSvcI.GetSheduleJobTypes(modelDesc);
    }

    getRequestId() {
        return this.serviceModSvcI.getRequestId();
    }

    GetKilometersLogic = async (accountid, userid, vinno) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);
            return await this.serviceModSvcI.GetKilometers(vinno);
        } catch (error) {
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    ListNearestDealersSearchLogic = async (accountid, userid, data) => {
        try {
            const { modelgroupdesc, searchfilter, dealertype, latitude, longitude } = data;
            data = {
                modelgroupdesc: modelgroupdesc?.trim() === "" || modelgroupdesc === null || modelgroupdesc === undefined ? "TREO" : modelgroupdesc,
                pagesize: 30,
                searchfilter,
                dealertype,
                latitude,
                longitude
            }

            return await this.serviceModSvcI.ListNearestDealersSearch(data);
        } catch (error) {
            this.logger.error("Error in ListNearestDealersSearch: ", error.message || error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }

    GetExternalVehicleInfoLogic = async (accountid, userid, vinno) => {
        try {
            const fleetid = await this.serviceModSvcI.CheckUserVehicleAccess(userid, accountid, vinno);
            const chassisNumber = utils.getChassisNumber(vinno);
            const mobileNumber = await this.serviceModSvcI.GetMobileNumber(vinno);
            return await this.serviceModSvcI.GetExternalVehicleInfo(chassisNumber, mobileNumber);
        } catch (error) {
            this.logger.error("Error in GetExternalVehicleInfo: ", error.message || error);
            const errorMessage = utils.checkForDbOrRequestError(error);
            if (errorMessage) {
                throw errorMessage;
            }
            throw typeof error === 'string' ? error : error.message;
        }
    }
}
