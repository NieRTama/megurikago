import { NativeTabs } from 'expo-router/native-tabs';
import { useStore } from '../../store';
import { C } from '../../ui';

export default function TabsLayout() {
  const { state } = useStore();
  const left = state.list.filter((e) => !e.purchaseId).length;
  return (
    <NativeTabs tintColor={C.main}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" />
        <NativeTabs.Trigger.Label>いつもの</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="list">
        <NativeTabs.Trigger.Icon sf="checklist" />
        <NativeTabs.Trigger.Label>買うもの</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={!left}>{String(left)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" />
        <NativeTabs.Trigger.Label>わたし</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
