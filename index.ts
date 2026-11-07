// App entry. Background work must be registered here, at module scope, because Android can start
// the JS bundle headlessly (notification buttons, reminder refresh, home-screen widget) without
// rendering any screen.
import './src/notifications/tasks';

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './src/widget/handler';

import 'expo-router/entry';

if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}
