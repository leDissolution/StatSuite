import { ExtensionSettings } from '../settings.js';
import { Template } from './template.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
const defaultTemplateSettings = {
    name: 'Default',
    templateString: `<metadata>
{{#each Characters}}
    <stats character="{{{@key}}}" {{#each this.Stats}}{{@key}}="{{{this}}}" {{/each}}/>
{{/each}}
</metadata>`,
    enabled: true,
    injectAtDepth: true,
    injectAtDepthValue: 1,
    variableName: ''
};
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
        Handlebars.registerHelper('ifEquals', (a, b, options) => {
            return a == b ? options.fn(this) : options.inverse(this);
        });
    }
    initializeFromMetadata() {
        if (!Array.isArray(ExtensionSettings.templates)) {
            ExtensionSettings.templates = [];
        }
        this._templates = ExtensionSettings.templates.map(templateData => new Template(templateData));
        if (!this._templates.some(t => t.name === defaultTemplateSettings.name)) {
            this._templates.push(new Template(defaultTemplateSettings));
        }
        else {
            this._templates.find(t => t.name === defaultTemplateSettings.name).templateString = defaultTemplateSettings.templateString;
        }
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    saveToMetadata() {
        ExtensionSettings.templates = this._templates.map(template => ({
            name: template.name,
            templateString: template.templateString,
            enabled: template.enabled,
            injectAtDepth: template.injectAtDepth,
            injectAtDepthValue: template.injectAtDepthValue,
            variableName: template.variableName
        }));
        if (saveSettingsDebounced) {
            saveSettingsDebounced();
        }
    }
    getAll() {
        return [...this._templates];
    }
    getEnabledTemplates() {
        return this._templates.filter(template => template.enabled);
    }
    addTemplate(template) {
        this._templates.push(template);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    removeTemplate(name) {
        const templateToRemove = this._templates.find(t => t.name === name);
        if (!templateToRemove)
            return;
        if (templateToRemove.variableName) {
            const ctx = SillyTavern.getContext();
            ctx.variables.local.set(templateToRemove.variableName, '');
        }
        this._templates = this._templates.filter(t => t.name !== name);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    getTemplate(name) {
        return this._templates.find(t => t.name === name) || null;
    }
    saveTemplateChanges() {
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    setTemplates(templates) {
        this._templates = [...templates];
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }
    renderTemplatesIntoVariables(stats) {
        const ctx = SillyTavern.getContext();
        this.getEnabledTemplates().forEach(template => {
            const text = template.render(stats);
            if (text) {
                ctx.variables.local.set(template.variableName, text);
            }
        });
    }
    onTemplatesChanged(callback) {
        this._eventTarget.addEventListener('templatesChanged', callback);
    }
}
export const Templates = new TemplateRegistry();
