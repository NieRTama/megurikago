import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, LayoutAnimation, View } from 'react-native';
import { newId, notifyPlan, refresh, today, toDate, type ListEntry, type Purchase, type State } from './logic';

const KEY = 'state:v1';

const initial = (): State => ({
  version: 1,
  householdId: newId(),
  items: [],
  list: [],
  purchases: [],
  tags: [
    { id: newId(), name: 'スーパー' },
    { id: newId(), name: 'ドラッグストア' },
    { id: newId(), name: '100円ショップ' },
    { id: newId(), name: 'ネット' },
  ],
  settings: { notify: true, notifyDaysBefore: 7, notifyHour: 9, autoAdd: false, superUrl: '', checkHintShown: false },
});

type Ctx = { state: State; day: string; update: (fn: (s: State) => State) => void };
const StoreContext = createContext<Ctx | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('StoreProvider の外で useStore');
  return ctx;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** 予約を全部消して作り直す（日付ごとに1件・最大60件） */
async function reschedule(s: State) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!s.settings.notify || !s.items.length) return;
  // 許可は最初の品を登録したあとに1回だけ聞く（iOS は2回目以降ダイアログを出さない）
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return;
  const now = new Date();
  for (const { date, names } of notifyPlan(s, today(), now.getHours())) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'そろそろ買う時期です',
        body: names.length > 3 ? `${names.slice(0, 3).join('、')} ほか${names.length - 3}品` : names.join('、'),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: toDate(date, s.settings.notifyHour) },
    });
  }
}

let scheduling = Promise.resolve();

// 「視差効果を減らす」がオンなら動かさない
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion = v));
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => (reduceMotion = v));

/** 次の再描画で並びや高さの変化を滑らかに動かす（RN 標準の LayoutAnimation） */
export const smooth = () => !reduceMotion && LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [day, setDay] = useState(today);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((json) => setState(refresh(json ? (JSON.parse(json) as State) : initial(), today())))
      .catch((e) => Alert.alert('データを読み込めませんでした', String(e)));
    // 日付が変わってから前面に戻ったときも「今日買ったもの」や自動追加をやり直す
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      setDay(today());
      setState((s) => s && refresh(s, today()));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!state) return;
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch((e) => Alert.alert('保存できませんでした', String(e)));
    // ponytail: 変更のたびに全予約を作り直す。品が数百を超えて重くなったら差分予約にする
    // 前の作り直しが終わってから次を始める（並ぶと消す→予約が交互になり重複する）
    const t = setTimeout(() => (scheduling = scheduling.then(() => reschedule(state)).catch(() => {})), 500);
    return () => clearTimeout(t);
  }, [state, day]);

  if (!state) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  const update = (fn: (s: State) => State) => {
    smooth();
    setState((s) => (s ? fn(s) : s));
  };
  return <StoreContext.Provider value={{ state, day, update }}>{children}</StoreContext.Provider>;
}

// ---- 状態を変える操作（純粋関数。update(s => ...) に渡す） ----

export const addToList = (s: State, e: Omit<ListEntry, 'id' | 'addedAt'>, id = newId()): State => ({
  ...s,
  list: [...s.list, { ...e, id, addedAt: Date.now() }],
});

export const addPurchase = (s: State, p: Omit<Purchase, 'id'>, id = newId()): State => ({ ...s, purchases: [...s.purchases, { ...p, id }] });

/** リストの行をチェック: 購入を記録して行に紐付ける */
export function checkEntry(s: State, entryId: string): State {
  const e = s.list.find((x) => x.id === entryId);
  if (!e || e.purchaseId) return s;
  const p: Purchase = { id: newId(), itemId: e.itemId, name: e.name, tagId: e.tagId, date: today() };
  return {
    ...s,
    purchases: [...s.purchases, p],
    list: s.list.map((x) => (x.id === entryId ? { ...x, purchaseId: p.id, checkedOn: p.date } : x)),
  };
}

/** チェックを戻す: 記録した購入も消す */
export function uncheckEntry(s: State, entryId: string): State {
  const e = s.list.find((x) => x.id === entryId);
  return {
    ...s,
    purchases: s.purchases.filter((p) => p.id !== e?.purchaseId),
    list: s.list.map((x) => (x.id === entryId ? { ...x, purchaseId: undefined, checkedOn: undefined } : x)),
  };
}

export const removeEntry = (s: State, entryId: string): State => ({ ...s, list: s.list.filter((x) => x.id !== entryId) });

export function deleteItem(s: State, itemId: string): State {
  return {
    ...s,
    items: s.items.filter((i) => i.id !== itemId),
    list: s.list.filter((e) => e.itemId !== itemId || e.purchaseId),
    // 履歴は品名つきで残す（購入履歴の画面に出る）
    purchases: s.purchases.map((p) => (p.itemId === itemId ? { ...p, itemId: undefined } : p)),
  };
}

// ---- 写真（documentDirectory にファイル名で保存） ----

export const photoUri = (name: string) => new File(Paths.document, name).uri;

export function deletePhoto(name: string) {
  try {
    new File(Paths.document, name).delete();
  } catch {
    // すでに無い
  }
}

/** 撮る/選ぶ → 正方形に切り取ってコピー。キャンセルなら undefined */
export async function pickPhoto(camera: boolean): Promise<string | undefined> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(camera ? 'カメラを使えません' : '写真を開けません', '設定アプリでアクセスを許可してください。');
    return;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return;
  const name = `${newId()}.jpg`;
  await new File(res.assets[0].uri).copy(new File(Paths.document, name));
  return name;
}
