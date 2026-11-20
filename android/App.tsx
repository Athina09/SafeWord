import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, SafeAreaView, StatusBar as RNStatusBar, StyleSheet } from 'react-native';

import { api } from './src/api/client';
import type { Account, Payee, PinType, Signals } from './src/api/types';
import { collectSignals, BehaviourTracker } from './src/collector';
import { DemoBanner } from './src/components/DemoBanner';
import { DemoPanel } from './src/components/DemoPanel';
import { ApprovalsScreen } from './src/screens/ApprovalsScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { FormScreen } from './src/screens/FormScreen';
import { HomeScreen, type HistoryItem } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { PinScreen } from './src/screens/PinScreen';
import { ResultScreen, type UiState } from './src/screens/ResultScreen';
import { SendScreen } from './src/screens/SendScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { defaultSignals } from './src/signals';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './src/settings';

type Screen = 'consent' | 'login' | 'family' | 'home' | 'send' | 'pin' | 'result' | 'addPayee' | 'limit' | 'settings';

const MIN_PROCESSING_MS = 1200; // every payment takes at least this long, so timing never reveals the PIN used
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [screen, setScreen] = useState<Screen>('consent');
  const [account, setAccount] = useState<Account | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [signals, setSignals] = useState<Signals>(defaultSignals());
  const [live, setLive] = useState(false);
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState<{ payee: Payee; amount: number } | null>(null);
  const [ui, setUi] = useState<UiState>('success');
  const [paymentId, setPaymentId] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const tracker = useRef(new BehaviourTracker()).current;

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const fail = (e: unknown) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
  const home = async () => {
    try {
      if (account) setAccount(await api.getAccount(account.id));
      setScreen('home');
    } catch (e) {
      fail(e);
    }
  };

  // The consent screen explains each signal; permissions are only requested after "I understand".
  const accept = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
      } catch {
        // denied or unavailable: demo signals still work
      }
    }
    setScreen('login');
  };

  const login = async (id: string) => {
    try {
      setAccount(await api.getAccount(id));
      setScreen('home');
    } catch (e) {
      fail(e);
    }
  };

  const labelFor = (status: UiState): HistoryItem['label'] =>
    status === 'success' ? 'Successful' : status === 'cancelled' ? 'Cancelled' : 'Pending';
  // History never distinguishes a duress hold from any other pending payment.
  const setLastLabel = (status: UiState) =>
    setHistory((h) => (h.length ? [{ ...h[0], label: labelFor(status) }, ...h.slice(1)] : h));

  const submitPin = async (pin_type: PinType) => {
    if (!draft || !account) return;
    try {
      const sent = collectSignals(signals, tracker, 11, { liveBehaviour: live });
      const [res] = await Promise.all([
        api.initiatePayment({
          account_id: account.id,
          payee_id: draft.payee.id,
          amount: draft.amount,
          pin_type,
          signals: sent,
        }),
        sleep(MIN_PROCESSING_MS),
      ]);
      setPaymentId(res.payment_id);
      setReasons(res.reasons);
      // A duress hold renders as the ordinary "pending" screen, identical to any other pending payment.
      const next: UiState =
        res.decision === 'allow' ? 'success' : res.decision === 'prompt' ? 'prompt' : pin_type === 'duress' ? 'pending' : 'held';
      setUi(next);
      setHistory((h) => [{ id: res.payment_id, payee: draft.payee.name, amount: draft.amount, label: labelFor(next) }, ...h]);
      setScreen('result');
    } catch (e) {
      fail(e);
    }
  };

  const confirm = async () => {
    try {
      await api.confirmPayment(paymentId);
      setUi('success');
      setLastLabel('success');
    } catch (e) {
      fail(e);
    }
  };
  const cancel = async () => {
    try {
      await api.cancelPayment(paymentId);
      setUi('cancelled');
      setLastLabel('cancelled');
    } catch (e) {
      fail(e);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <DemoBanner onSecret={() => setPanel(true)} />
      {panel && <DemoPanel signals={signals} live={live} onChange={setSignals} onLive={setLive} onClose={() => setPanel(false)} />}
      {screen === 'consent' && <ConsentScreen onAccept={accept} />}
      {screen === 'login' && <LoginScreen onLogin={login} onFamily={() => setScreen('family')} />}
      {screen === 'family' && <ApprovalsScreen onExit={() => setScreen('login')} />}
      {screen === 'home' && account && (
        <HomeScreen
          account={account}
          history={history}
          onSend={() => setScreen('send')}
          onAddPayee={() => setScreen('addPayee')}
          onLimit={() => setScreen('limit')}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'settings' && <SettingsScreen settings={settings} onChange={updateSettings} onBack={home} />}
      {screen === 'send' && account && (
        <SendScreen
          balance={account.balance}
          payees={account.payees}
          onBack={home}
          onNext={(payee, amount) => {
            setDraft({ payee, amount });
            tracker.begin();
            setScreen('pin');
          }}
        />
      )}
      {screen === 'pin' && <PinScreen duressPin={settings.duressPin} onSubmit={submitPin} onKey={() => tracker.key()} />}
      {screen === 'result' && (
        <ResultScreen
          state={ui}
          reasons={reasons}
          lang={settings.lang}
          trustedName={settings.trustedName}
          trustedPhone={settings.trustedPhone}
          onContinue={confirm}
          onCancel={cancel}
          onDone={home}
        />
      )}
      {screen === 'addPayee' && account && (
        <FormScreen
          title="Add payee"
          fields={[{ key: 'name', label: 'Name' }, { key: 'upi', label: 'UPI ID' }]}
          submitLabel="Add payee"
          onBack={home}
          onSubmit={async (v) => {
            try {
              await api.addPayee(account.id, v.name, v.upi, signals);
              await home();
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}
      {screen === 'limit' && account && (
        <FormScreen
          title="Change daily limit"
          fields={[{ key: 'limit', label: `New limit in ₹ (now ₹${account.daily_limit})`, numeric: true }]}
          submitLabel="Save limit"
          onBack={home}
          onSubmit={async (v) => {
            try {
              await api.setLimit(account.id, Number(v.limit), signals);
              await home();
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9', paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0 },
});
