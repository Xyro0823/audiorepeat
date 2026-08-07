import { readFileSync, writeFileSync } from 'node:fs';

// --- starterSets.ts: remove unused getStarterSets ---
const ss = 'src/lib/starterSets.ts';
let t = readFileSync(ss, 'utf8');
const oldHelper = `
/** Filter the library by language and/or level. Pass 'all' to skip a filter. */
export function getStarterSets(
  lang: string | 'all',
  level: CefrLevel | 'all',
): StarterSet[] {
  return STARTER_SETS.filter(
    (s) => (lang === 'all' || s.lang === lang) && (level === 'all' || s.level === level),
  );
}
`;
if (!t.includes(oldHelper.trim())) {
  console.error('GETSTARTERSETS NOT FOUND');
  process.exit(1);
}
t = t.replace(oldHelper, '\n');
// CEFR_LEVELS still used by buildSets
writeFileSync(ss, t);
console.log('starterSets.ts: removed getStarterSets');

// --- io.ts: use CEFR_LEVELS from types ---
const io = 'src/lib/sets/io.ts';
let s = readFileSync(io, 'utf8');
const oldImp = "import type { AppSettings, CefrLevel, VocabSet, VocabWord } from '@/types/app';";
const newImp = "import { CEFR_LEVELS } from '@/types/app';\nimport type { AppSettings, VocabSet, VocabWord } from '@/types/app';";
if (!s.includes(oldImp)) {
  console.error('IO IMPORT NOT FOUND');
  process.exit(1);
}
s = s.replace(oldImp, newImp);
const oldCefr = `    cefr:
      typeof s.cefr === 'string' && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(s.cefr)
        ? (s.cefr as CefrLevel)
        : undefined,`;
const newCefr = `    cefr:
      typeof s.cefr === 'string' && (CEFR_LEVELS as readonly string[]).includes(s.cefr)
        ? (s.cefr as (typeof CEFR_LEVELS)[number])
        : undefined,`;
if (!s.includes(oldCefr)) {
  console.error('IO CEFR NOT FOUND');
  process.exit(1);
}
s = s.replace(oldCefr, newCefr);
writeFileSync(io, s);
console.log('io.ts: CEFR_LEVELS reused');

// --- StarterLibraryModal.tsx: CEFR_LEVELS chips + rejection guard ---
const m = 'src/components/library/StarterLibraryModal.tsx';
let q = readFileSync(m, 'utf8');
const oldTypes = `import type { CefrLevel, VocabSet } from '@/types/app';`;
const newTypes = `import { CEFR_LEVELS } from '@/types/app';
import type { CefrLevel, VocabSet } from '@/types/app';`;
if (!q.includes(oldTypes)) {
  console.error('MODAL TYPES NOT FOUND');
  process.exit(1);
}
q = q.replace(oldTypes, newTypes);
const oldChips = `            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CefrLevel[]).map((lvl) => (`;
const newChips = `            {CEFR_LEVELS.map((lvl) => (`;
if (!q.includes(oldChips)) {
  console.error('MODAL CHIPS NOT FOUND');
  process.exit(1);
}
q = q.replace(oldChips, newChips);
const oldClick = `                      onClick={() => void handleImport(starter)}`;
const newClick = `                      onClick={() => {
                        handleImport(starter).catch((err) =>
                          console.error('[starter import]', err),
                        );
                      }}`;
if (!q.includes(oldClick)) {
  console.error('MODAL CLICK NOT FOUND');
  process.exit(1);
}
q = q.replace(oldClick, newClick);
writeFileSync(m, q);
console.log('StarterLibraryModal.tsx: cleaned');

// --- SetLibrary.tsx: guarded import with error flash ---
const lib = 'src/components/library/SetLibrary.tsx';
let l = readFileSync(lib, 'utf8');
const oldImpFn = `          onImport={async (set) => {
            await saveSet(set);
            flash({ kind: 'ok', text: ` + '`' + `Imported "${set.name}" (${set.words.length} words).` + '`' + ` });
          }}`;
const newImpFn = `          onImport={async (set) => {
            try {
              await saveSet(set);
              flash({ kind: 'ok', text: ` + '`' + `Imported "${set.name}" (${set.words.length} words).` + '`' + ` });
            } catch {
              flash({ kind: 'err', text: 'Could not import that starter set.' });
            }
          }}`;
if (!l.includes(oldImpFn)) {
  console.error('LIB IMPORT FN NOT FOUND');
  process.exit(1);
}
l = l.replace(oldImpFn, newImpFn);
writeFileSync(lib, l);
console.log('SetLibrary.tsx: import guarded');
