import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { escapeSsmlText, isAzureTtsConfigured } from './azureTts.server';

const originalKey = process.env.AZURE_SPEECH_KEY;
const originalRegion = process.env.AZURE_SPEECH_REGION;

afterEach(() => {
  if (originalKey === undefined) delete process.env.AZURE_SPEECH_KEY;
  else process.env.AZURE_SPEECH_KEY = originalKey;
  if (originalRegion === undefined) delete process.env.AZURE_SPEECH_REGION;
  else process.env.AZURE_SPEECH_REGION = originalRegion;
});

describe('Azure TTS server adapter', () => {
  it('escapes user text before placing it in SSML', () => {
    expect(escapeSsmlText(`<break time="9s"/> & 'quoted'`)).toBe(
      '&lt;break time=&quot;9s&quot;/&gt; &amp; &apos;quoted&apos;',
    );
  });

  it('accepts a normal Azure region and rejects host injection', () => {
    process.env.AZURE_SPEECH_KEY = 'secret-placeholder';
    process.env.AZURE_SPEECH_REGION = 'southeastasia';
    expect(isAzureTtsConfigured()).toBe(true);
    process.env.AZURE_SPEECH_REGION = 'eastus.evil.example';
    expect(isAzureTtsConfigured()).toBe(false);
  });
});
