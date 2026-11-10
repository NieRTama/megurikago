import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../store';
import { C } from '../../ui';

// iOS 標準の浮いたタブバーは大きさを変えられないので、同じ浮いた丸い形を大きめに自前で描く。
// 画面の上に重ねず下に置くので、各画面の下の余白はそのままでよい
export default function TabsLayout() {
  const { state } = useStore();
  const insets = useSafeAreaInsets();
  const left = state.list.filter((e) => !e.purchaseId).length;
  return (
    <Tabs style={{ backgroundColor: C.bg }}>
      <TabSlot />
      <TabList style={[st.bar, { marginBottom: Math.max(insets.bottom - 6, 10) }]}>
        <TabTrigger name="index" href="/" asChild>
          <Tab icon="square.grid.2x2" label="いつもの" />
        </TabTrigger>
        <TabTrigger name="list" href="/list" asChild>
          <Tab icon="checklist" label="買うもの" badge={left} />
        </TabTrigger>
        <TabTrigger name="me" href="/me" asChild>
          <Tab icon="person.crop.circle" label="わたし" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

// React 19 なので ref はふつうの props として受け取れる（TabTrigger の asChild が渡す）
function Tab({ isFocused, icon, label, badge, ref, ...props }: TabTriggerSlotProps & { icon: SFSymbol; label: string; badge?: number }) {
  const color = isFocused ? C.main : C.sub;
  return (
    <Pressable ref={ref as never} {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={({ pressed }) => [st.tab, isFocused && { backgroundColor: C.mainSoft }, pressed && { opacity: 0.7 }]}>
      <View>
        <SymbolView name={icon} tintColor={color} size={28} weight={isFocused ? 'semibold' : 'regular'} />
        {!!badge && (
          <View style={st.badge}>
            <Text style={st.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 13, fontWeight: isFocused ? '700' : '500', color }}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 6,
    padding: 6,
    borderRadius: 40,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    shadowColor: C.ink,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: 66, borderRadius: 34 },
  badge: { position: 'absolute', top: -6, right: -14, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: C.soon, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
