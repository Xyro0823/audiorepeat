import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/components/player/PlayerView.tsx'), 'utf8');

describe('PlayerView cloud voice consent', () => {
  it('puts the opt-in action in the player instead of requiring Settings discovery', () => {
    expect(source).toContain('Hear this language clearly');
    expect(source).toContain("user ? 'Enable cloud voice' : 'Sign in & enable cloud voice'");
    expect(source).toContain('onClick={requestCloudVoice}');
  });

  it('enables cloud voice after a successful sign-in from the prompt', () => {
    expect(source).toContain('onSuccess={enableCloudVoice}');
    expect(source).toContain('changeSettings({ cloudTts: true })');
  });

  it('blocks ordinary playback until the missing-voice consent is handled', () => {
    expect(source).toMatch(
      /const startPlayback = useCallback\(\(\) => \{\s+if \(cloudVoiceConsentNeeded\)/,
    );
  });
});
