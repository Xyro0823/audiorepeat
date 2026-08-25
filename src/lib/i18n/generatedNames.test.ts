import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const picker = readFileSync(
  join(process.cwd(), 'src/components/player/VoicePicker.tsx'),
  'utf8',
);
const starter = readFileSync(
  join(process.cwd(), 'src/components/library/StarterLibraryModal.tsx'),
  'utf8',
);
const subtitles = readFileSync(
  join(process.cwd(), 'src/components/library/SubtitleImportModal.tsx'),
  'utf8',
);

function dictValue(locale: 'en' | 'mn', file: string, key: string): string {
  const dict = readFileSync(
    join(process.cwd(), `src/lib/i18n/${locale}/${file}.ts`),
    'utf8',
  );
  const match = dict.match(new RegExp(`'${key}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  expect(match, `missing ${locale} key ${key}`).not.toBeNull();
  return match![1];
}

describe('localization of generated names and voice states', () => {
  it('VoicePicker uses i18n for auto/offline/cloud/no-match states', () => {
    expect(picker).toContain("t('player.voice.auto'");
    expect(picker).toContain("t('player.voice.offline')");
    expect(picker).toContain("t('player.voice.cloud')");
    expect(picker).toContain("t('player.voice.noMatch'");
    expect(picker).not.toContain('Auto — system default');
    expect(picker).not.toContain('No voice found for');
  });

  it('EN voice keys keep the previous hardcoded output verbatim', () => {
    expect(dictValue('en', 'player', 'player.voice.auto')).toBe(
      'Auto — system default for {lang}',
    );
    expect(dictValue('en', 'player', 'player.voice.noMatch')).toBe(
      'No voice found for {lang} on this device — the browser will fall back to its default.',
    );
  });

  it('starter library generated names go through i18n in both locales', () => {
    expect(starter).toContain("'library.starter.setName.batch'");
    expect(starter).toContain("'library.starter.setName.full'");
    expect(starter).not.toContain('batch of ${n}');
    expect(dictValue('en', 'library', 'library.starter.setName.batch')).toBe(
      '{lang} {level} · batch of {count}',
    );
    expect(dictValue('mn', 'library', 'library.starter.setName.batch')).toContain(
      'үгийн түүвэр',
    );
  });

  it('subtitle import generated names go through i18n; filename stays untouched', () => {
    expect(subtitles).toContain("'library.subtitles.setName'");
    expect(dictValue('en', 'library', 'library.subtitles.setName')).toBe(
      'From subtitles · {name}',
    );
  });
});
