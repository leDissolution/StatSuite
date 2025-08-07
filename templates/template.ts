import { TemplateSettings } from '../settings-dtos.js';
import { Characters } from '../characters/characters-registry.js';
import { substituteParams } from '../../../../../../script.js';

export class TemplateCharacterDto {
    name: string;
    room: string = '';
    Stats: import('../stats/stat-block.js').StatsBlock;
    isPlayer: boolean;

    constructor(name: string, isPlayer: boolean, stats: import('../stats/stat-block.js').StatsBlock) {
        this.name = name;
        this.Stats = stats;
        this.isPlayer = isPlayer;

        if (this.Stats) {
            let location = this.Stats['location'] || '';
            this.room = location.split(';')[0] || '';
        }
    }
}

export class TemplateData {
    Characters: Record<string, TemplateCharacterDto>;

    constructor(characterStats: Record<string, TemplateCharacterDto> = {}) {
        this.Characters = characterStats;
    }

    static fromMessageStatEntry(entry: import('../chat/chat-stat-entry.js').ChatStatEntry): TemplateData {
        const data = new TemplateData();
        data.Characters = Object.fromEntries(
            Object.entries(entry.Characters ?? {})
                .filter(([_, v]) => v !== null)
                .map(([name, stats]) => {
                    const character = Characters.getCharacter(name);
                    if (character) {
                        return [name, new TemplateCharacterDto(name, character.isPlayer, stats!)];
                    }
                    return [name, new TemplateCharacterDto(name, false, stats!)];
                })
        ) as Record<string, TemplateCharacterDto>;
        return data;
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
                const processedValue = this._templateString.replace(/\{\$(\w+)\}/g, (match, varName) => {
                    try {
                        return substituteParams(`{{${varName}}}`);
                    } catch (error) {
                        console.warn(`Failed to substitute parameter ${varName}:`, error);
                        return match;
                    }
                });

                this._compiledTemplate = Handlebars.compile(processedValue);
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