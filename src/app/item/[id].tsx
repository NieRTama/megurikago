import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addPurchase, addToList, deleteItem, deletePhoto, removeEntry, useStore } from '../../store';
import { addDays, areaOf, cycleOf, diffDays, lastPurchase, md, newId, nextDate, parseDateInput, SOON_DAYS } from '../../logic';
import { Button, C, press, RhythmBar, s, smooth, tagName, Thumb } from '../../ui';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, day, update } = useStore();
  const [asking, setAsking] = useState(false);
  const [recorded, setRecorded] = useState<string>();
  const item = state.items.find((i) => i.id === id);
  if (!item) return <Text style={[s.small, { padding: 24 }]}>この品は削除されました</Text>;

  const left = diffDays(day, nextDate(item, state.purchases));
  const last = lastPurchase(item, state.purchases);
  const entry = state.list.find((e) => e.itemId === item.id && !e.purchaseId);
  const history = state.purchases.filter((p) => p.itemId === item.id).sort((a, b) => b.date.localeCompare(a.date));
  const q = encodeURIComponent(item.name);
  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('開けませんでした', url));
  const others = [
    ...(state.settings.superUrl ? [['ネットスーパー', state.settings.superUrl.replace('{q}', q)]] : []),
    ...(item.url ? [['登録したリンク', item.url]] : []),
  ];

  const record = (date: string) => {
    const pid = newId();
    update((st) => addPurchase(st, { itemId: item.id, name: item.name, tagId: item.tagId, date }, pid));
    setRecorded(pid);
    smooth();
    setAsking(false);
  };
  const pickDate = () =>
    Alert.prompt('日付を入力', '例: 11/2', (v) => {
      const d = parseDateInput(v, day);
      if (!d || d > day) Alert.alert('日付が読めませんでした', '「11/2」のように、今日までの日付を入れてください。');
      else record(d);
    });

  const removePurchase = (pid: string, date: string) =>
    Alert.alert(`${md(date)}の購入を削除しますか？`, '削除すると次に買う日の目安も変わります。', [
      { text: 'やめる', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => // 紐づくリストの行も「未購入」に戻す
        update((st) => ({ ...st, purchases: st.purchases.filter((p) => p.id !== pid), list: st.list.map((e) => (e.purchaseId === pid ? { ...e, purchaseId: undefined, checkedOn: undefined } : e)) })) },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href={{ pathname: '/item/edit', params: { id: item.id } }} asChild>
              <Pressable hitSlop={8}>
                <Text style={s.link}>編集</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
        <Thumb item={item} name={item.name} size={160} />
        <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.5, color: C.ink }}>{item.name}</Text>
        <Text style={s.small}>{tagName(state.tags, item.tagId) ?? '店の指定なし'}</Text>
        <View style={{ alignSelf: 'stretch', paddingHorizontal: 40, gap: 8, marginTop: 6 }}>
          <Text style={[s.num, { textAlign: 'center', fontSize: 44, fontWeight: '200', letterSpacing: -1, color: left <= SOON_DAYS ? C.soon : C.ink }]}>
            {left <= 0 ? '今' : left}
            <Text style={{ fontSize: 15, fontWeight: '500', color: C.sub }}>{left <= 0 ? ' が買い時' : ' 日後'}</Text>
          </Text>
          <RhythmBar progress={1 - left / cycleOf(item, state.purchases)} soon={left <= SOON_DAYS} />
          <Text style={[s.small, { textAlign: 'center' }]}>
            {left < 0 ? `予定の${md(nextDate(item, state.purchases))}を${-left}日過ぎています` : `${md(nextDate(item, state.purchases))}ごろ`}
          </Text>
        </View>
        {!!item.memo && <Text style={[s.text, { paddingHorizontal: 24 }]}>{item.memo}</Text>}
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {entry ? (
          <View style={[s.row, s.card, { marginHorizontal: 0 }]}>
            <Text style={[s.text, { flex: 1 }]}>買い物リストに入っています</Text>
            <Pressable onPress={() => update((st) => removeEntry(st, entry.id))} hitSlop={6}>
              <Text style={s.link}>外す</Text>
            </Pressable>
          </View>
        ) : (
          <Button label="買い物リストに入れる" onPress={() => update((st) => addToList(st, { name: item.name, tagId: item.tagId, memo: '', itemId: item.id }))} />
        )}
      </View>

      <Text style={s.h2}>買った記録</Text>
      <View style={[s.card, { gap: 10 }]}>
        <View style={s.row}>
          <Text style={[s.text, { flex: 1 }]}>
            {last ? `前回 ${md(last)}　だいたい${cycleOf(item, state.purchases)}日ごと` : `まだ記録がありません（${item.cycleDays}日ごとで計算中）`}
          </Text>
          {!asking && (
            <Pressable onPress={() => (smooth(), setAsking(true))} hitSlop={6}>
              <Text style={s.link}>＋買った</Text>
            </Pressable>
          )}
        </View>
        {asking && (
          <View style={{ gap: 8 }}>
            <Text style={[s.text, { fontWeight: '600' }]}>いつ買いましたか？</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="今日" onPress={() => record(day)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button kind="ghost" label="きのう" onPress={() => record(addDays(day, -1))} />
              </View>
            </View>
            <Button kind="ghost" label="日付を選ぶ…" onPress={pickDate} />
            <Pressable onPress={() => (smooth(), setAsking(false))} hitSlop={6} style={{ alignSelf: 'center' }}>
              <Text style={s.small}>やめる</Text>
            </Pressable>
          </View>
        )}
        {recorded && history.some((p) => p.id === recorded) && (
          <View style={s.row}>
            <Text style={[s.small, { flex: 1 }]}>{md(history.find((p) => p.id === recorded)!.date)}に買ったと記録しました</Text>
            <Pressable
              onPress={() => {
                update((st) => ({ ...st, purchases: st.purchases.filter((p) => p.id !== recorded), list: st.list.map((e) => (e.purchaseId === recorded ? { ...e, purchaseId: undefined, checkedOn: undefined } : e)) }));
                setRecorded(undefined);
              }}>
              <Text style={s.link}>取り消す</Text>
            </Pressable>
          </View>
        )}
        {history.slice(0, 3).map((p) => (
          <View key={p.id} style={[s.row, s.divider, { paddingTop: 10 }]}>
            <Text style={[s.text, { flex: 1 }]}>{p.date.replaceAll('-', '/')}</Text>
            {state.cloud && !!p.by && <Text style={s.small}>{p.by}</Text>}
            <Pressable onPress={() => removePurchase(p.id, p.date)} hitSlop={6}>
              <Text style={[s.small, { color: C.danger }]}>削除</Text>
            </Pressable>
          </View>
        ))}
        {history.length > 3 && (
          <Link href={{ pathname: '/history', params: { item: item.id } }} asChild>
            <Pressable>
              <Text style={s.link}>購入履歴をすべて見る（{history.length}件）</Text>
            </Pressable>
          </Link>
        )}
      </View>

      <Pressable onPress={() => router.push(`/area?item=${item.id}`)} style={(p) => [StyleSheet.flatten([s.card, s.row, { marginTop: 16 }]), press(p)]}>
        <Text style={[s.small, { flex: 1 }]}>売り場</Text>
        <Text style={s.link}>{areaOf(item.name, item)} ›</Text>
      </Pressable>

      <Text style={s.h2}>ネットで探す</Text>
      <View style={[s.card, { gap: 12 }]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" label="Amazon で探す" onPress={() => open(`https://www.amazon.co.jp/s?k=${q}`)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" label="楽天で探す" onPress={() => open(`https://search.rakuten.co.jp/search/mall/${q}/`)} />
          </View>
        </View>
        {!!others.length && (
          <Pressable
            onPress={() =>
              others.length === 1
                ? open(others[0][1])
                : Alert.alert('ほかの店で探す', undefined, [...others.map(([label, url]) => ({ text: label, onPress: () => open(url) })), { text: 'やめる', style: 'cancel' as const }])
            }
            style={press}>
            <Text style={s.link}>ほかの店で探す ›</Text>
          </Pressable>
        )}
      </View>

      <View style={{ padding: 16, marginTop: 16 }}>
        <Button
          kind="danger"
          label="この品を削除"
          onPress={() =>
            Alert.alert(`${item.name}を削除しますか？`, '買った記録は購入履歴に残ります。', [
              { text: 'やめる', style: 'cancel' },
              {
                text: '削除',
                style: 'destructive',
                onPress: () => {
                  router.back();
                  if (item.photo) deletePhoto(item.photo);
                  if (item.photoOrig) deletePhoto(item.photoOrig);
                  update((st) => deleteItem(st, item.id));
                },
              },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}
