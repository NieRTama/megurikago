import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { ICONS } from './icons.generated';
import { photoUri, smooth, toggleIconOff, useStore } from './store';
import { addDays, addStore, matchIcon, parseDateInput, type Item, type Tag } from './logic';

// 生成りと焦げ茶。やさしいベージュの地に生成りの面、色は「主色（茶）」と「もうすぐ（えんじ）」の2つだけ
export const C = {
  bg: '#F2ECE1',
  card: '#FBF8F2',
  ink: '#3A3128',
  sub: '#8C8174',
  line: '#E3DACB',
  main: '#7A5B40',
  mainSoft: '#ECE2D3',
  soon: '#9E3D33',
  soonSoft: '#F3E1DA',
  danger: '#9E3D33',
};

export { smooth };

/** 押したときに少し沈ませる */
export const press = ({ pressed }: { pressed: boolean }) => pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] };

/** めぐりの線: 前回の購入から次回までの経過。近づくと真鍮色で満ちる */
export function RhythmBar({ progress, soon }: { progress: number; soon: boolean }) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden', alignSelf: 'stretch' }}>
      <View style={{ width: `${p * 100}%`, height: 3, backgroundColor: soon ? C.soon : C.main }} />
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => (smooth(), onPress())} style={(st) => [s.chip, on && s.chipOn, press(st)]} accessibilityRole="button" accessibilityState={{ selected: on }}>
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
  addable,
}: {
  tags: Tag[];
  value?: string;
  onChange: (id?: string) => void;
  allLabel: string;
  style?: StyleProp<ViewStyle>;
  /** 最後に［＋］を出し、お店を登録して選ぶ */
  addable?: boolean;
}) {
  const { state, update } = useStore();
  const add = () =>
    Alert.prompt('お店を追加', '例: コンビニ', (n) => {
      if (!n?.trim()) return;
      // 同じお店があればそれを選ぶ。新しい id は先に決めて、更新と選択で同じものを使う
      const [, id] = addStore(state, n);
      update((st) => addStore(st, n, id)[0]);
      smooth();
      onChange(id);
    });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      <Chip label={allLabel} on={!value} onPress={() => onChange(undefined)} />
      {tags.map((t) => (
        <Chip key={t.id} label={t.name} on={value === t.id} onPress={() => onChange(value === t.id ? undefined : t.id)} />
      ))}
      {addable && <Chip label="＋" onPress={add} />}
    </ScrollView>
  );
}

/** 品名に合ういらすとやがあるか（外していても true） */
export const hasIcon = (name: string) => !!matchIcon(name, ICONS);

/** 写真 → 品名に合ういらすとや（外した品を除く） → 頭文字。切り抜き（.png）といらすとやは余白をとって収める。棚を「元の写真」にしていれば photoOrig を優先 */
export function Thumb({ item, name, size }: { item?: Item; name: string; size: number }) {
  const { state, tick } = useStore();
  const { iconOff, shelfView, showPics } = state.settings;
  const key = item?.name ?? name; // 外したアイコンの照合キー。棚・リスト・拡大で同じ品は同じキーにする
  const style = { width: size, height: size, borderRadius: size * 0.28 };
  if (showPics === false)
    return (
      <View style={[style, s.initial]}>
        <Text style={{ fontSize: size * 0.4, color: C.main, fontWeight: '300' }}>{name.slice(0, 1)}</Text>
      </View>
    );
  const shown = item?.photo && shelfView === 'photo' && item.photoOrig ? item.photoOrig : item?.photo;
  if (shown && !shown.endsWith('.png')) return <Image key={tick} source={{ uri: photoUri(shown) }} style={style} />;
  const icon = shown ? { uri: photoUri(shown) } : iconOff.includes(key.trim()) ? undefined : matchIcon(key, ICONS);
  if (icon)
    return (
      <View style={[style, s.initial]}>
        <Image key={tick} source={icon} resizeMode="contain" style={{ width: size * 0.8, height: size * 0.8 }} />
      </View>
    );
  return (
    <View style={[style, s.initial]}>
      <Text style={{ fontSize: size * 0.4, color: C.main, fontWeight: '300' }}>{name.slice(0, 1)}</Text>
    </View>
  );
}

/** 押すと大きく見られる Thumb（買い物リスト用）。モーダルの下部で、いらすとやのアイコンを外す／戻す */
export function ZoomThumb({ item, name, memo, shop, size }: { item?: Item; name: string; memo?: string; shop?: string; size: number }) {
  const [open, setOpen] = useState(false);
  const { state, update } = useStore();
  const { width } = useWindowDimensions();
  const key = item?.name ?? name;
  const off = state.settings.iconOff.includes(key.trim());
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} accessibilityLabel={`${name}の画像を拡大`}>
        <Thumb item={item} name={name} size={size} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.zoomCard} onPress={() => {}}>
            <Thumb item={item} name={name} size={Math.min(width * 0.7, 320)} />
            <Text style={{ fontSize: 22, fontWeight: '700', color: C.ink }}>{name}</Text>
            {!!memo && <Text style={s.small}>{memo}</Text>}
            {!!shop && <Text style={s.small}>{shop}</Text>}
            <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
              {!item?.photo && hasIcon(key) && <Button kind="ghost" label={off ? 'アイコンを戻す' : 'このアイコンを外す'} onPress={() => update((st) => toggleIconOff(st, key))} />}
              <Button label="閉じる" onPress={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function Button({ label, onPress, kind = 'main', disabled }: { label: string; onPress: () => void; kind?: 'main' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={(st) => [s.btn, kind === 'main' ? s.btnMain : s.btnGhost, press(st), disabled && { opacity: 0.4 }]}>
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

/** シートを閉じる ✕ */
export function CloseX({ onPress = () => router.back() }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel="閉じる" style={(st) => [{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.mainSoft, alignItems: 'center', justifyContent: 'center' }, press(st)]}>
      <Text style={{ fontSize: 15, color: C.ink, fontWeight: '600' }}>✕</Text>
    </Pressable>
  );
}

/** 横にスワイプすると右から［削除］が出る行。押すまで消えない。ライブラリを足さず横スクロールで作る */
export function SwipeRow({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} snapToOffsets={[0, 84]} snapToEnd={false} decelerationRate="fast">
        <View style={{ width: w || undefined }}>{children}</View>
        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="削除" style={(st) => [{ width: 84, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }, press(st)]}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>削除</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** 一時的なお店の札（点線）。音声で言った、登録していないお店 */
export function TempBadge() {
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: C.sub, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
      <Text style={{ fontSize: 11, color: C.sub }}>一時的</Text>
    </View>
  );
}

export const tagName = (tags: Tag[], id?: string) => tags.find((t) => t.id === id)?.name;

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, color: C.ink, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  h2: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, color: C.sub, paddingHorizontal: 20, marginTop: 26, marginBottom: 8 },
  // 一覧は iOS の設定画面のような「まとまり」。角丸は面ごとに変える（まとまり 16 / 入力 12 / タグ 丸）
  card: { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  text: { fontSize: 16, color: C.ink, letterSpacing: 0.1 },
  small: { fontSize: 13, color: C.sub, lineHeight: 19 },
  num: { fontVariant: ['tabular-nums'] },
  input: { backgroundColor: C.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink },
  chip: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.card },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 14, color: C.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(58,49,40,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  zoomCard: { backgroundColor: C.card, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8, alignSelf: 'stretch' },
  initial: { backgroundColor: C.mainSoft, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  btnMain: { backgroundColor: C.main },
  btnGhost: { backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  btnText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  link: { color: C.main, fontSize: 15, fontWeight: '600' },
});
