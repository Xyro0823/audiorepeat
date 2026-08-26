import { getAuthIdToken } from '@/lib/authStore';

export interface TranslationInput {
  id: string;
  text: string;
}

export async function translateBatchToMongolian(items: TranslationInput[]): Promise<Map<string, string>> {
  const token = await getAuthIdToken();
  if (!token) throw new Error('translation-unauthenticated');
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
  });
  if (!response.ok) throw new Error(`translation-${response.status}`);
  const body = (await response.json()) as { translations?: unknown };
  if (!Array.isArray(body.translations) || body.translations.length !== items.length) {
    throw new Error('translation-invalid-response');
  }
  const result = new Map<string, string>();
  for (let index = 0; index < items.length; index += 1) {
    const text = body.translations[index];
    if (typeof text !== 'string' || !text.trim()) throw new Error('translation-invalid-response');
    result.set(items[index].id, text.trim());
  }
  return result;
}
