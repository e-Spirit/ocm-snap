export default function ChangeStreamAdapter(preview, caasSettings, {updateTimeout}) {
  const changeListeners = [];

  establishConnection(caasSettings).catch((reason) => {
    console.error(reason);
  });

  async function establishConnection({previewCollectionUrl, apiKey}) {
    const url = new URL(previewCollectionUrl);
    // Can assume tenant is first path segment because this is a technical restriction of CaaS API
    const tenant = url.pathname.split("/")[1];
    const auth = await fetch(
        url.protocol + '//' + url.host + '/_logic/securetoken' + '?tenant=' + tenant,
        {headers: {'Authorization': `apikey="${apiKey}"`}},
    );
    const token = (await auth.json()).securetoken;
    const wsUrl = (url.protocol === 'https:' ? 'wss://' : 'ws://') + url.host + url.pathname +
        '/_streams/crud?securetoken=' + token;

    const ws = new ConnectionAwareWebSocket(wsUrl);
    ws.onMessage((event) => {
      const eventData = JSON.parse(event.data);
      const {
        documentKey: {_id: eventDocumentId},
        operationType: eventChangeType,
      } = eventData;
      changeListeners.filter(async ({previewId, language, changeTypes}) => {
        const documentId = await getDocumentIdFor(previewId, language);
        return documentId === eventDocumentId &&
            changeTypes.some((type) => type === eventChangeType);
      }).forEach((changeListener) => {
        changeListeners.splice(changeListeners.indexOf(changeListener), 1);
        changeListener.resolve();
      });
    });
    ws.connect();
  }

  async function getDocumentIdFor(previewId, language) {
    const previewLocale = (await preview.locales()).find(({lang}) => lang === language).locale;
    return previewId.includes('.') ? previewId : `${previewId}.${previewLocale}`;
  }

  function waitForDocumentUpdate(previewId, language) {
    return new Promise((resolve, reject) => {
      if (!previewId) {
        reject(
            `Waiting for CaaS document update cancelled. The provided preview id can't be null or undefined.`);
      }
      const changeListener = {previewId, language, changeTypes: ['insert', 'replace'], resolve};
      changeListeners.push(changeListener);
      window.setTimeout(() => {
        if (changeListeners.indexOf(changeListener) !== -1) {
          changeListeners.splice(changeListeners.indexOf(changeListener), 1);
          reject(`Waiting for CaaS document update timed out. Document was not updated in CaaS within ${updateTimeout} milliseconds.`);
        }
      }, updateTimeout);
    });
  }

  function waitForDocumentInsert(previewId, language) {
    return new Promise(async (resolve, reject) => {
      if (!previewId) {
        reject(`Waiting for CaaS document insert cancelled. The provided preview id can't be null or undefined.`);
      }

      waitForDocumentUpdate(previewId, language).
          then(() => resolve()).
          catch((reason) => reject(reason));

      const {previewCollectionUrl, apiKey} = caasSettings;
      const documentId = await getDocumentIdFor(previewId, language);
      // Checking whether document is already present
      fetch(previewCollectionUrl + '/' + documentId,
          {headers: {'Authorization': `apikey="${apiKey}"`}}).then((response) => {
        if (response.ok) {
          resolve();
        }
      });
    });
  }

  return {
    waitForDocumentUpdate,
    waitForDocumentInsert,
  };
}

function ConnectionAwareWebSocket(url, {
  reconnectionDelay = 1000,
  maxRetries = 10,
  keepAliveInterval = 20000,
} = {}) {
  let onmessage;
  let retryCount = 0;
  let ws;
  let keepAliveTimeout;

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      retryCount = 0;
      keepConnectionAlive();
    };
    ws.onmessage = onmessage;
    ws.onclose = () => {
      if (keepAliveTimeout) {
        clearTimeout(keepAliveTimeout);
        keepAliveTimeout = null;
      }
      if (retryCount < maxRetries) {
        retryCount++;
        reconnect();
      } else {
        throw new Error(`Failed to connect to WebSocket after ${maxRetries} attempts.`);
      }
    };
  }

  function keepConnectionAlive() {
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send('');
    keepAliveTimeout = setTimeout(keepConnectionAlive, keepAliveInterval);
  }

  function reconnect() {
    ws = null;
    setTimeout(() => connect(), reconnectionDelay);
  }

  return {
    onMessage: (fn) => onmessage = fn,
    connect,
  };
}