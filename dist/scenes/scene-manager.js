function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
export class SceneManager {
    constructor(getStats, hooks) {
        Object.defineProperty(this, "sceneGraphCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "isPotentiallyMobile", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => false
        });
        Object.defineProperty(this, "getMessageStats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.getMessageStats = getStats;
        if (hooks?.isPotentiallyMobile)
            this.isPotentiallyMobile = hooks.isPotentiallyMobile;
    }
    isAncestor(descendantId, ancestorId, scenes) {
        if (!descendantId || !ancestorId || !scenes)
            return false;
        let cur = scenes[descendantId]?.parentId ?? null;
        const seen = new Set();
        let depth = 0;
        while (cur) {
            depth++;
            if (depth > 20) {
                break;
            }
            if (seen.has(cur)) {
                break; // safety against accidental cycles
            }
            seen.add(cur);
            if (cur === ancestorId) {
                return true;
            }
            cur = scenes[cur]?.parentId ?? null;
        }
        return false;
    }
    // Utility helpers to keep logic centralized
    compositeKey(parentId, baseKey, ownerKey) {
        const pKey = parentId ?? '__NO_PARENT__';
        const oKey = ownerKey ?? '__NO_OWNER__';
        return `${pKey}||${baseKey}||${oKey}`;
    }
    scoreFor(scene, character) {
        return (scene.visitors[character] || 0) * 2 + scene.updatedAt;
    }
    updateVisit(scene, character, messageId, messageVersion) {
        scene.updatedAt = messageId;
        scene.messageVersion = messageVersion;
        scene.visitors[character] = Math.max(scene.visitors[character] || 0, messageId);
    }
    changeParent(sceneId, newParentId, character, messageId, messageVersion, scenes, index, unownedIndex, opts) {
        const scene = scenes[sceneId];
        if (!scene)
            return;
        if (scene.parentId === newParentId) {
            this.updateVisit(scene, character, messageId, messageVersion);
            return;
        }
        const baseKey = this.ownerlessBase(scene.baseName);
        const oldKey = this.compositeKey(scene.parentId, baseKey, scene.explicitOwner);
        if (index.get(oldKey) === sceneId)
            index.delete(oldKey);
        const oldParent = scene.parentId;
        const justRefined = oldParent != null && newParentId != null && (this.isAncestor(oldParent, newParentId, scenes) || this.isAncestor(newParentId, oldParent, scenes));
        const movedByOwnerlessTail = !!opts?.movedByOwnerlessTail && oldParent == null && newParentId != null;
        if ((oldParent != null && !justRefined) || movedByOwnerlessTail) {
            if (oldParent != null) {
                if (!scene.parentHistory)
                    scene.parentHistory = [];
                scene.parentHistory.push({ parentId: oldParent, messageId });
            }
            scene.isMobile = true;
        }
        scene.parentId = newParentId;
        this.updateVisit(scene, character, messageId, messageVersion);
        const newKey = this.compositeKey(scene.parentId, baseKey, scene.explicitOwner);
        index.set(newKey, sceneId);
        // Maintain unowned buckets
        if (!scene.explicitOwner) {
            const byBase = unownedIndex.get(baseKey);
            if (byBase) {
                for (const ids of byBase.values())
                    ids.delete(sceneId);
                const pKey = scene.parentId ?? '__NO_PARENT__';
                if (!byBase.has(pKey))
                    byBase.set(pKey, new Set());
                byBase.get(pKey).add(sceneId);
            }
        }
    }
    segmentMatchesNode(segment, nodeId, scenes) {
        const segNorm = this.normalizeName(segment);
        const baseKey = this.ownerlessBase(segNorm);
        const wantOwner = this.extractOwner(segNorm);
        const node = scenes[nodeId];
        if (!node)
            return false;
        const nodeBase = this.ownerlessBase(node.baseName);
        if (nodeBase !== baseKey)
            return false;
        if (wantOwner) {
            const eff = this.getEffectiveOwner(nodeId, scenes);
            return eff === wantOwner;
        }
        return true;
    }
    findLongestVisitedSuffix(pathSegments, scenes, character) {
        let best = null;
        for (let i = 0; i < pathSegments.length; i++) {
            const seg = pathSegments[i];
            const candidates = [];
            for (const id of Object.keys(scenes)) {
                const s = scenes[id];
                if (!s)
                    continue;
                if (!(character in s.visitors))
                    continue; // require prior visit by this character
                if (this.segmentMatchesNode(seg, id, scenes))
                    candidates.push(id);
            }
            if (candidates.length === 0)
                continue;
            for (const candId of candidates) {
                let curId = candId;
                const matched = [candId];
                let k = i + 1;
                let chainScore = this.scoreFor(scenes[candId], character);
                while (k < pathSegments.length && curId) {
                    // Among children of curId, find match for pathSegments[k]
                    const children = Object.keys(scenes).filter((cid) => scenes[cid].parentId === curId);
                    let bestChild = null;
                    for (const cid of children) {
                        if (this.segmentMatchesNode(pathSegments[k], cid, scenes)) {
                            const sc = scenes[cid];
                            const score = this.scoreFor(sc, character);
                            if (!bestChild || score > bestChild.score)
                                bestChild = { id: cid, score };
                        }
                    }
                    if (!bestChild)
                        break;
                    matched.push(bestChild.id);
                    chainScore += bestChild.score;
                    curId = bestChild.id;
                    k++;
                }
                const len = matched.length;
                if (len > 0) {
                    if (!best ||
                        len > best.length ||
                        (len === best.length && i > best.startIndex) ||
                        (len === best.length && i === best.startIndex && chainScore > best.score)) {
                        best = { startIndex: i, rootId: matched[0], length: len, ids: matched, score: chainScore };
                    }
                }
            }
        }
        if (!best)
            return null;
        return { startIndex: best.startIndex, rootId: best.rootId, length: best.length, ids: best.ids };
    }
    normalizeName(segment) {
        // Trim, strip surrounding quotes, and lowercase; preserve internal apostrophes for ownership.
        const s = segment.trim();
        const stripped = (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))))
            ? s.slice(1, -1)
            : s;
        return stripped.trim();
    }
    extractOwner(segment) {
        // Owner's
        const match = segment.match(/^\s*([^,;]+?)'s\s+/i);
        return match ? match[1].trim() : null;
    }
    // Normalize a name for matching keys by removing a single leading owner prefix
    ownerlessBase(name) {
        const m = name.match(/^\s*([^,;]+?)'s\s+(.+)$/i);
        const base = m ? m[2] : name;
        return this.normalizeName(base);
    }
    getEffectiveOwner(sceneId, scenes) {
        if (!sceneId || !(sceneId in scenes))
            return null;
        const scene = scenes[sceneId];
        if (!scene)
            return null;
        if (scene.explicitOwner)
            return scene.explicitOwner;
        if (scene.parentId)
            return this.getEffectiveOwner(scene.parentId, scenes);
        return null;
    }
    findOrCreateScene(baseName, explicitOwner, parentId, character, messageId, messageVersion, scenes, index, unownedIndex, options) {
        const allowUnownedRelocation = options?.allowUnownedRelocation ?? true;
        const baseKey = this.ownerlessBase(baseName);
        const key = this.compositeKey(parentId, baseKey, explicitOwner);
        const pKey = parentId ?? '__NO_PARENT__';
        // 1) Exact match: reuse and update visit
        const exactId = index.get(key);
        if (exactId) {
            this.changeParent(exactId, parentId, character, messageId, messageVersion, scenes, index, unownedIndex);
            return exactId;
        }
        // 1.5) Owned relocation: if a scene with same base and owner exists elsewhere, move it here
        if (explicitOwner) {
            let bestOwned = null;
            for (const [k, id] of index.entries()) {
                const parts = k.split('||');
                if (parts.length !== 3)
                    continue;
                const [, bKey, oKey] = parts;
                const desiredOwnerKey = explicitOwner ?? '__NO_OWNER__';
                if (bKey === baseKey && oKey === desiredOwnerKey) {
                    const s = scenes[id];
                    if (!s)
                        continue;
                    const score = this.scoreFor(s, character);
                    if (!bestOwned || score > bestOwned.score)
                        bestOwned = { id, score };
                }
            }
            if (bestOwned) {
                const sceneId = bestOwned.id;
                const scene = scenes[sceneId];
                this.changeParent(sceneId, parentId, character, messageId, messageVersion, scenes, index, unownedIndex);
                scene.explicitOwner = explicitOwner;
                const ownedKey = this.compositeKey(scene.parentId, baseKey, explicitOwner);
                index.set(ownedKey, sceneId);
                return sceneId;
            }
        }
        // 2) Adoption: prefer unowned scene with same base (same parent first), then anywhere
        if (explicitOwner) {
            const byBase = unownedIndex.get(baseKey);
            const byParent = byBase?.get(pKey);
            const candidates = [];
            if (byParent) {
                for (const id of byParent) {
                    const s = scenes[id];
                    if (s)
                        candidates.push({ id, score: this.scoreFor(s, character) });
                }
            }
            if (candidates.length === 0 && byBase) {
                for (const [parentKey, ids] of byBase.entries()) {
                    if (parentKey === pKey)
                        continue;
                    for (const id of ids) {
                        const s = scenes[id];
                        if (s)
                            candidates.push({ id, score: this.scoreFor(s, character) });
                    }
                }
            }
            candidates.sort((a, b) => b.score - a.score);
            if (candidates.length > 0) {
                const sceneId = candidates[0].id;
                const scene = scenes[sceneId];
                // If parent differs, reparent via helper (handles indexes)
                if (scene.parentId !== parentId) {
                    this.changeParent(sceneId, parentId, character, messageId, messageVersion, scenes, index, unownedIndex);
                }
                else {
                    // Update visit if parent is same
                    this.updateVisit(scene, character, messageId, messageVersion);
                }
                // Mark owner and update composite index
                scene.explicitOwner = explicitOwner;
                // Remove from unowned buckets for all parents
                if (byBase) {
                    for (const ids of byBase.values())
                        ids.delete(sceneId);
                }
                const newKey = this.compositeKey(scene.parentId, baseKey, explicitOwner);
                index.set(newKey, sceneId);
                return sceneId;
            }
        }
        // 3) Optional: unowned relocation (only when allowed)
        if (!explicitOwner && allowUnownedRelocation) {
            const byBase = unownedIndex.get(baseKey);
            if (byBase) {
                let best = null;
                for (const ids of byBase.values()) {
                    for (const id of ids) {
                        const s = scenes[id];
                        if (!s)
                            continue;
                        // Only relocate unowned nodes if the base is inherently mobile, or the node is already marked mobile
                        // Purely algorithmic + hook: relocate unowned nodes if already mobile or considered potentially mobile
                        if (!s.isMobile && !this.isPotentiallyMobile(this.ownerlessBase(s.baseName)))
                            continue;
                        const score = this.scoreFor(s, character);
                        if (!best || score > best.score)
                            best = { id, score };
                    }
                }
                if (best) {
                    const sceneId = best.id;
                    this.changeParent(sceneId, parentId, character, messageId, messageVersion, scenes, index, unownedIndex);
                    return sceneId;
                }
            }
        }
        // 4) Create new scene
        const id = uuidv4();
        const newScene = {
            id,
            baseName,
            explicitOwner,
            parentId,
            visitors: { [character]: messageId },
            createdAt: messageId,
            updatedAt: messageId,
            messageVersion,
            isMobile: false,
        };
        scenes[id] = newScene;
        index.set(key, id);
        if (!explicitOwner) {
            if (!unownedIndex.has(baseKey))
                unownedIndex.set(baseKey, new Map());
            const byBase = unownedIndex.get(baseKey);
            if (!byBase.has(pKey))
                byBase.set(pKey, new Set());
            byBase.get(pKey).add(id);
        }
        return id;
    }
    processMessage(messageId, currentScenes, messageVersion, index, unownedIndex) {
        const stats = this.getMessageStats(messageId);
        if (!stats)
            return;
        for (const [character, statsBlock] of Object.entries(stats.Characters)) {
            const location = statsBlock?.["location"];
            if (!location)
                continue;
            const path = location.split(';')[0].split(',').map((p) => p.trim());
            let parentId = null;
            // Suffix-preserving relocation: try to keep the deepest previously visited chain intact
            const suffix = this.findLongestVisitedSuffix(path, currentScenes, character);
            if (suffix) {
                // 1) Build/resolve prefix up to the reparent boundary so parent exists
                const reparentPathIndex = (suffix.length >= 2 && suffix.startIndex === 1)
                    ? (suffix.startIndex + 1)
                    : suffix.startIndex;
                const buildEndExclusive = reparentPathIndex;
                let parentIdBuild = null;
                for (let i = 0; i < buildEndExclusive; i++) {
                    const segment = path[i];
                    const baseName = this.normalizeName(segment);
                    const explicitOwner = this.extractOwner(segment) || null;
                    parentIdBuild = this.findOrCreateScene(baseName, explicitOwner, parentIdBuild, character, messageId, messageVersion, currentScenes, index, unownedIndex, { allowUnownedRelocation: false });
                }
                const desiredParent = parentIdBuild;
                // Choose which node in the suffix to move:
                // - If the suffix starts at the first child (index 1) and has depth >= 2, move the second node (avoid moving the immediate container)
                // - Otherwise, move the root of the suffix
                const idsIndex = reparentPathIndex - suffix.startIndex;
                const reparentId = suffix.ids[idsIndex];
                const nodeToMove = currentScenes[reparentId];
                let movedRoot = false;
                if (nodeToMove && nodeToMove.parentId !== desiredParent) {
                    // Prevent creating cycles: do not reparent if desiredParent is inside nodeToMove's subtree
                    const wouldCreateCycle = desiredParent != null && this.isAncestor(desiredParent, reparentId, currentScenes);
                    if (wouldCreateCycle) {
                        // skip reparent to avoid cycle
                    }
                    else {
                        const movedByOwnerlessTail = (this.extractOwner(this.normalizeName(path[reparentPathIndex])) == null);
                        // Purely algorithmic: move if owned, already mobile, first anchoring from ROOT via ownerless tail,
                        // or if new location increases depth (placing into a container),
                        // or if moving between parents that share the same base label (e.g., hangar->hangar)
                        const computeDepth = (id) => {
                            if (!id)
                                return 0;
                            let d = 1;
                            let p = currentScenes[id]?.parentId ?? null;
                            const guard = new Set();
                            while (p && !guard.has(p)) {
                                guard.add(p);
                                d++;
                                p = currentScenes[p]?.parentId ?? null;
                            }
                            return d;
                        };
                        const oldDepth = computeDepth(reparentId);
                        const newDepth = computeDepth(desiredParent) + 1;
                        const parentSameBase = nodeToMove.parentId != null && desiredParent != null && this.ownerlessBase(currentScenes[nodeToMove.parentId].baseName) === this.ownerlessBase(currentScenes[desiredParent].baseName);
                        const oldParentDepth = computeDepth(nodeToMove.parentId);
                        const canMove = !!nodeToMove.explicitOwner
                            || !!nodeToMove.isMobile
                            || (nodeToMove.parentId == null && desiredParent != null && movedByOwnerlessTail)
                            || (newDepth > oldDepth)
                            || parentSameBase
                            || (oldParentDepth >= 2)
                            || this.isPotentiallyMobile(this.ownerlessBase(nodeToMove.baseName));
                        if (canMove) {
                            this.changeParent(reparentId, desiredParent, character, messageId, messageVersion, currentScenes, index, unownedIndex, { movedByOwnerlessTail });
                            movedRoot = true;
                        }
                    }
                }
                // 2) Walk the matched suffix deterministically using known ids, then create any extra tail
                let parentIdTail = desiredParent;
                const startIdxInSuffix = reparentPathIndex - suffix.startIndex;
                // If we didn't move the matched root and it's not already under desiredParent, don't walk the suffix under this parent
                let matchedCount = suffix.length - startIdxInSuffix;
                if (!movedRoot) {
                    const rootId = suffix.ids[startIdxInSuffix];
                    const rootNode = currentScenes[rootId];
                    if (rootNode && rootNode.parentId !== desiredParent)
                        matchedCount = 0;
                }
                for (let j = 0; j < matchedCount; j++) {
                    const id = suffix.ids[startIdxInSuffix + j];
                    const node = currentScenes[id];
                    if (!node)
                        continue;
                    if (node.parentId !== parentIdTail) {
                        this.changeParent(id, parentIdTail, character, messageId, messageVersion, currentScenes, index, unownedIndex);
                    }
                    else {
                        this.updateVisit(node, character, messageId, messageVersion);
                    }
                    parentIdTail = id;
                }
                for (let i = reparentPathIndex + matchedCount; i < path.length; i++) {
                    const segment = path[i];
                    const baseName = this.normalizeName(segment);
                    const explicitOwner = this.extractOwner(segment) || null;
                    const sceneId = this.findOrCreateScene(baseName, explicitOwner, parentIdTail, character, messageId, messageVersion, currentScenes, index, unownedIndex);
                    parentIdTail = sceneId;
                }
                continue;
            }
            for (let i = 0; i < path.length; i++) {
                const segment = path[i];
                const baseName = this.normalizeName(segment);
                const explicitOwner = this.extractOwner(segment) || null; // only explicit markers set ownership
                const sceneId = this.findOrCreateScene(baseName, explicitOwner, parentId, character, messageId, messageVersion, currentScenes, index, unownedIndex, { allowUnownedRelocation: false });
                parentId = sceneId;
            }
        }
    }
    getLatestMessageVersion(messageId) {
        return 1; // In a real system, this would check against stored versions
    }
    getSceneGraphForMessage(messageId) {
        const cachedGraph = this.sceneGraphCache.get(messageId);
        if (cachedGraph) {
            const currentVersion = this.getLatestMessageVersion(messageId);
            if (currentVersion <= cachedGraph.messageVersion) {
                return cachedGraph;
            }
        }
        let startId = -1;
        let baseGraph;
        for (let id = messageId - 1; id >= 0; id--) {
            const g = this.sceneGraphCache.get(id);
            if (!g)
                continue;
            const currentVersion = this.getLatestMessageVersion(id);
            if (currentVersion <= g.messageVersion) {
                startId = id;
                baseGraph = g;
                break;
            }
        }
        const scenes = {};
        let highestVersion = 0;
        if (baseGraph) {
            for (const [id, sc] of Object.entries(baseGraph.scenes)) {
                scenes[id] = { ...sc };
            }
            highestVersion = baseGraph.messageVersion;
        }
        const { index, unownedIndex } = this.rebuildIndexes(scenes);
        for (let id = startId + 1; id <= messageId; id++) {
            const ver = this.getLatestMessageVersion(id);
            highestVersion = Math.max(highestVersion, ver);
            this.processMessage(id, scenes, ver || 1, index, unownedIndex);
        }
        const hierarchy = this.buildHierarchy(scenes);
        const sceneGraph = { scenes, hierarchy, messageVersion: highestVersion };
        this.sceneGraphCache.set(messageId, sceneGraph);
        return sceneGraph;
    }
    resolveSceneByPath(pathSegments, scenes, character) {
        let parentId = null;
        let inheritedOwner = null;
        for (const raw of pathSegments) {
            const seg = this.normalizeName(raw);
            const explicit = this.extractOwner(seg) || null;
            const owner = explicit ?? inheritedOwner;
            const baseKey = this.ownerlessBase(seg);
            // Candidates are children of current parent
            const candidates = [];
            for (const [id, sc] of Object.entries(scenes)) {
                if (sc.parentId === parentId) {
                    const effOwner = this.getEffectiveOwner(id, scenes) ?? null;
                    const baseOk = this.ownerlessBase(sc.baseName) === baseKey;
                    const ownerOk = owner == null ? true : effOwner === owner;
                    if (baseOk && ownerOk)
                        candidates.push(id);
                }
            }
            if (candidates.length === 0) {
                return null;
            }
            if (candidates.length === 1) {
                parentId = candidates[0];
            }
            else {
                // Disambiguate: prefer the one visited by character, else most recently updated
                let bestId = candidates[0];
                let bestScore = -1;
                for (const id of candidates) {
                    const sc = scenes[id];
                    const score = character ? this.scoreFor(sc, character) : sc.updatedAt;
                    if (score > bestScore) {
                        bestScore = score;
                        bestId = id;
                    }
                }
                parentId = bestId;
            }
            inheritedOwner = owner;
        }
        return parentId;
    }
    buildDisplayName(scenes, id) {
        if (!scenes[id])
            return null;
        const chain = [];
        let cur = id;
        while (cur && scenes[cur]) {
            const curScene = scenes[cur];
            chain.push(curScene.baseName);
            if (curScene.isMobile) {
                break;
            }
            cur = curScene.parentId ?? null;
        }
        chain.reverse();
        return chain.join(', ');
    }
    getActiveScenes(messageId, scenes) {
        if (!scenes) {
            const graph = this.getSceneGraphForMessage(messageId);
            scenes = graph.scenes;
        }
        const latest = {};
        // Determine latest leaf scene per character
        for (let id = 0; id <= messageId; id++) {
            const stats = this.getMessageStats(id);
            if (!stats)
                continue;
            for (const [character, statsBlock] of Object.entries(stats.Characters)) {
                const location = statsBlock?.["location"];
                if (!location)
                    continue;
                const path = location.split(';')[0].split(',').map((p) => p.trim());
                if (path.length === 0)
                    continue;
                const sceneId = this.resolveSceneByPath(path, scenes, character);
                latest[character] = sceneId ?? null;
            }
        }
        const result = new Set();
        for (const val of Object.values(latest)) {
            if (!val)
                continue;
            const leafId = val;
            const chain = [];
            let cur = leafId;
            const guard = new Set();
            while (cur && scenes[cur] && !guard.has(cur)) {
                guard.add(cur);
                chain.push(cur);
                cur = scenes[cur]?.parentId ?? null;
            }
            chain.reverse();
            if (chain.length === 0)
                continue;
            const mobileIdx = [];
            for (let i = 0; i < chain.length; i++) {
                const sc = scenes[chain[i]];
                if (sc?.isMobile)
                    mobileIdx.push(i);
            }
            if (mobileIdx.length > 0) {
                const firstMobile = mobileIdx[0];
                if (firstMobile > 0) {
                    result.add(chain[firstMobile - 1]);
                }
                for (let m = 0; m < mobileIdx.length; m++) {
                    const endExclusive = (m + 1 < mobileIdx.length) ? mobileIdx[m + 1] : chain.length;
                    const lastNode = chain[endExclusive - 1];
                    result.add(lastNode);
                }
                continue;
            }
            result.add(chain[chain.length - 1]);
        }
        return Array.from(result);
    }
    invalidateMessage(messageId) {
        for (let id = messageId; id < Number.MAX_SAFE_INTEGER; id++) {
            if (this.sceneGraphCache.has(id)) {
                this.sceneGraphCache.delete(id);
            }
            else {
                break;
            }
        }
    }
    rebuildIndexes(scenes) {
        const index = new Map();
        const unownedIndex = new Map();
        const entries = Object.entries(scenes).sort((a, b) => {
            const sa = a[1];
            const sb = b[1];
            if (sa.createdAt !== sb.createdAt)
                return sa.createdAt - sb.createdAt;
            if (sa.updatedAt !== sb.updatedAt)
                return sa.updatedAt - sb.updatedAt;
            return a[0].localeCompare(b[0]);
        });
        for (const [id, sc] of entries) {
            const baseKey = this.ownerlessBase(sc.baseName);
            const ownerKey = sc.explicitOwner ?? '__NO_OWNER__';
            const pKey = sc.parentId ?? '__NO_PARENT__';
            index.set(`${pKey}||${baseKey}||${ownerKey}`, id);
            if (!sc.explicitOwner) {
                if (!unownedIndex.has(baseKey))
                    unownedIndex.set(baseKey, new Map());
                const byBase = unownedIndex.get(baseKey);
                if (!byBase.has(pKey))
                    byBase.set(pKey, new Set());
                byBase.get(pKey).add(id);
            }
        }
        return { index, unownedIndex };
    }
    buildHierarchy(scenes) {
        const hierarchy = {};
        for (const id of Object.keys(scenes))
            hierarchy[id] = [];
        for (const [id, sc] of Object.entries(scenes)) {
            if (sc.parentId && hierarchy[sc.parentId])
                hierarchy[sc.parentId]?.push(id);
        }
        return hierarchy;
    }
}
