// 純粋な関数だけを置く（scripts/check-logic.ts から node で直接実行するため、enum など型以外の TS 構文は使わない）

/** temp: 音声で言った、登録していないお店。買い物リストにだけ出て、その店の行が無くなると消える（dropTempTags） */
export type Tag = { id: string; name: string; temp?: boolean };

/** 定期購入品 */
export type Item = {
  id: string;
  name: string;
  tagId?: string;
  memo: string;
  /** 登録時の購入周期（日）。購入が2回以上あれば学習値が優先 */
  cycleDays: number;
  /** documentDirectory 内のファイル名（絶対パスは再インストールで変わるので持たない） */
  photo?: string;
  /** 切り抜き（photo は透過 PNG）の元になった JPEG。棚を「元の写真」表示にするとき使う */
  photoOrig?: string;
  url: string;
  createdAt: string;
  /** 自動追加モードで、この次回予定日のぶんはもうリストに入れた */
  autoAddedFor?: string;
  /** true: この端末だけの品（家族に共有しない）。既定は共有 */
  private?: boolean;
  /** 売り場（AREAS のどれか）。無ければ品名から推す（areaOf） */
  area?: string;
};

export type Purchase = {
  id: string;
  itemId?: string;
  name: string;
  tagId?: string;
  date: string;
  /** 買った人の呼び名（家族グループ参加中に記録したぶんだけ） */
  by?: string;
  /** 共有しない品を消したあとも、その購入は共有しない */
  private?: boolean;
};

export type ListEntry = {
  id: string;
  name: string;
  tagId?: string;
  memo: string;
  itemId?: string;
  addedAt: number;
  /** チェック済みなら記録した購入 */
  purchaseId?: string;
  /** チェックした日（この日のあいだ「今日買ったもの」に出す） */
  checkedOn?: string;
  /** 売り場（いつもの品に登録していない行だけ。登録した品は品の area） */
  area?: string;
};

export type Settings = {
  notify: boolean;
  notifyDaysBefore: number;
  notifyHour: number;
  /** true: 近づいたら自動でリストに追加 / false: 通知のみ */
  autoAdd: boolean;
  /** よく使うネットスーパーの検索URL。{q} を品名に置き換える */
  superUrl: string;
  checkHintShown: boolean;
  /** 品名が空のとき、写真を Gemini に送って品名を読み取る */
  aiPhoto: boolean;
  /** 話した文字（声ではなく文字）を Gemini に送って品ごとに分ける */
  aiVoice: boolean;
  /** 合わないいらすとやアイコンを外した品名（trim 済み。この端末だけ） */
  iconOff: string[];
  /** 写真つきの品の見せ方: 切り抜き / 元の写真 */
  shelfView: 'cutout' | 'photo';
  /** false: 品の絵（写真・いらすとや）を出さず、品名の頭文字の札にする */
  showPics: boolean;
  /** 買い物リストを売り場ごとに分けて並べる */
  byArea: boolean;
  /** 売り場順を初めてオンにしたときの案内を出した */
  areaHintShown: boolean;
  netHintShown?: boolean;
  /** お店（tagId）ごとの売り場の並び。無いお店は AREAS の順（この端末だけ） */
  areaOrder: Record<string, string[]>;
};

export type State = {
  version: 1;
  /** 未使用（家族共有は cloud.hid を使う） */
  householdId: string;
  /** 家族グループに参加中だけ持つ。無ければクラウドには一切つながない */
  cloud?: { hid: string; name: string };
  items: Item[];
  list: ListEntry[];
  purchases: Purchase[];
  tags: Tag[];
  settings: Settings;
};

/** 棚で「もうすぐ」に入れる残り日数 */
export const SOON_DAYS = 7;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// 日付は端末ローカルの YYYY-MM-DD 文字列で持つ（new Date('YYYY-MM-DD') は UTC 扱いになるので使わない）
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const toDate = (s: string, hour = 0) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};
export const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const diffDays = (from: string, to: string) => {
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
};
export const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

/** 「11/2」「2026/11/2」「2026-11-02」を YYYY-MM-DD に。月日だけなら今日以前で一番近い年 */
export function parseDateInput(input: string, todayStr: string): string | undefined {
  const nums = input.trim().split(/[/\-.\s年月日]+/).filter(Boolean).map(Number);
  if (nums.some(isNaN)) return;
  let [y, m, d] = nums.length === 3 ? nums : [Number(todayStr.slice(0, 4)), nums[0], nums[1]];
  if (nums.length !== 2 && nums.length !== 3) return;
  const s = `${y}-${pad(m)}-${pad(d)}`;
  if (m < 1 || m > 12 || d < 1 || toDate(s).getDate() !== d) return;
  if (nums.length === 2 && s > todayStr) y -= 1;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 同じ日の重複を除いた購入日（昇順） */
export const purchaseDates = (itemId: string, purchases: Purchase[]) =>
  [...new Set(purchases.filter((p) => p.itemId === itemId).map((p) => p.date))].sort();

/** 学習した周期（日）。直近3回の間隔の平均。間隔が取れなければ登録時の周期 */
export function cycleOf(item: Item, purchases: Purchase[]): number {
  const dates = purchaseDates(item.id, purchases);
  const gaps = dates.slice(1).map((d, i) => diffDays(dates[i], d)).slice(-3);
  if (!gaps.length) return item.cycleDays;
  return Math.max(1, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length));
}

export const lastPurchase = (item: Item, purchases: Purchase[]) => purchaseDates(item.id, purchases).at(-1);

export const nextDate = (item: Item, purchases: Purchase[]) =>
  addDays(lastPurchase(item, purchases) ?? item.createdAt, cycleOf(item, purchases));

/** リストに未購入で入っているか */
export const inList = (itemId: string, list: ListEntry[]) => list.some((e) => e.itemId === itemId && !e.purchaseId);

/**
 * 予約する通知（日付ごとに1件にまとめる）。iOS の予約上限64件に収めるため最大 limit 件。
 * 通知日 = 次回予定日 − N日。過ぎていれば今日。今日でも時刻を過ぎていれば翌日。リストに入っている品は除く。
 */
export function notifyPlan(s: State, todayStr: string, nowHour: number, limit = 60) {
  const { notifyDaysBefore: n, notifyHour } = s.settings;
  const byDate = new Map<string, string[]>();
  for (const item of s.items) {
    if (inList(item.id, s.list)) continue;
    let date = addDays(nextDate(item, s.purchases), -n);
    if (date < todayStr) date = todayStr;
    if (date === todayStr && nowHour >= notifyHour) date = addDays(todayStr, 1);
    byDate.set(date, [...(byDate.get(date) ?? []), item.name]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([date, names]) => ({ date, names }));
}

/** 起動・前面化のたびに当てる整理。前日以前にチェックした行を消し、自動追加モードなら近い品をリストへ */
export function refresh(s: State, todayStr: string): State {
  let list = s.list.filter((e) => !e.purchaseId || e.checkedOn === todayStr);
  let items = s.items;
  if (s.settings.autoAdd) {
    items = s.items.map((item) => {
      const next = nextDate(item, s.purchases);
      if (item.autoAddedFor === next || diffDays(todayStr, next) > s.settings.notifyDaysBefore) return item;
      if (!inList(item.id, list)) {
        list = [...list, { id: newId(), name: item.name, tagId: item.tagId, memo: '', itemId: item.id, addedAt: Date.now() }];
      }
      return { ...item, autoAddedFor: next };
    });
  }
  return dropTempTags(s, list === s.list && items === s.items ? s : { ...s, list, items });
}

/** 話した文を品ごとに分ける（「、。,」・空白・「それと」「あと」で区切る。単独の「と」では区切らない: トマト・牛乳と卵） */
export const splitSpoken = (text: string): string[] =>
  text.split(/[、。,，\s]+|それと|あと/).map((x) => x.trim()).filter(Boolean);

const QTY_UNITS = '本|個|箇|ヶ|パック|袋|枚|缶|箱|つ|セット|台|冊|足|束|玉|丁|瓶|ケース|ロール|キロ|リットル|グラム';
// 音声認識が出しがちな読み（アマゾン・らくてん・ひゃっきん）も入れる
const SPOKEN_STORES = ['スーパー', 'ドラッグストア', 'ドラッグ', '薬局', 'コンビニ', '100円ショップ', '100円均一', '100均', '百円ショップ', '百均', 'ひゃっきん', 'ひゃっきんしょっぷ', 'ホームセンター', 'Amazon', 'アマゾン', 'あまぞん', '楽天', '楽天市場', 'らくてん', 'ネット'];
const KANJI_DIGIT: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
/** 漢数字（一〜九十九）を算用数字の文字列へ。算用数字はそのまま */
const kanjiNum = (n: string) => {
  if (!n.includes('十')) return [...n].map((c) => KANJI_DIGIT[c] ?? c).join('');
  const [a, b] = n.split('十');
  return String((a ? KANJI_DIGIT[a] : 1) * 10 + (b ? KANJI_DIGIT[b] : 0));
};

// 「ひとつ」〜「とお」は 1個〜10個 にする（1つ…10つ は不自然）
const HIRA_QTY: Record<string, string> = { ひとつ: '1個', ふたつ: '2個', みっつ: '3個', よっつ: '4個', いつつ: '5個', むっつ: '6個', ななつ: '7個', やっつ: '8個', ここのつ: '9個', とお: '10個' };
const TAIL_QTY = new RegExp(`^(.*?)([0-9一二三四五六七八九十]+(?:${QTY_UNITS})|${Object.keys(HIRA_QTY).join('|')})を?$`);

/**
 * 話した文を 品名・お店・メモ(数量) に分ける（AI オフ・失敗時用）。
 * 「〇〇で」は〇〇が登録済みのお店かよくある店の言葉のときだけお店とし、以降の品に引き継ぐ。
 * 「と」で区切るのは、数量のあと（2本と）か、漢字・カタカナ・数字・英字のあとの「と」（牛乳と卵）。
 * カタカナの「ト」（トマト）と「とう」（とうふ）は切らない。
 * 数量は区切りの末尾にあるときだけ（三つ葉・八丁味噌・卵十個パックは品名のまま）。漢数字は算用数字、「箇」は「個」に
 */
// 同じお店の呼び方の違い（読み・英字・略称）。storeKey がこの代表名にそろえる
const STORE_ALIASES: string[][] = [
  ['amazon', 'あまぞん', 'あまぞんどっとこむ'],
  ['楽天', '楽天市場', 'らくてん', 'らくてんいちば', 'rakuten'],
  ['100円ショップ', '100円均一', '100均', '百円ショップ', '百均', 'ひゃっきん', 'ひゃっきんしょっぷ', 'ひゃくえんしょっぷ'],
  ['ドラッグストア', 'ドラッグ', 'どらっぐすとあ', 'どらっぐ'],
  ['コストコ', 'costco'],
  ['イオン', 'aeon'],
];
const kana = (t: string) => t.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const ALIAS = new Map(STORE_ALIASES.flatMap((g) => g.map((w) => [kana(w), kana(g[0])] as [string, string])));
/** お店の名前を比べるためのキー。全角半角・大小・カタカナひらがな・呼び方の違い（アマゾン＝Amazon など）をそろえる */
export const storeKey = (name: string) => {
  const k = kana(name.trim());
  return ALIAS.get(k) ?? k;
};

export function parseSpoken(text: string, storeNames: string[]): { name: string; store?: string; memo: string }[] {
  const key = storeKey;
  const stores = [...storeNames, ...SPOKEN_STORES].map(key);
  const chunks = text
    .normalize('NFKC')
    .split(/[、。,，\s]+|それと|あと|(?<=[一-龥ァ-ヿA-Za-z0-9つ])と(?!う)/)
    .map((x) => x?.trim())
    .filter(Boolean);
  const out: { name: string; store?: string; memo: string }[] = [];
  let store: string | undefined;
  for (const chunk of chunks) {
    let body = chunk;
    for (let i = body.indexOf('で'); i > 0; i = body.indexOf('で', i + 1)) {
      const spoken = body.slice(0, i);
      if (!stores.includes(key(spoken))) continue;
      store = storeNames.find((n) => key(n) === key(spoken)) ?? spoken;
      body = body.slice(i + 1);
      break;
    }
    const m = body.match(TAIL_QTY);
    const q = m?.[2] ?? '';
    const qty = HIRA_QTY[q] ?? q.replace(/^([0-9一二三四五六七八九十]+)(.+)$/, (_, n: string, u: string) => kanjiNum(n) + (u === '箇' || u === 'ヶ' ? '個' : u));
    const name = (m ? m[1] : body).replace(/を$/, '').trim();
    if (name) out.push({ name, ...(store ? { store } : {}), memo: qty });
    else if (qty && out.length && !out[out.length - 1].memo) out[out.length - 1].memo = qty; // 「牛乳 2本」と間があいた数量
  }
  return out;
}

/** 「わたし」タブのお知らせ設定の要約文。allowed=false は iPhone 側で通知が止まっている */
export function notifySummary(s: Settings, allowed: boolean): string {
  const auto = s.autoAdd ? '近づいた品は自動でリストに入ります。' : '近づいた品は通知だけで、リストには自分で入れます。';
  if (!s.notify) return `通知はオフです。${s.autoAdd ? auto : '近づいた品は棚の日数で確かめてください。'}`;
  const when = s.notifyDaysBefore ? `買う日の ${s.notifyDaysBefore} 日前` : '買う日の当日';
  return `${when}の ${s.notifyHour} 時ごろにお知らせします。${auto}${allowed ? '' : 'iPhone の設定で通知が止まっています。'}`;
}

// ---- 売り場（買い物リストの「売り場順」） ----

export const AREAS = [
  '野菜・果物', '魚介', '肉', '惣菜・弁当', '豆腐・納豆・練り物・漬物・味噌', '卵・乳製品', 'パン', '米・乾麺・パスタ', '調味料・油・粉', '缶詰・乾物・レトルト',
  'お菓子', '飲み物', 'お酒', '冷凍食品・アイス', '日用品・洗剤', '薬・衛生用品', '化粧品・ヘア・ボディケア', 'ベビー用品', 'ペット用品', '文房具・本',
  '衣類・靴', '台所・生活雑貨', '花・園芸', 'その他',
];
// 品名に含まれる言葉 → 売り場。いちばん長く一致した言葉で決める（matchIcon）
const AREA_WORDS: [string[], string][] = [
  [['野菜', 'キャベツ', 'レタス', 'トマト', 'きゅうり', '玉ねぎ', 'たまねぎ', 'にんじん', 'じゃがいも', 'ねぎ', 'もやし', 'ほうれん草', 'きのこ', '果物', 'バナナ', 'りんご', 'みかん', 'いちご'], '野菜・果物'],
  [['魚', '鮭', 'さけ', '刺身', 'まぐろ', 'えび', 'いか', 'たこ', 'しらす'], '魚介'],
  [['肉', '豚', '鶏', '牛肉', 'ひき肉', 'ハム', 'ベーコン', 'ソーセージ', 'ウインナー'], '肉'],
  [['惣菜', 'お惣菜', '弁当', 'お弁当', 'おにぎり', 'サラダ', '唐揚げ', 'コロッケ'], '惣菜・弁当'],
  [['豆腐', '納豆', '油揚げ', 'ちくわ', 'かまぼこ', '練り物', '漬物', 'キムチ', '味噌', 'みそ'], '豆腐・納豆・練り物・漬物・味噌'],
  [['卵', 'たまご', '牛乳', 'ミルク', 'ヨーグルト', 'チーズ', 'バター'], '卵・乳製品'],
  [['パン', '食パン'], 'パン'],
  [['米', 'お米', 'ごはん', 'パスタ', 'スパゲティ', 'うどん', 'そば', 'そうめん', 'ラーメン', '麺', 'シリアル'], '米・乾麺・パスタ'],
  [['醤油', 'しょうゆ', '砂糖', '塩', '酢', '油', 'オリーブオイル', 'マヨネーズ', 'ケチャップ', 'ソース', 'だし', '小麦粉', '片栗粉', 'みりん'], '調味料・油・粉'],
  [['缶詰', 'ツナ', 'カレー', 'レトルト', 'わかめ', 'のり', '海苔', 'かつお節', 'インスタント'], '缶詰・乾物・レトルト'],
  [['お菓子', 'チョコ', 'ポテトチップス', 'クッキー', 'ガム', 'せんべい', 'グミ'], 'お菓子'],
  [['水', 'お茶', '茶', 'コーヒー', 'ジュース', '炭酸', '紅茶'], '飲み物'],
  [['酒', 'お酒', 'ビール', 'ワイン', '日本酒', '焼酎', 'ハイボール', 'チューハイ'], 'お酒'],
  [['冷凍', 'アイス', '冷凍食品'], '冷凍食品・アイス'],
  [['洗剤', '柔軟剤', '漂白剤', 'ティッシュ', 'トイレットペーパー', 'ゴミ袋', '電池', '電球', '芳香剤'], '日用品・洗剤'],
  [['薬', 'マスク', '絆創膏', '目薬', '生理用品', 'ナプキン', '綿棒', '湿布', 'ビタミン', 'サプリ'], '薬・衛生用品'],
  [['シャンプー', 'リンス', 'コンディショナー', 'ボディソープ', '石鹸', 'せっけん', '歯ブラシ', '歯磨き', '化粧水', '日焼け止め', 'ハンドクリーム'], '化粧品・ヘア・ボディケア'],
  [['おむつ', 'おしりふき', 'ミルク缶', '離乳食'], 'ベビー用品'],
  [['ペット', 'ドッグフード', 'キャットフード', '猫砂', 'ペットシーツ'], 'ペット用品'],
  [['ノート', 'ペン', '鉛筆', '文房具', '本', '雑誌', 'テープ'], '文房具・本'],
  [['靴下', '下着', '服', '靴', 'シャツ'], '衣類・靴'],
  [['キッチンペーパー', 'ラップ', 'アルミホイル', 'スポンジ', '保存袋', '食器'], '台所・生活雑貨'],
  [['花', '培養土', '肥料', '花の種', '苗'], '花・園芸'],
];

/** 品の売り場。品に決めてあればそれ、無ければ品名から推す（いちばん長く一致した言葉）。分からなければ「その他」 */
export const areaOf = (name: string, item?: { area?: string }) => (item?.area && AREAS.includes(item.area) ? item.area : matchIcon(name, AREA_WORDS) ?? 'その他');

/** お店ごとの売り場の並び（保存した並び + 足りない売り場を後ろに） */
export function areaOrderFor(s: Settings, tagId?: string): string[] {
  const saved = (tagId && s.areaOrder[tagId]) || [];
  const head = saved.filter((a) => AREAS.includes(a));
  return [...head, ...AREAS.filter((a) => !head.includes(a))];
}

/** 一時的なお店を除いたお店（棚・品の登録・お店の設定で使う） */
export const realTags = (tags: Tag[]) => tags.filter((t) => !t.temp);

/** よく使うネットスーパーの名前と検索 URL。わたし画面で入れていなければ Amazonフレッシュ */
export const superLink = (superUrl: string, name: string): [string, string] => {
  const q = encodeURIComponent(name);
  return superUrl ? ['ネットスーパー', superUrl.replace('{q}', q)] : ['Amazonフレッシュ', `https://www.amazon.co.jp/s?k=${q}&i=amazonfresh`];
};

/** お店を登録する。同じお店（storeKey が同じ）があればそれを使い、一時的なお店なら正式に登録し直す。登録したお店の id も返す */
export function addStore<S extends { tags: Tag[] }>(st: S, name: string, newTagId = newId()): [S, string] {
  const k = storeKey(name);
  const hit = st.tags.find((t) => storeKey(t.name) === k);
  if (hit) return [hit.temp ? { ...st, tags: st.tags.map((t) => (t === hit ? { id: t.id, name: t.name } : t)) } : st, hit.id];
  return [{ ...st, tags: [...st.tags, { id: newTagId, name: name.trim() }] }, newTagId];
}

/**
 * prev では使われていて next で使われなくなった一時的なお店を消す。変化が無ければ next をそのまま返す。
 * 「今使われていない」だけで消さないのは、家族の端末の行（private の行は届かない・お店と行が別々に届く）を見誤って消さないため
 */
export function dropTempTags(prev: State, next: State): State {
  const usedIn = (x: State) => new Set([...x.list, ...x.items].map((e) => e.tagId));
  const before = usedIn(prev);
  const now = usedIn(next);
  const tags = next.tags.filter((t) => !t.temp || !before.has(t.id) || now.has(t.id));
  return tags.length === next.tags.length ? next : { ...next, tags };
}

// ---- 品名からアイコンを選ぶ（全角半角・カタカナひらがなをそろえ、いちばん長く一致した言葉を採る） ----

const norm = (t: string) => t.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export function matchIcon<T>(name: string, table: [string[], T][]): T | undefined {
  const n = norm(name);
  let best: T | undefined;
  let len = 0;
  for (const [words, v] of table)
    for (const w of words) if (norm(w).length > len && n.includes(norm(w))) [best, len] = [v, norm(w).length];
  return best;
}

// ---- 家族共有（手元の State とクラウドの差分。cloud.ts / store.tsx が使う） ----

export type Col = 'items' | 'list' | 'purchases' | 'tags';
export const COLS: Col[] = ['items', 'list', 'purchases', 'tags'];
/** クラウドに置く部分（private の品とその購入・リスト行を除く） */
export type Shared = { items: Item[]; list: ListEntry[]; purchases: Purchase[]; tags: Tag[] };
export const noShared = (): Shared => ({ items: [], list: [], purchases: [], tags: [] });
/** data が無ければ削除 */
export type Change = { col: Col; id: string; data?: Record<string, unknown> };
export type Doc = { id: string; data: Record<string, unknown> };

/** 共有する部分（priv=false）と、この端末だけの部分（priv=true）に分ける */
const split = (s: State, priv: boolean): Shared => {
  const hide = new Set(s.items.filter((i) => i.private).map((i) => i.id));
  const hidden = (id?: string) => !!id && hide.has(id);
  return {
    items: s.items.filter((i) => !!i.private === priv),
    list: s.list.filter((e) => hidden(e.itemId) === priv),
    purchases: s.purchases.filter((p) => (!!p.private || hidden(p.itemId)) === priv),
    tags: priv ? [] : s.tags,
  };
};
export const sharedPart = (s: State) => split(s, false);

// お店は並び順が大事なので、文書に位置 o を足して送る（Shared の側には持たない）
// 項目の並びが違うだけで別物にならないよう、キーを並べ替えた JSON で比べる（Firestore は項目の並びを保たない）
const canon = (v: unknown): unknown =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, canon(x)]))
    : v;
const docMap = (x: Shared) => {
  const m = new Map<string, string>();
  for (const c of COLS) x[c].forEach((d, i) => m.set(`${c}/${d.id}`, JSON.stringify(canon(c === 'tags' ? { ...d, o: i } : d))));
  return m;
};
const unkey = (k: string) => ({ col: k.slice(0, k.indexOf('/')) as Col, id: k.slice(k.indexOf('/') + 1) });

/** 文書のキー（col/id）→ JSON。「前回クラウドにあったもの」の記録に使う（起動時の 3 者比較の「前回」） */
export const docJson = (x: Shared): Record<string, string> => Object.fromEntries(docMap(x));

/** prev を next にするために送る set / delete（id ごとの JSON 比較。undefined の項目は JSON で落ちる） */
export function diffShared(prev: Shared, next: Shared): Change[] {
  const a = docMap(prev);
  const b = docMap(next);
  const out: Change[] = [];
  for (const [k, v] of b) if (a.get(k) !== v) out.push({ ...unkey(k), data: JSON.parse(v) });
  for (const k of a.keys()) if (!b.has(k)) out.push(unkey(k));
  return out;
}

/** 写真ファイル名として安全か。クラウドから来た名前はパスに使うので、「/」や「..」を含むものを通さない（newId・UUID の名前は通る） */
export const validPhoto = (n: unknown): n is string => typeof n === 'string' && /^[0-9A-Za-z-]+\.(jpg|png)$/.test(n);

/** 写真ファイル名（photo / photoOrig） */
export const photoNames = (items: Item[]) => [...new Set(items.flatMap((i) => [i.photo, i.photoOrig]).filter((n): n is string => !!n))];

/** next に新しく現れた写真ファイル名（クラウドへ送る分） */
export function newPhotoNames(prev: Shared, next: Shared): string[] {
  const old = new Set(photoNames(prev.items));
  return photoNames(next.items).filter((n) => !old.has(n));
}

/** クラウドの 4 コレクションの文書 → Shared。並びは決まった順にそろえる */
export function fromDocs(d: Record<Col, Doc[]>): Shared {
  const rows = <T>(c: Col) => d[c].map((x) => ({ ...x.data, id: x.id }) as T);
  return {
    items: rows<Item>('items')
      .map((i) => ({ ...i, photo: validPhoto(i.photo) ? i.photo : undefined, photoOrig: validPhoto(i.photoOrig) ? i.photoOrig : undefined }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    list: rows<ListEntry>('list').sort((a, b) => a.addedAt - b.addedAt),
    purchases: rows<Purchase>('purchases').sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    tags: [...d.tags].sort((a, b) => Number(a.data.o) - Number(b.data.o)).map((x) => ({ id: x.id, name: String(x.data.name), ...(x.data.temp === true ? { temp: true } : {}) })),
  };
}

/** 2 回目以降の取り込み: 共有分をクラウドの中身に置き換え、private の分は残す。同じなら同じ State を返す（再描画・再保存しない） */
export function mergeRemote(s: State, remote: Shared): State {
  if (!diffShared(sharedPart(s), remote).length) return s;
  const p = split(s, true);
  return { ...s, items: [...remote.items, ...p.items], list: [...remote.list, ...p.list], purchases: [...remote.purchases, ...p.purchases], tags: remote.tags };
}

/**
 * 前回クラウドにあった JSON（p）・手元（l）・いまのクラウド（r）の 3 者比較で、1 文書の行き先を決める。
 * local: 手元を採る（あとで送られる）/ remote: クラウドを採る / delete: クラウドからも消す（差分として送られる）/ dropLocal: 手元から消す
 */
function decide(l?: string, r?: string, p?: string): 'local' | 'remote' | 'delete' | 'dropLocal' {
  if (l === undefined) return r !== undefined && p !== undefined && r === p ? 'delete' : 'remote';
  if (r === undefined) return p !== undefined && l === p ? 'dropLocal' : 'local';
  return p !== undefined && l !== p ? 'local' : 'remote';
}

/**
 * 最初の取り込み（参加直後・起動直後）: クラウドと手元を文書ごとに 3 者比較する（decide。synced が前回のクラウドの JSON）。
 * 前回の記録が無い文書は、同じ id ならクラウドが勝ち、手元にしかない共有分は残す（あとで差分として送られる）。
 * private の分は常に残す。名前が同じお店はクラウド側の id に寄せる（初期のお店が二重にならないように）
 * ponytail: お店の並びはクラウド側に揃える。オフライン中に並べ替えただけの分は反映されない
 */
export function mergeFirst(s: State, remote: Shared, synced: Map<string, string> = new Map()): State {
  const L = docMap(sharedPart(s));
  const R = docMap(remote);
  const dec = (k: string) => decide(L.get(k), R.get(k), synced.get(k));
  const remap = new Map<string, string>();
  for (const t of s.tags) {
    const r = remote.tags.find((x) => x.name === t.name && !x.temp && !t.temp);
    if (r && r.id !== t.id) remap.set(t.id, r.id);
  }
  const mapTag = <T extends { tagId?: string }>(x: T): T => (x.tagId && remap.has(x.tagId) ? { ...x, tagId: remap.get(x.tagId) } : x);
  const pick = <T extends { id: string; tagId?: string }>(col: Col, local: T[], rem: T[]): T[] => {
    const key = (x: T) => `${col}/${x.id}`;
    const mine = new Map(local.filter((x) => L.has(key(x))).map((x) => [x.id, x]));
    const fromRemote = rem.flatMap((x) => {
      const d = dec(key(x));
      return d === 'delete' ? [] : d === 'local' ? [mapTag(mine.get(x.id)!)] : [x];
    });
    const localOnly = [...mine.values()].filter((x) => !rem.some((y) => y.id === x.id) && dec(key(x)) === 'local').map(mapTag);
    return [...fromRemote, ...localOnly, ...local.filter((x) => !L.has(key(x)))];
  };
  return {
    ...s,
    items: pick('items', s.items, remote.items),
    list: pick('list', s.list, remote.list),
    purchases: pick('purchases', s.purchases, remote.purchases),
    tags: pick('tags', s.tags.filter((t) => !remap.has(t.id)), remote.tags),
  };
}

// 家族コード: 紛らわしい文字（0/O/1/I/L）を除いた英数字 8 文字（31 文字 ^ 8）。表示は XXXX-XXXX
export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeCode = (rand: (n: number) => number) => Array.from({ length: 8 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join('');
export const formatCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
/** 入力のゆれ（小文字・全角・ハイフン・空白）を直す */
export const normalizeCode = (t: string) => t.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---- バックアップの zip（無圧縮）。写真の JPEG はもう縮まないので圧縮しない。部品を足さずに読み書きする ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8); // for...of は Hermes で遅い
  return (c ^ 0xffffffff) >>> 0;
};
// 名前は ASCII だけにする（data.json と写真の名前 = validPhoto）。UTF-8 の変換を持たずに済む
const ascii = (t: string) => Uint8Array.from(t, (ch) => ch.charCodeAt(0) & 0x7f);

/** 無圧縮の zip を作る。名前は ASCII のみ。
 * ponytail: 全部をメモリに持つので、写真の合計の約 2 倍を一時に使う。数百 MB になって落ちるなら、ファイルへ順に書く形にする */
export function zipStore(files: [string, Uint8Array][]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const n = ascii(name);
    const crc = crc32(data);
    const head = (size: number, sig: number) => {
      const h = new Uint8Array(size);
      const v = new DataView(h.buffer);
      v.setUint32(0, sig, true);
      return [h, v] as const;
    };
    const [loc, lv] = head(30, 0x04034b50);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, n.length, true);
    const [cen, cv] = head(46, 0x02014b50);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, n.length, true);
    cv.setUint32(42, offset, true);
    parts.push(loc, n, data);
    central.push(cen, n);
    offset += 30 + n.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const b of all) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

/** zipStore で作った（無圧縮の）zip を読む。名前 → 中身。形が違えば例外 */
export function unzipStore(z: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  let e = z.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip ではありません');
  const count = v.getUint16(e + 10, true);
  let c = v.getUint32(e + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(c, true) !== 0x02014b50) throw new Error('zip が壊れています');
    if (v.getUint16(c + 10, true) !== 0) throw new Error('圧縮された zip は読めません');
    const size = v.getUint32(c + 20, true);
    const nameLen = v.getUint16(c + 28, true);
    const name = String.fromCharCode(...z.subarray(c + 46, c + 46 + nameLen));
    const loc = v.getUint32(c + 42, true);
    const start = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true);
    const data = z.subarray(start, start + size); // 写ししないので、読み込みでメモリを倍使わない
    if (crc32(data) !== v.getUint32(c + 16, true)) throw new Error(`${name} が壊れています`);
    out.set(name, data);
    c += 46 + nameLen + v.getUint16(c + 30, true) + v.getUint16(c + 32, true);
  }
  return out;
}
