import { router } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { superLink, type ListEntry } from '../logic';
import { checkEntry, useStore } from '../store';
import { C, press, s, smooth, tagName, Thumb } from '../ui';

const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('開けませんでした', url));

/** ネットで探す（下から出るシート）。買うものの未購入の品を、お店ごとにネットで探す */
export default function Net() {
  const { state, update } = useStore();
  const st = state.settings;
  const todo = state.list.filter((e) => !e.purchaseId);
  const groups: [string, ListEntry[]][] = [
    ...state.tags.map((t) => [t.name, todo.filter((e) => e.tagId === t.id)] as [string, ListEntry[]]),
    ['お店の指定なし', todo.filter((e) => !tagName(state.tags, e.tagId))],
  ].filter(([, es]) => es.length) as [string, ListEntry[]][];
  const hint = !st.netHintShown && !!todo.length;
  const hideHint = () => (smooth(), update((x) => ({ ...x, settings: { ...x.settings, netHintShown: true } })));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: 24, paddingBottom: 48 }}>
      <View style={[s.row, { paddingHorizontal: 20 }]}>
        <Text style={[s.text, { flex: 1, fontSize: 20, fontWeight: '700' }]}>ネットで探す</Text>
        <Pressable onPress={() => Alert.alert('ネットスーパー', `いまは「${superLink(st.superUrl, '')[0]}」で探します。よく使うネットスーパーは「わたし」の画面で変えられます。`)} hitSlop={8}>
          <Text style={s.small}>ネットスーパーについて</Text>
        </Pressable>
      </View>
      {!todo.length && <Text style={[s.small, { padding: 24, textAlign: 'center' }]}>探すものがありません</Text>}

      {groups.map(([label, es], gi) => (
        <View key={label}>
          <Text style={s.h2}>
            {label}　{es.length}件
          </Text>
          <View style={[s.card, { paddingVertical: 4 }]}>
            {es.map((e, i) => {
              const [superName, superUrl] = superLink(st.superUrl, e.name);
              return (
                <View key={e.id}>
                  <View style={[s.row, { paddingTop: 12, paddingBottom: 8 }, !!i && s.divider]}>
                    <Thumb item={state.items.find((x) => x.id === e.itemId)} name={e.name} size={40} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={s.text} numberOfLines={1}>
                        {e.name}
                      </Text>
                      <Pressable onPress={() => (smooth(), update((x) => checkEntry(x, e.id)))} hitSlop={6} style={[s.row, { gap: 6 }]} accessibilityRole="button">
                        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.sub }} />
                        <Text style={s.small}>買った</Text>
                      </Pressable>
                    </View>
                  </View>
                  {/* 3 つ並べると品名が狭くなるので、品名の下の段に置く */}
                  <View style={[s.row, { gap: 8, paddingBottom: 12, paddingLeft: 52 }]}>
                    {(
                      [
                        [superName, superUrl],
                        ['Amazon', `https://www.amazon.co.jp/s?k=${encodeURIComponent(e.name)}`],
                        ['楽天', `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(e.name)}/`],
                      ] as const
                    ).map(([label, url]) => (
                      <Pressable key={label} onPress={() => open(url)} style={(p) => [st2.btn, press(p)]}>
                        <Text style={[s.link, { fontSize: 13 }]}>{label} ↗</Text>
                      </Pressable>
                    ))}
                  </View>
                  {hint && !gi && !i && (
                    <View style={st2.hint}>
                      <Text style={{ color: C.card, fontSize: 14, lineHeight: 21 }}>
                        「{superName}」は、よく使うネットスーパーで探すリンクです。「わたし」の画面で、ほかのネットスーパーに変えられます。
                      </Text>
                      <View style={[s.row, { gap: 10 }]}>
                        <Pressable onPress={() => (hideHint(), router.back(), router.navigate('/me'))} style={(p) => [st2.hintBtn, press(p)]}>
                          <Text style={{ color: C.card, fontWeight: '600' }}>変える</Text>
                        </Pressable>
                        <Pressable onPress={hideHint} style={(p) => [st2.hintBtn, { backgroundColor: C.card }, press(p)]}>
                          <Text style={{ color: C.ink, fontWeight: '600' }}>わかった</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const st2 = StyleSheet.create({
  btn: { borderRadius: 999, borderWidth: 1, borderColor: C.main, paddingHorizontal: 12, paddingVertical: 7 },
  hint: { backgroundColor: C.ink, borderRadius: 14, padding: 14, gap: 12, marginBottom: 10 },
  hintBtn: { borderRadius: 999, borderWidth: 1, borderColor: C.card, paddingHorizontal: 16, paddingVertical: 7 },
});
