import {ComponentType, DECORATION_SYMBOL, Event, NESTED_COMPONENT_PREVIEW_ID_PREFIX, PREVIEW_ID_ATTRIBUTE} from './_consts.js';
import {$$, $create, getNestedComponentPath} from './$utils.js';
import DomObserver from './_dom-observer.js';
import InlineEdit from "./_inline-edit";

const renderButtons = async ({ container, buttons, scope, hide }) => {
  const visibles = await Promise.all(buttons.map(async (button) => {
    const $button = container.appendChild($create(`span.tpp-button[disabled]`));
    $button.setAttribute("tabindex", "0");

    try {
      if (await button.isVisible(scope)
          && (!scope.previewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX) || button.supportsComponentPath || button.supportsInedit)
          && (!scope.status.componentType || button.supportsInedit)) {

        scope = Object.assign({}, scope, { $button });

        if(button.supportsInedit) {
          container.classList.add("tpp-buttons-inline-edit");
        }
        const _execute = (item = undefined) => async (e) => {
          e.stopPropagation();
          hide();
          button.beforeExecute(scope, item);
          try {
            const result = await button.execute(scope, item);
            button.afterExecute(scope, item, result);
          } catch (e) {
            console.error(e);
            button.afterExecute(scope, item, null, e);
          }
        };

        button.getIcon(scope);
        Promise.resolve(button.isEnabled(scope)).then(enabled => enabled === true && $button.removeAttribute('disabled'));
        Promise.resolve(button.getLabel(scope)).then(label => label && ($button.title = label));
        $button.addEventListener('click', _execute());

        Promise.resolve(button.getItems(scope)).then(items => {
          if (items instanceof Array && items.length !== 0) {
            const $ul = $button.appendChild($create('ul'));
            items.forEach(item => {
              const $li = $ul.appendChild($create('li'));
              $li.innerText = item.label || item;
              $li.addEventListener('click', _execute(item));
            });
          }
        });

        return true;
      }
    } catch(err) {
      console.error(err);
    }
    
    $button.parentNode.removeChild($button);
  }));

  return visibles.some(isVisible => isVisible === true);
};


export default function Decoration({ events, actions, preview }) {
  const inlineEdit = InlineEdit({ actions, events, preview });

  let $container = null;

  class DecoratedElement {

    constructor(node) {
      this.$node = node;
      this.$node.decoration = this;

      this.$borders = $container.appendChild($create('.tpp-borders'));
      this.$buttons = this.$borders.appendChild($create('.tpp-buttons'));

      this._isVisible = false;
      this._intersectionChangeHandler = this.showButtons.bind(this);
      this._statusPreviewId = this.getPreviewId();
      this._status = undefined;

      try {
        this._targetResizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this._intersectionChangeHandler) : null;
      } catch(e) {
        this._targetResizeObserver = null;
      }


      this.getStatus().then(({ elementType, componentType }) => {
        if (elementType === 'Media') {
          this.$buttons.classList.add('bottom');
        }

        /**
         * Elements could be decorated and undecorated several times, when the page initializes
         * or is changing. So we have to check, if the current inline-decoration is still needed.
         *
         * If in future here comes more initialization after getStatus() resolves, it might be better
         * to refactor the whole decoration process and apply the whole decoration when getStatus()
         * resolves.
         */
        if(this.$node.decoration === this) {
          inlineEdit.addInlineEditing(node, componentType);
        }
      });

      let _timer = null;
      [this.$node, this.$buttons].forEach($el => {
        $el.addEventListener('mouseenter', () => clearTimeout(_timer) || this.showButtons());
        $el.addEventListener('mouseleave', () => _timer = setTimeout(this.hideButtons.bind(this), 10));
      });
    }

    getPreviewId() {
      return this.$node.getAttribute(PREVIEW_ID_ATTRIBUTE)
    }

    async getStatus() {
      let currentPreviewId = this.getPreviewId();
      if (! this._status || currentPreviewId !== this._statusPreviewId) {
        this._statusPreviewId = currentPreviewId;
        if (currentPreviewId !== null && currentPreviewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX)) {
          const { nestedComponentPath, parentPreviewId } = getNestedComponentPath(this.$node);
          this._status = Object.assign({}, await actions.getElementStatus(parentPreviewId)); // The status is probably cached; use Object.assign to make a deep copy so that the _status object will not change for multiple Decorations
          this._status.componentType = await actions.getFieldComponentType(parentPreviewId, nestedComponentPath);
          this._status.componentPath = nestedComponentPath;
        } else {
          this._status = Object.assign({}, await actions.getElementStatus(this.getPreviewId()));
          this._status.componentType = null;
        }
      }
      return this._status;
    }

    async showButtons() {
      const { top, left, width, height } = this.$node.getBoundingClientRect();
      this.$borders.style.cssText = `opacity:1;top:${top}px;left:${left}px;width:${width}px;height:${Math.max(height, 27)}px`;
      if (!this._isVisible) {
        this._isVisible = true;
        window.addEventListener('scroll', this._intersectionChangeHandler);
        window.addEventListener('resize', this._intersectionChangeHandler);
        if (this._targetResizeObserver !== null) this._targetResizeObserver.observe(this.$node);
        this.$buttons.innerHTML = '';
        const status = await this.getStatus();
        const language = await actions.getPreviewLanguage();
        const scope = { $node: this.$node, previewId: this.getPreviewId(), status, language };
        const hasButtons = await renderButtons({ container: this.$buttons, buttons: preview._buttons, scope, hide: () => this.hideButtons() });
        if (!hasButtons) {
          this.hideButtons();
        }
      }
    }

    hideButtons() {
      if (this._isVisible) {
        this._isVisible = false;
        window.removeEventListener('scroll', this._intersectionChangeHandler);
        window.removeEventListener('resize', this._intersectionChangeHandler);
        if (this._targetResizeObserver !== null) this._targetResizeObserver.disconnect();
        this.$borders.style.cssText = 'transition: all 0s';
      }
    }

    undecorate() {
      delete this.$node.decoration;
      delete this.$node[DECORATION_SYMBOL];
      if (this._targetResizeObserver !== null) this._targetResizeObserver.disconnect();
      window.removeEventListener('scroll', this._intersectionChangeHandler);
      window.removeEventListener('resize', this._intersectionChangeHandler);
      $container.removeChild(this.$borders);
    }

  }

  events.on(Event.Initialized, () => {
    $container = document.body.appendChild($create('.tpp-borders-container'));

    DomObserver({
      onInsert: (node) => {
        if (!(node[DECORATION_SYMBOL] instanceof DecoratedElement)) {
          node[DECORATION_SYMBOL] = new DecoratedElement(node);
        }
      },
      onRemove: (node) => {
        if (node[DECORATION_SYMBOL] instanceof DecoratedElement) {
          node[DECORATION_SYMBOL].undecorate();
        }
        inlineEdit.removeInlineEditing(node);
      }
    });
  });

  const findPreviewNodes = (previewId, neverReturnEmptyList = false) => {
    const list = $$(`[${PREVIEW_ID_ATTRIBUTE}="${previewId}"]`);
    return neverReturnEmptyList && list.length === 0 ? [null] : list;
  };

  events.on(Event.StatusChange, ({ previewId, status }) => {
    findPreviewNodes(previewId)
       .forEach($node => $node[DECORATION_SYMBOL]._status = status)
  });

  const _previewElementNode = async(previewIdOrNode) => {
    let previewElementNode;
    if (previewIdOrNode instanceof HTMLElement && previewIdOrNode.matches(`[${PREVIEW_ID_ATTRIBUTE}]`)) {
      previewElementNode = {
        previewId: previewIdOrNode.getAttribute(PREVIEW_ID_ATTRIBUTE),
        $node: previewIdOrNode
      };
    } else {
      previewElementNode = {
        previewId: previewIdOrNode,
        $node: findPreviewNodes(previewIdOrNode)[0] || null
      };
    }
    let _status;
    if (previewElementNode.previewId !== null && previewElementNode.previewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX)) {
	  const { nestedComponentPath, parentPreviewId } = getNestedComponentPath(previewElementNode.$node);
	  _status = Object.assign({ componentPath: nestedComponentPath }, await actions.getElementStatus(parentPreviewId));
	  previewElementNode.parentPreviewId = parentPreviewId;
	} else {
	  _status = await actions.getElementStatus(previewElementNode.previewId);
	}

    return Object.assign(previewElementNode, _status);
  };

  const _previewElementNodes = async() => Promise.all($$(`[${PREVIEW_ID_ATTRIBUTE}]`).map(_previewElementNode));

  Object.assign(actions, {
    findPreviewNodes,
    _previewElementNode,
    _previewElementNodes,
  });

}
