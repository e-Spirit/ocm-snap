import {Action, Event, PREVIEW_ID_ATTRIBUTE, NESTED_COMPONENT_PREVIEW_ID_PREFIX} from './_consts.js';
import {$Filter} from './$utils.js';


export default function ({ events, messenger, actions, decoration, preview }) {

  const getAllowedSectionDropTargets = async(sourcePreviewIdOrNode) => {
    const source = await actions._previewElementNode(sourcePreviewIdOrNode);
    let targets = await actions._previewElementNodes();
    const $skipNode = sourcePreviewIdOrNode instanceof HTMLElement ? sourcePreviewIdOrNode : null;

    if (source.elementType === 'Section') {
      targets = targets.filter((target) => target.componentPath === undefined)
                       .filter(({ elementType, children, $node }) => elementType === 'Body'
                                                                 || (elementType === 'Section' && $node !== $skipNode)
                                                                 || (elementType === 'Page' && children.length === 1));

      if (targets.length !== 0) {
        const targetIds = targets.map(({ id }) => id).filter($Filter.distinct);
        const allowedIds = await messenger.sendAction(Action.TRANSFER_SECTION_ALLOWED, { sectionId: source.id, targetIds });
        targets = targets.filter(({ id }) => allowedIds.includes(id));
        return targets;
      }
    }

    return [];
  };

  const componentPathsEqual = (first, second) => {
    if (first.length !== second.length) return false;
    var index = 0;
    while( index < first.length-1 ) {
      if (first[index] !== second[index]) return false;
      index++;
    }
    return true;
  }

  const getAllowedNestedComponentDropTargets = async(sourcePreviewIdOrNode) => {
    const source = await actions._previewElementNode(sourcePreviewIdOrNode);
    let targets = await actions._previewElementNodes();

    if (!source.componentPath) return [];

    targets = targets.filter((target) => target.componentPath !== undefined)
                     .filter((target) => componentPathsEqual(source.componentPath, target.componentPath) && target !== source);

    return targets;
  }


  class UI {
    constructor() {
      this._$targets = [];
    }
    onDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
      onDragMove(e.clientX, e.clientY);
    }
    onDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      onDrop(e.clientX, e.clientY);
    }
    addTarget({ $node }) {
      this._$targets.push($node);
      $node.addEventListener('dragover', this.onDragOver);
      $node.addEventListener('drop', this.onDrop);
    }
    hitTarget(x, y) {
    }
    destroy() {
      this._$targets.forEach($node => {
        $node.removeEventListener('dragover', this.onDragOver);
        $node.removeEventListener('drop', this.onDrop);
      });
    }
  }

  class AutoScroll extends UI {
    constructor({ distance = 30, increment = 2, timeout = 100 } = {}) {
      super();
      this.distance = distance;
      this.increment = increment;
      this.timeout = timeout;
      this.scrollX = 0;
      this.scrollY = 0;
    }
    hitTarget(x, y) {
      this.scrollX = ((x <= this.distance && -1) || (window.innerWidth  - x < this.distance && 1)) * this.increment;
      this.scrollY = ((y <= this.distance && -1) || (window.innerHeight - y < this.distance && 1)) * this.increment;
      this.doScroll();
    }
    doScroll() {
      if (this.scrollX !== 0 || this.scrollY !== 0) {
        window.scrollBy(this.scrollX, this.scrollY);
        setTimeout(this.doScroll.bind(this), this.timeout);
      }
    }
    addTarget(target) {
      super.addTarget(target);
    }
    destroy() {
      super.destroy();
    }
  }

  class ZonesUI extends UI {
    constructor() {
      super();
      this.zones = [];
    }
    addZone({ top, left, width, height, x1, y1, x2, y2 }, details) {
      this.zones.push({ x1: x1 || left, y1: y1 || top, x2: x2 || left + width, y2: y2 || top + height, details });
    }
    hitZone(x, y) {
      const top = y + window.scrollY;
      const left = x + window.scrollX;

      const { details = {} } = this.zones
        .filter(({ x1, y1, x2, y2 }) => left >= x1 && left <= x2 && top >= y1 && top <= y2)
        .sort((a, b) => ((left - a.x1) * (top - a.y1)) - ((left - b.x1) * (top - b.y1)))
        [0] || {};

      return details;
    }
    rect($node) {
      const scroll = { top: window.scrollY, left: window.scrollX };
      const { top, left, width, height } = $node.getBoundingClientRect();
      return { top: top + scroll.top, left: left + scroll.left, width, height };
    }
  }

  class HorizontalDropBorder extends ZonesUI {
    constructor() {
      super();
      this.$dropBorder = document.body.appendChild(document.createElement('div'));
      this.$dropBorder.classList.add('tpp-drop-target');
      this.$dropBorder.style.cssText = 'display:none';
    }
    destroy() {
      super.destroy();
      document.body.removeChild(this.$dropBorder);
    }
    addTarget(target) {
      super.addTarget(target);
      const { $node, elementType, componentPath } = target;

      if (elementType === 'Section' || componentPath !== undefined) {
        const { top, left, width, height } = this.rect($node);
        this.addZone({ top, left, width, height: height / 2 },
          { before: true, top, left, width, target });
        this.addZone({ top: top + height / 2, left, width, height: height / 2 },
          { top: top + height, left, width, target });

      } else if (target.elementType === 'Body' || target.elementType === 'Page') {
        const { top, left, width, height } = this.rect($node);
        this.addZone({ top, left, width, height },
          { top: top + height, left, width, target });
      }
    }
    hitTarget(x, y) {
      const { target = null, top, left, width, before = false } = this.hitZone(x, y);
      if (target !== null) {
        this.$dropBorder.style.cssText = `top: ${top}px; left: ${left}px; width: ${width}px;`;
        return { $node: target.$node, previewId: target.previewId, position: before ? 'BEFORE' : 'AFTER' };
      } else {
        this.$dropBorder.style.cssText = 'display:none';
      }
    }
  }

  class VerticalDropBorder extends ZonesUI {
    constructor() {
      super();
      this.$dropBorder = document.body.appendChild(document.createElement('div'));
      this.$dropBorder.classList.add('tpp-drop-target');
      this.$dropBorder.style.cssText = 'display:none';
    }
    destroy() {
      super.destroy();
      document.body.removeChild(this.$dropBorder);
    }
    addTarget(target) {
      super.addTarget(target);
      const { $node, elementType, componentPath } = target;

      if (elementType === 'Section' || componentPath !== undefined) {
        const { top, left, width, height } = this.rect($node);
        this.addZone({ top, left, width: width / 2, height },
          { before: true, top, left, height, target });
        this.addZone({ top, left: left + width/2, width: width / 2, height },
          { top, left: left + width, height, target });
      } else if (target.elementType === 'Body' || target.elementType === 'Page') {
        const { top, left, width, height } = this.rect($node);
        this.addZone({ top, left, width, height },
          { top, left, height, target });
      }
    }
    hitTarget(x, y) {
      const { target = null, top, left, height, before = false } = this.hitZone(x, y);
      if (target !== null) {
        this.$dropBorder.style.cssText = `top: ${top}px; left: ${left}px; height: ${height}px; width: 5px;`;
        return { $node: target.$node, previewId: target.previewId, position: before ? 'BEFORE' : 'AFTER' };
      } else {
        this.$dropBorder.style.cssText = 'display:none';
      }
    }
  }

  class DragAndDropOperation {
    constructor({ $source = null, sourcePreviewId = null, mode = null, autoscroll = false, vertical = true } = {}) {
      this.source = { $source, sourcePreviewId, mode };

      document.body.classList.add('tpp-invisible');
      this.ui = [];
      if (autoscroll) this.ui.push(new AutoScroll());
      this.ui.push(vertical ? new VerticalDropBorder() : new HorizontalDropBorder());
    }
    addTarget(target) {
      for (const ui of this.ui) {
        ui.addTarget(target);
      }
    }
    addTargets(targets) {
      targets.forEach(target => this.addTarget(target));
    }
    onDrag(x, y, drop = false) {
      this.ui.forEach(ui => ui.hitTarget(x, y));
    }
    onDrop(x, y) {
      const targets = this.ui.map(ui => ui.hitTarget(x, y)).filter(target => !!target);
      if (targets.length === 1) {
        let { $source, sourcePreviewId, mode } = this.source;
        const { $node: $target, position } = targets[0];
        events.emit(Event.DropElement, { source: $source || sourcePreviewId, $target, mode, position });
      }
    }
    destroy() {
      document.body.classList.remove('tpp-invisible');
      this.ui.forEach(ui => ui.destroy());
    }
  }

  let _dnd = null;
  const onDragStart = async(previewIdOrNode) => {
    if (_dnd !== null) onDragEnd();

    if (previewIdOrNode instanceof HTMLElement) {
      let parentNode = previewIdOrNode;
      let selectedParent = null;
      while( selectedParent === null && parentNode !== null ) {
        if (parentNode.hasAttribute("dnd-orient") || parentNode.hasAttribute("data-preview-id")) selectedParent = parentNode;
        parentNode = parentNode.parentNode;
      }
      _dnd = new DragAndDropOperation({
        $source: previewIdOrNode, mode: 'MOVE',
        vertical: selectedParent === null || !selectedParent.hasAttribute("dnd-orient") || selectedParent.getAttribute("dnd-orient") === "vertical"
      });
    } else {
      _dnd = new DragAndDropOperation({ sourcePreviewId: previewIdOrNode, mode: 'COPY', autoscroll: true });
    }

    const { elementType, componentPath } = await actions._previewElementNode(previewIdOrNode);
    if (componentPath !== undefined) {
      _dnd.addTargets(await getAllowedNestedComponentDropTargets(previewIdOrNode));
    } else if (elementType === 'Section') {
      _dnd.addTargets(await getAllowedSectionDropTargets(previewIdOrNode));
    }
  };
  const onDragEnd = () => {
    if (_dnd !== null) _dnd.destroy();
    _dnd = null;
  };
  const onDragMove = (x, y) => _dnd !== null && _dnd.onDrag(x, y);
  const onDrop = (x, y) => _dnd !== null && _dnd.onDrop(x, y);


  actions.makeTransferable = ($draggable, $node = $draggable ) => {
    $draggable.setAttribute('draggable', 'true');

    const previewId = $node.getAttribute(PREVIEW_ID_ATTRIBUTE);
    if (previewId) {
      $draggable.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', previewId);
        try { e.dataTransfer.setDragImage($node, 0, 0); } catch(ignore) {}
        $node.classList.add('tpp-disabled-node');
        onDragStart($node);
      });
      $draggable.addEventListener('dragend', (e) => {
        $node.classList.remove('tpp-disabled-node');
        onDragEnd();
      });
    }
  };

  events.on(Event.DragElement, ({ previewId, phase, start, drag, drop, end, x, y }) => {
    switch (phase) {
      case 'start': return onDragStart(previewId, { autoscroll: true });
      case 'drag': return onDragMove(x, y);
      case 'drop': return onDrop(x, y);
      default: return onDragEnd();
    }
  });

  events.on(Event.DropElement, async ({ source, $target, mode, position }) => {
    const { previewId, elementType: sourceElementType, id: sourceId, $node: $source, componentPath = [], parentPreviewId = null } = await actions._previewElementNode(source);

    if (componentPath.length != 0) {
      const res = await actions._previewElementNode($target);
      let targetIndex =  parseInt(res.componentPath[res.componentPath.length-1]);
      let currIndex = parseInt(componentPath[componentPath.length-1]);
      if( position === 'BEFORE' && currIndex < targetIndex ) targetIndex--;
      else if( position === 'AFTER' && currIndex > targetIndex ) targetIndex++;
      const execute = async() => actions.moveNestedComponent(parentPreviewId, componentPath, targetIndex);

      if ($source !== $target) {
          await execute();
      }
    } else if (sourceElementType === 'Section') {
      const { elementType: targetElementType, id: targetId } = await actions._previewElementNode($target);
      const execute = async(skipRerenderEvent = false) => actions._transferSection(sourceId, targetId, { position, mode, skipRerenderEvent });

      if ($source !== $target) {
        if (mode === 'MOVE' && targetElementType === 'Section') {
          // Avoiding triggering of re-render or content change events because this is one of the few times where SNAP
          // actually defines the render logic for changes (section dnd in this case).
          // However, providing a way to override the default behavior through API might be a viable long-term solution.
          if (position === 'BEFORE') {
            if ($target !== $source.nextElementSibling) {
              const success = await execute(true);
              if (success) {
                $target.insertAdjacentElement('beforebegin', $source);
              }
            }
          } else {
            if ($target !== $source.previousElementSibling) {
              const success = await execute(true);
              if (success) {
                $target.insertAdjacentElement('afterend', $source);
              }
            }
          }
        } else {
          await execute();
        }
      }
    }
  });

  // Move Button
  preview.registerButton({
    _name: 'move',
    isVisible: ({ status: { elementType } }) => {
      return elementType === 'Section';
    },
    isEnabled: async({ $node }) => {
      const targets = await getAllowedSectionDropTargets($node);
      return targets.length !== 0;
    },
    getIcon: ({ $button, $node }) => {
      $button.className += ' tpp-icon-move tpp-separator';
      $button.style.cursor = 'crosshair';
      actions.makeTransferable($button, $node);
    }
  }, 0);

  preview.registerButton({
    _name: 'nested-component-move',
    supportsComponentPath: true,
    isVisible: ({ previewId }) => {
      return previewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX) && !isNaN(parseInt(previewId.substr(1)));
    },
    isEnabled: async({ $node }) => {
      const targets = await getAllowedNestedComponentDropTargets($node);
      return targets.length !== 0;
    },
    getIcon: ({ $button, $node }) => {
      $button.className += ' tpp-icon-move tpp-separator';
      $button.style.cursor = 'crosshair';
      actions.makeTransferable($button, $node);
    }
  }, 0);
}
