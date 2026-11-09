import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { notifySummary, type Settings } from '../logic';
import { useStore } from '../store';
import { C, s } from '../ui';

export default function Notify() {
  const { state, update } = useStore();
  const [allowed, setAllowed] = useState(true);
  const st = state.settings;
  const setS = (patch: Partial<Settings>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  useFocusEffect(
    useCallback(() => {
      Notifications.getPermissionsAsync().then((p) => setAllowed(p.granted || p.canAskAgain));
    }, []),
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48, paddingTop: 12 }}>
      {st.notify && !allowed && (
        <Pressable onPress={() => Linking.openSettings()} style={[s.card, { backgroundColor: C.soonSoft, gap: 4, marginBottom: 12 }]}>
          <Text style={[s.text, { fontWeight: '700' }]}>通知がオフになっています</Text>
          <Text style={s.small}>買う時期のお知らせを受け取るには、設定アプリで通知を許可してください ›</Text>
        </Pressable>
      )}
      <View style={[s.card, { marginBottom: 8 }]}>
        <Text style={s.small}>{notifySummary(st, allowed)}</Text>
      </View>
      <View style={[s.card, { gap: 14 }]}>
        <View style={s.row}>
          <Text style={[s.text, { flex: 1 }]}>買う時期を通知する</Text>
          <Switch value={st.notify} onValueChange={(notify) => setS({ notify })} trackColor={{ true: C.main }} />
        </View>
        <Stepper label="何日前に知らせる" value={st.notifyDaysBefore} unit="日前" min={0} max={30} onChange={(notifyDaysBefore) => setS({ notifyDaysBefore })} />
        <Stepper label="通知の時刻" value={st.notifyHour} unit="時" min={5} max={22} onChange={(notifyHour) => setS({ notifyHour })} />
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>近づいたらリストに自動で入れる</Text>
            <Text style={s.small}>オフのときは通知だけ</Text>
          </View>
          <Switch value={st.autoAdd} onValueChange={(autoAdd) => setS({ autoAdd })} trackColor={{ true: C.main }} />
        </View>
      </View>
    </ScrollView>
  );
}

function Stepper({ label, value, unit, min, max, onChange }: { label: string; value: number; unit: string; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={s.row}>
      <Text style={[s.text, { flex: 1 }]}>{label}</Text>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} hitSlop={8} accessibilityLabel="減らす">
        <Text style={[s.link, { fontSize: 22 }]}>−</Text>
      </Pressable>
      <Text style={[s.text, { minWidth: 56, textAlign: 'center' }]}>
        {value}
        {unit}
      </Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} hitSlop={8} accessibilityLabel="増やす">
        <Text style={[s.link, { fontSize: 22 }]}>＋</Text>
      </Pressable>
    </View>
  );
}
