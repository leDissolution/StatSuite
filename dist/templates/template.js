export class TemplateData {
    constructor(characterStats = {}) {
        Object.defineProperty(this, "Characters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.Characters = characterStats;
    }
    static fromMessageStatEntry(entry) {
        const data = new TemplateData();
        data.Characters = Object.fromEntries(Object.entries(entry.Characters ?? {})
            .filter(([_, v]) => v !== null));
        return data;
    }
}
export class Template {
    constructor(settings) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "injectAtDepth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "injectAtDepthValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "variableName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "_templateString", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_compiledTemplate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_isDirty", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = settings.name;
        this._templateString = settings.templateString;
        this.enabled = settings.enabled ?? false;
        this.injectAtDepth = settings.injectAtDepth ?? false;
        this.injectAtDepthValue = settings.injectAtDepthValue ?? 0;
        this.variableName = settings.variableName ?? '';
        this._compiledTemplate = null;
        this._isDirty = true;
    }
    get templateString() {
        return this._templateString ?? '';
    }
    set templateString(value) {
        if (this._templateString !== value) {
            this._templateString = value;
            this._isDirty = true;
            this._compiledTemplate = null;
        }
    }
    _ensureCompiled() {
        if (this._isDirty || !this._compiledTemplate) {
            try {
                this._compiledTemplate = Handlebars.compile(this._templateString);
                this._isDirty = false;
            }
            catch (error) {
                console.error(`Template "${this.name}" compilation failed:`, error);
                throw new Error(`Template compilation failed: ${error.message}`);
            }
        }
    }
    render(data) {
        this._ensureCompiled();
        if (!this._compiledTemplate) {
            throw new Error(`Template "${this.name}" is not compiled.`);
        }
        try {
            return this._compiledTemplate(data);
        }
        catch (error) {
            console.error(`Template "${this.name}" rendering failed:`, error);
            throw new Error(`Template rendering failed: ${error.message}`);
        }
    }
    isValid() {
        try {
            this._ensureCompiled();
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
