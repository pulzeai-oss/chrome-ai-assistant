console.log("Pulze Reply Extension: content-script.js loaded");

async function loadModule(moduleName) {
  const url = chrome.runtime.getURL(moduleName);
  console.log(`Pulze Reply Extension: Loading module ${moduleName} from ${url}`);
  return await import(url);
}

async function checkCurrentSite() {
  const hostname = window.location.hostname;
  console.log(`Pulze Reply Extension: Current hostname is ${hostname}`);

  if (hostname === 'mail.google.com') {
    console.log("Pulze Reply Extension: You are on Gmail");
    const { default: initializeGmailFeatures } = await loadModule('gmail.js');
    initializeGmailFeatures();
  } else if (hostname === 'app.smartlead.ai') {
    console.log("Pulze Reply Extension: You are on Smartlead");
    const { default: initializeSmartleadFeatures } = await loadModule('smartlead.js');
    initializeSmartleadFeatures();
  } else if (hostname === 'web.whatsapp.com') {
    console.log("Pulze Reply Extension: You are on WhatsApp Web");
    const { default: initializeWhatsAppFeatures } = await loadModule('whatsapp.js');
    initializeWhatsAppFeatures();
  } else {
    console.log("Pulze Reply Extension: Not on a supported site");
  }
}

checkCurrentSite();
