import axios from "axios";

let serviceModSvcI = null;
let config = null;
let pollDatabaseTimeout = null;
let processQueueTimeout = null;
let pollProcessQueueTimeout = null;

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

    for (const data of onboardingData) {
      if (!processingQueue.find(eachdata => eachdata.muserid === data.muserid && eachdata.chassis_number === data.chassis_number && eachdata.mobileno === data.mobileno)) {
        processingQueue.push(data);
        console.log(`Onboarding request with muserid ${data.muserid} added to processing queue`);
      }
    }
  } catch (err) {
    console.error('Error polling database:', err);
  } finally {
    pollDatabaseTimeout = setTimeout(pollDatabase, 5 * 60 * 1000);
  }
}

export async function processQueue() {
  if (isProcessing || processingQueue.length === 0) {
    return setTimeout(processQueue, 2000);
  }

  isProcessing = true;
  const onboardingData = processingQueue.shift();

  console.log(`Starting onboarding for muserid ${onboardingData.muserid}`);

  while (true) {
    try {
      const result = await callAuthExternalAPI(onboardingData);

      if (result.status === 'success') {
        await serviceModSvcI.MarkVehicleOnboarded(onboardingData);
        break;
      } else if (result.status === 'error') {
        await serviceModSvcI.MoveToErrorTable(onboardingData, result.errorData, { 
            userId: onboardingData.muserid,
            mobileNumber: onboardingData.mobileno,
            flow: "OWNED",
            isWhatsAppConsented: true,
            registrationNumber: onboardingData.chassis_number,
            chassisNumber: onboardingData.chassis_number,
            modelGroup: onboardingData.model,
            modelDescription: onboardingData.model
        });
        break;
      }
    } catch (err) {
      console.log(`Retrying in 5s for muserid ${onboardingData.muserid} reason ${err?.message || err.response?.data?.message}`);
      await wait(5000);
    }
  }

  isProcessing = false;
  processQueueTimeout = setTimeout(processQueue, 0);
}

async function callAuthExternalAPI(onboardingData) {
  try {
    await axios.post(`${config.mahindrasvc.baseurl}/user/v2/auth/external`, {
        userId: onboardingData.muserid,
        mobileNumber: onboardingData.mobileno,
        flow: "OWNED",
        isWhatsAppConsented: true,
        registrationNumber: onboardingData.chassis_number,
        chassisNumber: onboardingData.chassis_number,
        modelGroup: onboardingData.model,
        modelDescription: onboardingData.model
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

    return { status: 'success' };
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
    if (pollDatabaseTimeout) clearTimeout(pollDatabaseTimeout);
    if (processQueueTimeout) clearTimeout(processQueueTimeout);
    if (pollProcessQueueTimeout) clearTimeout(pollProcessQueueTimeout);
}