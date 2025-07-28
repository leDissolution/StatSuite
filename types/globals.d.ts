declare global {
    const SillyTavern: {
        getContext(): {
            characters: Array<{ name: string }>;
            characterId: number;
        };
    };
}

export {};