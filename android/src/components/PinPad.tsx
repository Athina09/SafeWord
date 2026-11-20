import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

// Shared by the payment PIN screen, SafeWord PIN registration and practice mode, so all look identical.
export function PinPad({
  title,
  error,
  onComplete,
  onKey,
}: {
  title: string;
  error?: string;
  onComplete: (pin: string) => void;
  onKey?: () => void;
}) {
  const [pin, setPin] = useState('');

  const press = (d: string) => {
    onKey?.();
    const next = pin + d;
    if (next.length < 4) return setPin(next);
    setPin('');
    onComplete(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.error}>{error ?? ' '}</Text>
      <View style={styles.pad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
          <View key={i} style={styles.cell}>
            {k !== '' && (
              <Pressable
                accessibilityLabel={k === '⌫' ? 'Delete' : k}
                style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                onPress={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))}
              >
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 18, marginVertical: 10 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary },
  dotOn: { backgroundColor: colors.primary },
  error: { color: colors.danger, fontSize: 16, minHeight: 22 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 300, justifyContent: 'center' },
  cell: { width: 100, height: 84, alignItems: 'center', justifyContent: 'center' },
  key: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  keyPressed: { backgroundColor: colors.primarySoft },
  keyText: { fontSize: 28, color: colors.text, fontWeight: '600' },
});
