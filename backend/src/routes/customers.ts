import { Router, Request, Response } from 'express';
import { Customer } from '../models/Customer.js';
import { isDbConnected, connectDB } from '../db.js';

export interface CustomerData {
  id: string | number;
  name: string;
  address: string;
  balance: number;
  lastBillNo?: number;
  updatedAt?: string;
}

export const DEFAULT_INITIAL_CUSTOMERS = [
  { name: "Pachaippan", address: "KKM", balance: 0 },
  { name: "SRS", address: "விழுப்புரம்", balance: 0 },
  { name: "SRS சிவராஜ்", address: "விழுப்புரம்", balance: 0 },
  { name: "ஏழுமலை", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "கோபி", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "சுரேஷ்", address: "உளுந்தூர்பேட்டை", balance: 0 },
  { name: "பச்சையப்பன்", address: "கந்தம்பாளையம்", balance: 0 },
  { name: "பெருமாள்", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "முரளி", address: "வேட்டவலம்", balance: 0 },
  { name: "முருகன்", address: "வேட்டவலம்", balance: 0 },
  { name: "ராஜா", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "விஜி", address: "விருத்தாச்சலம்", balance: 0 },
  { name: "ஹரிதாஸ்", address: "வேட்டவலம்", balance: 0 }
];

// Fallback in-memory customer storage
let memoryCustomers: CustomerData[] = DEFAULT_INITIAL_CUSTOMERS.map((c, i) => ({
  ...c,
  id: String(i + 1),
  updatedAt: new Date().toISOString()
}));

const router = Router();

// GET all customers
router.get('/', async (_req: Request, res: Response) => {
  try {
    await connectDB();
    if (isDbConnected()) {
      let customers = await Customer.find().sort({ name: 1 });
      if (customers.length === 0) {
        // Auto-seed default customers if collection is empty
        await Customer.insertMany(DEFAULT_INITIAL_CUSTOMERS.map(c => ({
          ...c,
          lastBillNo: 0
        })));
        customers = await Customer.find().sort({ name: 1 });
      }
      return res.json(customers);
    }

    return res.json(memoryCustomers);
  } catch (err: any) {
    console.error('Error in GET /api/customers:', err);
    return res.status(500).json({ error: err.message, fallback: memoryCustomers });
  }
});

// GET customer by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (isDbConnected()) {
      const customer = await Customer.findById(id);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      return res.json(customer);
    }

    const found = memoryCustomers.find(c => String(c.id) === id);
    if (!found) return res.status(404).json({ error: 'Customer not found' });
    return res.json(found);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST create customer
router.post('/', async (req: Request, res: Response) => {
  try {
    await connectDB();
    const { name, address = '', balance = 0 } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const cleanName = name.trim();
    const cleanAddress = String(address).trim();
    const cleanBalance = Number(balance) || 0;

    if (isDbConnected()) {
      const customer = new Customer({
        name: cleanName,
        address: cleanAddress,
        balance: cleanBalance,
        lastBillNo: 0
      });
      await customer.save();
      return res.status(201).json(customer);
    }

    const newCust: CustomerData = {
      id: String(Date.now()),
      name: cleanName,
      address: cleanAddress,
      balance: cleanBalance,
      lastBillNo: 0,
      updatedAt: new Date().toISOString()
    };
    memoryCustomers.push(newCust);
    return res.status(201).json(newCust);
  } catch (err: any) {
    console.error('Error in POST /api/customers:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PUT update customer
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await connectDB();
    const id = String(req.params.id);
    const { name, address, balance, lastBillNo } = req.body;

    const updateFields: any = {};
    if (name !== undefined) updateFields.name = String(name).trim();
    if (address !== undefined) updateFields.address = String(address).trim();
    if (balance !== undefined) updateFields.balance = Number(balance) || 0;
    if (lastBillNo !== undefined) updateFields.lastBillNo = Number(lastBillNo) || 0;

    if (isDbConnected()) {
      let updated = null;
      if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
        updated = await Customer.findByIdAndUpdate(id, updateFields, { new: true });
      }
      if (!updated && (name || updateFields.name)) {
        const queryName = updateFields.name || String(name).trim();
        updated = await Customer.findOneAndUpdate(
          { name: queryName },
          updateFields,
          { new: true }
        );
      }
      if (!updated) return res.status(404).json({ error: 'Customer not found' });
      return res.json(updated);
    }

    const idx = memoryCustomers.findIndex(c => String(c.id) === id);
    if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
    memoryCustomers[idx] = {
      ...memoryCustomers[idx],
      ...updateFields,
      updatedAt: new Date().toISOString()
    };
    return res.json(memoryCustomers[idx]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE customer
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (isDbConnected()) {
      await Customer.findByIdAndDelete(id);
      return res.json({ message: 'Customer deleted successfully' });
    }

    memoryCustomers = memoryCustomers.filter(c => String(c.id) !== id);
    return res.json({ message: 'Customer deleted from memory' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST seed customers
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    if (isDbConnected()) {
      await Customer.deleteMany({});
      const seeded = await Customer.insertMany(DEFAULT_INITIAL_CUSTOMERS.map(c => ({
        ...c,
        lastBillNo: 0
      })));
      return res.json({ message: 'Successfully seeded customers in MongoDB Atlas', count: seeded.length });
    }

    memoryCustomers = DEFAULT_INITIAL_CUSTOMERS.map((c, i) => ({
      ...c,
      id: String(i + 1),
      updatedAt: new Date().toISOString()
    }));
    return res.json({ message: 'Seeded in memory', count: memoryCustomers.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
