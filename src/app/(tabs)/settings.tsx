import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { canUseAppLock, confirmIdentity } from '@/components/app-lock';
import { TimeField } from '@/components/time-field';
import { Body, Button, Card, Chip, Label, NumberInput, Segmented } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { folderLabel, pickBackupFolder } from '@/data/auto-backup';
import type { WipeKind } from '@/data/db';
import { useStore } from '@/data/store';
import { entriesToCsv, makeBackup, parseBackup, workoutsToCsv } from '@/lib/backup';
import { toKey } from '@/lib/dates';
import { DEFAULT_SETTINGS } from '@/lib/types';
import { PLAN_PREFIX } from '@/lib/reminders';
import { CHANNEL_ID, ensurePermission, resetKnownSchedule, syncReminders } from '@/notifications/scheduler';

export default function SettingsScreen() {
  const c = useColors();
  const { habits, entries, settings, updateSettings, restore, goals, exercises, templates, workouts, sets, backupNow, wipe } =
    useStore();
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
      const backup = makeBackup({ habits, entries, settings, goals, exercises, templates, workouts, sets });
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

  const exportWorkoutCsv = async () => {
    try {
      await share(`workouts-${toKey(new Date())}.csv`, workoutsToCsv(workouts, sets, exercises), 'text/csv');
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

  const chooseFolder = async () => {
    try {
      const uri = await pickBackupFolder();
      await updateSettings({ autoBackupDir: uri });
      const res = await backupNow();
      if (res?.autoBackupError) Alert.alert('Backup failed', res.autoBackupError);
    } catch (e) {
      // Cancelled picker throws too; only report real failures.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) Alert.alert('Could not use that folder', msg);
    }
  };

  const confirmWipe = (kind: WipeKind) => {
    const text = {
      history: ['Delete habit history?', 'Every logged day, note and skip is deleted. Your habits, goals and workouts stay.'],
      workouts: ['Delete all workouts?', 'Every workout and set is deleted. Exercises and templates stay.'],
      everything: ['Delete EVERYTHING?', 'All habits, history, goals, workouts and settings are deleted. The app goes back to a fresh install.'],
    }[kind];
    Alert.alert(text[0], `${text[1]}\n\nThis can’t be undone. Export a backup first if you might want it back.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Export backup first', onPress: exportJson },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          kind === 'everything'
            ? Alert.alert('Are you sure?', 'Last chance: everything in the app will be gone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete everything', style: 'destructive', onPress: () => wipe(kind) },
              ])
            : wipe(kind),
      },
    ]);
  };

  const resetSettings = () =>
    Alert.alert('Reset settings?', 'Quiet hours, rest timer, snooze, week start, app lock and the workout habit go back to defaults. Your data is not touched.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: () =>
          updateSettings({
            quietEnabled: DEFAULT_SETTINGS.quietEnabled,
            quietStart: DEFAULT_SETTINGS.quietStart,
            quietEnd: DEFAULT_SETTINGS.quietEnd,
            skipsPerMonth: DEFAULT_SETTINGS.skipsPerMonth,
            appLock: DEFAULT_SETTINGS.appLock,
            restSeconds: DEFAULT_SETTINGS.restSeconds,
            workoutHabitId: DEFAULT_SETTINGS.workoutHabitId,
            weekStartDay: DEFAULT_SETTINGS.weekStartDay,
            snoozeMinutes: DEFAULT_SETTINGS.snoozeMinutes,
          }),
      },
    ]);

  const daysSinceBackup = settings.lastBackupAt
    ? Math.floor((now.getTime() - new Date(settings.lastBackupAt).getTime()) / 86_400_000)
    : null;
  const backupStale = daysSinceBackup === null || daysSinceBackup > 30;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
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
          <Button
            title="Reschedule all"
            kind="secondary"
            onPress={() => {
              resetKnownSchedule();
              return syncReminders().then(refresh);
            }}
          />
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
        <Label>Workouts</Label>
        <Body>Tick this habit when a workout is finished</Body>
        <View style={[s.chips, { marginTop: 8 }]}>
          <Chip label="None" selected={!settings.workoutHabitId} onPress={() => updateSettings({ workoutHabitId: '' })} />
          {habits
            .filter((h) => !h.archived && h.kind !== 'avoid')
            .map((h) => (
              <Chip
                key={h.id}
                label={`${h.emoji} ${h.name}`}
                selected={settings.workoutHabitId === h.id}
                onPress={() => updateSettings({ workoutHabitId: h.id })}
              />
            ))}
        </View>
        <View style={[s.inline, { marginTop: 14 }]}>
          <Body>Rest timer between sets</Body>
          <NumberInput value={settings.restSeconds} min={0} onChange={(n) => updateSettings({ restSeconds: n })} />
          <Body muted>seconds (0 = off)</Body>
        </View>
      </Card>

      <Card>
        <Label>Privacy</Label>
        <View style={s.row}>
          <Body>App lock (fingerprint / screen lock)</Body>
          <Switch
            value={settings.appLock}
            onValueChange={async (v) => {
              if (!v) return updateSettings({ appLock: false });
              if (!(await canUseAppLock())) return Alert.alert('Not available', 'Set up a screen lock or fingerprint on your phone first.');
              if (await confirmIdentity()) updateSettings({ appLock: true });
            }}
          />
        </View>
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
          <Button title="Export habit history (CSV)" kind="secondary" onPress={exportCsv} />
          <Button title="Export workouts (CSV)" kind="secondary" onPress={exportWorkoutCsv} />
          <Button title="Restore from backup" kind="secondary" onPress={importJson} />
        </View>
        <Body muted style={{ marginTop: 8, fontSize: 13 }}>
          Save the JSON to Google Drive or email it to yourself. Restore it here on a new phone.
        </Body>
      </Card>

      <Card>
        <Label>Automatic backup</Label>
        <Body muted style={{ fontSize: 13, marginBottom: 10 }}>
          Saves a backup file to a folder on your phone about once a day. Files in that folder are kept even if you
          uninstall the app, so you can restore after reinstalling or on a new phone.
        </Body>
        {settings.autoBackupDir ? (
          <View style={{ gap: 6 }}>
            <Body>📁 {folderLabel(settings.autoBackupDir)}</Body>
            {settings.autoBackupError ? (
              <Body style={{ color: c.danger }}>Last backup failed: {settings.autoBackupError}</Body>
            ) : (
              <Body muted>
                {settings.lastAutoBackupAt
                  ? `Last backup: ${new Date(settings.lastAutoBackupAt).toLocaleString()}`
                  : 'No backup yet.'}
              </Body>
            )}
            <View style={[s.inline, { marginTop: 6 }]}>
              <Button
                title="Back up now"
                kind="secondary"
                onPress={async () => {
                  const r = await backupNow();
                  Alert.alert(r?.autoBackupError ? 'Backup failed' : 'Backed up', r?.autoBackupError || 'Saved habit-tracker-latest.json.');
                }}
              />
              <Button title="Change folder" kind="secondary" onPress={chooseFolder} />
              <Button title="Turn off" kind="secondary" onPress={() => updateSettings({ autoBackupDir: '' })} />
            </View>
          </View>
        ) : (
          <Button title="Choose backup folder" onPress={chooseFolder} />
        )}
        <Body muted style={{ marginTop: 10, fontSize: 13 }}>
          To restore after reinstalling: Restore from backup → pick habit-tracker-latest.json in that folder.
        </Body>
      </Card>

      <Card>
        <Label>Advanced</Label>
        <Body>Week starts on</Body>
        <View style={{ marginTop: 8 }}>
          <Segmented
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
              { value: '6', label: 'Saturday' },
            ]}
            value={String(settings.weekStartDay)}
            onChange={(v) => updateSettings({ weekStartDay: Number(v) as 0 | 1 | 6 })}
          />
        </View>
        <Body muted style={{ fontSize: 13, marginTop: 6 }}>Used for “X times per week” habits, weekly stats and calendars.</Body>
        <View style={[s.inline, { marginTop: 14 }]}>
          <Body>Snooze button length</Body>
          <NumberInput value={settings.snoozeMinutes} min={1} onChange={(n) => updateSettings({ snoozeMinutes: n })} />
          <Body muted>minutes</Body>
        </View>
        <Button title="Reset settings to defaults" kind="secondary" style={{ marginTop: 14 }} onPress={resetSettings} />
      </Card>

      <Card style={{ borderColor: c.danger }}>
        <Label>Delete data</Label>
        <View style={{ gap: 10 }}>
          <Button title="Delete habit history" kind="danger" onPress={() => confirmWipe('history')} />
          <Button title="Delete all workouts" kind="danger" onPress={() => confirmWipe('workouts')} />
          <Button title="Delete everything" kind="danger" onPress={() => confirmWipe('everything')} />
        </View>
        <Body muted style={{ marginTop: 8, fontSize: 13 }}>To delete a single habit or workout, open it and use Delete there.</Body>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
