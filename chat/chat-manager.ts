import { initial } from 'lodash';
import { chat, chat_metadata, saveChatConditional } from '../../../../../../script.js';
import { StatsBlock } from '../stats/stat-block.js';
import { ChatMetadata } from './chat-metadata.js';
import { ChatStatEntry } from './chat-stat-entry.js';

type ValidMessageIndex = number & { __validMessage: true };

export interface MessageContext {
    previousName: string | null;
    previousMessage: string;
    previousStats: ChatStatEntry | null;
    previousIndex: number;
    newName: string;
    newMessage: string;
    newStats: ChatStatEntry | null;
    newIndex: number;
}

export type IndexedChatMessage = {
    message: ChatMessage;
    index: number;
};

export class ChatManager {
    private _currentCharacter: string | null = null;

    constructor() {
        this.initializeFromMetadata();
    }

    initializeFromMetadata(): void {
        const ctx = SillyTavern.getContext();
        if (ctx) {
            this._currentCharacter = ctx.characters[ctx.characterId]?.name ?? null;
        }
    }

    get currentCharacter(): string | null {
        return this._currentCharacter;
    }

    getCurrentChat(): Array<ChatMessage> {
        return chat || [];
    }

    getMessage(index: number): ChatMessage | null {
        const chatArray = this.getCurrentChat();
        if (index < 0 || index >= chatArray.length) return null;
        
        return chatArray[index] ?? null;
    }

    getLatestMessage(): { message: ChatMessage | null; index: number; } | null {
        const chatArray = this.getCurrentChat();
        for (let i = chatArray.length - 1; i >= 0; i--) {
            if (this.isValidMessageForStats(i)) {
                return { 
                    message: this.getMessage(i), 
                    index: i 
                };
            }
        }
        return null;
    }

    getLatestStats(): ChatStatEntry | null {
        const latestMessage = this.getLatestMessage();
        if (!latestMessage) return null;

        return Chat.getMessageStats(latestMessage.index);
    }

    private isChatStatEntryData(obj: any): obj is { Characters: Record<string, StatsBlock>, Scenes: Record<string, StatsBlock> } {
        return obj &&
            typeof obj === 'object' &&
            'Characters' in obj &&
            'Scenes' in obj;
    }

    private isOldFlat(obj: any): obj is Record<string, StatsBlock> {
        return obj &&
            typeof obj === 'object' &&
            !Array.isArray(obj) &&
            !('Characters' in obj) &&
            !('Scenes' in obj);
    }

    private isNumericKeyedRecord(obj: any): boolean {
        return obj && typeof obj === 'object' && !Array.isArray(obj) &&
            Object.keys(obj).every(k => !isNaN(Number(k)));
    }

    private isNewStatsArrayLike(arr: any): boolean {
        return Array.isArray(arr) &&
            Object.keys(arr).every(k =>
                !isNaN(Number(k)) &&
                (arr[Number(k)] == null || this.isChatStatEntryData(arr[Number(k)]) || arr[Number(k)] instanceof ChatStatEntry)
            );
    }

    private migrateMessageStats(message: ChatMessage) {
        if (!message.stats) return;

        if (this.isNewStatsArrayLike(message.stats)) {
            return;
        }

        const newStats: Array<any> = [];
        const src = message.stats;

        if (Array.isArray(src) || this.isNumericKeyedRecord(src)) {
            for (const k of Object.keys(src)) {
                const i = Number(k);
                const v = src[i];

                if (v == null) {
                    newStats[i] = v;
                } else if (this.isChatStatEntryData(v)) {
                    newStats[i] = v;
                } else if (v instanceof ChatStatEntry) {
                    newStats[i] = v;
                } else if (this.isOldFlat(v)) {
                    newStats[i] = new ChatStatEntry(v, {});
                } else { // some garbage?
                    newStats[i] = null;
                }
            }
        } else {
            const swipeId = message.swipe_id ?? 0;

            if (this.isChatStatEntryData(src)) {
                newStats[swipeId] = src;
            } else if (this.isOldFlat(src)) {
                newStats[swipeId] = new ChatStatEntry(src, {});
            } else {
                newStats[swipeId] = null;
            }
        }

        message.stats = newStats;
        saveChatConditional();
    }

    getMessageStats(messageIndex: number): ChatStatEntry | null {
        const message = this.getMessage(messageIndex);
        if (!message || !message.stats) return null;

        if (!this.isNewStatsArrayLike(message.stats)) {
            this.migrateMessageStats(message);
        }

        const swipeId = message.swipe_id ?? 0;
        let stats = message.stats?.[swipeId] ?? null;

        if (!stats) return null;
        if (stats instanceof ChatStatEntry) return stats;

        if (this.isChatStatEntryData(stats)) {
            const hydrated = new ChatStatEntry(stats.Characters, stats.Scenes);
            message.stats[swipeId] = hydrated;
            return hydrated;
        }

        return null;
    }

    setMessageStats(messageIndex: number, stats: ChatStatEntry): boolean {
        if (!this.isValidMessageForStats(messageIndex)) return false;

        const message = this.getMessage(messageIndex);

        if (!message) return false;

        const swipeId = message.swipe_id ?? 0;

        if (!message.stats || !Array.isArray(message.stats)) {
            message.stats = [];
        }

        message.stats[swipeId] = stats;

        saveChatConditional();

        return true;
    }

    deleteMessageStats(messageIndex: number): boolean {
        const message = this.getMessage(messageIndex);
        if (!message) return false;

        const swipe_id = message.swipe_id ?? 0;
        if (!message.stats || !Array.isArray(message.stats) || !message.stats[swipe_id]) {
            return false;
        }
        
        delete message.stats[swipe_id];

        return true;
    }

    getPreviousMessage(currentIndex: number): { message: ChatMessage | null; index: number; } | null {
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (this.isValidMessageForStats(i)) {
                return { 
                    message: this.getMessage(i), 
                    index: i 
                };
            }
        }
        return null;
    }

    getMessageContext(messageIndex: number): MessageContext | null {
        if (!this.isValidMessageForStats(messageIndex)) return null;

        const current = this.getMessage(messageIndex);

        if (!current) return null;

        const previous = this.getPreviousMessage(messageIndex);
        const previousStats = previous ? this.getMessageStats(previous.index) : new ChatStatEntry({}, {});

        return {
            previousName: previous?.message?.name ?? null,
            previousMessage: previous?.message?.mes ?? "",
            previousStats: previousStats,
            previousIndex: previous ? previous.index : -1,
            newName: current.name,
            newMessage: current.mes,
            newStats: this.getMessageStats(messageIndex),
            newIndex: messageIndex
        };
    }

    getStatEligibleMessages(): Array<IndexedChatMessage> {
        const chatArray = this.getCurrentChat();
        return chatArray
            .map((msg, index) => ({ 
                message: this.getMessage(index), 
                index 
            }))
            .filter(item => this.isValidMessageForStats(item.index))
            .filter(item => item.message !== null) as { message: ChatMessage; index: number }[];
    }

    isValidMessageForStats(messageIndex: number): messageIndex is ValidMessageIndex {
        const message = this.getMessage(messageIndex);
        if (!message) return false;
        
        if (message.is_system) return false;
        
        // Exclude bracketed messages (e.g., [System notification], [Action], etc.)
        if (/^\[.*\]$/.test(message.mes)) return false;
        
        return true;
    }

    getMessagesFrom(startIndex: number, count = 1): number[] {
        return this.getStatEligibleMessages()
            .filter(({ index }) => index >= startIndex)
            .slice(0, count)
            .map(({ index }) => index);
    }

    saveChat() {
        saveChatConditional();
    }

    getMessageCount(): number {
        return this.getCurrentChat().length;
    }

    get Metadata(): ChatMetadata {
        if (!chat_metadata['StatSuite']) {
            chat_metadata['StatSuite'] = new ChatMetadata();
        }

        if (!(chat_metadata['StatSuite'] instanceof ChatMetadata)) {
            chat_metadata['StatSuite'] = ChatMetadata.parse(chat_metadata['StatSuite']);
        }
        
        return chat_metadata['StatSuite'];
    }
}

// Singleton instance
export const Chat = new ChatManager();
