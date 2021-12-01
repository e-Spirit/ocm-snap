import {
    CUSTOM_PREVIEW_ID_PREFIX,
    NESTED_COMPONENT_PREVIEW_ID_PREFIX,
    Event,
    PREVIEW_ID_ATTRIBUTE
} from "./_consts";

export default function ({messenger, events, actions, preview}) {

    const findAllElementsWithNonCustomPreviewId = function () {
        return Array.from(document.querySelectorAll("[" + PREVIEW_ID_ATTRIBUTE + "]"))
            .filter(n => !n.getAttribute(PREVIEW_ID_ATTRIBUTE).startsWith(CUSTOM_PREVIEW_ID_PREFIX) &&
                         !n.getAttribute(PREVIEW_ID_ATTRIBUTE).startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX));
    };

    const cssClassFsChangeDetected = 'fs-change-detected';
    const removeCssClassFsChangeDetected = function (elements) {
        document.querySelectorAll('.' + cssClassFsChangeDetected).forEach(e => e.classList.remove(cssClassFsChangeDetected));
    };

    function removeShadowOverlay() {
        document.querySelectorAll('.fs-changemask-solid').forEach(e => e.remove());
    }

    function applyShadowOverlay() {
        const visibleBoundingRects = [...document.querySelectorAll('.' + cssClassFsChangeDetected)].map(e => e.getBoundingClientRect())
        removeShadowOverlay();
        shadowEverythingExcept(visibleBoundingRects);
    }

    function calclulateBodyBoundingRect() {
        // see https://stackoverflow.com/questions/1145850/how-to-get-height-of-entire-document-with-javascript
        const bodyBoundingRect = document.body.getBoundingClientRect();
        const body = document.body;
        const html = document.documentElement;
        const height = Math.max(body.clientHeight, body.scrollHeight, body.offsetHeight,
                                html.clientHeight, html.scrollHeight, html.offsetHeight);
        const width = Math.max(body.clientWidth, body.scrollWidth, body.offsetWidth,
                               html.clientWidth, html.scrollWidth, html.offsetWidth);

        return new DOMRect(bodyBoundingRect.x, bodyBoundingRect.y, width, height);
    }

    function computeGridCells(actualRows, actualColumns) {
        const all = [];
        for (let i = 0; i < actualRows.length - 1; i++) {
            const row = actualRows[i];
            for (let j = 0; j < actualColumns.length - 1; j++) {
                const column = actualColumns[j];
                all.push({
                             top: row,
                             left: column,
                             width: actualColumns[j + 1] - column,
                             right: actualColumns[j + 1],
                             height: actualRows[i + 1] - row,
                             bottom: actualRows[i + 1]
                         });
            }
        }
        return all;
    }

    function addShadowOverlayFragment(rect, bodyRect) {
        const div = document.createElement("div");

        div.style.top = (rect.top - bodyRect.top) + "px";
        div.style.left = (rect.left - bodyRect.left) + "px";
        div.style.width = rect.width + "px";
        div.style.height = rect.height + "px";
        div.classList.add("fs-changemask-solid");

        document.body.appendChild(div);
    }

    function computeGrid(bodyRect, visibleBoundingRects ) {
        const rows = [bodyRect.top, bodyRect.bottom];
        const columns = [bodyRect.left, bodyRect.right];

        visibleBoundingRects.forEach(rect => {
            rows.push(rect.top, rect.bottom);
            columns.push(rect.left, rect.right);
        });

        const ascending = (a, b) => a - b;
        const actualRows = [...new Set(rows.sort(ascending))];
        const actualColumns = [...new Set(columns.sort(ascending))];

        return {actualRows, actualColumns}
    }

    function shadowEverythingExcept(boundingRects) {
        const bodyRect = calclulateBodyBoundingRect();
        const visibleBoundingRects = boundingRects.filter(rect => rect.width !== 0 && rect.height !== 0);
        const {actualRows, actualColumns} = computeGrid(bodyRect, visibleBoundingRects);

        const cells = computeGridCells(actualRows, actualColumns);
        cells.filter(cell => doesNotIntersectAny(cell, visibleBoundingRects)).forEach(cell => {
			addShadowOverlayFragment(cell, bodyRect);
        });
    }

    function doesNotIntersectAny(rect, visibleBoundingRects) {
        for (const visibleRect of visibleBoundingRects) {
            if (intersects(rect, visibleRect)) {
                return false;
            }
        }

        return true;
    }

    function intersects(a, b) {
        return a.left < b.right &&
               b.left < a.right &&
               a.top < b.bottom &&
               b.top < a.bottom
    }

    function addBordersToChangedElements(previewIds, changedIds, elements) {
        for (let i = 0; i < previewIds.length; i++) {
            const previewId = previewIds[i];
            if (changedIds.includes(previewId)) {
                elements[i].classList.add(cssClassFsChangeDetected);
            }
        }
    }

    async function stopDisplayingChanges() {
        events.emit(Event.ResetDisplayChangesRequest);
        messenger.sendMessage({ hideChanges: true }, {result: false});
    }

    const eventListeners = ["resize", "scroll", "transitionend", "animationend"];
    events.on(Event.DisplayChangesRequest, async function () {
        document.body.classList.add('tpp-disabled-node');

        const elements = findAllElementsWithNonCustomPreviewId();
        removeCssClassFsChangeDetected(elements);

        const previewIds = elements.map(e => e.getAttribute(PREVIEW_ID_ATTRIBUTE));
        let distinctPreviewIds = [...new Set(previewIds)];

        let changedIds = await actions.requestChangeSet(distinctPreviewIds);

        addBordersToChangedElements(previewIds, changedIds, elements);

        eventListeners.forEach ( eventListener => window.addEventListener(eventListener, applyShadowOverlay));
        applyShadowOverlay();

        document.body.classList.remove('tpp-disabled-node');

        events.on(Event.NavigationChange, stopDisplayingChanges);
        events.on(Event.PreviewRequest, stopDisplayingChanges);
        events.on(Event.ElementChange, stopDisplayingChanges);
    });

    events.on(Event.ResetDisplayChangesRequest, async function () {
        eventListeners.forEach ( eventListener => window.removeEventListener(eventListener, applyShadowOverlay));
        removeCssClassFsChangeDetected(findAllElementsWithNonCustomPreviewId());
        removeShadowOverlay();

        events.off(Event.NavigationChange, stopDisplayingChanges);
        events.off(Event.PreviewRequest, stopDisplayingChanges);
        events.off(Event.ElementChange, stopDisplayingChanges);
    });

    preview.addButton({
        label: "Compare",
        css: "tpp-icon-preview-diff",
        isVisible: (scope) => {
            return scope.$node.classList.contains(cssClassFsChangeDetected);
        },
        isEnabled: () => true,
        execute: async (scope) => {
            const previewId = scope.$node.getAttribute(PREVIEW_ID_ATTRIBUTE);
            await actions.showComparisonDialog(previewId);
        },
    });
}