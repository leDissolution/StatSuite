// StatSuite - Chat Manager: Abstracts chat operations and provides clean interface
import { chat, saveChatConditional } from '../../../../../script.js';

/**
 * Migrates stats from old format (message.stats) to new format (message.swipe_info[swipe_id].stats)
 * Only applies to AI messages - user messages keep using message.stats directly
 * @param {object} message - The message object to migrate
 */
function migrateMessageStats(message) {
    if (!message.stats || message.is_user) return; // Don't migrate user messages
      console.log(`StatSuite: Migrating AI message stats from old format to swipe-specific format`);
    
    // Ensure swipe_info structure exists (array of objects)
    if (!message.swipe_info) message.swipe_info = [];
    if (!message.swipe_info[message.swipe_id]) {
        message.swipe_info[message.swipe_id] = {};
    }
    
    // Move stats to current swipe if not already there
    if (!message.swipe_info[message.swipe_id].stats) {
        message.swipe_info[message.swipe_id].stats = message.stats;
    }
    
    // Remove old format (AI messages only)
    delete message.stats;
    
    // Save immediately since this is an implicit migration
    if (typeof saveChatConditional === 'function') {
        saveChatConditional();
    }
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
     */    getMessage(index, useProxy = false) {
        const chatArray = this.getCurrentChat();
        if (index < 0 || index >= chatArray.length) return null;
        
        const message = chatArray[index];
        if (!useProxy) return message;
        
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
     * Handles both user messages (message.stats) and AI messages (swipe-specific stats)
     * @param {number} messageIndex 
     * @returns {object}
     */
    getMessageStats(messageIndex) {
        const message = this.getMessage(messageIndex);
        if (!message) return {};

        // User messages: always use direct stats
        if (message.is_user) {
            return message.stats || {};
        }

        // AI messages: use swipe-specific stats
        // Check for old format and migrate if needed (AI messages only)
        if (message.stats && !message.swipe_info?.[message.swipe_id]?.stats) {
            migrateMessageStats(message);
        }
        
        return message.swipe_info?.[message.swipe_id]?.stats || {};
    }    
    
    /**
     * Sets stats for a specific message
     * Handles both user messages (message.stats) and AI messages (swipe-specific stats)
     * @param {number} messageIndex 
     * @param {object} stats 
     * @returns {boolean} Success
     */    setMessageStats(messageIndex, stats) {
        if (!this.isValidMessageForStats(messageIndex)) return false;
        
        const message = this.getMessage(messageIndex);

        // User messages: always set direct stats
        if (message.is_user) {
            message.stats = stats;
            return true;
        }// AI messages: set swipe-specific stats
        if (!message.swipe_info) message.swipe_info = [];
        if (!message.swipe_info[message.swipe_id]) {
            message.swipe_info[message.swipe_id] = {};
        }

        message.swipe_info[message.swipe_id].stats = stats;
        
        // Clean up old format if it exists (AI messages only)
        if (message.hasOwnProperty('stats')) {
            delete message.stats;
        }
        
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
     * Gets message context for stat generation (compatible with existing getRecentMessages)
     * @param {number} messageIndex 
     * @param {boolean} useProxy - Whether to return proxied messages
     * @returns {object|null} Context with previous and current message details
     */    
    getMessageContext(messageIndex, useProxy = false) {
        if (!this.isValidMessageForStats(messageIndex)) return null;
        
        const current = this.getMessage(messageIndex, useProxy);
        const previous = this.getPreviousMessage(messageIndex, useProxy);
        const previousStats = previous ? this.getMessageStats(previous.index) : {};

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
        if (!message) return false;
        
        // Exclude system messages
        if (message.is_system) return false;
        
        // Exclude bracketed messages (e.g., [System notification], [Action], etc.)
        if (/^\[.*\]$/.test(message.mes)) return false;
        
        return true;
    }

    /**
     * Gets indices of messages that need stat regeneration
     * @param {number} startIndex 
     * @param {boolean} includeFollowing 
     * @returns {number[]}
     */
    getRegenerationIndices(startIndex, includeFollowing = false) {
        const chatArray = this.getCurrentChat();
        const indices = [];

        if (includeFollowing) {
            // Include all messages from startIndex to end
            for (let i = startIndex; i < chatArray.length; i++) {
                if (this.isValidMessageForStats(i)) {
                    indices.push(i);
                }
            }
        } else {
            // Just the specific message
            if (this.isValidMessageForStats(startIndex)) {
                indices.push(startIndex);
            }
        }

        return indices;
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
        } else {
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
export const chatManager = new ChatManager();
