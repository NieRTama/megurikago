import { getRandomValues } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { signInAnonymously } from 'firebase/auth';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { firebase } from './firebase';
import { COLS, fromDocs, makeCode, normalizeCode, validPhoto, type Change, type Col, type Doc, type Shared } from './logic';

// Firebase に触れるのはこのファイルだけ。呼ばれるのは家族グループに参加中か、共有の画面で操作したときだけ

// 家族コードは当てられないことが守りなので、OS の乱数だけを使う（Math.random にはフォールバックしない）
const rand = (n: number) => getRandomValues(new Uint32Array(1))[0] % n;

/** 匿名ログイン済みにして uid を返す（ログイン状態は端末に保持される） */
async function ready() {
  const { auth, db } = firebase();
  await auth.authStateReady();
  const uid = (auth.currentUser ?? (await signInAnonymously(auth)).user).uid;
  return { db, uid };
}

/** 通信が長引くときは諦める（Firestore の書き込みは、つながるまで待ち続けるので） */
const within = <T>(p: Promise<T>, msg = '通信できませんでした。電波のよい所でもう一度試してください。', ms = 15000) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

const errCode = (e: unknown) => (e as { code?: string })?.code;

/** 新しいグループを作る。手元のデータは、このあと同期が最初のスナップショットで差分として送る */
export async function createGroup(name: string): Promise<{ hid: string; code: string }> {
  // 時間切れでも書き込みは裏で進むことがある（グループができているかもしれない）ので、やり直しを案内する
  return within(
    (async () => {
      const { db, uid } = await ready();
      const hid = doc(collection(db, 'households')).id;
      const c = makeCode(rand);
      // ルールの get() は書き込み前の状態を見るので、グループ → コード → 自分の名前 の順に別々に書く
      // ponytail: コードの衝突（31^8 分の 1）は再試行しない。起きたらルールで拒否されて作成が失敗する
      await setDoc(doc(db, 'households', hid), { code: c, members: [uid], createdAt: serverTimestamp() });
      await setDoc(doc(db, 'codes', c), { hid });
      await setDoc(doc(db, 'households', hid, 'members', uid), { name, joinedAt: serverTimestamp() });
      return { hid, code: c };
    })(),
    '通信が不安定です。もう一度やり直してください。',
  );
}

/** コードでグループに入る。コード → hid → members に自分を足す → 自分の名前、の順 */
export async function joinGroup(rawCode: string, name: string): Promise<string> {
  return within(
    (async () => {
      const { db, uid } = await ready();
      const code = normalizeCode(rawCode);
      const snap = await getDoc(doc(db, 'codes', code));
      if (!snap.exists()) throw new Error('そのコードのグループが見つかりません。コードを確かめてください。');
      const hid = snap.data().hid as string;
      try {
        // joins.{uid} はルールが「今のコードを知っている」ことを確かめるための添え書き（uid ごとなので他人の値に便乗できない）
        await updateDoc(doc(db, 'households', hid), { members: arrayUnion(uid), [`joins.${uid}`]: code });
      } catch (e) {
        throw errCode(e) === 'permission-denied' ? new Error('このグループには入れませんでした。コードが作り直されていないか確かめてください。') : e;
      }
      await setDoc(doc(db, 'households', hid, 'members', uid), { name, joinedAt: serverTimestamp() });
      return hid;
    })(),
  );
}

/** メンバーを外す（名前を消してから members から外す）。自分の古い端末の整理にも使う */
export async function removeMember(hid: string, uid: string): Promise<void> {
  const { db } = await ready();
  await within(deleteDoc(doc(db, 'households', hid, 'members', uid)));
  await within(updateDoc(doc(db, 'households', hid), { members: arrayRemove(uid) }));
}

/** 自分を外す */
export async function leaveGroup(hid: string): Promise<void> {
  return removeMember(hid, (await ready()).uid);
}

/** コードを作り直す（古いコードでは入れなくなる。メンバーはそのまま） */
export async function regenerateCode(hid: string): Promise<string> {
  const { db } = await ready();
  const ref = doc(db, 'households', hid);
  // 途中で止まるとコードだけ変わって codes/{新} が無いことがある。やり直せば新しいコードで揃う
  const slow = '通信が不安定です。コードが変わっている途中かもしれません。もう一度やり直してください。';
  const old = (await within(getDoc(ref), slow)).data()?.code as string | undefined;
  const c = makeCode(rand);
  // ルール上、households の code を先に変えてからでないと codes/{c} を作れない
  await within(updateDoc(ref, { code: c }), slow);
  await within(setDoc(doc(db, 'codes', c), { hid }), slow);
  // 旧コードの文書が無い（やり直しのとき）とルールで拒否されるので失敗は無視する。旧コードは households.code と合わず入れない
  if (old) await within(deleteDoc(doc(db, 'codes', old)), slow).catch(() => {});
  return c;
}

export type GroupInfo = { code: string; me: string; members: { uid: string; name: string }[] };

/** 共有の画面用: コードとメンバー一覧を見張る */
export function watchGroup(hid: string, onInfo: (g: GroupInfo) => void, onError: (e: unknown) => void): () => void {
  let stopped = false;
  const unsubs: (() => void)[] = [];
  let house: { code: string; members: string[] } | undefined;
  let names = new Map<string, string>();
  let me = '';
  const emit = () => house && onInfo({ code: house.code, me, members: house.members.map((uid) => ({ uid, name: names.get(uid) ?? '（名前なし）' })) });
  ready()
    .then(({ db, uid }) => {
      if (stopped) return;
      me = uid;
      unsubs.push(
        onSnapshot(
          doc(db, 'households', hid),
          (d) => {
            if (d.exists()) house = { code: String(d.data().code), members: d.data().members as string[] };
            emit();
          },
          onError,
        ),
        onSnapshot(
          collection(db, 'households', hid, 'members'),
          (q) => {
            names = new Map(q.docs.map((d) => [d.id, String(d.data().name)]));
            emit();
          },
          onError,
        ),
      );
    })
    .catch(onError);
  return () => {
    stopped = true;
    unsubs.forEach((u) => u());
  };
}

/**
 * 4 つのコレクションを見張り、そろったら onRemote(クラウドの中身, 最初か, サーバーで確かめ済みか) を呼ぶ。
 * 最初の 1 回は 4 つともサーバーからの回答を待つ（オフラインで空のキャッシュを「クラウドは空」と取り違えないため）。
 * permission-denied（グループから外された）は onError に渡す。それ以外のエラーで購読が止まったときは、10 秒後に購読をやり直す
 * （最初の回答の前なら「最初」のまま、後なら 2 回目以降として届く）。つながらない間は Firestore が自分で再接続する
 */
export function listen(hid: string, onRemote: (remote: Shared, first: boolean, confirmed: boolean) => void, onError: (e: unknown) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let first = true;
  const unsubs: (() => void)[] = [];
  const retry = () => {
    unsubs.splice(0).forEach((u) => u());
    clearTimeout(timer);
    timer = setTimeout(start, 10000);
  };
  const start = (): Promise<void> =>
    ready()
      .then(({ db }) => {
        if (stopped) return;
        const got: Partial<Record<Col, Doc[]>> = {};
        const server = new Set<Col>();
        const pending = new Set<Col>();
        for (const c of COLS)
          unsubs.push(
            onSnapshot(
              collection(db, 'households', hid, c),
              { includeMetadataChanges: true },
              (q) => {
                got[c] = q.docs.map((d) => ({ id: d.id, data: d.data() }));
                if (!q.metadata.fromCache) server.add(c);
                if (q.metadata.hasPendingWrites) pending.add(c);
                else pending.delete(c);
                if (COLS.some((x) => !got[x]) || (first && server.size < COLS.length)) return;
                onRemote(fromDocs(got as Record<Col, Doc[]>), first, server.size === COLS.length && !pending.size);
                first = false;
              },
              (e) => {
                if (stopped) return;
                if (errCode(e) === 'permission-denied') onError(e);
                else retry();
              },
            ),
          );
      })
      .catch(() => {
        if (!stopped) retry(); // 匿名ログインに失敗（オフライン等）。あとでやり直す
      });
  start();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubs.forEach((u) => u());
  };
}

// 送る順番を守る（写真の縮小を待つあいだに、あとの変更が先に書かれないように）。書き込みの完了までは待たない
let queue: Promise<unknown> = Promise.resolve();

// 写真の送信に失敗した名前（グループごと）。次の push でもう一度送る
const unsent = new Map<string, Set<string>>();

/** 差分を 500 件ごとの writeBatch で送り、そのあと新しい写真を縮小して photos/{name} に置く（失敗した写真は次の push で再送） */
export function push(hid: string, changes: Change[], photos: string[]): Promise<void> {
  const enqueued = queue.then(async () => {
    const { db } = await ready();
    const commits: Promise<void>[] = [];
    for (let i = 0; i < changes.length; i += 500) {
      const b = writeBatch(db);
      for (const c of changes.slice(i, i + 500)) {
        const ref = doc(db, 'households', hid, c.col, c.id);
        if (c.data) b.set(ref, c.data);
        else b.delete(ref);
      }
      commits.push(b.commit());
    }
    // 品を先に書く（写真の縮小を待つあいだに届いたスナップショットで、手元の変更が巻き戻らないように）
    const failed = unsent.get(hid) ?? new Set<string>();
    unsent.set(hid, failed);
    await Promise.all(
      [...new Set([...photos, ...failed])].map((n) =>
        uploadPhoto(hid, n).then(
          () => failed.delete(n),
          () => failed.add(n), // 写真だけ失敗しても品は送る
        ),
      ),
    );
    return commits;
  });
  queue = enqueued.catch(() => {});
  return enqueued.then((c) => Promise.all(c)).then(() => {});
}

/**
 * 長辺 256px 以内に縮小して送る。PNG（切り抜き）は透過のまま、JPEG は品質 0.7
 * ponytail: 1 枚 10〜100KB 程度の文書（上限 1MiB・無料枠は全体で 1GiB）。差し替え・削除した写真の photos 文書は消さず増え続ける。
 * 溜まったら Firebase コンソールで photos を手で消すか、品が参照していない名前を消す掃除を足す（端末の古い写真ファイルも同様）
 */
async function uploadPhoto(hid: string, name: string) {
  const file = new File(Paths.document, name);
  if (!file.exists) return;
  const { db } = firebase();
  const img = await ImageManipulator.manipulate(file.uri, { maxWidth: 256, maxHeight: 256 }).renderAsync();
  const out = await img.saveAsync({ format: name.endsWith('.png') ? SaveFormat.PNG : SaveFormat.JPEG, compress: 0.7, base64: true });
  await setDoc(doc(db, 'households', hid, 'photos', name), { data: out.base64 });
}

const fetching = new Set<string>();
// 取れなかった（まだ無い・通信失敗）名前を覚えて、しばらく取り直さない（スナップショットのたびに読み直さないため）
const missed = new Map<string, number>();
const RETRY_MS = 60000;

/** 手元に無い写真をクラウドから取って Paths.document に書く。1 枚でも書けたら true */
export async function fetchPhotos(hid: string, names: string[]): Promise<boolean> {
  const { db } = await ready();
  let wrote = false;
  const skip = (n: string) => !validPhoto(n) || fetching.has(n) || Date.now() - (missed.get(n) ?? -RETRY_MS) < RETRY_MS;
  for (const n of names.filter((x) => !skip(x))) {
    fetching.add(n);
    try {
      const snap = await getDoc(doc(db, 'households', hid, 'photos', n));
      const data = snap.data()?.data;
      if (typeof data === 'string') {
        await new File(Paths.document, n).write(data, { encoding: 'base64' });
        missed.delete(n);
        wrote = true;
      } else missed.set(n, Date.now()); // 送り手がまだ送っていないかもしれない。次の取り込みのとき（1 分後以降）にまた試す
    } catch {
      missed.set(n, Date.now());
    } finally {
      fetching.delete(n);
    }
  }
  return wrote;
}
