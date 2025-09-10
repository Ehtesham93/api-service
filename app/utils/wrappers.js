import axios from 'axios';

export default class Wrapper {
    constructor(pgPoolI, config, logger) {
        this.pgPoolI = pgPoolI;
        this.config = config;
        this.logger = logger;
        axios.defaults.timeout = this.config.timeout.axiostimeout;
    }

    validateVinno(vinno) {
        if (typeof vinno !== 'string' || vinno.length !== 17) {
            throw new Error('vinno missing/required');
        }
    }

    validateBody(body, requiredFields) {
        if (Object.keys(body).length !== requiredFields.length || !requiredFields.every((key) => Object.keys(body).includes(key))) {
            throw new Error('invalid/missing parameters');
        }
    }

    handleError(error) {
        throw {
            errcode: error?.response?.data?.err?.errcode || error?.response?.data?.message || error?.response?.data?.data?.message || 'INTERNAL_SERVER_ERROR',
            errmsg: error?.response?.data?.exp || error?.response?.data?.msg || error?.response?.data?.data?.message || null
        };
    }

    async getAuthToken(vinno, body) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['muserid']);
            const path = '/user/v2/auth/token';
            const METHOD = 'POST';
            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token: null }, { userId: body.muserid }, null);
            const token = response?.data?.authToken || null;
            if (!token) {
                this.logger.error('Mahindra Auth Token is missing');
                throw {
                    errcode: 'INTERNAL_SERVER_ERROR'
                }
            }
            return token;
        } catch (error) {
            this.logger.error('Error in getAuthToken', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || 'We are facing issue with the following vehicle . Please try again after sometime.'
            };
        }
    }

    async onboardExternalUser(vinno, body) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['userId', 'mobileNumber', 'flow', 'isWhatsAppConsented', 'registrationNumber', 'chassisNumber', 'modelGroup', 'modelDescription']);

            const path = '/user/v2/auth/external';
            const METHOD = 'POST';
            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token: null }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in onboardExternalUser: ', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR'
            };
        }
    }

    async searchNearestDealers(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['itemIndex', 'modelGroupDesc', 'pageSize', 'searchFilter', 'dealerType', 'latitude', 'longitude']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/master/service-booking/dealers/search/nearest';
            const METHOD = 'POST';
            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in searchNearestDealers: ', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || null
            };
        }
    }

    async searchDealers(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['itemIndex', 'chassisNumber', 'mobileNumber', 'modelDesc', 'pageSize', 'searchFilter']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/master/service-booking/dealers/search';
            const METHOD = 'POST';
            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in searchDealers: ', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || null
            };
        }
    }

    // Used
    async getDealers(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['chassis', 'latitude', 'longitude', 'mobileNumber', 'modelDesc']);
            if (!token) {throw new Error('Mahindra access token is missing');}
            const path = '/master/service-booking/dealers';
            const METHOD = 'POST';
            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in getDealers', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || null
            };
        }
    }

    async sendSosRequest(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['name', 'mobileNumber', 'chassisNumber', 'latitude', 'longitude', 'sosSource', 'message']);
            if (!token) {throw new Error('Mahindra access token is missing');}
            const path = '/rsa-shield-other/rsa/sos';
            const METHOD = 'POST';
            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in sendSosRequest', error.response?.data?.message || error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || 'Unable to process the request, please try again.',
            };
        }
    }

    async bookServiceRequest(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['bookingType', 'chassisNumber', 'locationCode', 'mobileNumber', 'modelDesc', 'parentGroup', 'serviceType', 'slot']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/service-booking';
            const METHOD = 'POST';

            const response = await this.makeHttpRequest(
                vinno,
                path,
                path,
                METHOD,
                { token },
                {
                    ...body,
                    dropAddress: '',
                    maxiCare: [],
                    pickUpAddress: '',
                    scheduledJobs: [],
                    serviceNotes: ['Nemo3.0'],
                },
                null
            );
            return response.data;
        } catch (error) {
            return this.handleError(error);
        }
    }

    async getServiceBookingStatus(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['mobileNumber', 'chassisNumber']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/service-booking/status';
            const METHOD = 'POST';

            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in getServiceBookingStatus', error.toString());
            return null;
        }
    }

    async getServiceHistory(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['mobileNumber', 'chassisNumber', 'isThisYear']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const queryParams = `isThisYear=${body.isThisYear}`;
            const path = '/service-booking/repair-orders/all';
            const METHOD = 'POST';

            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, queryParams);
            return response.data;
        } catch (error) {
            this.logger.error('Error in getServiceHistory', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || null
            };
        }
    }

    async fetchUserVehicleDetails(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['mobileNumber', 'isOwnedVehicle', 'chassisNumber']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/user/v2/vehicle';
            const METHOD = 'POST';

            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return {
                code: 200,
                data: response.data,
                msg: 'Successfully fetched the vehicle details.',
            };
        } catch (error) {
            return this.handleError(error);
        }
    }

    async cancelAppointment(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['appointmentId', 'chassisNumber', 'dmsBookingId', 'mobileNumber', 'reason', 'comments']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/service-booking/appointments/status';
            const METHOD = 'POST';

            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async getVehicleDetails(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['mobileNumber', 'chassisNumber', 'isOwnedVehicle']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/user/v2/vehicle';
            const METHOD = 'POST';

            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response;
        } catch (error) {
            this.logger.error('Error in getVehicleDetails: ', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || null
            };
        }
    }

    async getNearestDealers(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['modelGroupDesc', 'pageSize', 'searchFilter', 'dealerType', 'latitude', 'longitude']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            body.itemIndex = 0;
            const path = '/master/service-booking/dealers/search/nearest';
            const METHOD = 'POST';
            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in getNearestDealers: ', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || null
            };
        }
    }

    async getRepairOrderBillDetails(vinno, body, token) {
        try {
            this.validateVinno(vinno);
            this.validateBody(body, ['locationCode', 'parentCode', 'roBillNo', 'chassisNumber', 'mobileNumber']);
            if (!token) {throw new Error('Mahindra access token is missing');}

            const path = '/service-booking/repair-orders/bills';
            const METHOD = 'POST';

            const response = await this.makeHttpRequest(vinno, path, path, METHOD, { token }, body, null);
            return response.data;
        } catch (error) {
            this.logger.error('Error in getRepairOrderBillDetails', error.toString());
            throw {
                errcode: 'INTERNAL_SERVER_ERROR',
                errmsg: error?.response?.data?.message || null
            };
        }
    }

    async makeHttpRequest(vinno, path, pathWithParams, method, extraHeaders = {}, body = {}, queryParams) {
        const url = `${this.config.mahindrasvc.baseurl}${pathWithParams}${queryParams ? `?${queryParams}` : ''}`;
        const headers = {
            Platform: this.config.mahindrasvc.Platform,
            Source: this.config.mahindrasvc.Source,
            Type: this.config.mahindrasvc.Type,
            AppVersion: this.config.mahindrasvc.AppVersion,
            SdkVersion: this.config.mahindrasvc.SdkVersion,
            Accept: this.config.mahindrasvc.Accept,
            'x-api-key': this.config.mahindrasvc.xapikey,
        };
        if (extraHeaders.token) {
            const token = extraHeaders.token.trim();
            headers.Authorization = `Bearer ${token}`;
        }

        if (method !== 'GET') {
            headers['Content-Type'] = this.config.mahindrasvc.ContentType;
        }

        if (Object.keys(extraHeaders).length > 0) {
            for (const key in extraHeaders) {
                headers[key] = extraHeaders[key];
            }
        }

        const start = new Date().getTime();

        try {
            switch (method) {
                case 'GET': {
                    const response = await axios.get(url, {
                        headers,
                    });
                    const end = new Date().getTime();
                    this.externalApiLogger(vinno, start, end, path, body, response.data, response.status).catch((error) => console.error(error));
                    return response.data;
                }
                case 'POST': {
                    const response = await axios.post(url, body, {
                        headers,
                    });
                    const end = new Date().getTime();
                    this.externalApiLogger(vinno, start, end, path, body, response.data, response.status).catch((error) => console.error(error));
                    return response.data;
                }
                case 'PUT': {
                    const response = await axios.put(url, body, {
                        headers,
                    });
                    const end = new Date().getTime();
                    this.externalApiLogger(vinno, start, end, path, body, response.data, response.status).catch((error) => console.error(error));
                    return response.data;
                }
                case 'DELETE': {
                    const response = await axios.delete(url, {
                        headers,
                    });
                    const end = new Date().getTime();
                    this.externalApiLogger(vinno, start, end, path, body, response.data, response.status).catch((error) => console.error(error));
                    return response.data;
                }
                default: {
                    throw new Error('Unable to make a request.');
                }
            }
        } catch (error) {
            const end = new Date().getTime();
            this.externalApiLogger(vinno, start, end, path, body, error?.response?.data || error?.response, error?.response?.status || 500).catch((error) => console.error(error));
            throw error;
        }
    }

    async externalApiLogger(vinno, start, end, path, requestPayload, responsePayload, status) {
        const duration = end - start;
        const query = `INSERT INTO ${this.config.schemas.service}.adc_service_api_log (vinno, requesttime, endpoint, requestpayload, apistatus, duration, apiresponse) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
        await this.pgPoolI.Query(query, [vinno, new Date(), path, JSON.stringify(requestPayload), status < 300 && status >= 200 ? 1 : 0, duration, JSON.stringify(responsePayload)]);
    }

    async connectToFMSApi(path, body, method = 'GET', cookie) {
        try {
            const url = `${this.config.externalapi.baseurl}${path}`;
            const response = await axios({
                url: url,
                method: method,
                data: body,
                headers: {
                    Accept: 'application/json',
                    Referer: this.config.externalapi.referer,
                    Cookie: cookie
                },
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }
}
