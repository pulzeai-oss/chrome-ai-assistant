export default function initializeGmailFeatures() {
    console.log("Pulze Reply Extension: Initializing Gmail features");

    let openAIConfig = {
        baseURL: 'https://api.pulze.ai/v1',
        apiKey: ''
    };

    let lastAIResponse = '';

    function getApiKey(provider) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['spaceMappings'], function(result) {
                console.log('Space mappings:', result.spaceMappings);
                const mappings = result.spaceMappings || {};
                const assignedSpace = Object.values(mappings).find(space => space.provider === provider);
                if (assignedSpace && assignedSpace.apiToken) {
                    console.log(`API key found for ${provider}`);
                    resolve(assignedSpace.apiToken);
                } else {
                    console.log(`No API key found for ${provider}`);
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

    function createResponseActionButtons(emailContent) {
        console.log("Pulze Reply Extension: Creating response action buttons");

        const actionContainer = document.createElement('div');
        actionContainer.className = 'pulze-action-buttons-container';
        actionContainer.style.display = 'inline-block';
        actionContainer.style.marginRight = '8px';
        actionContainer.style.marginLeft = '8px';

        const retryButton = document.createElement('button');
        retryButton.className = 'pulze-retry-btn';
        retryButton.innerHTML = 'Retry';

        const modifyButton = document.createElement('button');
        modifyButton.className = 'pulze-modify-btn';
        modifyButton.innerHTML = 'Modify';

        retryButton.addEventListener('click', function() {
            try {
                const parentContainer = this.closest('tr.btC');
                generateAndInsertResponse(emailContent, null, parentContainer);
            } catch (error) {
                console.error("Error in retry button click:", error);
            }
        });

        modifyButton.addEventListener('click', function() {
            try {
                showModal(emailContent);
            } catch (error) {
                console.error("Error in modify button click:", error);
            }
        });

        actionContainer.appendChild(retryButton);
        actionContainer.appendChild(modifyButton);

        console.log("Pulze Reply Extension: Response action buttons created");
        return actionContainer;
    }

    function injectReplyButton() {
        const emailActionRow = document.querySelector('tr.btC');
        if (emailActionRow) {
            const actionContainer = emailActionRow.querySelector('td.gU.Up');
            if (actionContainer) {
                const existingButton = emailActionRow.querySelector('.pulze-reply-btn');
                const existingActionButtons = emailActionRow.querySelector('.pulze-action-buttons-container');

                if (!existingButton && !existingActionButtons) {
                    console.log("Pulze Reply Extension: Injecting reply button");
                    const replyButton = document.createElement('button');
                    replyButton.className = 'pulze-reply-btn';
                    replyButton.innerHTML = 'Pulze it!';
                    replyButton.style.zIndex = '1000';
                    replyButton.onclick = (event) => {
                        event.stopPropagation();
                        const emailContent = getEmailContent();
                        if (emailContent) {
                            chrome.storage.local.set({ emailContent }, () => {
                                console.log("Email content saved to storage");
                                replyButton.style.display = 'none';
                                const spinner = createLoadingSpinner();
                                emailActionRow.insertBefore(spinner, actionContainer);
                                generateAndInsertResponse(emailContent, null, emailActionRow);
                            });
                        } else {
                            alert("No email content found.");
                        }
                    };

                    emailActionRow.insertBefore(replyButton, actionContainer);
                }
            }
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

        const actionButtons = createResponseActionButtons(emailContent);
        container.appendChild(actionButtons);
    }

    function showModal(emailContent) {
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
        modalSubmitButton.className = 'T-I J-J5-Ji aoO v7 T-I-atl L3';
        modalSubmitButton.innerText = 'Submit';
        modalSubmitButton.onclick = () => {
            const userInput = modalInput.value;
            if (userInput) {
                generateAndInsertResponse(emailContent, userInput);
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

    function getEmailContent() {
        const emailBody = document.querySelector('.a3s.aiL');
        if (emailBody) {
            console.log("Pulze Reply Extension: Email body found");
            return emailBody.innerText;
        } else {
            console.warn("Pulze Reply Extension: Email body not found");
            return null;
        }
    }

    async function generateAndInsertResponse(emailContent, userInput = null, actionContainer = null) {
        try {
            const apiKey = await getApiKey('gmail');
            openAIConfig.apiKey = apiKey;

            const spinner = createLoadingSpinner();
            if (actionContainer) {
                const existingSpinner = actionContainer.querySelector('.pulze-loading-spinner');
                if (!existingSpinner) {
                    actionContainer.insertBefore(spinner, actionContainer.firstChild);
                }
            }

            const actionButtons = actionContainer.querySelector('.pulze-action-buttons-container');
            if (actionButtons) {
                actionButtons.style.display = 'none';
            }

            const response = await fetchOpenAIResponse(emailContent, userInput);
            insertResponse(response, emailContent);

            if (actionContainer) {
                const spinner = actionContainer.querySelector('.pulze-loading-spinner');
                if (spinner) {
                    spinner.remove();
                }
                if (actionButtons) {
                    actionButtons.style.display = 'inline-block';
                }
            }
        } catch (error) {
            console.error("Error generating response:", error);
            alert("Failed to generate AI response. Please ensure you've assigned and connected a space for Gmail in the extension settings.");

            if (actionContainer) {
                const spinner = actionContainer.querySelector('.pulze-loading-spinner');
                if (spinner) {
                    spinner.remove();
                }
                const actionButtons = actionContainer.querySelector('.pulze-action-buttons-container');
                if (actionButtons) {
                    actionButtons.style.display = 'inline-block';
                }
            }
        }
    }

    async function fetchOpenAIResponse(prompt, userInput = null) {
        const apiKey = await getApiKey('gmail');

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

    function insertResponse(response, emailContent) {
        const replyField = document.querySelector('div[role="textbox"][aria-label="Message Body"]');
        if (replyField) {
            console.log("Pulze Reply Extension: Inserting AI-generated response");
            replyField.innerHTML = `<div>${response}</div>`;
            lastAIResponse = response;

            const inputEvent = new Event('input', {
                bubbles: true,
                cancelable: true,
            });
            replyField.dispatchEvent(inputEvent);

            const emailActionRow = document.querySelector('tr.btC');
            if (emailActionRow) {
                const actionContainer = emailActionRow.querySelector('td.gU.Up');
                if (actionContainer) {
                    replaceReplyButtonWithActionButtons(emailContent, actionContainer);
                }
            }
        } else {
            console.warn("Pulze Reply Extension: Reply field not found");
        }
    }

    injectReplyButton();

    const observer = new MutationObserver(() => {
        injectReplyButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log("Pulze Reply Extension: Gmail features initialized");

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
      .pulze-reply-btn,
      .pulze-retry-btn,
      .pulze-modify-btn {
        background-color: #FF6523;
        color: white;
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
        background-color: #e55a1f;
      }

      .pulze-action-buttons-container {
        display: inline-block;
        margin-right: 8px;
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
