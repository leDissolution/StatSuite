import { TemplateSettings } from '../settings-dtos.js';

export class TemplateData {
    Characters: Record<string, import('../stats/stat-block.js').StatsBlock>;

    constructor(characterStats: Record<string, import('../stats/stat-block.js').StatsBlock> = {}) {
        this.Characters = characterStats;
    }
}

export class Template {
    name: string;

    enabled: boolean = true;

    injectAtDepth: boolean = false;
    injectAtDepthValue: number = 0;

    variableName: string = '';

    private _templateString: string;
    private _compiledTemplate: Handlebars.TemplateDelegate<TemplateData> | null;
    private _isDirty: boolean;

    constructor(settings: TemplateSettings) {
        this.name = settings.name;
        this._templateString = settings.templateString;
        this.enabled = settings.enabled ?? false;
        this.injectAtDepth = settings.injectAtDepth ?? false;
        this.injectAtDepthValue = settings.injectAtDepthValue ?? 0;
        this.variableName = settings.variableName ?? '';

        this._compiledTemplate = null;
        this._isDirty = true;
    }

    get templateString(): string {
        return this._templateString ?? '';
    }

    set templateString(value: string) {
        if (this._templateString !== value) {
            this._templateString = value;
            this._isDirty = true;
            this._compiledTemplate = null;
        }
    }

    private _ensureCompiled() {
        if (this._isDirty || !this._compiledTemplate) {
            try {
                this._compiledTemplate = Handlebars.compile(this._templateString);
                this._isDirty = false;
            } catch (error: any) {
                console.error(`Template "${this.name}" compilation failed:`, error);
                throw new Error(`Template compilation failed: ${error.message}`);
            }
        }
    }

    render(data: TemplateData): string {
        this._ensureCompiled();

        if (!this._compiledTemplate) {
            throw new Error(`Template "${this.name}" is not compiled.`);
        }

        try {            
            return this._compiledTemplate(data);
        } catch (error: any) {
            console.error(`Template "${this.name}" rendering failed:`, error);
            throw new Error(`Template rendering failed: ${error.message}`);
        }
    }

    isValid(): boolean {
        try {
            this._ensureCompiled();
            return true;
        } catch (error) {
            return false;
        }
    }
}