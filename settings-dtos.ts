export interface TemplateSettings {
    name: string;
    templateString: string;
    enabled: boolean;
    injectAtDepth: boolean;
    injectAtDepthValue: number;
}

export interface StatsSettings {
    stats: Record<string, any>;
    presets: PresetsSettings;
}

export interface PresetsSettings {
    [presetName: string]: {
        name: string;
        stats: Record<string, any>;
        characters: string[];
    };
}