import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { addPurchase, addToList, deleteItem, deletePhoto, removeEntry, useStore } from '../../store';
import { cycleOf, diffDays, lastPurchase, md, newId, nextDate } from '../../logic';
import { askDate, Button, C, s, tagName, Thumb } from '../../ui';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, day, update } = useStore();
  const [allHistory, setAllHistory] = useState(false);
  const [recorded, setRecorded] = useState<string>();
  const item = state.items.find((i) => i.id === id);
  if (!item) return <Text style={[s.small, { padding: 24 }]}>この品は削除されました</Text>;

  const left = diffDays(day, nextDate(item, state.purchases));
  const last = lastPurchase(item, state.purchases);
  const entry = state.list.find((e) => e.itemId === item.id && !e.purchaseId);
  const history = state.purchases.filter((p) => p.itemId === item.id).sort((a, b) => b.date.localeCompare(a.date));
  const q = encodeURIComponent(item.name);
  const shops = [
    ['Amazon', `https://www.amazon.co.jp/s?k=${q}`],
    ['楽天市場', `https://search.rakuten.co.jp/search/mall/${q}/`],
    ...(state.settings.superUrl ? [['ネットスーパー', state.settings.superUrl.replace('{q}', q)]] : []),
    ...(item.url ? [['登録したリンク', item.url]] : []),
  ];

  const record = () =>
    askDate('いつ買いましたか？', day, (date) => {
      const pid = newId();
      update((st) => addPurchase(st, { itemId: item.id, name: item.name, tagId: item.tagId, date }, pid));
      setRecorded(pid);
    });

  const removePurchase = (pid: string, date: string) =>
    Alert.alert(`${md(date)}の購入を削除しますか？`, '削除すると次に買う日の目安も変わります。', [
      { text: 'やめる', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => update((st) => ({ ...st, purchases: st.purchases.filter((p) => p.id !== pid) })) },
    ]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
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
        <Text style={{ fontSize: 24, fontWeight: '800', color: C.ink }}>{item.name}</Text>
        <Text style={s.small}>{tagName(state.tags, item.tagId) ?? '店の指定なし'}</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: left <= 7 ? C.soon : C.main }}>
          {left <= 0 ? `次に買う日を${-left}日過ぎています` : `次に買うのは あと${left}日（${md(nextDate(item, state.purchases))}ごろ）`}
        </Text>
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
          <Pressable onPress={record} hitSlop={6}>
            <Text style={s.link}>＋買った</Text>
          </Pressable>
        </View>
        {recorded && history.some((p) => p.id === recorded) && (
          <View style={s.row}>
            <Text style={[s.small, { flex: 1 }]}>{md(history.find((p) => p.id === recorded)!.date)}に買ったと記録しました</Text>
            <Pressable
              onPress={() => {
                update((st) => ({ ...st, purchases: st.purchases.filter((p) => p.id !== recorded) }));
                setRecorded(undefined);
              }}>
              <Text style={s.link}>取り消す</Text>
            </Pressable>
          </View>
        )}
        {(allHistory ? history : history.slice(0, 3)).map((p) => (
          <View key={p.id} style={[s.row, { borderTopWidth: 1, borderColor: C.line, paddingTop: 8 }]}>
            <Text style={[s.text, { flex: 1 }]}>{p.date.replaceAll('-', '/')}</Text>
            <Pressable onPress={() => removePurchase(p.id, p.date)} hitSlop={6}>
              <Text style={[s.small, { color: C.danger }]}>削除</Text>
            </Pressable>
          </View>
        ))}
        {history.length > 3 && (
          <Pressable onPress={() => setAllHistory(!allHistory)}>
            <Text style={s.link}>{allHistory ? '閉じる' : `すべて見る（${history.length}件）`}</Text>
          </Pressable>
        )}
      </View>

      <Text style={s.h2}>ネットで探す</Text>
      <View style={[s.card, { gap: 12 }]}>
        {shops.map(([label, url]) => (
          <Pressable key={label} onPress={() => Linking.openURL(url).catch(() => Alert.alert('開けませんでした', url))}>
            <Text style={s.link}>{label}で開く ›</Text>
          </Pressable>
        ))}
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
