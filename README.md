# twitchify

Twitch bot that handles Spotify song queuing and chat TTS for your stream! <br />`DISCLAIMER:` code was generated with oil sipping clanker (Claude)

---

> [!NOTE]
Adding songs to playback queue requires Spotify Premium

## What it does

- Lets viewers queue Spotify songs via chat with a cooldown and blacklisting users if they queue trolly stuff
- Reads chat messages aloud through a PulseAudio sink. Voices use [Piper TTS](https://github.com/OHF-Voice/piper1-gpl) 
- Per-user voices that persist across sessions!
- Mods can toggle TTS on/off mid-stream and deny specific users from having their message read with TTS

---

## Requirements

- Node.js
- `pipx` — for installing Piper
- `espeak-ng` — Piper needs it for phonemization
- A PulseAudio null sink named `TTSSink` (created externally before running the bot)

```sh
sudo pacman -S espeak-ng python-pipx
pipx install piper-tts
```

---

## Setup

### 1. Clone and install dependencies

```sh
git clone git@github.com:conditionull/twitchify.git
cd twitchify
npm install
```

### 2. Environment variables

Create a `.env` file in the root:

```sh
TWITCH_BOT_USERNAME=
TWITCH_BROADCASTER_USERNAME=
TWITCH_OAUTH=

SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_ACCESS_TOKEN=
SPOTIFY_REFRESH_TOKEN=
```

**Twitch token** — get one from [twitchtokengenerator.com](https://twitchtokengenerator.com/) using a custom scope. The `TWITCH_OAUTH` value should be what you copid from the ACCESS TOKEN field on the twitch token generator website. I used chat:read and chat:edit scopes, I'm pretty sure that's all you need

**Spotify** — create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) to get your client ID and secret. The bot handles token refresh automatically.
<br />Make sure to set the redirect-uri to http://127.0.0.1:8000/callback or something else. localhost is no longer supported by Spotify's API

### 3. Get Spotify tokens
 
Leave `SPOTIFY_ACCESS_TOKEN` and `SPOTIFY_REFRESH_TOKEN` blank in `.env` for now. Run `auth.js` once to get them:
 
```sh
node auth.js
```
 
It starts a local server on port 8000. Open the link it prints in your terminal, log in with Spotify, and it'll write the tokens directly into your `.env` file. Once it says "tokens updated, you can close this" you're done. Don't run it again unless your tokens stop working

### 4. Set up TTSSink

Create the null sink before running the bot — the bot expects it to already exist:

```sh
pactl load-module module-null-sink \
  sink_name=TTSSink \
  sink_properties=device.description=TTSSink
```

To make it persist across reboots, add that line to your PulseAudio config or run it in your startup script.

### 5. Download voice models

Create a `voices/` folder in the repo root and download the models you want, these are the voices I liked the best:

```sh
mkdir -p voices && cd voices
```

```sh
# Amy (female)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx" -O en_US-amy-medium.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json" -O en_US-amy-medium.onnx.json

# Bryce (male)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/bryce/medium/en_US-bryce-medium.onnx" -O en_US-bryce-medium.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/bryce/medium/en_US-bryce-medium.onnx.json" -O en_US-bryce-medium.onnx.json

# Danny (male)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/danny/low/en_US-danny-low.onnx" -O en_US-danny-low.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/danny/low/en_US-danny-low.onnx.json" -O en_US-danny-low.onnx.json

# Kristin (female)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/kristin/medium/en_US-kristin-medium.onnx" -O en_US-kristin-medium.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/kristin/medium/en_US-kristin-medium.onnx.json" -O en_US-kristin-medium.onnx.json

# Joe (male)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/joe/medium/en_US-joe-medium.onnx" -O en_US-joe-medium.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/joe/medium/en_US-joe-medium.onnx.json" -O en_US-joe-medium.onnx.json

# Norman (male)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/norman/medium/en_US-norman-medium.onnx" -O en_US-norman-medium.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/norman/medium/en_US-norman-medium.onnx.json" -O en_US-norman-medium.onnx.json

# LibriTTS_R (neutral)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx" -O en_US-libritts_r-medium.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx.json" -O en_US-libritts_r-medium.onnx.json

# L2Arctic (non-native accent)
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx" -O en_US-l2arctic-medium.onnx
wget "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/l2arctic/medium/en_US-l2arctic-medium.onnx.json" -O en_US-l2arctic-medium.onnx.json
```

More voices available at [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US) on HuggingFace. To add one, download its `.onnx` and `.onnx.json` into `voices/` and add an entry to `VOICE_MAP` in `tts.js`.

### 6. Run

```sh
node index.js
```

---

## Chat commands

### Song queue

| Command | Who | Description |
|---|---|---|
| `!queue <spotify_url>` | Everyone | Queue a Spotify track (5 min max, 3 min cooldown) |
| `!q <spotify_url>` | Everyone | Alias for `!queue` |
| `!qon` | Mods | Open the queue |
| `!qoff` | Mods | Close the queue |
| `!deny <username>` | Mods | Block a user from queuing |
| `!allow <username>` | Mods | Unblock a user |

Queue open/closed state persists across restarts in `queue-state.json`. The queue deny list persists in `queue-blacklist.json`.

### TTS

| Command | Who | Description |
|---|---|---|
| `!tts on` | Mods | Enable TTS — bot will start reading chat |
| `!tts off` | Mods | Disable TTS |
| `!ttsdeny <username>` | Mods | Stop a user's messages from being read aloud |
| `!ttsallow <username>` | Mods | Let a user's messages be read aloud again |
| `!ttsvoice <name>` | Everyone | Set your personal TTS voice |
| `!ttsvoice list` | Everyone | List available voices in chat |
 
Available voices: `amy`, `bryce`, `danny`, `kristin`, `joe`, `norman`, `libritts_r`, `l2arctic`
 
Voice preferences are saved to `tts-voices.json` and persist across restarts. The denied user list is saved to `tts-denied.json` and also persists

> [!NOTE]
> TTS skips bot commands and caps messages at 300 characters (`sanitize()` in `tts.js`). URLs are read as "link". Messages containing slurs are silently skipped entirely — regular swear words are fine. The filter uses word-boundary regex with basic leet-speak matching and can be extended in the `BLOCKED_TERMS` array in `tts.js`
