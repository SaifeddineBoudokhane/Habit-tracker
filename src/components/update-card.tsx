import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { space, tint, type as typo, useColors } from '@/constants/theme';
import { checkForUpdate, RELEASES_PAGE, type UpdateCheck } from '@/lib/updates';

import { Icon } from './icon';
import { Body, Button, Card, Label } from './ui';

/** CI sets the versionCode to the build number; local builds are 1. */
export const CURRENT_BUILD = Number(Constants.expoConfig?.android?.versionCode ?? 1);

/** Settings → App updates. Only touches the network when you tap the button. */
export function UpdateCard() {
  const c = useColors();
  const [result, setResult] = useState<UpdateCheck | null>(null);

  const check = async () => setResult(await checkForUpdate(CURRENT_BUILD));
  const open = (url: string) => Linking.openURL(url).catch(() => Linking.openURL(RELEASES_PAGE));

  return (
    <Card>
      <Label>App updates</Label>
      <Body muted style={{ fontSize: 13 }}>
        Habit Tracker {Constants.expoConfig?.version ?? ''}, build {CURRENT_BUILD}
      </Body>

      {result?.status === 'available' && (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tint(c.accent as string, 0.14), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="download" size={20} color={c.accent} />
            </View>
            <Text style={[typo.headline, { color: c.text, flex: 1 }]}>Build {result.release.build} is available</Text>
          </View>
          <Button title="Download update" icon="download" onPress={() => open(result.release.downloadUrl)} />
          <Body muted style={{ fontSize: 13 }}>
            Open the downloaded file to install it over this version. Your habits and history stay. The first time, Android asks you
            to allow installs from your browser.
          </Body>
        </View>
      )}

      {result?.status === 'current' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md }}>
          <Icon name="today-fill" size={18} color={c.success} />
          <Body style={{ flex: 1 }}>You’re on the latest build.</Body>
        </View>
      )}

      {result?.status === 'error' && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: space.md }}>
          <Icon name="warning" size={18} color={c.danger} />
          <Text selectable style={[typo.body, { color: c.danger, flex: 1 }]}>
            {result.message}
          </Text>
        </View>
      )}

      {result?.status !== 'available' && (
        <Button
          title={result ? 'Check again' : 'Check for updates'}
          icon="sync"
          kind="secondary"
          style={{ marginTop: space.md }}
          onPress={check}
        />
      )}
    </Card>
  );
}
