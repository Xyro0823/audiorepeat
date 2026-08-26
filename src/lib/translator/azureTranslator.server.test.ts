import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isAzureTranslatorConfigured } from './azureTranslator.server';

const originalKey = process.env.AZURE_TRANSLATOR_KEY;
const originalRegion = process.env.AZURE_TRANSLATOR_REGION;

afterEach(() => {
  if (originalKey === undefined) delete process.env.AZURE_TRANSLATOR_KEY;
  else process.env.AZURE_TRANSLATOR_KEY = originalKey;
  if (originalRegion === undefined) delete process.env.AZURE_TRANSLATOR_REGION;
  else process.env.AZURE_TRANSLATOR_REGION = originalRegion;
});

describe('Azure Translator server adapter', () => {
  it('accepts a standard Azure region and rejects host injection', () => {
    process.env.AZURE_TRANSLATOR_KEY = 'secret-placeholder';
    process.env.AZURE_TRANSLATOR_REGION = 'eastasia';
    expect(isAzureTranslatorConfigured()).toBe(true);
    process.env.AZURE_TRANSLATOR_REGION = 'eastasia.evil.example';
    expect(isAzureTranslatorConfigured()).toBe(false);
  });
});
