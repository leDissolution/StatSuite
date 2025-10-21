import { Scene } from './scene.js';
import { Chat } from '../chat/chat-manager.js';
import { EVENT_SCENE_ADDED, EVENT_SCENE_REMOVED } from '../events.js';
import { SceneManager } from './scene-manager.js';
const PREFETCH_PASSAGE_SCAN_DEPTH = 3;
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
    static normalizeSceneName(name) {
        return name
            .split(',')
            .map(part => part.trim())
            .filter(Boolean)
            .join(', ')
            .toLowerCase();
    }
    static normalizeBaseName(name) {
        return name.trim().toLowerCase();
    }
    static extractPassageTargets(passageText) {
        if (typeof passageText !== 'string')
            return [];
        const targets = new Set();
        const segments = passageText.split(';');
        for (const segment of segments) {
            const trimmed = segment.trim();
            if (!trimmed)
                continue;
            const regex = /\bto\b\s*([^;\[\]]+)/gi;
            let match;
            while ((match = regex.exec(trimmed)) !== null) {
                const raw = match[1]?.trim() ?? '';
                if (!raw)
                    continue;
                const cleaned = raw
                    .replace(/\s*\[.*$/, '')
                    .replace(/[.,;:]+$/, '')
                    .trim();
                if (cleaned)
                    targets.add(cleaned);
            }
        }
        return Array.from(targets);
    }
    static parsePassageEntries(passageText) {
        if (typeof passageText !== 'string')
            return [];
        const entries = [];
        for (const segment of passageText.split(';')) {
            const trimmed = segment.trim();
            if (!trimmed)
                continue;
            // capture: left side (kind), target, optional [state]
            const m = trimmed.match(/^(.*?)\bto\b\s*([^\[\]]+?)(?:\s*(\[[^\]]+\]))?\s*$/i);
            if (!m)
                continue;
            const kind = (m[1] || '').trim();
            let target = (m[2] || '').trim().replace(/[.,;:]+$/, '');
            const state = (m[3] || '').trim() || null;
            if (!target || target.toLowerCase() === 'unspecified')
                continue;
            entries.push({ kind, target, state });
        }
        return entries;
    }
    prefetchSceneNames(messageId) {
        const stats = Chat.getMessageStats(messageId);
        if (!stats)
            return [];
        const sceneManager = new SceneManager(Chat.getMessageStats.bind(Chat), {
            isPotentiallyMobile: SceneRegistry.potentiallyMobileBaseHeuristic,
            mobileOverride: SceneRegistry.overrideMobileBase
        });
        const sceneGraph = sceneManager.getSceneGraphForMessage(messageId);
        const scenes = sceneGraph.scenes;
        const hierarchy = sceneGraph.hierarchy;
        const sceneEntries = Object.entries(scenes);
        const allScenes = new Set();
        for (const [, scene] of sceneEntries)
            allScenes.add(scene.baseName);
        if (allScenes.size === 0)
            return [];
        const chainCache = new Map();
        const fullNameToIds = new Map();
        const baseNameToIds = new Map();
        const neighbors = new Map();
        const idToFullName = new Map();
        const pushToMap = (map, key, value) => {
            if (!map.has(key))
                map.set(key, []);
            map.get(key).push(value);
        };
        const buildChain = (id) => {
            if (chainCache.has(id))
                return chainCache.get(id);
            const chain = [];
            const guard = new Set();
            let current = id;
            while (current && !guard.has(current)) {
                guard.add(current);
                const scene = scenes[current];
                if (!scene)
                    break;
                chain.push(scene.baseName);
                current = scene.parentId ?? null;
            }
            chain.reverse();
            chainCache.set(id, chain);
            return chain;
        };
        const getFullName = (id) => {
            const cached = idToFullName.get(id);
            if (cached && cached.trim() !== '')
                return cached;
            const chain = buildChain(id);
            if (chain.length === 0)
                return null;
            const full = chain.join(', ');
            idToFullName.set(id, full);
            return full;
        };
        for (const [id, scene] of sceneEntries) {
            const chain = buildChain(id);
            idToFullName.set(id, chain.join(', '));
            if (chain.length > 0) {
                const normalizedFullName = SceneRegistry.normalizeSceneName(chain.join(', '));
                if (normalizedFullName)
                    pushToMap(fullNameToIds, normalizedFullName, id);
            }
            const baseKey = SceneRegistry.normalizeBaseName(scene.baseName);
            if (baseKey)
                pushToMap(baseNameToIds, baseKey, id);
            const adjacency = new Set();
            if (scene.parentId)
                adjacency.add(scene.parentId);
            const children = hierarchy[id] ?? [];
            for (const childId of children)
                adjacency.add(childId);
            neighbors.set(id, Array.from(adjacency));
        }
        const chainEntries = Array.from(chainCache.entries());
        const findSceneIdsForName = (name) => {
            const normalizedName = SceneRegistry.normalizeSceneName(name);
            let ids = fullNameToIds.get(normalizedName) ?? [];
            if (ids.length > 0)
                return ids;
            const segments = name
                .split(',')
                .map(part => part.trim())
                .filter(Boolean);
            if (segments.length === 0)
                return [];
            const segLower = segments.map(seg => seg.toLowerCase());
            const suffixMatches = [];
            for (const [id, chain] of chainEntries) {
                if (chain.length < segments.length)
                    continue;
                let idx = chain.length - segments.length;
                let matches = true;
                for (let i = 0; i < segLower.length; i++) {
                    if (chain[idx + i].toLowerCase() !== segLower[i]) {
                        matches = false;
                        break;
                    }
                }
                if (matches)
                    suffixMatches.push(id);
            }
            if (suffixMatches.length > 0)
                return suffixMatches;
            const lastSegment = segLower[segLower.length - 1];
            return baseNameToIds.get(lastSegment) ?? [];
        };
        const findNearbyScenes = (startId, targetName) => {
            const targetKey = SceneRegistry.normalizeBaseName(targetName);
            if (!targetKey)
                return [];
            const matches = new Set();
            const queue = [{ id: startId, depth: 0 }];
            const visited = new Set([startId]);
            while (queue.length > 0) {
                const { id, depth } = queue.shift();
                const node = scenes[id];
                if (!node)
                    continue;
                if (depth > 0) {
                    if (SceneRegistry.normalizeBaseName(node.baseName) === targetKey) {
                        const fullName = getFullName(id) ?? node.baseName;
                        matches.add(fullName);
                    }
                }
                if (depth >= PREFETCH_PASSAGE_SCAN_DEPTH)
                    continue;
                const next = neighbors.get(id) ?? [];
                for (const nextId of next) {
                    if (!visited.has(nextId)) {
                        visited.add(nextId);
                        queue.push({ id: nextId, depth: depth + 1 });
                    }
                }
            }
            return Array.from(matches);
        };
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
            const passagesRaw = block['passages'];
            // Prefetch nearby based on passages
            if (typeof passagesRaw === 'string' && passagesRaw.trim()) {
                const startIds = findSceneIdsForName(sName);
                if (startIds.length > 0) {
                    const targets = SceneRegistry.extractPassageTargets(passagesRaw);
                    for (const target of targets) {
                        for (const startId of startIds) {
                            const nearby = findNearbyScenes(startId, target);
                            for (const match of nearby)
                                sceneCandidates.add(match);
                        }
                    }
                }
            }
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
