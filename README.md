![Version](https://img.shields.io/badge/alpha-0.2-orange)

# Stat Tracker (Open Alpha)

A (prototype of) persistence engine for SillyTavern. Your creative, but a bit... inattentive model will no longer forget what character is wearing, what room they are located in, and the contents of their backpack.

How is it different from the already existing Tracker? Well, it does not use your big, slow main model. Creative samplers will not affect the tracking, and the context cache will not get discarded.

## Features

- Basic character state management
	- Pose and location
	- Outfit details (worn items, state of (un)dress, contents of pockets and bags and whatnot)
	- Body state (general health, injuries, hunger, etc)

## Installation and usage

### Installation

As usual, start with adding the extension through the ST's `Install Extension`.

Now comes the tricky part. In order to use the extension without the main model, you need, well, some other model. Dont worry, I got you covered:
[StatSuite_G2B_Alpha (HF hub)](https://huggingface.co/LeDissolution/StatSuite_G2B_Alpha_GGUF)

It is small enough to be ran on CPU at good speed, especially in Q4 (I do recommend using Q8 if possible tho), and will be blazing fast if you got spare VRAM.

Put it up with any local inference engine you like - I myself prefer Koboldcpp, but anything will do, as long as it supports OpenAI API - on a separate port from your regular model, with enough context to hold two messages (2k will most probably be enough). Get the address, paste it into the settings
![image](https://github.com/user-attachments/assets/38b11890-6459-40b0-8e8a-5f50ac35bbcc)

...and you are good to go!

### Settings

#### Characters
![image](https://github.com/user-attachments/assets/8a2d291e-a8eb-4516-842e-4c2a785680a2)

List of characters that are being tracked _at the moment_. You can freely modify it - remove characters that left the scene, and add character that entered the scene. It will not affect stat history, only what is being requested for new messages.
By default, it will treat each message author as a character (works with group chats!). If you are using some kind of narrator card, you should disable that and keep track manually. For now, at least - I hope to devise a way to narratively track the characters one day.

Checkbox next to the character name is whether it is player or not. For now, it only matters when the character enters the scene first time - it will try to read {{description}} for AI cards and {{persona}} for player, to try and initialize the stats when the character is seen first time.

#### Stats
![image](https://github.com/user-attachments/assets/279cae5a-ae3a-4311-888e-9a1af862b9d0)

List of stats to track. You can disable ones you find not very useful for the playthrough (for example, exposure for non-ERP), or try adding custom ones. It will probably not work very well, but feel free to experiment!
"manual" checkbox means that this field will not be requested from the model, but just copied over from previous message. You can store whatever you want that way - think of it as per-character author note @depth 1.

Mood is turned off by default. I can see it potentially being useful, but it is extremely unstable as of now, I'm very bad at labeling the mood. I might or might not just remove it altogether to not confuse the model during training, feedback is welcome.

##### Presets
You can create presets of stats to quickly switch between them. It is useful for different characters having different stats, or if you want to track some stats only in certain scenes (e.g., exposure in ERP, but not in regular chat). Preset stores:
- Whether the stat is enabled or not
- Whether the stat is manual or not
- Display name of the stat
- Default value of the custom stats (default values for the built-in stats are set in the model, and cannot be changed)

<img width="300" height="200" alt="image" src="https://github.com/user-attachments/assets/e609ee3d-1f3d-45d6-b040-045a300a617d" />
<img width="300" height="200" alt="image" src="https://github.com/user-attachments/assets/3c958546-336a-45ad-8754-f28d098a99ba" />

To make a preset, click the "Save As" button next to the preset selector, and give it a name. It will copy the current stats list, and you can then modify it as you like. You can also lock the preset to the current character, and it will be selected by default for all the new chats with that character.

### Usage

Just start playing, and it will take care of itself...

![image](https://github.com/user-attachments/assets/52098649-8f13-482d-bde5-99e688e6f89b)

...by injecting the stats into the prompt @Depth 1 (0 is too strong, and adding it higher up leads to model confusing what is up do date)

![image](https://github.com/user-attachments/assets/b4cbfc38-1e8c-490b-94dc-94eb093c073a)

Only the latest stat block is being sent to the model to not pollute the prompt.

It is a good idea to "seed" the stats that were not explicitly specified in char card/first message by either providing an OOC note (recommended) or, if that fails, editing stats directly
![image](https://github.com/user-attachments/assets/3168e28f-c087-4076-a2d6-fb25ce033f79)

The model is trained to infer the things from the context (e.g., if "your shirt" is being mentioned it will pull it into the outfit), but it might sometimes be unreliable, especially with location.

## Contribution
Feel free to report any issues with either extension itself (preferably here on GitHub) or the model - for more privacy, you can DM me either on Reddit (u/stoppableDissolution), or Discord (ledissolution, I am present in general ST server).
If you see the model making some blatant mistake or just producing questionable output, it will be extremely helpful if you provide me with specific message using ![image](https://github.com/user-attachments/assets/0eb6fd24-050f-435f-890b-d471ff273448) export button. 
*Disclaimer: It most probably will be used for training.* I am not training on the message texts tho, only the generated stats.

Overall the model have currently only seen a couple dozen of my own chats (plus a couple from my wonderful alpha testers), and there is only so much wording variety one can produce and label. 

*If you are willing to contribute entire chats or lend your hand at doing more labels, reach out - I cant afford any monetary compensation as of now, but it will be dearly appreciated and credited.*

## Plans
- Scene details (weather, temperature, time, smth else?)
- Automatic detection of characters entering/leaving the scene for tracking purposes
- Map (room contents including discarded items, known rooms, what doors lead where, etc. Predefined backgrounds per location?)
- Smaller model
