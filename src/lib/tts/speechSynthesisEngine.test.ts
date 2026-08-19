import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpeechSynthesisEngine } from './speechSynthesisEngine';

function synth(initial: SpeechSynthesisVoice[] = []) {
  let voices = initial;
  let listener: (() => void) | null = null;
  const api = {
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn((_name: string, cb: () => void) => { listener = cb; }),
    removeEventListener: vi.fn((_name: string, cb: () => void) => { if (listener === cb) listener = null; }),
    setVoices(next: SpeechSynthesisVoice[]) { voices = next; },
    fire() { listener?.(); },
  };
  return api;
}

const voice = { name: 'English', lang: 'en-US', localService: true, voiceURI: 'en', default: true } as SpeechSynthesisVoice;

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('speech voice loading', () => {
  it('settles with an empty list after the timeout and removes its listener', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const fake = synth();
    const promise = new SpeechSynthesisEngine(fake as unknown as SpeechSynthesis).loadVoices();
    await vi.advanceTimersByTimeAsync(1500);
    await expect(promise).resolves.toEqual([]);
    expect(fake.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('resolves delayed voices once and ignores duplicate events', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const fake = synth();
    const promise = new SpeechSynthesisEngine(fake as unknown as SpeechSynthesis).loadVoices();
    fake.setVoices([voice]);
    fake.fire();
    fake.fire();
    await expect(promise).resolves.toMatchObject([{ lang: 'en-US', uri: 'en' }]);
    expect(fake.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
