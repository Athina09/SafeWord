import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export interface Field {
  key: string;
  label: string;
  numeric?: boolean;
}

// Shared by "Add payee" and "Change daily limit".
export function FormScreen({
  title,
  fields,
  submitLabel,
  onSubmit,
  onBack,
}: {
  title: string;
  fields: Field[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const ready = fields.every((f) => (values[f.key] ?? '').trim() !== '');
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {fields.map((f) => (
        <View key={f.key}>
          <Text style={styles.label}>{f.label}</Text>
          <TextInput
            style={styles.input}
            keyboardType={f.numeric ? 'number-pad' : 'default'}
            autoCapitalize="none"
            value={values[f.key] ?? ''}
            onChangeText={(t) => setValues({ ...values, [f.key]: t })}
          />
        </View>
      ))}
      <Pressable style={[styles.primary, !ready && styles.disabled]} disabled={!ready} onPress={() => onSubmit(values)}>
        <Text style={styles.primaryText}>{submitLabel}</Text>
      </Pressable>
      <Pressable style={styles.back} onPress={onBack}><Text style={styles.backText}>Back</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  label: { fontSize: 16, color: '#475569', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, fontSize: 20 },
  primary: { backgroundColor: '#1d4ed8', padding: 18, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  back: { padding: 12, alignItems: 'center' },
  backText: { fontSize: 16, color: '#475569' },
});
