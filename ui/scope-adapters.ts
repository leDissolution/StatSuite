import { StatScope } from '../stats/stat-entry.js';
import { ChatStatEntry } from '../chat/chat-stat-entry.js';
import { StatsBlock } from '../stats/stat-block.js';
import { Characters } from '../characters/characters-registry.js';
import { Scenes } from '../scenes/scene-registry.js';

export interface ScopeAdapter {
    readonly scope: StatScope;
    readonly label: string;
    readonly pluralLabel: string;

    getBucket(entry: ChatStatEntry): Record<string, StatsBlock | null>;

    listTrackedNames(): string[];
    listActiveNames(stats: ChatStatEntry, oldStats: ChatStatEntry | null): string[];
    isKnown(name: string): boolean;
    getIndex(name: string): number;

    removeSubject(entry: ChatStatEntry, name: string): void;
}

export const CharacterScopeAdapter: ScopeAdapter = {
    scope: StatScope.Character,
    label: 'Character',
    pluralLabel: 'Characters',

    getBucket(entry: ChatStatEntry) {
        return entry.ofScope(StatScope.Character);
    },

    listTrackedNames() {
        return Characters.listTrackedCharacterNames();
    },

    listActiveNames(stats: ChatStatEntry, oldStats: ChatStatEntry | null) {
        return Characters.listActiveCharacterNames();
    },

    isKnown(name: string) {
        return Characters.getCharacterIx(name) !== -1;
    },

    getIndex(name: string) {
        return Characters.getCharacterIx(name);
    },

    removeSubject(entry: ChatStatEntry, name: string) {
        delete entry.Characters[name];
    },
};

export const SceneScopeAdapter: ScopeAdapter = {
    scope: StatScope.Scene,
    label: 'Scene',
    pluralLabel: 'Scenes',

    getBucket(entry: ChatStatEntry) {
        return entry.ofScope(StatScope.Scene);
    },

    listTrackedNames() {
        return Scenes.listTrackedSceneNames();
    },

    listActiveNames(stats: ChatStatEntry, oldStats: ChatStatEntry | null) {
        return Scenes.listActiveSceneNames(stats, oldStats);
    },

    isKnown(name: string) {
        return Scenes.hasScene(name);
    },

    getIndex(name: string) {
        return Scenes.getSceneIx(name);
    },

    removeSubject(entry: ChatStatEntry, name: string) {
        delete entry.Scenes[name];
    },
};

export function getScopeAdapter(scope: StatScope): ScopeAdapter {
    switch (scope) {
        case StatScope.Character:
            return CharacterScopeAdapter;
        case StatScope.Scene:
            return SceneScopeAdapter;
        default:
            throw new Error(`No adapter registered for scope: ${scope}`);
    }
}
