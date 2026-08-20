import 'server-only';

const VOICES_TTL_MS = 60 * 60_000;
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const REGION_RE = /^[a-z0-9-]{2,32}$/;

interface AzureVoice {
  ShortName: string;
  Locale: string;
  VoiceType?: string;
}

let voicesCache: { expiresAt: number; voices: AzureVoice[] } | null = null;

export function isAzureTtsConfigured(): boolean {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim().toLowerCase();
  return Boolean(key && region && REGION_RE.test(region));
}

function config(): { key: string; region: string } {
  const key = process.env.AZURE_SPEECH_KEY?.trim() ?? '';
  const region = process.env.AZURE_SPEECH_REGION?.trim().toLowerCase() ?? '';
  if (!key || !REGION_RE.test(region)) throw new Error('azure-tts-not-configured');
  return { key, region };
}

export function escapeSsmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function listVoices(key: string, region: string): Promise<AzureVoice[]> {
  if (voicesCache && voicesCache.expiresAt > Date.now()) return voicesCache.voices;
  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    { headers: { 'Ocp-Apim-Subscription-Key': key }, signal: AbortSignal.timeout(8_000) },
  );
  if (!response.ok) throw new Error(`azure-voices-${response.status}`);
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('azure-voices-invalid');
  const voices = data.filter(
    (voice): voice is AzureVoice =>
      typeof voice === 'object' &&
      voice !== null &&
      typeof (voice as AzureVoice).ShortName === 'string' &&
      typeof (voice as AzureVoice).Locale === 'string',
  );
  voicesCache = { voices, expiresAt: Date.now() + VOICES_TTL_MS };
  return voices;
}

function pickVoice(voices: AzureVoice[], lang: string): AzureVoice | undefined {
  const target = lang.toLowerCase();
  const targetBase = target.split('-')[0];
  const candidates = voices.filter((voice) => {
    const locale = voice.Locale.toLowerCase();
    return locale === target || locale.split('-')[0] === targetBase;
  });
  if (targetBase === 'mn') {
    return candidates.find((voice) => voice.ShortName === 'mn-MN-YesuiNeural') ?? candidates[0];
  }
  return candidates.find((voice) => voice.VoiceType === 'Neural') ?? candidates[0];
}

export interface AzureSpeechResult {
  audio: ArrayBuffer;
  voice: string;
}

export async function synthesizeAzureSpeech(text: string, lang: string): Promise<AzureSpeechResult> {
  const { key, region } = config();
  const voices = await listVoices(key, region);
  const voice = pickVoice(voices, lang);
  if (!voice) throw new Error('azure-voice-unavailable');
  const ssml = `<speak version="1.0" xml:lang="${escapeSsmlText(voice.Locale)}"><voice name="${escapeSsmlText(voice.ShortName)}">${escapeSsmlText(text)}</voice></speak>`;
  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
        'User-Agent': 'AudioRepeat',
      },
      body: ssml,
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`azure-synthesis-${response.status}`);
  return { audio: await response.arrayBuffer(), voice: voice.ShortName };
}
