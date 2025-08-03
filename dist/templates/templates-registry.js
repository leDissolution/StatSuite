import { ExtensionSettings } from '../settings.js';
import { Template } from './template.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
const defaultTemplate = new Template('Default', `<metadata>
{{#each Characters}}
    <stats character="{{@key}}" {{#each this}}{{@key}}="{{this}}" {{/each}}/>
{{/each}}
</metadata>`);
export class TemplateRegistry {
    constructor() {
        Object.defineProperty(this, "_templates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventTarget", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._templates = [];
        this._eventTarget = new EventTarget();
    }
    initializeFromMetadata() {
        if (!Array.isArray(ExtensionSettings.templates)) {
            ExtensionSettings.templates = [];
        }
        this._templates = ExtensionSettings.templates.map(templateData => new Template(templateData.name, templateData.templateString));
        if (!this._templates.some(t => t.name === defaultTemplate.name)) {
            this._templates.push(defaultTemplate);
        }
        else {
            this._templates.find(t => t.name === defaultTemplate.name).templateString = defaultTemplate.templateString;
        }
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    saveToMetadata() {
        ExtensionSettings.templates = this._templates.map(template => ({
            name: template.name,
            templateString: template.templateString
        }));
        if (saveSettingsDebounced) {
            saveSettingsDebounced();
        }
    }
    getAll() {
        return [...this._templates];
    }
    addTemplate(template) {
        this._templates.push(template);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    removeTemplate(name) {
        this._templates = this._templates.filter(t => t.name !== name);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    getTemplate(name) {
        return this._templates.find(t => t.name === name) || null;
    }
    setTemplates(templates) {
        this._templates = [...templates];
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    onTemplatesChanged(callback) {
        this._eventTarget.addEventListener('templatesChanged', callback);
    }
}
export const Templates = new TemplateRegistry();
