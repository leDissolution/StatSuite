export const ChatMLTokens = Object.freeze({
    START: '<|im_start|>',
    END: '<|im_end|>',
    ROLES: {
        SYSTEM: 'system',
        USER: 'user',
        ASSISTANT: 'assistant'
    }
});

export const Stats = Object.freeze({
    POSE: 'pose',
    LOCATION: 'location',
    OUTFIT: 'outfit',
    OUTFIT_STATE: 'outfitState'
});

const SYS_PROMPT_ONE_STAT = `You are Scene Tracking Assistant updating scene stats from a message and previous stats.Follow these rules:
<rules>
    <core>
        - Only record ACTUAL changes, not potential/offered actions
        - If offered item/location, don't record unless explicitly accepted or moved
        - Keep unmentioned details exactly as previously recorded
        - No commentary, only physical states
    </core>
    {rules}
</rules>`

const RULES_LOCATION = `<location>
    - Record: Global area(planet, city, street, etc) > Property > Floor / Wing > Room > Position relative to objects / characters
    - Track indoor / outdoor and relative positions when mentioned
    - Pay attention to hierarchy and keep location as specific as possible
    - For characters in transit, indicate direction with "heading to X" or "moving towards X"
    - Only track actual movement, not planned or suggested
    - Provide FINAL location after movement is completed
    - DO NOT track any actions other than transitions
</location>`

const RULES_POSE = `<pose>
1. Primary(MUST HAVE ONE): Standing, Sitting, Lying, Kneeling, Crouching, Leaning, Walking, Running
2. Specifics(OPTIONAL):
- Named positions: straddling, embracing, spooning
    - Orientation details: on back, on side, face down, cross - legged
3. Direction(OPTIONAL): facing / looking(direction / object)
4. Limbs(OPTIONAL): arms / hands / legs position
5. Contact(OPTIONAL): touching / holding objects or characters

DO NOT add location or furniture
</pose>`

const UPDATE_STATS = `<task>Update the stats block for {req_name} with new data from the message.</task>
<input>
<message from={previous_name}>{previous_message}</message>
<stats>{previous_stats}</stats>
<message from={name}>{message}</message>
</input>

!REQUIRED OUTPUT FORMAT - COPY EXACTLY!:
<stats>{example_stats}</stats>`

const ONE_STAT_XML = '<stats character="{name}" {stat}="{value}" />';

function exampleOneStatXml(name, stat) {
    return ONE_STAT_XML.replace('{name}', name)
        .replace('{stat}', stat)
        .replace('{value}', '?');
}

function getRules(fieldName) {
    switch (fieldName) {
        case Stats.LOCATION:
            return RULES_LOCATION;
        case Stats.POSE:
            return RULES_POSE;
        case Stats.OUTFIT:
            return RULES_OUTFIT;
        case Stats.OUTFIT_STATE:
            return RULES_OUTFIT_STATE;
        default:
            return "";
    }
}

const NON_INSTRUCT_TEMPLATE = `<previousMessage from="{previous_from}"">{previous_message}</previousMessage>
{previous_stats}
<message from="{name}">{message}</message>
<stats character="{req_name}" {existingNewStats}{stat}="`

const EXPORT_TEMPLATE = `<previousMessage from={previous_from}>{previous_message}</previousMessage>
{previous_stats}
<message from={name}>{message}</message>
{new_stats}`

export function generateStatPrompt(stat, reqName, previousName, previousMessage, name, message, previousStats, existingNewStats) {
    //const rules = getRules(stat);
    //const sysPrompt = SYS_PROMPT_ONE_STAT.replace('{rules}', rules);
    //const exampleStats = exampleOneStatXml(reqName, stat);

    //const userPrompt = UPDATE_STATS
    //    .replace('{req_name}', reqName)
    //    .replace('{previous_message}', previousMessage || '')
    //    .replace('{previous_name}', previousName)
    //    .replace('{previous_stats}', previousStats || '')
    //    .replace('{name}', name)
    //    .replace('{message}', message || '')
    //    .replace('{example_stats}', exampleStats);

    //return {
    //    system: sysPrompt,
    //    user: userPrompt
    //};

    let existingNewStatsString = "";

    if (existingNewStats) {
        existingNewStatsString = Object.entries(existingNewStats)
            .map(([key, value]) => `${key.toLowerCase()}="${value}"`)
            .join(' ') + ' ';
    } else {
        existingNewStatsString = '';
    }

    const userPrompt = NON_INSTRUCT_TEMPLATE.replace('{previous_from}', previousName)
        .replace('{previous_message}', previousMessage || '')
        .replace('{previous_stats}', previousStats || '')
        .replace('{name}', name)
        .replace('{message}', message || '')
        .replace('{req_name}', reqName)
        .replace('{existingNewStats}', existingNewStatsString)
        .replace('{stat}', stat);

    return userPrompt;
}

export function generateExportPrompt(previousName, previousMessage, name, message, previousStats, newStats) {
    const exportPrompt = EXPORT_TEMPLATE.replace('{previous_from}', previousName)
        .replace('{previous_message}', previousMessage || '')
        .replace('{previous_stats}', previousStats || '')
        .replace('{name}', name)
        .replace('{message}', message || '')
        .replace('{new_stats}', newStats);
    return exportPrompt;
}

export function formatChatMLPrompt(promptObj, tokens = ChatMLTokens) {
    const parts = [];

    if (promptObj.system) {
        parts.push(`${tokens.START}${tokens.ROLES.SYSTEM}\n${promptObj.system}${tokens.END}`);
    }

    if (promptObj.user) {
        parts.push(`${tokens.START}${tokens.ROLES.USER}\n${promptObj.user}${tokens.END}`);
    }

    parts.push(`${tokens.START}${tokens.ROLES.ASSISTANT}\n`);

    return parts.join('\n');
}
