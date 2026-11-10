import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../store';
import { C } from '../ui';

// ウィジェットなどから /add を直接開いても、後ろにタブが残るようにする
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: C.main, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerStyle: { backgroundColor: C.bg }, headerTitleStyle: { color: C.ink, fontWeight: '600' }, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ title: '' }} />
        <Stack.Screen name="entry/[id]" options={{ title: '' }} />
        <Stack.Screen name="item/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.9], sheetGrabberVisible: true }} />
        <Stack.Screen name="area" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.75, 0.95], sheetGrabberVisible: true }} />
        <Stack.Screen name="voice" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.9], sheetGrabberVisible: true }} />
        <Stack.Screen name="history" options={{ title: '購入履歴' }} />
        <Stack.Screen name="stores" options={{ title: 'お店と売り場の順' }} />
        <Stack.Screen name="notify" options={{ title: '通知' }} />
        <Stack.Screen name="net" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.6, 0.95], sheetGrabberVisible: true }} />
        <Stack.Screen name="ai" options={{ title: 'AI の利用' }} />
        <Stack.Screen name="share" options={{ title: '家族と共有・バックアップ' }} />
        <Stack.Screen name="backup" options={{ title: 'バックアップ' }} />
        <Stack.Screen name="help" options={{ title: '使い方' }} />
      </Stack>
    </StoreProvider>
  );
}
