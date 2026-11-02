import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../store';
import { C } from '../ui';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: C.main, headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false, headerStyle: { backgroundColor: C.bg }, headerTitleStyle: { color: C.ink, fontWeight: '600' }, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ title: '' }} />
        <Stack.Screen name="item/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="add" options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.9], sheetGrabberVisible: true }} />
        <Stack.Screen name="history" options={{ title: '購入履歴' }} />
      </Stack>
    </StoreProvider>
  );
}
