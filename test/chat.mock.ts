export interface Message {
    id: number;
    character: string;
    location: string;
    items: string[];
}

export interface MessageStats {
    Characters: Record<string, { location: string }>;
    Scenes: Record<string, { items: string }>;
}

export class Chat {
    messages: Message[] = [];

    addMessage(character: string, location: string, items: string): number {
        const id = this.messages.length;
        const itemsArray = items ? items.split(',').map((i) => i.trim()).filter((i) => i) : [];

        this.messages.push({ id, character, location, items: itemsArray });

        return id;
    }

    editMessage(id: number, { character, location, items }: { character: string; location: string; items: string }): boolean {
        if (id >= this.messages.length) return false;

        const itemsArray = items ? items.split(',').map((i) => i.trim()).filter((i) => i) : [];

        this.messages[id] = { id, character, location, items: itemsArray };
        return true;
    }

    getMessageStats(messageId: number): MessageStats | null {
        if (messageId >= this.messages.length) {
            return { Characters: {}, Scenes: {} };
        }

        if (!this.messages[messageId]) return null;

        const message = this.messages[messageId];
        return {
            Characters: {
                [message.character]: { location: message.location },
            },
            Scenes: {
                [message.location]: { items: message.items.join(', ') },
            },
        };
    }

    getMessage(messageId: number): Message | null {
        return this.messages[messageId] || null;
    }

    getMessageCount(): number {
        return this.messages.length;
    }
}
