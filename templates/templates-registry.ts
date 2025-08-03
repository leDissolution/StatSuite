import { ExtensionSettings } from '../settings.js';
import { Template } from './template.js';
import { saveSettingsDebounced } from '../../../../../../script.js';

const defaultTemplate = new Template('Default', `<metadata>
{{#each Characters}}
    <stats character="{{@key}}" {{#each this}}{{@key}}="{{this}}" {{/each}}/>
{{/each}}
</metadata>`);

export class TemplateRegistry {
    private _templates: Template[];
    private _eventTarget: EventTarget;

    constructor() {
        this._templates = [];
        this._eventTarget = new EventTarget();
    }

    initializeFromMetadata() {
        if (!Array.isArray(ExtensionSettings.templates)) {
            ExtensionSettings.templates = [];
        }

        this._templates = ExtensionSettings.templates.map(templateData => 
            new Template(templateData.name, templateData.templateString)
        );

        if (!this._templates.some(t => t.name === defaultTemplate.name)) {
            this._templates.push(defaultTemplate);
        }
        else {
            this._templates.find(t => t.name === defaultTemplate.name)!.templateString = defaultTemplate.templateString;
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

    getAll(): Template[] {
        return [...this._templates];
    }

    addTemplate(template: Template) {
        this._templates.push(template);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }

    removeTemplate(name: string) {
        this._templates = this._templates.filter(t => t.name !== name);
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }

    getTemplate(name: string): Template | null {
        return this._templates.find(t => t.name === name) || null;
    }

    setTemplates(templates: Template[]) {
        this._templates = [...templates];
        this.saveToMetadata();
        this._eventTarget.dispatchEvent(new CustomEvent('templatesChanged'));
    }

    onTemplatesChanged(callback: (event: Event) => void) {
        this._eventTarget.addEventListener('templatesChanged', callback);
    }
}

export const Templates: TemplateRegistry = new TemplateRegistry(); 