const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const AUDIO_SINK  = 'TTSSink';
const VOICES_DIR  = path.join(__dirname, 'voices');
const VOICES_FILE = path.join(__dirname, 'tts-voices.json');
const DENIED_FILE = path.join(__dirname, 'tts-denied.json');

// ── Available voices ──────────────────────────────────────────────────────────
// Key   = what users type in chat (!ttsvoice amy)
// value = the .onnx filename (without extension) inside the voices/ folder
//
// To add more voices:
//   1. Download the .onnx + .onnx.json from HuggingFace into ./voices/
//   2. Add an entry here
const VOICE_MAP = {
  amy:        'en_US-amy-medium',
  bryce:      'en_US-bryce-medium',
  danny:      'en_US-danny-low',
  kristin:    'en_US-kristin-medium',
  joe:        'en_US-joe-medium',
  libritts_r: 'en_US-libritts_r-medium',
  norman:     'en_US-norman-medium',
  l2arctic:   'en_US-l2arctic-medium',
};

const DEFAULT_VOICE = 'libritts_r';

// ── Slur filter ───────────────────────────────────────────────────────────────
// Messages matching any of these patterns are silently skipped entirely.
// Uses loose leet-speak matching to catch common substitutions.
// Regular swear words are intentionally not included.
const BLOCKED_TERMS = [
  /\bn[i!1][g9][g9][e3]r\b/i,
  /\bn[i!1][g9]{2}[ae3]?\b/i,
  /\bf[a@]g{1,2}[o0]?t?\b/i,
  /\bk[i!1]k[e3]\b/i,
  /\bch[i!1]nk\b/i,
  /\bsp[i!1][ck]k?\b/i,
  /\bw[e3]tb[a@]ck\b/i,
  /\bc[o0]{2}n\b/i,
  /\br[e3]t[a@]rd\b/i,
  /\btr[a@]nn[yi]\b/i,
];

function containsBlockedTerm(text) {
  return BLOCKED_TERMS.some(pattern => pattern.test(text));
}

// ── Persistent storage ────────────────────────────────────────────────────────
function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`[TTS] Failed to load ${path.basename(filePath)}:`, err.message);
  }
  return null;
}
 
function loadVoices() {
  const data = loadJSON(VOICES_FILE);
  return data ? new Map(Object.entries(data)) : new Map();
}
 
function saveVoices() {
  try {
    fs.writeFileSync(VOICES_FILE, JSON.stringify(Object.fromEntries(userVoices), null, 2));
  } catch (err) {
    console.error('[TTS] Failed to save voices:', err.message);
  }
}
 
function loadDenied() {
  const data = loadJSON(DENIED_FILE);
  return data ? new Set(data) : new Set();
}
 
function saveDenied() {
  try {
    fs.writeFileSync(DENIED_FILE, JSON.stringify([...ttsDenied], null, 2));
  } catch (err) {
    console.error('[TTS] Failed to save denied list:', err.message);
  }
}
 
// ── State ─────────────────────────────────────────────────────────────────────
let ttsEnabled = false;
const userVoices = loadVoices();
const ttsDenied  = loadDenied();

// ── Helpers ───────────────────────────────────────────────────────────────────
function sanitize(text) {
  return text
    .replace(/[$\\;"'|&<>(){}[\]!#]/g, '')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/(.)\1{4,}/g, '$1$1$1')
    .trim()
    .slice(0, 300);
}

function speak(text, voiceKey) {
  const clean = sanitize(text);
  if (!clean) return;

  const modelName = VOICE_MAP[voiceKey] || VOICE_MAP[DEFAULT_VOICE];
  const modelPath = path.join(VOICES_DIR, `${modelName}.onnx`);

  if (!fs.existsSync(modelPath)) {
    console.error(`[TTS] Voice model not found: ${modelPath}`);
    return;
  }

  const sampleRate = modelName.endsWith('-low') ? 16000 : 22050;
  
  const piper = spawn('piper', ['--model', modelPath, '--output-raw']);
  const paplay = spawn('paplay', [
    '--raw',
    `--rate=${sampleRate}`,
    '--format=s16le',
    '--channels=1',
    `--device=${AUDIO_SINK}`
  ]);

  piper.stdout.pipe(paplay.stdin);
  piper.stdin.write(clean);
  piper.stdin.end();

  piper.stderr.on('data', d => console.error('[TTS] piper:', d.toString().trim()));
  paplay.stderr.on('data', d => console.error('[TTS] paplay:', d.toString().trim()));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Handle all TTS logic for an incoming chat message.
 *
 * Commands:
 *   !tts on              mods/broadcaster  — enable TTS
 *   !tts off             mods/broadcaster  — disable TTS
 *   !ttsdeny <user>      mods/broadcaster  — block a user's messages from TTS
 *   !ttsallow <user>     mods/broadcaster  — unblock a user from TTS
 *   !ttsvoice <n>     anyone            — set your personal voice
 *   !ttsvoice list       anyone            — list available voices in chat
 */
function handleTTS(client, channel, tags, message, isMod) {
  const username = tags.username.toLowerCase();
  const lower = message.toLowerCase().trim();

  // ── Toggle ─────────────────────────────────────────────────────────────────
  if (lower === '!tts on') {
    if (!isMod) return;
    ttsEnabled = true;
    console.log('[TTS] Enabled');
    client.say(channel, 'TTS Enabled');
    return;
  }

  if (lower === '!tts off') {
    if (!isMod) return;
    ttsEnabled = false;
    console.log('[TTS] Disabled');
    client.say(channel, 'TTS Disabled');
    return;
  }

    // ── TTS deny/allow ─────────────────────────────────────────────────────────
  if (lower.startsWith('!ttsdeny')) {
    if (!isMod) return;
    const target = message.slice('!ttsdeny'.length).trim().replace(/^@/, '').toLowerCase();
    if (!target) return;
    ttsDenied.add(target);
    saveDenied();
    client.say(channel, `@${target} won't be heard on TTS.`);
    return;
  }
 
  if (lower.startsWith('!ttsallow')) {
    if (!isMod) return;
    const target = message.slice('!ttsallow'.length).trim().replace(/^@/, '').toLowerCase();
    if (!target) return;
    ttsDenied.delete(target);
    saveDenied();
    client.say(channel, `@${target} can be heard on TTS again.`);
    return;
  }

  // ── Voice picker ───────────────────────────────────────────────────────────
  if (lower.startsWith('!ttsvoice')) {
    const arg = message.slice('!ttsvoice'.length).trim().toLowerCase();

    if (!arg || arg === 'list') {
      const list = Object.keys(VOICE_MAP).join(', ');
      client.say(channel, `TTS voices: ${list}`);
      return;
    }

    if (!VOICE_MAP[arg]) {
      const list = Object.keys(VOICE_MAP).join(', ');
      client.say(channel, `@${username} unknown voice "${arg}". Available: ${list}`);
      return;
    }

    userVoices.set(username, arg);
    saveVoices();
    client.say(channel, `@${username} TTS voice set to "${arg}".`);
    return;
  }

  // ── Read messages ──────────────────────────────────────────────────────────
  if (!ttsEnabled) return;
  if (message.startsWith('!')) return;
  if (ttsDenied.has(username)) return;
  if (containsBlockedTerm(message)) return;

  const voiceKey = userVoices.get(username) || DEFAULT_VOICE;
  speak(message, voiceKey);
}

function isTTSEnabled() {
  return ttsEnabled;
}

module.exports = { handleTTS, isTTSEnabled };
