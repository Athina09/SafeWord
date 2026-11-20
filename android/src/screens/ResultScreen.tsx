import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../components/ui';
import type { Lang } from '../settings';
import { colors } from '../theme';
import { PROMPTS, speakPrompt, stopSpeaking } from '../voice';

export type UiState = 'success' | 'pending' | 'prompt' | 'held' | 'cancelled';

const COPY: Record<UiState, { icon: string; title: string; body: string; tone: string; soft: string }> = {
  success: { icon: '✓', title: 'Payment successful', body: 'Your money has been sent.', tone: colors.success, soft: colors.successSoft },
  pending: { icon: '…', title: 'Payment pending', body: 'Your payment is being processed. This can take a little while.', tone: colors.warn, soft: colors.warnSoft },
  prompt: { icon: '!', title: 'Please pause', body: '', tone: colors.warn, soft: colors.warnSoft },
  held: { icon: '⏳', title: 'Waiting for approval', body: 'Your chosen family member has been asked to approve this payment.', tone: colors.primary, soft: colors.primarySoft },
  cancelled: { icon: '×', title: 'Payment cancelled', body: 'No money was sent.', tone: colors.muted, soft: colors.border },
};

const PAUSE_SECONDS = 5;

export function ResultScreen({
  state,
  reasons,
  lang,
  trustedName,
  trustedPhone,
  onContinue,
  onCancel,
  onDone,
}: {
  state: UiState;
  reasons: string[];
  lang: Lang;
  trustedName: string;
  trustedPhone: string;
  onContinue: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { icon, title, body, tone, soft } = COPY[state];
  const [wait, setWait] = useState(PAUSE_SECONDS);

  useEffect(() => {
    if (state !== 'prompt') return;
    speakPrompt(lang);
    const t = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => {
      clearInterval(t);
      stopSpeaking();
    };
  }, [state, lang]);

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: soft }]}><Text style={[styles.icon, { color: tone }]}>{icon}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {body !== '' && <Text style={styles.body}>{body}</Text>}
      {state === 'prompt' && (
        <>
          <Card style={styles.promptCard}>
            <Text style={styles.body}>{PROMPTS[lang]}</Text>
            {reasons.map((r) => <Text key={r} style={styles.reason}>• {r}</Text>)}
          </Card>
          <Button label="🔊  Listen again" variant="secondary" onPress={() => speakPrompt(lang)} />
          <Button
            label={`Call my family${trustedName ? ` (${trustedName})` : ''}`}
            disabled={!trustedPhone}
            onPress={() => Linking.openURL(`tel:${trustedPhone}`)}
          />
          <Button label="Cancel payment" variant="danger" onPress={onCancel} />
          <Button label={wait > 0 ? `Continue anyway (wait ${wait}s)` : 'Continue anyway'} variant="ghost" disabled={wait > 0} onPress={onContinue} />
        </>
      )}
      {state !== 'prompt' && <Button label="Done" onPress={onDone} style={styles.done} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 14, backgroundColor: colors.bg },
  badge: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  icon: { fontSize: 44, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 18, lineHeight: 27, color: colors.text, textAlign: 'center' },
  promptCard: { gap: 8 },
  reason: { fontSize: 16, color: colors.muted },
  done: { marginTop: 10 },
});
