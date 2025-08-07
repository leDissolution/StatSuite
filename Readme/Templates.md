# Templates

Templates transform stats into SillyTavern variables that you can use anywhere in your workflow - worldbooks, character cards, prompts, or messages.

## Quick Start

Templates use Handlebars syntax to format character stats into variables. Create a template, give it a variable name, and use that variable throughout ST.

### Basic Example

```handlebars
{{#each Characters}}
{{@key}} is {{this.pose}}, wearing {{this.outfit}}.
{{/each}}
```

## Template Settings

- **Name**: Template identifier
- **Template String**: Your Handlebars code
- **Enabled**: Toggle template on/off
- **Variable Name**: SillyTavern variable to store output (e.g., `char_status`, `location_data`)
- **Inject at Depth**: Auto-inject into messages (optional)

## Template Data

Templates receive stats object with the following structure (will be expanded as more tracked elements are added):

```javascript
{
  Characters: {
    "Alice": {
        "isPlayer": true,
        "room": "Living Room",
        "Stats": {
            "location": "Living Room; on couch",
            "pose": "Sitting",
            "outfit": "Casual clothes"
            //...rest of character stats
        }
    },
    "Bob": {
        "isPlayer": false,
        "room": "Kitchen",
        "Stats": {
            "location": "Kitchen; at counter",
            "pose": "Cooking",
            "outfit": "Apron"
            //...rest of character stats
        }
    }
  }
}
```

## Handlebars Basics

### Access Data
```handlebars
{{{Characters.Alice.Stats.location}}}
{{{Characters.Bob.Stats.pose}}}
```
Note the triple braces `{{{ }}}` to avoid escaping of quotes and such.

### Loop Through Characters
```handlebars
{{#each Characters}}
{{@key}}: {{{this.Stats.location}}} ({{{this.Stats.pose}}})
{{/each}}
```

...will render each character's name, location, and pose.

### Conditional Content
```handlebars
{{#each Characters}}
{{#if !this.isPlayer}}
{{{this.Stats.mood}}}
{{/if}}
{{/each}}
```

...will render character's mood only for non-player character.

### Custom Helpers
As of now, there is a single custom helper `ifEquals` to compare two values:
```handlebars
{{#ifEquals "a" "b"}}
Equal!
{{else}}
Not equal!
{{/ifEquals}}
```
...which is useful in conjunction with the next custom thing:

### Using other ST variables
With the $ block, you can use other SillyTavern variables within templates:
```handlebars
{{#ifEquals Characters.{$char}.room Characters.{$user}.room}}
{{char}} and {{user}} are in the same room
{{else}}
{{char}} and {{user}} are in different rooms
{{/ifEquals}}
```

The difference between {{char}} and {$char} is that first is calculated after the template is rendered, while the second is calculated before rendering, allowing to bypass the Handlebars limitation when it comes to using dynamic access.

Beware of circular references and such.

## Default template

The built-in template creates XML-like metadata:
```handlebars
<metadata>
{{#each Characters}}
    <stats character="{{{@key}}}" {{#each this.Stats}}{{@key}}="{{{this}}}" {{/each}}/>
{{/each}}
</metadata>
```

## Template Management

1. Go to settings → Templates
2. Click "Add Template"
3. Set variable name (optional)
4. Write your Handlebars template
5. Use preview to test
6. Enable the template

## Troubleshooting

**Variable not working:**
- Check template is enabled
- Verify variable name spelling
- Ensure template has valid syntax

**Empty output:**
- Characters may not have stats yet
- Check conditional logic in template
- Use preview to see sample output

## Updating
Variables and injections update automatically as character stats change.