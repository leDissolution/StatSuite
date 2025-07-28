import { Handlebars } from '../lib.js';

/**
 * Data Transfer Object for template rendering data.
 * Contains all the data that can be used in template rendering.
 */
export class TemplateData {
    /**
     * @param {Record<string, import('../stats/stat-block.js').StatsBlock>} characterStats - Dictionary mapping character names to their StatsBlock objects
     */
    constructor(characterStats = {}) {
        /** @type {Record<string, import('../stats/stat-block.js').StatsBlock>} */
        this.Characters = characterStats;
    }
}

export class Template {
    /**
     * @param {string} name - The template's name
     * @param {string} templateString - The template string to use
     */
    constructor(name, templateString) {
        this.name = name;
        this._templateString = templateString;
        this._compiledTemplate = null;
        this._isDirty = true;
    }

    /**
     * Gets the template string.
     * @returns {string}
     */
    get templateString() {
        return this._templateString;
    }

    /**
     * Sets the template string and marks it as dirty.
     * @param {string} value
     */
    set templateString(value) {
        if (this._templateString !== value) {
            this._templateString = value;
            this._isDirty = true;
            this._compiledTemplate = null;
        }
    }

    /**
     * Compiles the template if it's dirty or not yet compiled.
     * @private
     */
    _ensureCompiled() {
        if (this._isDirty || !this._compiledTemplate) {
            try {
                this._compiledTemplate = Handlebars.compile(this._templateString);
                this._isDirty = false;
            } catch (error) {
                console.error(`Template "${this.name}" compilation failed:`, error);
                throw new Error(`Template compilation failed: ${error.message}`);
            }
        }
    }

    /**
     * Renders the template with the given template data.
     * @param {TemplateData} data - The template data or legacy character stats object
     * @returns {string} The rendered template
     */
    render(data) {
        this._ensureCompiled();
        try {            
            return this._compiledTemplate(data);
        } catch (error) {
            console.error(`Template "${this.name}" rendering failed:`, error);
            throw new Error(`Template rendering failed: ${error.message}`);
        }
    }

    /**
     * Checks if the template is valid (can be compiled).
     * @returns {boolean}
     */
    isValid() {
        try {
            this._ensureCompiled();
            return true;
        } catch (error) {
            return false;
        }
    }
}