import type { Persistence } from 'firebase/auth';

// firebase/auth の型は React Native 版（実行時は Metro が react-native 条件で選ぶ）の getReactNativePersistence を含まないので補う
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
