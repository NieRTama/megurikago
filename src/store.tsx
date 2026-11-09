import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, LayoutAnimation, View } from 'react-native';
import { fetchPhotos, listen, push } from './cloud';
import { diffShared, docJson, dropTempTags, mergeFirst, mergeRemote, newId, newPhotoNames, notifyPlan, photoNames, refresh, sharedPart, today, toDate, validPhoto, type ListEntry, type Purchase, type Shared, type State } from './logic';
import { liftSubject, setWidgetData } from './native';

const KEY = 'state:v1';
// 前回クラウドにあった文書のキー → JSON（グループごと）。起動時にクラウド・手元と 3 者比較して、オフライン中の変更・削除を失わないために使う
const SYNCED = (hid: string) => `synced:${hid}`;
export const forgetSynced = (hid: string) => AsyncStorage.removeItem(SYNCED(hid)).catch(() => {});

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
  settings: { notify: true, notifyDaysBefore: 7, notifyHour: 9, autoAdd: false, superUrl: '', checkHintShown: false, aiPhoto: false, aiVoice: false, iconOff: [], shelfView: 'cutout', showPics: true, byArea: false, areaHintShown: false, areaOrder: {} },
});

/** 古いデータや書き出しに無い設定項目を既定値で埋める（項目を足しても落ちないように） */
export const withDefaults = (s: State): State => ({ ...s, settings: { ...initial().settings, ...s.settings } });

/** tick: 共有された写真を取り込むたびに増える（画像を読み直させる） */
type Ctx = { state: State; day: string; tick: number; update: (fn: (s: State) => State) => void };
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
  const [tick, setTick] = useState(0);
  // 前回クラウドと突き合わせた共有分。これとの差分だけを送る（取り込んだ分は含めるので送り返さない）。同期が始まるまでは undefined
  const base = useRef<Shared>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((json) => setState(refresh(withDefaults(json ? (JSON.parse(json) as State) : initial()), today())))
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

  // 家族グループ参加中だけクラウドとつなぐ（hid が無ければ Firebase には触れない）
  const hid = state?.cloud?.hid;
  useEffect(() => {
    if (!hid) return;
    let dead = false;
    let stop = () => {};
    AsyncStorage.getItem(SYNCED(hid))
      .then((j) => {
        const o = j ? JSON.parse(j) : {};
        return new Map<string, string>(Array.isArray(o) ? [] : Object.entries(o)); // 配列は古い形式（キーだけ）。比べ元にならないので捨てる
      })
      .catch(() => new Map<string, string>())
      .then((synced) => {
        if (dead) return;
        stop = listen(
          hid,
          (remote, first, confirmed) => {
            setState((s) => {
              if (!s) return s;
              const n = first ? refresh(mergeFirst(s, remote, synced), today()) : mergeRemote(s, remote);
              // 最初はクラウドの中身を比べ元にして、手元にしかない分を差分として送らせる。以後は取り込んだ結果が比べ元
              base.current = first ? remote : sharedPart(n);
              return n;
            });
            if (confirmed) AsyncStorage.setItem(SYNCED(hid), JSON.stringify(docJson(remote))).catch(() => {});
            const miss = photoNames(remote.items).filter((n) => !new File(Paths.document, n).exists);
            if (miss.length) fetchPhotos(hid, miss).then((wrote) => wrote && !dead && setTick((t) => t + 1)).catch(() => {});
          },
          (e) => {
            if ((e as { code?: string })?.code !== 'permission-denied') return;
            // グループから外された（または古い端末）。手元のデータは残し、以後はクラウドに送らない
            stop();
            forgetSynced(hid);
            setState((s) => (s?.cloud?.hid === hid ? { ...s, cloud: undefined } : s));
            Alert.alert('家族グループから外されました', '手元のデータはそのまま残っています。入り直すには「わたし」タブの「家族と共有・バックアップ」から、コードで参加してください。');
          },
        );
      });
    return () => {
      dead = true;
      stop();
      base.current = undefined;
    };
  }, [hid]);

  // 手元の変更を送る（private の品とその購入・リスト行は含めない）
  useEffect(() => {
    if (!state || !hid || !base.current) return;
    const next = sharedPart(state);
    const changes = diffShared(base.current, next);
    if (!changes.length) return;
    const photos = newPhotoNames(base.current, next);
    base.current = next;
    push(hid, changes, photos).catch((e) => console.warn('クラウドへ送れませんでした', e));
  }, [state, hid]);

  // ウィジェットには未購入の品を最大6件。リストと店名が変わったときだけ渡す
  const list = state?.list;
  const tags = state?.tags;
  useEffect(() => {
    if (!list || !tags) return;
    const todo = list.filter((e) => !e.purchaseId);
    setWidgetData({
      items: todo.slice(0, 6).map((e) => ({ name: e.name, store: tags.find((t) => t.id === e.tagId)?.name })),
      count: todo.length,
      updatedAt: new Date().toISOString(),
    });
  }, [list, tags]);

  if (!state) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  const update = (fn: (s: State) => State) => {
    smooth();
    setState((s) => (s ? dropTempTags(s, fn(s)) : s));
  };
  return <StoreContext.Provider value={{ state, day, tick, update }}>{children}</StoreContext.Provider>;
}

// ---- 状態を変える操作（純粋関数。update(s => ...) に渡す） ----

export const addToList = (s: State, e: Omit<ListEntry, 'id' | 'addedAt'>, id = newId()): State => ({
  ...s,
  list: [...s.list, { ...e, id, addedAt: Date.now() }],
});

export const addPurchase = (s: State, p: Omit<Purchase, 'id' | 'by'>, id = newId()): State => ({ ...s, purchases: [...s.purchases, { ...p, id, by: s.cloud?.name }] });

/** リストの行をチェック: 購入を記録して行に紐付ける */
export function checkEntry(s: State, entryId: string): State {
  const e = s.list.find((x) => x.id === entryId);
  if (!e || e.purchaseId) return s;
  const p: Purchase = { id: newId(), itemId: e.itemId, name: e.name, tagId: e.tagId, date: today(), by: s.cloud?.name };
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

/** 品名のいらすとやアイコンを外す／戻す（この端末だけ） */
export function toggleIconOff(s: State, name: string): State {
  const k = name.trim();
  const { iconOff } = s.settings;
  return { ...s, settings: { ...s.settings, iconOff: iconOff.includes(k) ? iconOff.filter((x) => x !== k) : [...iconOff, k] } };
}

export const removeEntry = (s: State, entryId: string): State => ({ ...s, list: s.list.filter((x) => x.id !== entryId) });

export function deleteItem(s: State, itemId: string): State {
  // 共有しない品は、消したあとも購入・リスト行を共有しない（itemId が外れると private と分からなくなるため）
  const priv = !!s.items.find((i) => i.id === itemId)?.private;
  return {
    ...s,
    items: s.items.filter((i) => i.id !== itemId),
    list: s.list.filter((e) => e.itemId !== itemId || (e.purchaseId && !priv)),
    // 履歴は品名つきで残す（購入履歴の画面に出る）
    purchases: s.purchases.map((p) => (p.itemId === itemId ? { ...p, itemId: undefined, private: priv || undefined } : p)),
  };
}

// ---- 写真（documentDirectory にファイル名で保存） ----

export const photoUri = (name: string) => new File(Paths.document, name).uri;

export function deletePhoto(name: string) {
  if (!validPhoto(name)) return; // クラウド由来の名前でパスの外を消さない
  try {
    new File(Paths.document, name).delete();
  } catch {
    // すでに無い
  }
}

/** 撮る/選ぶ → 被写体を切り抜いた透過 PNG（できなければ JPEG のコピー）。切り抜けたときは元の JPEG も photoOrig に残す。base64 は AI 読み取り用の JPEG。キャンセルなら undefined */
export async function pickPhoto(camera: boolean, wantBase64 = false): Promise<{ photo: string; photoOrig?: string; base64?: string } | undefined> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(camera ? 'カメラを使えません' : '写真を開けません', '設定アプリでアクセスを許可してください。');
    return;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: wantBase64 };
  const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return;
  const { uri, base64 } = res.assets[0];
  // 切り抜けない（iOS 16 以前・被写体なし・Expo Go）ときは写真のまま保存
  const cut = await liftSubject(uri);
  const name = `${newId()}.jpg`;
  await new File(uri).copy(new File(Paths.document, name));
  return cut ? { photo: cut, photoOrig: name, base64: base64 ?? undefined } : { photo: name, base64: base64 ?? undefined };
}

/** 写真アプリで「被写体をコピー」した切り抜き画像を、透過 PNG のまま保存。無ければ undefined */
export async function pastePhoto(): Promise<string | undefined> {
  const img = await Clipboard.getImageAsync({ format: 'png' });
  if (!img) {
    Alert.alert('コピーされた画像がありません', '「写真」アプリで品の写真を開き、品を長押し →「コピー」してから、もう一度［貼り付け］を押してください。');
    return;
  }
  const name = `${newId()}.png`;
  await new File(Paths.document, name).write(img.data.replace(/^data:image\/\w+;base64,/, ''), { encoding: 'base64' });
  return name;
}
