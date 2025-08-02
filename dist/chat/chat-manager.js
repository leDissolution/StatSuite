// StatSuite - Chat Manager: Abstracts chat operations and provides clean interface
import { chat, saveChatConditional } from '../../../../../../script.js';
import { ChatStatEntry } from './chat-stat-entry.js';
/**
 * Universal stats storage: message.stats is now an object keyed by swipe_id (or 0 if null/undefined)
 * All messages (user and AI) use this system
 * @param {object} message - The message object to migrate
 */
function migrateMessageStats(message) {
    if (!message.stats)
        return;
    // If already in new format, skip
    if (typeof message.stats === 'object' && !Array.isArray(message.stats) && Object.keys(message.stats).some(k => typeof message.stats[k] === 'object')) {
        return;
    }
    // Migrate old flat stats to new format
    const swipeId = message.swipe_id ?? 0;
    const newStats = {};
    newStats[swipeId] = message.stats;
    message.stats = newStats;
    saveChatConditional();
}
export class ChatManager {
    constructor() {
        // Cache for proxied messages to avoid creating multiple proxies
        this._proxyCache = new WeakMap();
    }
    /**
     * Gets the current chat array
     * @returns {Array} The chat array
     */
    getCurrentChat() {
        return chat || [];
    }
    /**
     * Gets a specific message by index, with optional proxy wrapper
     * @param {number} index
     * @param {boolean} useProxy - Whether to return a proxy with transparent stats access
     * @returns {object|null}
     */
    getMessage(index, useProxy = false) {
        const chatArray = this.getCurrentChat();
        if (index < 0 || index >= chatArray.length)
            return null;
        const message = chatArray[index];
        if (!useProxy)
            return message;
        // Return cached proxy if available
        if (this._proxyCache.has(message)) {
            return this._proxyCache.get(message);
        }
        // Create and cache new proxy using the manager's methods
        const proxy = this._createMessageProxy(message, index);
        this._proxyCache.set(message, proxy);
        return proxy;
    }
    /**
     * Gets the latest non-system message
     * @param {boolean} useProxy - Whether to return a proxy
     * @returns {{message: object, index: number}|null}
     */
    getLatestMessage(useProxy = false) {
        const chatArray = this.getCurrentChat();
        for (let i = chatArray.length - 1; i >= 0; i--) {
            if (this.isValidMessageForStats(i)) {
                return {
                    message: this.getMessage(i, useProxy),
                    index: i
                };
            }
        }
        return null;
    }
    /**
     * Gets stats for a specific message
     * Universal: message.stats is an object keyed by swipe_id (or 0)
     * @param {number} messageIndex
     * @returns {ChatStatEntry|null} Stats for the message, or null if not found
     */
    getMessageStats(messageIndex) {
        const message = this.getMessage(messageIndex);
        if (!message)
            return null;
        const swipeId = message.swipe_id ?? 0;
        // If stats is a plain object but keys are not all numbers, treat as flat and migrate
        if (message.stats && typeof message.stats === 'object' && !Array.isArray(message.stats)) {
            const keys = Object.keys(message.stats);
            const allNumeric = keys.length > 0 && keys.every(k => !isNaN(Number(k)));
            if (!allNumeric) {
                const flatStats = message.stats;
                message.stats = {};
                message.stats[swipeId] = flatStats;
            }
        }
        else if (message.stats && (typeof message.stats !== 'object' || Array.isArray(message.stats))) {
            migrateMessageStats(message);
        }
        let stats = message.stats?.[swipeId] || null;
        if (!stats)
            return null;
        if (stats instanceof ChatStatEntry)
            return stats;
        if (stats["Characters"] && stats["Scenes"]) {
            message.stats = new ChatStatEntry(stats["Characters"], stats["Scenes"]);
            return message.stats;
        }
        message.stats = new ChatStatEntry(stats, {});
        return message.stats;
    }
    /**
     * Sets stats for a specific message
     * Universal: message.stats is an object keyed by swipe_id (or 0)
     * @param {number} messageIndex
     * @param {object} stats
     * @returns {boolean} Success
     */
    setMessageStats(messageIndex, stats) {
        if (!this.isValidMessageForStats(messageIndex))
            return false;
        const message = this.getMessage(messageIndex);
        const swipeId = message.swipe_id ?? 0;
        if (!message.stats || typeof message.stats !== 'object' || Array.isArray(message.stats)) {
            message.stats = {};
        }
        message.stats[swipeId] = stats;
        return true;
    }
    /**
     * Deletes stats for a specific message, handling all known formats and swipes
     * @param {number} messageIndex
     * @returns {boolean} Success
     */
    deleteMessageStats(messageIndex) {
        const message = this.getMessage(messageIndex);
        if (!message)
            return false;
        const swipeId = message.swipe_id ?? 0;
        if (message.stats && typeof message.stats === 'object' && !Array.isArray(message.stats)) {
            if (Object.prototype.hasOwnProperty.call(message.stats, swipeId)) {
                delete message.stats[swipeId];
            }
        }
        // Remove from legacy format
        else if (message.stats) {
            delete message.stats;
        }
        if (message.swipe_info && typeof message.swipe_info === 'object') {
            if (message.swipe_info[swipeId] && message.swipe_info[swipeId].stats) {
                delete message.swipe_info[swipeId].stats;
            }
        }
        this.clearCache();
        return true;
    }
    /**
     * Creates a proxy that makes message.stats transparently access the correct stats location
     * Uses the manager's getMessageStats and setMessageStats methods to avoid duplication
     * @param {object} message - The message object
     * @param {number} messageIndex - The index of the message (needed for manager methods)
     * @returns {Proxy} Proxied message with transparent stats access
     */
    _createMessageProxy(message, messageIndex) {
        return new Proxy(message, {
            get: (target, prop) => {
                if (prop === 'stats') {
                    // Use the manager's method to get stats
                    return this.getMessageStats(messageIndex);
                }
                return target[prop];
            },
            set: (target, prop, value) => {
                if (prop === 'stats') {
                    // Use the manager's method to set stats
                    this.setMessageStats(messageIndex, value);
                    return true;
                }
                target[prop] = value;
                return true;
            }
        });
    }
    /**
     * Gets the previous non-system message for context
     * @param {number} currentIndex
     * @param {boolean} useProxy - Whether to return a proxy
     * @returns {{message: object, index: number}|null}
     */
    getPreviousMessage(currentIndex, useProxy = false) {
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (this.isValidMessageForStats(i)) {
                return {
                    message: this.getMessage(i, useProxy),
                    index: i
                };
            }
        }
        return null;
    }
    /**
     * @typedef MessageContext
     * @property {string|null} previousName - Name of the previous message sender
     * @property {string} previousMessage - The text of the previous message
     * @property {ChatStatEntry} previousStats - Stats object for the previous message
     * @property {number} previousIndex - Index of the previous message
     * @property {string} newName - Name of the current message sender
     * @property {string} newMessage - The text of the current message
     * @property {ChatStatEntry} newStats - Stats object for the current message
     * @property {number} newIndex - Index of the current message
     */
    /**
     * Gets message context for stat generation (compatible with existing getRecentMessages)
     * @param {number} messageIndex
     * @param {boolean} useProxy - Whether to return proxied messages
     * @returns {MessageContext|null} Context with previous and current message details
     */
    getMessageContext(messageIndex, useProxy = false) {
        if (!this.isValidMessageForStats(messageIndex))
            return null;
        const current = this.getMessage(messageIndex, useProxy);
        const previous = this.getPreviousMessage(messageIndex, useProxy);
        const previousStats = previous ? this.getMessageStats(previous.index) : new ChatStatEntry({}, {});
        return {
            previousName: previous ? previous.message.name : null,
            previousMessage: previous ? previous.message.mes : "",
            previousStats: previousStats, // Return raw stats, let caller handle processing
            previousIndex: previous ? previous.index : -1,
            newName: current.name,
            newMessage: current.mes,
            newStats: this.getMessageStats(messageIndex),
            newIndex: messageIndex
        };
    }
    /**
     * Gets all non-system messages for export
     * @param {boolean} useProxy - Whether to return proxied messages
     * @returns {Array} Filtered messages with their indices
     */
    getStatEligibleMessages(useProxy = false) {
        const chatArray = this.getCurrentChat();
        return chatArray
            .map((msg, index) => ({
            message: this.getMessage(index, useProxy),
            index
        }))
            .filter(item => this.isValidMessageForStats(item.index));
    }
    /**
     * Checks if a message exists and is valid for stat operations
     * Single source of truth for message validation
     * @param {number} messageIndex
     * @returns {boolean}
     */
    isValidMessageForStats(messageIndex) {
        const message = this.getMessage(messageIndex);
        if (!message)
            return false;
        // Exclude system messages
        if (message.is_system)
            return false;
        // Exclude bracketed messages (e.g., [System notification], [Action], etc.)
        if (/^\[.*\]$/.test(message.mes))
            return false;
        return true;
    }
    /**
     * Gets indices of messages that need stat regeneration
     * @param {number} startIndex
     * @returns {number[]}
     */
    getMessagesFrom(startIndex, count = 1) {
        return this.getStatEligibleMessages(true)
            .filter(({ index }) => index >= startIndex)
            .slice(0, count)
            .map(({ index }) => index);
    }
    /**
     * Clears any internal caches (call when chat changes)
     */
    clearCache() {
        this._proxyCache = new WeakMap();
    }
    /**
     * Gets a proxied message for clean stats access
     * @param {number} messageIndex
     * @returns {Proxy|null}
     */
    getProxiedMessage(messageIndex) {
        return this.getMessage(messageIndex, true);
    }
    /**
     * Saves the chat (delegates to SillyTavern's save function)
     */
    saveChat() {
        if (typeof saveChatConditional === 'function') {
            saveChatConditional();
        }
        else {
            console.warn("StatSuite: saveChatConditional not available");
        }
    }
    /**
     * Gets the total number of messages
     * @returns {number}
     */
    getMessageCount() {
        return this.getCurrentChat().length;
    }
}
// Singleton instance
export const Chat = new ChatManager();
