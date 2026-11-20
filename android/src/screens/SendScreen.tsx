import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Payee } from '../api/types';

export function SendScreen({
  balance,
  payees,
  onNext,
  onBack,
}: {
  balance: number;
  payees: Payee[];
  onNext: (payee: Payee, amount: number) => void;
  onBack: () => void;
}) {
  const [payee, setPayee] = useState<Payee | undefined>(payees[0]);
  const [amount, setAmount] = useState('');
  const value = Number(amount);
  const valid = payee !== undefined && value > 0 && value <= balance;

  return (
    <View style={styles.container}>
      <Text style={styles.balance}>Balance ₹{balance.toLocaleString('en-IN')}</Text>
      <Text style={styles.label}>Pay to</Text>
      {payees.map((p) => (
        <Pressable key={p.id} onPress={() => setPayee(p)} style={[styles.payee, p.id === payee?.id && styles.selected]}>
          <Text style={styles.payeeText}>{p.name}</Text>
        </Pressable>
      ))}
      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={amount} onChangeText={setAmount} />
      <Pressable
        style={[styles.button, !valid && styles.disabled]}
        disabled={!valid}
        onPress={() => payee && onNext(payee, value)}
      >
        <Text style={styles.buttonText}>Proceed to pay</Text>
      </Pressable>
      <Pressable style={styles.back} onPress={onBack}><Text style={styles.backText}>Back</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  balance: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 16, color: '#475569', marginTop: 8 },
  payee: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  selected: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  payeeText: { fontSize: 18 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, fontSize: 24 },
  button: { backgroundColor: '#1d4ed8', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  back: { padding: 12, alignItems: 'center' },
  backText: { fontSize: 16, color: '#475569' },
});
