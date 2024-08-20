// smartlead.js

export default function initializeSmartleadFeatures() {
  console.log("Pulze Reply Extension: Initializing Smartlead features");

  let openAIConfig = {
    baseURL: 'https://api.pulze.ai/v1',
    apiKey: ''
  };

  let lastAIResponse = '';

  function getApiKey(provider) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['spaceMappings'], function(result) {
        const mappings = result.spaceMappings || {};
        const assignedSpace = Object.values(mappings).find(space => space.provider === provider);
        if (assignedSpace && assignedSpace.apiToken) {
          resolve(assignedSpace.apiToken);
        } else {
          reject(new Error(`No API key found for ${provider}`));
        }
      });
    });
  }

  // Use this function when you need to make API calls
  getApiKey('smartlead')
    .then(apiKey => {
      openAIConfig.apiKey = apiKey;
    })
    .catch(error => {
      console.error(error);
      alert("Please assign and connect a space for Smartlead in the extension settings.");
    });

  function createLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'pulze-loading-spinner';
    return spinner;
  }

  function createResponseActionButtons(emailContent, actionContainer) {
    const actionContainerDiv = actionContainer.querySelector('.pulze-action-buttons-container');
    if (actionContainerDiv) {
      actionContainerDiv.remove();
    }

    const newActionContainer = document.createElement('div');
    newActionContainer.className = 'pulze-action-buttons-container';
    newActionContainer.style.paddingLeft = '8px';


    const buttonClass = 'q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--rectangle text-primary q-btn--actionable q-focusable q-hoverable q-btn--no-uppercase email-action-btn';

    const retryButton = document.createElement('button');
    retryButton.className = buttonClass + ' pulze-retry-btn';
    retryButton.innerHTML = 'Retry';
    retryButton.onclick = () => {
      newActionContainer.innerHTML = ''; // Clear the actionContainer
      const spinner = createLoadingSpinner();
      newActionContainer.appendChild(spinner);

      getApiKey('smartlead').then(apiKey => {
        openAIConfig.apiKey = apiKey;
        generateAndInsertResponse(emailContent, null, newActionContainer);
      }).catch(error => {
        console.error("Failed to fetch API key:", error);
        alert("Please assign and connect a space for Smartlead in the extension settings.");
        newActionContainer.innerHTML = ''; // Clear the spinner
      });
    };

    const modifyButton = document.createElement('button');
    modifyButton.className = buttonClass + ' pulze-modify-btn';
    modifyButton.innerHTML = 'Modify';
    modifyButton.onclick = () => {
      showModal(emailContent);
    };

    newActionContainer.appendChild(retryButton);
    newActionContainer.appendChild(modifyButton);

    return newActionContainer;
  }

  function injectReplyButton() {
    const emailActionSection = document.querySelector('.email-reply-action-box');
    if (emailActionSection && !document.querySelector('.pulze-reply-btn')) {
      console.log("Pulze Reply Extension: Injecting reply button");
      const replyButton = document.createElement('button');
      replyButton.className = 'q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--rectangle text-primary q-btn--actionable q-focusable q-hoverable q-btn--no-uppercase email-action-btn pulze-reply-btn';
      replyButton.innerHTML = 'Pulze it!';
      replyButton.onclick = () => {
        clickViewMoreButton().then(() => {
          const emailContent = getEmailContent();
          if (emailContent) {
            chrome.storage.local.set({ emailContent }, () => {
              console.log("Email content saved to storage");
              replyButton.style.display = 'none';
              const spinner = createLoadingSpinner();
              emailActionSection.insertBefore(spinner, emailActionSection.firstChild);
              generateAndInsertResponse(emailContent, null, emailActionSection);
            });
          } else {
            alert("No email content found.");
          }
        });
      };
      emailActionSection.insertBefore(replyButton, emailActionSection.firstChild);
    }
  }

  function showModal(emailContent) {
    const targetDiv = document.querySelector('.preview-last-reply-block');

    const modalBackground = document.createElement('div');
    modalBackground.className = 'modal-background';
    modalBackground.style.zIndex = '1001';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.zIndex = '1001';

    const modalHeader = document.createElement('h2');
    modalHeader.innerText = 'Modify Your Response';

    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close-button';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => {
      targetDiv.removeChild(modalBackground);
    };

    const modalInput = document.createElement('textarea');
    modalInput.value = lastAIResponse;
    modalInput.style.height = '200px';

    const modalSubmitButton = document.createElement('button');
    modalSubmitButton.className = 'q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--rectangle text-primary q-btn--actionable q-focusable q-hoverable q-btn--no-uppercase email-action-btn';
    modalSubmitButton.innerText = 'Submit';
    modalSubmitButton.onclick = () => {
      const userInput = modalInput.value;
      if (userInput) {
        generateAndInsertResponse(emailContent, userInput);
        targetDiv.removeChild(modalBackground);
      }
    };

    modalContent.appendChild(closeButton);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalInput);
    modalContent.appendChild(modalSubmitButton);

    modalBackground.appendChild(modalContent);
    targetDiv.appendChild(modalBackground);
  }

  function clickViewMoreButton() {
    return new Promise((resolve) => {
      const viewMoreBtn = document.querySelector('.view-more-btn');
      if (viewMoreBtn) {
        console.log("Pulze Reply Extension: Clicking view more button");
        viewMoreBtn.click();
        setTimeout(resolve, 1000);
      } else {
        console.log("Pulze Reply Extension: View more button not found");
        resolve();
      }
    });
  }

  function getEmailContent() {
    const replyBlock = document.querySelector('.preview-last-reply-block');
    if (replyBlock) {
      console.log("Pulze Reply Extension: Reply block found");
      return replyBlock.innerText;
    } else {
      console.warn("Pulze Reply Extension: Reply block not found");
      return null;
    }
  }

  async function generateAndInsertResponse(emailContent, userInput = null, actionContainer = null) {
    try {
      const apiKey = await getApiKey('smartlead');
      openAIConfig.apiKey = apiKey;
      const response = await fetchOpenAIResponse(emailContent, userInput);
      insertResponse(response, emailContent);
      if (actionContainer) {
        const spinner = actionContainer.querySelector('.pulze-loading-spinner');
        if (spinner) {
          spinner.remove();
        }
        replaceReplyButtonWithActionButtons(emailContent, actionContainer);
      }
    } catch (error) {
      console.error("Error generating response:", error);
      alert("Failed to generate AI response. Did you set the API Key correctly?");
      if (actionContainer) {
        const spinner = actionContainer.querySelector('.pulze-loading-spinner');
        if (spinner) {
          spinner.remove();
        }
        const replyButton = document.createElement('button');
        replyButton.className = 'q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--rectangle text-primary q-btn--actionable q-focusable q-hoverable q-btn--no-uppercase email-action-btn pulze-reply-btn';
        replyButton.innerHTML = 'Pulze it!';
        replyButton.onclick = () => generateAndInsertResponse(emailContent, null, actionContainer);
        actionContainer.insertBefore(replyButton, actionContainer.firstChild);
      }
    }
  }

  async function fetchOpenAIResponse(prompt, userInput = null) {
    const apiKey = await getApiKey('smartlead');
    const custom_labels = { "chrome-extension": "true" };

    let messages = [
      { role: "user", content: `${prompt}` }
    ];

    if (userInput) {
      messages.push({ role: "user", content: userInput });
    }

    const response = await fetch(`${openAIConfig.baseURL}/chat/completions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Pulze-Labels': JSON.stringify(custom_labels)
      },
      body: JSON.stringify({
        model: "pulze",
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  function insertResponse(response, emailContent) {
    const replyField = document.querySelector('.fr-element.fr-view');
    if (replyField) {
      console.log("Pulze Reply Extension: Inserting AI-generated response");
      replyField.innerHTML = `<div>${response}</div>`;
      lastAIResponse = response;

      const inputEvent = new Event('input', {
        bubbles: true,
        cancelable: true,
      });
      replyField.dispatchEvent(inputEvent);

      const actionContainer = document.querySelector('.email-reply-action-box');
      if (actionContainer) {
        replaceReplyButtonWithActionButtons(emailContent, actionContainer);
      }
    } else {
      console.warn("Pulze Reply Extension: Reply field not found");
    }
  }

  function replaceReplyButtonWithActionButtons(emailContent, container) {
    const existingButton = container.querySelector('.pulze-reply-btn');
    if (existingButton) {
      existingButton.remove();
    }

    const existingActionButtons = container.querySelector('.pulze-action-buttons-container');
    if (existingActionButtons) {
      existingActionButtons.remove();
    }

    const actionButtons = createResponseActionButtons(emailContent, container);
    container.appendChild(actionButtons);
  }

  injectReplyButton();

  const observer = new MutationObserver(() => {
    injectReplyButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.log("Pulze Reply Extension: Smartlead features initialized");

  const modalStyles = `
    .modal-background {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .modal-close-button {
      position: absolute;
      top: 10px;
      right: 10px;
      border: none;
      background: none;
      font-size: 20px;
      cursor: pointer;
    }
    .modal-content {
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      width: 400px;
      max-width: 90%;
    }
    textarea {
      width: 100%;
      height: 100px;
      margin: 10px 0;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 8px;
    }
    button {
      margin-top: 10px;
      padding: 10px;
      border: none;
      border-radius: 4px;
      background-color: #FF6523;
      color: white;
      cursor: pointer;
    }
    button:hover {
      background-color: #FF6523 !important
    }
  .pulze-reply-btn,
  .pulze-retry-btn,
  .pulze-modify-btn {
    background-color: #FF6523;
    color: white !important;
    border: none;
    padding: 8px 16px;
    margin-right: 8px;
    font-size: 14px;
    cursor: pointer;
    border-radius: 4px;
    display: inline-block;
  }

  .pulze-retry-btn:hover,
  .pulze-modify-btn:hover {
    background-color: #FF6523 !important;
  }

  .pulze-loading-spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #FF6523;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    display: inline-block;
    margin-right: 8px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = modalStyles;
  document.head.appendChild(styleSheet);
}
