import type { CefrLevel } from '@/types/app';
import { CEFR_LEVELS } from '@/types/app';
import { findLanguage } from '@/lib/languages';

/**
 * CEFR-leveled starter vocabulary library.
 *
 * Every language ships all six levels (A1-C2); each level is a fixed 10-word
 * "syllabus" translated into that language. Adding a new language is a
 * data-only change: add a `Record<CefrLevel, [string, string][]>` entry below
 * and register it in STARTER_LANGS.
 */

export interface StarterWord {
  target: string;
  translation: string;
}

export interface StarterSet {
  /** Stable slug; doubles as the imported VocabSet id. */
  id: string;
  lang: string; // BCP-47, matches the language catalog
  level: CefrLevel;
  words: StarterWord[];
}

export const CEFR_META: Record<
  CefrLevel,
  { label: string; description: string; badge: string; chip: string }
> = {
  A1: {
    label: 'Beginner',
    description: 'Everyday greetings, numbers, essential nouns & verbs',
    badge: 'border-neon-green/40 bg-neon-green/10 text-neon-green',
    chip: 'border-neon-green/60 bg-neon-green/20 text-neon-green',
  },
  A2: {
    label: 'Elementary',
    description: 'Basic conversations, travel, shopping, directions',
    badge: 'border-neon-green/40 bg-neon-green/10 text-neon-green',
    chip: 'border-neon-green/60 bg-neon-green/20 text-neon-green',
  },
  B1: {
    label: 'Intermediate',
    description: 'Intermediate topics, work, opinions, expressions',
    badge: 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan',
    chip: 'border-neon-cyan/60 bg-neon-cyan/20 text-neon-cyan',
  },
  B2: {
    label: 'Upper-intermediate',
    description: 'Advanced discussions, abstract concepts, formal phrases',
    badge: 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan',
    chip: 'border-neon-cyan/60 bg-neon-cyan/20 text-neon-cyan',
  },
  C1: {
    label: 'Advanced',
    description: 'Mastery vocabulary, idiomatic expressions, connectors',
    badge: 'border-neon-violet/50 bg-neon-violet/10 text-neon-violet',
    chip: 'border-neon-violet/60 bg-neon-violet/20 text-neon-violet',
  },
  C2: {
    label: 'Proficiency',
    description: 'Mastery vocabulary, idioms, technical & academic words',
    badge: 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber',
    chip: 'border-neon-amber/60 bg-neon-amber/20 text-neon-amber',
  },
};

type LevelWords = Record<CefrLevel, [string, string][]>;

// A1: hello, thank you, please, goodbye, yes, no, water, bread, family, friend
// A2: station, ticket, street, left, right, how much?, shop, hotel, morning, evening
// B1: job, company, meeting, opinion, agree, environment, health, experience, decision, problem
// B2: evidence, significant, persuade, evaluate, consequences, negotiate, opportunity, controversial, assumption, implement
// C1: nevertheless, moreover, by the way, in the long run, to be honest, in my opinion, it depends, on the other hand, in other words, without a doubt
// C2: paradox, dilemma, inevitable, profound, meticulous, rigorous, comprehensive, explicit, implicit, widespread

const ES: LevelWords = {
  A1: [['hola', 'hello'], ['gracias', 'thank you'], ['por favor', 'please'], ['adiós', 'goodbye'], ['sí', 'yes'], ['no', 'no'], ['agua', 'water'], ['pan', 'bread'], ['familia', 'family'], ['amigo', 'friend']],
  A2: [['estación', 'station'], ['billete', 'ticket'], ['calle', 'street'], ['izquierda', 'left'], ['derecha', 'right'], ['¿cuánto cuesta?', 'how much?'], ['tienda', 'shop'], ['hotel', 'hotel'], ['mañana', 'morning'], ['tarde', 'evening']],
  B1: [['trabajo', 'job'], ['empresa', 'company'], ['reunión', 'meeting'], ['opinión', 'opinion'], ['estar de acuerdo', 'agree'], ['medio ambiente', 'environment'], ['salud', 'health'], ['experiencia', 'experience'], ['decisión', 'decision'], ['problema', 'problem']],
  B2: [['evidencia', 'evidence'], ['significativo', 'significant'], ['persuadir', 'persuade'], ['evaluar', 'evaluate'], ['consecuencias', 'consequences'], ['negociar', 'negotiate'], ['oportunidad', 'opportunity'], ['controvertido', 'controversial'], ['suposición', 'assumption'], ['implementar', 'implement']],
  C1: [['sin embargo', 'nevertheless'], ['además', 'moreover'], ['por cierto', 'by the way'], ['a la larga', 'in the long run'], ['para ser honesto', 'to be honest'], ['en mi opinión', 'in my opinion'], ['depende', 'it depends'], ['por otro lado', 'on the other hand'], ['en otras palabras', 'in other words'], ['sin duda', 'without a doubt']],
  C2: [['paradoja', 'paradox'], ['dilema', 'dilemma'], ['inevitable', 'inevitable'], ['profundo', 'profound'], ['meticuloso', 'meticulous'], ['riguroso', 'rigorous'], ['exhaustivo', 'comprehensive'], ['explícito', 'explicit'], ['implícito', 'implicit'], ['generalizado', 'widespread']],
};

const FR: LevelWords = {
  A1: [['bonjour', 'hello'], ['merci', 'thank you'], ["s'il vous plaît", 'please'], ['au revoir', 'goodbye'], ['oui', 'yes'], ['non', 'no'], ['eau', 'water'], ['pain', 'bread'], ['famille', 'family'], ['ami', 'friend']],
  A2: [['gare', 'station'], ['billet', 'ticket'], ['rue', 'street'], ['gauche', 'left'], ['droite', 'right'], ['combien ça coûte ?', 'how much?'], ['magasin', 'shop'], ['hôtel', 'hotel'], ['matin', 'morning'], ['soir', 'evening']],
  B1: [['travail', 'job'], ['entreprise', 'company'], ['réunion', 'meeting'], ['opinion', 'opinion'], ["être d'accord", 'agree'], ['environnement', 'environment'], ['santé', 'health'], ['expérience', 'experience'], ['décision', 'decision'], ['problème', 'problem']],
  B2: [['preuve', 'evidence'], ['significatif', 'significant'], ['persuader', 'persuade'], ['évaluer', 'evaluate'], ['conséquences', 'consequences'], ['négocier', 'negotiate'], ['opportunité', 'opportunity'], ['controversé', 'controversial'], ['supposition', 'assumption'], ['mettre en œuvre', 'implement']],
  C1: [['néanmoins', 'nevertheless'], ['de plus', 'moreover'], ['au fait', 'by the way'], ['à long terme', 'in the long run'], ['pour être honnête', 'to be honest'], ['à mon avis', 'in my opinion'], ['ça dépend', 'it depends'], ["d'un autre côté", 'on the other hand'], ["en d'autres termes", 'in other words'], ['sans aucun doute', 'without a doubt']],
  C2: [['paradoxe', 'paradox'], ['dilemme', 'dilemma'], ['inévitable', 'inevitable'], ['profond', 'profound'], ['méticuleux', 'meticulous'], ['rigoureux', 'rigorous'], ['complet', 'comprehensive'], ['explicite', 'explicit'], ['implicite', 'implicit'], ['répandu', 'widespread']],
};

const DE: LevelWords = {
  A1: [['hallo', 'hello'], ['danke', 'thank you'], ['bitte', 'please'], ['auf Wiedersehen', 'goodbye'], ['ja', 'yes'], ['nein', 'no'], ['Wasser', 'water'], ['Brot', 'bread'], ['Familie', 'family'], ['Freund', 'friend']],
  A2: [['Bahnhof', 'station'], ['Fahrkarte', 'ticket'], ['Straße', 'street'], ['links', 'left'], ['rechts', 'right'], ['wie viel kostet das?', 'how much?'], ['Geschäft', 'shop'], ['Hotel', 'hotel'], ['Morgen', 'morning'], ['Abend', 'evening']],
  B1: [['Arbeit', 'job'], ['Firma', 'company'], ['Besprechung', 'meeting'], ['Meinung', 'opinion'], ['zustimmen', 'agree'], ['Umwelt', 'environment'], ['Gesundheit', 'health'], ['Erfahrung', 'experience'], ['Entscheidung', 'decision'], ['Problem', 'problem']],
  B2: [['Beweis', 'evidence'], ['bedeutend', 'significant'], ['überzeugen', 'persuade'], ['bewerten', 'evaluate'], ['Konsequenzen', 'consequences'], ['verhandeln', 'negotiate'], ['Gelegenheit', 'opportunity'], ['umstritten', 'controversial'], ['Annahme', 'assumption'], ['umsetzen', 'implement']],
  C1: [['dennoch', 'nevertheless'], ['außerdem', 'moreover'], ['übrigens', 'by the way'], ['auf lange Sicht', 'in the long run'], ['um ehrlich zu sein', 'to be honest'], ['meiner Meinung nach', 'in my opinion'], ['es kommt darauf an', 'it depends'], ['andererseits', 'on the other hand'], ['mit anderen Worten', 'in other words'], ['ohne Zweifel', 'without a doubt']],
  C2: [['Paradoxon', 'paradox'], ['Dilemma', 'dilemma'], ['unvermeidlich', 'inevitable'], ['tiefgründig', 'profound'], ['akribisch', 'meticulous'], ['streng', 'rigorous'], ['umfassend', 'comprehensive'], ['explizit', 'explicit'], ['implizit', 'implicit'], ['weit verbreitet', 'widespread']],
};

const IT: LevelWords = {
  A1: [['ciao', 'hello / goodbye'], ['grazie', 'thank you'], ['per favore', 'please'], ['arrivederci', 'goodbye'], ['sì', 'yes'], ['no', 'no'], ['acqua', 'water'], ['pane', 'bread'], ['famiglia', 'family'], ['amico', 'friend']],
  A2: [['stazione', 'station'], ['biglietto', 'ticket'], ['strada', 'street'], ['sinistra', 'left'], ['destra', 'right'], ['quanto costa?', 'how much?'], ['negozio', 'shop'], ['albergo', 'hotel'], ['mattina', 'morning'], ['sera', 'evening']],
  B1: [['lavoro', 'job'], ['azienda', 'company'], ['riunione', 'meeting'], ['opinione', 'opinion'], ["essere d'accordo", 'agree'], ['ambiente', 'environment'], ['salute', 'health'], ['esperienza', 'experience'], ['decisione', 'decision'], ['problema', 'problem']],
  B2: [['prova', 'evidence'], ['significativo', 'significant'], ['convincere', 'persuade'], ['valutare', 'evaluate'], ['conseguenze', 'consequences'], ['negoziare', 'negotiate'], ['opportunità', 'opportunity'], ['controverso', 'controversial'], ['supposizione', 'assumption'], ['attuare', 'implement']],
  C1: [['tuttavia', 'nevertheless'], ['inoltre', 'moreover'], ['a proposito', 'by the way'], ['a lungo termine', 'in the long run'], ['a essere onesti', 'to be honest'], ['secondo me', 'in my opinion'], ['dipende', 'it depends'], ["d'altra parte", 'on the other hand'], ['in altre parole', 'in other words'], ['senza dubbio', 'without a doubt']],
  C2: [['paradosso', 'paradox'], ['dilemma', 'dilemma'], ['inevitabile', 'inevitable'], ['profondo', 'profound'], ['meticoloso', 'meticulous'], ['rigoroso', 'rigorous'], ['completo', 'comprehensive'], ['esplicito', 'explicit'], ['implicito', 'implicit'], ['diffuso', 'widespread']],
};

const PT: LevelWords = {
  A1: [['olá', 'hello'], ['obrigado', 'thank you'], ['por favor', 'please'], ['adeus', 'goodbye'], ['sim', 'yes'], ['não', 'no'], ['água', 'water'], ['pão', 'bread'], ['família', 'family'], ['amigo', 'friend']],
  A2: [['estação', 'station'], ['bilhete', 'ticket'], ['rua', 'street'], ['esquerda', 'left'], ['direita', 'right'], ['quanto custa?', 'how much?'], ['loja', 'shop'], ['hotel', 'hotel'], ['manhã', 'morning'], ['noite', 'evening']],
  B1: [['trabalho', 'job'], ['empresa', 'company'], ['reunião', 'meeting'], ['opinião', 'opinion'], ['concordar', 'agree'], ['meio ambiente', 'environment'], ['saúde', 'health'], ['experiência', 'experience'], ['decisão', 'decision'], ['problema', 'problem']],
  B2: [['evidência', 'evidence'], ['significativo', 'significant'], ['persuadir', 'persuade'], ['avaliar', 'evaluate'], ['consequências', 'consequences'], ['negociar', 'negotiate'], ['oportunidade', 'opportunity'], ['controverso', 'controversial'], ['suposição', 'assumption'], ['implementar', 'implement']],
  C1: [['no entanto', 'nevertheless'], ['além disso', 'moreover'], ['aliás', 'by the way'], ['a longo prazo', 'in the long run'], ['para ser honesto', 'to be honest'], ['na minha opinião', 'in my opinion'], ['depende', 'it depends'], ['por outro lado', 'on the other hand'], ['em outras palavras', 'in other words'], ['sem dúvida', 'without a doubt']],
  C2: [['paradoxo', 'paradox'], ['dilema', 'dilemma'], ['inevitável', 'inevitable'], ['profundo', 'profound'], ['meticuloso', 'meticulous'], ['rigoroso', 'rigorous'], ['abrangente', 'comprehensive'], ['explícito', 'explicit'], ['implícito', 'implicit'], ['difundido', 'widespread']],
};

const JA: LevelWords = {
  A1: [['こんにちは', 'hello'], ['ありがとう', 'thank you'], ['お願いします', 'please'], ['さようなら', 'goodbye'], ['はい', 'yes'], ['いいえ', 'no'], ['水', 'water'], ['パン', 'bread'], ['家族', 'family'], ['友達', 'friend']],
  A2: [['駅', 'station'], ['切符', 'ticket'], ['道', 'street'], ['左', 'left'], ['右', 'right'], ['いくらですか？', 'how much?'], ['店', 'shop'], ['ホテル', 'hotel'], ['朝', 'morning'], ['夜', 'evening']],
  B1: [['仕事', 'job'], ['会社', 'company'], ['会議', 'meeting'], ['意見', 'opinion'], ['同意する', 'agree'], ['環境', 'environment'], ['健康', 'health'], ['経験', 'experience'], ['決断', 'decision'], ['問題', 'problem']],
  B2: [['証拠', 'evidence'], ['重要な', 'significant'], ['説得する', 'persuade'], ['評価する', 'evaluate'], ['結果', 'consequences'], ['交渉する', 'negotiate'], ['機会', 'opportunity'], ['物議を醸す', 'controversial'], ['仮定', 'assumption'], ['実施する', 'implement']],
  C1: [['それにもかかわらず', 'nevertheless'], ['さらに', 'moreover'], ['ところで', 'by the way'], ['長期的には', 'in the long run'], ['正直に言うと', 'to be honest'], ['私の意見では', 'in my opinion'], ['場合による', 'it depends'], ['一方で', 'on the other hand'], ['言い換えれば', 'in other words'], ['間違いなく', 'without a doubt']],
  C2: [['逆説', 'paradox'], ['ジレンマ', 'dilemma'], ['避けられない', 'inevitable'], ['深遠な', 'profound'], ['几帳面な', 'meticulous'], ['厳密な', 'rigorous'], ['包括的な', 'comprehensive'], ['明示的な', 'explicit'], ['暗黙の', 'implicit'], ['広く行き渡った', 'widespread']],
};

const KO: LevelWords = {
  A1: [['안녕하세요', 'hello'], ['감사합니다', 'thank you'], ['주세요', 'please'], ['안녕히 가세요', 'goodbye'], ['네', 'yes'], ['아니요', 'no'], ['물', 'water'], ['빵', 'bread'], ['가족', 'family'], ['친구', 'friend']],
  A2: [['역', 'station'], ['표', 'ticket'], ['길', 'street'], ['왼쪽', 'left'], ['오른쪽', 'right'], ['얼마예요?', 'how much?'], ['가게', 'shop'], ['호텔', 'hotel'], ['아침', 'morning'], ['저녁', 'evening']],
  B1: [['직업', 'job'], ['회사', 'company'], ['회의', 'meeting'], ['의견', 'opinion'], ['동의하다', 'agree'], ['환경', 'environment'], ['건강', 'health'], ['경험', 'experience'], ['결정', 'decision'], ['문제', 'problem']],
  B2: [['증거', 'evidence'], ['중요한', 'significant'], ['설득하다', 'persuade'], ['평가하다', 'evaluate'], ['결과', 'consequences'], ['협상하다', 'negotiate'], ['기회', 'opportunity'], ['논란이 되는', 'controversial'], ['가정', 'assumption'], ['시행하다', 'implement']],
  C1: [['그럼에도 불구하고', 'nevertheless'], ['게다가', 'moreover'], ['그런데', 'by the way'], ['장기적으로', 'in the long run'], ['솔직히 말하면', 'to be honest'], ['제 의견으로는', 'in my opinion'], ['상황에 따라 다르다', 'it depends'], ['반면에', 'on the other hand'], ['다시 말하면', 'in other words'], ['의심할 여지없이', 'without a doubt']],
  C2: [['역설', 'paradox'], ['딜레마', 'dilemma'], ['피할 수 없는', 'inevitable'], ['심오한', 'profound'], ['꼼꼼한', 'meticulous'], ['엄격한', 'rigorous'], ['포괄적인', 'comprehensive'], ['명시적인', 'explicit'], ['암묵적인', 'implicit'], ['널리 퍼진', 'widespread']],
};

const ZH: LevelWords = {
  A1: [['你好', 'hello'], ['谢谢', 'thank you'], ['请', 'please'], ['再见', 'goodbye'], ['是', 'yes'], ['不', 'no'], ['水', 'water'], ['面包', 'bread'], ['家庭', 'family'], ['朋友', 'friend']],
  A2: [['车站', 'station'], ['票', 'ticket'], ['街道', 'street'], ['左边', 'left'], ['右边', 'right'], ['多少钱？', 'how much?'], ['商店', 'shop'], ['酒店', 'hotel'], ['早上', 'morning'], ['晚上', 'evening']],
  B1: [['工作', 'job'], ['公司', 'company'], ['会议', 'meeting'], ['意见', 'opinion'], ['同意', 'agree'], ['环境', 'environment'], ['健康', 'health'], ['经验', 'experience'], ['决定', 'decision'], ['问题', 'problem']],
  B2: [['证据', 'evidence'], ['重要的', 'significant'], ['说服', 'persuade'], ['评估', 'evaluate'], ['后果', 'consequences'], ['谈判', 'negotiate'], ['机会', 'opportunity'], ['有争议的', 'controversial'], ['假设', 'assumption'], ['实施', 'implement']],
  C1: [['然而', 'nevertheless'], ['此外', 'moreover'], ['顺便说一下', 'by the way'], ['从长远来看', 'in the long run'], ['说实话', 'to be honest'], ['在我看来', 'in my opinion'], ['看情况', 'it depends'], ['另一方面', 'on the other hand'], ['换句话说', 'in other words'], ['毫无疑问', 'without a doubt']],
  C2: [['悖论', 'paradox'], ['困境', 'dilemma'], ['不可避免的', 'inevitable'], ['深刻的', 'profound'], ['一丝不苟的', 'meticulous'], ['严格的', 'rigorous'], ['全面的', 'comprehensive'], ['明确的', 'explicit'], ['隐含的', 'implicit'], ['普遍的', 'widespread']],
};

const RU: LevelWords = {
  A1: [['привет', 'hello'], ['спасибо', 'thank you'], ['пожалуйста', 'please'], ['до свидания', 'goodbye'], ['да', 'yes'], ['нет', 'no'], ['вода', 'water'], ['хлеб', 'bread'], ['семья', 'family'], ['друг', 'friend']],
  A2: [['вокзал', 'station'], ['билет', 'ticket'], ['улица', 'street'], ['налево', 'left'], ['направо', 'right'], ['сколько стоит?', 'how much?'], ['магазин', 'shop'], ['гостиница', 'hotel'], ['утро', 'morning'], ['вечер', 'evening']],
  B1: [['работа', 'job'], ['компания', 'company'], ['собрание', 'meeting'], ['мнение', 'opinion'], ['соглашаться', 'agree'], ['окружающая среда', 'environment'], ['здоровье', 'health'], ['опыт', 'experience'], ['решение', 'decision'], ['проблема', 'problem']],
  B2: [['доказательство', 'evidence'], ['значительный', 'significant'], ['убеждать', 'persuade'], ['оценивать', 'evaluate'], ['последствия', 'consequences'], ['вести переговоры', 'negotiate'], ['возможность', 'opportunity'], ['спорный', 'controversial'], ['предположение', 'assumption'], ['внедрять', 'implement']],
  C1: [['тем не менее', 'nevertheless'], ['кроме того', 'moreover'], ['между прочим', 'by the way'], ['в долгосрочной перспективе', 'in the long run'], ['честно говоря', 'to be honest'], ['по моему мнению', 'in my opinion'], ['зависит от обстоятельств', 'it depends'], ['с другой стороны', 'on the other hand'], ['другими словами', 'in other words'], ['без сомнения', 'without a doubt']],
  C2: [['парадокс', 'paradox'], ['дилемма', 'dilemma'], ['неизбежный', 'inevitable'], ['глубокий', 'profound'], ['дотошный', 'meticulous'], ['строгий', 'rigorous'], ['всесторонний', 'comprehensive'], ['явный', 'explicit'], ['подразумеваемый', 'implicit'], ['широко распространённый', 'widespread']],
};

const AR: LevelWords = {
  A1: [['مرحبا', 'hello'], ['شكرا', 'thank you'], ['من فضلك', 'please'], ['وداعا', 'goodbye'], ['نعم', 'yes'], ['لا', 'no'], ['ماء', 'water'], ['خبز', 'bread'], ['عائلة', 'family'], ['صديق', 'friend']],
  A2: [['محطة', 'station'], ['تذكرة', 'ticket'], ['شارع', 'street'], ['يسار', 'left'], ['يمين', 'right'], ['بكم؟', 'how much?'], ['متجر', 'shop'], ['فندق', 'hotel'], ['صباح', 'morning'], ['مساء', 'evening']],
  B1: [['عمل', 'job'], ['شركة', 'company'], ['اجتماع', 'meeting'], ['رأي', 'opinion'], ['أوافق', 'agree'], ['بيئة', 'environment'], ['صحة', 'health'], ['خبرة', 'experience'], ['قرار', 'decision'], ['مشكلة', 'problem']],
  B2: [['دليل', 'evidence'], ['مهم', 'significant'], ['إقناع', 'persuade'], ['تقييم', 'evaluate'], ['عواقب', 'consequences'], ['تفاوض', 'negotiate'], ['فرصة', 'opportunity'], ['مثير للجدل', 'controversial'], ['افتراض', 'assumption'], ['تنفيذ', 'implement']],
  C1: [['ومع ذلك', 'nevertheless'], ['علاوة على ذلك', 'moreover'], ['بالمناسبة', 'by the way'], ['على المدى الطويل', 'in the long run'], ['لأكون صادقا', 'to be honest'], ['في رأيي', 'in my opinion'], ['يعتمد على الظروف', 'it depends'], ['من ناحية أخرى', 'on the other hand'], ['بعبارة أخرى', 'in other words'], ['بدون شك', 'without a doubt']],
  C2: [['مفارقة', 'paradox'], ['معضلة', 'dilemma'], ['حتمي', 'inevitable'], ['عميق', 'profound'], ['دقيق', 'meticulous'], ['صارم', 'rigorous'], ['شامل', 'comprehensive'], ['صريح', 'explicit'], ['ضمني', 'implicit'], ['منتشر', 'widespread']],
};

const HI: LevelWords = {
  A1: [['नमस्ते', 'hello'], ['धन्यवाद', 'thank you'], ['कृपया', 'please'], ['अलविदा', 'goodbye'], ['हाँ', 'yes'], ['नहीं', 'no'], ['पानी', 'water'], ['रोटी', 'bread'], ['परिवार', 'family'], ['दोस्त', 'friend']],
  A2: [['स्टेशन', 'station'], ['टिकट', 'ticket'], ['सड़क', 'street'], ['बाएँ', 'left'], ['दाएँ', 'right'], ['कितने का है?', 'how much?'], ['दुकान', 'shop'], ['होटल', 'hotel'], ['सुबह', 'morning'], ['शाम', 'evening']],
  B1: [['काम', 'job'], ['कंपनी', 'company'], ['बैठक', 'meeting'], ['राय', 'opinion'], ['सहमत होना', 'agree'], ['पर्यावरण', 'environment'], ['स्वास्थ्य', 'health'], ['अनुभव', 'experience'], ['फैसला', 'decision'], ['समस्या', 'problem']],
  B2: [['सबूत', 'evidence'], ['महत्वपूर्ण', 'significant'], ['मनाना', 'persuade'], ['मूल्यांकन करना', 'evaluate'], ['परिणाम', 'consequences'], ['बातचीत करना', 'negotiate'], ['अवसर', 'opportunity'], ['विवादास्पद', 'controversial'], ['धारणा', 'assumption'], ['लागू करना', 'implement']],
  C1: [['फिर भी', 'nevertheless'], ['इसके अलावा', 'moreover'], ['वैसे', 'by the way'], ['लंबे समय में', 'in the long run'], ['सच कहूँ तो', 'to be honest'], ['मेरी राय में', 'in my opinion'], ['यह निर्भर करता है', 'it depends'], ['दूसरी ओर', 'on the other hand'], ['दूसरे शब्दों में', 'in other words'], ['बिना किसी संदेह के', 'without a doubt']],
  C2: [['विरोधाभास', 'paradox'], ['दुविधा', 'dilemma'], ['अपरिहार्य', 'inevitable'], ['गहरा', 'profound'], ['अत्यंत सावधान', 'meticulous'], ['कठोर', 'rigorous'], ['व्यापक', 'comprehensive'], ['स्पष्ट', 'explicit'], ['निहित', 'implicit'], ['व्यापक रूप से फैला हुआ', 'widespread']],
};

const TR: LevelWords = {
  A1: [['merhaba', 'hello'], ['teşekkürler', 'thank you'], ['lütfen', 'please'], ['hoşça kal', 'goodbye'], ['evet', 'yes'], ['hayır', 'no'], ['su', 'water'], ['ekmek', 'bread'], ['aile', 'family'], ['arkadaş', 'friend']],
  A2: [['istasyon', 'station'], ['bilet', 'ticket'], ['sokak', 'street'], ['sol', 'left'], ['sağ', 'right'], ['ne kadar?', 'how much?'], ['dükkân', 'shop'], ['otel', 'hotel'], ['sabah', 'morning'], ['akşam', 'evening']],
  B1: [['iş', 'job'], ['şirket', 'company'], ['toplantı', 'meeting'], ['görüş', 'opinion'], ['katılmak', 'agree'], ['çevre', 'environment'], ['sağlık', 'health'], ['deneyim', 'experience'], ['karar', 'decision'], ['sorun', 'problem']],
  B2: [['kanıt', 'evidence'], ['önemli', 'significant'], ['ikna etmek', 'persuade'], ['değerlendirmek', 'evaluate'], ['sonuçlar', 'consequences'], ['müzakere etmek', 'negotiate'], ['fırsat', 'opportunity'], ['tartışmalı', 'controversial'], ['varsayım', 'assumption'], ['uygulamak', 'implement']],
  C1: [['yine de', 'nevertheless'], ['ayrıca', 'moreover'], ['bu arada', 'by the way'], ['uzun vadede', 'in the long run'], ['dürüst olmak gerekirse', 'to be honest'], ['bence', 'in my opinion'], ['duruma göre değişir', 'it depends'], ['diğer yandan', 'on the other hand'], ['başka bir deyişle', 'in other words'], ['şüphesiz', 'without a doubt']],
  C2: [['paradoks', 'paradox'], ['ikilem', 'dilemma'], ['kaçınılmaz', 'inevitable'], ['derin', 'profound'], ['titiz', 'meticulous'], ['sıkı', 'rigorous'], ['kapsamlı', 'comprehensive'], ['açık', 'explicit'], ['örtük', 'implicit'], ['yaygın', 'widespread']],
};

/** Language BCP-47 codes that ship starter sets (in display order). */
export const STARTER_LANGS = ['es-ES', 'fr-FR', 'de-DE', 'it', 'pt-BR', 'ja-JP', 'ko', 'zh-CN', 'ru', 'ar-EG', 'hi', 'tr'] as const;

const LEVEL_DATA: Record<string, LevelWords> = {
  'es-ES': ES,
  'fr-FR': FR,
  'de-DE': DE,
  it: IT,
  'pt-BR': PT,
  'ja-JP': JA,
  ko: KO,
  'zh-CN': ZH,
  ru: RU,
  'ar-EG': AR,
  hi: HI,
  tr: TR,
};

function buildSets(): StarterSet[] {
  const out: StarterSet[] = [];
  for (const lang of STARTER_LANGS) {
    const data = LEVEL_DATA[lang];
    for (const level of CEFR_LEVELS) {
      const words = data[level].map(([target, translation]) => ({ target, translation }));
      out.push({ id: `starter-${lang}-${level}`, lang, level, words });
    }
  }
  return out;
}

export const STARTER_SETS: StarterSet[] = buildSets();

/** Display title for a starter set, e.g. "Spanish A1". */
export function starterTitle(set: StarterSet): string {
  const label = findLanguage(set.lang)?.label ?? set.lang;
  const base = label.replace(/\s*\(.*\)\s*$/, '');
  return `${base} ${set.level}`;
}

/** Friendly label for a starter language, e.g. "Spanish (Spain)". */
export function starterLangLabel(lang: string): string {
  return findLanguage(lang)?.label ?? lang;
}

