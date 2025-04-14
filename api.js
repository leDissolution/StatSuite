// api.js - Handles communication with the external stat generation API
import { extensionSettings } from './settings.js'; // Will be created next
import { generateStatPrompt } from './prompts.js';
import { statsToStringFull } from './export.js';
import { StatConfig } from './stats_logic.js'; // Will be created

const API_URL = "{0}/api/v1/generate";

/**
 * Generates a specific stat for a character using the external API.
 * @param {string} stat The stat to generate (e.g., from Stats enum).
 * @param {string} char The character name.
 * @param {object} messages Object containing previous/new message details (previousName, previousMessage, newName, newMessage, previousStats).
 * @param {object} existingStats Current stats for the character in the new message, used for dependencies.
 * @param {boolean} greedy Whether to use greedy sampling.
 * @returns {Promise<string>} The generated stat value or an error string (e.g., "error", "error_missing_url").
 */
export async function generateStat(stat, char, messages, existingStats = {}, greedy = true) {
    if (!StatConfig || !StatConfig[stat]) {
        console.error(`StatSuite API Error: StatConfig not loaded or stat "${stat}" invalid.`);
        return "error_invalid_config";
    }

    const dependencies = {};
    if (StatConfig[stat].dependencies.length > 0) {
        StatConfig[stat].dependencies.forEach(dep => {
            // Use existing value from the *current* message's stats if available
            if (existingStats && existingStats[dep]) {
                dependencies[dep] = existingStats[dep];
            }
        });
    }

    // Ensure previousStats is an object before passing to statsToStringFull
    const safePreviousStats = messages.previousStats && typeof messages.previousStats === 'object' ? messages.previousStats : {};
    const previousStatsString = statsToStringFull(safePreviousStats);

    const statPrompt = generateStatPrompt(
        stat,
        char,
        messages.previousName,
        messages.previousMessage,
        messages.newName,
        messages.newMessage,
        previousStatsString,
        dependencies // Pass the calculated dependencies
    );
    console.log(`Generating ${stat} for ${char}:`, statPrompt);

    try {
        // Ensure modelUrl is available from settings
        if (!extensionSettings.modelUrl) {
            console.error("StatSuite API Error: Model URL is not set in settings.");
            return "error_missing_url";
        }

        const response = await $.post(API_URL.replace("{0}", extensionSettings.modelUrl),
            JSON.stringify({
                prompt: statPrompt,
                top_k: greedy ? 1 : 3,
                temperature: greedy ? 0 : 1,
                stop_sequence: ['"'] // Original stop sequence
            }));

        // Basic validation of response structure
        if (response && response.results && response.results.length > 0 && typeof response.results[0].text === 'string') {
            const text = response.results[0].text;
            const quoteIndex = text.indexOf('"');
            return quoteIndex !== -1 ? text.substring(0, quoteIndex).trim() : text.trim();
        } else {
            console.error(`Error generating ${stat} for ${char}: Invalid API response structure`, response);
            return "error_invalid_response";
        }
    } catch (error) {
        console.error(`Error generating ${stat} for ${char}:`, error);
        // Provide more specific error feedback if possible
        let errorType = "error_api_call_failed";
        if (error.status === 404) errorType = "error_model_not_found";
        if (error.status === 0) errorType = "error_network_or_cors"; // Could be CORS or network issue
        return errorType;
    }
}
