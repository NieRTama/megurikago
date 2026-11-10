import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { areaOf, AREAS } from '../logic';
import { useStore } from '../store';
import { C, press, s } from '../ui';

/** 売り場を選ぶ（下から出るシート）。?item=<品の id> か ?entry=<リストの行の id> */
export default function AreaPicker() {
  const { item: itemId, entry: entryId } = useLocalSearchParams<{ item?: string; entry?: string }>();
  const { state, update } = useStore();
  const target = itemId ? state.items.find((x) => x.id === itemId) : state.list.find((x) => x.id === entryId);
  if (!target) return null;
  const suggested = areaOf(target.name);
  const current = areaOf(target.name, target);
  const pick = (area?: string) => {
    update((st) =>
      itemId
        ? { ...st, items: st.items.map((x) => (x.id === itemId ? { ...x, area } : x)) }
        : { ...st, list: st.list.map((x) => (x.id === entryId ? { ...x, area } : x)) },
    );
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.card }}>
      <View style={{ padding: 20, paddingBottom: 12, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
        <Text style={[s.text, { fontSize: 19, fontWeight: '700' }]}>売り場を選ぶ</Text>
        <Pressable onPress={() => pick(undefined)} disabled={!target.area} hitSlop={6}>
          <Text style={[s.link, !target.area && { color: C.sub }]}>おすすめに戻す</Text>
          <Text style={s.small}>おすすめ: {suggested}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {AREAS.map((a) => (
          <Pressable key={a} onPress={() => pick(a === suggested ? undefined : a)} style={(p) => [s.row, { paddingHorizontal: 20, paddingVertical: 15 }, press(p)]} accessibilityRole="button" accessibilityState={{ selected: a === current }}>
            <Text style={[s.text, { flex: 1 }, a === current && { fontWeight: '700', color: C.main }]}>{a}</Text>
            {a === current && <Text style={{ color: C.main, fontSize: 18, fontWeight: '700' }}>✓</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
