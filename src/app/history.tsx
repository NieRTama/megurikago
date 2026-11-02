import { ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { s, tagName } from '../ui';

export default function History() {
  const { state } = useStore();
  const byDate = new Map<string, typeof state.purchases>();
  for (const p of [...state.purchases].sort((a, b) => b.date.localeCompare(a.date))) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
      {!byDate.size && <Text style={[s.small, { padding: 24, textAlign: 'center' }]}>まだ記録がありません</Text>}
      {[...byDate].map(([date, ps]) => (
        <View key={date}>
          <Text style={s.h2}>{date.replaceAll('-', '/')}</Text>
          <View style={[s.card, { paddingVertical: 4 }]}>
            {ps.map((p, i) => (
              <View key={p.id} style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
                <Text style={[s.text, { flex: 1 }]}>{p.name}</Text>
                <Text style={s.small}>{tagName(state.tags, p.tagId) ?? ''}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
