import { NESTED_COMPONENT_PREVIEW_ID_PREFIX } from './_consts.js';
import { getNestedComponentPath } from './$utils.js';

/*
interface FirstSpiritPreviewButtonScope {
  HTMLElement $node,
  HTMLElement $button,
  String previewId,
  Status<any> status,
  String language,
}
*/
export default function ({ preview, actions }) {

  function typeMatches(elementType, ...expectedTypes) {
    if (elementType) {
      if (elementType.startsWith('Dataset')) {
        return expectedTypes.includes('Dataset');
      }
      return expectedTypes.includes(elementType);
    }
    return false;
  }

  // Add Workflow Button
  preview.registerButton({
    _name: 'workflows',
    getIcon: ({ $button, status }) => {
      if (status.workflows.current !== null) {
        $button.classList.add('tpp-icon-workflow-in-progress');
      } else if (status.released) {
        $button.classList.add('tpp-icon-workflow-released');
      } else {
        $button.classList.add('tpp-icon-workflow-changed');
      }
    },
    getLabel: ({ language, status }) => {
      if (status.workflows.current !== null) {
        return status.workflows.current.displayName;
      } else {
        return language.toLowerCase() === 'de' ? 'Starte Arbeitsablauf' : 'Start Workflow';
      }
    },
    isVisible: async ({ status, previewId }) => {
      if (!status.custom && status.releaseSupported && (status.workflows.allowed.length !== 0 || status.workflows.current !== null)) {
        return previewId !== actions.getPreviewElement();
      }
      return false;
    },
    isEnabled: () => true,
    getItems: ({ status }) => {
      if (status.workflows.current !== null) {
        return status.workflows.transitions.map(transition => {
          const { displayName, id } = transition;
          return { label: displayName, transitionId: id };
        });

      } else {
        return status.workflows.allowed
          .filter(({ uid }) => status.workflows.deleteWorkflow === null || uid !== status.workflows.deleteWorkflow.uid)
          .map(workflow => ({ label: workflow.displayName, workflowId: workflow.id }));
      }
    },
    execute: async ({ previewId }, { workflowId = null, transitionId = null } = {}) => {
      if (workflowId !== null) {
        return actions.startWorkflow(previewId, workflowId);
      } else if (transitionId !== null) {
        return actions.processWorkflow(previewId, transitionId);
      }
    },
  });

  // Translation dialogue
  const isMultiLanguage = new Promise(resolve => actions.languages().then(languages => resolve(languages.length > 1)));
  preview.addButton({
    _name: 'translate',
    css: 'tpp-icon-translate',
    isVisible: async({ status }) => typeMatches(status.elementType, 'Page', 'Section', 'GCAPage', 'GCASection', 'Dataset', 'SectionReference') && await isMultiLanguage,
    isEnabled: ({ status }) => status.permissions.change,
    getItems: async() => {
      const languages = await actions.languages();
      const currentLanguage = await actions.getPreviewLanguage() || languages[0];
      let items = [];
      for (let targetLanguage of languages) {
        if (targetLanguage !== currentLanguage) {
          items.push({ source: currentLanguage, target: targetLanguage });
          }
      }
      items.push(...items.map(({ source: target, target: source }) => ({ source, target })));
      return items.map(({ source, target }) => ({ label: `${source} → ${target}`, source, target }));
    },
    execute: async ({ previewId }, { source, target } = {}) => source && target && actions.showTranslationDialog(previewId, source, target)
  });

  // Delete Component Button
  preview.registerButton({
    _name: 'delete-component',
    css: 'tpp-icon-delete',
    supportsComponentPath: true,
    getLabel: ({ language }) => {
      return language.toLowerCase() === 'de' ? 'Komponente löschen' : 'Delete component';
    },
    isVisible: ({ previewId }) => {
      return previewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX) && !isNaN(parseInt(previewId.substr(1)));
    },
    isEnabled: ({ status }) => {
      return status.permissions.delete;
    },
    execute: async ({ $node }) => {
      const { parentPreviewId, nestedComponentPath } = getNestedComponentPath($node);
      return actions.deleteNestedComponent(parentPreviewId, nestedComponentPath, true);
    }
  });

  // Add Delete Button
  preview.registerButton({
    _name: 'delete',
    css: 'tpp-icon-delete',
    getLabel: ({ language }) => language.toLowerCase() === 'de' ? 'Löschen' : 'Remove',
    isVisible: ({ status }) => status.elementType && status.elementType !== 'Body' && status.elementType !== 'Media',
    isEnabled: ({ status }) => {
      if (!typeMatches(status.elementType, 'Section', 'SectionReference') && status.workflows && status.workflows.deleteWorkflow !== null) {
        return status.workflows.current === null;
      } else {
        return status.permissions.delete;
      }
    },
    execute: async ({ previewId, status }) => {
      if (!typeMatches(status.elementType, 'Section', 'SectionReference') && status.workflows && status.workflows.deleteWorkflow !== null) {
      	return actions.startWorkflow(previewId, status.workflows.deleteWorkflow.uid);
      } else {
      	return actions.deleteElement(previewId, true);
      }
    }
  });

  // Toggle Bookmark
  preview.registerButton({
    _name: 'bookmark',
    isVisible: ({ status }) => typeMatches(status.elementType, 'Page', 'PageRef', 'Section', 'Dataset', 'SectionReference'),
    isEnabled: () => true,
    getIcon: ({ $button, status }) => $button.classList.add(status.bookmark ? 'tpp-icon-bookmark-delete' : 'tpp-icon-bookmark-create'),
    getLabel: ({ language }) => language.toLowerCase() === 'de' ? 'Kopiervorlage' : 'Bookmark',
    execute: async ({ previewId }) => actions.toggleBookmark(previewId),
  });

  // Add Component Button
  preview.registerButton({
    _name: 'create-component',
    css: 'tpp-icon-add-section',
    supportsComponentPath: true,
    getLabel: ({ language }) => {
      return language.toLowerCase() === 'de' ? 'Komponente hinzufügen' : 'Add component';
    },
    isVisible: ({ previewId, $node }) => {
      return previewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX) && isNaN(parseInt(previewId.substr(1)));
    },
    isEnabled: ({ status }) => {
      return status.permissions.appendLeaf;
    },
    getItems: async({ $node }) => {
      const { parentPreviewId, nestedComponentPath } = getNestedComponentPath($node);
      var available = await actions.availableTemplatesForNestedComponent(parentPreviewId, nestedComponentPath);
      if (available === null || available === undefined) {
        return [];
      }
      var result = [];
      for(var uid of Object.keys(available)) {
        result.push({ uid, label: available[uid] });
      }
      return result;
    },
    execute: async ({ $node }, item) => {
      if( item === undefined ) return;
      const { parentPreviewId, nestedComponentPath } = getNestedComponentPath($node);
      return actions.createNestedComponent(parentPreviewId, nestedComponentPath, item.uid);
    }
  });

  // Add Section Button
  preview.registerButton({
    _name: 'add-child-section',
    css: 'tpp-icon-add-section',
    getLabel: ({ language }) => language.toLowerCase() === 'de' ? 'Absatz hinzufügen' : 'Add Section',
    isVisible: ({ status }) => status.elementType === 'Page' && status.children.length !== 0,
    isEnabled: ({ status }) => status.permissions.appendLeaf,
    getItems: ({ status }) => status.children.length === 1 ? [] : status.children.map(body => body.name),
    execute: async ({ previewId, status }, body = status.children[0].name) => actions.createSection(previewId, { body }),
  });
  preview.addButton({
    _name: 'add-child-section-body',
    css: 'tpp-icon-add-section',
    getLabel: ({ language }) => language.toLowerCase() === 'de' ? 'Absatz hinzufügen' : 'Add Section',
    isVisible: ({ status }) => status.elementType === 'Body',
    isEnabled: ({ status }) => status.permissions.appendLeaf,
    execute: async ({ previewId }) => actions.createSection(previewId),
  });

  // Add Sibling Section Button
  preview.registerButton({
    _name: 'add-sibling-section',
    css: 'tpp-icon-add-section',
    getLabel: ({ language }) => language.toLowerCase() === 'de' ? 'Absatz hinzufügen' : 'Add Section',
    isVisible: ({ status }) => status.elementType === 'Section',
    isEnabled: ({ status }) => status.permissions.change,
    execute: async ({ previewId }) => actions.createSection(previewId),
  });

  // Crop Dialog
  preview.registerButton({
    _name: 'crop',
    css: 'tpp-icon-crop-image',
    isVisible: ({ status }) => status.elementType === 'Media',
    isEnabled: ({ status }) => status.permissions.change,
    execute: async ({ previewId, $node: { dataset : { tppContextImageResolution = "ORIGINAL" } } }) => {
      const resolutions = tppContextImageResolution.split(",").map(res => res.trim());
      actions.cropImage(previewId, resolutions);
    }
  });

  // Edit MetaData Button
  preview.addButton({
    _name: 'metadata',
    css: 'tpp-icon-meta-data',
    getLabel: ({ language }) => language.toLowerCase() === 'de' ? 'Meta-Daten' : 'Meta Data',
    isVisible: () => false,
    isEnabled: ({ status }) => status.permissions.changeMeta,
    execute: async ({ previewId }) => actions.showMetaDataDialog(previewId),
  });

  // Edit Button
  preview.registerButton({
    _name: 'edit',
    css: 'tpp-icon-edit',
    getLabel: ({ language }) => {
      return language.toLowerCase() === 'de' ? 'Bearbeiten' : 'Edit';
    },
    isVisible: ({ status, previewId }) => {
      return typeMatches(status.elementType, 'PageRef', 'Page', 'Section', 'GCAPage', 'GCASection', 'Dataset', 'SectionReference') && !previewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX);
    },
    isEnabled: ({ status }) => {
      return status.permissions.change;
    },
    execute: async ({ previewId }) => {
      return actions.showEditDialog(previewId);
    },
  });

  preview.registerButton({
    _name: 'edit-component',
    css: 'tpp-icon-edit',
    supportsComponentPath: true,
    getLabel: ({ language }) => {
      return language.toLowerCase() === 'de' ? 'Komponente bearbeiten' : 'Edit component';
    },
    isVisible: ({ previewId }) => {
      return previewId.startsWith(NESTED_COMPONENT_PREVIEW_ID_PREFIX) && !isNaN(parseInt(previewId.substr(1)));
    },
    isEnabled: ({ status }) => {
      return status.permissions.change;
    },
    execute: async ({ $node }) => {
      const { parentPreviewId, nestedComponentPath } = getNestedComponentPath($node);
      return actions.showEditDialog(parentPreviewId, { nestedComponentPath: nestedComponentPath });
    }
  });

};
