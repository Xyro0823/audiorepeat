import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/player/PlayerView.tsx'), 'utf8');
const playerEn = readFileSync(join(process.cwd(), 'src/lib/i18n/en/player.ts'), 'utf8');

describe('PlayerView cloud voice consent', () => {
  it('puts the opt-in action in the player instead of requiring Settings discovery', () => {
    expect(playerEn).toContain("'player.cloudVoice.title': 'Hear this language clearly'");
    expect(source).toContain("t('player.cloudVoice.title')");
    expect(source).toContain(
      "user ? t('player.cloudVoice.enable') : t('player.cloudVoice.signInEnable')",
    );
    expect(source).toContain('onClick={requestCloudVoice}');
  });

  it('enables cloud voice after a successful sign-in from the prompt', () => {
    expect(source).toContain('onSuccess={enableCloudVoice}');
    expect(source).toContain('changeSettings({ cloudTts: true })');
  });

  it('blocks ordinary playback until the missing-voice consent is handled', () => {
    const startPlayback = source.match(
      /const startPlayback = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/,
    )?.[0];
    expect(startPlayback).toBeDefined();
    // Within the start guard: the Free daily cap comes first, then the
    // cloud-voice consent block — both must stop play() before it runs.
    expect(startPlayback).toMatch(/if \(dailyLimitReached\)/);
    expect(startPlayback).toMatch(/if \(cloudVoiceConsentNeeded\)/);
    expect(startPlayback!.indexOf('cloudVoiceConsentNeeded')).toBeLessThan(
      startPlayback!.indexOf('play();'),
    );
  });
});
