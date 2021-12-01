import { $uid } from './$utils.js';
import { VERSION, MODULE_ENDPOINT, POST_MESSAGE_NAMESPACE, Event } from './_consts.js';


function CallbackRegistry() {
  const _callbacks = new Map();

  function _generateId(id = $uid()) {
    return _callbacks.has(id) ? _generateId() : id;
  }

  function register(callbackFn) {
    const id = _generateId();
    _callbacks.set(id, callbackFn);
    return id;
  }

  function resolve(callbackId, ...args) {
    if (_callbacks.has(callbackId)) {
      _callbacks.get(callbackId)(...args);
      _callbacks.delete(callbackId);
    } else {
      console.warn(`Unknown callbackId '${callbackId}'`, ...args);
    }
  }

  return Object.freeze({
    register,
    resolve,
    has: (id) => _callbacks.has(id)
  });
}


function parseIfJson(payload) {
  if (typeof payload === 'string' && payload.match(/^\s*[\[{"]/) !== null)
    try { return JSON.parse(payload); } catch (ignore) {}
  return payload;
}

function validateResponse(payload) {
  payload = parseIfJson(payload);

  if (payload !== null && typeof payload === 'object') {
     if ('error' in payload && 'object' in payload) {
       if (payload.error === true) {
         payload = null;
       } else {
         payload = parseIfJson(payload.object);
       }
     }
  }

  return payload;
}


export default function Messenger({ events, dataKey = POST_MESSAGE_NAMESPACE, targetFrame = window.top, targetOrigin = '*', testMode=false }) {
  const _callbacks = new CallbackRegistry();

  const _initializeSendMessage = function(resolve, maxTimes = 5) {
    sendMessage({ ping: true }, { timeout: 800 })
	  .then(receiver => {
	    if (VERSION !== receiver.version) {
	      console.warn(`TPP Version missmatch! Please update your resources! Unexpected errors may occur!\nsnap.js@${VERSION} != fs-tpp.fsm@${receiver.version}`);
	    }
	    resolve();
	    sendMessage({ connectApi: true});
	    events.emit(Event.Initialized, true, receiver.isLegacyCC);
	  }, (error) => {
	    if( maxTimes > 1 ) {
		  _initializeSendMessage(resolve, maxTimes - 1);
	    } else {
	      events.emit(Event.Initialized, false, false);
	      console.debug(error);
	    }
	  });
  }

  const _initialized = new Promise(resolve => {
    if (window.self !== window.top || testMode) {
      _initializeSendMessage(resolve);
    } else {
      events.emit(Event.Initialized, false, false);
    }
  });

  window.addEventListener('message', (e) => {
    if (e.data instanceof Object && POST_MESSAGE_NAMESPACE in e.data) {
      if (targetOrigin === '*') targetOrigin = e.origin;
      let { _messageType, _callbackId = null, _eventId = null, _response = null, _payload = null } = e.data[POST_MESSAGE_NAMESPACE];

      if (_messageType === 'CALLBACK') {
        console.debug('← %o', (_response = validateResponse(_response)));
        _callbacks.resolve(_callbackId, _response);
      } else if (_messageType === 'EVENT') {
        console.debug(`⇠ ${_eventId} %o`, (_payload = validateResponse(_payload)));
        events.emit(_eventId, _payload);
      }
    }
  });

  function _send(message) {
    targetFrame.postMessage({ [dataKey]: message }, targetOrigin);
  }

  async function sendMessage(message, { result = true, timeout = null } = {}) {
    if (!('ping' in message)) await _initialized;

    if (result) {
      return new Promise((resolve, reject) => {
        const _callbackId = _callbacks.register(resolve);

        if (timeout !== null) {
          setTimeout(() => {
            if (_callbacks.has(_callbackId)) {
              reject(new Error(`Timeout for Message[${JSON.stringify(message, null, 2)}]`));
            }
          }, timeout);
        }

        _send(Object.assign(message, { _callbackId }));
      });
    } else _send(message);
  }

  async function sendSubject(topic, payload = null, result = true) {
    return sendMessage({ [topic]: payload }, { result });
  }

  async function sendAction(action, params = {}, result = true) {
    return sendMessage({ execute: MODULE_ENDPOINT, params: Object.assign(params, { action }) }, { result });
  }

  return Object.freeze({ sendMessage, sendAction, sendSubject, on: events.on.bind(events) });
}
