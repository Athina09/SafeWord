import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Account } from '../api/types';
import { Button, Card, Pill } from '../components/ui';
import { colors, font } from '../theme';

export interface HistoryItem {
  id: string;
  payee: string;
  amount: number;
  label: 'Successful' | 'Pending' | 'Cancelled';
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const TONE = { Successful: 'success', Pending: 'warn', Cancelled: 'muted' } as const;

export function HomeScreen({
  account,
  history,
  onSend,
  onAddPayee,
  onLimit,
  onSettings,
}: {
  account: Account;
  history: HistoryItem[];
  onSend: () => void;
  onAddPayee: () => void;
  onLimit: () => void;
  onSettings: () => void;
}) {
  const used = account.hold / Math.max(account.daily_limit, 1);
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hello}>Hello, {account.name}</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        <Text style={styles.balance}>{inr(account.balance)}</Text>
        {account.hold > 0 && <Text style={styles.onHold}>{inr(account.hold)} is being processed</Text>}
        <View style={styles.limitTrack}><View style={[styles.limitFill, { width: `${Math.min(100, used * 100)}%` }]} /></View>
        <Text style={styles.limitText}>Daily limit {inr(account.daily_limit)}</Text>
      </View>

      <Button label="Send money" onPress={onSend} />
      <View style={styles.row}>
        <Button label="Add payee" variant="secondary" onPress={onAddPayee} style={styles.half} />
        <Button label="Limit" variant="secondary" onPress={onLimit} style={styles.half} />
      </View>
      <Button label="Settings & SafeWord PIN" variant="ghost" onPress={onSettings} />

      <Text style={styles.section}>Recent payments</Text>
      <Card>
        {history.length === 0 && <Text style={styles.muted}>No payments yet</Text>}
        {history.slice(0, 6).map((h) => (
          <View key={h.id} style={styles.item}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{h.payee.charAt(0)}</Text></View>
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{h.payee}</Text>
              <Text style={styles.muted}>{inr(h.amount)}</Text>
            </View>
            <Pill label={h.label} tone={TONE[h.label]} />
          </View>
        ))}
      </Card>

      <Text style={styles.section}>Payees</Text>
      <Card>
        {account.payees.map((p) => (
          <View key={p.id} style={styles.item}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{p.name.charAt(0)}</Text></View>
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>{p.name}</Text>
              <Text style={styles.muted}>{p.upi_id}</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, backgroundColor: colors.bg },
  hello: { fontSize: font.heading, color: colors.text, fontWeight: '600' },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 22, padding: 22, gap: 4 },
  balanceLabel: { color: '#bfdbfe', fontSize: 15 },
  balance: { color: '#fff', fontSize: 40, fontWeight: '800' },
  onHold: { color: '#fde68a', fontSize: 15, fontWeight: '600' },
  limitTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  limitFill: { height: 6, backgroundColor: '#fff' },
  limitText: { color: '#bfdbfe', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  section: { fontSize: font.heading, fontWeight: '700', color: colors.text, marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: 18 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 15 },
});
