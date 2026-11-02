import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { photoUri } from './store';
import { addDays, parseDateInput, type Item, type Tag } from './logic';

export const C = {
  bg: '#F7F4EE',
  card: '#FFFFFF',
  ink: '#2B2A27',
  sub: '#8A857C',
  line: '#E6E0D6',
  main: '#2F6B4F',
  mainSoft: '#DDEBE2',
  soon: '#D9822B',
  soonSoft: '#FBE9D5',
  danger: '#C0392B',
};

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** 購入先タグの横スクロール。value=undefined は「すべて」/「指定なし」 */
export function TagBar({
  tags,
  value,
  onChange,
  allLabel,
  style,
}: {
  tags: Tag[];
  value?: string;
  onChange: (id?: string) => void;
  allLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      <Chip label={allLabel} on={!value} onPress={() => onChange(undefined)} />
      {tags.map((t) => (
        <Chip key={t.id} label={t.name} on={value === t.id} onPress={() => onChange(value === t.id ? undefined : t.id)} />
      ))}
    </ScrollView>
  );
}

/** 写真、なければ頭文字の丸 */
export function Thumb({ item, name, size }: { item?: Item; name: string; size: number }) {
  const style = { width: size, height: size, borderRadius: size * 0.22 };
  if (item?.photo) return <Image source={{ uri: photoUri(item.photo) }} style={style} />;
  return (
    <View style={[style, s.initial]}>
      <Text style={{ fontSize: size * 0.42, color: C.main, fontWeight: '700' }}>{name.slice(0, 1)}</Text>
    </View>
  );
}

export function Button({ label, onPress, kind = 'main', disabled }: { label: string; onPress: () => void; kind?: 'main' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, kind === 'main' ? s.btnMain : s.btnGhost, (pressed || disabled) && { opacity: 0.5 }]}>
      <Text style={[s.btnText, { color: kind === 'main' ? '#fff' : kind === 'danger' ? C.danger : C.main }]}>{label}</Text>
    </Pressable>
  );
}

/** 「いつ買いましたか？」今日 / きのう / 日付を入力（Alert.prompt は iOS のみ。iPhone 専用なので可） */
export function askDate(title: string, todayStr: string, onPick: (date: string) => void) {
  Alert.alert(title, undefined, [
    { text: '今日', onPress: () => onPick(todayStr) },
    { text: 'きのう', onPress: () => onPick(addDays(todayStr, -1)) },
    {
      text: '日付を入力…',
      onPress: () =>
        Alert.prompt('日付を入力', '例: 11/2', (v) => {
          const d = parseDateInput(v, todayStr);
          if (!d || d > todayStr) Alert.alert('日付が読めませんでした', '「11/2」のように、今日までの日付を入れてください。');
          else onPick(d);
        }),
    },
    { text: 'やめる', style: 'cancel' },
  ]);
}

export const tagName =(tags: Tag[], id?: string) => tags.find((t) => t.id === id)?.name;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  title: { fontSize: 28, fontWeight: '800', color: C.ink, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  h2: { fontSize: 15, fontWeight: '700', color: C.sub, paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 14, marginHorizontal: 16, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { fontSize: 16, color: C.ink },
  small: { fontSize: 13, color: C.sub },
  input: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.ink },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.main, borderColor: C.main },
  chipText: { fontSize: 14, color: C.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  initial: { backgroundColor: C.mainSoft, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  btnMain: { backgroundColor: C.main },
  btnGhost: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  btnText: { fontSize: 16, fontWeight: '700' },
  link: { color: C.main, fontSize: 15, fontWeight: '600' },
});
