import * as utils from '../../utils/util.js';
import * as servicemodhdlrutil from './servicemodhdlr_util.js';

export default class ServiceHdlrImpl {
    constructor(serviceModSvcI, wrapperI, logger, config) {
        this.serviceModSvcI = serviceModSvcI;
        this.wrapperI = wrapperI;
        this.logger = logger;
        this.config = config;
    }

    VehicleOnboardingLogic = async (vinno, mobileNo) => {
        try {
            const onboardingdoneentries = await this.serviceModSvcI.GetOnboardingDoneEntries(vinno, mobileNo);
            if(onboardingdoneentries){
                let error = new Error("Vehicle already onboarded with the given mobile number");
                error.errcode = "VEHICLE_ALREADY_ONBOARDED";
                throw error;
            }
            const onboardingQueue = await this.serviceModSvcI.GetOnboardingPendingQueue(vinno);
            if (onboardingQueue) {
                if(onboardingQueue.mobileno === mobileNo){
                    let error = new Error("Vehicle onboarding already in process with the given mobile number");
                    error.errcode = "VEHICLE_ONBOARDING_IN_PROCESS";
                    throw error;
                }
                await this.serviceModSvcI.UpdateOnboardingPendingQueue(vinno, mobileNo);
                return 'Onboarding request updated successfully';
            }
            await this.serviceModSvcI.CreateOnboardingPendingQueue(vinno, mobileNo);
            return 'Onboarding request submitted successfully';
        } catch (error) {
            throw error;
        }
    };

    GetServiceOverviewLogic = async (accountid, fleetid, userid, isRecursive, cookie, startDate, xplatform) => {
        try {
            // const isvalid = await this.UserFleetValidationLogic(accountid, userid, fleetid);
            // if (!isvalid) {
            //     throw {
            //         errcode: 'USER_FLEET_ACCESS_DENIED',
            //     };
            // }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }

            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(fleetid, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.view', 'service.booking.admin']);
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_OVERVIEW_ACCESS_DENIED'
                    }
                }
            }

            const vehicles = await this.GetVehiclesListLogic(fleetid, isRecursive, cookie);

            let filteredVehicles = {
                all: [],
                overdue: [],
                booked: [],
                inservice: [],
                serviced: [],
            };

            if (vehicles.length !== 0) {
                filteredVehicles = await this.GetFiltVechInServiceLogic(vehicles, cookie, startDate);
            }

            const allVehicles = filteredVehicles.all.length;
            const overdueVehicles = filteredVehicles.overdue.length;
            const bookedVehicles = filteredVehicles.booked.length;
            const inServiceVehicles = filteredVehicles.inservice.length;
            const servicedVehicles = filteredVehicles.serviced.length;

            return [
                {
                    tabid: 'all',
                    tabname: 'ALL',
                    value: allVehicles,
                },
                {
                    tabid: 'overdue',
                    tabname: 'OVERDUE',
                    value: overdueVehicles,
                },
                {
                    tabid: 'booked',
                    tabname: 'BOOKED',
                    value: bookedVehicles,
                },
                {
                    tabid: 'inservice',
                    tabname: 'IN SERVICE',
                    value: inServiceVehicles,
                },
                {
                    tabid: 'serviced',
                    tabname: 'SERVICED',
                    value: servicedVehicles,
                },
            ];
        } catch (error) {
            throw error;
        }
    };

    GetVehiclesInServiceLogic = async (accountId, fleetId, userId, recursive, tabId = 'all', cookie, startDate, xplatform) => {
        try {
            // const isvalid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            // if (!isvalid) {
            //     throw {
            //         errcode: 'USER_FLEET_ACCESS_DENIED',
            //     };
            // }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }

            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(fleetId, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.view', 'service.booking.admin']);
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_OVERVIEW_ACCESS_DENIED'
                    }
                }
            }
            const vehicles = await this.GetVehiclesListLogic(fleetId, recursive, cookie);

            let filteredVehicles = {
                all: [],
                overdue: [],
                booked: [],
                inservice: [],
                serviced: [],
            };

            if (vehicles.length !== 0) {
                filteredVehicles = await this.GetFiltVechInServiceLogic(vehicles, cookie, startDate);
            }

            let response = [];
            if (tabId === 'all') {
                response = filteredVehicles.all;
            } else if (tabId === 'overdue') {
                response = filteredVehicles.overdue;
            } else if (tabId === 'booked') {
                response = filteredVehicles.booked;
            } else if (tabId === 'inservice') {
                response = filteredVehicles.inservice;
            } else if (tabId === 'serviced') {
                response = filteredVehicles.serviced;
            }
            return response;
        } catch (error) {
            throw error;
        }
    };

    GetServiceTypesLogic = async () => {
        try {
            const response = await this.serviceModSvcI.GetServiceTypes();
            const typesdata = [];
            for (let i = 0; i < response.length; i++) {
                if (response[i].description === 'Accidental') {
                    typesdata.push({
                        img: this.config.hardCodeData.accidentalServiceImg,
                        servicetype: response[i].description,
                        id: response[i].id,
                    });
                } else if (response[i].description === 'Repair') {
                    typesdata.push({
                        img: this.config.hardCodeData.repairServiceImg,
                        servicetype: response[i].description,
                        id: response[i].id,
                    });
                } else if (response[i].description === 'Scheduled') {
                    typesdata.push({
                        img: this.config.hardCodeData.scheduledServiceImg,
                        servicetype: response[i].description,
                        id: response[i].id,
                    });
                }
            }
            return typesdata;
        } catch (error) {
            throw error;
        }
    };

    ListDealersLogic = async (accountId, userId, vinno, latitude, longitude, modelDesc, cookie, xplatform) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }

            const token = await this.getMAuthToken(vinno, mobileNumber);
            const listDealersReqData = {
                chassis: chassisNumber,
                latitude: latitude,
                longitude: longitude,
                mobileNumber: mobileNumber,
                modelDesc: modelDesc,
            };
            let dealers = await this.wrapperI.getDealers(vinno, listDealersReqData, token);
            dealers = dealers.map((dealer) => {
                const newDealerObj = {
                    dealername: dealer.dealerName || null,
                    latitude: Number(dealer.latitude) || null,
                    longitude: Number(dealer.longitude) || null,
                    ispreferred: dealer.isPreferred,
                    parentgroup: dealer.parentGroup,
                    locationcode: dealer.locationCode,
                    address: dealer.address,
                    branchname: dealer.branchName,
                    islastservicecenter: dealer.isLastServiceCenter,
                };
                return newDealerObj;
            });
            return dealers;
        } catch (error) {
            throw error;
        }
    };

    GetDealerSlotsLogic = async (accountId, userId, vinno, epoch, cookie, xplatform) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const mobileDetails = await this.serviceModSvcI.GetMobileNumber(vinno);
            const mobileNumber = mobileDetails[0].mobile;
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }

            const result = await this.serviceModSvcI.GetDealerSlots();
            const timeslots = [];

            if (result.length === 0) {
                throw {
                    errcode: 'NO_SLOTS_FOUND',
                };
            }

            for (const slot of result) {
                const epochbookingtime = epoch + slot.slotoffset * 3600 * 1000;
                timeslots.push({
                    slot: slot.slots,
                    epochbookingtime: epochbookingtime,
                });
            }
            const bookingdate = utils.convertEpochToIST(epoch);
            return {
                bookingdate,
                timeslots,
            };
        } catch (error) {
            throw error;
        }
    };

    CreateVehicleServiceBookingLogic = async (accountId, userId, vinno, serviceType, kilometer, parentGroup, locationCode, dealerName, dealerAddress, bookingTime, cookie, xplatform) => {
        let txclient = null;
        try {
            txclient = await this.serviceModSvcI.StartTransaction();
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.admin'], 'all');
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_BOOKING_ACCESS_DENIED'
                    }
                }
            }

            const activeBooking = await this.serviceModSvcI.GetActiveBooking(vinno);
            if (activeBooking.length > 0) {
                throw {
                    errcode: 'VEHICLE_ALREADY_BOOKED',
                };
            }
            const slot = utils.convertToADCFormat(bookingTime);
            const selectedSolt = slot.split(' ')[1];
            const isValidSlot = await this.IsValidSlotLogic(slot);
            if (!isValidSlot) {
                throw {
                    errcode: 'INVALID_SLOT',
                };
            }
            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }

            const dealerMeta = {
                dealername: dealerName,
                dealeraddress: dealerAddress,
                dealercode: parentGroup,
                dealerlocation: locationCode,
            };

            const token = await this.getMAuthToken(vinno, mobileNumber);

            const fleetId = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            const requestId = this.getRequestId();

            const [vehicleLatestData, vehicleDetails] = await Promise.all([
                this.GetVechRecentDataLogic([vinno], cookie),
                this.serviceModSvcI.GetVehicleDetails([vinno])
            ]);
            const vehicleOdometer = vehicleLatestData?.data?.candata[vinno]?.odometer || null;
            const vehicleModel = utils.getADCModel(vehicleDetails.get(vinno)?.modeldisplayname) || null;
            const vehicleModelCode = vehicleDetails.get(vinno)?.modelcode || null;
            const vehicleRegNo = vehicleDetails.get(vinno)?.regno || null;

            const bookingMeta = {
                servicetype: serviceType,
                odometer: vehicleOdometer,
            };

            const bookingResponse = await this.wrapperI.bookServiceRequest(
                vinno,
                {
                    bookingType: 'REGULAR',
                    chassisNumber,
                    mobileNumber,
                    modelDesc: vehicleModel,
                    serviceType: serviceType,
                    locationCode: locationCode,
                    parentGroup: parentGroup,
                    slot: slot,
                },
                token,
                requestId
            );

            if (bookingResponse != 'Service booked successfully') {
                throw {
                    errcode: 'BOOKING_FAILED',
                };
            }
            await this.serviceModSvcI.CreateServiceBookingLog(txclient, vinno, requestId, new Date(), userId, this.ServiceBookingStatus.BOOKED, {
                servicetype: serviceType,
                odometer: vehicleOdometer,
            });
            await this.serviceModSvcI.CreateActiveBooking(txclient, vinno, bookingTime, slot, requestId, this.ServiceBookingStatus.BOOKED, dealerMeta, bookingMeta, userId);
            await this.serviceModSvcI.CreateAccountBookingHistory(txclient, accountId, fleetId, vinno, bookingTime, requestId);            
            await this.serviceModSvcI.CommitTransaction(txclient);

            const reponse = {
                vinno: vinno,
                regno: vehicleRegNo,
                modelcode: vehicleModelCode,
                modeldisplayname: vehicleModel,
                odometer: vehicleOdometer ? vehicleOdometer + " km" : null,
                location: {
                    lat: vehicleLatestData?.data?.gpsdata[vinno]?.latitude || 17.6867174,
                    lng: vehicleLatestData?.data?.gpsdata[vinno]?.longitude || 77.5822892
                },
                bookingid: requestId,
                bookingstatus: this.ServiceBookingStatus.BOOKED,
                bookingtime: bookingTime ? utils.convertEpochToIST(bookingTime) : null,
                slot: selectedSolt,
                servicetype: serviceType,
                isbooknow: false,
                ispreinvoice: false,
                isinvoice: false,
                isreshcedule: true,
                iscancel: true,
                isstatuscheck: true,
            };
            this.ProcessBookingStatusLogic(vinno, requestId, chassisNumber, mobileNumber, token).catch((error) => {});

            return reponse;
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw error;
        }
    };

    GetVehicleServiceStatusLogic = async (accountId, userId, vinno, bookingId, cookie, xplatform) => {
        let txclient = null;
        try {
            txclient = await this.serviceModSvcI.StartTransaction();
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.view', 'service.booking.admin']);
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_STATUS_ACCESS_DENIED'
                    }
                }
            }

            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }

            const activeBooking = await this.serviceModSvcI.GetActiveBooking(vinno);
            if (!activeBooking.length) {
                throw {
                    errcode: 'NO_ACTIVE_BOOKING',
                };
            }
            const dealerName = activeBooking[0].dealername;
            const dealerLocation = activeBooking[0].dealerlocation;
            const bookingTime = activeBooking[0].bookingtime;
            const slot = activeBooking[0].slot;
            const odometer = parseInt(activeBooking[0].odometer);

            const token = await this.getMAuthToken(vinno, mobileNumber);
            const serviceStatus = await this.GetServiceStatus(vinno, chassisNumber, mobileNumber, token);
            if (!serviceStatus) {
                const statusInfo = utils.getPreviousBookingStatus(activeBooking[0].servicestatus, vinno);
                return {
                    data: statusInfo,
                    msg: 'No new updates on your service booking yet.',
                };
            }
            if (!serviceStatus.appointmentDetails) {
                await this.serviceModSvcI.DeleteActiveBooking(txclient, bookingId);
                await this.serviceModSvcI.CreateServiceBookingLog(txclient, vinno, bookingId, new Date(), userId, this.ServiceBookingStatus.CANCELLED, {});
                await this.serviceModSvcI.CommitTransaction(txclient);
                return {
                    data: {
                        isstatuscheck: false,
                        vinno: vinno,
                        isbooknow: true,
                        iscompleted: false,
                        iscancel: false,
                        isreschdule: false,
                        status: this.ServiceBookingStatus.CANCELLED,
                        dealername: dealerName || null,
                        dealeraddress: dealerLocation || null,
                    },
                    msg: 'Your booking has been cancelled by the dealer.',
                };
            }

            if (!serviceStatus.roDetails) {
                await this.serviceModSvcI.UpdateActiveBookingAppointment(txclient, bookingId, serviceStatus.appointmentDetails.appointmentId, serviceStatus.appointmentDetails.dmsBookingId);
                await this.serviceModSvcI.CommitTransaction(txclient);
                return {
                    data: {
                        isstatuscheck: true,
                        vinno: vinno,
                        isbooknow: false,
                        iscompleted: false,
                        iscancel: true,
                        isreschdule: true,
                        status: this.ServiceBookingStatus.BOOKED,
                        dealername: dealerName || null,
                        dealeraddress: dealerLocation || null,
                    },
                    msg: 'No new updates on your service booking yet.',
                };
            }

            const roNumber = serviceStatus.roDetails.roNumber;
            const roDate = serviceStatus.roDetails.roDate;
            const roStatus = serviceStatus.roDetails.roStatus;
            const dmsBookingId = serviceStatus.appointmentDetails.dmsBookingId;
            const nextServiceDate = serviceStatus.nextServiceDetails ? serviceStatus.nextServiceDetails.nextDueDate : null;

            if (!roNumber || !roDate || !roStatus) {
                const statusInfo = utils.getPreviousBookingStatus(activeBooking[0].servicestatus, vinno);
                return {
                    data: statusInfo,
                    msg: 'No new updates on your service booking yet.',
                };
            }

            if (roStatus === 'Open') {
                await this.serviceModSvcI.UpdateActiveBookingRo(txclient, bookingId, roNumber, this.ServiceBookingStatus.RO_OPEN);
                await this.serviceModSvcI.CommitTransaction(txclient);
                return {
                    data: {
                        isstatuscheck: true,
                        vinno: vinno,
                        isbooknow: false,
                        iscompleted: false,
                        iscancel: false,
                        isreschdule: false,
                        status: this.ServiceBookingStatus.RO_OPEN,
                        dealername: dealerName || null,
                        dealeraddress: dealerLocation || null,
                    },
                    msg: 'Repair order has been raise for you vehicle service.',
                };
            }

            const serviceHistoryReqData = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
                isThisYear: true,
            };
            const { isRoBillGenerated, listRoInfos } = await this.getRecentRoBillDetails(serviceHistoryReqData, vinno, bookingId, roNumber, token);
            if (!isRoBillGenerated) {
                return {
                    data: {
                        isstatuscheck: true,
                        vinno: vinno,
                        isbooknow: false,
                        iscompleted: false,
                        iscancel: false,
                        isreschdule: false,
                        status: this.ServiceBookingStatus.RO_OPEN,
                        dealername: dealerName || null,
                        dealeraddress: dealerLocation || null,
                    },
                    msg: 'No new updates on your service booking yet.',
                };
            }
            const roBillDetails = listRoInfos[0];
            const roBillNumber = roBillDetails.roBillNum;
            const roBillDate = roBillDetails.roBillDate;
            const parentCode = roBillDetails.parentCode;
            const locationCode = roBillDetails.locationCode;
            const netBillAmt = parseInt(roBillDetails.netBillAmt);

            const completedBookingMeta = {
                parentCode,
                locationCode,
                roBillNumber,
            };
            const svcInsertData = {
                bookingTime,
                bookingId,
                dmsBookingId,
                roNumber,
                roBillNumber,
                roBillDate,
                netBillAmt,
                odometer,
                parentCode,
                locationCode,
                dealerName,
                dealerLocation,
                nextServiceDate,
                slot,
            };
            await this.serviceModSvcI.DeleteActiveBooking(txclient, bookingId);
            await this.serviceModSvcI.CreateServiceBookingLog(txclient, vinno, bookingId, new Date(), userId, this.ServiceBookingStatus.COMPLETED, completedBookingMeta);
            await this.serviceModSvcI.CreateServiceDoneHistory(txclient, userId, vinno, svcInsertData);
            await this.serviceModSvcI.CommitTransaction(txclient);

            return {
                data: {
                    isstatuscheck: false,
                    vinno: vinno,
                    isbooknow: true,
                    iscompleted: true,
                    iscancel: false,
                    isreschdule: false,
                    status: "Serviced",
                    dealername: dealerName || null,
                    dealeraddress: dealerLocation || null,
                },
                msg: 'Your service booking has been completed.',
            };
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw error;
        }
    };

    ReschVehicleServiceBookingLogic = async (
        accountId,
        userId,
        vinno,
        oldBookingId,
        newServiceType,
        newKilometer,
        newParentGroup,
        newLocationCode,
        newDealerName,
        newDealerAddress,
        newBookingTime,
        cookie,
        xplatform
    ) => {
        let txclient = null;
        try {
            txclient = await this.serviceModSvcI.StartTransaction();
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }
            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.admin'], 'all');
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_RESCHEDULE_ACCESS_DENIED'
                    }
                }
            }
            const activeBooking = await this.serviceModSvcI.GetActiveBooking(vinno);
            const requestId = activeBooking[0].requestid;
            if (activeBooking.length === 0 || requestId !== oldBookingId) {
                throw {
                    errcode: 'BOOKING_NOT_FOUND',
                };
            }

            const dealerPCode = activeBooking[0].dealercode;
            const dealerLocationCode = activeBooking[0].dealerlocation;
            const serviceType = activeBooking[0].servicetype;
            const bookingTime = activeBooking[0].bookingtime;

            const rescheduleDate = utils.convertEpochToIST(newBookingTime);
            const currBookingDate = utils.convertEpochToIST(bookingTime);

            if (currBookingDate === rescheduleDate) {
                if (serviceType === newServiceType && dealerPCode === newParentGroup && dealerLocationCode === newLocationCode) {
                    throw {
                        errcode: 'BOOK_DETAILS_SAME'
                    }
                }
            }

            const currentStatus = await this.GetVehicleServiceStatusLogic(accountId, userId, vinno, oldBookingId, cookie);
            if (!currentStatus.data) {
                throw {
                    errcode: 'RESCHEDULE_STATUS_ERROR'
                }
            }

            if (currentStatus.data.status !== this.ServiceBookingStatus.BOOKED) {
                throw {
                    errcode: 'CANNOT_BE_RESCHEDULED',
                };
            }

            const slot = utils.convertToADCFormat(newBookingTime);
            const selectedSolt = slot.split(' ')[1];
            const isValidSlot = await this.IsValidSlotLogic(slot);
            if (!isValidSlot) {
                throw {
                    errcode: 'INVALID_SLOT',
                };
            }
            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);

            const dealerMeta = {
                dealername: newDealerName,
                dealeraddress: newDealerAddress,
                dealercode: newParentGroup,
                dealerlocation: newLocationCode,
            };

            const [vehicleLatestData, vehicleDetails] = await Promise.all([this.GetVechRecentDataLogic([vinno], cookie), this.serviceModSvcI.GetVehicleDetails([vinno])]);
            const vehicleOdometer = vehicleLatestData?.data?.candata[vinno]?.odometer || null;
            const vehicleModel = utils.getADCModel(vehicleDetails.get(vinno)?.modeldisplayname) || null;
            const vehicleModelCode = vehicleDetails.get(vinno)?.modelcode || null;
            const vehicleRegNo = vehicleDetails.get(vinno)?.regno || null;

            const bookingMeta = {
                servicetype: newServiceType,
                odometer: vehicleOdometer,
            };

            const token = await this.getMAuthToken(vinno, mobileNumber);

            const bookingResponse = await this.wrapperI.bookServiceRequest(
                vinno,
                {
                    bookingType: 'REGULAR',
                    chassisNumber,
                    mobileNumber,
                    modelDesc: vehicleModel,
                    serviceType: newServiceType,
                    locationCode: newLocationCode,
                    parentGroup: newParentGroup,
                    slot: slot,
                },
                token,
                requestId
            );

            if (bookingResponse != 'Service booked successfully') {
                throw {
                    errcode: 'RESCHEDULE_FAILED',
                };
            }

            await this.serviceModSvcI.UpdateActiveBooking(txclient, requestId, newBookingTime, slot, this.ServiceBookingStatus.BOOKED, dealerMeta, bookingMeta, userId);
            await this.serviceModSvcI.CreateServiceBookingLog(txclient, vinno, requestId, new Date(), userId, this.ServiceBookingStatus.RESCHEDULED, bookingMeta);
            await this.serviceModSvcI.CreateServiceBookingLog(txclient, vinno, requestId, new Date(), userId, this.ServiceBookingStatus.BOOKED, bookingMeta);

            await this.serviceModSvcI.CommitTransaction(txclient);
            const reponse = {
                vinno: vinno,
                regno: vehicleRegNo,
                modelcode: vehicleModelCode,
                modeldisplayname: vehicleModel,
                odometer: vehicleOdometer ? vehicleOdometer + " km" : null,
                location: {
                    lat: vehicleLatestData?.data?.gpsdata[vinno]?.latitude || 17.6867174,
                    lng: vehicleLatestData?.data?.gpsdata[vinno]?.longitude || 77.5822892,
                },
                bookingid: requestId,
                bookingstatus: this.ServiceBookingStatus.BOOKED,
                bookingtime: newBookingTime ? utils.convertEpochToIST(newBookingTime) : null,
                slot: selectedSolt,
                servicetype: newServiceType,
                isbooknow: false,
                ispreinvoice: false,
                isinvoice: false,
                isreshcedule: true,
                iscancel: true,
                isstatuscheck: true,
            };
            this.ProcessBookingStatusLogic(vinno, requestId, chassisNumber, mobileNumber, token).catch((error) => {});
            return reponse;
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw error;
        }
    };

    GetCancelReasonsLogic = async () => {
        try {
            const result = await this.serviceModSvcI.GetCancelReasons();
            if (result.length === 0) {
                throw {
                    errcode: 'NO_CANCEL_REASONS_FOUND',
                };
            }
            return result;
        } catch (error) {
            throw error;
        }
    };

    CancelVehicleServiceBookingLogic = async (accountId, userId, bookingId, vinno, reason, cookie, xplatform) => {
        let txclient = null;
        try {
            txclient = await this.serviceModSvcI.StartTransaction();
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.admin'], 'all');
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_CANCEL_ACCESS_DENIED'
                    }
                }
            }

            const currentStatus = await this.GetVehicleServiceStatusLogic(accountId, userId, vinno, bookingId, cookie);
            if (!currentStatus.data) {
                throw {
                    errcode: 'CANCEL_STATUS_ERROR'
                }
            }

            if (currentStatus.data.status !== this.ServiceBookingStatus.BOOKED) {
                throw {
                    errcode: 'CANNOT_BE_CANCELLED',
                };
            }

            const activeBooking = await this.serviceModSvcI.GetActiveBooking(vinno);
            const appointmentId = activeBooking[0]?.appointmentid || null;
            const dmsBookingId = activeBooking[0]?.dmsbookingid || null;
            const requestId = activeBooking[0].requestid;
            if (activeBooking.length === 0 || requestId !== bookingId) {
                throw {
                    errcode: 'BOOKING_NOT_FOUND',
                };
            }

            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            const token = await this.getMAuthToken(vinno, mobileNumber);

            const [vehicleLatestData, vehicleDetails] = await Promise.all([this.GetVechRecentDataLogic([vinno], cookie), this.serviceModSvcI.GetVehicleDetails([vinno])]);
            const vehicleOdometer = vehicleLatestData?.data?.candata[vinno]?.odometer || null;
            const vehicleModel = vehicleDetails.get(vinno)?.modeldisplayname || null;
            const vehicleModelCode = vehicleDetails.get(vinno)?.modelcode || null;
            const vehicleRegNo = vehicleDetails.get(vinno)?.regno || null;

            try {
                const cancelBookingResponse = await this.wrapperI.cancelAppointment(
                    vinno,
                    {
                        appointmentId,
                        chassisNumber,
                        dmsBookingId,
                        mobileNumber,
                        reason,
                        comments: reason,
                    },
                    token
                );
                if (cancelBookingResponse.message != 'Booking has been cancelled successfully') {
                    throw {
                        errcode: 'CANCEL_BOOKING_FAILED',
                    };
                }
            } catch (error) {
                if (error.errcode != 'Cancel appointment failure :Appointment Already cancelled') {
                    throw {
                        errcode: 'ALREADY_CANCELLED',
                    };
                }
            }

            await this.serviceModSvcI.DeleteActiveBooking(txclient, requestId);
            await this.serviceModSvcI.CreateServiceBookingLog(txclient, vinno, requestId, new Date(), userId, this.ServiceBookingStatus.CANCELLED, {
                reason: reason,
            });
            await this.serviceModSvcI.CommitTransaction(txclient);

            const response = {
                vinno: vinno,
                regno: vehicleRegNo,
                modelcode: vehicleModelCode,
                modeldisplayname: vehicleModel,
                odometer: vehicleOdometer ? vehicleOdometer + " km" : null,
                location: {
                    lat: vehicleLatestData?.data?.gpsdata[vinno]?.latitude || 17.6867174,
                    lng: vehicleLatestData?.data?.gpsdata[vinno]?.longitude || 77.5822892,
                },
                bookingstatus: this.ServiceBookingStatus.CANCELLED,
                isbooknow: true,
                ispreinvoice: false,
                isinvoice: false,
                isreshcedule: false,
                iscancel: false,
                isstatuscheck: false,
            };
            return response;
        } catch (error) {
            if (txclient !== null) {
                await this.serviceModSvcI.RollbackTransaction(txclient);
            }
            throw error;
        }
    };

    GetVehicleServiceHistoryLogic = async (accountId, userId, vinno, cookie, xplatform) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.view', 'service.booking.admin']);
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_HISTORY_ACCESS_DENIED'
                    }
                }
            }

            let serviceHistory = await this.serviceModSvcI.GetVehicleServiceHistory(vinno);
            serviceHistory = serviceHistory.map((item) => {
                return {
                    ...item,
                    odometer: item.odometer ? item.odometer + " km" : "NA",
                    invoice: item.invoice !== null && item.invoice !== undefined ? "₹" + item.invoice : "NA",
                    invoicedate: item.invoicedate ? utils.dateFormatter(new Date(item.invoicedate)) : null,
                    bookingtime: item.bookingtime ? utils.dateFormatter(new Date(item.bookingtime)) : null,
                };
            });
            return serviceHistory;
        } catch (error) {
            throw error;
        }
    };

    GetVehicleInfoLogic = async (accountId, userId, vinno, cookie, xplatform) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.view', 'service.booking.admin']);
                if (!hasPerm) {
                    throw {
                        errcode: 'VEHICLE_INFO_ACCESS_DENIED'
                    }
                }
            }
            let vehicleTelematics = null;
            let vehicleModelInfo = null;
            let vehicleLastServiceInfo = null;
            let modelcode = null;
            let modeldisplayname = null;
            let vehicleage = null;
            let purchasedate = null;
            let regno = null;
            let lastserviceamt = null;
            let lastserviceodo = null;
            let invoicedate = null;
            let lastservicedealer = null;

            const [vehicleDetailsResult, vehicleTelematicsResult] = await Promise.allSettled([
                this.serviceModSvcI.GetVehicleInfo(vinno),
                this.GetVechRecentDataLogic([vinno], cookie)
            ]);

            // vehicle details
            if (vehicleDetailsResult.status === 'rejected') {
                this.logger.error('Error while getting vehicle details', vehicleDetailsResult.reason);
            } else {
                const vehicleDetails = vehicleDetailsResult.value;
                vehicleModelInfo = vehicleDetails.vehicleDetail;
                vehicleLastServiceInfo = vehicleDetails.lastServiceDetail;
                if (vehicleModelInfo.length === 0) {
                    throw {
                        errcode: 'VEHICLE_NOT_FOUND',
                    };
                }

                purchasedate = vehicleModelInfo[0].delivered_date || null;
                modelcode = vehicleModelInfo[0].modelcode || null;
                modeldisplayname = vehicleModelInfo[0].modeldisplayname || null;
                regno = vehicleModelInfo[0].regno || null;

                if (vehicleLastServiceInfo.length === 0) {
                    this.logger.error('No last service details found for the vehicle');
                } else {
                    invoicedate = vehicleLastServiceInfo[0].invoicedate ? utils.dateFormatter(new Date(vehicleLastServiceInfo[0].invoicedate)) : null;
                    lastservicedealer = vehicleLastServiceInfo[0].dealername || 'NA';
                }
            }

            // vehicle telematics
            if (vehicleTelematicsResult.status === 'rejected') {
                this.logger.error(`Vehicle telematics failed: ${vehicleTelematicsResult.reason}`);
            } else {
                vehicleTelematics = vehicleTelematicsResult.value;
            }

            if (purchasedate) {
                vehicleage = utils.calculateAge(new Date(purchasedate).getTime(), new Date().getTime());
                purchasedate = utils.dateFormatter(new Date(purchasedate));
            }

            let odometer = vehicleTelematics?.data?.candata[vinno]?.odometer || null;
            if (odometer) {
                const parsed = Number(odometer);
                if (!isNaN(parsed)) {
                    odometer = parsed + " km";
                } else {
                    odometer = "NA";
                }
            }

            if (vehicleLastServiceInfo[0]?.lastserviceodo) {
                const parsed = Number(vehicleLastServiceInfo[0].lastserviceodo);
                if (!isNaN(parsed)) {
                    lastserviceodo = parsed + " km";
                } else {
                    lastserviceodo = "NA";
                }
            }
            if (vehicleLastServiceInfo[0]?.lastserviceamount !== null && vehicleLastServiceInfo[0]?.lastserviceamount !== undefined) {
                const parsed = Number(vehicleLastServiceInfo[0].lastserviceamount);
                if (!isNaN(parsed)) {
                    lastserviceamt = "₹ " + parsed;
                } else {
                    lastserviceamt = "NA";
                }
            }

            return {
                vehicledetails: {
                    odometer: odometer,
                    regno: regno || 'NA',
                    vinno: vinno || 'NA',
                    purchasedate: purchasedate,
                    vehicleage: vehicleage || 'NA',
                    lastserviceodo: lastserviceodo || 'NA',
                    lastservicecost: lastserviceamt || 'NA',
                    lastservicedate: invoicedate || null,
                    lastservicecenter: lastservicedealer || 'NA',
                    modelcode: modelcode || 'NA',
                    modeldisplayname: modeldisplayname || 'NA',
                }
            };
        } catch (error) {
            throw error;
        }
    };

    GetInvoiceLogic = async (accountId, userId, vinno, bookingid, cookie, xplatform) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.view', 'service.booking.admin']);
                if (!hasPerm) {
                    throw {
                        errcode: 'USER_INVOICE_ACCESS_DENIED'
                    }
                }
            }

            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }
            const serviceHistoryData = await this.serviceModSvcI.GetInvoice(vinno, bookingid);
            if (serviceHistoryData.length === 0) {
                throw {
                    errcode: 'SERVICE_HISTORY_NOT_FOUND',
                };
            }

            const vehicleDetails = await this.serviceModSvcI.GetSingleVehicleDetail(vinno);
            if (vehicleDetails.length === 0) {
                throw {
                    errcode: 'VEHICLE_NOT_FOUND',
                };
            }
            const regno = vehicleDetails[0].regno;
            if (serviceHistoryData[0].invoice) {
                return utils.formatInvoiceObject(serviceHistoryData[0].invoice.roInfo, vinno, regno);
            }

            const roBillNumber = serviceHistoryData[0].robillnumber;
            const parentCode = serviceHistoryData[0].parentcode;
            const locationCode = serviceHistoryData[0].locationcode;

            const token = await this.getMAuthToken(vinno, mobileNumber);
            const invoiceReqData = {
                chassisNumber: chassisNumber,
                mobileNumber: mobileNumber,
                roBillNo: [roBillNumber],
                parentCode: parentCode,
                locationCode: locationCode,
            };
            let invoiceData = await this.wrapperI.getRepairOrderBillDetails(vinno, invoiceReqData, token);
            await this.serviceModSvcI.UpdateInvoice(null, vinno, bookingid, invoiceData);
            invoiceData = utils.formatInvoiceObject(invoiceData.roInfo, vinno, regno);
            return invoiceData;
        } catch (error) {
            throw error;
        }
    };

    GetExternalVehicleInfoLogic = async (accountId, userId, vinno, cookie, xplatform) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.booking.view', 'service.booking.admin']);
                if (!hasPerm) {
                    throw {
                        errcode: 'VEHICLE_INFO_ACCESS_DENIED'
                    }
                }
            }

            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }
            const token = await this.getMAuthToken(vinno, mobileNumber);
            const vehicleDetailsReqData = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
                isOwnedVehicle: true,
            };
            let warrantyExpireDate = null;
            let warranty = null;
            let inwarranty = null;
            let rsaExpireDate = null;
            let rsaShieldExpireDate = null;
            let isRSActive = null;
            let insuranceExpireDate = null;
            let isInsuranceActive = null;
            let rsaDetails = null;
            let rsaShieldDetails = null;
            let rsaType = null;
            let response;
            const vehicleDetailsResult = await this.wrapperI.getVehicleDetails(vinno, vehicleDetailsReqData, token);
            const vehicleDetails = vehicleDetailsResult.data.ownedVehicleModel;
            if (vehicleDetails?.length === 0) {
                throw {
                    errcode: 'VEHICLE_NOT_FOUND',
                };
            } else {
                warrantyExpireDate = vehicleDetails[0]?.orgnlWarntyExpryDate ? utils.dateFormatter(new Date(vehicleDetails[0]?.orgnlWarntyExpryDate)) : 'NA';
                if (warrantyExpireDate) {
                    if (Date.now() > new Date(warrantyExpireDate).getTime()) {
                        warranty = 'Warranty Expired';
                        inwarranty = false;
                    } else {
                        warranty = 'In Warranty';
                        inwarranty = true;
                    }
                }

                rsaDetails = vehicleDetails[0]?.rsaDetails;
                rsaShieldDetails = vehicleDetails[0]?.shieldDetails;

                if (rsaDetails?.length > 0) {
                    rsaExpireDate = rsaDetails[0]?.rsaExpryDate ? utils.dateFormatter(new Date(rsaDetails[0]?.rsaExpryDate)) : 'NA';
                    rsaType = 'RSA';
                    isRSActive = true;
                } else if (rsaShieldDetails?.length > 0) {
                    rsaShieldExpireDate = rsaShieldDetails[0]?.schemeExpDate ? utils.dateFormatter(new Date(rsaShieldDetails[0]?.schemeExpDate)) : 'NA';
                    rsaType = 'RSA Shield';
                    isRSActive = true;
                }

                if (vehicleDetails[0]?.insuranceExpirydt) {
                    insuranceExpireDate = vehicleDetails[0].insuranceExpirydt ? utils.dateFormatter(new Date(vehicleDetails[0].insuranceExpirydt)) : 'NA';
                    isInsuranceActive = true;
                }

                response = {
                    warranty: {
                        expiredate: warrantyExpireDate || 'NA',
                        warranty: warranty || 'NA',
                        inwarranty: inwarranty,
                    },
                    rsa: {
                        expiredate: rsaExpireDate || rsaShieldExpireDate || 'NA',
                        rsatype: rsaType || 'NA',
                        isrsaactive: isRSActive,
                    },
                    insurance: {
                        expiredate: insuranceExpireDate || 'NA',
                        isinsuranceactive: isInsuranceActive,
                    }
                };
            }
            return response;
        } catch (error) {
            throw error;
        }
    };

    ListDealerSearchLogic = async (accountId, userId, vinno, modelDesc, itemIndex, pageSize, searchFilter) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND'
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }
            const token = await this.getMAuthToken(vinno, mobileNumber);
            const searchDealerReqData = {
                chassisNumber,
                mobileNumber,
                modelDesc,
                itemIndex,
                pageSize,
                searchFilter,
            };
            const dealerSearchResponse = await this.wrapperI.searchDealers(vinno, searchDealerReqData, token);
            return dealerSearchResponse;
        } catch (error) {
            throw error;
        }
    };

    ListNearestDealersSearchLogic = async (accountId, userId, latitude, longitude) => {
        try {
            const token = await this.getMAuthToken(this.config.hardCodeData.vinno, this.config.hardCodeData.mobileNumber);
            const listnearestdealersreqdata = {
                modelGroupDesc: 'TREO',
                pageSize: 30,
                searchFilter: ' ',
                dealerType: '3S',
                latitude: latitude,
                longitude: longitude,
            };
            let dealers = await this.wrapperI.getNearestDealers(this.config.hardCodeData.vinno, listnearestdealersreqdata, token);
            dealers = dealers.map((dealer) => {
                const newDealerObj = {
                    dealername: dealer.dealerName,
                    dealertype: dealer.dealerType,
                    dealeraddress: dealer.dealerAddress,
                    branchname: dealer.branchName,
                    cityname: dealer.cityName,
                    statename: dealer.stateName,
                    latitude: Number(dealer.latitude),
                    longitude: Number(dealer.longitude),
                    parentgroup: dealer.parentGroup,
                    locationcode: dealer.locationCode,
                    mobilenumber: dealer.mobileNo,
                    workingstarttime: dealer.workingStartTime,
                    workingendtime: dealer.workingEndTime,
                    dealernamealexa: dealer.dealerNameAlexa
                };
                return newDealerObj;
            });
            return dealers;
        } catch (error) {
            throw error;
        }
    };

    GetSoSDetailsLogic = async (accountId, userId, vinno, cookie, xplatform) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND'
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }
            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.sos.admin'], 'all');
                if (!hasPerm) {
                    throw {
                        errcode: 'SOS_ACCESS_DENIED'
                    }
                }
            }
            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }

            let sosReasons = null;
            let vehicleDetails = null;
            let vehicleRecentData = null;
            let purchasedate = null;
            let vehicleage = null;
            let modelcode = null;
            let modeldisplayname = null;
            let regno = null;

            const [sosDetailsResult, vehicleRecentResult] = await Promise.allSettled([
                this.serviceModSvcI.GetSoSDetails(vinno),
                this.GetVechRecentDataLogic([vinno], cookie)
            ]);

            if (sosDetailsResult.status === 'rejected') {
                this.logger.error('Error in getSOSReasons', sosDetailsResult.reason);
            } else {
                sosReasons = sosDetailsResult.value.sosReasons;
                vehicleDetails = sosDetailsResult.value.vehicleDetails;
            }

            if (vehicleRecentResult.status === 'rejected') {
                this.logger.error('Error in connectToFMSApi', vehicleRecentResult.reason.data?.message);
            } else {
                vehicleRecentData = vehicleRecentResult.value;
            }

            if (vehicleDetails) {
                purchasedate = vehicleDetails[0].delivered_date;
                regno = vehicleDetails[0].regno;
                vehicleage = purchasedate ? utils.calculateAge(new Date(purchasedate).getTime(), new Date().getTime()) : null;
                modelcode = vehicleDetails[0].modelcode;
                modeldisplayname = vehicleDetails[0].modeldisplayname;
            }

            let odometer = null;
            if (vehicleRecentData?.data?.candata[vinno]?.odometer) {
                const parsed = Number(vehicleRecentData?.data?.candata[vinno]?.odometer);
                if (!isNaN(parsed)) {
                    odometer = parsed + " km";
                } else {
                    odometer = "NA";
                }
            }

            return {
                vehicledetails: {
                    odometer: odometer || 'NA',
                    regno: regno || 'NA',
                    vinno: vinno,
                    purchasedate: purchasedate ? utils.dateFormatter(new Date(purchasedate)) : null,
                    vehicleage: vehicleage || 'NA',
                    modecode: modelcode || 'NA',
                    modeldisplayname: modeldisplayname || 'NA',
                },
                sosreasons: sosReasons,
                lat: vehicleRecentData?.data?.gpsdata[vinno]?.latitude || 17.6867174,
                lng: vehicleRecentData?.data?.gpsdata[vinno]?.longitude || 77.5822892,
            };
        } catch (error) {
            throw error;
        }
    };

    RaiseSOSLogic = async (accountId, userId, sosinfo, cookie, xplatform) => {
        try {
            const { vinno, latitude, longitude, issue } = sosinfo;
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND',
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }

            const moduleDetails = await this.serviceModSvcI.GetServiceModuleDetails();
            if (moduleDetails.length === 0) {
                throw {
                    errcode: 'MODULE_NOT_FOUND'
                };
            }
            const moduleId = moduleDetails[0].moduleid;
            if(xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS'){
                const getMyServicePerms = await this.GetMyServicePermsLogic(vehicleFleet, moduleId, cookie, xplatform);
                const permList = getMyServicePerms.perms.map((perm) => perm.permid);
                const hasPerm = utils.checkUserPerms(permList, ['service.sos.admin'], 'all');
                if (!hasPerm) {
                    throw {
                        errcode: 'SOS_ACCESS_DENIED'
                    }
                }
            }

            const sosReasons = await this.serviceModSvcI.GetSOSReasons();
            if (sosReasons.length === 0) {
                throw {
                    errcode: 'SOS_REASONS_NOT_FOUND',
                };
            }

            const sosReasonsList = sosReasons.map((sosReason) => sosReason.value);
            if (!sosReasonsList.includes(issue[0])) {
                throw {
                    errcode: 'SOS_REASONS_NOT_FOUND',
                };
            }

            const mobileNumber = await this.GetMobileNumberLogic(vinno);
            if (!mobileNumber) {
                throw {
                    errcode: 'MOBILE_NUMBER_NOT_FOUND',
                };
            }
            const chassisNumber = utils.getChassisNumber(vinno);
            if (!chassisNumber) {
                throw {
                    errcode: 'INVALID_VIN_NUMBER',
                };
            }

            const userInfo = await this.serviceModSvcI.GetUserInfo(userId);
            if (userInfo.length === 0) {
                throw {
                    errcode: 'USER_NOT_FOUND',
                };
            }
            const userName = userInfo[0].displayname;
            const token = await this.getMAuthToken(vinno, mobileNumber);
            const baseRaiseSOSReqData = {
                mobileNumber: mobileNumber,
                chassisNumber: chassisNumber,
                latitude: latitude,
                longitude: longitude,
                message: "SOS raised",
                name: userName,
            };

            const sosPromises = issue.map(async (issuetype) => {
                try {
                    const raiseSOSReqData = {
                        ...baseRaiseSOSReqData,
                        sosSource: issuetype,
                    };
                    const response = await this.wrapperI.sendSosRequest(vinno, raiseSOSReqData, token);
                    return {
                        id: issuetype,
                        response: response,
                        status: 'fulfilled',
                    };
                } catch (error) {
                    this.logger.error(`Error in raiseSOS for issue ${issuetype}:`, error);
                    return {
                        id: issuetype,
                        error: error.errmsg || 'Unable to send the SOS request.',
                        status: 'rejected',
                    };
                }
            });

            const results = await Promise.allSettled(sosPromises);
            const responseList = [];
            const errorList = [];
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const innerResult = result.value;
                    if (innerResult.status === 'fulfilled') {
                        responseList.push({
                            id: innerResult.id,
                            response: innerResult.response,
                        });
                    } else {
                        this.logger.error(`SOS request failed for issue ${innerResult.id}:`, innerResult.error);
                        errorList.push({
                            id: innerResult.id,
                            error: innerResult.error,
                        });
                    }
                } else {
                    this.logger.error(`SOS request promise rejected for issue ${issue[index]}:`, result.reason);
                }
            });

            if (!responseList.length) {
                throw {
                    errcode: 'SOS_REQUEST_FAILED',
                    errmsg: errorList[0].error
                };
            }
            return responseList;
        } catch (error) {
            throw error;
        }
    };

    GetKilometersLogic = async (accountId, userId, vinno, cookie) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND'
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }
            const kiloMap = new Map();
            const serviceKilometersList = await this.GetServiceKilometersListLogic();
            serviceKilometersList.forEach((km) => {
                kiloMap.set(km, false);
            });
            const vehicleServiceHistory = await this.GetVehicleServiceHistoryLogic(accountId, userId, vinno, cookie);
            let lastServiceKm = vehicleServiceHistory.find((vehicle) => vehicle.vinno === vinno)?.odometer;

            if (!lastServiceKm) {
                kiloMap.forEach((value, key) => {
                    kiloMap.set(key, true);
                });
                return Object.fromEntries(kiloMap);
            }
            lastServiceKm = Number(lastServiceKm.replace('km', ''))
            const nextServiceKm = serviceKilometersList.find((km) => km > lastServiceKm);
            kiloMap.set(nextServiceKm, true);
            return Object.fromEntries(kiloMap);
        } catch (error) {
            throw error;
        }
    };

    //support functions
    //overview api
    GetFiltVechInServiceLogic = async (vehicles, cookie, startDate) => {
        try {
            const vehicleDetails = await this.serviceModSvcI.GetVehicleDetails(vehicles);
            const recentData = await this.GetVechRecentDataLogic(vehicles, cookie);
            const vehiclesData = new Map();
            vehicles.forEach((vehicle) => {
                vehiclesData.set(vehicle, {
                    vinno: vehicle,
                    regno: vehicleDetails.get(vehicle)?.regno || null,
                    modelcode: vehicleDetails.get(vehicle)?.modelcode || null,
                    modeldisplayname: vehicleDetails.get(vehicle)?.modeldisplayname || null,
                    odometer: recentData?.data?.candata?.[vehicle]?.odometer ? Math.round(recentData?.data?.candata?.[vehicle]?.odometer) + " km" : null,
                    location: {
                        lat: recentData?.data?.gpsdata?.[vehicle]?.latitude || 17.6867174,
                        lng: recentData?.data?.gpsdata?.[vehicle]?.longitude || 77.5822892,
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
            const serviceKilometersList = await this.GetServiceKilometersListLogic();
            const vehiclesServiceDetails = await this.GetVehicleServiceDetailsLogic(vehicles);

            vehiclesServiceDetails.forEach((vehicleServiceData) => {
                vehiclesData.set(vehicleServiceData.vinno, {
                    ...vehiclesData.get(vehicleServiceData.vinno),
                    bookingid: vehicleServiceData.bookingid,
                    dmsronumber: vehicleServiceData.dmsronumber,
                    bookingstatus: vehicleServiceData.bookingstatus,
                    bookingtime: vehicleServiceData.bookingtime,
                    slot: vehicleServiceData.slot,
                    servicetype: vehicleServiceData.servicetype,
                    servicedate: vehicleServiceData.servicedate,
                    serviceodo: vehicleServiceData.serviceodo ? vehicleServiceData.serviceodo + " km" : null,
                    servicecenter: vehicleServiceData.servicecenter,
                    servicelocation: vehicleServiceData.servicelocation,
                    duedate: vehicleServiceData.nextduedate,
                });
            });

            const filteredVehicles = servicemodhdlrutil.filterVehicleServiceDetails(vehiclesData, serviceKilometersList, startDate);
            return filteredVehicles;
        } catch (error) {
            throw error;
        }
    };

    //overview, booking, reschedule, cancel, vehicle info and sos api
    GetVechRecentDataLogic = async (vinnos, cookie) => {
        try {
            const path = '/historydata/vehicle/latestdata';
            const METHOD = 'POST';

            if (!vinnos.length) {
                return { data: { candata: {}, gpsdata: {} } };
            }

            const batches = [];
            for (let i = 0; i < vinnos.length; i += this.BATCH_SIZE) {
                batches.push(vinnos.slice(i, i + this.BATCH_SIZE));
            }

            const batchPromises = batches.map(async (batch, batchIndex) => {
                try {
                    const body = { vinnos: batch };
                    const vehicletelimatics = await this.wrapperI.connectToFMSApi(path, body, METHOD, cookie);
                    return {
                        status: 'fulfilled',
                        data: vehicletelimatics,
                    };
                } catch (error) {
                    this.logger.error(`Batch ${batchIndex} failed:`, error?.message || error);
                    return {
                        status: 'rejected',
                        error: error?.message || error,
                    };
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);

            const aggregatedData = { data: { candata: {}, gpsdata: {} } };
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
        } catch (error) {
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
            };
        }
    };

    //kilometers and overview api
    GetServiceKilometersListLogic = async () => {
        try {
            return await this.serviceModSvcI.GetServiceKilometersList();
        } catch (error) {
            throw error;
        }
    };

    //overview api
    GetVehicleServiceDetailsLogic = async (vehicles) => {
        try {
            return await this.serviceModSvcI.GetVehicleServiceDetails(vehicles);
        } catch (error) {
            throw error;
        }
    };

    //booking and reschedule api
    ProcessBookingStatusLogic = async (vinno, requestId, chassisNumber, mobileNumber, token) => {
        try {
            const serviceStatus = await this.GetServiceStatus(vinno, chassisNumber, mobileNumber, token);
            if (!serviceStatus || serviceStatus.appointmentDetails.appointmentId === null) {
                return;
            }
            const appointmentId = serviceStatus.appointmentDetails.appointmentId;
            const dmsBookingId = serviceStatus.appointmentDetails.dmsBookingId;

            await this.serviceModSvcI.UpdateActiveBookingAppointment(null, requestId, appointmentId, dmsBookingId);
        } catch (error) {
            this.logger.error('Error in ProcessBookingStatusLogic: ', error.toString());
        }
    };

    //booking and reschedule api
    IsValidSlotLogic = async (inputSlot) => {
        try {
            const result = await this.serviceModSvcI.GetDealerSlots();

            const inputTime = inputSlot.split(' ')[1];
            const inputHourMinute = inputTime.substring(0, 5);

            return result.some((slot) => {
                const slotTime = slot.slots.split(' ')[0];
                return slotTime === inputHourMinute;
            });
        } catch (error) {
            throw error;
        }
    };

    //booking api
    getRequestId() {
        return servicemodhdlrutil.getRequestId();
    }

    //list dealer, booking, reschedule, cancel, vehicle info, external vehicle info, dealer search, nearest dealers search and sos api
    getMAuthToken = async (vinno, mobilenumber) => {
        try {
            const authtokenreqdata = {
                muserid: `NEMO3.0-ADC-USERID-${mobilenumber}`,
            };
            const token = await this.wrapperI.getAuthToken(vinno, authtokenreqdata);
            return token;
        } catch (error) {
            throw error;
        }
    };

    //booking, reschedule, status api
    GetServiceStatus = async (vinno, chassisNumber, mobileNumber, token) => {
        const statusReqData = {
            chassisNumber: chassisNumber,
            mobileNumber: mobileNumber,
        };
        const statusDetails = await this.wrapperI.getServiceBookingStatus(vinno, statusReqData, token);
        if (!statusDetails) {
            return null;
        }
        let appointmentDetails = null;
        let roDetails = null;
        let nextServiceDetails = null;
        if (statusDetails.appointmentBooking) {
            appointmentDetails = {
                appointmentId: statusDetails.appointmentBooking?.appointmentId || null,
                bookingCancel: statusDetails.appointmentBooking?.bookingCancel || null,
                parenCode: statusDetails.appointmentBooking?.parentGroup || null,
                locationCode: statusDetails.appointmentBooking?.locationCode || null,
                dealerName: statusDetails.appointmentBooking?.dealerName || null,
                dealerAddress: statusDetails.appointmentBooking?.dealerAddress || null,
                dmsBookingId: statusDetails.appointmentBooking?.dmsBookingId || null,
            };
        }

        if (statusDetails.roBillDetail) {
            roDetails = {
                roNumber: statusDetails.roBillDetail?.roNum || null,
                roDate: statusDetails.roBillDetail?.roDate || null,
                roStatus: statusDetails.roBillDetail?.status || null,
            };
        }

        if (statusDetails.serviceReminderDetail) {
            nextServiceDetails = {
                nextDueDate: statusDetails.serviceReminderDetail?.nextDueDate || null,
            };
        }
        const data = {
            appointmentDetails,
            roDetails,
            nextServiceDetails,
        };
        return data;
    };

    //status api
    async getRecentRoBillDetails(serviceHistoryReqData, vinno, roNumber, token) {
        try {
            const serviceHistoryResult = await this.wrapperI.getServiceHistory(vinno, serviceHistoryReqData, token);
            const roInfos = serviceHistoryResult?.data?.roInfos;
            let recentRoInfos = null;
            let roBillGenerated = false;
            if (roInfos?.length > 0) {
                const matchingRoInfos = roInfos.filter((roInfo) => roInfo.roNum === roNumber);
                const now = new Date();
                let minDiff = Infinity;
                let closestDate = null;
                matchingRoInfos.forEach((roInfo) => {
                    const roDate = new Date(roInfo.roBillDate);
                    if (roDate > now) {
                        return;
                    }
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

    //overview api
    UserFleetValidationLogic = async (accountId, userId, fleetId) => {
        const fleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
        if (!fleets) {
            throw {
                errcode: 'USER_FLEET_NOT_FOUND',
            };
        }
        return fleets.includes(fleetId);
    };

    UserVehicleAccessLogic = async (accountId, userId, vinno) => {
        try {
            const userFleets = await this.serviceModSvcI.GetUserFleets(accountId, userId);
            if (!userFleets || userFleets.length === 0) {
                throw {
                    errcode: 'USER_FLEET_NOT_FOUND'
                };
            }
            const vehicleFleet = await this.serviceModSvcI.GetVehicleFleet(accountId, vinno);
            if (!vehicleFleet) {
                throw {
                    errcode: 'VEHICLE_FLEET_NOT_FOUND',
                };
            }
            return userFleets.includes(vehicleFleet);
        } catch (error) {
            throw error;
        }
    };

    //ADC calling apis
    GetMobileNumberLogic = async (vinno) => {
        const mobileData = await this.serviceModSvcI.GetMobileNumber(vinno);
        return mobileData[0]?.mobile || null;
    };

    //overview api
    GetRecursiveFleetsLogic = async (fleetId, cookie) => {
        try {
            const path = `/account/fleet/${fleetId}/subfleets?recursive=true`;
            const METHOD = 'GET';
            const fleets = await this.wrapperI.connectToFMSApi(path, {}, METHOD, cookie);
            return fleets;
        } catch (error) {
            throw error;
        }
    };

    //extra
    ServiceBookingStatus = {
        CANCELLED: 'Cancelled', // cancelled by user, appointmentBooking.bookingCancel != 'Confirmed'
        RO_OPEN: 'In Service', //appointmentBooking.bookingCancel == 'Confirmed', appointmentBooking.roBillDetail is not null and appointmentBooking.roBillDetail.status == 'open' || appointmentBooking.roBillDetail.status == 'closed' and appointmentBooking.roBillDetail.roBillNum is null and preinvoice api is success
        BOOKED: 'Booked', //create booking is success,  appointmentBooking.bookingCancel == 'Confirmed' and appointmentBooking.roBillDetail is null
        FAILED: 'Failed', //create booking is failed,  appointmentBooking.bookingCancel != 'Confirmed'
        OVERDUE: 'Overdue',
        COMPLETED: 'Completed', //appointmentBooking.roBillDetail.status == 'closed', appointmentBooking.roBillDetail.roBillNum is not null, email invoice api is success and ro bill date is more than 60 days
        RESCHEDULED: 'Rescheduled', //rescheduled by user, appointmentBooking.bookingCancel == 'Confirmed' and appointmentBooking.roBillDetail is not null and appointmentBooking.roBillDetail.status == 'open' || appointmentBooking.roBillDetail.status == 'closed' and appointmentBooking.roBillDetail.roBillNum is null and preinvoice api is success
    };

    ONBOARDING_STATUS = {
        PENDING: 'PENDING',
        COMPLETED: 'COMPLETED',
    };
    
    BATCH_SIZE = 100;

    GetMyServicePermsLogic = async (fleetid, moduleId, cookie, xplatform) => {
        try {
            const subscriptioncheckpath = `/subscription/details`;
            const subscriptioncheckmethod = 'GET';
            const subscriptioncheckresponse = await this.wrapperI.connectToFMSApi(subscriptioncheckpath, {}, subscriptioncheckmethod, cookie);
            const subscriptiondata = subscriptioncheckresponse.data;
            if(!subscriptiondata.ismobilefree){
                if ( !subscriptiondata.issubscribed || !subscriptiondata.modulecodes.includes('service')) {
                    throw {
                    errcode: "ACCOUNT_NOT_SUBSCRIBED",
                    errmsg: "Account is not subcribed for this Feature"
                    }
                }
            } else if( (xplatform !=='Nemo3-Android' && xplatform !=='Nemo3-iOS' && xplatform !=='iOS') && subscriptiondata.ismobilefree){
                if ( !subscriptiondata.issubscribed || !subscriptiondata.modulecodes.includes('service')) {
                    throw {
                    errcode: "ACCOUNT_NOT_SUBSCRIBED",
                    errmsg: "Account is not subcribed for this Feature"
                    }
                }
            }
            const path = `/account/fleet/${fleetid}/getmyperms`;
            const METHOD = 'GET';
            const myServicePerms = await this.wrapperI.connectToFMSApi(path, {}, METHOD, cookie);
            const permissionInfo = myServicePerms.data;
            const permList = permissionInfo.permissions
            if (permList.length === 0) {
                throw new Error("No permissions found");
            }
            const permissionByModule = permissionInfo.permissionsbymodule.find(module => module.moduleid === moduleId);
            if (!permissionByModule) {
                throw new Error("No permissions found");
            }
            return {
                ...permissionByModule
            }
        } catch (error) {
            if (error.errcode === "ACCOUNT_NOT_SUBSCRIBED") {
                throw {
                    errcode: "ACCOUNT_NOT_SUBSCRIBED",
                    errmsg: "Account is not subcribed for this Feature"
                }
            }
            throw {
                errcode: "PERMISSION_DENIED",
                errmsg: error?.errmsg || null
            };
        }
    }

    GetVehiclesListLogic = async (fleetId, isRecursive, cookie) => {
        try {
            const path = `/account/fleet/${fleetId}/vehicles?recursive=${isRecursive}`
            const METHOD = 'GET';
            const response = await this.wrapperI.connectToFMSApi(path, {}, METHOD, cookie);
            const vinnoList = response.data.map((vehicle) => vehicle.vinno);
            return vinnoList;
        } catch (error) {
            throw error;
        }
    }

    VehicleOnboardingStatusLogic = async (vinno) => {
        try {
            const result = await this.serviceModSvcI.GetVehicleOnboardingStatus(vinno);
            return result;
        } catch (error) {
            throw error;
        }
    };

    VehicleOnboardingHistoryLogic = async (vinno) => {
        try {
            const result = await this.serviceModSvcI.GetVehicleOnboardingHistory(vinno);
            return result;
        } catch (error) {
            throw error;
        }
    };
}
