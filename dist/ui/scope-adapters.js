import { StatScope } from '../stats/stat-entry.js';
import { Characters } from '../characters/characters-registry.js';
import { Scenes } from '../scenes/scene-registry.js';
export const CharacterScopeAdapter = {
    scope: StatScope.Character,
    label: 'Character',
    pluralLabel: 'Characters',
    getBucket(entry) {
        return entry.ofScope(StatScope.Character);
    },
    listTrackedNames() {
        return Characters.listTrackedCharacterNames();
    },
    listActiveNames(stats, oldStats) {
        return Characters.listActiveCharacterNames();
    },
    isKnown(name) {
        return Characters.getCharacterIx(name) !== -1;
    },
    getIndex(name) {
        return Characters.getCharacterIx(name);
    },
    removeSubject(entry, name) {
        delete entry.Characters[name];
    },
};
export const SceneScopeAdapter = {
    scope: StatScope.Scene,
    label: 'Scene',
    pluralLabel: 'Scenes',
    getBucket(entry) {
        return entry.ofScope(StatScope.Scene);
    },
    listTrackedNames() {
        return Scenes.listTrackedSceneNames();
    },
    listActiveNames(stats, oldStats) {
        return Scenes.listActiveSceneNames(stats, oldStats);
    },
    isKnown(name) {
        return Scenes.hasScene(name);
    },
    getIndex(name) {
        return Scenes.getSceneIx(name);
    },
    removeSubject(entry, name) {
        delete entry.Scenes[name];
    },
};
export function getScopeAdapter(scope) {
    switch (scope) {
        case StatScope.Character:
            return CharacterScopeAdapter;
        case StatScope.Scene:
            return SceneScopeAdapter;
        default:
            throw new Error(`No adapter registered for scope: ${scope}`);
    }
}
