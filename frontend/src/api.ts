import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch 
} from 'firebase/firestore';

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const isLocalApiUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configuredApiUrl || '');

// A localhost API URL is reachable only from the developer's machine, not production visitors.
const API_BASE_URL = import.meta.env.PROD && isLocalApiUrl
  ? '/api'
  : configuredApiUrl || '/api';

export interface CustomerData {
  id?: number | string;
  name: string;
  address: string;
  balance: number;
}

export interface BillItem {
  id?: string | number;
  frontendId?: string;
  particulars: string;
  quantity?: string | number;
  qty?: string | number;
  kg?: string | number;
  price?: string | number;
  rate?: string | number;
  amount?: number;
}

export interface SavedBill {
  id?: number | string;
  billNo: string;
  date: string;
  customerName: string;
  address: string;
  items: BillItem[];
  quantity?: number;
  price?: number;
  previousBalance: string | number;
  prevBalance?: string | number;
  advance: string | number;
  receipt?: string | number;
  totalAmount: number;
  finalBalance: number;
  createdAt?: string;
}

// Date helpers to ensure Day-Month-Year (DD-MM-YYYY) format everywhere
export const formatDateToDMY = (dateStr: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed.replace(/\//g, '-');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-');
    return `${dd}-${mm}-${yyyy}`;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('/');
    return `${dd}-${mm}-${yyyy}`;
  }
  return trimmed;
};

export const formatDateToYMD = (dateStr: string): string => {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return trimmed;
};

export const formatDisplayDate = (dateStr: string): string => {
  return formatDateToDMY(dateStr);
};

// Default initial customers list (Tamil)
export const DEFAULT_INITIAL_CUSTOMERS: CustomerData[] = [
  { id: 1, name: "பச்சையப்பன்", address: "கந்தம்பாளையம்", balance: 0 },
  { id: 2, name: "முருகன்", address: "வேட்டவலம்", balance: 0 },
  { id: 3, name: "ஹரிதாஸ்", address: "வேட்டவலம்", balance: 0 },
  { id: 4, name: "முரளி", address: "வேட்டவலம்", balance: 0 },
  { id: 5, name: "பெருமாள்", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 6, name: "கோபி", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 7, name: "முரளி", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 8, name: "ராஜா", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 9, name: "ஏழுமலை", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 10, name: "சுரேஷ்", address: "உளுந்தூர்பேட்டை", balance: 0 },
  { id: 11, name: "விஜி", address: "விருத்தாச்சலம்", balance: 0 },
  { id: 12, name: "SRS சிவராஜ்", address: "விழுப்புரம்", balance: 0 }
];

// Local storage backup helpers
export const getLocalBills = (): SavedBill[] => {
  try {
    const raw = localStorage.getItem('kkm_bills');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    let list: SavedBill[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      list = Object.values(parsed).filter((b: any) => b && typeof b === 'object' && b.billNo) as SavedBill[];
    }
    let modified = false;
    list = list.map((b, idx) => {
      const adv = b.advance !== undefined ? b.advance : (b.receipt !== undefined ? b.receipt : '');
      const prevBal = b.previousBalance !== undefined ? b.previousBalance : (b.prevBalance !== undefined ? b.prevBalance : '');
      const mappedItems = (Array.isArray(b.items) ? b.items : []).map((it: any) => ({
        ...it,
        quantity: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
        qty: it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : ''),
        price: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : ''),
        rate: it.rate !== undefined ? it.rate : (it.price !== undefined ? it.price : '')
      }));

      if (!b.id) {
        modified = true;
        return { 
          ...b, 
          id: Date.now() + idx,
          advance: adv,
          receipt: adv,
          previousBalance: prevBal,
          prevBalance: prevBal,
          items: mappedItems
        };
      }
      return {
        ...b,
        advance: adv,
        receipt: adv,
        previousBalance: prevBal,
        prevBalance: prevBal,
        items: mappedItems
      };
    });

    // Ensure sorted by billNo descending
    list.sort((a, b) => {
      const numA = parseInt(a.billNo) || 0;
      const numB = parseInt(b.billNo) || 0;
      return numB - numA;
    });

    if (modified) {
      saveLocalBills(list);
    }
    return list;
  } catch {
    return [];
  }
};

export const saveLocalBills = (bills: SavedBill[]) => {
  try {
    const arr = Array.isArray(bills)
      ? bills
      : (bills && typeof bills === 'object')
        ? Object.values(bills)
        : [];
    localStorage.setItem('kkm_bills', JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to save bills to localStorage', e);
  }
};

export const getLocalCustomers = (): CustomerData[] => {
  try {
    const raw = localStorage.getItem('kkm_customers');
    if (!raw) {
      saveLocalCustomers(DEFAULT_INITIAL_CUSTOMERS);
      return [...DEFAULT_INITIAL_CUSTOMERS];
    }
    const parsed = JSON.parse(raw);
    let list: CustomerData[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      list = Object.values(parsed).filter((c: any) => c && typeof c === 'object' && c.name) as CustomerData[];
    }

    // Ensure all default initial customers are present in cached list
    let modified = false;
    for (const def of DEFAULT_INITIAL_CUSTOMERS) {
      if (!list.some(c => c.name === def.name && c.address === def.address)) {
        list.push({ ...def, id: def.id || Date.now() });
        modified = true;
      }
    }
    if (modified) {
      saveLocalCustomers(list);
    }
    return list.length > 0 ? list : [...DEFAULT_INITIAL_CUSTOMERS];
  } catch {
    return [...DEFAULT_INITIAL_CUSTOMERS];
  }
};

export const saveLocalCustomers = (customers: CustomerData[]) => {
  try {
    const arr = Array.isArray(customers)
      ? customers
      : (customers && typeof customers === 'object')
        ? Object.values(customers)
        : [];
    localStorage.setItem('kkm_customers', JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to save customers to localStorage', e);
  }
};

// ==========================================
// Customers API (Firebase Firestore & Backup)
// ==========================================

export const getCustomers = async (): Promise<CustomerData[]> => {
  // 1. Try Firebase Firestore
  try {
    const customersCol = collection(db, 'customers');
    const snapshot = await getDocs(customersCol);
    if (!snapshot.empty) {
      const map = new Map<string, CustomerData>();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const name = (data.name || '').trim();
        const address = (data.address || '').trim();
        const balance = Number(data.balance) || 0;
        const key = `${name} - ${address}`;

        const existing = map.get(key);
        if (!existing) {
          map.set(key, {
            id: docSnap.id,
            name,
            address,
            balance,
          });
        } else if (existing.balance === 0 && balance !== 0) {
          map.set(key, {
            id: docSnap.id,
            name,
            address,
            balance,
          });
        }
      });
      const list = Array.from(map.values());
      saveLocalCustomers(list);
      return list;
    } else {
      // Auto seed default customers into Firebase Firestore
      const batch = writeBatch(db);
      const seeded: CustomerData[] = [];
      for (const c of DEFAULT_INITIAL_CUSTOMERS) {
        const newDocRef = doc(collection(db, 'customers'));
        const docData = {
          name: c.name,
          address: c.address,
          balance: c.balance,
          createdAt: new Date().toISOString()
        };
        batch.set(newDocRef, docData);
        seeded.push({ id: newDocRef.id, ...docData });
      }
      await batch.commit();
      saveLocalCustomers(seeded);
      return seeded;
    }
  } catch (firebaseErr) {
    console.warn('[Firebase] Firestore getCustomers fallback:', firebaseErr);
  }

  // 2. Try Node.js Backend
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/customers`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        saveLocalCustomers(data);
        return data;
      }
    }
  } catch {
    // Backend offline, fallback to local
  }

  return getLocalCustomers();
};

export const createCustomer = async (customer: CustomerData): Promise<CustomerData> => {
  // 1. Try Firebase Firestore
  try {
    const docRef = await addDoc(collection(db, 'customers'), {
      name: customer.name.trim(),
      address: (customer.address || '').trim(),
      balance: Number(customer.balance) || 0,
      createdAt: new Date().toISOString()
    });
    const result: CustomerData = {
      id: docRef.id,
      name: customer.name.trim(),
      address: (customer.address || '').trim(),
      balance: Number(customer.balance) || 0
    };
    const current = getLocalCustomers();
    saveLocalCustomers([...current.filter(c => c.name !== result.name || c.address !== result.address), result]);
    return result;
  } catch (firebaseErr) {
    console.warn('[Firebase] Firestore createCustomer fallback:', firebaseErr);
  }

  // 2. Try Backend
  try {
    const res = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    if (res.ok) {
      const data = await res.json();
      const current = getLocalCustomers();
      saveLocalCustomers([...current.filter(c => c.name !== data.name || c.address !== data.address), data]);
      return data;
    }
  } catch {
    // fallback
  }

  // 3. Local fallback
  const result: CustomerData = {
    ...customer,
    id: customer.id || Date.now(),
  };
  const current = getLocalCustomers();
  saveLocalCustomers([...(Array.isArray(current) ? current : []), result]);
  return result;
};

export const updateCustomer = async (id: number | string, customer: CustomerData): Promise<CustomerData> => {
  // 1. Try Firebase Firestore
  try {
    let targetDocId: string | null = (id && typeof id === 'string' && isNaN(Number(id))) ? String(id) : null;
    
    if (!targetDocId) {
      const q = query(
        collection(db, 'customers'), 
        where('name', '==', customer.name.trim())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const match = snap.docs.find(d => (d.data().address || '').trim() === (customer.address || '').trim()) || snap.docs[0];
        targetDocId = match.id;
      }
    }

    if (targetDocId) {
      const docRef = doc(db, 'customers', targetDocId);
      await updateDoc(docRef, {
        name: customer.name.trim(),
        address: (customer.address || '').trim(),
        balance: Number(customer.balance) || 0,
        updatedAt: new Date().toISOString()
      });
      const result: CustomerData = {
        id: targetDocId,
        name: customer.name.trim(),
        address: (customer.address || '').trim(),
        balance: Number(customer.balance) || 0
      };
      const current = getLocalCustomers();
      const safe = Array.isArray(current) ? [...current] : [];
      const idx = safe.findIndex(c => c.id === targetDocId || (c.name === customer.name && c.address === (customer.address || '')));
      if (idx >= 0) safe[idx] = result;
      else safe.push(result);
      saveLocalCustomers(safe);
      return result;
    } else {
      return createCustomer(customer);
    }
  } catch (firebaseErr) {
    console.warn('[Firebase] Firestore updateCustomer fallback:', firebaseErr);
  }

  // 2. Try Node Backend
  try {
    const endpoint = id ? `${API_BASE_URL}/customers/${encodeURIComponent(id)}` : `${API_BASE_URL}/customers`;
    const res = await fetch(endpoint, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    if (res.ok) {
      const data = await res.json();
      const current = getLocalCustomers();
      const safe = Array.isArray(current) ? [...current] : [];
      const idx = safe.findIndex(c => (id && c.id === id) || (c.name === customer.name && c.address === (customer.address || '')));
      if (idx >= 0) safe[idx] = data;
      else safe.push(data);
      saveLocalCustomers(safe);
      return data;
    }
  } catch {
    // fallback
  }

  // 3. Local fallback
  const current = getLocalCustomers();
  const safeCurrent = Array.isArray(current) ? [...current] : [];
  const idx = safeCurrent.findIndex(
    c => (id && c.id === id) || (c.name === customer.name && c.address === (customer.address || ''))
  );
  const updatedCust: CustomerData = {
    ...customer,
    id: id || (idx >= 0 ? safeCurrent[idx].id : Date.now()),
  };
  if (idx >= 0) {
    safeCurrent[idx] = updatedCust;
  } else {
    safeCurrent.push(updatedCust);
  }
  saveLocalCustomers(safeCurrent);
  return updatedCust;
};

export const deleteCustomer = async (id: number | string): Promise<void> => {
  try {
    if (typeof id === 'string' && isNaN(Number(id))) {
      await deleteDoc(doc(db, 'customers', id));
    }
  } catch (firebaseErr) {
    console.warn('[Firebase] Firestore deleteCustomer fallback:', firebaseErr);
  }

  try {
    await fetch(`${API_BASE_URL}/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // ignore
  }

  const current = getLocalCustomers();
  const safeCurrent = Array.isArray(current) ? current : [];
  saveLocalCustomers(safeCurrent.filter(c => c.id !== id));
};

// ==========================================
// Bills API (Firebase Firestore & Backup)
// ==========================================

export const getBills = async (): Promise<SavedBill[]> => {
  // 1. Try Firebase Firestore with resilient in-memory ordering
  try {
    const billsCol = collection(db, 'bills');
    const snapshot = await getDocs(billsCol);
    if (!snapshot.empty) {
      const list: SavedBill[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const adv = data.advance !== undefined ? data.advance : (data.receipt !== undefined ? data.receipt : '');
        const prevBal = data.previousBalance !== undefined ? data.previousBalance : (data.prevBalance !== undefined ? data.prevBalance : '');
        
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const mappedItems: BillItem[] = rawItems.map((it: any) => {
          const q = it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : '');
          const p = it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : '');
          const kg = it.kg !== undefined ? it.kg : '';
          return {
            id: it.id || it.frontendId,
            frontendId: it.frontendId || String(it.id || ''),
            particulars: it.particulars || '',
            quantity: q,
            qty: q,
            kg: kg,
            price: p,
            rate: p,
            amount: (Number(q) || 0) * (Number(p) || 0)
          };
        });

        list.push({
          id: docSnap.id,
          billNo: String(data.billNo || ''),
          date: formatDateToDMY(String(data.date || '')),
          customerName: String(data.customerName || ''),
          address: String(data.address || ''),
          items: mappedItems,
          quantity: Number(data.quantity) || mappedItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
          price: Number(data.price) || (mappedItems.length > 0 ? Number(mappedItems[0].price) || 0 : 0),
          previousBalance: prevBal,
          prevBalance: prevBal,
          advance: adv,
          receipt: adv,
          totalAmount: Number(data.totalAmount) || 0,
          finalBalance: Number(data.finalBalance) || 0,
          createdAt: data.createdAt
        });
      });

      // Reliably order bills descending by billNo (highest/newest first)
      list.sort((a, b) => {
        const numA = parseInt(a.billNo) || 0;
        const numB = parseInt(b.billNo) || 0;
        if (numB !== numA) return numB - numA;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });

      saveLocalBills(list);
      return list;
    }
  } catch (firebaseErr) {
    console.warn('[Firebase] Firestore getBills fallback:', firebaseErr);
  }

  // 2. Try Node Backend
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/bills`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const list: SavedBill[] = data.map((b: any) => {
          const adv = b.advance !== undefined ? b.advance : (b.receipt !== undefined ? b.receipt : '');
          const prevBal = b.previousBalance !== undefined ? b.previousBalance : (b.prevBalance !== undefined ? b.prevBalance : '');
          const mappedItems: BillItem[] = (Array.isArray(b.items) ? b.items : []).map((it: any) => {
            const q = it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : '');
            const p = it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : '');
            const kg = it.kg !== undefined ? it.kg : '';
            return {
              id: it.id || it.frontendId,
              frontendId: it.frontendId || String(it.id || ''),
              particulars: it.particulars || '',
              quantity: q,
              qty: q,
              kg: kg,
              price: p,
              rate: p,
              amount: (Number(q) || 0) * (Number(p) || 0)
            };
          });

          return {
            id: b.id,
            billNo: String(b.billNo || ''),
            date: formatDateToDMY(String(b.date || '')),
            customerName: String(b.customerName || ''),
            address: String(b.address || ''),
            items: mappedItems,
            quantity: Number(b.quantity) || mappedItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
            price: Number(b.price) || (mappedItems.length > 0 ? Number(mappedItems[0].price) || 0 : 0),
            previousBalance: prevBal,
            prevBalance: prevBal,
            advance: adv,
            receipt: adv,
            totalAmount: Number(b.totalAmount) || 0,
            finalBalance: Number(b.finalBalance) || 0,
            createdAt: b.createdAt
          };
        });

        list.sort((a, b) => (parseInt(b.billNo) || 0) - (parseInt(a.billNo) || 0));
        saveLocalBills(list);
        return list;
      }
    }
  } catch {
    // ignore
  }

  return getLocalBills();
};

export const createBill = async (bill: SavedBill): Promise<SavedBill> => {
  const adv = bill.advance !== undefined && bill.advance !== '' ? bill.advance : (bill.receipt ?? '');
  const prevBal = bill.previousBalance !== undefined && bill.previousBalance !== '' ? bill.previousBalance : (bill.prevBalance ?? '');

  const mappedItems: BillItem[] = bill.items.map(item => {
    const q = item.quantity !== undefined && item.quantity !== '' ? item.quantity : (item.qty ?? '');
    const p = item.price !== undefined && item.price !== '' ? item.price : (item.rate ?? '');
    const kg = item.kg !== undefined ? item.kg : '';
    return {
      frontendId: item.id?.toString(),
      particulars: item.particulars,
      quantity: q,
      qty: q,
      kg: kg,
      price: p,
      rate: p,
      amount: (Number(q) || 0) * (Number(p) || 0)
    };
  });

  const totalQty = mappedItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const avgPrice = mappedItems.length > 0 ? (Number(mappedItems[0].price) || 0) : 0;

  // Exact ordered schema:
  // 1. billNo, 2. date, 3. customerName, 4. address, 5. quantity, 6. price,
  // 7. previousBalance, 8. advance (replaced receipt), 9. totalAmount
  const payload = {
    billNo: String(bill.billNo),
    date: formatDateToDMY(String(bill.date)),
    customerName: bill.customerName.trim(),
    address: (bill.address || '').trim(),
    quantity: totalQty,
    price: avgPrice,
    items: mappedItems,
    previousBalance: String(prevBal),
    prevBalance: String(prevBal),
    advance: String(adv),
    receipt: String(adv),
    totalAmount: Number(bill.totalAmount) || 0,
    finalBalance: Number(bill.finalBalance) || 0,
    createdAt: new Date().toISOString()
  };

  // 1. Try Firebase Firestore
  try {
    const docRef = await addDoc(collection(db, 'bills'), payload);
    const savedBillResult: SavedBill = {
      id: docRef.id,
      ...payload
    };

    // Auto update customer balance in Firestore
    try {
      await updateCustomer(0, {
        name: bill.customerName,
        address: bill.address || '',
        balance: bill.finalBalance
      });
    } catch (e) {
      console.warn('[Firebase] Failed to update customer balance on bill save:', e);
    }

    // Cache locally
    const currentBills = getLocalBills();
    saveLocalBills([savedBillResult, ...currentBills.filter(b => b.billNo !== savedBillResult.billNo)]);

    return savedBillResult;
  } catch (firebaseErr) {
    console.warn('[Firebase] Firestore createBill fallback:', firebaseErr);
  }

  // 2. Try Node Backend
  try {
    const res = await fetch(`${API_BASE_URL}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const savedBillResult: SavedBill = await res.json();
      const currentBills = getLocalBills();
      saveLocalBills([savedBillResult, ...currentBills.filter(b => b.billNo !== savedBillResult.billNo)]);
      return savedBillResult;
    }
  } catch {
    // ignore
  }

  // 3. Local fallback
  const localBill: SavedBill = {
    ...payload,
    id: Date.now()
  };
  const currentBills = getLocalBills();
  saveLocalBills([localBill, ...currentBills.filter(b => b.billNo !== localBill.billNo)]);

  // Update customer balance locally
  const currentCustomers = getLocalCustomers();
  const safeCustomers = Array.isArray(currentCustomers) ? [...currentCustomers] : [];
  const existingIdx = safeCustomers.findIndex(
    c => c.name === bill.customerName && c.address === (bill.address || '')
  );
  if (existingIdx >= 0) {
    safeCustomers[existingIdx].balance = bill.finalBalance;
  } else {
    safeCustomers.push({
      id: Date.now(),
      name: bill.customerName,
      address: bill.address || '',
      balance: bill.finalBalance,
    });
  }
  saveLocalCustomers(safeCustomers);

  return localBill;
};

export const deleteBill = async (id?: number | string, billNo?: string): Promise<void> => {
  // 1. Try Firebase Firestore
  try {
    if (id && typeof id === 'string' && isNaN(Number(id))) {
      await deleteDoc(doc(db, 'bills', id));
    }
  } catch (firebaseErr) {
    console.warn('[Firebase] Firestore deleteBill fallback:', firebaseErr);
  }

  // 2. Try Node Backend
  const targetId = id || billNo;
  if (targetId) {
    try {
      await fetch(`${API_BASE_URL}/bills/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
  }

  // 3. Local Storage update
  const currentBills = getLocalBills();
  const safeBills = Array.isArray(currentBills) ? currentBills : [];
  saveLocalBills(safeBills.filter(b => {
    if (id !== undefined && b.id !== undefined) {
      return b.id !== id;
    }
    if (billNo && b.billNo) {
      return b.billNo !== billNo;
    }
    return true;
  }));
};
