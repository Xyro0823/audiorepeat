import 'server-only';

const REGION_RE = /^[a-z0-9-]{2,32}$/;
export const MAX_TRANSLATE_ITEMS = 25;
export const MAX_TRANSLATE_CHARS = 5_000;

export function isAzureTranslatorConfigured(): boolean {
  const key = process.env.AZURE_TRANSLATOR_KEY?.trim();
  const region = process.env.AZURE_TRANSLATOR_REGION?.trim().toLowerCase();
  return Boolean(key && region && REGION_RE.test(region));
}

function config(): { key: string; region: string } {
  const key = process.env.AZURE_TRANSLATOR_KEY?.trim() ?? '';
  const region = process.env.AZURE_TRANSLATOR_REGION?.trim().toLowerCase() ?? '';
  if (!key || !REGION_RE.test(region)) throw new Error('azure-translator-not-configured');
  return { key, region };
}

interface TranslatorResponse {
  translations?: Array<{ text?: unknown }>;
}

/** Translate a small, validated batch. Azure credentials remain server-only. */
export async function translateToMongolian(texts: string[]): Promise<string[]> {
  if (
    texts.length === 0 ||
    texts.length > MAX_TRANSLATE_ITEMS ||
    texts.some((text) => !text.trim() || text.length > 500) ||
    texts.reduce((total, text) => total + text.length, 0) > MAX_TRANSLATE_CHARS
  ) throw new Error('invalid-translation-input');

  const { key, region } = config();
  const response = await fetch(
    'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=mn',
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json; charset=utf-8',
        'X-ClientTraceId': crypto.randomUUID(),
      },
      body: JSON.stringify(texts.map((Text) => ({ Text }))),
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new Error(`azure-translation-${response.status}`);
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data) || data.length !== texts.length) throw new Error('azure-translation-invalid');
  const translated = data.map((entry) => {
    const text = (entry as TranslatorResponse).translations?.[0]?.text;
    return typeof text === 'string' ? text.trim() : '';
  });
  if (translated.some((text) => !text)) throw new Error('azure-translation-invalid');
  return translated;
}
