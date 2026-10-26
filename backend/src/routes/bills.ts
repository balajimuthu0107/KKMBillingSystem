import { Router, Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb, isFirebaseConnected } from '../firebase.js';

export interface BillItem {
  id?: string | number;
  frontendId?: string;
  particulars: string;
  quantity?: string | number;
  qty?: string | number;
  price?: string | number;
  rate?: string | number;
  amount?: number;
}

export interface SavedBill {
  id?: string | number;
  customerId: string;
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

// Convert any date to Day-Month-Year (DD-MM-YYYY)
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

const parseBillDate = (dateStr: string): Date => {
  const normalized = formatDateToDMY(dateStr);
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(normalized);
  if (!match) throw new Error(`Invalid bill date: ${dateStr}`);
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error(`Invalid bill date: ${dateStr}`);
  }
  return date;
};

// Fallback in-memory storage for bills
let memoryBills: SavedBill[] = [];

const router = Router();

// GET all bills - ordered by billNo descending
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    if (isFirebaseConnected() && db) {
      const snapshot = await db.collection('bills').get();
      const bills: SavedBill[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const adv = data.advance !== undefined ? data.advance : (data.receipt !== undefined ? data.receipt : '');
        const prevBal = data.previousBalance !== undefined ? data.previousBalance : (data.prevBalance !== undefined ? data.prevBalance : '');
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const mappedItems: BillItem[] = rawItems.map((it: any) => {
          const q = it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : '');
          const p = it.price !== undefined ? it.price : (it.rate !== undefined ? it.rate : '');
          return {
            id: it.id || it.frontendId,
            frontendId: it.frontendId || String(it.id || ''),
            particulars: it.particulars || '',
            quantity: q,
            qty: q,
            price: p,
            rate: p,
            amount: (Number(q) || 0) * (Number(p) || 0)
          };
        });

        bills.push({
          id: doc.id,
          customerId: String(data.customerId || ''),
          billNo: String(data.billNo || ''),
          date: data.date && typeof data.date.toDate === 'function'
            ? formatDateToDMY(data.date.toDate().toISOString().slice(0, 10))
            : formatDateToDMY(String(data.date || '')),
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
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : data.createdAt
        });
      });

      bills.sort((a, b) => {
        const customerCompare = `${a.customerName} - ${a.address}`.localeCompare(`${b.customerName} - ${b.address}`);
        return customerCompare
          || a.customerId.localeCompare(b.customerId)
          || (Number(a.billNo) || 0) - (Number(b.billNo) || 0);
      });

      return res.json(bills);
    }

    // Fallback mode
    memoryBills.sort((a, b) => (parseInt(b.billNo) || 0) - (parseInt(a.billNo) || 0));
    return res.json(memoryBills);
  } catch (err: any) {
    console.error('Error in GET /api/bills:', err);
    return res.status(500).json({ error: err.message, fallback: memoryBills });
  }
});

// GET single bill by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = getDb();

    if (isFirebaseConnected() && db) {
      const doc = await db.collection('bills').doc(id).get();
      if (!doc.exists) {
        // Try finding by billNo
        const byNo = await db.collection('bills').where('billNo', '==', id).limit(1).get();
        if (!byNo.empty) {
          const match = byNo.docs[0];
          return res.json({ id: match.id, ...match.data() });
        }
        return res.status(404).json({ error: 'Bill not found' });
      }
      return res.json({ id: doc.id, ...doc.data() });
    }

    const bill = memoryBills.find(b => String(b.id) === id || b.billNo === id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    return res.json(bill);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST save bill
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      date,
      customerName,
      address = '',
      items = [],
      quantity,
      price,
      previousBalance,
      prevBalance,
      advance,
      receipt,
      totalAmount = 0
    } = req.body;

    if (!customerId || !customerName) {
      return res.status(400).json({ error: 'Customer document ID and customer name are required' });
    }

    const now = new Date().toISOString();
    const rawItems = Array.isArray(items) ? items : [];
    const mappedItems: BillItem[] = rawItems.map((it: any) => {
      const q = it.quantity !== undefined && it.quantity !== '' ? it.quantity : (it.qty ?? '');
      const p = it.price !== undefined && it.price !== '' ? it.price : (it.rate ?? '');
      return {
        id: it.id || it.frontendId,
        frontendId: it.frontendId || String(it.id || ''),
        particulars: it.particulars || '',
        quantity: q,
        qty: q,
        price: p,
        rate: p,
        amount: (Number(q) || 0) * (Number(p) || 0)
      };
    });

    const totalQty = quantity !== undefined 
      ? Number(quantity) 
      : mappedItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

    const unitPrice = price !== undefined 
      ? Number(price) 
      : (mappedItems.length > 0 ? Number(mappedItems[0].price) || 0 : 0);

    const finalAdv = advance !== undefined && advance !== '' ? advance : (receipt ?? '');
    const finalPrevBal = previousBalance !== undefined && previousBalance !== '' ? previousBalance : (prevBalance ?? '');
    const numericTotal = Number(totalAmount) || 0;
    const numericAdvance = Number(finalAdv) || 0;
    const billFinalBalance = numericTotal - numericAdvance;

    const cleanBill: SavedBill = {
      customerId: String(customerId),
      billNo: '',
      date: formatDateToDMY(String(date)),
      customerName: String(customerName).trim(),
      address: String(address).trim(),
      quantity: totalQty,
      price: unitPrice,
      items: mappedItems,
      previousBalance: String(finalPrevBal),
      prevBalance: String(finalPrevBal),
      advance: numericAdvance,
      receipt: numericAdvance,
      totalAmount: numericTotal,
      finalBalance: billFinalBalance,
      createdAt: now
    };

    const db = getDb();
    if (isFirebaseConnected() && db) {
      const customerRef = db.collection('customers').doc(String(customerId));
      const billRef = db.collection('bills').doc();
      let assignedBillNo = 0;

      await db.runTransaction(async transaction => {
        const customerSnapshot = await transaction.get(customerRef);
        if (!customerSnapshot.exists) throw new Error('The selected customer does not exist.');
        const lastBillNo = customerSnapshot.data()?.lastBillNo;
        if (!Number.isInteger(lastBillNo) || lastBillNo < 0) {
          throw new Error('The customer has an invalid lastBillNo. Run the bill-number migration first.');
        }
        assignedBillNo = lastBillNo + 1;
        transaction.update(customerRef, {
          lastBillNo: assignedBillNo,
          balance: billFinalBalance,
          updatedAt: now
        });
        transaction.create(billRef, {
          ...cleanBill,
          billNo: assignedBillNo,
          date: Timestamp.fromDate(parseBillDate(String(date))),
          createdAt: Timestamp.now()
        });
      });

      return res.status(201).json({
        id: billRef.id,
        ...cleanBill,
        billNo: String(assignedBillNo)
      });
    }

    return res.status(503).json({ error: 'Firestore is required to generate a unique bill number.' });
  } catch (err: any) {
    console.error('Error in POST /api/bills:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE bill
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = getDb();

    if (isFirebaseConnected() && db) {
      const docRef = db.collection('bills').doc(id);
      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.delete();
        return res.json({ success: true, message: `Bill ${id} deleted` });
      }

      // Try deleting by billNo
      const querySnap = await db.collection('bills').where('billNo', '==', id).get();
      if (!querySnap.empty) {
        const batch = db.batch();
        querySnap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return res.json({ success: true, message: `Bill ${id} deleted` });
      }

      return res.json({ success: true, message: `Bill ${id} not found or already deleted` });
    }

    memoryBills = memoryBills.filter(b => String(b.id) !== id && b.billNo !== id);
    return res.json({ success: true, message: `Bill ${id} deleted from local store` });
  } catch (err: any) {
    console.error(`Error in DELETE /api/bills/${req.params.id}:`, err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
