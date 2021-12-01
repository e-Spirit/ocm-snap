import {
  Event,
  PREVIEW_ID_ATTRIBUTE,
  EVENT_FALLBACK_SUFFIX,
  CONTENT_CHANGE_FALLBACK_EVENT,
  CONTENT_CHANGE_EVENT
} from './lib/_consts.js';
import {$, $EventEmitter} from './lib/$utils.js';
import Messenger from './lib/_messenger.js';
import Actions from './lib/actions.js';
import Decoration from './lib/decoration.js';

import DefaultButtons from './lib/_default-buttons.js';
import DragAndDrop from './lib/_dnd.js';
import DisplayChanges from './lib/_display-change-set.js';
import ChangeStreamAdapter from "./lib/change-stream-adapter.js";

import oldStyle from '../common/fs-tpp.css';
import newStyle from '../common/fs-tpp-new.css';

oldStyle.use();

/**
 * The fs-tpp-api/snap.js must be used in the markup of the third party app. There is no specific
 * position defined, but if you want to use the API of window.TPP_SNAP, your own script
 * must be loaded after the inclusion fs-tpp-api/snap.js, of course.
 * You could define the optional [data-firstspirit-origin] attribute to ensure that the
 * first(!) postMessage (aka. TPP handshake) is only committed to the real ContentCreator frame.
 *
 * ```html
 * <script src="path/to/fs-tpp-api/snap.js" data-firstspirit-origin="http://firstspirit:8000"></script>
 * ```
 *
 * All you have to do is use the [data-preview-id] in your markup. This library
 * automatically decorates those containers with the known borders and buttons. Content
 *  changes will force a refresh of the current page, so there is no need to implement in JS!
 *
 * But of course you are able to do this by using the framework! That's what the docs are for...
 *
 * As an example, a FirstSpirit Template delivers some HTML Markup, which you would like to update
 * in-place in case of changes. You could use the [data-on-tpp-change] attribute which is
 * a representation of the {@link onContentChange~Handler}. Or you use it directly, like this:
 *
 * ```javascript
 * TPP_SNAP.onContentChange(($node, previewId, content) => {
 *   if ($node.matches('.content') && content !== null) {
 *     $node.innerHTML = content;
 *     return false;
 *   }
 * })
 * ```
 *
 * You can register multiple handlers. Further processing of the event is stopped after the first
 * handler returns a value !== undefined.
 *
 * ```html
 * <div class="content"
 *   data-preview-id="<previewId>"
 *   data-on-tpp-change="if (content !== null) { this.innerHTML = content; return false; }">
 * </div>
 * ```
 * <h2 id="preview-element">Preview Element <a href="#preview-element" class="anchorjs-link" data-anchorjs-icon="" style="font-family: anchorjs-icons"></a></h2>
 *
 * To change the current preview element, you should use the method {@link #tpp_snapsetpreviewelement|TPP_SNAP.setPreviewElement}. This
 * also ensures that the ContentCreator keeps track of the route change and the shown workflows are those
 * of the current element:
 *
 * ```javascript
 * TPP_SNAP.setPreviewElement(pageRefPreviewId);
 * ```
 *
 * Note that for navigating to another page, you should use the preview ID for its PageRef instead for the page itself.
 *
 * For being able to open pages from within the ContentCreator (e.g. to use the search function) you have to
 * specify your own listener to handle this request. The method to use for this purpose is {@link #tpp_snaponrequestpreviewelement|TPP_SNAP.onRequestPreviewElement}.
 * A handler registered with `onRequestPreviewElement` should implement the frontend specific way to route to the
 * requested page using the given preview id.
 *
 * ```javascript
 * TPP_SNAP.onRequestPreviewElement(async (previewId) => {
 *   // The following previewIdToPath function is just a placeholder! The mapping from previewId to route has
 *   // to be defined project-dependent!
 *   let path = previewIdToPath(previewId);
 *
 *   // The routing mechanism depends on the frontend as well, thus the "route" function also has to
 *   // be understood as a placeholder!
 *   if (path) return route(path);
 *   // ... error handling (e.g. 404) ...
 * }
 * ```
 *
 * <h2 id="nested-components">Nested Components <a href="#nested-components" class="anchorjs-link" data-anchorjs-icon="" style="font-family: anchorjs-icons"></a></h2>
 *
 * Nested components of input components such as [FS_CATALOG](https://docs.e-spirit.com/odfs/template-develo/forms/input-component/catalog/index.html)
 * or [FS_INDEX](https://docs.e-spirit.com/odfs/template-develo/forms/input-component/index/index.html) can be edited as well.
 * To enable the editing of such a component make sure to provide a custom preview id for both the nested component as well as
 * the parent component using the syntax `#PARENT_COMPONENT_NAME` and `#NESTED_COMPONENT_INDEX` as the following example shows.
 *
 * ```html
 * <div data-preview-id="8326527a-60ff-49a0-bc66-91671d660249">
 *     <ul data-preview-id="#pt_catalog">
 *         <li data-preview-id="#0">This is content from the first entry.</li>
 *         <li data-preview-id="#1">The second component does have different content.</li>
 *         <li data-preview-id="#2">And of course, this is also different.</li>
 *     </ul>
 * </div>
 * ```
 * Notice that the presence of the preview id of the data provider that contains the FS_CATALOG component is needed.
 * As long as the HTML complies with this structure the individual nested components will automatically provide buttons for interaction.
 *
 * > **_NOTE:_**  This feature also works for multiple nested components (e.g. a [Catalog$Card](https://docs.e-spirit.com/odfs/template-develo/template-syntax/data-types/card/index.html)
 * > that is part of of a [Index$Record](https://docs.e-spirit.com/odfs/template-develo/template-syntax/data-types/record/index.html)). It must be noted that in such a scenario, the
 * > path to a nested component must always alternate between a component name and an index. Additionally the last part of the path must always be an index of a nested component.
 *
 * > **_NOTE:_** Currently only FS_INDEX components that [use the DatasetDataAccessPlugin](https://docs.e-spirit.com/odfs/template-develo/forms/input-component/index/index.html#2__beispiel__datasetdataaccessplugin) are supported.
 *
 *
 * <h2 id="inline-editing">Inline Editing<a href="#inline-editing" class="anchorjs-link" data-anchorjs-icon="" style="font-family: anchorjs-icons"></a></h2>
 *
 * Some input components support inline editing when enabled. All input components named in the [FirstSpirit Online Documentation](https://docs.e-spirit.com/odfs/template-develo/content-highlig/use-projects/index.html#unterstuetzte_eingabekomponenten__inedit) are supported.
 * To enable inline editing for such components a custom preview id needs to be provided as a data attribute on the related DOM node
 * using the syntax `#INPUT_COMPONENT_NAME`.
 *
 * The following example includes a DOM node that corresponds to a `CMS_INPUT_TEXT` component with the name `pt_headline`.
 *
 * ```html
 * <div data-preview-id="8326527a-60ff-49a0-bc66-91671d660249">
 *     <span data-preview-id="#pt_headline">
 *         Our various services for sales, marketing and installation branches.
 *     </span>
 * </div>
 * ```
 *
 * Notice that the presence of the preview id of a data provider that contains the editable input component is needed.
 * As long as the HTML complies with this structure the component will automatically become inline editable.
 *
 *
 * <h2 id="caas-mode">CaaS Mode <a href="#caas-mode" class="anchorjs-link" data-anchorjs-icon="" style="font-family: anchorjs-icons"></a></h2>
 *
 * The CaaS mode is mainly useful for scenarios where your web app uses the CaaS as the source for
 * FirstSpirit content and your app can't render changed content dynamically (e.g. using the
 * respective event handlers).
 *
 * Whenever a re-rendering of the current page or the preview of an element was requested, this mode
 * waits for the changed content to be present in the CaaS and then triggers the related handlers
 * ({@link onRerenderView~Handler} or {@link onRequestPreviewElement~Handler}).
 *
 * To enable the CaaS mode use the {@link #tpp_snapenablecaasmode|TPP_SNAP.enableCaasMode} function.
 *
 * ```javascript
 * TPP_SNAP.onInit(async (success) => {
 *   if(success) {
 *     const { previewCollectionUrl, apiKey } = {
 *       previewCollectionUrl: "https://caas-host/my-tenant-id/f948bb48-4f6b-4a8a-b521-338c9d352f2b.preview.content",
 *       apiKey: "9afa9e21-d02f-4836-9e55-111fcf6521a3"
 *     }
 *     TPP_SNAP.enableCaasMode(previewCollectionUrl, apiKey)
 *   }
 * })
 * ```
 *
 * > **_NOTE:_** When using the CaaS mode in combination with dynamically rendering changed content (e.g. using
 * the {@link onContentChange~Handler}) make sure to avoid handling any content changes that
 * should lead to a re-rendering of the current page.
 *
 * > **_NOTE:_** The CaaS mode requires a minimum version for the CaaS platform and CaaS Connect
 * module, see {@link #tpp_snapenablecaasmode|TPP_SNAP.enableCaasMode} for more information.
 *
 * <h2 id="default-buttons">Default Buttons <a href="#default-buttons" class="anchorjs-link" data-anchorjs-icon="" style="font-family: anchorjs-icons"></a></h2>
 *
 * <style>
 *    .complete-table th, .complete-table td {
 *        border: 1px solid #ddd;
 *        padding: 8px;
 *    }
 *
 *    .complete-table td:nth-child(1) {
 *        font-family: monospace;
 *    }
 * </style>
 * <details>
 *   <summary> (Click to expand) Overview of default buttons shipped with Snap:</summary>
 * <table class="complete-table">
 *    <thead>
 *        <th>Button Name</th>
 *        <th>Visibility</th>
 *        <th>Requirement</th>
 *        <th>Functionality</th>
 *    </thead>
 *    <tr>
 *        <td>edit</td>
 *        <td>Visible on elements of type <code>PageRef</code>, <code>Page</code>, <code>Section</code>, <code>GCAPage</code>, <code>GCASection</code>, <code>Dataset</code> and <code>SectionReference</code>.</td>
 *        <td>The current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canChange--">permission to change</a> the element's content.</td>
 *        <td>This button opens a dialog which enables the user to edit the element's content.</td>
 *    </tr>
 *    <tr>
 *        <td>translate</td>
 *        <td>Visible on elements of type <code>PageRef</code>, <code>Page</code>, <code>Section</code>, <code>GCAPage</code>, <code>GCASection</code>, <code>Dataset</code> and <code>SectionReference</code> being defined as multi-language.</td>
 *        <td>The current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canChange--">permission to change</a> the element's content.</td>
 *        <td>The user may select a translation from the current to another possible language, which will bring up the respective translation dialog.</td>
 *    </tr>
 *    <tr>
 *        <td>metadata</td>
 *        <td>Not visible by default; for this button to be shown, it should be overridden by the developer.</td>
 *        <td>The current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canMetaChange--">permission to change</a> the element's meta data.</td>
 *        <td>On click, this buttons opens the meta data dialog for the current element.</td>
 *    </tr>
 *    <tr>
 *        <td>add-sibling-section</td>
 *        <td>Only visible on sections.</td>
 *        <td>The current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canChange--">permission to change</a> the page.</td>
 *        <td>Opens a dialog for creating a new sibling section.</td>
 *    </tr>
 *    <tr>
 *        <td>add-child-section</td>
 *        <td>Only visible on elements of type <code>Page</code> with one <code>Body</code> element as a child.</td>
 *        <td>The current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canAppendLeaf--">permission to add a new leaf</a> to the current page.</td>
 *        <td>Opens a dialog for creating a new section as a child of the page's Body element.</td>
 *    </tr>
 *    <tr>
 *        <td>add-child-section-body</td>
 *        <td>Only visible on elements of type <code>Body</code>.</td>
 *        <td>The current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canAppendLeaf--">permission to add a new leaf</a> to the current page.</td>
 *        <td>Opens a dialog for creating a new section as a child of the body.</td>
 *    </tr>
 *    <tr>
 *        <td>workflows</td>
 *        <td>Only visible on elements supporting a release whilst not using a custom workflow; also, if no workflow has already been started for the element, at least one must be allowed.</td>
 *        <td>If visible, this button is always enabled.</td>
 *        <td>The user has to select either a new workflow to start, if none is already, or the next transition to take.</td>
 *    </tr>
 *    <tr>
 *        <td>tpp-icon-delete</td>
 *        <td>Not visible on elements of type <code>Body</code> or <code>Media</code>.</td>
 *        <td>If a workflow is enabled, only usable if the element is neither of type <code>Section</code> nor <code>SectionReference</code> and a deletion workflow is defined. If no workflow is used, the user has to be granted the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canDelete--">deletion permission</a>.</td>
 *        <td>The button does either start a delete workflow if workflows are used, otherwise it deletes the selected element directly.</td>
 *    </tr>
 *    <tr>
 *        <td>tpp-icon-crop-image</td>
 *        <td>Only visible on elements of type <code>Media</code>.</td>
 *        <td>Only applicable if the user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canChange--">permission to change</a> this element.</td>
 *        <td>On click, opens a dialog which allows the user to crop the selected image. The default resolution used for this action is "ORIGINAL", but can be specified by the developer via setting the attribute <code>data-tpp-context-image-resolution</code> to <code>res1, res2</code> in the DOM.</td>
 *    </tr>
 *    <tr>
 *        <td>bookmark</td>
 *        <td>Only visible on elements of type <code>Page</code>, <code>PageRef</code>, <code>Section</code>, <code>Dataset</code> or <code>SectionReference</code>.</td>
 *        <td>If visible, this button is always enabled.</td>
 *        <td>On click, the selected element is added to (or removed from) the project bookmarks which can be viewed in the ContentCreator toolbar.</td>
 *    </tr>
 *    <tr>
 *        <td>edit-component</td>
 *        <td>Visible on components lying inside a "nested component" structure.</td>
 *        <td>Usable if the current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canChange--">permission to change</a> the element's content.</td>
 *        <td>On click, this button opens a dialog which enables the user to edit the selected component.</td>
 *    </tr>
 *    <tr>
 *        <td>create-component</td>
 *        <td>Visible on catalog or index components inside a "nested component" structure.</td>
 *        <td>Usable if the current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canAppendLeaf--">permission to add a new leaf</a> to the page.</td>
 *        <td>The user may select an applicable template for a subordinate component to be created; on click, the Create dialog is shown.</td>
 *    </tr>
 *    <tr>
 *        <td>delete-component</td>
 *        <td>Visible on components lying inside a "nested component" structure.</td>
 *        <td>Usable if the current user has the <a href="https://docs.e-spirit.com/odfs/access/de/espirit/firstspirit/access/store/Permission.html#canDelete--">permission to delete</a> the element.</td>
 *        <td>On click, this button deletes the selected element after confirmation.</td>
 *    </tr>
 * </table>
 * </details>
 * <br>
 *
 * @namespace TPP_SNAP
 */
class FirstSpiritPreview {
  constructor({ actions }) {
    this._actions = actions;
    this._buttons = [];
    this._resolver = null;
    this.caasMode = false
    this.changeStreamAdapter = null
    this._listener = [
      [`${CONTENT_CHANGE_FALLBACK_EVENT}`, async ($node, previewId, content) => {
        const event = new CustomEvent('tpp-update', { detail: { previewId, content }, bubbles: false, cancelable: true });
        if (!$node) { // content change on previewId which is not directly in DOM (e.g. the (CC-)PreviewElement)
          const cancelled = !document.body.dispatchEvent(event);
          return cancelled ? false : undefined;
        }
        const cancelled = !$node.dispatchEvent(event);
        if (cancelled) return false;

        if ('onTppUpdate' in $node.dataset) {
          // via attribute [data-on-tpp-update]
          return await (new Function('previewId', 'content', $node.dataset.onTppUpdate)).call($node, previewId, content);

        } else if (content === null) {
          // node is deleted
          if (previewId === await this.getPreviewElement()) {
            return location.href = await this.previewUrl();
          }
          const $parent = $node.parentNode;
          $node.parentNode.removeChild($node);
          return $parent.querySelector('[data-preview-id]') || undefined;

        } else if (typeof content === 'string') {
          // if result is html markup try to replace
          const fragment = document.createDocumentFragment();
          fragment.appendChild(document.createElement('div')).innerHTML = content;
          const nodes = [...fragment.firstChild.children];
          if (nodes.length === 1 && nodes[0].matches(`[${PREVIEW_ID_ATTRIBUTE}="${previewId}"]`)) {
            $node.outerHTML = nodes[0].outerHTML;
            return false;
          }
        }
      }],
      ['onRerenderViewFallback', () => {
        location.reload()
      }]
    ];
  }

  /**
   * Will be true, if the TPP handshake was successful.
   * @memberof TPP_SNAP
   * @property {Promise<boolean>} isConnected
   *
   * @since 1.2.0
   */
  get isConnected() {
    return new Promise((resolve, reject) => {
      this._resolver = resolve;
      if(_connected.value !== null) resolve(_connected.value);
      else setTimeout(() => resolve(_connected.value !== null ? _connected.value : false ), 800);
    });
  }

  /**
   * Will be true, if the TPP handshake was successful and the connected ContentCreator does not use the new design.
   * @memberof TPP_SNAP
   * @property {boolean} isLegacyCC
   *
   * @since 1.2.20
   */
  get isLegacyCC() {
  	return _connected.usingOldStyle;
  }

  /**
   * Enables the CaaS mode for OCM. When a re-rendering of the current page or a preview of an element
   * is requested, OCM automatically waits for the presence of the new content in the CaaS before
   * triggering the respective handlers ({@link onRerenderView~Handler} or
   * {@link onRequestPreviewElement~Handler}). Use this mode when the rendering of your app depends
   * on fetching changed content from the CaaS. See {@link #caas-mode|CaaS mode description} for
   * more information.
   *
   * It is recommended to enable the CaaS mode after the OCM initialization finished successfully
   * by using the {@link onInit~Handler}. See {@link #caas-mode|CaaS mode description} for an example.
   *

   *
   * > **_NOTE:_** The CaaS mode depends on the current preview element. Make sure to set this
   * > element via {@link #tpp_snapsetpreviewelement|TPP_SNAP.setPreviewElement}.
   *
   * > **_NOTE:_** This feature uses the Change Stream API of the CaaS, thus requiring the platform
   * > version 3.0.3 (or later) and CaaS Connect module version 3.4.0 (or later).
   *
   * @memberof TPP_SNAP
   * @method enableCaasMode
   * @param {string} previewCollectionUrl - The URL of the preview content collection (e.g. `https://caas-host/my-tenant-id/f948bb48-4f6b-4a8a-b521-338c9d352f2b.preview.content`).
   * @param {string} apiKey - An API key with read access permission for the preview collection.
   * @param {object} [options]
   * @param {number} [options.updateTimeout = 5000] - The maximum amount of time (in ms) to wait for a CaaS change.
   *
   * @since 2.3.0
   */
  enableCaasMode(previewCollectionUrl, apiKey, { updateTimeout = 5000 } = {}) {
    this.caasMode = true
    if(!this.changeStreamAdapter) {
      try {
        this.changeStreamAdapter = new ChangeStreamAdapter(this, { previewCollectionUrl, apiKey }, { updateTimeout })
      } catch (e) {
        console.error("Failed to setup change stream adapter for CaaS mode.", e)
      }
    }
  }

  /**
   * @callback onInit~Handler
   * @param {boolean} success - the TPP handshake was successful or not
   * @param {boolean} isLegacyCC - if the TPP handshake was successful, whether the connected ContentCreator uses the legacy design
   *
   * @since 1.2.0
   */
  /**
   * Will be called after internal initialization (even if the handler is set
   * after initialization).
   *
   * @memberof TPP_SNAP
   * @method onInit
   * @param {onInit~Handler} handler
   *
   * @since 1.2.0
   *
   * @example TPP_SNAP.onInit(async (success) => console.log(`FirstSpirit Preview is ${success ? 'now' : 'NOT'} available!`))
   */
  onInit(handler) {
  	_connected.handler.push(handler);
  	if (_connected.value !== null) handler(_connected.value, _connected.usingOldStyle);
  }

  /**
   * @callback onContentChange~Handler
   * @param {HTMLElement} $node - a DOM node which contains the [data-preview-id] attribute
   * @param {string} previewId - the current PreviewId
   * @param {any} content - the changed content, could be a string,
   *   or an object (if the FirstSpirit Template generates JSON) or null, if
   *   this PreviewElement was deleted.
   * @return - if the handler doesn't return anything, {@link onRerenderView~Handler} will be triggered.
   *
   * @since 1.2.0
   */
  /**
   * Is triggered any time the content changes (or is deleted), on each Node that
   * was associated by the `[data-preview-id]` attribute in the markup.
   *
   * @memberof TPP_SNAP
   * @method onContentChange
   * @param {onContentChange~Handler} handler
   *
   * @since 1.2.0
   *
   * @example TPP_SNAP.onContentChange(($node, previewId, content) => $node.innerHTML = content))
   */
  onContentChange(handler) {
    this._listener.push(['onContentChange', handler]);
  }

  /**
   * @callback onRerenderView~Handler
   */
  /**
   * Sometimes it's _easier_ to rerender the complete view instead of implementing
   * event handlers for anything that could happen on the FristSpirit side.
   * Additional this is the common fallback, if the {@link onContentChange~Handler}
   * is not handled by the frontend application.
   *
   * If there is no listener defined, there is a fallback to **`location.reload()`**!
   *
   * > **_NOTE:_** When using the CaaS mode the triggering of the provided handler is delayed
   * to ensure that the related CaaS document is up-to-date.
   * See {@link #caas-mode|CaaS mode description} for more information.
   *
   *
   * @memberof TPP_SNAP
   * @method onRerenderView
   * @param {onRerenderView~Handler} handler
   *
   * @since 1.2.0
   *
   * @example
   * TPP_SNAP.onRerenderView(() => app.rerender());
   */
  onRerenderView(handler) {
    this._listener.push(['onRerenderView', handler]);
  }

  /**
   * @callback onNavigationChange~Handler
   * @param {string|null} previewId - of a newly created page, otherwise null
   *
   * @since 1.2.0
   */
  /**
   * Is triggered when the site's structure has been changed, including the deletion of elements that
   * could possibly be contained in the navigation. In the last case, furthermore the {@link Status} of the deleted
   * element is passed on to the event handler as an argument; this enables the handler to ignore events for specific
   * elements (e.g. dataset deletion if datasets may not appear in the current project's navigation).
   *
   * **Note:** Keep in mind that for all navigation changes caused by creating a page the
   * {@link onRequestPreviewElement~Handler} will also be triggered meaning that routing or
   * navigation logic is better placed within a {@link onRequestPreviewElement~Handler} to avoid
   * duplication and multiple executions of that logic.
   *
   * See also {@link https://docs.e-spirit.com/odfs52/dev/index.html?de/espirit/firstspirit/webedit/client/api/Common.NavigationChangeListener.html|WE_API.Common.NavigationChangeListener}.
   *
   * @memberof TPP_SNAP
   * @method onNavigationChange
   * @param {onNavigationChange~Handler} handler
   *
   * @since 1.2.0
   */
  onNavigationChange(fn) {
    this._listener.push(['onNavigationChange', fn]);
  }

  /**
   * @callback onRequestPreviewElement~Handler
   * @param {string} previewId - the current PreviewId
   *
   * @since 1.2.0
   */
   /**
   * Is triggered when the preview of an element was requested (e.g. by clicking on a search result
   * or by creating a new page). The FrontEnd application should now _translate_ the _PreviewId_
   * to a route, and follow it. After setting the new route always inform FirstSpirit by calling
   * #setPreviewElement to set the context e.g. for workflow actions.
   *
   * See also {@link https://docs.e-spirit.com/odfs52/dev/index.html?de/espirit/firstspirit/webedit/client/api/Common.PreviewRequestHandler.html|WE_API.Common.PreviewRequestHandler}.
   *
   * > **_NOTE:_** When using the CaaS mode the triggering of the provided handler is delayed
   * to ensure that the related CaaS document is up-to-date.
   * See {@link #caas-mode|CaaS mode description} for more information.
   *
   * @memberof TPP_SNAP
   * @method onRequestPreviewElement
   * @param {onRequestPreviewElement~Handler} handler
   *
   * @since 1.2.0
   *
   * @example
   * TPP_SNAP.onRequestPreviewElement(async (previewId) => {
   *   // error handling omitted for brevity
   *   const json = await TPP_SNAP.renderElement(previewId);
   *   window.history.pushState(json.uid, json.displayName, json.uid);
   *   await TPP_SNAP.setPreviewElement(previewId);
   * })
   */
  onRequestPreviewElement(fn) {
    this._listener.push(['onRequestPreviewElement', fn]);
  }

  /**
   * @name Button
   * @param {object} button
   * @param {string} [button.label = ''] - simple labeling, used by the default of {@link Button#getLabel~Callback}
   * @param {string} [button.css] - simple css class definition, used by the default of {@link Button#getIcon~Callback}
   * @param {string} [button.icon] - simple icon url, used by the default of {@link Button#getIcon~Callback}
   * @param {boolean} [button.supportsComponentPath] - whether the button is applied to elements specifying no actual, but a component path preview ID prefixed with "#"
   * @param {boolean} [button.supportsInedit] - whether the button is applied to elements that can be edited in-place
   * @param {Button#isVisible~Callback} [button.isVisible] - whether this button should be rendered or not; the default is `(scope) => true`
   * @param {Button#isEnabled~Callback} [button.isEnabled] - whether this button should be enabled or not; the default is `(scope) => false`
   * @param {Button#getIcon~Callback} [button.getIcon] - use `scope.$button` to define the appearance of the button
   * @param {Button#getLabel~Callback} [button.getLabel] - the tooltip (`[title]`) for this button
   * @param {Button#getItems~Callback} [button.getItems] - if this is not an empty list, a dropdown will be rendered; the default is `(scope) => []`
   * @param {Button#beforeExecute~Callback} [button.beforeExecute] - will be called before {@link Button#execute~Callback}
   * @param {Button#execute~Callback} [button.execute] - will be called, when the button (or an item) is clicked
   * @param {Button#afterExecute~Callback} [button.afterExecute] - will be called after {@link Button#execute~Callback}
   */

  /**
   * The _ButtonScope_ is an object which is used by all button callbacks.
   *
   * @name ButtonScope
   * @param {HTMLElement} $node - the DOM node where the decoration appears
   * @param {HTMLElement} $button - the DOM node of the button (not available in {@link Button#isVisible~Callback})
   * @param {string} previewId - the PreviewId
   * @param {Status} status - the current {@link Status} object of PreviewId
   * @param {string} language - the current language
   */

  /**
   * Be careful with your Promise here: the rendering of **all** buttons only happens after all `Button#isVisible` calls.
   * That's why `ButtonScope.$button` doesn't exists in {@link ButtonScope} this time.
   *
   * @callback Button#isVisible~Callback
   * @param {ButtonScope} scope
   * @return {Promise<boolean>}
   * @since 1.2.0
   */
  /**
   * @callback Button#isEnabled~Callback
   * @param {ButtonScope} scope
   * @return {Promise<boolean>}
   * @since 1.2.0
   */
  /**
   * @callback Button#getIcon~Callback
   * @param {ButtonScope} scope
   * @since 1.2.0
   * @example
   * // the default callback is defined as:
   * TPP_SNAP.registerButton({
   *   icon = null,
   *   css = null,
   *   getIcon = async ({ $button }) =>
   *     (css !== null && !$button.classList.add(css))
   *     || (icon !== null && ($button.style.backgroundImage = `url(${icon})`))
   *     || $button.classList.add('tpp-icon-action'),
   *   ...
   * });
   */
  /**
   * @callback Button#getLabel~Callback
   * @param {ButtonScope} scope
   * @since 1.2.0
   * @example
   * // the default callback is defined as:
   * TPP_SNAP.registerButton({
   *   label = '',
   *   getLabel = () => label,
   *   ...
   * });
   *
   * @example
   * // localize
   * TPP_SNAP.registerButton({
   *   getLabel: ({ language }) => language.toLowerCase() === 'de' ? 'Deutsche Bezeichnung' : 'English Label',
   *   ...
   * });
   */
  /**
   * An Item could be anything, but it needs a property called `label`, which appears in the dropdown.
   * @callback Button#getItems~Callback
   * @param {ButtonScope} scope
   * @since 1.2.0
   * @example
   * TPP_SNAP.registerButton({
   *   label = '',
   *   getItems = () => {
   *     return [
   *       { label: 'Option 1', value: 1 },
   *       { label: 'Option 2', value: 2 },
   *       { label: 'Option 3', value: 3 },
   *     ];
   *   },
   *   execute = (scope, item) => console.log(item.value),
   *   ...
   * });
   */
  /**
   * @callback Button#beforeExecute~Callback
   * @param {ButtonScope} scope
   * @param {any} item - see {@link Button#getItems~Callback}
   * @since 1.2.0
   */
  /**
   * @callback Button#execute~Callback
   * @param {ButtonScope} scope
   * @param {any} item - see {@link Button#getItems~Callback}
   * @return {Promise<void>}
   * @since 1.2.0
   */
  /**
   * @callback Button#afterExecute~Callback
   * @param {ButtonScope} scope
   * @param {any} item - see {@link Button#getItems~Callback}
   * @param {Error} [error] - if an uncatched error appears
   * @since 1.2.0
   */

  /**
   * Define a custom button on the element decoration.
   *
   * @memberof TPP_SNAP
   * @method registerButton
   * @param {Button} button
   * @param {int} [index = -1] - the button index, used as rendering order; `-1` means at the end
   *
   * @since 1.2.0
   *
   * @example
   * // register a debug button, as the first button, on any decorated element
   * TPP_SNAP.registerButton({
   *   css: 'tpp-icon-debug',
   *   execute: async (scope) => console.log(scope),
   * }, 0);
   */
  registerButton({
    label = '',
    css = null,
    icon = null,
    supportsComponentPath = false,
    supportsInedit = false,
    isVisible = (scope) => true,
    isEnabled = async (scope) => false,
    getIcon = async (scope) => (css !== null && !scope.$button.classList.add(css)) || (icon !== null && (scope.$button.style.backgroundImage = `url(${icon})`)) || scope.$button.classList.add('tpp-icon-action'),
    getLabel = async (scope) => label || '',
    getItems = async (scope) => [],
    beforeExecute = async (scope) => {},
    execute = async (scope, item = undefined) => {},
    afterExecute = async (scope) => {},
    _name = 'custom',
  }, index = -1) {
    this._buttons.splice(index < 0 ? this._buttons.length : index, 0, { css, supportsComponentPath, supportsInedit, isVisible, isEnabled, getIcon, getLabel, getItems, beforeExecute, execute, afterExecute, _name });
  }

  addButton(...args) {
    this.registerButton(...args);
  }

  /**
   * Override a default button on the element decoration.
   *
   * @memberof TPP_SNAP
   * @method overrideDefaultButton
   * @param {string} defaultButtonName - available button names: `edit`, `metadata`, `add-sibling-section`, `add-child-section`, `add-child-section-body`, `workflows`, `delete`, `crop`, `translate`, `move`, and `bookmark`
   * @param {Button|null} buttonOverrides - overrides given methods, `null` removes the default button
   *
   * @since 1.2.0
   *
   * @example
   * // override what the default 'crop' button does
   * TPP_SNAP.overrideDefaultButton('crop', {
   *   execute: async ({ previewId }) => actions.cropImage(previewId, 'my-cropped-resolution'),
   * });
   */
  overrideDefaultButton(name, button) {
    if (button === null) {
      this._buttons = this._buttons.filter(({ _name }) => _name !== name);
    } else {
      const idx = this._buttons.findIndex(({ _name }) => _name === name);
      if (idx !== -1) {
        Object.assign(this._buttons[idx], button);
      }
    }
  }

  /**
   * Find DOM nodes by _PreviewId_.
   *
   * @memberof TPP_SNAP
   * @method findPreviewNodes
   * @param {string} previewId
   * @return {Promise<[...HTMLElement]>} - any DOM node which is associated with the given PreviewId
   *
   * @since 1.2.0
   */
  async findPreviewNodes(previewId) {
    return (await this._actions).findPreviewNodes(...arguments);
  }

  /**
   * Executes a project script or an executable.
   *
   * See also {@link https://docs.e-spirit.com/odfs52/dev/de/espirit/firstspirit/webedit/client/api/Common.html#execute-java.lang.String-JavaScriptObject-JavaScriptObject-|WE_API.Common.execute}.
   *
   * @memberof TPP_SNAP
   * @method execute
   * @param {string} identifier - script ("script:script_uid") or executable ("class:full.qualified.executable.ClassName")
   * @param {object} [params = {}] - parameters (e.g. { param1: 42, param2: 'text' })
   * @param {boolean} [result = true] - should wait for an result
   * @return {Promise<any>} - the result
   *
   * @since 1.2.0
   *
   * @example
   * // https://docs.e-spirit.com/odfs/template-develo/contentcreator/functional-scop/index.html#klassen_navigationbearbeiten
   * TPP_SNAP.execute('class:EditMenu', { node: 43 }).then(() => location.reload());
   */
  async execute(identifier, params = {}, result = true) {
    return (await this._actions).execute(...arguments);
  }

  /**
   * Returns the _PreviewId_ of the ContentCreator scope (see {@link #tpp_snapsetpreviewelement|TPP_SNAP.setPreviewElement}).
   *
   * @memberof TPP_SNAP
   * @method getPreviewElement
   * @return {Promise<string>} - the PreviewId
   *
   * @since 1.2.0
   */
  async getPreviewElement() {
    return (await this._actions).getPreviewElement(...arguments);
  }

  /**
   * Sets the ContentCreator scope to the given _PreviewId_, so e.g. the upper-left colorized
   * _Workflow Status_ is set to the associated FirstSpirit _StoreElement_.
   *
   * @memberof TPP_SNAP
   * @method setPreviewElement
   * @param {string} previewId - the PreviewId
   *
   * @since 1.2.0
   */
  async setPreviewElement(previewId) {
    return (await this._actions).setPreviewElement(...arguments);
  }

  /**
   * Returns the current language abbreviation, set by {@link #tpp_snapsetpreviewelement|TPP_SNAP.setPreviewElement}.
   * Fallback is always `EN`!
   *
   * @memberof TPP_SNAP
   * @method getPreviewLanguage
   * @return {Promise<string>} - the language abbreviation
   *
   * @since 1.2.0
   */
  async getPreviewLanguage() {
    return (await this._actions).getPreviewLanguage(...arguments);
  }

  /**
   * Opens the _Edit Dialog_ of a FirstSpirit _StoreElement_ associated with
   * the _PreviewId_.
   *
   * Triggers {@link onContentChange~Handler}.
   *
   * @memberof TPP_SNAP
   * @method showEditDialog
   * @param {string} previewId - the associated PreviewId
   *
   * @since 1.2.0
   */
  async showEditDialog(previewId) {
    return (await this._actions).showEditDialog(...arguments);
  }

  /**
   * Opens the _Meta Data Dialog_ of an FirtSpirit _StoreElement_ associated with
   * the _PreviewId_.
   * MetaData providing elements must be allowed in the ContentCreator settings, see https://docs.e-spirit.com/odfs/edocs/admi/firstspirit-ser/project-propert/contentcreator/index.html#text_bild_14.
   *
   * Triggers {@link onContentChange~Handler}.
   *
   * @memberof TPP_SNAP
   * @method showMetaDataDialog
   * @param {string} previewId - the associated PreviewId
   *
   * @since NEXT_STABLE
   *
   * @example
   * // display the default button
   * TPP_SNAP.overrideDefaultButton('metadata', {
   *   isVisible: ({ status }) => !status.custom && (['PageRef', 'Page', 'Section', 'Media'].includes(status.elementType))
   * })
   */
  async showMetaDataDialog(previewId) {
    return (await this._actions).showMetaDataDialog(...arguments);
  }

  /**
   * Fetches the {@link Status} of the given _PreviewId_.
   *
   * @memberof TPP_SNAP
   * @method getElementStatus
   * @param {string} previewId - the associated PreviewId
   * @param {boolean} [refresh = false] - if `true`, purge cache for this PreviewId
   * @return {Promise<Status>}
   *
   * @since 1.2.0
   */
  async getElementStatus(previewId, refresh = false) {
    return (await this._actions).getElementStatus(...arguments);
  }

  /**
   * Renders the given _PreviewId_.
   *
   * @memberof TPP_SNAP
   * @method renderElement
   * @param {string} [previewId = null] - the associated PreviewId; if not set, the *StartNode* will be rendered
   * @return {Promise<string|object>} - the rendering result of the FirstSpirit template; if the result is a JSON, the
   *    JSON will automatically parsed. For FirstSpirit projects based on CaaS v3 the standard FirstSpirit json format is returned
   *
   * @since 1.2.0
   */
  async renderElement(previewId = null) {
    return (await this._actions).renderElement(...arguments);
  }

  /**
   * Tries to delete a FirstSpirit _StoreElement_ based on the _PreviewId_.
   *
   * Triggers {@link onContentChange~Handler}.
   *
   * You can also delete elements by using a specific Workflow - see {@link #tpp_snapstartworkflow|TPP_SNAP.startWorkflow}.
   *
   * @memberof TPP_SNAP
   * @method deleteElement
   * @param {string} previewId - the associated PreviewId
   * @param {boolean} showConfirmDialog - if true, the user will be asked to confirm the deletion before it is performed
   *
   * @since 1.2.0
   */
  async deleteElement(previewId, showConfirmDialog = false) {
    return (await this._actions).deleteElement(...arguments);
  }

  /**
   * Starts a FirstSpirit _Workflow_ on the given _PreviewId_.
   *
   * @memberof TPP_SNAP
   * @method startWorkflow
   * @param {string} previewId - the associated PreviewId
   * @param {string} workflow - a workflow uid, can be found in {@link Status}
   *
   * @since 1.2.0
   */
  async startWorkflow(previewId, workflow) {
    return (await this._actions).startWorkflow(...arguments);
  }

  /**
   * Processes a _Workflow_ transition.
   *
   * @memberof TPP_SNAP
   * @method processWorkflow
   * @param {string} previewId - the associated PreviewId
   * @param {string} transition - a transition uid, can be found in {@link Status}
   *
   * @since 1.2.0
   */
  async processWorkflow(previewId, transition) {
    return (await this._actions).processWorkflow(...arguments);
  }


  /**
   * An error that represents a duplication of a page (e.g. thrown by {@link #tpp_snapcreatepage|createPage} in case a
   * duplicate UID was detected).
   * It encapsulates the preview ID of the duplicated element.
   *
   * @typedef {Error} DuplicatePageError
   * @extends Error
   * @property {string} previewId - the preview ID of the already existing page
   * @example <caption>This error can be handled by applying `.catch((e) => {...})` on the returned promise.
   * Via {@link DuplicatePageError~getPreviewId} method one can also retrieve the preview ID of the element that was
   * duplicated.</caption>
   * TPP_SNAP.createPage("path/to/homepage", "homepage", "homepage", {
   *     forceUid: true
   * }).catch(e => {
   *    console.log(e.message);
   *    console.log(e.previewId);
   * });
   *
   * @since 1.2.24
   *
   */
  /**
   * Returns the preview ID saved inside the error object.
   *
   * @memberof DuplicatePageError
   * @method getPreviewId
   * @returns {string} the preview ID of the related element
   */
  /**
   * Creates a new _Page_ (and _PageRef_) in FirstSpirit.
   *
   * Triggers {@link onRerenderView~Handler} and {@link onNavigationChange~Handler}.
   *
   * @memberof TPP_SNAP
   * @method createPage
   * @param {string} path - the (uid-)path in FirstSpirit's PageStore/SiteStore (separated by '/')
   * @param {string} uid - the name/uid for the new page
   * @param {string} template - the PageTemplate uid
   * @param {object} [options]
   * @param {string} [options.language = null] - a specific language, `null` means the current language
   * @param {boolean} [options.result = false] - if `true`, the {@link onRerenderView~Handler} will **not** be triggered and the
   *   {@link #tpp_snaprenderelement|TPP_SNAP.renderElement} result will be returned.
   *
   *   **Be careful when preventing the *change event*!
   *   The affected PreviewId could appear several times in the DOM!**
   * @param {boolean} [options.showFormDialog = true] - if `true`, the page form will be shown
   * @param {boolean} [options.forceUid = false] - if `true`, the _Page_ and _PageRef_ will be created with the exact
   * uid that was specified. If the uid is already being used the process will be aborted and a
   * {@link DuplicatePageError} will be thrown. If `false`, a unique uid will be generated (based on the original uid)
   * in case of a duplicate uid.
   *
   * @since 1.2.0
   */
  async createPage(path, uid, template, { language = null, showFormDialog = true, forceUid = false } = {}) {
    return (await this._actions).createPage(...arguments);
  }

  /**
   * Adds a new _Section_.
   *
   * Triggers {@link onContentChange~Handler} if _PreviewId_ fulfills a _Page_ or
   * _PageRef_, otherwise {@link onRerenderView~Handler} would directly be triggered.
   *
   * @memberof TPP_SNAP
   * @method createSection
   * @param {string} previewId - the PreviewId of a parent or sibling element
   * @param {object} [options]
   * @param {string} [options.body = null] - name of the body in which the section is created; if not given the parent's or sibling's body is used.
   * @param {string} [options.template = null] - a _SectionTemplate_ uid; if not set a selection overlay will displayed
   * @param {string} [options.name = null] - the name of the _Section_
   * @param {int} [options.index = null] - the index where the section should be inserted; default is last position
   * @param {boolean} [options.result = false] - if `true`, the {@link onContentChange~Handler}/{@link onRerenderView~Handler} will **not** be triggered and the
   *   {@link #tpp_snaprenderelement|TPP_SNAP.renderElement} result will be returned.
   *
   *   **Be careful when preventing the *change event*!
   *   The affected PreviewId could appear several times in the DOM!**
   *
   * @since 1.2.0
   */
  async createSection(previewId, { body = null, template = null, name = null, index = null } = {}) {
    return (await this._actions).createSection(...arguments);
  }

  /**
   * Move a _Section_ before or after another _Section_.
   *
   * Triggers {@link onRerenderView~Handler}.
   *
   * @memberof TPP_SNAP
   * @method moveSection
   * @param {string} source - the PreviewId of a the source _Section_
   * @param {string} target - the PreviewId of a the target _Section_, _Body_ or _Page_ with a single _Body_
   * @param {object} [options]
   * @param {boolean} [options.before = false] - (only relevant if target is a _Section_) move the source _Section_ before target _Section_, otherwise it would be moved after
   * @param {boolean} [options.copy = false] - create a copy of the source _Section_
   * @param {boolean} [options.skipRerenderEvent = false] - if `true`, the {@link onRerenderView~Handler} will **not** be triggered
   *
   *   **Be careful when preventing the *change event*!
   *   The affected PreviewId could appear several times in the DOM!**
   *
   * @return true, if the operation was successful, false otherwise
   * @since 1.2.4
   */
  async moveSection(source, target, { before = false, copy = false, skipRerenderEvent = false } = {}) {
    // Element retrieved here apparently out of IdProviderInfo
    let { elementType: sourceElementType, id: sourceId } = await this.getElementStatus(source);
    if (sourceElementType !== 'Section') {
      console.error('[moveSection] Given "source" must be a Section!', { previewId: source });
      return false;
    }

    let { elementType: targetElementType, id: targetId } = await this.getElementStatus(target);
    if (!['Page', 'Body', 'Section'].includes(targetElementType)) {
      console.error('[moveSection] Given "target" must be a Page, Body or Section!', { previewId: target });
      return false;
    }

    return (await this._actions)._transferSection(sourceId, targetId, { position: before ? 'BEFORE' : 'AFTER', mode: copy ? 'COPY' : 'MOVE', skipRerenderEvent });
  }

  /**
   * Creates a new _Dataset_.
   *
   * Triggers {@link onRerenderView~Handler}.
   *
   * @memberof TPP_SNAP
   * @method createDataset
   * @param {string} template - the TableTemplate uid
   * @param {object} [options]
   * @param {string} [options.language = null] - a specific language, `null` means the current language
   * @param {boolean} [options.result = false] - if `true`, the {@link onRerenderView~Handler} will **not** be triggered and the
   *   {@link #tpp_snaprenderelement|TPP_SNAP.renderElement} result will be returned.
   *
   *   **Be careful when preventing the *change event*!
   *   The affected PreviewId could appear several times in the DOM!**
   *
   * @since 1.2.0
   */
  async createDataset(template, { language = null } = {}) {
    return (await this._actions).createDataset(...arguments);
  }

  /**
   * Toggles an element to be bookmarked (flagged as master) or not. Bookmarked elements will appear
   * in creation dialogs, like {@link #tpp_snapcreatesection|TPP_SNAP.createSection}.
   *
   * @memberof TPP_SNAP
   * @method toggleBookmark
   * @param {string} previewId
   *
   * @since 1.2.0
   */
  async toggleBookmark(previewId) {
    return (await this._actions).toggleBookmark(...arguments);
  }

  /**
   * Shows the _Crop Dialog_ for an image.
   *
   * Triggers {@link onContentChange~Handler}, the `content` parameter contains the URL in this case.
   *
   * @memberof TPP_SNAP
   * @method cropImage
   * @param {string} previewId - a PreviewId of _Media_ (type _Picture_)
   * @param {string|Array.<string>} [resolution = 'ORIGINAL'] - the uid of a _Resolution_ / array of uids
   * @param {boolean} [result = false] - if `true`, the {@link onContentChange~Handler} will **not** be triggered and the URL will be returned.
   *
   *   **Be careful when preventing the *change event*!
   *   The affected PreviewId could appear several times in the DOM!**
   *
   *  **Note:** When using the OCM crop button, the resolution can also be specified in the DOM by defining the
   *  `data-tpp-context-image-resolution` attribute using the format `res1, res2`.
   *
   * @since 1.2.0
   */
  async cropImage(previewId, resolution = 'ORIGINAL') {
    return (await this._actions).cropImage(...arguments);
  }

  /**
   * Returns all project languages (abbreviations). The first language is always the master language.
   *
   * @memberof TPP_SNAP
   * @method languages
   * @return {Promise<Array.<string>>} - list of languages
   *
   * @since 1.2.4
   */
  async languages() {
    return (await this._actions).languages(...arguments);
  }

  /**
   * Returns all project locales. The first locale is always related to the master language.
   *
   * @memberof TPP_SNAP
   * @method locales
   * @return {Promise<Array.<object>>} - list of locales
   *
   * @since 1.2.4
   */
  async locales() {
    return (await this._actions).locales(...arguments);
  }

  /**
   * Returns the "External Preview URL" as set in FirstSpirit.
   *
   * @memberof TPP_SNAP
   * @method previewUrl
   * @return {Promise<string>} - the "External Preview URL"
   *
   * @since 1.2.4
   */
  async previewUrl() {
    return (await this._actions).previewUrl(...arguments);
  }

  /**
   * Shows the translation help dialogue.
   *
   * Triggers {@link onContentChange~Handler} if the current language is the same
   * as the given `target` language.
   *
   * @memberof TPP_SNAP
   * @method showTranslationDialog
   * @param {string} previewId - a PreviewId of DataProvider
   * @param {string} source - the source language
   * @param {string} target - the target language
   *
   * @since 1.2.4
   */
  async showTranslationDialog() {
    return (await this._actions).showTranslationDialog(...arguments);
  }

  /**
   * Shows a message in the ContentCreator, either an info or an error messagebox.
   *
   * @memberof TPP_SNAP
   * @method showMessage
   * @param {string} message - the message to be displayed
   * @param {string} [kind = "info"] - the type of the message; either "info" or "error".
   * @param {string} [title] - the title of the messagebox
   *
   * @since 1.2.24
   */
  async showMessage() {
    (await this._actions).showMessage(...arguments);
  }

  /**
   * Shows a question dialog in the ContentCreator, providing the answers Yes or No.
   *
   * @memberof TPP_SNAP
   * @method showQuestion
   * @param {string} message - the question to be displayed
   * @param {string} [title] - the title of the question dialog
   *
   * @return {Promise<boolean>} - true if the user answered Yes, false otherwise.
   *
   * @since 1.2.24
   */
  async showQuestion() {
    return (await this._actions).showQuestion(...arguments);
  }

  /**
   * Trigger {@link onContentChange~Handler}. Can be used if a _Custom Button_
   * changes the content.
   *
   * @memberof TPP_SNAP
   * @method triggerChange
   * @param {string} previewId - the target PreviewId
   * @param {string|object} [content = null] - the updated content, if `null` {@link #tpp_snaprenderelement|TPP_SNAP.renderElement} is called internally
   *
   * @since 1.2.0
   */
  async triggerChange(previewId, content = null) {
    return (await this._actions).triggerChange(...arguments);
  }

  /**
   * Trigger {@link TPP_SNAP.triggerRerenderView}.
   *
   * @memberof TPP_SNAP
   * @method triggerRerenderView
   *
   * @since 1.2.0
   */
  async triggerRerenderView() {
    return (await this._actions).triggerRerenderView(...arguments);
  }

  /**
   * Wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#addParameterizedListener-de.espirit.firstspirit.client.mpp.MPPWebControl.ParameterizedListener-|MPP_API.addParameterizedListener}.
   *
   * @memberof TPP_SNAP
   * @method mppAddParameterizedListener
   * @param {MPPWebControl.ParameterizedListener} listener
   *
   * @since 1.2.24
   */
  mppAddParameterizedListener(listener) {
    this._listener.push(['onMppParameterizedChange', listener]);
  }

  /**
   * Wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#addParameterListener-de.espirit.firstspirit.client.mpp.MPPWebControl.ParameterListener-|MPP_API.addParameterListener}.
   *
   * @memberof TPP_SNAP
   * @method mppAddParameterListener
   * @param {MPPWebControl.ParameterListener} listener
   *
   * @since 1.2.24
   */
  mppAddParameterListener(listener) {
    this._listener.push(['onMppParameterChange', listener]);
  }

  /**
   * Wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#addTimeParameterListener-de.espirit.firstspirit.client.mpp.MPPWebControl.TimeParameterListener-|MPP_API.addTimeParameterListener}.
   *
   * @memberof TPP_SNAP
   * @method mppAddTimeParameterListener
   * @param {MPPWebControl.TimeParameterListener} listener
   *
   * @since 1.2.24
   */
  mppAddTimeParameterListener(listener) {
    this._listener.push(['onMppTimeParameterChange', listener]);
  }

  /**
   * Async wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#getParameter-java.lang.String-|MPP_API.getParameter}.
   *
   * @memberof TPP_SNAP
   * @method mppGetParameter
   * @param {string} name
   * @return {Promise<object>}
   *
   * @since 1.2.0
   */
  async mppGetParameter(name) {
    return (await this._actions).mppGetParameter(...arguments);
  }

  /**
   * Async wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#getTimeParameter--|MPP_API.getTimeParameter}.
   *
   * @memberof TPP_SNAP
   * @method mppGetTimeParameter
   * @return {Promise<Date>}
   *
   * @since 1.2.0
   */
  async mppGetTimeParameter() {
    return (await this._actions).mppGetTimeParameter(...arguments);
  }

  /**
   * Async wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#isParameterized--|MPP_API.isParameterized}.
   *
   * @memberof TPP_SNAP
   * @method mppIsParameterized
   * @return {Promise<boolean>}
   *
   * @since 1.2.0
   */
  async mppIsParameterized() {
    return (await this._actions).mppIsParameterized(...arguments);
  }

  /**
   * Async wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#setParameter-java.lang.String-java.lang.Object-|MPP_API.setParameter}.
   *
   * @memberof TPP_SNAP
   * @method mppSetParameter
   * @param {string} name
   * @param {object} value
   *
   * @since 1.2.0
   */
  async mppSetParameter(name, value) {
    return (await this._actions).mppSetParameter(...arguments);
  }

  /**
   * Async wrapper for {@link https://docs.e-spirit.com/odfs/dev/de/espirit/firstspirit/client/mpp/MPPWebControl.html#setTimeParameter-java.lang.Object-|MPP_API.setTimeParameter}.
   *
   * @memberof TPP_SNAP
   * @method mppSetTimeParameter
   * @param {Date} date
   *
   * @since 1.2.0
   */
  async mppSetTimeParameter(date) {
    return (await this._actions).mppSetTimeParameter(...arguments);
  }

  /**
   * The status is not a stable API, yet.
   *
   * @name Status
   * @param {string} previewId - the raw PreviewId
   * @param {string|null} custom - is null, if the status is delivered by FirstSpirit. Otherwise this contains information from the markup.
   */

  /**
   * A custom PreviewId starts with `custom:` and can be used in a URN Schema way to create custom buttons.
   *
   * @name CustomStatus
   * @extends Status
   * @param {array[...string]} parts - splitted (delimiter: `:`) version of `custom`
   *
   * @since 1.2.0
   *
   * @example
   * // <div data-preview-id="custom:create-page:my/firstspirit/path:myPageName"></div>
   *
   * TPP_SNAP.registerButton({
   *   css: 'tpp-icon-create-page',
   *   label: 'addMyPageName',
   *   isVisible: ({ status }) => status.custom !== null && status.parts[0] === 'create-page',
   *   execute: ({ status }) => {
   *     const [, path, name] = status.parts;
   *     TPP_SNAP.createPage(path, name, 'page_template_uid');
   *   },
   * })
   */
}


let _actionsPromiseResolver, _actionsPromise = new Promise(resolve => _actionsPromiseResolver = resolve);
const events = new $EventEmitter();
/* Since it could sometimes happen, that the handshake with the top frame works just after the timeout, rebuilt the whole
system. Instead of one immutable Promise, the _connected object keeps track of the current Connection status. Its value
can just like beforehand be retreived using the TPP_SNAP.isConnected property.
The handler property is used (not directly! Use TPP_SNAP.onInit!!) to register handlers being revoked as soon as the
connection status changed. Before this happens, the "isConnected" property will wait only for 800ms when "awaited"
 to be resolved. If that doesn't happen, it will return false. */
let _connected = {
  value: null,
  handler: [],
  usingOldStyle: true
};

const preview = new FirstSpiritPreview({ actions: _actionsPromise });
export default preview;

// Switch theme if connected with a CC in modern design
preview.onInit((connected, isLegacyCC) => {
	if (connected && _connected.usingOldStyle && !isLegacyCC) {
		_connected.usingOldStyle = false;
		oldStyle.unuse();
		newStyle.use();
	}
});

events.on(Event.Initialized, (connected, isLegacyCC) => {
  _connected.value = connected;
  if (preview._resolver !== null) {
    preview._resolver(connected);
  }
  _connected.handler.forEach(func => func(connected, isLegacyCC));
  if (connected && window) {
    try {
      window[Symbol('TPP_SNAP')] = preview;  // window[Object.getOwnPropertySymbols(window).find(s => s.description === "TPP_SNAP")]
      if (!window['TPP_SNAP']) {
        window['TPP_SNAP'] = preview;
      }
    } catch (e) {
      console.debug('cannot register TPP_SNAP in window');
    }
  }
});

if (typeof(window) !== 'undefined' && (top !== self || typeof(window.TEST_MODE) !== 'undefined' && window.TEST_MODE)) {
  const targetOrigin = $('[data-firstspirit-origin]:not([data-firstspirit-origin=""])') && $('[data-firstspirit-origin]:not([data-firstspirit-origin=""])').dataset.firstspiritOrigin || '*';
  const messenger = new Messenger({ events, targetOrigin, testMode: window.TEST_MODE !== undefined ? window.TEST_MODE : false });
  const actions = new Actions({ events, messenger });
  _actionsPromiseResolver(actions);
  Decoration({ events, actions, preview });

  const trigger = async (eventName, ...args) => {
    const listener = preview._listener.filter(([name]) => eventName === name);
    if (listener.length > 0) {
      return await Promise.all(listener.map(([, fn]) => fn(...args)));
    } else {
      eventName = `${eventName}${EVENT_FALLBACK_SUFFIX}`;
      return await Promise.all(preview._listener.filter(([name]) => eventName === name).map(([, fn]) => fn(...args)));
    }
  };

  events.on(Event.RerenderView, async () => {
    if (preview.caasMode && preview.changeStreamAdapter) {
      // Passing current preview element because CaaS events only account for PageRefs
      const previewElement = await actions.getPreviewElement();
      if (previewElement) {
        const lang = await actions.getPreviewLanguage();
        preview.changeStreamAdapter.waitForDocumentUpdate(previewElement, lang).catch((reason) => {
          console.error(reason);
        }).finally(() => {
          trigger('onRerenderView');
        });
        return;
      }
    }

    trigger('onRerenderView');
  });

  events.on(Event.PreviewRequest, async (previewId) => {
    if (preview.caasMode && preview.changeStreamAdapter) {
      const elementStatus = await actions.getElementStatus(previewId);
      if (elementStatus.elementType && elementStatus.elementType === 'PageRef') {
        const lang = await actions.getPreviewLanguage();
        preview.changeStreamAdapter.waitForDocumentInsert(previewId, lang).catch((reason) => {
          console.error(reason);
        }).finally(() => {
          trigger('onRequestPreviewElement', previewId);
        });
        return;
      }
    }

    trigger('onRequestPreviewElement', previewId);
  });
  events.on(Event.NavigationChange, (previewId) => trigger('onNavigationChange', previewId));
  events.on(Event.ElementChange, async ({previewId, content}) => {
    if (typeof content === 'undefined') {
      content = await actions.renderElement(previewId);
    }
    const captures = [].concat(...(await Promise.all(actions.findPreviewNodes(previewId, true).map($node => trigger(CONTENT_CHANGE_EVENT, $node, previewId, content)))));
    if (!captures.some(result => typeof result !== 'undefined')) {
      await events.emit(Event.RerenderView)
    }
  });
  events.on(Event.TppMppChange, (event) => trigger(event.type, event.result));

  const context = { events, messenger, actions, preview };

  DefaultButtons(context);
  DragAndDrop(context);
  DisplayChanges(context);

} else {
  events.emit(Event.Initialized, false);
}
