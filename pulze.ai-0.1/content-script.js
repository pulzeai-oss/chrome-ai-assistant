console.log("Pulze Reply Extension: content-script.js loaded");

async function loadModule(moduleName) {
  const url = chrome.runtime.getURL(moduleName);
  console.log(`Pulze Reply Extension: Loading module ${moduleName} from ${url}`);
  return await import(url);
}

function getSpaceMappings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['spaceMappings'], function(result) {
      resolve(result.spaceMappings || {});
    });
  });
}

async function checkCurrentSite() {
  const hostname = window.location.hostname;
  console.log(`Pulze Reply Extension: Current hostname is ${hostname}`);

  const spaceMappings = await getSpaceMappings();

  // Check if text-insights is assigned to any space
  const isAISearchAssigned = Object.values(spaceMappings).some(
    mapping => mapping.provider === 'text-insights'
  );

  if (isAISearchAssigned) {
    console.log("Pulze Reply Extension: Loading text insights module");
    const { default: initializeTextInsights } = await loadModule('text-insights.js');
    initializeTextInsights();
  } else {
    console.log("Pulze Reply Extension: Text Insights module is not assigned to any space");
  }

  // Keep the existing checks for specific sites
  if (hostname === 'mail.google.com' && isProviderAssigned(spaceMappings, 'gmail')) {
    console.log("Pulze Reply Extension: You are on Gmail");
    const { default: initializeGmailFeatures } = await loadModule('gmail.js');
    initializeGmailFeatures();
  } else if (hostname === 'app.smartlead.ai' && isProviderAssigned(spaceMappings, 'smartlead')) {
    console.log("Pulze Reply Extension: You are on Smartlead");
    const { default: initializeSmartleadFeatures } = await loadModule('smartlead.js');
    initializeSmartleadFeatures();
  } else if (hostname === 'web.whatsapp.com' && isProviderAssigned(spaceMappings, 'whatsapp')) {
    console.log("Pulze Reply Extension: You are on WhatsApp Web");
    const { default: initializeWhatsAppFeatures } = await loadModule('whatsapp.js');
    initializeWhatsAppFeatures();
  }
}

function isProviderAssigned(spaceMappings, provider) {
  return Object.values(spaceMappings).some(mapping => mapping.provider === provider);
}

checkCurrentSite();
