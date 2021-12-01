import { PREVIEW_ID_ATTRIBUTE } from './_consts.js';
/**
 * Manual polyfill. 
 * The elements provided by MutationObserver do not seem to be enhanced by babel-polyfills.
 */
if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}


// let _root, _selector, _attribute, _onInsert, _onRemove;

export default ({ onInsert, onRemove, root = document.body, attribute = PREVIEW_ID_ATTRIBUTE, selector = `[${attribute}]` }) => {
  let _onInsert = onInsert;
  let _onRemove = onRemove;
  let _root = root;
  let _attribute = attribute;
  let _selector = selector;


  const observer = (mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.removedNodes.length !== 0) findRemovedNodes(...mutation.removedNodes);
      if (mutation.addedNodes.length !== 0) findInsertedNodes(...mutation.addedNodes);
      if (mutation.type === 'attributes') {
        findRemovedNodes(mutation.target);
        findInsertedNodes(mutation.target);
      }
    }
  };

  const _nodeWalker = (handleFunction) => (...subtrees) => subtrees
    .filter(subtree => subtree instanceof HTMLElement)
    .forEach(subtree => {
      if (subtree.matches(_selector)) handleFunction(subtree);
      for (const node of subtree.querySelectorAll(_selector)) handleFunction(node);
    });

  const findInsertedNodes = _nodeWalker(node => {
    _onInsert(node);
    _nodes.set(node, true);
  });

  const findRemovedNodes = _nodeWalker(node => {
    if (_nodes.get(node) === true) {
      _onRemove(node);
      _nodes.delete(node);
    } else {
      _nodes.delete(node);
    }
  });

  const _observer = new MutationObserver(observer);
  const _nodes = new Map();

  _observer.observe(_root, { subtree: true, childList: true, attributes: true, attributeFilter: [_attribute] });
  findInsertedNodes(_root);
};
