export const POST_MESSAGE_NAMESPACE = 'tpp';

export const VERSION = '${project.version}';
export const GIT_HASH = '${githash}';

export const MODULE_ENDPOINT = 'class:TppApi';
export const PREVIEW_ID_ATTRIBUTE = 'data-preview-id';
export const CUSTOM_PREVIEW_ID_PREFIX = 'custom:';
export const NESTED_COMPONENT_PREVIEW_ID_PREFIX = '#';

export const EVENT_FALLBACK_SUFFIX = 'Fallback';
export const CONTENT_CHANGE_EVENT = 'onContentChange';
export const CONTENT_CHANGE_FALLBACK_EVENT = `${CONTENT_CHANGE_EVENT}${EVENT_FALLBACK_SUFFIX}`;

export const Event = {
  // TPP Events
  Initialized: 'tpp-initialized',
  ElementChange: 'tpp-element-change',
  StatusChange: 'tpp-status-change',
  RerenderView: 'tpp-rerender-view',
  DropElement: 'tpp-drop-element',
  // WE Events (piped)
  PreviewRequest: 'TPP_PREVIEW_REQUEST',
  NavigationChange: 'TPP_NAVIGATION_CHANGED',
  WorkflowTransition: 'TPP_WORKFLOW_ACTION',
  // WE Events (custom)
  DragElement: 'TPP_DRAG_ACTION',
  DisplayChangesRequest: 'TPP_DISPLAY_CHANGES_REQUEST',
  ResetDisplayChangesRequest: 'TPP_RESET_DISPLAY_CHANGES_REQUEST',
  // WE Events (MPP)
  TppMppChange: 'TPP_MPP_CHANGE'
};

export const Action = {
  EDIT: 'EDIT',
  EDIT_NESTED_COMPONENT: 'EDIT_NESTED_COMPONENT',
  EDIT_META_DATA: 'EDIT_META_DATA',
  STATUS: 'STATUS',
  DELETE: 'DELETE',
  DELETE_WORKFLOW: 'DELETE_WORKFLOW',
  RENDER: 'RENDER',
  RENDER_START_NODE: 'RENDER_START_NODE',
  CREATE_PAGE: 'CREATE_PAGE',
  CREATE_SIBLING_SECTION: 'CREATE_SIBLING_SECTION',
  CREATE_CHILD_SECTION: 'CREATE_CHILD_SECTION',
  CREATE_DATASET: 'CREATE_DATASET',
  CREATE_NESTED_COMPONENT: 'CREATE_NESTED_COMPONENT',
  DELETE_NESTED_COMPONENT: 'DELETE_NESTED_COMPONENT',
  NESTED_COMPONENT_TEMPLATES: 'NESTED_COMPONENT_TEMPLATES',
  WORKFLOW_START: 'WORKFLOW_START',
  RELATED_ELEMENTS: 'RELATED_ELEMENTS',
  AFFECTED_ELEMENTS: 'GET_AFFECTED_WORKFLOW_ELEMENTS',
  WORKFLOW_PROCESS: 'WORKFLOW_PROCESS',
  CROP_IMAGE: 'CROP_IMAGE',
  TOGGLE_BOOKMARK: 'TOGGLE_BOOKMARK',
  FSID_TO_PREVIEW_ID: 'FSID_TO_PREVIEW_ID',
  PROJECT_INFO: 'PROJECT_INFO',
  TRANSLATION: 'TRANSLATION',
  TRANSFER_SECTION: 'TRANSFER_SECTION',
  TRANSFER_NESTED_COMPONENT: 'TRANSFER_NESTED_COMPONENT',
  TRANSFER_SECTION_ALLOWED: 'TRANSFER_SECTION_ALLOWED',
  REQUEST_CHANGE_SET: 'REQUEST_CHANGE_SET',
  SHOW_COMPARISON_DIALOG: 'SHOW_COMPARISON_DIALOG',
  SHOW_CUSTOM_DIALOG: 'SHOW_CUSTOM_DIALOG',
  FIELD_COMPONENT_TYPE: 'FIELD_COMPONENT_TYPE',
  UPDATE_FIELD_COMPONENT: 'UPDATE_FIELD_COMPONENT',
  START_INLINE_EDITING: 'START_INLINE_EDITING'
};

export const ComponentType = {
  CMS_INPUT_TEXT: 'CMS_INPUT_TEXT',
  CMS_INPUT_TEXTAREA: 'CMS_INPUT_TEXTAREA',
  CMS_INPUT_DOM: 'CMS_INPUT_DOM',
  CMS_INPUT_DOMTABLE: 'CMS_INPUT_DOMTABLE',
  CMS_INPUT_NUMBER: 'CMS_INPUT_NUMBER',
  CMS_INPUT_DATE: 'CMS_INPUT_DATE',
  FS_REFERENCE: 'FS_REFERENCE',
  NOT_SUPPORTED: 'NOT_SUPPORTED'
};

export class DuplicatePageError extends Error {
  constructor(message, previewId) {
    super(message);
    this.name = "DuplicatePageError";
    this.previewId = previewId;
  }

  getPreviewId() {
    return this.previewId;
  }
}

export class StartNodeNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "StartNodeNotFoundError";
  }
}

export const DECORATION_SYMBOL = Symbol('snap_decoration');
export const INLINE_EDIT_DECORATION_SYMBOL = Symbol('snap_decoration_inline_edit');
