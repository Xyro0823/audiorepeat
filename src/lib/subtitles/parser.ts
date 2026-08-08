/**
 * Subtitle (.srt / .vtt) and plain-text transcript → vocabulary keyword
 * extractor.
 *
 * Pipeline: strip timing/index markup → keep dialog lines → tokenize words →
 * drop function words and noise → rank by frequency → return the top keywords
 * (as a playable batch). Runs fully offline; translations are matched against
 * the bundled word banks elsewhere.
 */

export interface ExtractedWord {
  target: string; // display casing (most frequent occurrence)
  count: number;
}

export interface SubtitleParseResult {
  words: ExtractedWord[];
  totalTokens: number;
  dialogLines: number;
}

const MAX_WORDS = 60;
const MIN_LENGTH = 3;

/** Case/diacritic folding for grouping + stopword lookups (é → e, É → e). */
export function foldToken(token: string): string {
  return token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const STOPWORDS = new Set(
  (
    'a about above across after again against all almost alone along already also although always am among an and another any anybody anyone anything anywhere are arent around as at away back be became because become becomes been before began behind being below between both but by can cannot cant could couldnt day did didnt do does doesnt doing dont down during each either else end enough even ever every everybody everyone everything everywhere few for from further get gets getting give given gives go goes going gone got gotten had hadnt happens has hasnt have havent having he her here hers herself him himself his how hows i id if ill im in into is isnt it its itself lets like long made make makes many may maybe me men might more most mostly much must my myself necessary need needs never new next no nobody none nor not nothing now nowhere of off often oh ok okay old on once one only onto or other others our ours ourselves out over own per put rather really right said same say says see seems seen shall she should shouldnt show shows side since so some somebody someone something somewhere still such sure take taken than that thats the their theirs them themselves then there theres these they theyd theyll theyre theyve thing things think this those though through throughout till to too toward towards try two under until up upon us use used uses very via want wants was wasnt way we wed well were werent what whats when whens where whereas wherever whether which while who whoever whom whos why will with within without wont would wouldnt yes yet you your yours yourself yourselves'.split(
      ' ',
    )
  ),
);

/**
 * Very common short words in any language (function words). Caught by a
 * relative-frequency heuristic so non-English subtitles still get filtered.
 */
function isSuspiciousFunctionWord(fold: string, count: number, maxCount: number): boolean {
  return fold.length <= 4 && count >= 3 && count / maxCount >= 0.6;
}

/** Is this line pure subtitle markup (cue index / timestamp / header)? */
function isMetaLine(line: string): boolean {
  if (/^\d+$/.test(line)) return true; // SRT cue number
  // 00:00:01,000 --> 00:00:03,500  |  00:01.500 --> 00:03.000 (VTT)  |  bare timestamps
  if (/^\d{1,2}:\d{2}:\d{2}[\.,]\d{3}\s*-->/.test(line)) return true;
  if (/^\d{1,2}:\d{2}:\d{2}\s*-->/.test(line)) return true;
  if (/^\d{1,2}:\d{2}[\.,]\d{3}\s*-->/.test(line)) return true;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(line)) return true;
  if (/^WEBVTT\b/i.test(line)) return true;
  if (/^NOTE\b/i.test(line)) return true;
  if (/^Kind:\b/i.test(line)) return true;
  if (/^Language:\b/i.test(line)) return true;
  return false;
}

/** Strip HTML/ASS tags, stage directions and speaker prefixes from one dialog line. */
function cleanLine(line: string): string {
  return line
    .replace(/^[\p{L}\p{N}][\p{L}\p{N} '’-]*[:：]\s+/u, '') // speaker prefix: "JOHN: "
    .replace(/<[^>]+>/g, ' ') // HTML / iTunes tags
    .replace(/\{[^}]*\}/g, ' ') // ASS override blocks
    .replace(/\[[^\]]*\]/g, ' ') // [music], [applause]
    .replace(/\([^)]*\)/g, ' ') // (laughs), (in French)
    .replace(/[«»""„“”‘’]/g, ' ') // quotes → token separators
    .replace(/\s+/g, ' ')
    .trim();
}

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export function parseSubtitleText(raw: string): SubtitleParseResult {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const dialogLines: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isMetaLine(line)) continue;
    const cleaned = cleanLine(line);
    if (cleaned) dialogLines.push(cleaned);
  }

  const freq = new Map<string, { display: string; count: number }>();
  let totalTokens = 0;
  for (const line of dialogLines) {
    for (const match of line.matchAll(TOKEN_RE)) {
      const token = match[0];
      const fold = foldToken(token);
      if (fold.length < MIN_LENGTH) continue;
      if (/^\d+$/.test(fold)) continue;
      if (STOPWORDS.has(fold)) continue;
      totalTokens += 1;
      const cur = freq.get(fold);
      if (cur) cur.count += 1;
      else freq.set(fold, { display: token, count: 1 });
    }
  }

  const maxCount = Math.max(1, ...[...freq.values()].map((v) => v.count));
  const words = [...freq.entries()]
    .map(([fold, v]) => ({ fold, ...v }))
    .filter(({ fold, count }) => !isSuspiciousFunctionWord(fold, count, maxCount))
    .sort((a, b) => b.count - a.count || a.fold.localeCompare(b.fold))
    .slice(0, MAX_WORDS)
    .map(({ display, count }) => ({ target: display, count }));

  return { words, totalTokens, dialogLines: dialogLines.length };
}
