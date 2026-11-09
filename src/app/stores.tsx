import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { addStore, areaOrderFor, realTags } from '../logic';
import { useStore } from '../store';
import { C, Chip, s, smooth } from '../ui';

/** お店の並び・名前と、お店ごとの売り場の順（この端末だけ） */
export default function Stores() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { state, update } = useStore();
  const [mode, setMode] = useState<'store' | 'area'>(tab === 'area' ? 'area' : 'store');
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string>();
  const tags = realTags(state.tags);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    update((x) => addStore(x, n)[0]);
    setName('');
  };

  // 一時的なお店が間に混ざっていても、見えているお店どうしだけを入れ替える
  const moveTag = (i: number, d: number) =>
    update((x) => {
      const real = realTags(x.tags);
      const a = x.tags.indexOf(real[i]);
      const b = x.tags.indexOf(real[i + d]);
      const next = [...x.tags];
      [next[a], next[b]] = [next[b], next[a]];
      return { ...x, tags: next };
    });

  const setOrder = (tagId: string, order?: string[]) =>
    update((x) => {
      const { [tagId]: _, ...rest } = x.settings.areaOrder;
      return { ...x, settings: { ...x.settings, areaOrder: order ? { ...rest, [tagId]: order } : rest } };
    });

  const moveArea = (tagId: string, i: number, d: number) => {
    const order = areaOrderFor(state.settings, tagId);
    [order[i], order[i + d]] = [order[i + d], order[i]];
    smooth();
    setOrder(tagId, order);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48, paddingTop: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[s.row, { paddingHorizontal: 16, marginBottom: 8 }]}>
        <Chip label="お店" on={mode === 'store'} onPress={() => setMode('store')} />
        <Chip label="売り場の順" on={mode === 'area'} onPress={() => setMode('area')} />
      </View>

      {mode === 'store' ? (
        <>
          <View style={[s.row, { paddingHorizontal: 16, marginTop: 8 }]}>
            <TextInput value={name} onChangeText={setName} onSubmitEditing={add} placeholder="お店を追加（例: コンビニ）" returnKeyType="done" style={[s.input, { flex: 1 }]} />
            <Pressable onPress={add} disabled={!name.trim()} hitSlop={8}>
              <Text style={[s.link, !name.trim() && { color: C.sub }]}>追加</Text>
            </Pressable>
          </View>
          <Text style={s.h2}>並び順はリストの見出し順です</Text>
          <View style={[s.card, { paddingVertical: 4 }]}>
            {tags.map((t, i) => (
              <View key={t.id} style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
                <Pressable style={{ flex: 1 }} onPress={() => Alert.prompt('名前を変える', undefined, (n) => n.trim() && update((x) => ({ ...x, tags: x.tags.map((y) => (y.id === t.id ? { ...y, name: n.trim() } : y)) })), 'plain-text', t.name)}>
                  <Text style={s.text}>{t.name}</Text>
                </Pressable>
                <Pressable disabled={!i} onPress={() => moveTag(i, -1)} hitSlop={6} accessibilityLabel="上へ">
                  <Text style={[s.link, !i && { color: C.line }]}>↑</Text>
                </Pressable>
                <Pressable disabled={i === tags.length - 1} onPress={() => moveTag(i, 1)} hitSlop={6} accessibilityLabel="下へ">
                  <Text style={[s.link, i === tags.length - 1 && { color: C.line }]}>↓</Text>
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() =>
                    Alert.alert(`「${t.name}」を削除しますか？`, 'このお店の品は「指定なし」になります。', [
                      { text: 'やめる', style: 'cancel' },
                      { text: '削除', style: 'destructive', onPress: () => update((x) => ({ ...x, tags: x.tags.filter((y) => y.id !== t.id) })) },
                    ])
                  }>
                  <Text style={[s.small, { color: C.danger }]}>削除</Text>
                </Pressable>
              </View>
            ))}
            <View style={[s.row, { paddingVertical: 12 }, !!tags.length && s.divider]}>
              <Text style={[s.text, { flex: 1, color: C.sub }]}>お店の指定なし</Text>
              <Text style={s.small}>いつも最後</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={s.h2}>お店を押すと、そのお店の売り場の順を変えられます（この端末だけ）</Text>
          {!tags.length && <Text style={[s.small, { paddingHorizontal: 20 }]}>先に「お店」で登録してください</Text>}
          {tags.map((t) => {
            const order = areaOrderFor(state.settings, t.id);
            const on = open === t.id;
            return (
              <View key={t.id} style={[s.card, { paddingVertical: 4, marginBottom: 8 }]}>
                <Pressable onPress={() => (smooth(), setOpen(on ? undefined : t.id))} style={[s.row, { paddingVertical: 12 }]}>
                  <Text style={[s.text, { flex: 1 }]}>{t.name}</Text>
                  <Text style={s.small}>{state.settings.areaOrder[t.id] ? '変更あり' : '最初の順'} {on ? '▾' : '▸'}</Text>
                </Pressable>
                {on && (
                  <>
                    {order.map((a, i) => (
                      <View key={a} style={[s.row, { paddingVertical: 10 }, s.divider]}>
                        <Text style={[s.text, { flex: 1 }]}>{a}</Text>
                        <Pressable disabled={!i} onPress={() => moveArea(t.id, i, -1)} hitSlop={6} accessibilityLabel="上へ">
                          <Text style={[s.link, !i && { color: C.line }]}>↑</Text>
                        </Pressable>
                        <Pressable disabled={i === order.length - 1} onPress={() => moveArea(t.id, i, 1)} hitSlop={6} accessibilityLabel="下へ">
                          <Text style={[s.link, i === order.length - 1 && { color: C.line }]}>↓</Text>
                        </Pressable>
                      </View>
                    ))}
                    {!!state.settings.areaOrder[t.id] && (
                      <Pressable onPress={() => (smooth(), setOrder(t.id))} style={[{ paddingVertical: 12 }, s.divider]}>
                        <Text style={s.link}>最初の順に戻す</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
