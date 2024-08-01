document.addEventListener('DOMContentLoaded', function() {
  const loginButton = document.getElementById('loginButton');
  const spaceList = document.getElementById('space-list');
  const loginSection = document.getElementById('login-section');
  const spacesSection = document.getElementById('spaces-section');
  const searchInput = document.getElementById('searchInput');

  const AUTH0_DOMAIN = 'auth.pulze.ai';
  const AUTH0_CLIENT_ID = '<our client id>';
  const AUTH0_CALLBACK_URL = chrome.identity.getRedirectURL();
  const AUTH0_AUDIENCE = 'https://api.pulze.ai';
  const AUTH0_SCOPE = 'email profile openid user:all';

  let allSpaces = [];

  function authenticate() {
    return new Promise((resolve, reject) => {
      const authUrl = `https://${AUTH0_DOMAIN}/authorize?` +
        `client_id=${AUTH0_CLIENT_ID}&` +
        `response_type=token&` +
        `redirect_uri=${encodeURIComponent(AUTH0_CALLBACK_URL)}&` +
        `audience=${encodeURIComponent(AUTH0_AUDIENCE)}&` +
        `scope=${encodeURIComponent(AUTH0_SCOPE)}`;

      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, function(redirectUrl) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          const url = new URL(redirectUrl);
          const params = new URLSearchParams(url.hash.substring(1));
          const accessToken = params.get('access_token');
          const expiresIn = params.get('expires_in');

          if (!accessToken) {
            reject(new Error('No access token found in the redirect URL'));
          } else {
            const expiresAt = Date.now() + parseInt(expiresIn) * 1000;
            chrome.storage.local.set({ 'access_token': accessToken, 'expires_at': expiresAt }, () => {
              resolve(accessToken);
            });
          }
        }
      });
    });
  }

  function isAuthenticated() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['expires_at'], (result) => {
        const expiresAt = result.expires_at || 0;
        resolve(new Date().getTime() < expiresAt);
      });
    });
  }

  function loadSpaceMappings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['spaceMappings'], function(result) {
        console.log('Loaded space mappings:', result.spaceMappings);
        resolve(result.spaceMappings || {});
      });
    });
  }

  function saveSpaceMappings(mappings) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({spaceMappings: mappings}, function() {
        if (chrome.runtime.lastError) {
          console.error('Error saving space mappings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Space mappings saved successfully');
          resolve();
        }
      });
    });
  }

  function fetchSpaces(accessToken) {
    const apiUrl = 'https://api.pulze.ai/v1/apps/?search=&page=1&size=40';

    loadSpaceMappings().then(storedMappings => {
      fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        allSpaces = data.items.map(space => ({
          ...space,
          provider: 'none',
          connected: false,
          apiToken: ''
        }));

        // Assign providers based on stored mappings
        Object.keys(storedMappings).forEach(spaceId => {
          const space = allSpaces.find(s => s.id === spaceId);
          if (space) {
            space.provider = storedMappings[spaceId].provider;
            space.connected = storedMappings[spaceId].connected;
            space.apiToken = storedMappings[spaceId].apiToken;
          }
        });

        displaySpaces(allSpaces);
      })
      .catch(error => console.error('Error fetching spaces:', error));
    });
  }

  function displaySpaces(spaces) {
    loginSection.style.display = 'none';
    spacesSection.style.display = 'block';
    spaceList.innerHTML = '';

    spaces.forEach((space, index) => {
      const spaceItem = document.createElement('div');
      spaceItem.className = 'space-item';
      spaceItem.setAttribute('data-space-id', space.id);
      spaceItem.innerHTML = `
        <div class="logo-selection ${space.connected ? '' : 'disabled'}" id="logo-selection-${index}">
          <span class="logo-text">Assign</span>
          <img class="logo-img" src="" alt="Logo" style="display: none;">
          <span class="dropdown-arrow">&#9662;</span>
          <div class="dropdown-menu" id="dropdown-menu-${index}">
            <div class="dropdown-item" data-value="gmail">
              <img src="https://www.google.com/favicon.ico" alt="Google Logo"> Gmail
            </div>
            <div class="dropdown-item" data-value="smartlead">
              <img src="https://cdn.prod.website-files.com/6204a703ff61516512c04f55/631b012f135f706978f4f8e5_Group_6608_256x256.png" alt="Smartlead Logo"> Smartlead
            </div>
            <div class="dropdown-item" data-value="whatsapp">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp Logo"> WhatsApp
            </div>
          </div>
        </div>
        <strong>${space.name}</strong>
        <div class="status-radio ${space.connected ? 'connected' : ''}" id="status-radio-${index}">
          <input type="radio" id="status-radio-input-${index}" name="status-radio-${index}" value="${space.connected ? 'connected' : 'disconnected'}" ${space.connected ? 'checked' : ''}>
          <label for="status-radio-input-${index}">${space.connected ? 'Re-connect' : 'Connect'}</label>
        </div>
      `;
      spaceList.appendChild(spaceItem);

      const logoSelection = spaceItem.querySelector(`#logo-selection-${index}`);
      const dropdownMenu = spaceItem.querySelector(`#dropdown-menu-${index}`);
      const statusRadio = spaceItem.querySelector(`#status-radio-${index}`);
      const statusRadioInput = spaceItem.querySelector(`#status-radio-input-${index}`);
      const statusLabel = spaceItem.querySelector(`label[for="status-radio-input-${index}"]`);
      const logoImg = logoSelection.querySelector('.logo-img');
      const logoText = logoSelection.querySelector('.logo-text');

      if (space.provider !== 'none') {
        updateLogo(space.provider, logoImg, logoText);
      }

      logoSelection.addEventListener('click', function(event) {
        event.stopPropagation();
        if (space.connected) {
          dropdownMenu.classList.toggle('open');
        }
      });

      dropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', function(event) {
          event.stopPropagation();
          if (space.connected) {
            const value = this.getAttribute('data-value');
            space.provider = value;
            updateLogo(value, logoImg, logoText);
            dropdownMenu.classList.remove('open');
            updateSpaceMapping(space); // Ensure the mapping is updated when the provider is assigned
          }
        });
      });

      statusRadioInput.addEventListener('click', function() {
        if (statusRadioInput.value === 'disconnected') {
          connectSpace(space).then((updatedSpace) => {
            space = updatedSpace; // Update the local space object
            statusRadioInput.value = 'connected';
            statusRadio.classList.add('connected');
            statusLabel.textContent = 'Re-connect';
            statusRadioInput.style.borderColor = 'green';
            statusRadioInput.style.setProperty('--pulse-color', 'rgba(0, 255, 0, 0.7)');
            logoSelection.classList.remove('disabled');
            updateSpaceMapping(space); // Ensure the mapping is updated when the space is connected
          }).catch(error => {
            console.error('Failed to connect space:', error);
            alert('Failed to connect space. Please try again.');
          });
        } else {
          connectSpace(space).then((updatedSpace) => {
            space = updatedSpace; // Update the local space object
            updateSpaceMapping(space); // Ensure the mapping is updated when the space is reconnected
          }).catch(error => {
            console.error('Failed to re-connect space:', error);
            alert('Failed to re-connect space. Please try again.');
          });
        }
      });
    });

    document.addEventListener('click', function() {
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('open');
      });
    });
  }

  function updateLogo(provider, logoImg, logoText) {
    let logoSrc = '';
    let logoAlt = '';

    switch (provider) {
      case 'gmail':
        logoSrc = 'https://www.google.com/favicon.ico';
        logoAlt = 'Google Logo';
        break;
      case 'smartlead':
        logoSrc = 'https://cdn.prod.website-files.com/6204a703ff61516512c04f55/631b012f135f706978f4f8e5_Group_6608_256x256.png';
        logoAlt = 'Smartlead Logo';
        break;
      case 'whatsapp':
        logoSrc = 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg';
        logoAlt = 'WhatsApp Logo';
        break;
    }

    logoImg.src = logoSrc;
    logoImg.alt = logoAlt;
    logoImg.style.display = 'inline';
    logoText.style.display = 'none';
  }

  function updateSpaceMapping(updatedSpace) {
    return loadSpaceMappings().then(mappings => {
      // Check if the provider is already assigned to another space
      Object.keys(mappings).forEach(spaceId => {
        if (mappings[spaceId].provider === updatedSpace.provider && spaceId !== updatedSpace.id) {
          // Unassign the provider from the other space
          mappings[spaceId].provider = 'none';
          // Update the corresponding space in allSpaces
          const spaceToUpdate = allSpaces.find(s => s.id === spaceId);
          if (spaceToUpdate) {
            spaceToUpdate.provider = 'none';
            updateSpaceUI(spaceToUpdate);
          }
        }
      });

      // Update the mapping for the current space
      mappings[updatedSpace.id] = {
        provider: updatedSpace.provider,
        connected: updatedSpace.connected,
        apiToken: updatedSpace.apiToken
      };

      // Update the corresponding space in allSpaces
      const spaceIndex = allSpaces.findIndex(s => s.id === updatedSpace.id);
      if (spaceIndex !== -1) {
        allSpaces[spaceIndex] = { ...allSpaces[spaceIndex], ...updatedSpace };
      }

      // Save the updated mappings to chrome.storage.local
      return saveSpaceMappings(mappings).then(() => {
        // Refresh the entire display to ensure consistency
        displaySpaces(allSpaces);
        return updatedSpace;  // Return the updated space
      });
    });
  }

  function updateSpaceUI(space) {
    const spaceElement = document.querySelector(`[data-space-id="${space.id}"]`);
    if (spaceElement) {
      const logoSelection = spaceElement.querySelector('.logo-selection');
      const logoImg = logoSelection.querySelector('.logo-img');
      const logoText = logoSelection.querySelector('.logo-text');
      updateLogo(space.provider, logoImg, logoText);
    }
  }

  function connectSpace(space) {
    const apiUrl = `https://api.pulze.ai/v1/apps/${space.id}/regenerate-key`;
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('access_token', (result) => {
        const accessToken = result.access_token;
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
          },
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Update the space with the new API key
          const updatedSpace = {
            ...space,
            apiToken: data.created_key,
            connected: true
          };
          return updateSpaceMapping(updatedSpace);
        })
        .then(updatedSpace => {
          resolve(updatedSpace);
        })
        .catch(error => {
          console.error('Error connecting space:', error);
          reject(error);
        });
      });
    });
  }

  searchInput.addEventListener('input', function() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredSpaces = allSpaces.filter(space =>
      space.name.toLowerCase().includes(searchTerm)
    );
    displaySpaces(filteredSpaces);
  });

  loginButton.addEventListener('click', function() {
    authenticate()
      .then(accessToken => {
        fetchSpaces(accessToken);
      })
      .catch(error => {
        console.error('Authentication error:', error);
        loginSection.innerHTML += `<p style="color: red;">Authentication failed: ${error.message}</p>`;
      });
  });

  isAuthenticated().then(authenticated => {
    if (authenticated) {
      chrome.storage.local.get('access_token', (result) => {
        const accessToken = result.access_token;
        fetchSpaces(accessToken);
      });
    }
  });
});
