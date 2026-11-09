import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { md, newId, type Purchase } from '../logic';
import { addPurchase, useStore } from '../store';
import { askDate, Button, C, Chip, s, tagName } from '../ui';

export default function History() {
  const { item: itemId } = useLocalSearchParams<{ item?: string }>();
  const { state, day, update } = useStore();
  const [q, setQ] = useState('');
  const [month, setMonth] = useState<string>();
  const item = itemId ? state.items.find((i) => i.id === itemId) : undefined;

  const all = [...state.purchases].filter((p) => !itemId || p.itemId === itemId).sort((a, b) => b.date.localeCompare(a.date));
  const months = [...new Set(all.map((p) => p.date.slice(0, 7)))];
  const shown = all.filter((p) => (!month || p.date.startsWith(month)) && (!q.trim() || p.name.includes(q.trim())));
  const byMonth = new Map<string, Purchase[]>();
  for (const p of shown) byMonth.set(p.date.slice(0, 7), [...(byMonth.get(p.date.slice(0, 7)) ?? []), p]);
  const ym = (m: string) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;

  const del = (p: Purchase) =>
    Alert.alert(`${p.name}（${md(p.date)}）を削除しますか？`, '削除すると次に買う日の目安も変わります。', [
      { text: 'やめる', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => update((x) => ({ ...x, purchases: x.purchases.filter((y) => y.id !== p.id), list: x.list.map((e) => (e.purchaseId === p.id ? { ...e, purchaseId: undefined, checkedOn: undefined } : e)) })) },
    ]);

  return (
    <SafeAreaView edges={['bottom']} style={s.screen}>
      {itemId && <Stack.Screen options={{ title: `${item?.name ?? ''}の購入履歴` }} />}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
        {!itemId && <TextInput value={q} onChangeText={setQ} placeholder="品名で探す" clearButtonMode="while-editing" style={[s.input, { marginHorizontal: 16, marginBottom: 10 }]} />}
        {months.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            <Chip label="すべて" on={!month} onPress={() => setMonth(undefined)} />
            {months.map((m) => (
              <Chip key={m} label={ym(m)} on={month === m} onPress={() => setMonth(month === m ? undefined : m)} />
            ))}
          </ScrollView>
        )}
        {!shown.length && <Text style={[s.small, { padding: 24, textAlign: 'center' }]}>{all.length ? '見つかりません' : 'まだ記録がありません'}</Text>}
        {[...byMonth].map(([m, ps]) => (
          <View key={m}>
            <Text style={s.h2}>
              {ym(m)}（{ps.length}件）
            </Text>
            <View style={[s.card, { paddingVertical: 4 }]}>
              {ps.map((p, i) => (
                <View key={p.id} style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.text}>{p.name}</Text>
                    <Text style={s.small}>{[tagName(state.tags, p.tagId), state.cloud && p.by].filter(Boolean).join('　')}</Text>
                  </View>
                  <Pressable onPress={() => askDate('いつ買いましたか？', day, (date) => update((x) => ({ ...x, purchases: x.purchases.map((y) => (y.id === p.id ? { ...y, date } : y)) })))} hitSlop={6}>
                    <Text style={s.link}>{p.date.replaceAll('-', '/')} ▾</Text>
                  </Pressable>
                  <Pressable onPress={() => del(p)} hitSlop={6}>
                    <Text style={[s.small, { color: C.danger }]}>削除</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      {item && (
        <View style={{ padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.bg }}>
          <Button label="＋ 購入を記録" onPress={() => askDate('いつ買いましたか？', day, (date) => update((x) => addPurchase(x, { itemId: item.id, name: item.name, tagId: item.tagId, date }, newId())))} />
        </View>
      )}
    </SafeAreaView>
  );
}
