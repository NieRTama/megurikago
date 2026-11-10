import type { File } from 'expo-file-system';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import type { State } from '../logic';
import { checkBackup, listBackups, readBackup, saveBackup, useStore, withDefaults } from '../store';
import { Button, C, s } from '../ui';

const LIMIT_MB = 300; // バックアップの合計がこれを超えたら知らせる（iPhone の空きを食うため）
const mb = (fs: File[]) => fs.reduce((a, f) => a + (f.size ?? 0), 0) / 1024 / 1024;

/** バックアップ。アプリの中（ファイル App の「このiPhone内 › めぐりかご › backups」）に日付つきの zip で残す */
export default function Backup() {
  const { state, update } = useStore();
  const [files, setFiles] = useState(listBackups);
  const [busy, setBusy] = useState(false);

  const save = async (withPhotos: boolean) => {
    setBusy(true);
    try {
      const name = await saveBackup(state, withPhotos);
      const next = listBackups();
      setFiles(next);
      const total = mb(next);
      if (total > LIMIT_MB) Alert.alert('バックアップが300MBを超えました', `${name} を保存しました。保存したバックアップの合計が ${total.toFixed(0)} MB です。古いものを［共有］で iCloud Drive などに移してから削除すると、iPhone の空きが増えます。`);
      else Alert.alert('保存しました', name);
    } catch (e) {
      Alert.alert('保存できませんでした', String(e));
    }
    setBusy(false);
  };

  // 家族グループの参加状態は、バックアップに頼らずこの端末のものを保つ（参加中なら読み込んだ内容がクラウドにも送られる）
  const replace = (data: State, done: string) => {
    const go = () => {
      update((cur) => ({ ...withDefaults(data), cloud: cur.cloud }));
      Alert.alert('読み込みました', done);
    };
    if (!state.cloud) return go();
    Alert.alert('家族のクラウドのデータも置き換わります', '家族グループに参加中なので、読み込んだ内容がクラウドにも送られ、ほかの人の端末のデータも置き換わります。', [
      { text: 'やめる', style: 'cancel' },
      { text: '読み込む', style: 'destructive', onPress: go },
    ]);
  };

  const restore = (f: File) =>
    Alert.alert(`${f.name} を読み込みますか？`, 'いまのデータは置き換わります。先に今のデータを保存しておくと安心です。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '読み込む',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const { data, photos } = await readBackup(f);
            replace(data, photos ? `写真 ${photos} 枚も戻しました。` : '写真は入っていなかったので、今ある写真のままです。');
          } catch (e) {
            Alert.alert('読み込めませんでした', String(e));
          }
          setBusy(false);
        },
      },
    ]);

  const remove = (f: File) =>
    Alert.alert(`${f.name} を削除しますか？`, '元に戻せません。', [
      { text: 'やめる', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => (f.delete(), setFiles(listBackups())) },
    ]);

  const importText = () =>
    Alert.prompt('文字のバックアップを読み込む', '前に書き出した文字をそのまま貼り付けてください。いまのデータは置き換わります。', (text) => {
      try {
        replace(checkBackup(JSON.parse(text)), '写真は含まれないため、今ある写真のままです。');
      } catch (e) {
        Alert.alert('読み込めませんでした', String(e));
      }
    });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 12, paddingBottom: 48 }}>
      <View style={[s.card, { gap: 10 }]}>
        <Button label="写真つきで保存" onPress={() => save(true)} disabled={busy} />
        <Button kind="ghost" label="写真なしで保存（軽い）" onPress={() => save(false)} disabled={busy} />
        <Text style={s.small}>アプリの中に、日付のついた zip で残します。ファイル App の「このiPhone内 › めぐりかご › backups」からも見えます。アプリを削除すると一緒に消えるので、大事なものは［共有］で iCloud Drive などにも置いてください。</Text>
      </View>

      <Text style={s.h2}>保存したバックアップ（合計 {mb(files).toFixed(1)} MB）</Text>
      {mb(files) > LIMIT_MB && <Text style={[s.small, { color: C.danger, paddingHorizontal: 20, marginBottom: 8 }]}>合計が {LIMIT_MB} MB を超えています。古いものを削除してください。</Text>}
      <View style={[s.card, { paddingVertical: 4 }]}>
        {!files.length && <Text style={[s.small, { paddingVertical: 12 }]}>まだありません</Text>}
        {files.map((f, i) => (
          <View key={f.uri} style={[{ paddingVertical: 12, gap: 8 }, !!i && s.divider]}>
            <Text style={s.text}>
              {f.name.replace(/^megurikago-|\.zip$/g, '').replace('-photos', '　写真つき')}
              <Text style={s.small}>　{((f.size ?? 0) / 1024 / 1024).toFixed(1)} MB</Text>
            </Text>
            <View style={[s.row, { gap: 20 }]}>
              <Pressable onPress={() => restore(f)} disabled={busy} hitSlop={6}>
                <Text style={s.link}>読み込む</Text>
              </Pressable>
              <Pressable onPress={() => Share.share({ url: f.uri })} hitSlop={6}>
                <Text style={s.link}>共有</Text>
              </Pressable>
              <Pressable onPress={() => remove(f)} hitSlop={6}>
                <Text style={[s.link, { color: C.danger }]}>削除</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Text style={s.h2}>文字で書き出す（写真なし）</Text>
      <View style={[s.card, { gap: 12 }]}>
        <Pressable onPress={() => Share.share({ message: JSON.stringify(state) })}>
          <Text style={s.link}>データを文字で書き出す（メモ・メールなどに保存）</Text>
        </Pressable>
        <Pressable onPress={importText}>
          <Text style={s.link}>書き出した文字を読み込む</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
