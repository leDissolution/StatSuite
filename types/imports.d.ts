declare module '*/script.js' {
    export const chat_metadata: Record<string, any>;
    export const chat: any[];
    export function saveSettingsDebounced(): void;
    export function saveChatConditional(): void;
    export const eventSource: any;
    export const event_types: any;
    export const extension_prompt_types: any;
}

declare module '*/scripts/power-user.js' {
    export function loadMovingUIState(): void;
}

declare module '*/scripts/RossAscends-mods.js' {
    export function dragElement(element: JQuery): void;
}

declare module '*/extensions.js' {
    export function saveMetadataDebounced(): void;
    export const extension_settings: Record<string, any>;
}

declare module '*/lib.js' {
    export const Handlebars: any;
}