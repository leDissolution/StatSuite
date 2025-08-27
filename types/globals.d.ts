import * as Hb from 'handlebars';

declare global {
    export const SillyTavern: {
        getContext(): {
            setExtensionPrompt(extension: string, prompt: string, location: any, depth: number): unknown;
            characters: Array<{ name: string }>;
            characterId: number;
            variables: {
                local: {
                    set(name: string, value: string, args: any = {}): void;
                    get(name: string): string | null;
                };
                global: {
                    set(name: string, value: string, args: any = {}): void;
                    get(name: string): string | null;
                };
            };
        };
    };

    declare const Handlebars: typeof Hb;

    declare const toastr: {
        error(message: string): void;
        success(message: string): void;
    };

    interface Window {
        animation_duration?: number;
    }
}

export {};