import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../components/ui';
import { colors } from '../theme';

const SIGNALS = [
  ['📞', 'Phone call status', 'We check whether you are on a call, and whether the caller is in your contacts. We never hear the call.'],
  ['🖥️', 'Screen sharing', 'We check whether your screen is being recorded or shared, which scammers use to watch you pay.'],
  ['✋', 'How you type and pay', 'We compare your speed and timing with your usual habits, on your phone. Only a score leaves the phone.'],
];

export function ConsentScreen({ onAccept }: { onAccept: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Help us protect you</Text>
      <Text style={styles.body}>SafeWord looks at three things, only to spot scams while you pay:</Text>
      {SIGNALS.map(([icon, title, desc]) => (
        <Card key={title} style={styles.item}>
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.itemBody}>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemText}>{desc}</Text>
          </View>
        </Card>
      ))}
      <Text style={styles.body}>No recordings, messages or contacts are sent to the bank.</Text>
      <Button label="I understand, continue" onPress={onAccept} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 22, gap: 14, backgroundColor: colors.bg },
  title: { fontSize: 30, fontWeight: '800', color: colors.text },
  body: { fontSize: 18, lineHeight: 26, color: colors.text },
  item: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon: { fontSize: 30 },
  itemBody: { flex: 1, gap: 2 },
  itemTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  itemText: { fontSize: 16, lineHeight: 23, color: colors.muted },
});
