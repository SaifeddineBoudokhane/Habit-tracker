import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/constants/theme';

/**
 * Scrolling screen that keeps the focused input above the keyboard, with an optional footer
 * (e.g. the Save button) that stays visible and rides on top of the keyboard.
 *
 * Android draws apps edge-to-edge, so the window no longer shrinks when the keyboard opens:
 * without this, anything in the lower part of a form sits behind the keyboard and can't be tapped.
 */
export function FormScreen({
  children,
  footer,
  contentStyle,
}: {
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: ViewStyle;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollView
        bottomOffset={footer ? 96 : 24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { paddingBottom: (footer ? 24 : 48) + insets.bottom }, contentStyle]}>
        {children}
      </KeyboardAwareScrollView>
      {footer ? (
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
          <View style={[s.footer, { backgroundColor: c.card, borderColor: c.border, paddingBottom: 12 + insets.bottom }]}>
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
});
