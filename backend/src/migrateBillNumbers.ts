import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { initializeFirebase } from './firebase.js';

type CustomerRecord = {
  id: string;
  name: string;
  address: string;
  ref: DocumentReference;
};

type BillRecord = {
  id: string;
  ref: DocumentReference;
  data: FirebaseFirestore.DocumentData;
  date: Date;
  customerId: string;
};

type WriteOperation = {
  ref: DocumentReference;
  data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>;
};

const parseBillDate = (value: unknown, billId: string): Date => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value !== 'string') {
    throw new Error(`Bill ${billId} has no valid date.`);
  }

  const normalized = value.trim();
  let date: Date;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(normalized);
  const dmySlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (dmy || dmySlash) {
    const [, day, month, year] = (dmy || dmySlash)!;
    date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  } else if (ymd) {
    const [, year, month, day] = ymd;
    date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  } else {
    date = new Date(normalized);
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Bill ${billId} has an unparseable date: ${normalized}`);
  }
  if ((dmy || dmySlash || ymd) && !Number.isNaN(date.getTime())) {
    const expected = dmy || dmySlash
      ? (dmy || dmySlash)!.slice(1).map(Number)
      : ymd!.slice(1).map(Number);
    const [first, second, third] = expected;
    const [year, month, day] = dmy || dmySlash
      ? [third, second, first]
      : [first, second, third];
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error(`Bill ${billId} has an invalid calendar date: ${normalized}`);
    }
  }
  return date;
};

const normalize = (value: unknown): string => String(value || '').trim().toLocaleLowerCase();

const findCustomer = (billData: FirebaseFirestore.DocumentData, customers: CustomerRecord[], billId: string): string => {
  if (typeof billData.customerId === 'string' && customers.some(customer => customer.id === billData.customerId)) {
    return billData.customerId;
  }

  const name = normalize(billData.customerName);
  const address = normalize(billData.address);
  const exactMatches = customers.filter(customer =>
    normalize(customer.name) === name && normalize(customer.address) === address
  );
  if (exactMatches.length === 1) return exactMatches[0].id;

  if (exactMatches.length > 1) {
    throw new Error(`Bill ${billId} matches multiple customers by name and address; assign its customerId before migration.`);
  }

  const srsMatches = name.includes('srs')
    ? customers.filter(customer => normalize(customer.address) === address && normalize(customer.name).includes('srs'))
    : [];
  if (srsMatches.length === 1) return srsMatches[0].id;

  throw new Error(`Bill ${billId} could not be matched to a customer document. No writes were performed.`);
};

const migrateBillNumbers = async (): Promise<void> => {
  const { db, isConnected } = initializeFirebase();
  if (!db || !isConnected) {
    throw new Error('Firebase Admin is not configured. Configure backend/.env or serviceAccountKey.json before migrating.');
  }

  const [customersSnapshot, billsSnapshot] = await Promise.all([
    db.collection('customers').get(),
    db.collection('bills').get()
  ]);
  const customers: CustomerRecord[] = customersSnapshot.docs.map(snapshot => ({
    id: snapshot.id,
    name: String(snapshot.data().name || ''),
    address: String(snapshot.data().address || ''),
    ref: snapshot.ref
  }));
  const customerIds = new Set(customers.map(customer => customer.id));

  const bills: BillRecord[] = billsSnapshot.docs.map(snapshot => {
    const data = snapshot.data();
    const date = parseBillDate(data.date, snapshot.id);
    return {
      id: snapshot.id,
      ref: snapshot.ref,
      data,
      date,
      customerId: findCustomer(data, customers, snapshot.id)
    };
  });

  bills.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));

  const counts = new Map<string, number>();
  const writes: WriteOperation[] = [];
  for (const bill of bills) {
    if (!customerIds.has(bill.customerId)) {
      throw new Error(`Bill ${bill.id} references unknown customer ${bill.customerId}. No writes were performed.`);
    }
    const billNo = (counts.get(bill.customerId) || 0) + 1;
    counts.set(bill.customerId, billNo);
    writes.push({
      ref: bill.ref,
      data: {
        customerId: bill.customerId,
        billNo,
        date: Timestamp.fromDate(bill.date)
      }
    });
  }
  for (const customer of customers) {
    writes.push({
      ref: customer.ref,
      data: { lastBillNo: counts.get(customer.id) || 0 }
    });
  }

  for (let start = 0; start < writes.length; start += 400) {
    const batch = db.batch();
    for (const write of writes.slice(start, start + 400)) {
      batch.update(write.ref, write.data);
    }
    await batch.commit();
  }

  console.log(`Migrated ${bills.length} bills across ${customers.length} customers.`);
};

migrateBillNumbers().catch(error => {
  console.error('Bill-number migration failed:', error);
  process.exitCode = 1;
});
