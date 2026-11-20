import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui';
import { colors } from '../theme';

export const TEST_ACCOUNTS = [{ id: 'demo-senior-1', label: 'Kamala Devi (senior)' }];

export function LoginScreen({ onLogin, onFamily }: { onLogin: (accountId: string) => void; onFamily: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.logo}><Text style={styles.logoText}>₹</Text></View>
      <Text style={styles.title}>Demo UPI</Text>
      <Text style={styles.body}>Choose a test account. No real money or bank is involved.</Text>
      {TEST_ACCOUNTS.map((a) => <Button key={a.id} label={a.label} onPress={() => onLogin(a.id)} />)}
      <Button label="I am a family member approving payments" variant="secondary" onPress={onFamily} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 14, backgroundColor: colors.bg },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '800' },
  title: { fontSize: 34, fontWeight: '800', color: colors.text },
  body: { fontSize: 18, lineHeight: 26, color: colors.muted },
});
