import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../api/client';
import type { Approval } from '../api/types';

// M5: the trusted family member's view. Polls for held payments that need their decision.
export function ApprovalsScreen({ onExit }: { onExit: () => void }) {
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await api.getApprovals());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const decide = async (id: string, approve: boolean) => {
    try {
      await api.decideApproval(id, approve);
      await load();
    } catch (e) {
      Alert.alert('Could not save your answer', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Payments waiting for you</Text>
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      {items.length === 0 && <Text style={styles.body}>Nothing needs your approval right now.</Text>}
      {items.map((a) => (
        <View key={a.payment_id} style={styles.card}>
          <Text style={styles.cardTitle}>{a.senior_name} wants to send ₹{a.amount.toLocaleString('en-IN')}</Text>
          <Text style={styles.body}>To: {a.payee_name}</Text>
          <Text style={styles.why}>Why the bank paused it:</Text>
          {a.reasons.map((r) => <Text key={r} style={styles.reason}>• {r}</Text>)}
          <Text style={styles.body}>Call {a.senior_name} first. Only approve if you are sure they are not being pressured.</Text>
          <Pressable style={styles.reject} onPress={() => decide(a.payment_id, false)}><Text style={styles.btnText}>Reject</Text></Pressable>
          <Pressable style={styles.approve} onPress={() => decide(a.payment_id, true)}><Text style={styles.btnText}>Approve</Text></Pressable>
        </View>
      ))}
      <Pressable style={styles.back} onPress={onExit}><Text style={styles.backText}>Leave family view</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14 },
  title: { fontSize: 26, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 24 },
  error: { color: '#b91c1c', fontSize: 15 },
  card: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  why: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  reason: { fontSize: 16, color: '#475569' },
  approve: { backgroundColor: '#15803d', padding: 16, borderRadius: 12, alignItems: 'center' },
  reject: { backgroundColor: '#b91c1c', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  back: { padding: 12, alignItems: 'center' },
  backText: { fontSize: 16, color: '#475569' },
});
