import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { s } from '../ui';

const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('開けませんでした', url));

/** 買い物リストの未購入の品ごとに、ネットの検索を開く */
export default function Net() {
  const { state } = useStore();
  const todo = state.list.filter((e) => !e.purchaseId);
  const superUrl = state.settings.superUrl;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48, paddingTop: 12 }}>
      {!todo.length && <Text style={[s.small, { padding: 24, textAlign: 'center' }]}>探すものがありません</Text>}
      {!!todo.length && (
        <View style={[s.card, { paddingVertical: 4 }]}>
          {todo.map((e, i) => {
            const q = encodeURIComponent(e.name);
            return (
              <View key={e.id} style={[{ paddingVertical: 12, gap: 8 }, !!i && s.divider]}>
                <Text style={s.text}>{e.name}</Text>
                <View style={[s.row, { gap: 16 }]}>
                  <Pressable onPress={() => open(`https://www.amazon.co.jp/s?k=${q}`)} hitSlop={6}>
                    <Text style={s.link}>Amazon ›</Text>
                  </Pressable>
                  <Pressable onPress={() => open(`https://search.rakuten.co.jp/search/mall/${q}/`)} hitSlop={6}>
                    <Text style={s.link}>楽天 ›</Text>
                  </Pressable>
                  {!!superUrl && (
                    <Pressable onPress={() => open(superUrl.replace('{q}', q))} hitSlop={6}>
                      <Text style={s.link}>ネットスーパー ›</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
