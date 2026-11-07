import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// 設定値は環境変数（手元は .env.local、CI は Secrets）。Metro が EXPO_PUBLIC_ の参照をビルド時に埋め込むので、
// process.env[...] ではなくこの書き方のままにする。値が無いビルドでは configured=false で、Firebase には触れない
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const configured = Object.values(config).every(Boolean);

let fb: { auth: ReturnType<typeof getAuth>; db: ReturnType<typeof getFirestore> } | undefined;

/** 初めて呼ばれたときに初期化する（import しただけでは何も起きない・つながない）。通信は Firestore / Auth を使うときに始まる */
export function firebase() {
  if (!configured) throw new Error('この版では家族共有を使えません');
  if (!fb) {
    const app = getApps().length ? getApp() : initializeApp(config);
    // 開発中の再読み込みで初期化済みのときは、すでにあるものを使う
    const auth = (() => {
      try {
        return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
      } catch {
        return getAuth(app);
      }
    })();
    // React Native では既定の通信方式が不安定なので、ロングポーリングにそろえる（少し遅いが確実）
    const db = (() => {
      try {
        return initializeFirestore(app, { experimentalForceLongPolling: true });
      } catch {
        return getFirestore(app);
      }
    })();
    fb = { auth, db };
  }
  return fb;
}
