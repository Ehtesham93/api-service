import {
    APIResponseInternalErr,
    APIResponseOK,
    APIResponseBadRequest,
} from "../../utils/responseutil.js";
import { AuthenticateAccountTokenFromCookie } from "../../utils/tokenutil.js";
import ServiceModHdlrImpl from "./servicemodhdlr_impl.js";
import { z } from "zod";

export default class ServiceModHdlr {
    constructor(serviceModSvcI, logger) {
        this.serviceModSvcI = serviceModSvcI;
        this.logger = logger;
        this.serviceModHdlrI = new ServiceModHdlrImpl(serviceModSvcI, logger);
    }

    // TODO: add permission check for each route
    // TODO: add request validation for each route
    RegisterRoutes(router) {
        router.post("/settoken", this.setToken);
        router.use(AuthenticateAccountTokenFromCookie);

        router.get("/overview", this.GetServiceOverview);
        router.get("/types", this.GetServiceTypes);
        router.get("/cancel/reasons", this.GetCancelReasons);
        router.post("/booking", this.CreateVehicleServiceBooking);
        router.put("/booking", this.ReschVehicleServiceBooking);
        router.post("/booking/cancel", this.CancelVehicleServiceBooking);
        router.post("/cost/estimate", this.GetVehicleServiceCostEstimate);
        router.get("/shedulejobtypes", this.GetSheduleJobTypes);

        // dealer
        router.post("/dealer/list/search", this.ListDealerSearch);
        router.post("/dealers", this.ListDealers);
        router.post("/dealer/slots", this.GetDealerSlots);
        router.post("/dealer/search/nearest", this.ListNearestDealersSearch);

        //SOS
        router.post("/sos/reasons", this.GetSOSReasons);
        router.post("/raise/sos", this.RaiseSOS);

        // vehicles
        router.get("/vehicles/list", this.GetVehiclesInService);
        router.get("/vehicle/history", this.GetVehicleServiceHistory);
        router.post("/vehicle/status", this.GetVehicleServiceStatus);
        router.post("/vehicle/onboarding", this.VehicleOnboarding);
        router.get("/vehicle/info", this.GetVehicleInfo);
        router.post("/vehicle/invoice", this.GetInvoice);
        router.get("/vehicle/external/info", this.GetExternalVehicleInfo);

        //Kilometers
        router.post("/kilometers", this.GetKilometers);
    }

    VehicleOnboarding = async (req, res, next) => {
        try {
            let userid = req.userid;
            let accountid = req.accountid;
            let vinno = req.body.vinno;
            let mobileno = req.body.mobileno
            let model = req.body.model;
            const schema = z.object({
                vinno: z.string().length(17, "Invalid VIN number must be 17 characters long"),
                mobileno: z.string().regex(/^(\+?[1-9]\d{7,14}|[0-9]{10})$/, "Invalid mobile number must be 10 digits long"),
                model: z.string({ message: "Invalid model parameter must be a string" }).optional()
            });
            schema.parse({ vinno, mobileno, model });
            let result = await this.serviceModHdlrI.VehicleOnboardingLogic(accountid, userid, vinno, mobileno, model);
            APIResponseOK(req, res, result, "Account vehicle onboarding completed successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "USER_VEHICLE_ONBOARDING_ERR", e?.toString(), e?.toString() || "Account vehicle onboarding failed.");
        }
    }

    GetServiceOverview = async (req, res, next) => {
        try {
            let accountid = req.accountid;
            let userid = req.userid;
            let isRecursive = req.query.isrecursive;
            let fleetid = req.query.fleetid;
            let startdate = req.query.startdate;
            const schema = z.object({
                isRecursive: z.string({ message: "Invalid isrecursive parameter, must be true or false" }),
                fleetid: z.uuid({ message: "Invalid fleetid parameter, must be a valid UUID" }),
                startdate: z.string({ message: "Invalid servicedwindow parameter, must be a valid date" }).optional()
            });
            schema.parse({ isRecursive, fleetid, startdate });
            const cookie = req.cookie;
            typeof isRecursive == "string" ? isRecursive = isRecursive == "true" : isRecursive = false;
            let result = await this.serviceModHdlrI.GetServiceOverviewLogic(accountid, userid, isRecursive, fleetid, cookie, startdate);
            APIResponseOK(req, res, result, "Service overview fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_SERVICE_OVERVIEW_ERR", e?.toString(), e?.toString() || "Unable to fetch service overview. please try again.");
        }
    }

    GetVehiclesInService = async (req, res, next) => {
        try {

            let accountid = req.accountid;
            let userid = req.userid;
            let fleetid = req.query.fleetid;
            let isRecursive = req.query.isrecursive;
            let tabid = req.query.tabid || 'all';
            let startdate = req.query.startdate;
            const schema = z.object({
                fleetid: z.uuid({ message: "Invalid fleetid parameter must be a valid UUID" }),
                isRecursive: z.string({ message: "Invalid isrecursive parameter must be true or false" }),
                tabid: z.string({ message: "Invalid tabid parameter must be a valid tabid" }).optional(),
                startdate: z.string({ message: "Invalid servicedwindow parameter must be a valid date" }).optional()
            });
            schema.parse({ fleetid, isRecursive, tabid, startdate });

            const cookie = req.cookie;

            typeof isRecursive == "string" ? isRecursive = isRecursive == "true" : isRecursive = false;
            let result = await this.serviceModHdlrI.GetVehiclesInServiceLogic(accountid, userid, isRecursive, fleetid, tabid, cookie, startdate);
            APIResponseOK(req, res, result, "Vehicles service fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_VEHICLES_IN_SERVICE_ERR", e?.toString(), e?.toString() || "Unable to fetch vehicles. please try again.");
        }
    }

    GetVehicleServiceHistory = async (req, res, next) => {
        try {

            let accountid = req.accountid;
            let userid = req.userid;
            let vinno = req.query.vinno;
            const schema = z.object({
                vinno: z.string().length(17, "Invalid VIN number must be 17 characters long")
            });
            schema.parse({ vinno });
            let result = await this.serviceModHdlrI.GetVehicleServiceHistoryLogic(accountid, userid, vinno);
            APIResponseOK(req, res, result, "Vehicle service history fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_VEHICLE_SERVICE_HISTORY_ERR", e?.toString(), e?.toString() || "Unable to fetch the vehicle service history. please try again.");
        }
    }

    GetVehicleServiceStatus = async (req, res, next) => {
        try {

            let accountid = req.accountid;
            let userid = req.userid;
            let vinno = req.body.vinno;
            let bookingid = req.body.bookingid;
            const schema = z.object({
                vinno: z.string().length(17, "Invalid VIN number must be 17 characters long"),
                bookingid: z.uuid({ message: "Invalid bookingid parameter must be a valid UUID" })
            });
            schema.parse({ vinno, bookingid });
            let result = await this.serviceModHdlrI.GetVehicleServiceStatusLogic(accountid, userid, vinno, bookingid);
            if (result?.error) {
                APIResponseOK(req, res, null, null, "No status updates.");
                return;
            }
            APIResponseOK(req, res, result, "Vehicle service status fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_VEHICLE_SERVICE_STATUS_ERR", e?.toString(), e?.toString() || "Unable to fetch the vehicle service status. please try again.");
        }
    }

    GetInvoice = async (req, res, next) => {
        try {
            let accountid = req.accountid;
            let userid = req.userid;
            let vinno = req.body.vinno;
            let robillnumber = req.body.robillnumber;
            let bookingid = req.body.bookingid;
            const schema = z.object({
                vinno: z.string({ message: "Invaild vin number, must be a string type" }).length(17, "Invalid VIN number must be 17 characters long"),
                robillnumber: z.string({ message: "Invalid robillnumber parameter must be a string" }),
                bookingid: z.uuid({ message: "Invalid bookingid parameter must be a valid UUID" })
            });
            schema.parse({ vinno, robillnumber, bookingid });
            let result = await this.serviceModHdlrI.GetInvoiceLogic(accountid, userid, vinno, robillnumber, bookingid);
            APIResponseOK(req, res, result, "Invoice fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_INVOICE_ERR", e?.toString(), e?.toString() || "Unable to fetch the invoice for the service. please try again.");
        }
    }


    GetServiceTypes = async (req, res, next) => {
        try {

            let accountid = req.accountid;
            let modelDesc = req.query.modelDesc || "TREO";
            const schema = z.object({
                modelDesc: z.string({ message: "Invalid modelDesc parameter must be a string" }).optional()
            });
            schema.parse({ modelDesc })
            let result = await this.serviceModHdlrI.GetServiceTypesLogic(accountid, modelDesc);
            APIResponseOK(req, res, result, "Service types fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
            }
            APIResponseInternalErr(req, res, "GET_SERVICE_TYPES_ERR", e?.toString(), e?.toString() || "Unable to fetch the service types. please try again.");
        }
    }

    CreateVehicleServiceBooking = async (req, res, next) => {
        try {

            let userid = req.userid;
            let accountid = req.accountid;
            const cookie = req.cookie;
            const { vinno, servicetype, kilometer, modeldisplayname, parentgroup, locationcode, dealername, dealeraddress, slot } = req.body;
            const schema = z.object({
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number must be 17 characters long"),
                servicetype: z.string({ message: "Invalid servicetype parameter, must be a string" }),
                kilometer: z.string({ message: "Invalid kilometer parameter, must be a string" }).optional(),
                modeldisplayname: z.string({ message: "Invalid modeldisplayname parameter, must be a string" }),
                parentgroup: z.string({ message: "Invalid parentgroup parameter, must be a string" }),
                locationcode: z.string({ message: "Invalid locationcode parameter, must be a string" }),
                dealername: z.string({ message: "Invalid dealername parameter, must be a string" }),
                dealeraddress: z.string({ message: "Invalid dealeraddress parameter, must be a string" }),
                slot: z.number({ message: "Invalid slot parameter, must be a number" }).int({ message: "Invalid slot parameter, must be integer" }).min(Date.now(), "Invalid slot parameter, must be greater than current date.")
            });
            schema.parse({ vinno, servicetype, kilometer, modeldisplayname, parentgroup, locationcode, dealername, dealeraddress, slot });
            let result = await this.serviceModHdlrI.CreateVehicleServiceBookingLogic(accountid,
                userid,
                vinno,
                servicetype,
                kilometer,
                modeldisplayname,
                parentgroup,
                locationcode,
                dealername,
                dealeraddress,
                slot,
                cookie);
            APIResponseOK(req, res, result, "Vehicle service booking created successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "CREATE_VEHICLE_SERVICE_BOOKING_ERR", e?.toString(), e?.toString(), "Unable to book a service for the vehicle.");
        }
    }

    GetCancelReasons = async (req, res, next) => {
        try {
            let result = await this.serviceModHdlrI.GetCancelReasonsLogic();
            APIResponseOK(req, res, result, "Cancel reasons fetched successfully");
        } catch (e) {
            APIResponseInternalErr(req, res, "GET_CANCEL_REASONS_ERR", e?.toString(), e?.toString() || "Unable to fetch the cancellation reasons. please try again.");
        }
    }

    CancelVehicleServiceBooking = async (req, res, next) => {
        try {

            let accountid = req.accountid;
            let userid = req.userid;
            let bookingid = req.body.bookingid;
            let reason = req.body.reason;
            let vinno = req.body.vinno;
            const schema = z.object({
                bookingid: z.uuid({ message: "Invalid bookingid parameter, must be a valid UUID" }),
                reason: z.string({ message: "Invalid reason parameter, must be a string" }),
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long")
            });
            schema.parse({ bookingid, reason, vinno });
            const cookie = req.cookie;
            let result = await this.serviceModHdlrI.CancelVehicleServiceBookingLogic(accountid, userid, bookingid, vinno, reason, cookie);
            APIResponseOK(req, res, result, "Vehicle service booking cancelled successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "CANCEL_VEHICLE_SERVICE_BOOKING_ERR", e?.toString(), e?.toString() || "Unable to cancel the booking for the vehicle. please try again.");
        }
    }

    GetVehicleServiceCostEstimate = async (req, res, next) => {
        try {

            let accountid = req.accountid;
            let userid = req.userid;
            let vinno = req.body.vinno;
            let selectedkm = req.body.selectedkm;
            let model = req.body.model || "TREO";
            const schema = z.object({
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long"),
                selectedkm: z.string({ message: "Invalid selectedkm parameter, must be a string" }),
                model: z.string({ message: "Invalid model parameter, must be a string" }).optional()
            });
            schema.parse({ vinno, selectedkm, model });
            let result = await this.serviceModHdlrI.GetVehicleServiceCostEstimateLogic(accountid, userid, vinno, selectedkm, model);
            APIResponseOK(req, res, result, "Vehicle service cost estimate fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_VEHICLE_SERVICE_COST_ESTIMATE_ERR", e?.toString(), e?.toString() || "Unable to fetch the cost estimate for the service. please try again.");
        }
    }

    ListDealers = async (req, res, next) => {
        try {
            const userid = req.userid;
            const accountid = req.accountid;
            const { vinno, latitude, longitude, modelDesc } = req.body;
            const schema = z.object({
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long"),
                latitude: z.number({ message: "Invalid latitude parameter, must be a number" }),
                longitude: z.number({ message: "Invalid longitude parameter, must be a number" }),
                modelDesc: z.string({ message: "Invalid modelDesc parameter, must be a string" }).optional()
            });
            schema.parse({ vinno, latitude, longitude, modelDesc });
            let result = await this.serviceModHdlrI.ListDealersLogic(accountid, userid, vinno, latitude, longitude, modelDesc || "TREO");
            APIResponseOK(req, res, result, "Dealers fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "LIST_DEALERS_ERR", e?.toString(), e?.toString() || "Unable to fetch the dealers list.");
        }
    }

    GetDealerSlots = async (req, res, next) => {
        try {
            const userid = req.userid;
            const accountid = req.accountid;
            const { vinno, parentCode, locationCode, date } = req.body;
            const schema = z.object({
                vinno: z.string().length(17, "Invalid VIN number, must be 17 characters long"),
                parentCode: z.string({ message: "Invalid parentCode parameter, must be a string" }),
                locationCode: z.string({ message: "Invalid locationCode parameter, must be a string" }),
                date: z.number({ message: "Invalid date parameter, must be a number" })
                    .int({ message: "Invalid date parameter, must be integer" })
                    .min(new Date(0).getTime(), "Invalid date parameter, must be greater than 01 Jan 1970.")
            });
            schema.parse({ vinno, parentCode, locationCode, date });
            let result = await this.serviceModHdlrI.GetDealerSlotsLogic(accountid, userid, vinno, parentCode, locationCode, date);
            APIResponseOK(req, res, result, "Dealer slots fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_DEALER_SLOTS_ERR", e?.toString(), e?.toString() || "Unable to fetch the dealer slots.");
        }
    }

    ListDealerSearch = async (req, res, next) => {
        try {

            const userid = req.userid;
            const accountid = req.accountid;
            const { vinno, modelDesc, itemIndex, pageSize, searchFilter } = req.body;
            const schema = z.object({
                vinno: z.string().length(17, "Invalid VIN number, must be 17 characters long"),
                modelDesc: z.string({ message: "Invalid modelDesc parameter, must be a string" }).optional(),
                itemIndex: z.number({ message: "Invalid itemIndex parameter, must be a number" }).optional(),
                pageSize: z.number({ message: "Invalid pageSize parameter, must be a number" }).optional(),
                searchFilter: z.string({ message: "Invalid searchFilter parameter, must be a string" }).optional()
            });
            schema.parse({ vinno, modelDesc, itemIndex, pageSize, searchFilter });
            let result = await this.serviceModHdlrI.ListDealerSearchLogic(accountid, userid, vinno, !modelDesc ? "TREO" : modelDesc, itemIndex, pageSize, searchFilter);
            APIResponseOK(req, res, result, "Dealer search fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        param: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "LIST_DEALER_SEARCH_ERR", e?.toString(), e?.toString() || "Unable to fetch the dealer list.");
        }
    }

    GetSOSReasons = async (req, res, next) => {
        try {

            const userid = req.userid;
            const accountid = req.accountid;
            const model = req.body.model;
            const vinno = req.body.vinno;
            const schema = z.object({
                model: z.string({ message: "Invalid model parameter, must be a string" }).optional(),
                vinno: z.string().length(17, "Invalid VIN number, must be 17 characters long")
            });
            schema.parse({ model, vinno });
            const cookie = req.cookie;
            let result = await this.serviceModHdlrI.GetSOSReasonsLogic(accountid, userid, vinno, model, cookie);
            APIResponseOK(req, res, result, "SOS reasons fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_SOS_REASONS_ERR", e?.toString(), e?.toString() || "Unable to fetch the SOS reasons. please try again.");
        }
    }

    RaiseSOS = async (req, res, next) => {
        try {

            const accountid = req.accountid;
            const userid = req.userid;
            let sosinfo = req.body;
            const { name, vinno, issue, latitude, longitude, description } = sosinfo;

            const schema = z.object({
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long"),
                issue: z.array(z.string({ message: "Invalid issue parameter, must be a string" })).min(1, "Issue must be an array of at least 1 string"),
                latitude: z.number({ message: "Invalid latitude parameter, must be a number" }),
                longitude: z.number({ message: "Invalid longitude parameter, must be a number" }),
                description: z.string({ message: "Invalid description parameter, must be a string" })
            });
            schema.parse({ vinno, issue, latitude, longitude, description });

            const result = await this.serviceModHdlrI.RaiseSOSLogic(accountid, userid, sosinfo);
            APIResponseOK(req, res, result, "SOS raised successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "RAISE_SOS_ERR", e?.toString(), e?.toString() || "Unable to raise the SOS for the vehicle. please try again.");
        }
    }

    GetVehicleInfo = async (req, res, next) => {
        try {
            const cookie = req.cookie;
            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.query.vinno;
            const schema = z.object({
                vinno: z.string({ message: "Invalid VIN number parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long")
            })
            schema.parse({ vinno });
            const result = await this.serviceModHdlrI.GetVehicleInfoLogic(accountid, userid, vinno, cookie);
            APIResponseOK(req, res, result, "Vehicle details fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }), "Invalid request body");
                return;
            }
            APIResponseInternalErr(req, res, "GET_VEHICLE_DETAILS_ERR", e?.toString(), e?.toString() || "Unable to fetch the vehicle details. please try again.");
        }
    }

    GetSheduleJobTypes = async (req, res, next) => {
        try {

            const accountid = req.accountid;
            const modelDesc = req.query.modelDesc || "TREO";
            const schema = z.object({
                modelDesc: z.string({ message: "Invalid modelDesc parameter, must be a string" }).optional()
            });
            schema.parse({ modelDesc });
            const result = await this.serviceModHdlrI.GetSheduleJobTypesLogic(accountid, modelDesc);
            APIResponseOK(req, res, result, "Shedule job types fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_PARAMS", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_SHEDULE_JOB_TYPES_ERR", e?.toString(), e?.toString() || "Unable to fetch the shedule job types. please try again.");
        }
    }

    ReschVehicleServiceBooking = async (req, res, next) => {
        try {

            let accountid = req.accountid;
            let userid = req.userid;
            let vinno = req.body.vinno;
            let oldBookingId = req.body.oldbookingid;
            let newServiceType = req.body.newservicetype;
            let newKilometer = req.body.newkilometer;
            let modelDisplayName = req.body.modeldisplayname;
            let newParentGroup = req.body.newparentgroup;
            let newLocationCode = req.body.newlocationcode;
            let newDealerName = req.body.newdealername;
            let newDealerAddress = req.body.newdealeraddress;
            let newSlot = req.body.newslot;
            const schema = z.object({
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long"),
                oldBookingId: z.uuid({ message: "Invalid oldBookingId parameter, must be a valid UUID" }),
                newServiceType: z.string({ message: "Invalid newServiceType parameter, must be a string" }),
                newKilometer: z.string({ message: "Invalid newKilometer parameter, must be a string" }).optional(),
                modelDisplayName: z.string({ message: "Invalid modelDisplayName parameter, must be a string" }),
                newParentGroup: z.string({ message: "Invalid newParentGroup parameter, must be a string" }),
                newLocationCode: z.string({ message: "Invalid newLocationCode parameter, must be a string" }),
                newDealerName: z.string({ message: "Invalid newDealerName parameter, must be a string" }),
                newDealerAddress: z.string({ message: "Invalid newDealerAddress parameter, must be a string" }),
                newSlot: z.number({ message: "Invalid newSlot parameter, must be a number" }).int({ message: "Invalid newSlot parameter, must be integer" }).min(Date.now(), "Invalid newSlot parameter, must be greater than current date.")
            });
            schema.parse({ vinno, oldBookingId, newServiceType, newKilometer, modelDisplayName, newParentGroup, newLocationCode, newDealerName, newDealerAddress, newSlot });
            const cookie = req.cookie;
            let result = await this.serviceModHdlrI.ReschVehicleServiceBookingLogic(accountid, userid, vinno, oldBookingId, newServiceType, newKilometer, modelDisplayName, newParentGroup, newLocationCode, newDealerName, newDealerAddress, newSlot, cookie);
            APIResponseOK(req, res, result, "Vehicle service booking rescheduled successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "RESCH_VEHICLE_SERVICE_BOOKING_ERR", e?.toString(), e?.toString() || "Unable to reschedule the vehicle service booking. please try again.");
        }
    }

    // Helper method to get request ID for external use
    GetRequestId() {
        return this.serviceModHdlrI.getRequestId();
    }

    GetKilometers = async (req, res, next) => {
        try {

            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.body.vinno;
            const schema = z.object({
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long")
            });
            schema.parse({ vinno });
            const result = await this.serviceModHdlrI.GetKilometersLogic(accountid, userid, vinno);
            APIResponseOK(req, res, result, "Kilometers fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_KILOMETERS_ERR", e?.toString(), e?.toString() || "Unable to fetch the kilometers list. please try again.");
        }
    }

    ListNearestDealersSearch = async (req, res, next) => {
        try {

            const accountid = req.accountid;
            const userid = req.userid;
            const body = req.body;
            const { modelgroupdesc, searchfilter, dealertype, latitude, longitude } = req.body;
            const schema = z.object({
                modelgroupdesc: z.string({ message: "Invalid modelgroupdesc parameter, must be a string" }).optional(),
                searchfilter: z.string({ message: "Invalid searchfilter parameter, must be a string" }).optional(),
                dealertype: z.string({ message: "Invalid dealertype parameter, must be a string" }).optional(),
                latitude: z.number({ message: "Invalid latitude parameter, must be a number" }),
                longitude: z.number({ message: "Invalid longitude parameter, must be a number" })
            });
            schema.parse({ modelgroupdesc, searchfilter, dealertype, latitude, longitude });

            const result = await this.serviceModHdlrI.ListNearestDealersSearchLogic(accountid, userid, body);
            APIResponseOK(req, res, result, "Nearest dealers fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "LIST_NEAREST_DEALERS_SEARCH_ERR", e?.toString(), e?.toString() || "Unable to fetch the nearest dealers list. please try again.");
        }
    }
    
    setToken = async (req, res, next) => {
        try {
            let token = req.body.token;
            const schema = z.object({
                token: z.string({ message: "token is required" })
                .nonempty({ message: "token cannot be empty" })
            });
            schema.parse({ token });
            const cookieOptions = {
                httpOnly: false, 
                secure: false,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 
            };
            res.cookie('token', token, cookieOptions);
            APIResponseOK(req, res, { 
                message: "Token set successfully in cookie",
                cookieSet: true,
                swaggerReady: true
            }, "Token set in cookie successful");
        } catch (error) {
            if (error.errcode === "INPUT_ERROR") {
                APIResponseBadRequest(
                    req,
                    res,
                    error.errcode,
                    error.errdata,
                    error.message
                );
            } else {
                APIResponseInternalErr(
                    req,
                    res,
                    "SET_TOKEN_ERR",
                    error.toString(),
                    "Set token failed"
                );
            }
        }
    };

    GetExternalVehicleInfo = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.query.vinno;
            const schema = z.object({
                vinno: z.string({ message: "Invalid vinno parameter, must be a string" }).length(17, "Invalid VIN number, must be 17 characters long")
            });
            schema.parse({ vinno });
            const result = await this.serviceModHdlrI.GetExternalVehicleInfoLogic(accountid, userid, vinno);
            APIResponseOK(req, res, result, "External vehicle info fetched successfully");
        } catch (e) {
            if (e instanceof z.ZodError) {
                APIResponseBadRequest(req, res, "INVALID_REQUEST_BODY", e.issues.map(issue => {
                    return {
                        field: issue.path[0],
                        message: issue.message,
                        expected: issue.expected
                    }
                }));
                return;
            }
            APIResponseInternalErr(req, res, "GET_EXTERNAL_VEHICLE_INFO_ERR", e?.toString(), e?.toString() || "Unable to fetch the vehicle info. please try again.");
        }
    }
}
