import * as Hb from 'handlebars';

declare global {
    export const SillyTavern: {
        getContext(): {
            setExtensionPrompt(extension: string, prompt: string, location: any, depth: number): unknown;
            characters: Array<{ name: string }>;
            characterId: number;
        };
    };

    declare const Handlebars: typeof Hb;

    interface Window {
        animation_duration?: number;
    }
}

export {};