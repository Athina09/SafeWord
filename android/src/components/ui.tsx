import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radius, shadow } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      <Text style={[styles.label, variant === 'primary' || variant === 'danger' ? styles.onDark : styles.onLight]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone }: { label: string; tone: 'success' | 'warn' | 'danger' | 'muted' }) {
  const map = {
    success: [colors.successSoft, colors.success],
    warn: [colors.warnSoft, colors.warn],
    danger: [colors.dangerSoft, colors.danger],
    muted: [colors.border, colors.muted],
  } as const;
  return (
    <View style={[styles.pill, { backgroundColor: map[tone][0] }]}>
      <Text style={[styles.pillText, { color: map[tone][1] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: radius.button, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  label: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  onDark: { color: '#fff' },
  onLight: { color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 18, ...shadow },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 14, fontWeight: '700' },
});
