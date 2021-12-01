import { PREVIEW_ID_ATTRIBUTE, NESTED_COMPONENT_PREVIEW_ID_PREFIX } from './_consts.js';

export const $ = (selector, $scope = document) => $scope.querySelector(selector);

export const $$ = (selector, $scope = document) => [...$scope.querySelectorAll(selector)];

export const $uid = () => (performance.now() * 10 ** 13).toString(36);

export const $create = (selector) => {
  const [, tag = 'div', id, classes, attr] = selector.match(/^([a-z]+)?(?:#([^\.]+))?(?:\.([^\[]*))?(?:\[(.*)\])?$/);
  const $el = document.createElement(tag);
  if (!!id) $el[id] = id;
  if (!!classes) $el.className = classes.replace('.', ' ');
  if (!!attr) attr.split('][').forEach(pair => {
    const [, key, , value = ''] = pair.match(/^([^=]*)(?:=(['|"]?)(.*)\2)?$/);
    if (key !== '') $el.setAttribute(key, value);
  });
  return $el;
};

export const $Filter = {
  notNull: (any) => any !== null,
  distinct: (val, i, orig) => orig.indexOf(val) === i,
};

export class $EventEmitter {
  constructor() {
    this._eventHandlers = {};
  }
  on(eventName, listener) {
    if (!(eventName in this._eventHandlers)) this._eventHandlers[eventName] = [];
    this._eventHandlers[eventName].push(listener);
  }
  off(eventName, listener) {
    if (eventName in this._eventHandlers) {
      this._eventHandlers[eventName] = this._eventHandlers[eventName].filter((handler) => listener !== handler);
    }
  }
  async emit(eventName, ...args) {
    if (eventName in this._eventHandlers) {
      for (const handler of this._eventHandlers[eventName]) {
        await handler(...args);
      }
    }
  }
}

export const $wait = (millis) => new Promise(resolve => window.setTimeout(resolve, millis));

export const getNestedComponentPath = ($node) => {
  let nestedComponentPath = [];
  let parentPreviewId;

  if ($node.hasAttribute("parent-preview-id")) {
    // This possibility is meant for the case that it is not possible in the site representation
    // to show the same hierarchy as in FirstSpirit; this might be the case for input components
    // applicable to inline editing. In this case, that parent-preview-id is not found by traversing
    // the DOM but given using the "parent-preview-id" attribute.
    return {
      nestedComponentPath: [$node.getAttribute("data-preview-id").substr(1)],
      parentPreviewId: $node.getAttribute("parent-preview-id")
    };
  }

  let element = $node;
  while (element && element.getAttribute(PREVIEW_ID_ATTRIBUTE).startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX)) {
    nestedComponentPath.splice(0, 0, element.getAttribute(PREVIEW_ID_ATTRIBUTE).substr(1));
    element = element.parentNode.closest(`[${PREVIEW_ID_ATTRIBUTE}]`);
  }
  parentPreviewId = element.getAttribute(PREVIEW_ID_ATTRIBUTE);

  return { nestedComponentPath: nestedComponentPath, parentPreviewId: parentPreviewId };
}
