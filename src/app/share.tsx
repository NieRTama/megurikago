import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { createGroup, joinGroup, leaveGroup, regenerateCode, removeMember, watchGroup, type GroupInfo } from '../cloud';
import { configured } from '../firebase';
import { formatCode, mergeRemote, noShared, sharedPart } from '../logic';
import { forgetSynced, useStore } from '../store';
import { Button, C, s } from '../ui';

/** 家族と共有・バックアップ: 家族グループの作成・参加・管理。グループに入っていればデータはクラウドにもある */
export default function ShareScreen() {
  const { state, update } = useStore();
  const cloud = state.cloud;
  const [mode, setMode] = useState<'create' | 'join'>();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // どのグループの情報か（グループが変わったときに古い表示を使わないため hid つきで持つ）
  const [got, setGot] = useState<{ hid: string; info?: GroupInfo; error?: boolean }>();

  const hid = cloud?.hid;
  const info = got?.hid === hid ? got?.info : undefined;
  const infoError = got?.hid === hid && !!got?.error;
  useEffect(() => {
    if (!hid) return;
    return watchGroup(hid, (info) => setGot({ hid, info }), () => setGot({ hid, error: true }));
  }, [hid]);

  if (!configured) {
    return (
      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        <View style={[s.card, { gap: 6 }]}>
          <Text style={[s.text, { fontWeight: '700' }]}>この版では使えません</Text>
          <Text style={s.small}>家族共有とクラウド保存は、Firebase の設定を入れてビルドした版でだけ使えます。ほかの機能はふつうに使えます。バックアップは「わたし」タブの［データを書き出す］で取れます。</Text>
        </View>
      </ScrollView>
    );
  }

  const fail = (title: string) => (e: unknown) => Alert.alert(title, e instanceof Error ? e.message : String(e));
  const myName = name.trim();

  const create = async () => {
    setBusy(true);
    try {
      const g = await createGroup(myName);
      update((x) => ({ ...x, cloud: { hid: g.hid, name: myName } }));
      setMode(undefined);
    } catch (e) {
      fail('グループを作れませんでした')(e);
    }
    setBusy(false);
  };

  const join = async (replace: boolean) => {
    setBusy(true);
    try {
      const h = await joinGroup(code, myName);
      // 置き換えるときは、手元の共有分（お店も）を空にしてから参加する（private の品は残る）。合わせるときは同期が和をとる
      update((x) => ({ ...(replace ? mergeRemote(x, noShared()) : x), cloud: { hid: h, name: myName } }));
      setMode(undefined);
    } catch (e) {
      fail('参加できませんでした')(e);
    }
    setBusy(false);
  };

  const askJoin = () => {
    // お店は初期の分があるので数えない。品・リスト・購入が共有分に無ければ、実質空として確認なしで置き換える
    const { items, list, purchases } = sharedPart(state);
    if (!items.length && !list.length && !purchases.length) return join(true);
    Alert.alert('手元のデータをどうしますか？', `いま手元に ${items.length} 品・リスト ${list.length} 件・購入記録 ${purchases.length} 件あります。`, [
      { text: 'やめる', style: 'cancel' },
      { text: '手元のデータを合わせる', onPress: () => join(false) },
      { text: 'クラウドのデータで置き換える', style: 'destructive', onPress: () => join(true) },
    ]);
  };

  const detach = () => {
    if (!cloud) return;
    forgetSynced(cloud.hid);
    update((x) => ({ ...x, cloud: undefined }));
  };

  const leave = () =>
    Alert.alert('グループから抜けますか？', '手元のデータは残ります。以後はクラウドに送らず、ほかの人の変更も届きません。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '抜ける',
        style: 'destructive',
        onPress: () => {
          const h = cloud!.hid;
          detach();
          // 手元は先に切り離す。クラウド側の名簿から外れるのは、つながったときでよい
          leaveGroup(h).catch(() => Alert.alert('名簿から外れていません', 'つながらなかったため、ほかの人のメンバー一覧には残っています。外してもらってください。'));
        },
      },
    ]);

  const kick = (uid: string, who: string) =>
    Alert.alert(`${who}を外しますか？`, 'その端末はクラウドを読めなくなります（その端末の手元のデータは残ります）。外すだけでは、同じコードで入り直せます。古い端末の整理にも使えます。', [
      { text: 'やめる', style: 'cancel' },
      { text: '外す', style: 'destructive', onPress: () => removeMember(cloud!.hid, uid).then(() => askRenew(who), fail('外せませんでした')) },
    ]);

  const doRenew = () => regenerateCode(cloud!.hid).catch(fail('作り直せませんでした'));

  const askRenew = (who: string) =>
    Alert.alert('コードも作り直しますか？', `${who}は今のコードを知っているので、コードを作り直さないと同じコードで入り直せます。`, [
      { text: '今はしない', style: 'cancel' },
      { text: '作り直す', onPress: doRenew },
    ]);

  const renew = () =>
    Alert.alert('コードを作り直しますか？', '古いコードでは入れなくなります。いまのメンバーはそのままです。', [
      { text: 'やめる', style: 'cancel' },
      { text: '作り直す', onPress: doRenew },
    ]);

  if (cloud) {
    return (
      <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 48 }}>
        <View style={[s.card, { alignItems: 'center', gap: 10 }]}>
          <Text style={s.small}>家族コード</Text>
          <Text selectable style={[s.num, { fontSize: 34, fontWeight: '300', letterSpacing: 2, color: C.ink }]}>
            {info ? formatCode(info.code) : infoError ? '読み込めません' : '…'}
          </Text>
          {info && (
            <View style={s.row}>
              <Button kind="ghost" label="コピー" onPress={() => Clipboard.setStringAsync(formatCode(info.code)).then(() => Alert.alert('コピーしました'))} />
              <Button kind="ghost" label="共有" onPress={() => Share.share({ message: `めぐりかごの家族コード: ${formatCode(info.code)}` })} />
            </View>
          )}
          <Text style={[s.small, { textAlign: 'center' }]}>
            あなたは「{cloud.name}」として参加中です。このコードを知っている人は誰でも入れます。機種変更のときは、新しい端末で「コードで参加する」にこのコードを入れてください。
          </Text>
        </View>

        <Text style={s.h2}>メンバー</Text>
        <View style={[s.card, { paddingVertical: 4 }]}>
          {!info && <Text style={[s.small, { paddingVertical: 12 }]}>{infoError ? '読み込めませんでした' : '読み込み中…'}</Text>}
          {info?.members.map((m, i) => (
            <View key={m.uid} style={[s.row, { paddingVertical: 12 }, !!i && s.divider]}>
              <Text style={[s.text, { flex: 1 }]}>
                {m.name}
                {m.uid === info.me ? '（この端末）' : ''}
              </Text>
              {m.uid !== info.me && (
                <Pressable onPress={() => kick(m.uid, m.name)} hitSlop={6}>
                  <Text style={[s.small, { color: C.danger }]}>外す</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
        <Text style={[s.small, { paddingHorizontal: 20, marginTop: 8 }]}>機種変更のあとで古い端末が残っていたら、ここから外してください（外すだけでは同じコードで入り直せるので、コードも作り直すと確実です）。品ごとに「家族と共有する」をオフにすると、その品は自分の手元だけになります。</Text>

        <View style={{ padding: 16, gap: 8, marginTop: 12 }}>
          <Button kind="ghost" label="コードを作り直す" onPress={renew} />
          <Button kind="danger" label="グループから抜ける" onPress={leave} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[s.card, { gap: 8 }]}>
        <Text style={s.text}>家族グループに入ると、棚・買い物リスト・購入記録・お店・写真が家族で共有されます。</Text>
        <Text style={s.small}>1人でもグループを作れば、データがクラウドにも保存されるのでバックアップになります。機種変更のときは、新しい端末で同じコードを入れるだけで戻ります。写真は小さくして送ります。</Text>
        <Text style={s.small}>「家族コード」を知っている人は誰でも入れます。コードは家族だけに伝えてください。アカウント登録は要りません。</Text>
      </View>

      <View style={{ padding: 16, gap: 8 }}>
        <Button label="家族グループを作る" onPress={() => setMode('create')} kind={mode === 'create' ? 'main' : 'ghost'} />
        <Button label="コードで参加する" onPress={() => setMode('join')} kind={mode === 'join' ? 'main' : 'ghost'} />
      </View>

      {mode && (
        <View style={[s.card, { gap: 10 }]}>
          {mode === 'join' && <TextInput value={code} onChangeText={setCode} placeholder="家族コード（XXXX-XXXX）" autoCapitalize="characters" autoCorrect={false} style={s.input} />}
          <TextInput value={name} onChangeText={setName} placeholder="あなたの呼び名（家族に表示されます）" style={s.input} maxLength={20} />
          <Button
            label={busy ? '通信中…' : mode === 'create' ? '作る' : '参加する'}
            disabled={busy || !myName || (mode === 'join' && code.trim().length < 8)}
            onPress={mode === 'create' ? create : askJoin}
          />
          <Text style={s.small}>
            {mode === 'create' ? '作ると手元のデータがクラウドへ送られ、家族コードが表示されます。' : '手元に品があるときは、合わせるか、クラウドのデータで置き換えるかを選べます。'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
