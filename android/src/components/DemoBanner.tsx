import { Pressable, StyleSheet, Text } from 'react-native';

// Long-press opens the hidden demo-signals panel.
export function DemoBanner({ onSecret }: { onSecret: () => void }) {
  return (
    <Pressable style={styles.banner} onLongPress={onSecret} delayLongPress={800}>
      <Text style={styles.text}>DEMO — not a real bank</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#b45309', paddingVertical: 6, alignItems: 'center' },
  text: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
});
