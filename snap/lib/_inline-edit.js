import {getNestedComponentPath} from "./$utils";
import {ComponentType, Event, INLINE_EDIT_DECORATION_SYMBOL} from "./_consts";


export default function ({actions, events, preview}) {

    // Inedit buttons
    preview.registerButton({
        _name: 'inedit-start-editing',
        supportsInedit: true,
        css: 'tpp-icon-edit',
        isVisible: ({ $node }) => !$node.isContentEditable && $node.dataset.type,
        isEnabled: () => true,
        getLabel: async () => await TPP_SNAP.execute(() => WE_API.Common.getLocale()) === 'de' ? 'Bearbeiten' : 'Edit',
        execute: async ({ $node }) => {
            const inlineEditSymbol = $node[INLINE_EDIT_DECORATION_SYMBOL];
            if(inlineEditSymbol) {
                await inlineEditSymbol.startEditing();
            }
        }
    });


    function calcBoundingRect(node, type) {
        let {x, y, width, height} = node.getBoundingClientRect();
        if (type === ComponentType.CMS_INPUT_DATE) {
            // Fix styling problems of date component
            // Could be removed, when
            //   https://projects.e-spirit.de/browse/CXT-2354
            // is fixed.
            const MIN_DATE_WIDTH = 246;
            width = Math.max(width, MIN_DATE_WIDTH);
        }
        return {x, y, width, height};
    }

    async function addInlineEditing(node, type) {
        if (node.getAttribute("data-preview-id").startsWith("#")) {
            const {nestedComponentPath, parentPreviewId} = getNestedComponentPath(node);
            if (type !== null && type !== ComponentType.NOT_SUPPORTED) {
                node.dataset.type = type;

                const inlineEditDecorSymbol = {};
                inlineEditDecorSymbol.startEditing = async () => {
                    let boundingRect = calcBoundingRect(node,type);
                    const inlineResult = await actions.startInlineEditing(
                        parentPreviewId, nestedComponentPath, boundingRect);

                    if (inlineResult !== null) {
                        if(inlineResult.rerender){
                            events.emit(Event.RerenderView);
                        }else{
                            node.innerText = inlineResult.value;
                        }
                    }
                };
                node[INLINE_EDIT_DECORATION_SYMBOL] = inlineEditDecorSymbol;
            }
        }
    }

    async function removeInlineEditing(node) {
        if (node.dataset.type) {
            delete node[INLINE_EDIT_DECORATION_SYMBOL];
            delete node.dataset.type
        }
    }

    return Object.freeze({addInlineEditing, removeInlineEditing});
}
