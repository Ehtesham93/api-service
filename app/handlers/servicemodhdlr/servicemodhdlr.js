import { z } from 'zod';
import { APIResponseOK, APIResponseBadRequest, APIResponseInternalErr } from '../../utils/responseutil.js';
import { AuthenticateAccountTokenFromCookie } from '../../utils/tokenutil.js';
import ServiceModHdlrImpl from './servicemodhdlr_impl.js';
import { userFriendlyError, convertEpochToIST,  getADCModel } from '../../utils/util.js';

export default class ServiceModHdlr {
    constructor(serviceModSvcI, wrapperI, logger, config) {
        this.serviceModSvcI = serviceModSvcI;
        this.logger = logger;
        this.serviceModHdlrI = new ServiceModHdlrImpl(serviceModSvcI, wrapperI, logger, config);
    }

    // TODO: add permission check for each route
    // TODO: add request validation for each route
    RegisterRoutes(router) {
        // Public routes (no authentication required)
        router.post('/settoken', this.setToken);
        //vehicle onboarding - allows vehicles to be onboarded to the service system
        router.post('/vehicle/onboarding', this.VehicleOnboarding);

        // Apply authentication middleware to all routes below this point
        router.use(AuthenticateAccountTokenFromCookie);

        //overview routes - provide service overview and vehicle listings
        router.get('/overview', this.GetServiceOverview);
        router.get('/vehicles/list', this.GetVehiclesInService);

        //booking routes - handle service booking operations
        router.get('/types', this.GetServiceTypes);
        router.post('/dealers', this.ListDealers);
        router.post('/dealer/slots', this.GetDealerSlots);
        router.post('/booking', this.CreateVehicleServiceBooking);
        router.post('/vehicle/status', this.GetVehicleServiceStatus);
        router.put('/booking', this.ReschVehicleServiceBooking);
        router.get('/cancel/reasons', this.GetCancelReasons);
        router.post('/booking/cancel', this.CancelVehicleServiceBooking);

        // vehicles routes - handle vehicle information and history
        router.get('/vehicle/history', this.GetVehicleServiceHistory);
        router.get('/vehicle/info', this.GetVehicleInfo);
        router.post('/vehicle/invoice', this.GetInvoice);
        router.get('/vehicle/external/info', this.GetExternalVehicleInfo);

        // dealer routes - handle dealer search and listing
        router.post('/dealer/list/search', this.ListDealerSearch);
        router.post('/dealer/search/nearest', this.ListNearestDealersSearch);

        //SOS routes - handle emergency service operations
        router.post('/sos/reasons', this.GetSoSDetails);
        router.post('/raise/sos', this.RaiseSOS);

        //not used - legacy route for kilometers
        router.post('/kilometers', this.GetKilometers);
    }

    // Handler for setting authentication token in cookie
    setToken = async (req, res, next) => {
        try {
            const token = req.body.token;
            // Define validation schema for token input
            const schema = z.object({
                token: z.string({ message: 'token is required' }).nonempty({ message: 'token cannot be empty' }),
            });
            // Validate input against schema
            schema.parse({ token });
            // Configure cookie options for token storage
            const cookieOptions = {
                httpOnly: false,
                secure: false,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
            };
            // Set token in response cookie
            res.cookie('token', token, cookieOptions);
            // Send success response
            APIResponseOK(
                req,
                res,
                {
                    message: 'Token set successfully in cookie',
                    cookieSet: true,
                    swaggerReady: true,
                },
                'Token set in cookie successful'
            );
        } catch (error) {
            // Handle validation errors
            if (error.errcode === 'INPUT_ERROR') {
                APIResponseBadRequest(req, res, error.errcode, error.errdata, error.message);
            } else {
                // Handle other errors
                APIResponseInternalErr(req, res, 'SET_TOKEN_ERR', error.toString(), 'Set token failed');
            }
        }
    };

    // Handler for vehicle onboarding to the service system
    VehicleOnboarding = async (req, res, next) => {
        try {
            const { vinno, mobileno } = req.body;
            // Define validation schema for vehicle onboarding input
            const schema = z.object({
                vinno: z
                    .string({ message: 'Invalid vinno parameter, must be a string' })
                    .length(17, 'Invalid VIN number must be 17 characters long')
                    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                mobileno: z
                    .string({ message: 'Invalid mobileno parameter, must be a string' })
                    .regex(/^(\+?[1-9]\d{7,14}|[6789]\d{9})$/, 'Invalid mobile number must be 10 digits long and start with 6, 7, 8, or 9'),
            });
            // Validate input against schema
            this.validateAllInputs(schema, { vinno, mobileno });
            // Call service layer to process vehicle onboarding
            const result = await this.serviceModHdlrI.VehicleOnboardingLogic(vinno, mobileno);
            APIResponseOK(req, res, "vehicle onboarding request submitted successfully", result);
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetServiceOverview = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const cookie = req.cookie;

            if (req.query.startdate && typeof req.query.startdate === 'string') {
                req.query.startdate = Number(req.query.startdate);
            }

            const schema = z.object({
                recursive: z.enum(['true', 'false'], { message: 'Invalid recursive parameter, must be true or false' }),
                fleetid: z.uuid({ message: 'Invalid fleetid parameter, must be a valid UUID' }),
                startdate: z
                    .number({ message: 'Invalid startdate parameter, must be a number' })
                    .min(new Date(0).getTime(), { message: 'Invalid startdate parameter, must be more than jan 1st 1970' })
                    .max(Date.now(), { message: 'Invalid startdate parameter, cannot be more than current timestamp' })
                    .optional(),
            });
            this.validateAllInputs(schema, req.query);
            const { recursive, fleetid, startdate } = req.query;
            const recursiveBool = recursive === 'true';

            const result = await this.serviceModHdlrI.GetServiceOverviewLogic(accountid, fleetid, userid, recursiveBool, cookie, startdate);
            APIResponseOK(req, res, result, 'Service overview fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    TabType = {
        ALL: 'all',
        OVERDUE: 'overdue',
        BOOKED: 'booked',
        INSERVICE: 'inservice',
        SERVICED: 'serviced',
    };

    GetVehiclesInService = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const cookie = req.cookie;

            if (req.query.startdate && typeof req.query.startdate === 'string') {
                req.query.startdate = Number(req.query.startdate);
            }

            const schema = z.object({
                recursive: z.enum(['true', 'false'], { message: 'Invalid recursive parameter, must be true or false' }),
                fleetid: z.uuid({ message: 'Invalid fleetid parameter, must be a valid UUID' }),
                tabid: z
                    .enum([this.TabType.ALL, this.TabType.OVERDUE, this.TabType.BOOKED, this.TabType.INSERVICE, this.TabType.SERVICED], { message: 'Invalid tabid parameter, must be a valid tabid' })
                    .optional(),
                startdate: z
                    .number({ message: 'Invalid startdate parameter, must be a number' })
                    .min(new Date(0).getTime(), { message: 'Invalid startdate parameter, must be more than jan 1st 1970' })
                    .max(Date.now(), { message: 'Invalid startdate parameter, cannot be more than current timestamp' })
                    .optional(),
            });
            this.validateAllInputs(schema, req.query);

            const { recursive, fleetid, tabid, startdate } = req.query;
            const recursiveBool = recursive === 'true';
            const result = await this.serviceModHdlrI.GetVehiclesInServiceLogic(accountid, fleetid, userid, recursiveBool, tabid, cookie, startdate);
            APIResponseOK(req, res, result, 'Vehicles service fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetServiceTypes = async (req, res, next) => {
        try {
            const result = await this.serviceModHdlrI.GetServiceTypesLogic();
            APIResponseOK(req, res, result, 'Service types fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListDealers = async (req, res, next) => {
        try {
            const userid = req.userid;
            const accountid = req.accountid;
            const { vinno, latitude, longitude, modeldisplayname } = req.body;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                    .string({ message: 'Invalid vinno parameter, must be a string' })
                    .length(17, { message: 'Invalid VIN number, must be 17 characters long' })
                    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                latitude: z
                    .number({ message: 'Invalid latitude parameter, must be a number' })
                    .refine((lat) => lat >= -90 && lat <= 90 && lat !== 0, { message: 'Invalid latitude: must be between -90 and 90 degrees and cannot be 0' }),
                longitude: z
                    .number({ message: 'Invalid longitude parameter, must be a number' })
                    .refine((lng) => lng >= -180 && lng <= 180 && lng !== 0, { message: 'Invalid longitude: must be between -180 and 180 degrees and cannot be 0' }),
                modeldisplayname: z.string({ message: 'Invalid modeldisplayname parameter, must be a string' }),
            });
            this.validateAllInputs(schema, req.body);
            const modeldesc = getADCModel(modeldisplayname);
            // if (!modeldesc) {
            //     throw {
            //         errcode: "NO_DEALER_FOUND"
            //     }
            // }
            const result = await this.serviceModHdlrI.ListDealersLogic(accountid, userid, vinno, latitude, longitude, modeldesc, cookie);
            APIResponseOK(req, res, result, 'Dealers fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetDealerSlots = async (req, res, next) => {
        try {
            const userid = req.userid;
            const accountid = req.accountid;
            const cookie = req.cookie;
            const { vinno, date } = req.body;
            const schema = z.object({
                vinno: z
                    .string({ message: 'Invalid vinno parameter, must be a string' })
                    .length(17, { message: 'Invalid VIN number, must be 17 characters long' })
                    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                date: z
                    .number({ message: 'Invalid date parameter, must be a integer' })
                    .min(Date.now(), { message: 'Invalid date parameter, must be greater than current date.' })
                    .refine(
                        (timestamp) => {
                            const istDate = convertEpochToIST(timestamp);
                            return istDate.includes('00:00:00');
                        },
                        { message: 'Invalid date parameter, must be 00:00:00 (midnight) for the given day in Asia/Kolkata timezone' }
                    ),
            });
            this.validateAllInputs(schema, req.body);
            const result = await this.serviceModHdlrI.GetDealerSlotsLogic(accountid, userid, vinno, date, cookie);
            APIResponseOK(req, res, result, 'Dealer slots fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    CreateVehicleServiceBooking = async (req, res, next) => {
        try {
            const userid = req.userid;
            const accountid = req.accountid;
            const cookie = req.cookie;

            const schema = z.object({
                vinno: z
                    .string({ message: 'Invalid vinno parameter, must be a string' })
                    .length(17, { message: 'Invalid vinno, must be 17 characters long' })
                    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                servicetype: z.enum([this.ServiceType.ACCIDENTAL, this.ServiceType.REPAIR, this.ServiceType.SCHEDULED], { message: 'Invalid servicetype parameter, must be a string' }),
                kilometer: z.string({ message: 'Invalid kilometer parameter, must be a string' }).optional(),
                parentgroup: z
                    .string({ message: 'Invalid parentgroup parameter, must be a string' })
                    .max(50, { message: 'Invalid parentgroup, must be less than 50 characters' })
                    .min(1, { message: 'Invalid parentgroup, must be greater than 0' }),
                locationcode: z
                    .string({ message: 'Invalid locationcode parameter, must be a string' })
                    .max(50, { message: 'Invalid locationcode, must be less than 50 characters' })
                    .min(1, { message: 'Invalid locationcode, must be greater than 0' }),
                dealername: z
                    .string({ message: 'Invalid dealername parameter, must be a string' })
                    .max(100, { message: 'Invalid dealername, must be less than 255 characters' })
                    .min(1, { message: 'Invalid dealername, must be greater than 0' }),
                dealeraddress: z
                    .string({ message: 'Invalid dealeraddress parameter, must be a string' })
                    .max(255, { message: 'Invalid dealeraddress, must be less than 255 characters' })
                    .min(1, { message: 'Invalid dealeraddress, must be greater than 0' }),
                slot: z
                    .number({ message: 'Invalid slot parameter, must be a number' })
                    .int({ message: 'Invalid slot parameter, must be integer' })
                    .min(Date.now(), { message: 'Invalid slot parameter, must be greater than current date.' }),
            });
            this.validateAllInputs(schema, req.body);

            const { vinno, servicetype, kilometer, parentgroup, locationcode, dealername, dealeraddress, slot } = req.body;
            const result = await this.serviceModHdlrI.CreateVehicleServiceBookingLogic(
                accountid,
                userid,
                vinno,
                servicetype,
                kilometer,
                parentgroup,
                locationcode,
                dealername,
                dealeraddress,
                slot,
                cookie
            );
            APIResponseOK(req, res, result, 'Vehicle service booking created successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetVehicleServiceStatus = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.body.vinno;
            const bookingid = req.body.bookingid;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                    .string({ message: 'Invalid VIN number parameter, must be a string' })
                    .length(17, 'Invalid VIN number, must be 17 characters long')
                    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                bookingid: z.uuid({ message: 'Invalid bookingid parameter must be a valid UUID' }),
            });
            this.validateAllInputs(schema, req.body);
            const result = await this.serviceModHdlrI.GetVehicleServiceStatusLogic(accountid, userid, vinno, bookingid, cookie);
            APIResponseOK(req, res, result.data, result.msg);
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ReschVehicleServiceBooking = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const schema = z.object({
                vinno: z
                    .string({ message: 'Invalid vinno parameter, must be a string' })
                    .length(17, { message: 'Invalid vinno, must be 17 characters long' })
                    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                oldbookingid: z.uuid({ message: 'Invalid oldbookingid parameter, must be a valid UUID' }),
                newservicetype: z.enum([this.ServiceType.ACCIDENTAL, this.ServiceType.REPAIR, this.ServiceType.SCHEDULED], { message: 'Invalid servicetype parameter, must be a string' }),
                newkilometer: z.string({ message: 'Invalid kilometer parameter, must be a string' }).optional(),
                newparentgroup: z
                    .string({ message: 'Invalid parentgroup parameter, must be a string' })
                    .max(50, { message: 'Invalid parentgroup, must be less than 50 characters' })
                    .min(1, { message: 'Invalid parentgroup, must be greater than 0' }),
                newlocationcode: z
                    .string({ message: 'Invalid locationcode parameter, must be a string' })
                    .max(50, { message: 'Invalid locationcode, must be less than 50 characters' })
                    .min(1, { message: 'Invalid locationcode, must be greater than 0' }),
                newdealername: z
                    .string({ message: 'Invalid dealername parameter, must be a string' })
                    .max(100, { message: 'Invalid dealername, must be less than 255 characters' })
                    .min(1, { message: 'Invalid dealername, must be greater than 0' }),
                newdealeraddress: z
                    .string({ message: 'Invalid dealeraddress parameter, must be a string' })
                    .max(255, { message: 'Invalid dealeraddress, must be less than 255 characters' })
                    .min(1, { message: 'Invalid dealeraddress, must be greater than 0' }),
                newslot: z
                    .number({ message: 'Invalid slot parameter, must be a number' })
                    .int({ message: 'Invalid slot parameter, must be integer' })
                    .min(Date.now(), { message: 'Invalid slot parameter, must be greater than current date.' }),
            });
            this.validateAllInputs(schema, req.body);
            const { vinno, oldbookingid, newservicetype, newkilometer, newparentgroup, newlocationcode, newdealername, newdealeraddress, newslot } = req.body;
            const cookie = req.cookie;
            const result = await this.serviceModHdlrI.ReschVehicleServiceBookingLogic(
                accountid,
                userid,
                vinno,
                oldbookingid,
                newservicetype,
                newkilometer,
                newparentgroup,
                newlocationcode,
                newdealername,
                newdealeraddress,
                newslot,
                cookie
            );
            APIResponseOK(req, res, result, 'Vehicle service booking rescheduled successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetCancelReasons = async (req, res, next) => {
        try {
            const result = await this.serviceModHdlrI.GetCancelReasonsLogic();
            APIResponseOK(req, res, result, 'Cancel reasons fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    CancelVehicleServiceBooking = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const schema = z.object({
                bookingid: z.uuid({ message: 'Invalid bookingid parameter, must be a valid UUID' }),
                reason: z.string({ message: 'Invalid reason parameter, must be a string' }).regex(/^[a-zA-Z\s]+$/, { message: 'Invalid reason, must contain only letters' }),
                vinno: z
                    .string({ message: 'Invalid vinno parameter, must be a string' })
                    .length(17, { message: 'Invalid vinno, must be 17 characters long' })
                    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
            });
            this.validateAllInputs(schema, req.body);
            const { bookingid, reason, vinno } = req.body;
            const cookie = req.cookie;
            const result = await this.serviceModHdlrI.CancelVehicleServiceBookingLogic(accountid, userid, bookingid, vinno, reason, cookie);
            APIResponseOK(req, res, result, 'Vehicle service booking cancelled successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetVehicleServiceHistory = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.query.vinno;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invalid vinno parameter, must be a string' })
                .length(17, 'Invalid VIN number must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
            });
            this.validateAllInputs(schema, req.query);
            const result = await this.serviceModHdlrI.GetVehicleServiceHistoryLogic(accountid, userid, vinno, cookie);
            APIResponseOK(req, res, result, 'Vehicle service history fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetVehicleInfo = async (req, res, next) => {
        try {
            const cookie = req.cookie;
            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.query.vinno;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invalid VIN number parameter, must be a string' })
                .length(17, 'Invalid VIN number, must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
            });
            this.validateAllInputs(schema, req.query);
            const result = await this.serviceModHdlrI.GetVehicleInfoLogic(accountid, userid, vinno, cookie);
            APIResponseOK(req, res, result, 'Vehicle details fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetInvoice = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.body.vinno;
            const bookingid = req.body.bookingid;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invaild vin number, must be a string type' })
                .length(17, 'Invalid VIN number must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                bookingid: z.uuid({ message: 'Invalid bookingid parameter must be a valid UUID' }),
            });
            this.validateAllInputs(schema, req.body);
            const result = await this.serviceModHdlrI.GetInvoiceLogic(accountid, userid, vinno, bookingid, cookie);
            APIResponseOK(req, res, result, 'Invoice fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetExternalVehicleInfo = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const vinno = req.query.vinno;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invalid vinno parameter, must be a string' })
                .length(17, 'Invalid VIN number, must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
            });
            this.validateAllInputs(schema, req.query);
            const result = await this.serviceModHdlrI.GetExternalVehicleInfoLogic(accountid, userid, vinno, cookie);
            APIResponseOK(req, res, result, 'External vehicle info fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListDealerSearch = async (req, res, next) => {
        try {
            const userid = req.userid;
            const accountid = req.accountid;
            const { vinno } = req.body;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invalid vinno parameter, must be a string' })
                .length(17, 'Invalid VIN number, must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
            });
            this.validateAllInputs(schema, req.body);
            const result = await this.serviceModHdlrI.ListDealerSearchLogic(accountid, userid, vinno, 'TREO', 0, 30, ' ');
            APIResponseOK(req, res, result, 'Dealer search fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListNearestDealersSearch = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const latitude = req.body.latitude;
            const longitude = req.body.longitude;
            const schema = z.object({
                latitude: z
                    .number({ message: 'Invalid latitude parameter, must be a number' })
                    .refine((lat) => lat >= -90 && lat <= 90 && lat !== 0, { message: 'Invalid latitude: must be between -90 and 90 degrees and cannot be 0' }),
                longitude: z
                    .number({ message: 'Invalid longitude parameter, must be a number' })
                    .refine((lng) => lng >= -180 && lng <= 180 && lng !== 0, { message: 'Invalid longitude: must be between -180 and 180 degrees and cannot be 0' }),
            });
            this.validateAllInputs(schema, req.body);
            const result = await this.serviceModHdlrI.ListNearestDealersSearchLogic(accountid, userid, latitude, longitude);
            APIResponseOK(req, res, result, 'Nearest dealers fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetSoSDetails = async (req, res, next) => {
        try {
            const userid = req.userid;
            const accountid = req.accountid;
            const vinno = req.body.vinno;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invalid vinno parameter, must be a string' })
                .length(17, 'Invalid VIN number, must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
            });
            this.validateAllInputs(schema, req.body);
            const result = await this.serviceModHdlrI.GetSoSDetailsLogic(accountid, userid, vinno, cookie);
            APIResponseOK(req, res, result, 'SOS reasons fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    RaiseSOS = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const sosinfo = req.body;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invalid vinno parameter, must be a string' })
                .length(17, 'Invalid VIN number, must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
                issue: z
                    .array(z.string({ message: 'Invalid issue parameter, must be a string' }))
                    .max(1, { message: 'Invalid issue, must be an array of at most 1 string' })
                    .min(1, 'Issue must be an array of at least 1 string'),
                latitude: z
                    .number({ message: 'Invalid latitude parameter, must be a number' })
                    .refine((lat) => lat >= -90 && lat <= 90 && lat !== 0, { message: 'Invalid latitude: must be between -90 and 90 degrees and cannot be 0' }),
                longitude: z
                    .number({ message: 'Invalid longitude parameter, must be a number' })
                    .refine((lng) => lng >= -180 && lng <= 180 && lng !== 0, { message: 'Invalid longitude: must be between -180 and 180 degrees and cannot be 0' }),
            });
            this.validateAllInputs(schema, sosinfo);
            const result = await this.serviceModHdlrI.RaiseSOSLogic(accountid, userid, sosinfo, cookie);
            APIResponseOK(req, res, result, 'SOS raised successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetKilometers = async (req, res, next) => {
        try {
            const accountid = req.accountid;
            const userid = req.userid;
            const cookie = req.cookie;
            const schema = z.object({
                vinno: z
                .string({ message: 'Invalid vinno parameter, must be a string' })
                .length(17, 'Invalid VIN number, must be 17 characters long')
                .regex(/^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/, "VIN must contain only letters, numbers, and spaces, and must not start or end with a space"),
            });
            this.validateAllInputs(schema, req.body);
            const vinno = req.body.vinno;
            const result = await this.serviceModHdlrI.GetKilometersLogic(accountid, userid, vinno, cookie);
            APIResponseOK(req, res, result, 'Kilometers fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    //middlewares
    // Utility method to validate input data against Zod schema
    validateAllInputs = (schema, data) => {
        try {
            // Parse and validate data against schema
            return schema.parse(data);
        } catch (error) {
            // Handle Zod validation errors
            if (error.issues && Array.isArray(error.issues)) {
                // Map validation issues to standardized error format
                const allErrors = error.issues.map((err) => {
                    let field = 'root';
                    if (err.path.length > 0) {
                        // Find the last string key in the path
                        const lastKey = err.path
                            .slice()
                            .reverse()
                            .find((p) => typeof p === 'string');
                        field = lastKey || err.path.join('.');
                    }

                    return {
                        field: field,
                        errorCode: err.code,
                        message: err.message,
                    };
                });

                // Format error message based on number of errors
                let message;
                if (allErrors.length === 1) {
                    message = allErrors[0].message;
                } else if (allErrors.length <= 3) {
                    const errorMessages = allErrors.map((err) => err.message);
                    message = errorMessages.join(', ');
                } else {
                    message = `Please fix ${allErrors.length} validation errors and try again.`;
                }

                // Throw standardized input error
                throw {
                    errcode: 'INPUT_ERROR',
                    errmsg: message,
                };
            }
            // Throw generic Zod error for non-validation issues
            throw {
                errcode: 'ZOD_UTILIZATION_ERROR',
                errmsg: error.toString(),
            };
        }
    };

    // Utility method to handle errors and send appropriate responses
    handleError = (req, res, error) => {
        // Handle input validation errors with bad request response
        if (error.errcode === 'INPUT_ERROR' || error.errcode === 'ZOD_UTILIZATION_ERROR') {
            return APIResponseBadRequest(req, res, error.errcode, null, error.errmsg);
        }
        // Get user-friendly error response configuration
        const { code, message, ResponseFn } = userFriendlyError(error.errcode);
        // Handle specific user info not found error with custom message
        if (error.errmsg === 'User info not found') {
            return ResponseFn(req, res, code, null, 'We are facing issue with the following vehicle. Please try again after sometime.');
        }
        // Send error response with error message or default message
        return ResponseFn(req, res, code, null, error.errmsg || message);
    };

    //extra
    // Service type constants for different types of vehicle services
    ServiceType = {
        REPAIR: 'repair_lmm_cv',
        ACCIDENTAL: 'accidental_lmm_cv',
        SCHEDULED: 'scheduled_lmm_cv',
    };
}
