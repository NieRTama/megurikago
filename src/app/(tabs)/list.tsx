import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { md, nextDate, type ListEntry } from '../../logic';
import { checkEntry, removeEntry, uncheckEntry, useStore } from '../../store';
import { askDate, C, press, s, smooth, TagBar, tagName, Thumb } from '../../ui';

export default function ShoppingList() {
  const { state, day, update } = useStore();
  const [tagId, setTagId] = useState<string>();
  const [byStore, setByStore] = useState(true);
  const [closed, setClosed] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [showBought, setShowBought] = useState(true);

  const todo = state.list.filter((e) => !e.purchaseId && (!tagId || e.tagId === tagId));
  const bought = state.list.filter((e) => e.purchaseId);
  const item = (e: ListEntry) => state.items.find((i) => i.id === e.itemId);

  const check = (e: ListEntry) => {
    const run = () => {
      smooth();
      setPending((p) => [...p, e.id]);
      // 取り消し線を少し見せてから「今日買ったもの」へ移す
      setTimeout(() => {
        update((st) => checkEntry(st, e.id));
        setPending((p) => p.filter((x) => x !== e.id));
      }, 600);
    };
    if (state.settings.checkHintShown) return run();
    update((st) => ({ ...st, settings: { ...st.settings, checkHintShown: true } }));
    Alert.alert('買ったらチェック', 'チェックすると購入日が記録され、次に買う日の目安が更新されます。間違えたときは「今日買ったもの」の［戻す］で元に戻せます。', [{ text: 'わかった', onPress: run }]);
  };

  const groups: [string, ListEntry[]][] = byStore
    ? [...state.tags.map((t) => [t.name, todo.filter((e) => e.tagId === t.id)] as [string, ListEntry[]]), ['お店の指定なし', todo.filter((e) => !tagName(state.tags, e.tagId))]]
    : [['', [...todo].sort((a, b) => a.addedAt - b.addedAt)]];

  return (
    <SafeAreaView edges={['top']} style={s.screen}>
      <View style={[s.row, { paddingRight: 20, gap: 16 }]}>
        <Text style={[s.title, { flex: 1 }]}>買うもの</Text>
        <Pressable onPress={() => (smooth(), setByStore(!byStore))} hitSlop={8}>
          <Text style={s.link}>{byStore ? '店ごと' : '追加順'} ⇅</Text>
        </Pressable>
        <Link href="/add" asChild>
          <Pressable style={(st) => [{ backgroundColor: C.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }, press(st)]}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>＋ 入れる</Text>
          </Pressable>
        </Link>
      </View>
      <TagBar tags={state.tags} value={tagId} onChange={setTagId} allLabel="すべての店" style={{ flexGrow: 0 }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {!todo.length && (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 6 }}>
            <Text style={{ fontSize: 34, fontWeight: '200', color: C.main }}>✓</Text>
            <Text style={s.text}>{state.list.length ? '全部そろいました' : '買うものはまだありません'}</Text>
            <Text style={s.small}>右上の［＋ 入れる］か、「いつもの」の［＋リストへ］で追加できます</Text>
          </View>
        )}
        {groups.map(([label, entries]) =>
          entries.length ? (
            <View key={label || 'all'}>
              {label ? (
                <Pressable onPress={() => (smooth(), setClosed(closed.includes(label) ? closed.filter((x) => x !== label) : [...closed, label]))}>
                  <Text style={s.h2}>
                    {closed.includes(label) ? '▸' : '▾'} {label}（{entries.length}）
                  </Text>
                </Pressable>
              ) : (
                <View style={{ height: 12 }} />
              )}
              {!closed.includes(label) && (
                <View style={[s.card, { paddingVertical: 4 }]}>
                  {entries.map((e, i) => {
                    const done = pending.includes(e.id);
                    return (
                      <Pressable
                        key={e.id}
                        onPress={() => !done && check(e)}
                        onLongPress={() => Alert.alert(`${e.name}をリストから外しますか？`, undefined, [{ text: 'やめる', style: 'cancel' }, { text: '外す', style: 'destructive', onPress: () => update((st) => removeEntry(st, e.id)) }])}
                        style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
                        <Thumb item={item(e)} name={e.name} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.text, done && { textDecorationLine: 'line-through', color: C.sub }]}>{e.name}</Text>
                          {!!e.memo && <Text style={s.small}>{e.memo}</Text>}
                        </View>
                        <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: done ? C.main : C.sub, backgroundColor: done ? C.main : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {done && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null,
        )}

        {!!bought.length && (
          <>
            <Pressable onPress={() => (smooth(), setShowBought(!showBought))}>
              <Text style={s.h2}>
                {showBought ? '▾' : '▸'} 今日買ったもの（{bought.length}）
              </Text>
            </Pressable>
            {showBought && (
              <View style={[s.card, { paddingVertical: 4 }]}>
                {bought.map((e, i) => {
                  const p = state.purchases.find((x) => x.id === e.purchaseId);
                  const it = item(e);
                  return (
                    <View key={e.id} style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.text, { color: C.sub }]}>{e.name}</Text>
                        {it && <Text style={s.small}>次は{md(nextDate(it, state.purchases))}ごろ</Text>}
                      </View>
                      {p && (
                        <Pressable onPress={() => askDate('いつ買いましたか？', day, (date) => update((st) => ({ ...st, purchases: st.purchases.map((x) => (x.id === p.id ? { ...x, date } : x)) })))} hitSlop={6}>
                          <Text style={s.link}>{p.date === day ? '今日' : md(p.date)} ▾</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => update((st) => uncheckEntry(st, e.id))} hitSlop={6}>
                        <Text style={s.link}>戻す</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
