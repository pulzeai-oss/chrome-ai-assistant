export default function initializeTextInsights() {
  console.log("Pulze Reply Extension: Initializing Text Insights features");

  let openAIConfig = {
    baseURL: 'https://api.pulze.ai/v1',
    apiKey: ''
  };

  let pulzeButton = null;
  let responsePopups = [];
  let isResizing = false; // Flag to track if resizing is in progress

  function getApiKey(provider) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['spaceMappings'], function(result) {
        console.log("Space mappings:", result.spaceMappings);
        const mappings = result.spaceMappings || {};
        const assignedSpace = Object.values(mappings).find(space => space.provider === provider);
        if (assignedSpace && assignedSpace.apiToken) {
          console.log(`API key found for provider: ${provider}`);
          resolve(assignedSpace.apiToken);
        } else {
          console.error(`No API key found for provider: ${provider}`);
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

  function createPopup() {
    const popup = document.createElement('div');
    popup.className = 'pulze-popup';

    const header = document.createElement('div');
    header.className = 'pulze-popup-header';
    header.textContent = 'Pulze AI Response';

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.className = 'pulze-copy-button';
    copyButton.addEventListener('click', () => {
      const contentElement = popup.querySelector('.pulze-popup-content');
      const textToCopy = contentElement.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy';
        }, 2000);
      });
    });

    const closeButton = document.createElement('button');
    closeButton.className = 'pulze-close-button';
    closeButton.textContent = 'X';
    closeButton.addEventListener('click', () => {
      removePopup(popup);
    });

    // Append buttons to header
    header.appendChild(copyButton);
    header.appendChild(closeButton);
    popup.appendChild(header);

    const content = document.createElement('div');
    content.className = 'pulze-popup-content';
    popup.appendChild(content);

    const footer = document.createElement('div');
    footer.className = 'pulze-popup-footer';
    footer.innerHTML = 'Powered by <a href="https://pulze.ai" target="_blank">Pulze.ai</a>';
    popup.appendChild(footer);

    // Make the popup resizable
    popup.style.resize = 'both';
    popup.style.overflow = 'auto';

    // Add event listeners to handle resizing
    popup.addEventListener('mousedown', (e) => {
      if (e.target === popup) {
        isResizing = true; // Set flag when resizing starts
      }
    });

    document.addEventListener('mouseup', () => {
      isResizing = false; // Unset flag when resizing ends
    });

    return popup;
  }

  function createPulzeButton() {
    const button = document.createElement('button');
    button.textContent = 'Pulze it!';
    button.className = 'pulze-button';
    button.style.display = 'none';
    document.body.appendChild(button);
    return button;
  }

  async function generateAIResponse(selectedText) {
    try {
      const apiKey = await getApiKey('text-insights');
      const custom_labels = { "chrome-extension": "true" };

      openAIConfig.apiKey = apiKey;

      const response = await fetch(`${openAIConfig.baseURL}/chat/completions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Pulze-Labels': JSON.stringify(custom_labels)
        },
        body: JSON.stringify({
          model: "pulze",
          messages: [{ role: "user", content: selectedText }],
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error("Error generating AI response:", error);
      return null;
    }
  }

  function showPulzeButton(x, y) {
    if (!pulzeButton) {
      pulzeButton = createPulzeButton();
    }
    pulzeButton.style.position = 'absolute';
    pulzeButton.style.left = `${x}px`;
    pulzeButton.style.top = `${y}px`;
    pulzeButton.style.display = 'block';
    pulzeButton.style.zIndex = '1001';
  }

  function hidePulzeButton() {
    if (pulzeButton) {
      pulzeButton.style.display = 'none';
    }
  }

  function removePopup(popup) {
    if (popup) {
      popup.classList.add('fading');
      setTimeout(() => {
        popup.remove();
        responsePopups = responsePopups.filter(p => p !== popup);
      }, 300);
    }
  }

  function removeAllPopups() {
    responsePopups.forEach(popup => {
      popup.classList.add('fading');
      setTimeout(() => {
        popup.remove();
      }, 300);
    });
    responsePopups = [];
  }

  function MarkdownRenderer(text) {
    if (typeof text !== "string") {
      return text ?? "";
    }

    // Code blocks with copy button
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, function (match, language, code) {
      const uniqueId = "code-" + Math.random().toString(36).substr(2, 9);
      return `
        <div style="position: relative;">
          <pre><code class="language-${language || ""}" id="${uniqueId}">${code.trim()}</code></pre>
          <button class="copy-button" onclick="copyCode('${uniqueId}')">Copy</button>
        </div>
      `;
    });

    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Links
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Headers
    text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    text = text.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
    text = text.replace(/^###### (.*$)/gm, '<h6>$1</h6>');

    // Blockquotes
    text = text.replace(/^\> (.*$)/gm, '<blockquote>$1</blockquote>');

    // Line breaks
    text = text.replace(/\n/g, '<br>');

    return text;
  }

  async function streamResponse(response, contentElement) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0].delta.content;
              if (content) {
                fullResponse += content;
                contentElement.innerHTML = MarkdownRenderer(fullResponse);
                // Auto-scroll to the bottom
                contentElement.scrollTop = contentElement.scrollHeight;
              }
            } catch (error) {
              console.error("Error parsing streaming response:", error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error reading stream:", error);
      contentElement.innerHTML += "\nError: Unable to fetch the complete response.";
    }
  }

  document.addEventListener('selectionchange', function() {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showPulzeButton(rect.right, rect.bottom + window.scrollY);
    } else {
      hidePulzeButton();
    }
  });

  document.addEventListener('click', async function(e) {
    if (e.target.className === 'pulze-button') {
      e.preventDefault();
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        hidePulzeButton();

        // Create a new popup
        const newPopup = createPopup();
        document.body.appendChild(newPopup);
        newPopup.style.position = 'absolute';
        newPopup.style.left = `${e.clientX}px`;
        newPopup.style.top = `${e.clientY + window.scrollY}px`;

        // Make the popup draggable
        makeDraggable(newPopup, newPopup.querySelector('.pulze-popup-header'));

        // Add the new popup to the list of popups
        responsePopups.push(newPopup);

        const contentElement = newPopup.querySelector('.pulze-popup-content');
        const loadingSpinner = createLoadingSpinner();
        contentElement.appendChild(loadingSpinner);

        const response = await generateAIResponse(selectedText);
        if (response) {
          loadingSpinner.remove();
          await streamResponse(response, contentElement);
        } else {
          contentElement.textContent = "Failed to generate AI response. Please try again.";
        }
      }
    } else if (!e.target.closest('.pulze-popup') && !isResizing) { // Check the isResizing flag
      removeAllPopups();
    }
  });

  // Function to copy code to clipboard
  window.copyCode = function (elementId) {
    const codeElement = document.getElementById(elementId);
    const textArea = document.createElement("textarea");
    textArea.value = codeElement.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    alert("Code copied to clipboard!");
  };

  // Function to make the popup draggable
  function makeDraggable(element, handle) {
    let offsetX = 0, offsetY = 0, mouseDownX = 0, mouseDownY = 0;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      e.preventDefault();
      offsetX = e.clientX - mouseDownX;
      offsetY = e.clientY - mouseDownY;
      element.style.left = `${element.offsetLeft + offsetX}px`;
      element.style.top = `${element.offsetTop + offsetY}px`;
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  const styles = `
    .pulze-popup {
      background-color: white;
      border: 1px solid #ccc;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      width: 300px;
      max-height: 400px;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
      z-index: 1000;
      transition: opacity 0.3s ease-out;
      opacity: 1;
      resize: both;
      overflow: auto;
    }
    .pulze-popup.fading {
      opacity: 0;
    }
    .pulze-popup-header {
      background-color: #FF6523;
      color: white;
      padding: 10px;
      font-weight: bold;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
    }
    .pulze-close-button {
      background: transparent;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      margin-left: 10px;
    }
    .pulze-copy-button {
      background: transparent;
      border: none;
      color: white;
      font-size: 12px;
      cursor: pointer;
      margin-left: 10px;
    }
    .pulze-popup-content {
      flex-grow: 1;
      overflow-y: auto;
      padding: 10px;
    }
    .pulze-popup-footer {
      padding: 5px;
      text-align: center;
      font-size: 10px;
      color: #888;
      border-top: 1px solid #e0e0e0;
    }
    .pulze-popup-footer a {
      color: #FF6523;
      text-decoration: none;
    }
    .pulze-popup-footer a:hover {
      text-decoration: underline;
    }
    .pulze-loading-spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #4a90e2;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      margin: 10px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .pulze-button {
      background-color: #FF6523;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      z-index: 1001;
    }
    .pulze-button:hover {
      background-color: #FF6523;
    }
    .pulze-popup-content pre {
      background-color: #f4f4f4;
      border-radius: 4px;
      padding: 10px;
      overflow-x: auto;
      white-space: pre-wrap;
      position: relative;
    }
    .pulze-popup-content code {
      font-family: monospace;
      background-color: #f4f4f4;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .pulze-popup-content blockquote {
      border-left: 3px solid #ccc;
      margin: 0;
      padding-left: 10px;
      color: #666;
    }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
