import { Router } from 'express';
import { getDb, isFirebaseConnected } from '../firebase.js';
// Convert any date to Day-Month-Year (DD-MM-YYYY)
export const formatDateToDMY = (dateStr) => {
    if (!dateStr)
        return '';
    const trimmed = dateStr.trim();
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed))
        return trimmed;
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
// Fallback in-memory storage for bills
let memoryBills = [];
const router = Router();
// GET all bills - ordered by billNo descending
router.get('/', async (_req, res) => {
    try {
        const db = getDb();
        if (isFirebaseConnected() && db) {
            const snapshot = await db.collection('bills').get();
            const bills = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const adv = data.advance !== undefined ? data.advance : (data.receipt !== undefined ? data.receipt : '');
                const prevBal = data.previousBalance !== undefined ? data.previousBalance : (data.prevBalance !== undefined ? data.prevBalance : '');
                const rawItems = Array.isArray(data.items) ? data.items : [];
                const mappedItems = rawItems.map((it) => {
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
            // Sort descending by billNo (highest/newest first)
            bills.sort((a, b) => {
                const numA = parseInt(a.billNo) || 0;
                const numB = parseInt(b.billNo) || 0;
                if (numB !== numA)
                    return numB - numA;
                return (b.createdAt || '').localeCompare(a.createdAt || '');
            });
            return res.json(bills);
        }
        // Fallback mode
        memoryBills.sort((a, b) => (parseInt(b.billNo) || 0) - (parseInt(a.billNo) || 0));
        return res.json(memoryBills);
    }
    catch (err) {
        console.error('Error in GET /api/bills:', err);
        return res.status(500).json({ error: err.message, fallback: memoryBills });
    }
});
// GET single bill by ID
router.get('/:id', async (req, res) => {
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
        if (!bill)
            return res.status(404).json({ error: 'Bill not found' });
        return res.json(bill);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// POST save bill
router.post('/', async (req, res) => {
    try {
        const { billNo, date, customerName, address = '', items = [], quantity, price, previousBalance, prevBalance, advance, receipt, totalAmount = 0, finalBalance = 0 } = req.body;
        if (!customerName || !billNo) {
            return res.status(400).json({ error: 'Customer name and Bill number are required' });
        }
        const now = new Date().toISOString();
        const rawItems = Array.isArray(items) ? items : [];
        const mappedItems = rawItems.map((it) => {
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
        // Ordered schema: 1.billNo, 2.date, 3.customerName, 4.address, 5.quantity, 6.price, 7.previousBalance, 8.advance, 9.totalAmount
        const cleanBill = {
            billNo: String(billNo),
            date: formatDateToDMY(String(date)),
            customerName: String(customerName).trim(),
            address: String(address).trim(),
            quantity: totalQty,
            price: unitPrice,
            items: mappedItems,
            previousBalance: String(finalPrevBal),
            prevBalance: String(finalPrevBal),
            advance: String(finalAdv),
            receipt: String(finalAdv),
            totalAmount: Number(totalAmount) || 0,
            finalBalance: Number(finalBalance) || 0,
            createdAt: now
        };
        const db = getDb();
        if (isFirebaseConnected() && db) {
            // 1. Save bill in Firestore
            const docRef = await db.collection('bills').add(cleanBill);
            const savedBillResult = { id: docRef.id, ...cleanBill };
            // 2. Automatically sync customer balance in Firestore
            try {
                const custSnap = await db.collection('customers')
                    .where('name', '==', cleanBill.customerName)
                    .where('address', '==', cleanBill.address)
                    .limit(1)
                    .get();
                if (!custSnap.empty) {
                    const custDoc = custSnap.docs[0];
                    await custDoc.ref.update({
                        balance: cleanBill.finalBalance,
                        updatedAt: now
                    });
                }
                else {
                    await db.collection('customers').add({
                        name: cleanBill.customerName,
                        address: cleanBill.address,
                        balance: cleanBill.finalBalance,
                        createdAt: now,
                        updatedAt: now
                    });
                }
            }
            catch (custErr) {
                console.warn('[Firebase] Warning: Failed to sync customer balance:', custErr.message);
            }
            return res.status(201).json(savedBillResult);
        }
        // Fallback mode
        const localSaved = {
            id: Date.now(),
            ...cleanBill
        };
        memoryBills.unshift(localSaved);
        return res.status(201).json(localSaved);
    }
    catch (err) {
        console.error('Error in POST /api/bills:', err);
        return res.status(500).json({ error: err.message });
    }
});
// DELETE bill
router.delete('/:id', async (req, res) => {
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
    }
    catch (err) {
        console.error(`Error in DELETE /api/bills/${req.params.id}:`, err);
        return res.status(500).json({ error: err.message });
    }
});
export default router;
