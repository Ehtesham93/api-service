import axios from "axios";
import { getADCModel, getChassisNumber } from "./util.js";

let serviceModSvcI = null;
let config = null;
let pollDatabaseTimeout = null;
let processQueueTimeout = null;
let pollProcessQueueTimeout = null;
let pollInterval = 1000;

export function initializeServiceModDB(svcinstance, configinstance) {
    serviceModSvcI = svcinstance;
    config = configinstance;
}


const processingQueue = [];
let isProcessing = false;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function pollDatabase() {
  try {
    const onboardingData = await serviceModSvcI.FetchPendingVehicleOnboarding();
    if (onboardingData.total > 1) {
      pollInterval = 1000;
    } else {
      pollInterval = 5 * 1000;
    }
    if (onboardingData.data) {
      processingQueue.push(onboardingData.data);
    }
  } catch (err) {
    console.error('Error polling database:', err);
  } finally {
    pollDatabaseTimeout = setTimeout(pollDatabase, pollInterval);
  }
}

export async function processQueue() {
  if (isProcessing || processingQueue.length === 0) {
    processQueueTimeout = setTimeout(processQueue, pollInterval);
    return;
  }

  isProcessing = true;
  const onboardingData = processingQueue.shift();
  console.log(`Starting onboarding for muserid ${onboardingData.muserid}`);

  while (true) {
    let txclient = null;
    try {
      const vehicleDetails = await serviceModSvcI.GetSingleVehicleDetail(onboardingData.vinno);
      let model = getADCModel(vehicleDetails[0].modeldisplayname);
      const chassisNumber = getChassisNumber(onboardingData.vinno);
      if (!model) {
        model = "A301";
      }
      let onboardingObj = {
        userId: onboardingData.muserid,
        mobileNumber: onboardingData.mobileno,
        flow: "OWNED",
        isWhatsAppConsented: true,
        registrationNumber: vehicleDetails[0].regno,
        chassisNumber: chassisNumber,
        modelGroup: model,
        modelDescription: model
      }
      const result = await callAuthExternalAPI(onboardingObj);

      txclient = await serviceModSvcI.StartTransaction();
      if (result.status === 'success') {
        await serviceModSvcI.DeleteOnboardingPendingQueue(txclient, onboardingData.vinno, onboardingData.mobileno);
        await serviceModSvcI.UpdateVehicleMobileno(txclient, onboardingData.vinno, onboardingObj.mobileNumber);
        await serviceModSvcI.MarkVehicleOnboarded(txclient, onboardingData.vinno, onboardingObj.mobileNumber, onboardingObj.userId, result.response);
        await serviceModSvcI.CommitTransaction(txclient);
        break;
      } else if (result.status === 'error') {
        await serviceModSvcI.DeleteOnboardingPendingQueue(txclient, onboardingData.vinno, onboardingData.mobileno);
        await serviceModSvcI.MoveToErrorTable(txclient, {...onboardingObj, vinno: onboardingData.vinno }, result.errorData);
        await serviceModSvcI.CommitTransaction(txclient);
        break;
      }
    } catch (err) {
      if (txclient) {
        await serviceModSvcI.RollbackTransaction(txclient);
      }
      console.log(`Retrying in 5s for muserid ${onboardingData.muserid} reason ${err?.message || err.response?.data?.message}`);
      await wait(2000);
    }
  }

  isProcessing = false;
  processQueueTimeout = setTimeout(processQueue, pollInterval);
}

async function callAuthExternalAPI(onboardingData) {
  try {
    const response = await axios.post(`${config.mahindrasvc.baseurl}/user/v2/auth/external`, {
        userId: onboardingData.userId,
        mobileNumber: onboardingData.mobileNumber,
        flow: "OWNED",
        isWhatsAppConsented: true,
        registrationNumber: onboardingData.registrationNumber,
        chassisNumber: onboardingData.chassisNumber,
        modelGroup: onboardingData.modelGroup,
        modelDescription: onboardingData.modelDescription
      },{
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Source': config.mahindrasvc.Source,
        'Type': config.mahindrasvc.Type,
        'Platform': config.mahindrasvc.Platform,
        'AppVersion': config.mahindrasvc.AppVersion,
        'SdkVersion': config.mahindrasvc.SdkVersion,
        'x-api-key': config.mahindrasvc.xapikey
      }
    });

    return { status: 'success', response: response.data };
  } catch (err) {
    if (
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNRESET' ||
        err.code === 'EAI_AGAIN' ||
        err.response?.status > 500
      ) {
        throw new Error('External server/network issue — retrying...');
      }
    
      return { status: 'error', errorData: err.response?.data };
  }
}

export function startPolling() {
    pollProcessQueueTimeout = setTimeout(() => {
      pollDatabase();
      processQueue();
    }, 5000);
}

export function stopPolling() {
    if (pollDatabaseTimeout) {clearTimeout(pollDatabaseTimeout);}
    if (processQueueTimeout) {clearTimeout(processQueueTimeout);}
    if (pollProcessQueueTimeout) {clearTimeout(pollProcessQueueTimeout);}
}