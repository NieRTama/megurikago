// 純粋な関数だけを置く（scripts/check-logic.ts から node で直接実行するため、enum など型以外の TS 構文は使わない）

export type Tag = { id: string; name: string };

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
  return list === s.list && items === s.items ? s : { ...s, list, items };
}

/** 話した文を品ごとに分ける（「、。,」・空白・「それと」「あと」で区切る。単独の「と」では区切らない: トマト・牛乳と卵） */
export const splitSpoken = (text: string): string[] =>
  text.split(/[、。,，\s]+|それと|あと/).map((x) => x.trim()).filter(Boolean);

/** 「わたし」タブのお知らせ設定の要約文。allowed=false は iPhone 側で通知が止まっている */
export function notifySummary(s: Settings, allowed: boolean): string {
  const auto = s.autoAdd ? '近づいた品は自動でリストに入ります。' : '近づいた品は通知だけで、リストには自分で入れます。';
  if (!s.notify) return `通知はオフです。${s.autoAdd ? auto : '近づいた品は棚の日数で確かめてください。'}`;
  const when = s.notifyDaysBefore ? `買う日の ${s.notifyDaysBefore} 日前` : '買う日の当日';
  return `${when}の ${s.notifyHour} 時ごろにお知らせします。${auto}${allowed ? '' : 'iPhone の設定で通知が止まっています。'}`;
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
    tags: [...d.tags].sort((a, b) => Number(a.data.o) - Number(b.data.o)).map((x) => ({ id: x.id, name: String(x.data.name) })),
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
    const r = remote.tags.find((x) => x.name === t.name);
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
