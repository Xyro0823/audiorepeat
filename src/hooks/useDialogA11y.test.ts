import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const hook = readFileSync(
  join(process.cwd(), 'src/hooks/useDialogA11y.ts'),
  'utf8',
);

/** Modals that must route Escape/Tab/focus through the shared dialog hook. */
const wiredModals = [
  'src/components/settings/SettingsModal.tsx',
  'src/components/auth/AuthScreen.tsx',
  'src/components/checkout/DowngradeModal.tsx',
  'src/components/library/SetEditor.tsx',
  'src/components/library/ShareSetModal.tsx',
  'src/components/library/SubtitleImportModal.tsx',
  'src/components/library/StarterLibraryModal.tsx',
  'src/components/library/LeaderboardModal.tsx',
  'src/components/player/WordNavigator.tsx',
  'src/components/onboarding/OnboardingFlow.tsx',
  'src/components/onboarding/ChangeFreeLanguageModal.tsx',
];

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('useDialogA11y', () => {
  it('implements trap, escape and focus restoration', () => {
    expect(hook).toContain("'Escape'");
    expect(hook).toContain("'Tab'");
    expect(hook).toContain('shiftKey');
    expect(hook).toContain('opener.focus()');
    expect(hook).toContain('openDialogs[openDialogs.length - 1] !== id');
  });

  it.each(wiredModals)('%s uses the shared dialog a11y behavior', (rel) => {
    const src = source(rel);
    expect(src, `${rel} must import useDialogA11y`).toContain('useDialogA11y');
    expect(src, `${rel} must be a modal dialog`).toContain('role="dialog"');
    expect(src, `${rel} must set aria-modal`).toContain('aria-modal="true"');
    expect(src, `${rel} must attach the dialog ref`).toMatch(/ref=\{dialogRef\}/);
  });

  it('does not leave legacy window-level Escape handlers in wired modals', () => {
    for (const rel of wiredModals) {
      expect(source(rel), rel).not.toMatch(
        /addEventListener\('keydown'[\s\S]{0,120}'Escape'/,
      );
    }
  });
});

describe('player announcements', () => {
  it('announces the current track via aria-live in both locales', () => {
    expect(source('src/components/player/PlayerView.tsx')).toContain(
      'aria-live="polite"',
    );
    const en = source('src/lib/i18n/en/player.ts');
    const mn = source('src/lib/i18n/mn/player.ts');
    expect(en).toContain("'player.card.liveAnnounce'");
    expect(mn).toContain("'player.card.liveAnnounce'");
  });
});
