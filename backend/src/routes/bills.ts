import { Router, Request, Response } from 'express';
import { Bill, IBillItem } from '../models/Bill.js';
import { Customer } from '../models/Customer.js';
import { isDbConnected, connectDB } from '../db.js';

export interface SavedBill {
  id?: string | number;
  customerId: string;
  billNo: string;
  date: string;
  customerName: string;
  address: string;
  items: IBillItem[];
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
    const [dd, mm, yyyy] = trimmed.split('/');
    return `${dd}-${mm}-${yyyy}`;
  }
  return trimmed;
};

// Fallback in-memory storage for bills
let memoryBills: SavedBill[] = [];

const router = Router();

// GET all bills
router.get('/', async (_req: Request, res: Response) => {
  try {
    await connectDB();
    if (isDbConnected()) {
      const bills = await Bill.find().sort({ createdAt: -1 });
      const sorted = bills.slice().sort((a, b) => {
        const customerCompare = `${a.customerName} - ${a.address}`.localeCompare(`${b.customerName} - ${b.address}`);
        return customerCompare
          || a.customerId.localeCompare(b.customerId)
          || (Number(a.billNo) || 0) - (Number(b.billNo) || 0);
      });
      return res.json(sorted);
    }

    memoryBills.sort((a, b) => (parseInt(b.billNo) || 0) - (parseInt(a.billNo) || 0));
    return res.json(memoryBills);
  } catch (err: any) {
    console.error('Error in GET /api/bills:', err);
    return res.status(500).json({ error: err.message, fallback: memoryBills });
  }
});

// GET single bill by ID or BillNo
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    if (isDbConnected()) {
      let bill = null;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        bill = await Bill.findById(id);
      }
      if (!bill) {
        bill = await Bill.findOne({ billNo: id });
      }
      if (!bill) return res.status(404).json({ error: 'Bill not found' });
      return res.json(bill);
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
    await connectDB();
    const {
      customerId = '',
      billNo = '',
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
      totalAmount = 0,
      finalBalance
    } = req.body;

    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const rawItems = Array.isArray(items) ? items : [];
    const mappedItems: IBillItem[] = rawItems.map((it: any) => {
      const q = it.quantity !== undefined && it.quantity !== '' ? it.quantity : (it.qty ?? '');
      const p = it.price !== undefined && it.price !== '' ? it.price : (it.rate ?? '');
      return {
        frontendId: String(it.frontendId || it.id || ''),
        particulars: String(it.particulars || ''),
        quantity: q,
        qty: q,
        kg: String(it.kg ?? ''),
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

    const finalAdv = advance !== undefined && advance !== '' ? advance : (receipt ?? 0);
    const finalPrevBal = previousBalance !== undefined && previousBalance !== '' ? previousBalance : (prevBalance ?? '0');
    const numericTotal = Number(totalAmount) || 0;
    const numericAdvance = Number(finalAdv) || 0;
    const computedFinalBalance = finalBalance !== undefined ? Number(finalBalance) : (numericTotal - numericAdvance);

    const billNoStr = String(billNo || (Date.now() % 100000));

    if (isDbConnected()) {
      const newBill = new Bill({
        customerId: String(customerId),
        billNo: billNoStr,
        date: formatDateToDMY(String(date || '')),
        customerName: String(customerName).trim(),
        address: String(address).trim(),
        items: mappedItems,
        quantity: totalQty,
        price: unitPrice,
        previousBalance: String(finalPrevBal),
        prevBalance: String(finalPrevBal),
        advance: numericAdvance,
        receipt: numericAdvance,
        totalAmount: numericTotal,
        finalBalance: computedFinalBalance
      });

      await newBill.save();

      // Optionally update customer's balance and lastBillNo if customer exists
      if (customerId && customerId.match(/^[0-9a-fA-F]{24}$/)) {
        await Customer.findByIdAndUpdate(customerId, {
          balance: computedFinalBalance,
          lastBillNo: Number(billNoStr) || 0
        }).catch(() => {});
      } else if (customerName) {
        await Customer.findOneAndUpdate(
          { name: String(customerName).trim() },
          { balance: computedFinalBalance, lastBillNo: Number(billNoStr) || 0 }
        ).catch(() => {});
      }

      return res.status(201).json(newBill);
    }

    // Memory fallback
    const memoryBill: SavedBill = {
      id: String(Date.now()),
      customerId: String(customerId),
      billNo: billNoStr,
      date: formatDateToDMY(String(date || '')),
      customerName: String(customerName).trim(),
      address: String(address).trim(),
      items: mappedItems,
      quantity: totalQty,
      price: unitPrice,
      previousBalance: String(finalPrevBal),
      prevBalance: String(finalPrevBal),
      advance: numericAdvance,
      receipt: numericAdvance,
      totalAmount: numericTotal,
      finalBalance: computedFinalBalance,
      createdAt: new Date().toISOString()
    };
    memoryBills.push(memoryBill);
    return res.status(201).json(memoryBill);
  } catch (err: any) {
    console.error('Error in POST /api/bills:', err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE bill
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await connectDB();
    const id = String(req.params.id);
    const { billNo, customerName, totalAmount, date } = req.body || {};

    if (isDbConnected()) {
      let deleted = null;
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        deleted = await Bill.findByIdAndDelete(id);
      }
      if (!deleted && (billNo || customerName)) {
        const query: any = {};
        if (billNo || id) query.billNo = String(billNo || id);
        if (customerName) query.customerName = String(customerName).trim();
        if (totalAmount !== undefined && totalAmount !== null) query.totalAmount = Number(totalAmount);
        if (date) query.date = String(date).trim();
        deleted = await Bill.findOneAndDelete(query);
      }
      if (!deleted && id) {
        deleted = await Bill.findOneAndDelete({ billNo: id });
      }
      return res.json({ message: 'Bill deleted successfully', deleted });
    }

    memoryBills = memoryBills.filter(b => String(b.id) !== id && b.billNo !== id);
    return res.json({ message: 'Bill deleted from memory' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
