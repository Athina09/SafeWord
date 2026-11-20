import * as Contacts from 'expo-contacts/legacy';

const digits = (n: string) => n.replace(/\D/g, '').slice(-10);

// Used once a call provider supplies the caller's number (see docs/native-signals.md).
export async function isInContacts(number: string): Promise<boolean | null> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return null;
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
    const target = digits(number);
    return data.some((c) => c.phoneNumbers?.some((p) => digits(p.number ?? '') === target));
  } catch {
    return null;
  }
}
