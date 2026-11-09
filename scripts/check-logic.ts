// 実行: node scripts/check-logic.ts （Node 22.6+ の型除去で直接動く）
import { addStore, addDays, cycleOf, diffDays, diffShared, docJson, formatCode, fromDocs, makeCode, matchIcon, mergeFirst, mergeRemote, newPhotoNames, nextDate, noShared, normalizeCode, notifyPlan, notifySummary, parseDateInput, refresh, parseSpoken, storeKey, sharedPart, splitSpoken, validPhoto, type Item, type Purchase, type State } from '../src/logic.ts';

eq(addDays('2026-01-30', 3), '2026-02-02');
eq(diffDays('2026-12-30', '2027-01-02'), 3);

const item: Item = { id: 'a', name: '牛乳', memo: '', cycleDays: 14, url: '', createdAt: '2026-10-01' };
const p = (date: string) => ({ id: date, itemId: 'a', name: '牛乳', date });

// 購入なし・1回: 登録時の周期
eq(cycleOf(item, []), 14);
eq(nextDate(item, []), '2026-10-15');
eq(nextDate(item, [p('2026-10-05')]), '2026-10-19');
// 同じ日の重複は数えず、直近3間隔の平均（10,6,8 → 8。最初の 20 は使わない）
const ps = ['2026-09-01', '2026-09-21', '2026-10-01', '2026-10-01', '2026-10-07', '2026-10-15'].map(p);
eq(cycleOf(item, ps), 8);
eq(nextDate(item, ps), '2026-10-23');

eq(parseDateInput('11/2', '2026-11-05'), '2026-11-02');
eq(parseDateInput('12/30', '2026-11-05'), '2025-12-30');
eq(parseDateInput('2026/2/30', '2026-11-05'), undefined);

const state: State = {
  version: 1,
  householdId: 'h',
  items: [item, { ...item, id: 'b', name: '洗剤', createdAt: '2026-11-01' }],
  list: [],
  purchases: [],
  tags: [],
  settings: { notify: true, notifyDaysBefore: 7, notifyHour: 9, autoAdd: false, superUrl: '', checkHintShown: false, aiPhoto: false, aiVoice: false, iconOff: [], shelfView: 'cutout', showPics: true, byArea: false, areaHintShown: false, areaOrder: {} },
};
// 牛乳: 次回 10/15 → 通知日は過ぎているので今日。洗剤: 次回 11/15 → 11/8
eq(notifyPlan(state, '2026-11-02', 8), [
  { date: '2026-11-02', names: ['牛乳'] },
  { date: '2026-11-08', names: ['洗剤'] },
]);
// 時刻を過ぎていたら翌日へ
eq(notifyPlan(state, '2026-11-02', 10), [
  { date: '2026-11-03', names: ['牛乳'] },
  { date: '2026-11-08', names: ['洗剤'] },
]);

// 自動追加は1回だけ（リストから外しても同じ予定日ぶんは再追加しない）
const auto = refresh({ ...state, settings: { ...state.settings, autoAdd: true } }, '2026-11-02');
eq(auto.list.length, 1);
eq(refresh({ ...auto, list: [] }, '2026-11-02').list.length, 0);

// 品名→アイコン: カタカナ・半角でも当たり、長い言葉（食器用洗剤）が短い言葉（洗剤）に勝つ
const icons: [string[], string][] = [[['食器用洗剤'], 'syokki'], [['洗濯洗剤', '洗剤'], 'sentaku'], [['卵', 'たまご'], 'egg']];
eq(matchIcon('ﾀﾏｺﾞ 10個', icons), 'egg');
eq(matchIcon('キュキュット食器用洗剤', icons), 'syokki');
eq(matchIcon('アタック 洗剤', icons), 'sentaku');
eq(matchIcon('牛乳', icons), undefined);

// 話した文の分割: 「、」「それと」「あと」で切り、単独の「と」では切らない（牛乳と卵は1品、トマトも割らない）
eq(splitSpoken('牛乳と卵、それとトイレットペーパー'), ['牛乳と卵', 'トイレットペーパー']);
eq(splitSpoken('トマト 卵あとパン。洗剤,ラップ'), ['トマト', '卵', 'パン', '洗剤', 'ラップ']);
eq(splitSpoken('  、 '), []);

// 話した文の解析: お店は登録済み/よくある店の言葉のときだけ。「2本と」で切り、トマト・牛乳と卵は切らない
eq(parseSpoken('スーパーで牛乳2本と卵2個 ドラッグストアで電池を二箇', []), [
  { name: '牛乳', store: 'スーパー', memo: '2本' },
  { name: '卵', store: 'スーパー', memo: '2個' },
  { name: '電池', store: 'ドラッグストア', memo: '2個' },
]);
eq(parseSpoken('牛乳と卵とパン', []), [{ name: '牛乳', memo: '' }, { name: '卵', memo: '' }, { name: 'パン', memo: '' }]);
eq(parseSpoken('トマトとパン', []), [{ name: 'トマト', memo: '' }, { name: 'パン', memo: '' }]);
eq(parseSpoken('トマト3個', []), [{ name: 'トマト', memo: '3個' }]);
eq(parseSpoken('トマト3個と十個パック', []), [{ name: 'トマト', memo: '3個' }, { name: '十個パック', memo: '' }]);
eq(parseSpoken('三つ葉', []), [{ name: '三つ葉', memo: '' }]);
eq(parseSpoken('八丁味噌', []), [{ name: '八丁味噌', memo: '' }]);
eq(parseSpoken('卵十個パック', []), [{ name: '卵十個パック', memo: '' }]);
eq(parseSpoken('豆腐とうどん', []), [{ name: '豆腐とうどん', memo: '' }]);
eq(parseSpoken('コンビニでおにぎり2つ', []), [{ name: 'おにぎり', store: 'コンビニ', memo: '2つ' }]);
eq(parseSpoken('ティッシュ5箱とトイレットペーパー', []), [{ name: 'ティッシュ', memo: '5箱' }, { name: 'トイレットペーパー', memo: '' }]);
eq(parseSpoken('薬局で目薬を一つ', []), [{ name: '目薬', store: '薬局', memo: '1つ' }]);
eq(parseSpoken('卵をふたつ', []), [{ name: '卵', memo: '2個' }]);
eq(parseSpoken('アマゾンで電池', []), [{ name: '電池', store: 'アマゾン', memo: '' }]);
eq(parseSpoken('ｍｙ店で洗剤を一つ、ごみ袋', ['My店']), [{ name: '洗剤', store: 'My店', memo: '1つ' }, { name: 'ごみ袋', store: 'My店', memo: '' }]);
eq(parseSpoken('ダイソーでノート', []), [{ name: 'ダイソーでノート', memo: '' }]); // 未登録の店は切らない
eq(parseSpoken('牛乳 2本 卵', []), [{ name: '牛乳', memo: '2本' }, { name: '卵', memo: '' }]);
eq(parseSpoken('', []), []);

// 通知の要約文: 通知オン/オフ × 自動追加 × 許可、0日前
const sm = state.settings;
eq(notifySummary(sm, true), '買う日の 7 日前の 9 時ごろにお知らせします。近づいた品は通知だけで、リストには自分で入れます。');
eq(notifySummary({ ...sm, autoAdd: true, notifyDaysBefore: 0 }, true), '買う日の当日の 9 時ごろにお知らせします。近づいた品は自動でリストに入ります。');
eq(notifySummary({ ...sm, notify: false }, true), '通知はオフです。近づいた品は棚の日数で確かめてください。');
eq(notifySummary({ ...sm, notify: false, autoAdd: true }, true), '通知はオフです。近づいた品は自動でリストに入ります。');
eq(notifySummary(sm, false).endsWith('iPhone の設定で通知が止まっています。'), true);

// ---- 家族共有: 共有する部分・差分・取り込み ----
const mk = (o: Partial<State>): State => ({ ...state, tags: [{ id: 't1', name: 'スーパー' }, { id: 't2', name: 'ネット' }], ...o });
const pub: Item = { ...item, id: 'pub', photo: 'a.png', photoOrig: 'a.jpg' };
const sec: Item = { ...item, id: 'sec', name: 'ひみつ', private: true };
const pb = (id: string, itemId?: string, extra: Partial<Purchase> = {}): Purchase => ({ id, itemId, name: 'x', date: '2026-11-01', ...extra });
const shared0 = mk({
  items: [pub, sec],
  list: [{ id: 'l1', name: '牛乳', memo: '', itemId: 'pub', addedAt: 1 }, { id: 'l2', name: 'ひみつ', memo: '', itemId: 'sec', addedAt: 2 }, { id: 'l3', name: '単発', memo: '', addedAt: 3 }],
  purchases: [pb('p1', 'pub'), pb('p2', 'sec'), pb('p3', undefined, { private: true }), pb('p4')],
});
// private の品と、その購入・リスト行（消した品の購入も）は共有しない
const sp = sharedPart(shared0);
eq(sp.items.map((x) => x.id), ['pub']);
eq(sp.list.map((x) => x.id), ['l1', 'l3']);
eq(sp.purchases.map((x) => x.id), ['p1', 'p4']);

// 差分: 同じなら空（取り込んだ分を送り返さない）。追加・変更・削除を拾う。お店は並び替えも拾う
eq(diffShared(sp, sp), []);
const next = { ...sp, items: [{ ...pub, name: '新' }], list: [...sp.list.slice(1), { id: 'l9', name: 'n', memo: '', addedAt: 9 }], tags: [sp.tags[1], sp.tags[0]] };
eq(
  diffShared(sp, next).map((c) => `${c.col}/${c.id}${c.data ? '+' : '-'}`),
  ['items/pub+', 'list/l9+', 'tags/t2+', 'tags/t1+', 'list/l1-'],
);
eq(diffShared(sp, next).find((c) => c.col === 'tags' && c.id === 't2')?.data, { id: 't2', name: 'ネット', o: 0 });
// undefined の項目は送らない（Firestore は undefined を受けない）
eq(diffShared({ ...sp, items: [] }, { ...sp, items: [{ ...pub, tagId: undefined }] })[0].data?.tagId, undefined);
eq('tagId' in (diffShared({ ...sp, items: [] }, sp)[0].data ?? {}), false);
// 写真は新しく現れたファイル名だけ
eq(newPhotoNames({ ...sp, items: [] }, sp), ['a.png', 'a.jpg']);
eq(newPhotoNames(sp, { ...sp, items: [{ ...pub, photo: 'b.png' }] }), ['b.png']);

// 取り込み: 同じなら同じ State。違えば共有分をクラウドに置き換え、private は残す
eq(mergeRemote(shared0, sp) === shared0, true);
const remote = fromDocs({
  items: [{ id: 'r1', data: { ...pub, id: 'r1' } }],
  list: [],
  purchases: [{ id: 'q1', data: pb('q1', 'r1', { by: 'はは' }) }],
  tags: [{ id: 't2', data: { name: 'ネット', o: 0 } }, { id: 't1', data: { name: 'スーパー', o: 1 } }],
});
eq(remote.tags.map((x) => x.id), ['t2', 't1']);
const m = mergeRemote(shared0, remote);
eq(m.items.map((x) => x.id), ['r1', 'sec']);
eq(m.list.map((x) => x.id), ['l2']);
eq(m.purchases.map((x) => x.id), ['q1', 'p2', 'p3']);
eq(m.tags.map((x) => x.id), ['t2', 't1']);
eq(diffShared(sharedPart(m), remote), []);

// 最初の取り込み: 手元にしかない分は残す。名前が同じお店はクラウド側の id に寄せ、他の端末で消された分は消す
const local = mk({
  tags: [{ id: 'x1', name: 'スーパー' }, { id: 'x2', name: '新しい店' }],
  items: [{ ...pub, id: 'old', tagId: 'x1' }, { ...pub, id: 'mine', tagId: 'x2' }, sec],
});
const first = mergeFirst(local, { ...remote, items: [] }, new Map(Object.entries(docJson({ ...noShared(), items: [{ ...pub, id: 'old', tagId: 'x1' }] }))));
eq(first.items.map((x) => x.id), ['mine', 'sec']);
eq(first.tags.map((x) => x.id), ['t2', 't1', 'x2']);
eq(mergeFirst({ ...local, items: [{ ...pub, id: 'm2', tagId: 'x1' }] }, { ...remote, items: [] }).items[0].tagId, 't1');
eq(diffShared({ ...remote, items: [] }, sharedPart(first)).map((c) => c.col + '/' + c.id), ['items/mine', 'tags/x2']);
// private にした品は、前回クラウドにあったキーでも消えない
eq(mergeFirst(local, { ...remote, items: [] }, new Map([['items/sec', '{}']])).items.some((x) => x.id === 'sec'), true);

// 起動時の 3 者比較（前回のクラウド prev・手元・いまのクラウド）。オフライン中の変更・削除が消えない
const one = (o: Partial<Item> = {}): Item => ({ ...item, id: 'z', ...o });
const rem = (...items: Item[]) => ({ ...noShared(), items });
const prev = (...items: Item[]) => new Map(Object.entries(docJson(rem(...items))));
const at = (items: Item[], r: ReturnType<typeof rem>, pv: Map<string, string>) => mergeFirst(mk({ items }), r, pv);
// 手元が前回と違う → 手元を採って送る（クラウドも変わっていても）
const t1 = at([one({ name: '手元' })], rem(one()), prev(one()));
eq(t1.items.map((x) => x.name), ['手元']);
eq(diffShared(rem(one()), sharedPart(t1)).filter((c) => c.col === 'items').map((c) => c.col + '/' + c.id), ['items/z']);
eq(at([one({ name: '手元' })], rem(one({ name: 'クラウド' })), prev(one())).items[0].name, '手元');
// 前回あって手元に無く、クラウドが前回のまま → 削除として送る
const t2 = at([], rem(one()), prev(one()));
eq(t2.items, []);
eq(diffShared(rem(one()), sharedPart(t2)).filter((c) => c.col === 'items').map((c) => c.col + '/' + c.id + (c.data ? '+' : '-')), ['items/z-']);
// 前回あって手元に無いが、クラウドが変わっていた → クラウドが勝つ（消した品が戻る）
eq(at([], rem(one({ name: '新' })), prev(one())).items[0].name, '新');
// 前回あってクラウドに無く、手元が前回のまま → 手元から消す。手元が変わっていれば残して送る
eq(at([one()], rem(), prev(one())).items, []);
eq(at([one({ name: '手元' })], rem(), prev(one())).items[0].name, '手元');
// 手元が前回のままなら、クラウドの変更を取り込む（キーの並びが違っても同じ文書とみなす）
const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(one()).reverse())));
eq(at([one()], rem(one({ name: 'クラウド' })), prev(one())).items[0].name, 'クラウド');
eq(diffShared(sharedPart(mk({ items: [one()] })), rem(reordered)).filter((c) => c.col === 'items'), []);
// 前回の記録が無い（初回）: 同じ id はクラウドが勝ち、手元にしかない分は残る
eq(at([one({ name: '手元' })], rem(one({ name: 'クラウド' })), new Map()).items[0].name, 'クラウド');
eq(at([one()], rem(), new Map()).items.length, 1);

// 写真ファイル名: クラウドから来た名前はパスに使うので、安全なものだけ通す（fromDocs で捨てる）
eq(['abc12.jpg', 'k3j4h5.png', 'E621E1F8-C36C-495A.png'].map(validPhoto), [true, true, true]);
eq(['../x.png', 'a/b.jpg', '..jpg', '.png', 'a.gif', 'a.png/', 'a b.png', '', undefined, 3].map(validPhoto), [false, false, false, false, false, false, false, false, false, false]);
const bad = fromDocs({ ...noShared(), items: [{ id: 'q', data: { ...pub, photo: '../../x.png', photoOrig: 'ok1.jpg' } }, { id: 'r', data: { ...pub, photo: 'ok2.png', photoOrig: 'a/b.jpg' } }], list: [], purchases: [], tags: [] });
eq(bad.items.map((x) => [x.photo, x.photoOrig]), [[undefined, 'ok1.jpg'], ['ok2.png', undefined]]);

// 家族コード
eq(makeCode((n) => n - 1).length, 8);
eq(/[0OIL1]/.test(makeCode((n) => Math.floor(Math.random() * n))), false);
eq(formatCode('ABCD2345'), 'ABCD-2345');
eq(normalizeCode(' abcd－2345 '), 'ABCD2345');

console.log('check-logic: ok');

function eq(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`期待 ${JSON.stringify(b)} / 実際 ${JSON.stringify(a)}`);
}

// お店の呼び方の違い: 登録が「Amazon」なら「アマゾンで」もそのお店
eq(storeKey('アマゾン'), storeKey('Amazon'));
eq(storeKey('ひゃっきん'), storeKey('100円ショップ'));
eq(storeKey('薬局') === storeKey('ドラッグストア'), false);
eq(parseSpoken('アマゾンで電池4本', ['Amazon'])[0].store, 'Amazon');
eq(parseSpoken('らくてんで水', ['楽天'])[0].store, '楽天');

// ［＋］でお店を足す: 同じお店は増やさず、一時的なお店は正式に登録し直す
{
  const st = { tags: [{ id: 'a', name: 'Amazon' }, { id: 't', name: 'コンビニ', temp: true }] };
  eq(addStore(st, 'アマゾン'), [st, 'a']);
  eq(addStore(st, 'コンビニ')[0].tags[1], { id: 't', name: 'コンビニ' });
  eq(addStore(st, ' 薬局 ', 'n'), [{ tags: [...st.tags, { id: 'n', name: '薬局' }] }, 'n']);
}
