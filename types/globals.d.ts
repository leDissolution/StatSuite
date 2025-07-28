declare global {
    const SillyTavern: {
        getContext(): {
            setExtensionPrompt(extension: string, prompt: string, location: any, depth: number): unknown;
            characters: Array<{ name: string }>;
            characterId: number;
            
        };
    };
}

export {};