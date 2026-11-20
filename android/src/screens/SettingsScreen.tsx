import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PinPad } from '../components/PinPad';
import { REAL_PIN, type Lang, type Settings } from '../settings';
import { LANG_NAMES } from '../voice';

type Mode = 'main' | 'set' | 'confirm' | 'practice' | 'practiceDone';

export function SettingsScreen({
  settings,
  onChange,
  onBack,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<Mode>('main');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');

  if (mode === 'set' || mode === 'confirm') {
    return (
      <PinPad
        key={mode}
        title={mode === 'set' ? 'Choose your SafeWord PIN' : 'Enter it again'}
        error={error}
        onComplete={(pin) => {
          if (mode === 'set') {
            if (pin === REAL_PIN) return setError('This must be different from your normal PIN');
            setError('');
            setFirst(pin);
            return setMode('confirm');
          }
          if (pin !== first) {
            setError("The PINs didn't match. Start again.");
            return setMode('set');
          }
          onChange({ ...settings, duressPin: pin });
          setError('');
          setMode('main');
        }}
      />
    );
  }

  if (mode === 'practice') {
    return (
      <PinPad
        title="Practice: enter your SafeWord PIN"
        error={error}
        onComplete={(pin) => {
          if (pin === settings.duressPin) setMode('practiceDone');
          else setError('That is not your SafeWord PIN. Try again.');
        }}
      />
    );
  }

  if (mode === 'practiceDone') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Practice complete</Text>
        <Text style={styles.body}>
          In a real payment this would show "Payment pending" exactly like any other pending payment, while the bank
          quietly holds your money and alerts its fraud team. No money moved just now.
        </Text>
        <Pressable style={styles.primary} onPress={() => setMode('main')}><Text style={styles.primaryText}>Done</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.section}>SafeWord PIN</Text>
      <Text style={styles.body}>
        If someone is forcing you to pay, enter this second PIN instead of your normal one. The screen will look
        like an ordinary pending payment, but the bank holds the money and alerts its fraud team. It is never
        released just because time passed.
      </Text>
      <Pressable style={styles.primary} onPress={() => { setError(''); setMode('set'); }}>
        <Text style={styles.primaryText}>{settings.duressPin ? 'Change SafeWord PIN' : 'Set SafeWord PIN'}</Text>
      </Pressable>
      {settings.duressPin && (
        <Pressable style={styles.secondary} onPress={() => { setError(''); setMode('practice'); }}>
          <Text style={styles.secondaryText}>Practice (no money moves)</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Voice language</Text>
      <View style={styles.row}>
        {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
          <Pressable key={l} style={[styles.chip, settings.lang === l && styles.chipOn]} onPress={() => onChange({ ...settings, lang: l })}>
            <Text style={styles.chipText}>{LANG_NAMES[l]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Family member who can approve large payments</Text>
      <TextInput style={styles.input} placeholder="Name" value={settings.trustedName} onChangeText={(t) => onChange({ ...settings, trustedName: t })} />
      <TextInput style={styles.input} placeholder="Phone number" keyboardType="phone-pad" value={settings.trustedPhone} onChangeText={(t) => onChange({ ...settings, trustedPhone: t })} />

      <Pressable style={styles.back} onPress={onBack}><Text style={styles.backText}>Back</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  center: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  section: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  body: { fontSize: 17, lineHeight: 25 },
  row: { flexDirection: 'row', gap: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  chipOn: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  chipText: { fontSize: 18 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, fontSize: 18 },
  primary: { backgroundColor: '#1d4ed8', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  secondary: { padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  secondaryText: { fontSize: 18 },
  back: { padding: 12, alignItems: 'center' },
  backText: { fontSize: 16, color: '#475569' },
});
