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
  lastBillNo?: number;
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
  customerId?: string;
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
    const [dd, mm, yyyy] = trimmed.split('/');
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

// Default initial customers list (Tamil & English) - 13 Unique Customers
export const DEFAULT_INITIAL_CUSTOMERS: CustomerData[] = [
  { id: 1, name: "Pachaippan", address: "KKM", balance: 0 },
  { id: 2, name: "SRS", address: "விழுப்புரம்", balance: 0 },
  { id: 3, name: "SRS சிவராஜ்", address: "விழுப்புரம்", balance: 0 },
  { id: 4, name: "ஏழுமலை", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 5, name: "கோபி", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 6, name: "சுரேஷ்", address: "உளுந்தூர்பேட்டை", balance: 0 },
  { id: 7, name: "பச்சையப்பன்", address: "கந்தம்பாளையம்", balance: 0 },
  { id: 8, name: "பெருமாள்", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 9, name: "முரளி", address: "வேட்டவலம்", balance: 0 },
  { id: 10, name: "முருகன்", address: "வேட்டவலம்", balance: 0 },
  { id: 11, name: "ராஜா", address: "கண்டாச்சிபுரம்", balance: 0 },
  { id: 12, name: "விஜி", address: "விருத்தாச்சலம்", balance: 0 },
  { id: 13, name: "ஹரிதாஸ்", address: "வேட்டவலம்", balance: 0 }
];

// Network timeout helper
const withTimeout = <T>(promise: Promise<T>, ms = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Network request timed out')), ms))
  ]);
};

// ==========================================
// Local Storage Backup Helpers
// ==========================================

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
    return list.map((b, idx) => {
      const adv = b.advance !== undefined ? b.advance : (b.receipt !== undefined ? b.receipt : '');
      const prevBal = b.previousBalance !== undefined ? b.previousBalance : (b.prevBalance !== undefined ? b.prevBalance : '');
      const mappedItems = (Array.isArray(b.items) ? b.items : []).map((it: any) => ({
        ...it,
        quantity: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
        qty: it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : ''),
        price: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : ''),
        rate: it.rate !== undefined ? it.rate : (it.price !== undefined ? it.price : '')
      }));

      return {
        ...b,
        id: b.id || Date.now() + idx,
        date: formatDateToDMY(String(b.date || '')),
        advance: adv,
        receipt: adv,
        previousBalance: prevBal,
        prevBalance: prevBal,
        items: mappedItems
      };
    });
  } catch {
    return [];
  }
};

export const saveLocalBills = (bills: SavedBill[]) => {
  try {
    localStorage.setItem('kkm_bills', JSON.stringify(bills));
  } catch (err) {
    console.error('Failed to save bills to localStorage', err);
  }
};

export const getLocalCustomers = (): CustomerData[] => {
  try {
    const raw = localStorage.getItem('kkm_customers');
    if (!raw) {
      saveLocalCustomers(DEFAULT_INITIAL_CUSTOMERS);
      return DEFAULT_INITIAL_CUSTOMERS;
    }
    const parsed = JSON.parse(raw);
    let list: CustomerData[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      list = Object.values(parsed).filter((c: any) => c && typeof c === 'object' && c.name) as CustomerData[];
    }
    if (list.length === 0) {
      saveLocalCustomers(DEFAULT_INITIAL_CUSTOMERS);
      return DEFAULT_INITIAL_CUSTOMERS;
    }
    return list;
  } catch {
    return DEFAULT_INITIAL_CUSTOMERS;
  }
};

export const saveLocalCustomers = (customers: CustomerData[]) => {
  try {
    localStorage.setItem('kkm_customers', JSON.stringify(customers));
  } catch (err) {
    console.error('Failed to save customers to localStorage', err);
  }
};

// ==========================================
// Customers API (MongoDB Atlas Backend & Backup)
// ==========================================

export const getCustomers = async (): Promise<CustomerData[]> => {
  try {
    const res = await withTimeout(fetch(`${API_BASE_URL}/customers`), 8000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const seen = new Set<string>();
        const list = data.filter((c: any) => {
          const key = (c.name || '').trim().toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).map((c: any) => ({
          id: c.id || c._id,
          name: String(c.name || '').trim(),
          address: String(c.address || '').trim(),
          balance: Number(c.balance) || 0,
          lastBillNo: Number(c.lastBillNo) || 0
        }));

        saveLocalCustomers(list);
        return list;
      }
    }
  } catch (err) {
    console.warn('[API] Could not fetch customers from backend:', err);
  }

  return getLocalCustomers();
};

export const createCustomer = async (customer: CustomerData): Promise<CustomerData> => {
  try {
    const res = await fetch(`${API_BASE_URL}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customer.name.trim(),
        address: (customer.address || '').trim(),
        balance: Number(customer.balance) || 0
      })
    });
    if (res.ok) {
      const data = await res.json();
      const newCust: CustomerData = {
        id: data.id || data._id,
        name: data.name,
        address: data.address,
        balance: Number(data.balance) || 0,
        lastBillNo: Number(data.lastBillNo) || 0
      };
      const current = getLocalCustomers();
      saveLocalCustomers([...current.filter(c => c.name !== newCust.name || c.address !== newCust.address), newCust]);
      return newCust;
    }
  } catch (err) {
    console.warn('[API] createCustomer fallback to local:', err);
  }

  const result: CustomerData = {
    ...customer,
    id: customer.id || Date.now()
  };
  const current = getLocalCustomers();
  saveLocalCustomers([...current.filter(c => c.name !== result.name || c.address !== result.address), result]);
  return result;
};

export const updateCustomer = async (id: number | string, customer: CustomerData): Promise<CustomerData> => {
  try {
    const endpoint = id ? `${API_BASE_URL}/customers/${encodeURIComponent(id)}` : `${API_BASE_URL}/customers`;
    const res = await fetch(endpoint, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customer.name.trim(),
        address: (customer.address || '').trim(),
        balance: Number(customer.balance) || 0
      })
    });
    if (res.ok) {
      const data = await res.json();
      const updatedCust: CustomerData = {
        id: data.id || data._id || id,
        name: data.name,
        address: data.address,
        balance: Number(data.balance) || 0,
        lastBillNo: Number(data.lastBillNo) || 0
      };
      const current = getLocalCustomers();
      const safe = Array.isArray(current) ? [...current] : [];
      const idx = safe.findIndex(c => (id && c.id === id) || (c.name === customer.name && c.address === (customer.address || '')));
      if (idx >= 0) safe[idx] = updatedCust;
      else safe.push(updatedCust);
      saveLocalCustomers(safe);
      return updatedCust;
    }
  } catch (err) {
    console.warn('[API] updateCustomer fallback to local:', err);
  }

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
    await fetch(`${API_BASE_URL}/customers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {
    // ignore
  }

  const current = getLocalCustomers();
  const safeCurrent = Array.isArray(current) ? current : [];
  saveLocalCustomers(safeCurrent.filter(c => c.id !== id));
};

// ==========================================
// Bills API (MongoDB Atlas Backend & Backup)
// ==========================================

export const getBills = async (): Promise<SavedBill[]> => {
  try {
    const res = await withTimeout(fetch(`${API_BASE_URL}/bills`), 8000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const backendList: SavedBill[] = data.map((b: any) => {
          const adv = b.advance !== undefined ? b.advance : (b.receipt !== undefined ? b.receipt : '');
          const prevBal = b.previousBalance !== undefined ? b.previousBalance : (b.prevBalance !== undefined ? b.prevBalance : '');
          const mappedItems: BillItem[] = (Array.isArray(b.items) ? b.items : []).map((it: any) => ({
            id: it.id || it.frontendId || it._id,
            frontendId: String(it.frontendId || it.id || it._id || ''),
            particulars: String(it.particulars || ''),
            quantity: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
            qty: it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : ''),
            kg: String(it.kg ?? ''),
            price: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : ''),
            rate: it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : ''),
            amount: (Number(it.quantity ?? it.qty) || 0) * (Number(it.price ?? it.rate) || 0)
          }));

          return {
            id: b.id || b._id,
            billNo: String(b.billNo || ''),
            customerId: String(b.customerId || ''),
            date: formatDateToDMY(String(b.date || '')),
            customerName: String(b.customerName || ''),
            address: String(b.address || ''),
            items: mappedItems,
            quantity: Number(b.quantity) || mappedItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
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

        // Also merge any offline bills that haven't reached the server
        const localBills = getLocalBills();
        if (Array.isArray(localBills) && localBills.length > 0) {
          const serverKeys = new Set(backendList.map(b => `${b.billNo}_${(b.customerName || '').trim()}_${b.totalAmount}`));
          for (const lb of localBills) {
            const key = `${lb.billNo}_${(lb.customerName || '').trim()}_${lb.totalAmount}`;
            if (!serverKeys.has(key)) {
              backendList.push(lb);
              // Non-blocking sync to backend
              fetch(`${API_BASE_URL}/bills`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lb)
              }).catch(() => {});
            }
          }
        }

        backendList.sort((a, b) => {
          const customerCompare = `${a.customerName} - ${a.address}`.localeCompare(`${b.customerName} - ${b.address}`);
          return customerCompare
            || String(a.customerId || '').localeCompare(String(b.customerId || ''))
            || (Number(a.billNo) || 0) - (Number(b.billNo) || 0);
        });

        saveLocalBills(backendList);
        return backendList;
      }
    }
  } catch (err) {
    console.warn('[API] Could not fetch bills from backend:', err);
  }

  return getLocalBills();
};

export const getNextBillNo = async (customerId?: string): Promise<number> => {
  if (!customerId) return 1;
  try {
    const localBills = getLocalBills();
    const customerBills = localBills.filter(b => b.customerId === customerId);
    if (customerBills.length > 0) {
      const maxNo = customerBills.reduce((max, b) => Math.max(max, Number(b.billNo) || 0), 0);
      return maxNo + 1;
    }
  } catch {
    // ignore
  }
  return 1;
};

export const createBill = async (bill: SavedBill): Promise<SavedBill> => {
  const adv = bill.advance !== undefined && bill.advance !== '' ? bill.advance : (bill.receipt ?? '');
  const prevBal = bill.previousBalance !== undefined && bill.previousBalance !== '' ? bill.previousBalance : (bill.prevBalance ?? '');
  const customerId = String(bill.customerId || 'local_' + Date.now());

  const mappedItems: BillItem[] = (bill.items || []).map(item => {
    const q = item.quantity !== undefined && item.quantity !== '' ? item.quantity : (item.qty ?? '');
    const p = item.price !== undefined && item.price !== '' ? item.price : (item.rate ?? '');
    const kg = item.kg !== undefined ? item.kg : '';
    return {
      id: String(item.id || item.frontendId || ''),
      frontendId: String(item.id || item.frontendId || ''),
      particulars: String(item.particulars || ''),
      quantity: q,
      qty: q,
      kg: String(kg),
      price: p,
      rate: p,
      amount: (Number(q) || 0) * (Number(p) || 0)
    };
  });

  const totalQty = mappedItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const avgPrice = mappedItems.length > 0 ? (Number(mappedItems[0].price) || 0) : 0;
  const totalAmount = Number(bill.totalAmount) || 0;
  const advance = Number(adv) || 0;
  const finalBalance = totalAmount - advance;

  const billNoNum = Number(bill.billNo) || 1;
  const billNoStr = String(bill.billNo || billNoNum);

  const payload = {
    customerId,
    billNo: billNoStr,
    date: formatDateToDMY(String(bill.date)),
    customerName: String(bill.customerName || '').trim(),
    address: String(bill.address || '').trim(),
    items: mappedItems,
    quantity: totalQty,
    price: avgPrice,
    previousBalance: String(prevBal || '0'),
    prevBalance: String(prevBal || '0'),
    advance,
    receipt: advance,
    totalAmount,
    finalBalance,
    createdAt: new Date().toISOString()
  };

  let savedBill: SavedBill = {
    ...payload,
    id: 'bill_' + Date.now()
  };

  try {
    const res = await fetch(`${API_BASE_URL}/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      savedBill = {
        ...savedBill,
        id: data.id || data._id || savedBill.id,
        billNo: String(data.billNo || savedBill.billNo)
      };
    }
  } catch (err) {
    console.warn('[API] createBill saved locally (backend offline):', err);
  }

  // Always update local storage
  const currentBills = getLocalBills();
  saveLocalBills([savedBill, ...currentBills.filter(existing => existing.id !== savedBill.id)]);
  return savedBill;
};

export const deleteBill = async (id?: number | string, billNo?: string): Promise<void> => {
  const targetId = id || billNo;
  if (targetId) {
    try {
      await fetch(`${API_BASE_URL}/bills/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
  }

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
