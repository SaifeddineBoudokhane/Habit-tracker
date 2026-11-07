// App entry. Background work must be registered here, at module scope, because Android can start
// the JS bundle headlessly (notification buttons, reminder refresh, home-screen widget) without
// rendering any screen.
import './src/notifications/tasks';

import { Platform } from 'react-native';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import { HabitWidgetConfiguration } from './src/widget/configure';
import { widgetTaskHandler } from './src/widget/handler';

import 'expo-router/entry';

if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
  registerWidgetConfigurationScreen(HabitWidgetConfiguration);
}
