import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(join(process.cwd(), 'src', 'lib', 'tts', file), 'utf8');
}

describe('mobile audio continuity', () => {
  it.each(['cachedAudioEngine.ts', 'cloudTtsEngine.ts'])(
    '%s reuses one media element throughout a word loop',
    (file) => {
      const engine = source(file);
      expect(engine).toContain('const audio = this.audio ?? new Audio();');
      expect(engine).toContain('this.audio = audio;');
      // Clearing the field on end causes the next timer-driven word to create
      // a new element and can lose iOS Safari's media activation.
      expect(engine).not.toContain('this.audio = null;');
    },
  );
});
