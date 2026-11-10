import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { areaOf, superLink } from '../../logic';
import { removeEntry, useStore } from '../../store';
import { Button, C, press, s, TagBar, TempBadge, Thumb } from '../../ui';

const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('開けませんでした', url));

/** 買い物リストの「今回だけ」の品（いつもの品に登録していない行）の詳細 */
export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, update } = useStore();
  const e = state.list.find((x) => x.id === id);
  if (!e) return <Text style={[s.small, { padding: 24 }]}>この品はリストから外されました</Text>;
  const set = (p: { name?: string; memo?: string; tagId?: string }) => update((st) => ({ ...st, list: st.list.map((x) => (x.id === e.id ? { ...x, ...p } : x)) }));
  const tag = state.tags.find((t) => t.id === e.tagId);
  const q = encodeURIComponent(e.name);
  const [superName, superUrl] = superLink(state.settings.superUrl, e.name);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[s.card, s.row, { marginTop: 12, alignItems: 'flex-start' }]}>
        <Thumb name={e.name} size={96} />
        <View style={{ flex: 1, gap: 8 }}>
          <TextInput value={e.name} onChangeText={(name) => set({ name })} onEndEditing={() => !e.name.trim() && set({ name: '（名前なし）' })} style={{ fontSize: 22, fontWeight: '700', color: C.ink }} />
          <View style={[s.row, { gap: 6 }]}>
            <Text style={s.small}>{tag?.name ?? 'お店の指定なし'}</Text>
            {tag?.temp && <TempBadge />}
          </View>
          <Text style={s.small}>今回だけ</Text>
          <TextInput value={e.memo} onChangeText={(memo) => set({ memo })} placeholder="メモ（例: 2個）" style={s.input} />
        </View>
      </View>

      <Text style={s.h2}>お店</Text>
      <TagBar tags={state.tags.filter((t) => !t.temp || t.id === e.tagId)} value={e.tagId} onChange={(tagId) => set({ tagId })} allLabel="指定なし" style={{ flexGrow: 0 }} addable />

      <Pressable onPress={() => router.push(`/area?entry=${e.id}`)} style={(p) => [StyleSheet.flatten([s.card, s.row, { marginTop: 16 }]), press(p)]}>
        <Text style={[s.small, { flex: 1 }]}>売り場</Text>
        <Text style={s.link}>{areaOf(e.name, e)} ›</Text>
      </Pressable>

      <Text style={s.h2}>ネットで探す</Text>
      <View style={[s.card, { gap: 8 }]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" label="Amazon で探す" onPress={() => open(`https://www.amazon.co.jp/s?k=${q}`)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="ghost" label="楽天で探す" onPress={() => open(`https://search.rakuten.co.jp/search/mall/${q}/`)} />
          </View>
        </View>
        <Button kind="ghost" label={`${superName}で探す`} onPress={() => open(superUrl)} />
      </View>

      <View style={{ padding: 16, marginTop: 16 }}>
        <Button
          kind="danger"
          label="リストから外す"
          onPress={() =>
            Alert.alert(`${e.name}をリストから外しますか？`, undefined, [
              { text: 'やめる', style: 'cancel' },
              { text: '外す', style: 'destructive', onPress: () => (router.back(), update((st) => removeEntry(st, e.id))) },
            ])
          }
        />
      </View>
    </ScrollView>
  );
}
