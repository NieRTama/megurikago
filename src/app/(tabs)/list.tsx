import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addStore, areaOf, areaOrderFor, md, nextDate, type ListEntry, type Tag } from '../../logic';
import { checkEntry, removeEntry, uncheckEntry, useStore } from '../../store';
import { askDate, Button, C, press, s, smooth, SwipeRow, TagBar, tagName, TempBadge, ZoomThumb } from '../../ui';

export default function ShoppingList() {
  const { state, day, update } = useStore();
  const [tagId, setTagId] = useState<string>();
  const [byStore, setByStore] = useState(true);
  const [closed, setClosed] = useState<string[]>([]);
  const [pending, setPending] = useState<string[]>([]);
  const [showBought, setShowBought] = useState(true);

  const st = state.settings;
  const todo = state.list.filter((e) => !e.purchaseId && (!tagId || e.tagId === tagId));
  // 「ネットで探す」は /net と同じく、店の絞り込みに関係なく未購入すべて
  const netCount = state.list.filter((e) => !e.purchaseId).length;
  const bought = state.list.filter((e) => e.purchaseId);
  const item = (e: ListEntry) => state.items.find((i) => i.id === e.itemId);

  const check = (e: ListEntry) => {
    const run = () => {
      smooth();
      setPending((p) => [...p, e.id]);
      // 取り消し線を少し見せてから「今日買ったもの」へ移す
      setTimeout(() => {
        update((x) => checkEntry(x, e.id));
        setPending((p) => p.filter((y) => y !== e.id));
      }, 600);
    };
    if (st.checkHintShown) return run();
    update((x) => ({ ...x, settings: { ...x.settings, checkHintShown: true } }));
    Alert.alert('買ったらチェック', 'チェックすると購入日が記録され、次に買う日の目安が更新されます。間違えたときは「今日買ったもの」の［戻す］で元に戻せます。', [{ text: 'わかった', onPress: run }]);
  };

  // 一時的なお店も見出しに出す（TempBadge）。お店の指定なしは最後
  const groups: [string, ListEntry[], Tag | undefined][] = byStore
    ? [...state.tags.map((t) => [t.name, todo.filter((e) => e.tagId === t.id), t] as [string, ListEntry[], Tag | undefined]), ['お店の指定なし', todo.filter((e) => !tagName(state.tags, e.tagId)), undefined]]
    : [['', [...todo].sort((a, b) => a.addedAt - b.addedAt), undefined]];

  // 売り場順がオンなら、お店のまとまりの中を売り場ごとに分ける（見出し, 行）
  const blocks = (entries: ListEntry[], t?: Tag): [string | undefined, ListEntry[]][] => {
    if (!st.byArea || !byStore) return [[undefined, entries]];
    return areaOrderFor(st, t?.id)
      .map((a) => [a, entries.filter((e) => areaOf(e.name, item(e) ?? e) === a)] as [string, ListEntry[]])
      .filter(([, es]) => es.length);
  };

  const toggleArea = (on: boolean) => {
    smooth();
    update((x) => ({ ...x, settings: { ...x.settings, byArea: on, areaHintShown: x.settings.areaHintShown || on } }));
    if (on && !st.areaHintShown)
      Alert.alert('売り場の順に並べました', '並びはお店ごとに変えられます。いつものお店の売り場の順に合わせておくと、回りやすくなります。', [
        { text: 'このまま' },
        { text: '並びを見る', onPress: () => router.push('/stores?tab=area') },
      ]);
  };

  return (
    <SafeAreaView edges={['top']} style={s.screen}>
      <View style={[s.row, { paddingRight: 20, gap: 16 }]}>
        <Text style={[s.title, { flex: 1 }]}>買うもの</Text>
        <Pressable onPress={() => (smooth(), setByStore(!byStore))} hitSlop={8}>
          <Text style={s.link}>{byStore ? '店ごと' : '追加順'} ⇅</Text>
        </Pressable>
      </View>
      <TagBar tags={state.tags} value={tagId} onChange={setTagId} allLabel="すべての店" style={{ flexGrow: 0 }} addable />

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 140 }}>
        {byStore && (
          <View style={[s.row, { paddingHorizontal: 20, paddingTop: 12 }]}>
            <Text style={[s.text, { flex: 1 }]}>売り場順</Text>
            <Switch value={st.byArea} onValueChange={toggleArea} trackColor={{ true: C.main }} />
          </View>
        )}
        {!!netCount && (
          <Pressable onPress={() => router.push('/net')} style={(p) => [StyleSheet.flatten([s.card, s.row, { marginTop: 10, paddingVertical: 12, backgroundColor: C.mainSoft }]), press(p)]}>
            <Text style={[s.text, { flex: 1 }]}>ネットで探す（{netCount}件）</Text>
            <Text style={s.small}>›</Text>
          </Pressable>
        )}
        {!todo.length && (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 6 }}>
            <Text style={{ fontSize: 34, fontWeight: '200', color: C.main }}>✓</Text>
            <Text style={s.text}>{state.list.length ? '全部そろいました' : '買うものはまだありません'}</Text>
            <Text style={s.small}>下の［話して追加］［入力して追加］か、「いつもの」の［＋リストへ］で追加できます</Text>
          </View>
        )}
        {groups.map(([label, entries, tag]) =>
          entries.length ? (
            <View key={tag?.id ?? (label || 'all')}>
              {label ? (
                <Pressable onPress={() => (smooth(), setClosed(closed.includes(label) ? closed.filter((x) => x !== label) : [...closed, label]))} style={[s.row, { gap: 8 }]}>
                  <Text style={s.h2}>
                    {closed.includes(label) ? '▸' : '▾'} {label}（{entries.length}）
                  </Text>
                  {tag?.temp && (
                    // 押すと、このお店を登録して残すか聞く
                    <Pressable
                      style={{ marginTop: 18 }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${tag.name}を登録して残すか選ぶ`}
                      onPress={() =>
                        Alert.alert(`「${tag.name}」をお店として残しますか？`, '残さなければ、このお店の品がリストから無くなったときに消えます。残すと、ほかの画面のお店の選択肢にも出ます。', [
                          { text: 'このまま', style: 'cancel' },
                          { text: 'お店として残す', onPress: () => (smooth(), update((x) => addStore(x, tag.name)[0])) },
                        ])
                      }>
                      <TempBadge />
                    </Pressable>
                  )}
                </Pressable>
              ) : (
                <View style={{ height: 12 }} />
              )}
              {!closed.includes(label) && (
                <View style={[s.card, { paddingVertical: 4 }]}>
                  {blocks(entries, tag).map(([area, es], bi) => (
                    <View key={area ?? 'x'}>
                      {!!area && <Text style={[s.small, { fontWeight: '600', paddingTop: 10 }, !!bi && s.divider]}>{area}</Text>}
                      {es.map((e, i) => {
                        const done = pending.includes(e.id);
                        return (
                          <SwipeRow key={e.id} onDelete={() => (smooth(), update((x) => removeEntry(x, e.id)))}>
                          <Pressable
                            onPress={() => router.push(item(e) ? `/item/${e.itemId}` : `/entry/${e.id}`)}
                            onLongPress={() => Alert.alert(`${e.name}をリストから外しますか？`, undefined, [{ text: 'やめる', style: 'cancel' }, { text: '外す', style: 'destructive', onPress: () => update((x) => removeEntry(x, e.id)) }])}
                            style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
                            <ZoomThumb item={item(e)} name={e.name} memo={e.memo} shop={tagName(state.tags, e.tagId)} size={36} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.text, done && { textDecorationLine: 'line-through', color: C.sub }]}>{e.name}</Text>
                              {!!e.memo && <Text style={s.small}>{e.memo}</Text>}
                            </View>
                            {/* 丸だけがチェック。行のほかの部分は詳細へ */}
                            <Pressable onPress={() => !done && check(e)} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`${e.name}を買った`}>
                              <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: done ? C.main : C.sub, backgroundColor: done ? C.main : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                {done && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>✓</Text>}
                              </View>
                            </Pressable>
                          </Pressable>
                          </SwipeRow>
                        );
                      })}
                    </View>
                  ))}
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
                      <ZoomThumb item={it} name={e.name} memo={e.memo} shop={tagName(state.tags, e.tagId)} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.text, { color: C.sub }]}>{e.name}</Text>
                        {it && <Text style={s.small}>次は{md(nextDate(it, state.purchases))}ごろ</Text>}
                      </View>
                      {p && (
                        <Pressable onPress={() => askDate('いつ買いましたか？', day, (date) => update((x) => ({ ...x, purchases: x.purchases.map((y) => (y.id === p.id ? { ...y, date } : y)) })))} hitSlop={6}>
                          <Text style={s.link}>{p.date === day ? '今日' : md(p.date)} ▾</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={() => update((x) => uncheckEntry(x, e.id))} hitSlop={6}>
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

      {/* 下に固定。ネイティブのタブバーの高さは、この SafeAreaView が測る */}
      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
        <View style={[s.row, { padding: 12, gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" label="話して追加" onPress={() => router.push(tagId ? `/voice?tag=${tagId}` : '/voice')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="入力して追加" onPress={() => router.push(tagId ? `/add?tag=${tagId}` : '/add')} />
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
