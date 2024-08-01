// whatsapp.js

export default function initializeWhatsAppFeatures() {
    console.log("Pulze Reply Extension: Initializing WhatsApp features");

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

    function createLoadingSpinner() {
      const spinner = document.createElement('div');
      spinner.className = 'pulze-loading-spinner';
      return spinner;
    }

    function injectReplyButton() {
      const buttonContainer = document.querySelector('div._ak1q > div._ak1t._ak1m');

      if (buttonContainer && !document.querySelector('.pulze-reply-btn')) {
        console.log("Pulze Reply Extension: Injecting reply button");

        const pulzeButton = document.createElement('div');
        pulzeButton.className = 'pulze-reply-btn';
        pulzeButton.textContent = 'Pulze it!';
        pulzeButton.style.cursor = 'pointer';
        pulzeButton.style.color = '#FFFFFF';
        pulzeButton.style.fontWeight = 'normal';
        pulzeButton.style.padding = '8px';
        pulzeButton.style.display = 'inline-block';

        pulzeButton.onclick = () => {
          const chatContent = getChatContent();
          if (chatContent) {
            chrome.storage.local.set({ chatContent }, () => {
              console.log("Chat content saved to storage");
              pulzeButton.style.display = 'none';
              const spinner = createLoadingSpinner();
              buttonContainer.insertBefore(spinner, pulzeButton);
              generateAndInsertResponse(chatContent);
            });
          } else {
            alert("No chat content found.");
          }
        };

        buttonContainer.insertBefore(pulzeButton, buttonContainer.firstChild);
      }
    }

    function showModal(chatContent) {
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
        document.body.removeChild(modalBackground);
      };

      const modalInput = document.createElement('textarea');
      modalInput.value = lastAIResponse;
      modalInput.style.height = '200px';

      const modalSubmitButton = document.createElement('button');
      modalSubmitButton.className = 'modal-submit-button';
      modalSubmitButton.innerText = 'Submit';
      modalSubmitButton.onclick = () => {
        const userInput = modalInput.value;
        if (userInput) {
          generateAndInsertResponse(chatContent, userInput);
          document.body.removeChild(modalBackground);
        }
      };

      modalContent.appendChild(closeButton);
      modalContent.appendChild(modalHeader);
      modalContent.appendChild(modalInput);
      modalContent.appendChild(modalSubmitButton);

      modalBackground.appendChild(modalContent);
      document.body.appendChild(modalBackground);
    }

    function getChatContent() {
      const chatContainer = document.querySelector('div[data-tab="8"]');
      if (chatContainer) {
        console.log("Pulze Reply Extension: Chat container found");
        return chatContainer.innerText;
      } else {
        console.warn("Pulze Reply Extension: Chat container not found");
        return null;
      }
    }

    async function generateAndInsertResponse(chatContent, userInput = null) {
      const buttonContainer = document.querySelector('div._ak1q > div._ak1t._ak1m');
      const pulzeButton = buttonContainer.querySelector('.pulze-reply-btn');
      const existingSpinner = buttonContainer.querySelector('.pulze-loading-spinner');

      if (!existingSpinner) {
        const spinner = createLoadingSpinner();
        buttonContainer.insertBefore(spinner, pulzeButton || buttonContainer.firstChild);
      }

      if (pulzeButton) pulzeButton.style.display = 'none';

      try {
        const apiKey = await getApiKey('whatsapp');
        openAIConfig.apiKey = apiKey;
        const response = await fetchOpenAIResponse(chatContent, userInput);
        console.log("AI Response:", response); // Log the response to the console
        insertResponse(response, chatContent);
      } catch (error) {
        console.error("Error generating response:", error);
        alert("Failed to generate AI response. Please ensure you've assigned and connected a space for WhatsApp in the extension settings.");
      } finally {
        const spinner = buttonContainer.querySelector('.pulze-loading-spinner');
        if (spinner) spinner.remove();
      }
    }

    async function fetchOpenAIResponse(prompt, userInput = null) {
      const apiKey = await getApiKey('whatsapp');

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
          'Authorization': `Bearer ${apiKey}`
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

    function insertResponse(response, chatContent) {
        const contentEditableDiv = document.querySelector('div[contenteditable="true"][data-tab="10"]');
        if (contentEditableDiv) {
          console.log("Pulze Reply Extension: Contenteditable div found");
          console.log("Response to be inserted:", response);

          // Focus the input field
          contentEditableDiv.focus();

          // Use execCommand to insert text
          document.execCommand('insertText', false, response);

          console.log("Text content after insertion:", contentEditableDiv.textContent);

          // Trigger input event
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
          });
          contentEditableDiv.dispatchEvent(inputEvent);

          // Check if the text was actually inserted
          setTimeout(() => {
            console.log("Text content after timeout:", contentEditableDiv.textContent);
          }, 100);

          lastAIResponse = response;

          // Update action buttons
          const buttonContainer = document.querySelector('div._ak1q > div._ak1t._ak1m');
          if (buttonContainer) {
            const existingButtons = buttonContainer.querySelector('.pulze-action-buttons-container');
            if (existingButtons) {
              existingButtons.remove();
            }
            const actionButtons = createResponseActionButtons(chatContent);
            buttonContainer.insertBefore(actionButtons, buttonContainer.firstChild);
          }
        } else {
          console.warn("Pulze Reply Extension: Contenteditable div not found");
        }
      }

    function createResponseActionButtons(chatContent) {
      const actionContainer = document.createElement('div');
      actionContainer.className = 'pulze-action-buttons-container';
      actionContainer.style.display = 'inline-block';

      const createActionButton = (text, onClick) => {
        const button = document.createElement('div');
        button.className = 'pulze-action-btn';
        button.textContent = text;
        button.style.cursor = 'pointer';
        button.style.color = '#FFFFFF';
        button.style.fontWeight = 'normal';
        button.style.padding = '8px';
        button.style.display = 'inline-block';
        button.style.marginRight = '8px';
        button.onclick = onClick;
        return button;
      };

      const retryButton = createActionButton('Retry', () => generateAndInsertResponse(chatContent));
      const modifyButton = createActionButton('Modify', () => showModal(chatContent));

      actionContainer.appendChild(retryButton);
      actionContainer.appendChild(modifyButton);

      return actionContainer;
    }

    injectReplyButton();

    const observer = new MutationObserver(() => {
      injectReplyButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log("Pulze Reply Extension: WhatsApp features initialized");

    const styles = `
      .pulze-reply-btn,
      .pulze-action-btn {
        background-color: #FF6523;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        padding: 8px 16px;
        font-size: 14px;
        margin-right: 8px;
        display: inline-block;
        font-weight: normal;
      }

      .pulze-reply-btn:hover,
      .pulze-action-btn:hover {
        background-color: #e55a1f;
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

      .pulze-action-buttons-container {
        display: inline-block;
      }

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
      }

      .modal-content {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        width: 400px;
        max-width: 90%;
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

      .modal-submit-button {
        background-color: #FF6523;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 10px;
      }

      .modal-submit-button:hover {
        background-color: #e55a1f;
      }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
  }
