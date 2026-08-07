'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, VocabSet } from '@/types/app';
import { DEFAULT_SETTINGS } from '@/types/app';
import {
  deleteSet as dbDeleteSet,
  getAllSets,
  getSettings,
  putSet,
  putSettings,
} from '@/lib/db/indexedDb';

// Bump this whenever new starter sets are added, so existing installs receive
// them exactly once (a user who deletes a seed set keeps it deleted).
const SEED_VERSION = 4;
const SEED_VERSION_KEY = 'audiorepeat-seed-version';

const SEED_SETS: VocabSet[] = [
  {
    id: 'seed-spanish-essentials',
    name: 'Spanish Essentials',
    lang: 'es-ES',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-hola', target: 'hola', translation: 'hello' },
      { id: 'w-gracias', target: 'gracias', translation: 'thank you' },
      { id: 'w-por-favor', target: 'por favor', translation: 'please', repeats: 3 },
      { id: 'w-lo-siento', target: 'lo siento', translation: 'I am sorry' },
      { id: 'w-adios', target: 'adiós', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-french-basics',
    name: 'French Basics',
    lang: 'fr-FR',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-bonjour', target: 'bonjour', translation: 'hello / good morning' },
      { id: 'w-merci', target: 'merci', translation: 'thank you' },
      { id: 'w-oui', target: 'oui', translation: 'yes' },
      { id: 'w-non', target: 'non', translation: 'no' },
      { id: 'w-ou-est', target: 'où est la gare ?', translation: 'where is the station?' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-german-phrases',
    name: 'German Phrases',
    lang: 'de-DE',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-hallo', target: 'hallo', translation: 'hello' },
      { id: 'w-danke', target: 'danke', translation: 'thank you' },
      { id: 'w-bitte', target: 'bitte', translation: 'please / you are welcome' },
      { id: 'w-entschuldigung', target: 'Entschuldigung', translation: 'excuse me / sorry' },
      { id: 'w-wo-ist', target: 'Wo ist die Toilette?', translation: 'where is the toilet?', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-japanese-greetings',
    name: 'Japanese Greetings',
    lang: 'ja-JP',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-konnichiwa', target: 'こんにちは', translation: 'hello' },
      { id: 'w-arigatou', target: 'ありがとう', translation: 'thank you' },
      { id: 'w-sumimasen', target: 'すみません', translation: 'excuse me / sorry' },
      { id: 'w-hai', target: 'はい', translation: 'yes' },
      { id: 'w-ie', target: 'いいえ', translation: 'no' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-portuguese-basics',
    name: 'Portuguese Basics',
    lang: 'pt-BR',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-pt-ola', target: 'olá', translation: 'hello' },
      { id: 'w-pt-obrigado', target: 'obrigado', translation: 'thank you' },
      { id: 'w-pt-por-favor', target: 'por favor', translation: 'please', repeats: 3 },
      { id: 'w-pt-sim', target: 'sim', translation: 'yes' },
      { id: 'w-pt-adeus', target: 'adeus', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-italian-essentials',
    name: 'Italian Essentials',
    lang: 'it',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-it-ciao', target: 'ciao', translation: 'hello / goodbye' },
      { id: 'w-it-grazie', target: 'grazie', translation: 'thank you' },
      { id: 'w-it-per-favore', target: 'per favore', translation: 'please' },
      { id: 'w-it-si', target: 'sì', translation: 'yes' },
      { id: 'w-it-arrivederci', target: 'arrivederci', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-russian-basics',
    name: 'Russian Basics',
    lang: 'ru',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-ru-privet', target: 'привет', translation: 'hello' },
      { id: 'w-ru-spasibo', target: 'спасибо', translation: 'thank you' },
      { id: 'w-ru-pozhaluysta', target: 'пожалуйста', translation: 'please / you are welcome', repeats: 3 },
      { id: 'w-ru-da', target: 'да', translation: 'yes' },
      { id: 'w-ru-do-svidaniya', target: 'до свидания', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-chinese-basics',
    name: 'Chinese Basics',
    lang: 'zh-CN',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-zh-nihao', target: '你好', translation: 'hello' },
      { id: 'w-zh-xiexie', target: '谢谢', translation: 'thank you' },
      { id: 'w-zh-qing', target: '请', translation: 'please' },
      { id: 'w-zh-shi', target: '是', translation: 'yes' },
      { id: 'w-zh-zaijian', target: '再见', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-korean-essentials',
    name: 'Korean Essentials',
    lang: 'ko',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-ko-annyeong', target: '안녕하세요', translation: 'hello' },
      { id: 'w-ko-gamsahamnida', target: '감사합니다', translation: 'thank you', repeats: 3 },
      { id: 'w-ko-juseyo', target: '주세요', translation: 'please (give me)' },
      { id: 'w-ko-ne', target: '네', translation: 'yes' },
      { id: 'w-ko-annyeonghi', target: '안녕히 가세요', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-arabic-essentials',
    name: 'Arabic Essentials',
    lang: 'ar-EG',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-ar-marhaba', target: 'مرحبا', translation: 'hello' },
      { id: 'w-ar-shukran', target: 'شكرا', translation: 'thank you' },
      { id: 'w-ar-min-fadlik', target: 'من فضلك', translation: 'please' },
      { id: 'w-ar-naam', target: 'نعم', translation: 'yes' },
      { id: 'w-ar-wadaan', target: 'وداعا', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-hindi-basics',
    name: 'Hindi Basics',
    lang: 'hi',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-hi-namaste', target: 'नमस्ते', translation: 'hello' },
      { id: 'w-hi-dhanyavaad', target: 'धन्यवाद', translation: 'thank you' },
      { id: 'w-hi-kripya', target: 'कृपया', translation: 'please' },
      { id: 'w-hi-haan', target: 'हाँ', translation: 'yes' },
      { id: 'w-hi-alvida', target: 'अलविदा', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-turkish-basics',
    name: 'Turkish Basics',
    lang: 'tr',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-tr-merhaba', target: 'merhaba', translation: 'hello' },
      { id: 'w-tr-tesekkurler', target: 'teşekkürler', translation: 'thank you' },
      { id: 'w-tr-lutfen', target: 'lütfen', translation: 'please' },
      { id: 'w-tr-evet', target: 'evet', translation: 'yes' },
      { id: 'w-tr-hosca-kal', target: 'hoşça kal', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-persian-basics',
    name: 'Persian Basics',
    lang: 'fa',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-fa-salam', target: 'سلام', translation: 'hello' },
      { id: 'w-fa-mamnun', target: 'ممنون', translation: 'thank you' },
      { id: 'w-fa-lotfan', target: 'لطفا', translation: 'please' },
      { id: 'w-fa-bale', target: 'بله', translation: 'yes' },
      { id: 'w-fa-khoda-hafez', target: 'خداحافظ', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-dutch-basics',
    name: 'Dutch Basics',
    lang: 'nl',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-nl-hallo', target: 'hallo', translation: 'hello' },
      { id: 'w-nl-dank-je', target: 'dank je', translation: 'thank you' },
      { id: 'w-nl-alsjeblieft', target: 'alsjeblieft', translation: 'please' },
      { id: 'w-nl-ja', target: 'ja', translation: 'yes' },
      { id: 'w-nl-tot-ziens', target: 'tot ziens', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-swedish-basics',
    name: 'Swedish Basics',
    lang: 'sv',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-sv-hej', target: 'hej', translation: 'hello / goodbye' },
      { id: 'w-sv-tack', target: 'tack', translation: 'thank you' },
      { id: 'w-sv-snalla', target: 'snälla', translation: 'please' },
      { id: 'w-sv-ja', target: 'ja', translation: 'yes' },
      { id: 'w-sv-hej-da', target: 'hej då', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-polish-basics',
    name: 'Polish Basics',
    lang: 'pl',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-pl-czesc', target: 'cześć', translation: 'hello' },
      { id: 'w-pl-dziekuje', target: 'dziękuję', translation: 'thank you' },
      { id: 'w-pl-prosze', target: 'proszę', translation: 'please / you are welcome', repeats: 3 },
      { id: 'w-pl-tak', target: 'tak', translation: 'yes' },
      { id: 'w-pl-do-widzenia', target: 'do widzenia', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-greek-basics',
    name: 'Greek Basics',
    lang: 'el',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-el-geia', target: 'γεια', translation: 'hello' },
      { id: 'w-el-efharisto', target: 'ευχαριστώ', translation: 'thank you' },
      { id: 'w-el-parakalo', target: 'παρακαλώ', translation: 'please / you are welcome', repeats: 3 },
      { id: 'w-el-nai', target: 'ναι', translation: 'yes' },
      { id: 'w-el-antio', target: 'αντίο', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-hebrew-basics',
    name: 'Hebrew Basics',
    lang: 'he',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-he-shalom', target: 'שלום', translation: 'hello' },
      { id: 'w-he-toda', target: 'תודה', translation: 'thank you' },
      { id: 'w-he-bevakasha', target: 'בבקשה', translation: 'please / you are welcome' },
      { id: 'w-he-ken', target: 'כן', translation: 'yes' },
      { id: 'w-he-lehitraot', target: 'להתראות', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-vietnamese-basics',
    name: 'Vietnamese Basics',
    lang: 'vi',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-vi-xin-chao', target: 'xin chào', translation: 'hello' },
      { id: 'w-vi-cam-on', target: 'cảm ơn', translation: 'thank you' },
      { id: 'w-vi-lam-on', target: 'làm ơn', translation: 'please' },
      { id: 'w-vi-vang', target: 'vâng', translation: 'yes' },
      { id: 'w-vi-tam-biet', target: 'tạm biệt', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-thai-basics',
    name: 'Thai Basics',
    lang: 'th',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-th-sawatdee', target: 'สวัสดี', translation: 'hello' },
      { id: 'w-th-khopkhun', target: 'ขอบคุณ', translation: 'thank you' },
      { id: 'w-th-garuna', target: 'กรุณา', translation: 'please' },
      { id: 'w-th-chai', target: 'ใช่', translation: 'yes' },
      { id: 'w-th-lagon', target: 'ลาก่อน', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-indonesian-basics',
    name: 'Indonesian Basics',
    lang: 'id',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-id-halo', target: 'halo', translation: 'hello' },
      { id: 'w-id-terima-kasih', target: 'terima kasih', translation: 'thank you' },
      { id: 'w-id-tolong', target: 'tolong', translation: 'please' },
      { id: 'w-id-ya', target: 'ya', translation: 'yes' },
      { id: 'w-id-selamat-tinggal', target: 'selamat tinggal', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-swahili-basics',
    name: 'Swahili Basics',
    lang: 'sw',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-sw-habari', target: 'habari', translation: 'hello / how are you' },
      { id: 'w-sw-asante', target: 'asante', translation: 'thank you' },
      { id: 'w-sw-tafadhali', target: 'tafadhali', translation: 'please' },
      { id: 'w-sw-ndiyo', target: 'ndiyo', translation: 'yes' },
      { id: 'w-sw-kwaheri', target: 'kwaheri', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-ukrainian-basics',
    name: 'Ukrainian Basics',
    lang: 'uk',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-uk-pryvit', target: 'привіт', translation: 'hello' },
      { id: 'w-uk-dyakuyu', target: 'дякую', translation: 'thank you' },
      { id: 'w-uk-bud-laska', target: 'будь ласка', translation: 'please / you are welcome', repeats: 3 },
      { id: 'w-uk-tak', target: 'так', translation: 'yes' },
      { id: 'w-uk-do-pobachennya', target: 'до побачення', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-czech-basics',
    name: 'Czech Basics',
    lang: 'cs',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-cs-ahoj', target: 'ahoj', translation: 'hello / goodbye' },
      { id: 'w-cs-dekuji', target: 'děkuji', translation: 'thank you' },
      { id: 'w-cs-prosim', target: 'prosím', translation: 'please / you are welcome', repeats: 3 },
      { id: 'w-cs-ano', target: 'ano', translation: 'yes' },
      { id: 'w-cs-na-shledanou', target: 'na shledanou', translation: 'goodbye' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-finnish-basics',
    name: 'Finnish Basics',
    lang: 'fi',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-fi-hei', target: 'hei', translation: 'hello' },
      { id: 'w-fi-kiitos', target: 'kiitos', translation: 'thank you' },
      { id: 'w-fi-ole-hyva', target: 'ole hyvä', translation: 'please / you are welcome' },
      { id: 'w-fi-kylla', target: 'kyllä', translation: 'yes' },
      { id: 'w-fi-nakemiin', target: 'näkemiin', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-norwegian-basics',
    name: 'Norwegian Basics',
    lang: 'nb-NO',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-nb-hei', target: 'hei', translation: 'hello' },
      { id: 'w-nb-takk', target: 'takk', translation: 'thank you' },
      { id: 'w-nb-vaer-sa-snill', target: 'vær så snill', translation: 'please' },
      { id: 'w-nb-ja', target: 'ja', translation: 'yes' },
      { id: 'w-nb-ha-det', target: 'ha det', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-danish-basics',
    name: 'Danish Basics',
    lang: 'da',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-da-hej', target: 'hej', translation: 'hello' },
      { id: 'w-da-tak', target: 'tak', translation: 'thank you' },
      { id: 'w-da-vaer-sa-venlig', target: 'vær så venlig', translation: 'please' },
      { id: 'w-da-ja', target: 'ja', translation: 'yes' },
      { id: 'w-da-farvel', target: 'farvel', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-filipino-basics',
    name: 'Filipino Basics',
    lang: 'fil',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-fil-kumusta', target: 'kumusta', translation: 'hello' },
      { id: 'w-fil-salamat', target: 'salamat', translation: 'thank you' },
      { id: 'w-fil-pakiusap', target: 'pakiusap', translation: 'please' },
      { id: 'w-fil-oo', target: 'oo', translation: 'yes' },
      { id: 'w-fil-paalam', target: 'paalam', translation: 'goodbye', repeats: 3 },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'seed-mongolian-basics',
    name: 'Mongolian Basics',
    lang: 'mn',
    nativeLang: 'en-US',
    cefr: 'A1',
    words: [
      { id: 'w-mn-sain', target: 'сайн байна уу', translation: 'hello' },
      { id: 'w-mn-bayarlalaa', target: 'баярлалаа', translation: 'thank you', repeats: 3 },
      { id: 'w-mn-guiya', target: 'гуйя', translation: 'please' },
      { id: 'w-mn-tiim', target: 'тийм', translation: 'yes' },
      { id: 'w-mn-ugui', target: 'үгүй', translation: 'no' },
    ],
    createdAt: 0,
    updatedAt: 0,
  },
];

export function useLists() {
  const [sets, setSets] = useState<VocabSet[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let list = await getAllSets();
      // One-time merge of missing seed sets, gated by a version marker so
      // new starter sets reach existing installs without resurrecting seed
      // sets the user deliberately deleted.
      const now = Date.now();
      let seedVersion = 0;
      try {
        seedVersion = Number(window.localStorage.getItem(SEED_VERSION_KEY) ?? 0) || 0;
      } catch {
        seedVersion = 0; // storage unavailable: merge will retry harmlessly
      }
      if (seedVersion < SEED_VERSION) {
        const knownIds = new Set(list.map((s) => s.id));
        for (const set of SEED_SETS) {
          if (!knownIds.has(set.id)) {
            await putSet({ ...set, createdAt: now, updatedAt: now });
          } else {
            // upgrade in place: attach a CEFR level to seed sets created before
            // levels existed, preserving any words/settings the user changed
            const existing = list.find((x) => x.id === set.id);
            if (existing && !existing.cefr && set.cefr) {
              await putSet({ ...existing, cefr: set.cefr });
            }
          }
        }
        list = await getAllSets();
        try {
          window.localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION));
        } catch {
          /* ignore */
        }
      }
      const stored = await getSettings();
      if (alive) {
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        settingsRef.current = merged;
        setSets(list);
        setSettings(merged);
        setLoading(false);
      }
    })().catch((err) => {
      console.error('[useLists] hydration failed', err);
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // flush any pending settings write on unmount
  useEffect(
    () => () => {
      if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    },
    [],
  );

  const saveSet = useCallback(async (set: VocabSet): Promise<VocabSet> => {
    const next = { ...set, updatedAt: Date.now() };
    await putSet(next);
    setSets((prev) => {
      const idx = prev.findIndex((s) => s.id === next.id);
      const copy = [...prev];
      if (idx >= 0) copy[idx] = next;
      else copy.unshift(next);
      return copy;
    });
    return next;
  }, []);

  const removeSet = useCallback(async (id: string) => {
    await dbDeleteSet(id);
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Debounced persistence: state updates are instant; IndexedDB writes coalesce
  // (e.g. during slider drags). No side effects inside the state updater.
  const saveSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void putSettings(settingsRef.current).catch((err) =>
        console.error('[useLists] save settings', err),
      );
    }, 250);
  }, []);

  return { sets, settings, loading, saveSet, removeSet, saveSettings };
}
