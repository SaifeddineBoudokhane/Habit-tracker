import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { TimeField } from '@/components/time-field';
import { Body, Button, Card, Label, NumberInput } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useStore } from '@/data/store';
import { entriesToCsv, makeBackup, parseBackup } from '@/lib/backup';
import { toKey } from '@/lib/dates';
import { PLAN_PREFIX } from '@/lib/reminders';
import { CHANNEL_ID, ensurePermission, syncReminders } from '@/notifications/scheduler';

export default function SettingsScreen() {
  const c = useColors();
  const { habits, entries, settings, updateSettings, restore } = useStore();
  const [permission, setPermission] = useState<boolean | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(() => {
    setNow(new Date());
    ensurePermission(false).then(setPermission);
    Notifications.getAllScheduledNotificationsAsync().then((list) =>
      setScheduledCount(list.filter((n) => n.identifier.startsWith(PLAN_PREFIX)).length),
    );
  }, []);
  useFocusEffect(refresh);

  const share = async (name: string, content: string, mimeType: string) => {
    const file = new File(Paths.cache, name);
    await file.write(content);
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  };

  const exportJson = async () => {
    try {
      const backup = makeBackup(habits, entries, settings);
      await share(`habits-backup-${toKey(new Date())}.json`, JSON.stringify(backup, null, 2), 'application/json');
      await updateSettings({ lastBackupAt: new Date().toISOString() });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const exportCsv = async () => {
    try {
      await share(`habits-${toKey(new Date())}.csv`, entriesToCsv(habits, entries), 'text/csv');
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const importJson = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    try {
      const backup = parseBackup(await new File(res.assets[0].uri).text());
      Alert.alert(
        'Replace all data?',
        `The backup has ${backup.habits.length} habits and ${backup.entries.length} entries. Everything currently in the app will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              await restore(backup);
              Alert.alert('Restored', 'Your data has been restored.');
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    }
  };

  const testNotification = async () => {
    if (!(await ensurePermission(true))) return setPermission(false);
    await Notifications.scheduleNotificationAsync({
      content: { title: '🔔 Test reminder', body: 'Reminders are working.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
    });
  };

  const daysSinceBackup = settings.lastBackupAt
    ? Math.floor((now.getTime() - new Date(settings.lastBackupAt).getTime()) / 86_400_000)
    : null;
  const backupStale = daysSinceBackup === null || daysSinceBackup > 30;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content}>
      <Card>
        <Label>Notifications</Label>
        {permission === false ? (
          <View style={{ gap: 10 }}>
            <Body style={{ color: c.danger }}>Notifications are blocked, so reminders won’t show.</Body>
            <Button
              title="Allow notifications"
              onPress={async () => {
                const ok = await ensurePermission(true);
                if (!ok) Linking.openSettings();
                refresh();
              }}
            />
          </View>
        ) : (
          <Body muted>
            {scheduledCount} reminder{scheduledCount === 1 ? '' : 's'} scheduled for the next 7 days.
          </Body>
        )}
        <View style={[s.row, { marginTop: 14 }]}>
          <Body>Quiet hours</Body>
          <Switch value={settings.quietEnabled} onValueChange={(v) => updateSettings({ quietEnabled: v })} />
        </View>
        {settings.quietEnabled && (
          <View style={[s.inline, { marginTop: 8 }]}>
            <Body muted>No reminders from</Body>
            <TimeField value={settings.quietStart} onChange={(v) => updateSettings({ quietStart: v })} />
            <Body muted>to</Body>
            <TimeField value={settings.quietEnd} onChange={(v) => updateSettings({ quietEnd: v })} />
          </View>
        )}
        <View style={[s.inline, { marginTop: 14 }]}>
          <Button title="Send test" kind="secondary" onPress={testNotification} />
          <Button title="Reschedule all" kind="secondary" onPress={() => syncReminders().then(refresh)} />
        </View>
      </Card>

      <Card>
        <Label>Streaks</Label>
        <View style={s.inline}>
          <Body>Skip days allowed per habit per month</Body>
          <NumberInput value={settings.skipsPerMonth} min={0} onChange={(n) => updateSettings({ skipsPerMonth: n })} />
        </View>
        <Body muted style={{ marginTop: 8, fontSize: 13 }}>
          A skipped (rest / sick) day doesn’t break your streak. The limit keeps it honest.
        </Body>
      </Card>

      <Card>
        <Label>Backup</Label>
        <Body style={backupStale ? { color: c.danger } : undefined}>
          {daysSinceBackup === null
            ? 'Never backed up. Your data only lives on this phone.'
            : `Last backup ${daysSinceBackup === 0 ? 'today' : `${daysSinceBackup} days ago`}.`}
        </Body>
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button title="Export backup (JSON)" onPress={exportJson} />
          <Button title="Export history (CSV)" kind="secondary" onPress={exportCsv} />
          <Button title="Restore from backup" kind="secondary" onPress={importJson} />
        </View>
        <Body muted style={{ marginTop: 8, fontSize: 13 }}>
          Save the JSON to Google Drive or email it to yourself. Restore it here on a new phone.
        </Body>
      </Card>

      <Body muted style={{ textAlign: 'center', fontSize: 12 }}>
        Habit Tracker {Constants.expoConfig?.version ?? ''} · fully offline
      </Body>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
});
