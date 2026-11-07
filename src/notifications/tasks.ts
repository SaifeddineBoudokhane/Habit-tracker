/**
 * Background tasks. This module must be imported at app start-up (module scope) so the
 * tasks are defined before Android launches the JS bundle headlessly to run them.
 */
import * as BackgroundTask from 'expo-background-task';
import type * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { NOTIFICATION_TASK, REFRESH_TASK, handleNotificationResponse, syncReminders } from './scheduler';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  try {
    await handleNotificationResponse(data);
  } catch (e) {
    console.warn('Notification action failed', e);
  }
});

/** Runs a few times a day so the 7-day reminder window keeps rolling even if the app isn't opened. */
TaskManager.defineTask(REFRESH_TASK, async () => {
  try {
    await syncReminders();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
