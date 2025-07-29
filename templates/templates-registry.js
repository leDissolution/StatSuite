import { ExtensionSettings } from '../settings.js';
import { Template } from './template.js';
import { saveSettingsDebounced } from '../../../../../script.js';

const defaultTemplate = new Template('Default', `<metadata>
{{#each this}}
    <stats character="{{@key}}" {{#each this}}{{@key}}="{{this}}" {{/each}}/>
{{/each}}
</metadata>`);

/**
 * Manages the registry of templates and synchronizes with ExtensionSettings.templates.
 */
export class TemplateRegistry {
    constructor() {
        /** @type {Template[]} */
        this._templates = [];
        this._eventTarget = new EventTarget();
    }

    /**
     * Initializes templates from ExtensionSettings.templates.
     */
    initializeFromMetadata() {
        if (!Array.isArray(ExtensionSettings.templates)) {
            ExtensionSettings.templates = [];
        }

        this._templates = ExtensionSettings.templates.map(templateData => 
            new Template(templateData.name, templateData.templateString)
        );

        if (!this._templates.some(t => t.name === defaultTemplate.name)) {
            this._templates.push(defaultTemplate);

            this.saveToMetadata();
        }

        this._currentTemplate = this._templates.find(t => t.name === defaultTemplate.name);

        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }

    /**
     * Saves the current template registry to metadata.
     */
    saveToMetadata() {
        ExtensionSettings.templates = this._templates.map(template => ({
            name: template.name,
            templateString: template.templateString
        }));
        
        if (saveSettingsDebounced) {
            saveSettingsDebounced();
        }
    }

    /**
     * Returns all templates.
     * @returns {Template[]}
     */
    getAll() {
        return [...this._templates];
    }

    /**
     * Adds a new template.
     * @param {Template} template
     */
    addTemplate(template) {
        this._templates.push(template);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }

    /**
     * Removes a template by name.
     * @param {string} name
     */
    removeTemplate(name) {
        this._templates = this._templates.filter(t => t.name !== name);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }

    /**
     * Finds a template by name.
     * @param {string} name
     * @returns {Template|null}
     */
    getTemplate(name) {
        return this._templates.find(t => t.name === name) || null;
    }

    /**
     * Replace all templates (e.g., for loading from storage).
     * @param {Template[]} templates
     */
    setTemplates(templates) {
        this._templates = [...templates];
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }

    /**
     * Returns the currently selected template.
     * @returns {Template}
     */
    getCurrentTemplate() {
        return this._currentTemplate;
    }

    /**
     * Listen for changes to the templates registry.
     * @param {(event: Event) => void} callback
     */
    onTemplatesChanged(callback) {
        this._eventTarget.addEventListener('templatesChanged', callback);
    }
}

/** @type {TemplateRegistry} */
export const Templates = new TemplateRegistry(); 