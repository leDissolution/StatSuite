// Handles adding paste/request buttons to message UI

import { makeStats, parseStatsString, setMessageStats } from '../stats/stats-logic.js';

/**
 * Adds paste and request buttons to a message's extra buttons container.
 * @param {number} messageId
 */
export function addPasteButton(messageId) {
    const messageDiv = $(`[mesid="${messageId}"]`);
    if (!messageDiv.length) return;
    const buttonsContainer = messageDiv.find('.extraMesButtons');
    if (!buttonsContainer.length) return;
    buttonsContainer.find('.paste-stats-button, .request-stats-button').remove();
    const buttonStyle = { 'cursor': 'pointer', 'opacity': '0.3', 'transition': 'opacity 0.2s', 'padding': '0 5px' };
    /** @this {HTMLElement} */
    const hoverIn = function (this) { $(this).css('opacity', '1'); };
    /** @this {HTMLElement} */
    const hoverOut = function (this) { $(this).css('opacity', '0.3'); };
    const pasteButton = $('<div class="paste-stats-button fa-solid fa-clipboard"></div>')
        .css(buttonStyle).attr('title', 'Paste stats from clipboard')
        .hover(hoverIn, hoverOut)
        .on('click', function () { pasteStats(messageId); });
    buttonsContainer.append(pasteButton);
    const requestButton = $('<div class="request-stats-button fa-solid fa-rotate"></div>')
        .css(buttonStyle).attr('title', 'Request/Regenerate stats for this message')
        .hover(hoverIn, hoverOut)
        .on('click', function (e) {
             makeStats(messageId, null, null, e.altKey !== true);
        });
    buttonsContainer.append(requestButton);
}

/**
 * Shows a modal to paste stats from clipboard and apply them to a message.
 * @param {number} messageId
 */
export async function pasteStats(messageId) {
    try {
        const modal = $('<div>').css({
            'position': 'fixed', 'top': '50%', 'left': '50%', 'transform': 'translate(-50%, -50%)',
            'background': 'var(--bg-color-chat-bubble-user)',
            'border': '1px solid var(--border-color-primary)',
            'padding': '20px', 'z-index': '1000', 'border-radius': '5px', 'box-shadow': '0 0 10px rgba(0,0,0,0.5)'
        });
        const textarea = $('<textarea>').css({
            'width': '400px', 'height': '200px', 'margin': '10px 0',
            'background': 'var(--bg-color-textbox)', 'color': 'var(--text-color-primary)',
            'border': '1px solid var(--border-color-secondary)', 'padding': '5px'
        }).attr('placeholder', 'Paste exported message format here...');
        const buttonContainer = $('<div>').css({ 'display': 'flex', 'gap': '10px', 'justify-content': 'flex-end' });
        const applyButton = $('<button class="primary-button">Apply</button>');
        const cancelButton = $('<button class="secondary-button">Cancel</button>');
        buttonContainer.append(cancelButton, applyButton);
        modal.append(textarea, buttonContainer);
        $('body').append(modal);
        textarea.focus();
        cancelButton.on('click', () => modal.remove());
        applyButton.on('click', () => {
            const clipText = String(textarea.val());
            if (!clipText) {
                toastr.error('No text provided'); return;
            }
            const statMatch = clipText.match(/<\/message>\s*([\s\S]*?)(?:\n\n|$)/);
            if (!statMatch || !statMatch[1]) {
                toastr.error('No stats block found after </message> in pasted text'); return;
            }
            const statsText = statMatch[1].trim();
            const stats = {};
            const statLines = statsText.split('\n');
            let parsedSomething = false;
            statLines.forEach(line => {
                const parsed = parseStatsString(line.trim());
                if (parsed) {
                    parsedSomething = true;
                    Object.entries(parsed).forEach(([char, charStats]) => {
                        if (!stats[char]) stats[char] = {};
                        Object.assign(stats[char], charStats);
                    });
                }
            });
            if (!parsedSomething) {
                toastr.error('Failed to parse any valid stats from the text'); return;
            }
            setMessageStats(stats, messageId);
            toastr.success('Stats applied successfully from pasted text');
            modal.remove();
        });
    } catch (err) {
        console.error('StatSuite UI Error: Failed to paste stats:', err);
        toastr.error('Failed to show paste stats modal or apply stats');
    }
}
