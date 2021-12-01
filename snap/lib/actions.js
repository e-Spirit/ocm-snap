import {Action, CUSTOM_PREVIEW_ID_PREFIX, NESTED_COMPONENT_PREVIEW_ID_PREFIX, Event, DuplicatePageError, StartNodeNotFoundError} from './_consts.js';


export default function Actions({ messenger, events, common }) {
  let _currentPreviewElement = null;
  let _currentPreviewLanguage = null;

  events.on(Event.ElementChange, () => messenger.sendMessage({ setPreviewElement: true, previewId: _currentPreviewElement }, false));

  events.on(Event.WorkflowTransition, async ({ previewId, isDeleted }) => {
    if (isDeleted) {
      await events.emit(Event.NavigationChange);
      events.emit(Event.ElementChange, { previewId, content: null });
    } else {
      events.emit(Event.StatusChange, { previewId, status: await getElementStatus(previewId) });
    }
  });

  async function sendAction(action, params = {}, result = true) {
    if(!params.previewLanguage && _currentPreviewLanguage) {
      params.previewLanguage =  _currentPreviewLanguage;
    }
    return messenger.sendAction(action, params, result);
  }

  const _statusCache = (() => {
    const _cache = new Map();

    const get = async (previewId, refresh = false) => {
      // entryKey construction for elements and nested components differs
      const entryKey = previewId;
      if ( !_cache.has(entryKey) || refresh) {
        // If the element's status was never requested (and this call shouldn't just refresh the cache),
        // it has to be fetched from FS and cached.
        if (previewId.startsWith(CUSTOM_PREVIEW_ID_PREFIX)) {
          const custom = previewId.substr(CUSTOM_PREVIEW_ID_PREFIX.length);
          _cache.set(previewId, new Promise((resolve) => resolve({ custom, parts: custom.split(':') })));
        } else {
          // To avoid duplicate requests because of network or server delays, we cache the API call as a promise, such
          // that if getElementStatus is repeated before the request is completed, it does not start a new one but also
          // waits for the first.
          _cache.set(entryKey, new Promise(async function(resolve) {
            // Request the status:
            const status = await sendAction(Action.STATUS, { previewId }) || {};
            if (status.name && status.name !== "unknown") {
              // Valid status that is to be cached
              Object.assign(status, { custom: null });
            }
            resolve(status);
          }));
        }
      }
      return await _cache.get(entryKey);
    }

    const invalidate = (previewId = null) => {
      if (previewId === null) {
        _cache.clear();
      } else {
        _cache.delete(previewId);
      }
    };

    return { get, invalidate };
  })();

  const _statusChanged = async (previewId) => {
    _statusCache.invalidate(previewId);
    const status = await getElementStatus(previewId);
    events.emit(Event.StatusChange, { previewId, status });
  };

  const _projectInfo = (() => {
    let _cache = null;
    const _project = async(invalidate = false) => {
      if (invalidate || _cache === null) {
        _cache = await sendAction(Action.PROJECT_INFO);
      }
      return _cache;
    };

    const languages = async(invalidate) => {
      const project = await _project(invalidate) || {languages: []};
      let languages = [];
      for (let { lang, master } of project.languages) {
        if (master) {
          _currentPreviewLanguage = _currentPreviewLanguage || lang;
          languages.unshift(lang);
        } else {
          languages.push(lang);
        }
      }
      return languages;
    };

    const locales = async(invalidate) => {
      const project = await _project(invalidate);
      let locales = [];
      for (let { lang, master, locale } of project.languages) {
        if (master) {
          locales.unshift({locale, lang});
        } else {
          locales.push({locale, lang});
        }
      }
      return locales;
    };

    const previewUrl = async(invalidate) => {
      const { previewUrl } = await _project(invalidate);
      return previewUrl;
    };

    return { languages, locales, previewUrl };
  })();


  async function execute(identifier, params = {}, result = true) {
    if (typeof identifier === "function") {
      return messenger.sendMessage({execute: {source: identifier.toString()}, params}, {result});
    } else {
      return messenger.sendMessage({execute: identifier, params}, {result});
    }
  }

  function getPreviewElement() {
    return _currentPreviewElement;
  }

  async function setPreviewElement(previewId) {
    _currentPreviewElement = previewId;
    if (previewId !== null) {
      const { language } = await getElementStatus(previewId);
      _currentPreviewLanguage = language || _currentPreviewLanguage;
      // Clearing status cache because setting the preview element can include switching to another preview language.
      // This is essentially a work around for the fact that we don't cache status data for uuids language-dependent yet.
      _statusCache.invalidate();
    }
    messenger.sendMessage({ setPreviewElement: true, previewId }, false);
  }

  async function getPreviewLanguage() {
    return _currentPreviewLanguage;
  }

  async function requestChangeSet(previewIds) {
    return sendAction(Action.REQUEST_CHANGE_SET, { previewIds });
  }

  async function showComparisonDialog(previewId) {
    const action = sendAction(Action.SHOW_COMPARISON_DIALOG, { previewId });
    mayTriggerChange(previewId, action);
  }

  async function showEditDialog(previewId, { nestedComponentPath = null } = {}) {
    let action;
    if(nestedComponentPath) {
        action = sendAction(Action.EDIT_NESTED_COMPONENT, { previewId, nestedComponentPath });
    } else {
        action = sendAction(Action.EDIT, { previewId });
    }
    mayTriggerChange(previewId, action);
  }

  async function createNestedComponent(previewId, nestedComponentPath, template) {
    let action = sendAction(Action.CREATE_NESTED_COMPONENT, { previewId, nestedComponentPath, template });
    mayTriggerChange(previewId, action);
  }

  async function getFieldComponentType(previewId, nestedComponentPath) {
    return await sendAction(Action.FIELD_COMPONENT_TYPE, { previewId, nestedComponentPath });
  }

  async function updateFieldComponent(previewId, nestedComponentPath, value) {
    return await sendAction(Action.UPDATE_FIELD_COMPONENT, { previewId, nestedComponentPath, value });
  }

  async function startInlineEditing(previewId, nestedComponentPath, { x, y, width, height }) {
    return await sendAction(Action.START_INLINE_EDITING, {previewId, nestedComponentPath, boundX: x, boundY: y, boundWidth: width, boundHeight: height});
  }

  async function moveNestedComponent(previewId, nestedComponentPath, index) {
    mayTriggerChange(previewId, sendAction(Action.TRANSFER_NESTED_COMPONENT, { previewId, nestedComponentPath, index }));
  }

  async function showMetaDataDialog(previewId) {
    const action = sendAction(Action.EDIT_META_DATA, { previewId });
    mayTriggerChange(previewId, action);
  }

  async function getElementStatus(previewId, refresh = false) {
    if (!previewId) throw new Error(`Missing PreviewId!`);
    return _statusCache.get(previewId, refresh);
  }

  async function renderElement(previewId = null) {
    if (previewId === null) {
      const result = await sendAction(Action.RENDER_START_NODE);
      if (result && result.isException) {
        throw new StartNodeNotFoundError("No start node available! Please check your configuration or use a valid preview ID!");
      }
      return result;
    } else {
      return await sendAction(Action.RENDER, { previewId });
    }
  }

  async function deleteElement(previewId, showConfirmDialog = false) {
    const status = await getElementStatus(previewId);
    const isInNavigation = ['Page', 'PageRef', 'PageRefFolder'].includes(status.elementType) || status.elementType.startsWith('Dataset');
    const result = await sendAction(Action.DELETE, { previewId, showConfirmDialog });
    _statusCache.invalidate();
    if (result) {
      if (isInNavigation) await events.emit(Event.NavigationChange, Object.assign({}, status));
      events.emit(Event.ElementChange, { previewId, content: null });
    } else {
      messenger.sendSubject('error', `Unable to delete ${status.elementType} "${status.displayName}" (id:${status.id})!`);
    }
  }

  async function deleteNestedComponent(previewId, nestedComponentPath, showConfirmDialog = false) {
    let action = sendAction(Action.DELETE_NESTED_COMPONENT, { previewId, nestedComponentPath, showConfirmDialog });
    mayTriggerChange(previewId, action);
  }

  async function availableTemplatesForNestedComponent(previewId, nestedComponentPath) {
    return sendAction(Action.NESTED_COMPONENT_TEMPLATES, { previewId, nestedComponentPath });
  }

  async function startWorkflow(previewId, workflow) {
    _statusCache.invalidate(previewId);
    return await sendAction(Action.WORKFLOW_START, { previewId, workflowUID: workflow });
  }

  async function processWorkflow(previewId, transition) {
    _statusCache.invalidate(previewId);
    return await sendAction(Action.WORKFLOW_PROCESS, { previewId, transitionId: transition });
  }

  async function createPage(path, name, template, { language = _currentPreviewLanguage, result = false, showFormDialog = true, forceUid = false } = {}) {
    const content = await sendAction(Action.CREATE_PAGE, { path, isUidPath: true, uid: name, template, language, showFormDialog, forceUid });
    if (forceUid && content && content.isException) {
    	throw new DuplicatePageError(`Failed to create page due to duplicate element with uid '${name}'.`, content.pagePreviewId);
    }
    _statusCache.invalidate();
    await events.emit(Event.NavigationChange, content.previewId);
    if (result) {
      return content;
    } else {
      events.emit(Event.RerenderView);
    }
  }

  async function createSection(previewId, { body = null, template = null, name = null, index = null, result = false } = {}) {
    const status = await getElementStatus(previewId);
    let pos = (index !== null) ? { positionIndex: ''+index, position: 'INDEX' } : { positionIndex: null, position: 'LAST' };
    _statusCache.invalidate();

    if (status.elementType === 'Section') {
      pos.position = pos.position === 'LAST' ? 'AFTER' : pos.position;
      const content = await sendAction(Action.CREATE_SIBLING_SECTION, { previewId, template, sectionName: name, position: pos.position, positionIndex: pos.positionIndex });
      if (result) {
        return content;
      } else {
        events.emit(Event.RerenderView);
      }

    } else if (['PageRef', 'Page', 'Body'].includes(status.elementType)) {
      const action = await sendAction(Action.CREATE_CHILD_SECTION, { previewId, body, template, sectionName: name, position: pos.position, positionIndex: pos.positionIndex });
      if (result) {
        return await action;
      } else {
        mayTriggerChange(previewId, action);
      }
    }
  }

  async function createDataset(template, { language = _currentPreviewLanguage, result = false } = {}) {
    const content = await sendAction(Action.CREATE_DATASET, { template, language });
    _statusCache.invalidate();
    if (result) {
      return content;
    } else {
      events.emit(Event.RerenderView);
    }
  }

  async function cropImage(previewId, resolution = 'ORIGINAL', result = false) {
    const content = await sendAction(Action.CROP_IMAGE, { previewId, resolution });
    if (content !== null) {
      if (result) {
        return content;
      } else {
        triggerChange(previewId, content);
      }
    }
  }

  // Do not use directly
  async function _transferSection(sectionId, targetId, { position = 'AFTER', mode = 'MOVE', skipRerenderEvent = false } = {}) {
    let success = await sendAction(Action.TRANSFER_SECTION, { sectionId, targetId, position, mode });
    if (success && !skipRerenderEvent) {
      events.emit(Event.RerenderView);
    }
    return success;
  }

  async function toggleBookmark(previewId) {
    await sendAction(Action.TOGGLE_BOOKMARK, { previewId });
    await _statusChanged(previewId);
  }

  async function languages(force = false) {
    return _projectInfo.languages(force);
  }

  async function locales(force = false) {
    return _projectInfo.locales(force);
  }

  async function previewUrl(force = false) {
    return _projectInfo.previewUrl(force);
  }

  async function showTranslationDialog(previewId, source, target) {
    const action = sendAction(Action.TRANSLATION, { previewId, source, target });
    mayTriggerChange(previewId, action);
  }

  async function showMessage(message, kind="info", title=null) {
    if (!(['info', 'error'].includes(kind))) kind = "info";
    return await messenger.sendAction(Action.SHOW_CUSTOM_DIALOG, { message, kind, title });
  }

  async function showQuestion(message, title=null) {
    return await messenger.sendAction(Action.SHOW_CUSTOM_DIALOG, { message, kind: "question", title });
  }

  const triggerChange = async (previewId, content = null) => {
    _statusChanged(previewId);
    if (content === null) {
      try {
        content = await renderElement(previewId);
      } catch(ignore) {}
    }
    events.emit(Event.ElementChange, { previewId, content });
  };
  const mayTriggerChange = async (previewId, action) => {
    const content = await action;
    if (content === null) {
      _statusChanged(previewId);
    } else {
      triggerChange(previewId, content);
    }
  };

  const triggerRerenderView = () => events.emit(Event.RerenderView);

  const _mppWrapper = async (method, ...args) => messenger.sendSubject('mpp', { method, args });
  const mppGetParameter = (name) => _mppWrapper('getParameter', name);
  const mppGetTimeParameter = () => _mppWrapper('getTimeParameter');
  const mppIsParameterized = () => _mppWrapper('isParameterized');
  const mppSetParameter = (name, value) => _mppWrapper('setParameter', name, value);
  const mppSetTimeParameter = (date) => _mppWrapper('setTimeParameter', date);

  return {
    execute,
    getPreviewElement,
    setPreviewElement,
    getPreviewLanguage,
    showEditDialog,
    moveNestedComponent,
    showMetaDataDialog,
    getElementStatus,
    renderElement,
    deleteElement,
    startWorkflow,
    processWorkflow,
    createPage,
    createSection,
    createDataset,
    createNestedComponent,
    deleteNestedComponent,
    availableTemplatesForNestedComponent,
    getFieldComponentType,
    updateFieldComponent,
    startInlineEditing,
    _transferSection,
    cropImage,
    toggleBookmark,
    triggerChange,
    triggerRerenderView,
    languages,
    locales,
    previewUrl,
    showTranslationDialog,
    showMessage,
    showQuestion,
    mppGetParameter,
    mppGetTimeParameter,
    mppIsParameterized,
    mppSetParameter,
    mppSetTimeParameter,
    requestChangeSet,
    showComparisonDialog
  };
};
