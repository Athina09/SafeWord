import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { Signals } from '../api/types';

const LEVELS = [0.05, 0.6, 0.8];

// Hidden panel (long-press the DEMO banner). Screen-share and call state have no native hook yet,
// so these switches ARE the signals; see docs/native-signals.md.
export function DemoPanel({
  signals,
  live,
  onChange,
  onLive,
  onClose,
}: {
  signals: Signals;
  live: boolean;
  onChange: (s: Signals) => void;
  onLive: (v: boolean) => void;
  onClose: () => void;
}) {
  const row = (label: string, value: boolean, set: (v: boolean) => void) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={set} />
    </View>
  );
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Demo signals</Text>
      {row('Call active', signals.call_active, (v) => onChange({ ...signals, call_active: v }))}
      {row('Caller in contacts', signals.caller_in_contacts === true, (v) => onChange({ ...signals, caller_in_contacts: v }))}
      {row('Screen shared', signals.screen_shared, (v) => onChange({ ...signals, screen_shared: v }))}
      <View style={styles.row}>
        <Text style={styles.label}>Behaviour</Text>
        {LEVELS.map((l) => (
          <Pressable key={l} onPress={() => { onLive(false); onChange({ ...signals, behaviour_anomaly: l }); }} style={[styles.chip, !live && signals.behaviour_anomaly === l && styles.chipOn]}>
            <Text>{l}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => onLive(true)} style={[styles.chip, live && styles.chipOn]}><Text>live</Text></Pressable>
      </View>
      <Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>Close</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#fef3c7', padding: 14, gap: 8 },
  title: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  label: { fontSize: 15 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#92400e' },
  chipOn: { backgroundColor: '#fbbf24' },
  close: { alignSelf: 'flex-end', padding: 6 },
  closeText: { fontWeight: '700' },
});
