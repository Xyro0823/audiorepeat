import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = readFileSync(
  join(process.cwd(), 'src/hooks/useAudioLoop.ts'),
  'utf8',
);

function dictValue(locale: 'en' | 'mn', key: string): string {
  const dict = readFileSync(
    join(process.cwd(), `src/lib/i18n/${locale}/player.ts`),
    'utf8',
  );
  const match = dict.match(new RegExp(`'${key}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  expect(match, `missing ${locale} key ${key}`).not.toBeNull();
  return match![1];
}

describe('playback failure recovery', () => {
  it('retries ONCE with an alternative same-base-language voice', () => {
    // single retry flag
    expect(hook).toContain('retriedRef.current = true');
    // alternative must share the base language subtag (no unrelated voices)
    expect(hook).toMatch(/v\.lang\.toLowerCase\(\)\.startsWith\(base\)/);
    // the failed voice is never retried
    expect(hook).toMatch(/!failedVoicesRef\.current\.has\(v\.uri\)/);
  });

  it('pauses and surfaces an error after total failure (no silent skipping)', () => {
    expect(hook).toContain("setStatus('paused')");
    expect(hook).toContain('setPlaybackError(true)');
    expect(hook).not.toContain('scheduleNext(); // skip the failing step');
    // recovery state is invalidated so no further retries chain
    expect(hook).toMatch(/altVoiceRef\.current = undefined;[\s\S]{0,120}tokenRef\.current \+= 1/);
  });

  it('clears error state when speech succeeds again or playback restarts', () => {
    expect(hook).toMatch(/onStart[\s\S]{0,500}setPlaybackError\(false\)/);
    expect(hook.match(/setPlaybackError\(false\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('exposes playbackError to the UI with EN/MN copy', () => {
    const view = readFileSync(
      join(process.cwd(), 'src/components/player/PlayerView.tsx'),
      'utf8',
    );
    expect(view).toContain('playbackError');
    expect(view).toContain('role="alert"');
    for (const key of [
      'player.playback.error.title',
      'player.playback.error.body',
      'player.playback.error.retry',
    ]) {
      expect(dictValue('en', key)).toBeTruthy();
      expect(dictValue('mn', key)).toBeTruthy();
    }
    expect(dictValue('mn', 'player.playback.error.retry')).toBe('Дууг үргэлжлүүлэх');
  });

  it('does not change engine cost behavior (no new cloud calls)', () => {
    expect(hook).not.toContain('fetch(');
    expect(hook).not.toMatch(/cloudTts|fetch\(|cachedAudio/i);
  });
});
