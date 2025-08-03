import * as Hb from 'handlebars';

declare global {
    export const SillyTavern: {
        getContext(): {
            setExtensionPrompt(extension: string, prompt: string, location: any, depth: number): unknown;
            characters: Array<{ name: string }>;
            characterId: number;
        };
    };

    export const Handlebars: typeof Hb;
}

export {};