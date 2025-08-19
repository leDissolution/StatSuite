import { Scene } from './scene.js';
import { Chat } from '../chat/chat-manager.js';
import { EVENT_SCENE_ADDED, EVENT_SCENE_REMOVED } from '../events.js';
import { SceneManager } from './scene-manager.js';
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
        for (let ix = messageId; ix >= 0; ix--) {
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
    static overrideMobileBase(base) {
        const mobileBases = ['elevator'];
        return mobileBases.includes(base) ? true : null;
    }
    static potentiallyMobileBaseHeuristic(base) {
        const keywords = ['car', 'bus', 'train', 'ship', 'spaceship', 'van', 'elevator'];
        return keywords.some(keyword => base == keyword);
    }
    static containsWholeWord(hay, needle) {
        hay = hay.toLowerCase();
        needle = needle.toLowerCase();
        let idx = hay.indexOf(needle);
        while (idx !== -1) {
            const before = idx === 0 ? '' : hay[idx - 1];
            const after = idx + needle.length >= hay.length ? '' : hay[idx + needle.length];
            const isBoundary = (c) => !/[a-z0-9"']/i.test(c);
            if ((before === '' || isBoundary(before)) && (after === '' || isBoundary(after)))
                return true;
            idx = hay.indexOf(needle, idx + needle.length);
        }
        return false;
    }
    prefetchSceneNames(messageId) {
        const stats = Chat.getMessageStats(messageId);
        if (!stats)
            return [];
        const sceneManager = new SceneManager(Chat.getMessageStats.bind(Chat), {
            isPotentiallyMobile: SceneRegistry.potentiallyMobileBaseHeuristic,
            mobileOverride: SceneRegistry.overrideMobileBase
        });
        const { scenes } = sceneManager.getSceneGraphForMessage(messageId);
        const allScenes = new Set();
        for (const s of Object.values(scenes))
            allScenes.add(s.baseName);
        if (allScenes.size === 0)
            return [];
        const sceneCandidates = new Set();
        const tryMatch = (text) => {
            if (!text)
                return;
            const t = text;
            for (const name of allScenes) {
                if (SceneRegistry.containsWholeWord(t, name))
                    sceneCandidates.add(name);
            }
        };
        const sceneStats = stats.Scenes ?? {};
        for (const sName in sceneStats) {
            const block = sceneStats[sName] ?? {};
            for (const statKey in block)
                tryMatch(statKey);
        }
        const chars = stats.Characters ?? {};
        for (const cName in chars) {
            const location = chars[cName]?.['location'];
            if (typeof location !== 'string')
                continue;
            const parts = location.split(';');
            const headingTo = parts.length > 1 && parts[1] ? parts[1].trim() : '';
            tryMatch(headingTo);
        }
        return Array.from(sceneCandidates);
    }
    listActiveSceneNames(messageId, previousMessageId) {
        const locations = new Set();
        const sceneManager = new SceneManager(Chat.getMessageStats.bind(Chat), {
            isPotentiallyMobile: SceneRegistry.potentiallyMobileBaseHeuristic,
            mobileOverride: SceneRegistry.overrideMobileBase
        });
        const { scenes } = sceneManager.getSceneGraphForMessage(messageId);
        const activeSceneIds = sceneManager.getActiveScenes(messageId, scenes);
        if (previousMessageId !== null) {
            activeSceneIds.push(...sceneManager.getActiveScenes(previousMessageId, scenes));
        }
        activeSceneIds.forEach(sceneId => {
            const name = sceneManager.buildDisplayName(scenes, sceneId);
            if (name)
                locations.add(name);
        });
        return Array.from(locations);
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
