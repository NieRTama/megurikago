// 実行: node scripts/check-logic.ts （Node 22.6+ の型除去で直接動く）
import { addDays, cycleOf, diffDays, nextDate, notifyPlan, parseDateInput, refresh, type Item, type State } from '../src/logic.ts';

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
  settings: { notify: true, notifyDaysBefore: 7, notifyHour: 9, autoAdd: false, superUrl: '', checkHintShown: false },
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

console.log('check-logic: ok');

function eq(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`期待 ${JSON.stringify(b)} / 実際 ${JSON.stringify(a)}`);
}
