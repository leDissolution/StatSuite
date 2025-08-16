import { Scene } from './scene.js';
import { Chat } from '../chat/chat-manager.js';
import { EVENT_SCENE_ADDED, EVENT_SCENE_REMOVED } from '../events.js';
export class SceneRegistry {
    constructor() {
        Object.defineProperty(this, "_scenes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_eventTarget", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._scenes = new Set();
        this._eventTarget = new EventTarget();
    }
    initializeFromMetadata() {
        const trackedScenes = Chat.Metadata.trackedScenes;
        this._scenes.clear();
        trackedScenes.forEach((scene) => {
            if (scene instanceof Scene) {
                this.attachScene(scene);
            }
            else if (typeof scene === 'object' && scene !== null && 'name' in scene) {
                const rehydrated = new Scene(scene.name, scene.isActive);
                this.attachScene(rehydrated);
            }
            else if (typeof scene === 'string') {
                this.addScene(scene);
            }
        });
    }
    addScene(name) {
        const scene = new Scene(name);
        this.attachScene(scene);
    }
    attachScene(scene) {
        if (!this.hasScene(scene.name)) {
            this._scenes.add(scene);
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_SCENE_ADDED, { detail: scene.name }));
            return true;
        }
        return false;
    }
    removeScene(name) {
        let removed = false;
        for (const sc of this._scenes) {
            if (sc.name === name) {
                this._scenes.delete(sc);
                removed = true;
                break;
            }
        }
        if (removed) {
            this.saveToMetadata();
            this._eventTarget.dispatchEvent(new CustomEvent(EVENT_SCENE_REMOVED, { detail: name }));
        }
        return removed;
    }
    hasScene(name) {
        for (const sc of this._scenes) {
            if (sc.name === name)
                return true;
        }
        return false;
    }
    getScene(name) {
        for (const sc of this._scenes) {
            if (sc.name === name)
                return sc;
        }
        return null;
    }
    getSceneIx(name) {
        return this.listTrackedScenes().findIndex(sc => sc.name === name);
    }
    getLatestSceneStats(name, messageId) {
        for (let ix = messageId - 1; ix >= 0; ix--) {
            const stats = Chat.getMessageStats(ix);
            if (!stats)
                continue;
            if (!stats.Scenes) {
                return null;
            }
            if (stats.Scenes[name]) {
                return stats.Scenes[name];
            }
            for (const sc in stats.Scenes) {
                if (name.endsWith(sc)) {
                    return stats.Scenes[sc] || null;
                }
            }
        }
        return null;
    }
    listTrackedSceneNames() {
        return this.listTrackedScenes()
            .map(sc => sc.name)
            .sort();
    }
    listActiveSceneNames(stats, oldStats) {
        const newLocations = new Set();
        if (!stats || !stats.Characters)
            return [];
        for (const charStats of Object.values(stats.Characters).concat(Object.values(oldStats?.Characters || {}))) {
            if (!charStats)
                continue;
            const loc = charStats["location"];
            if (typeof loc === 'string' && loc.length > 0) {
                const sepIx = loc.indexOf(';');
                const firstPart = (sepIx >= 0 ? loc.substring(0, sepIx) : loc).trim();
                if (firstPart)
                    newLocations.add(firstPart);
            }
        }
        const oldLocations = oldStats?.Scenes ? new Set(Object.keys(oldStats.Scenes)) : new Set();
        const relevantLocations = new Set();
        // For each new location, if it ends with any old location, split into prefix and the matched old location.
        for (const nl of newLocations) {
            let bestMatch = null;
            for (const ol of oldLocations) {
                if (!ol)
                    continue;
                if (nl.endsWith(ol)) {
                    if (!bestMatch || ol.length > bestMatch.length)
                        bestMatch = ol; // prefer the longest suffix match
                }
            }
            if (bestMatch) {
                const prefixRaw = nl.slice(0, nl.length - bestMatch.length);
                // Trim common separators (comma, semicolon, spaces, dashes, underscores, colons) at the end of the prefix
                const prefix = prefixRaw.replace(/[\s,;:_-]+$/g, '').trim();
                if (prefix)
                    relevantLocations.add(prefix);
                relevantLocations.add(bestMatch);
            }
            else {
                relevantLocations.add(nl);
            }
        }
        return Array.from(relevantLocations);
    }
    listTrackedScenes() {
        return Array.from(this._scenes);
    }
    addEventListener(type, callback) {
        this._eventTarget.addEventListener(type, callback);
    }
    removeEventListener(type, callback) {
        this._eventTarget.removeEventListener(type, callback);
    }
    saveToMetadata() {
        Chat.Metadata.trackedScenes = this.listTrackedScenes();
        Chat.Metadata.save();
    }
    clear() {
        this._scenes.clear();
        this.saveToMetadata();
    }
}
export const Scenes = new SceneRegistry();
