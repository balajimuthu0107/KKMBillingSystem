import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// Mongoose connection caching for serverless environments (Vercel)
let isConnected = false;
async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.warn('[MongoDB Atlas] No MONGODB_URI found in serverless environment.');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
  } catch (err: any) {
    console.error('[MongoDB Atlas Serverless] Connection error:', err.message);
  }
}

// Schemas & Models
const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    balance: { type: Number, default: 0 },
    lastBillNo: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);
const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);

const BillSchema = new mongoose.Schema(
  {
    customerId: { type: String, default: '' },
    billNo: { type: String, required: true },
    date: { type: String, default: '' },
    customerName: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    items: { type: Array, default: [] },
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    previousBalance: { type: String, default: '0' },
    prevBalance: { type: String, default: '0' },
    advance: { type: Number, default: 0 },
    receipt: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    finalBalance: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);
const Bill = mongoose.models.Bill || mongoose.model('Bill', BillSchema);

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// Customers Routes
app.get(['/api/customers', '/customers'], async (_req: Request, res: Response) => {
  try {
    const customers = await Customer.find().sort({ name: 1 });
    return res.json(customers);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post(['/api/customers', '/customers'], async (req: Request, res: Response) => {
  try {
    const { name, address = '', balance = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const c = new Customer({ name: name.trim(), address: address.trim(), balance: Number(balance) || 0 });
    await c.save();
    return res.status(201).json(c);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put(['/api/customers/:id', '/customers/:id'], async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { name, address, balance, lastBillNo } = req.body;
    const update: any = {};
    if (name !== undefined) update.name = String(name).trim();
    if (address !== undefined) update.address = String(address).trim();
    if (balance !== undefined) update.balance = Number(balance) || 0;
    if (lastBillNo !== undefined) update.lastBillNo = Number(lastBillNo) || 0;

    let updated = null;
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      updated = await Customer.findByIdAndUpdate(id, update, { new: true });
    }
    if (!updated && (name || update.name)) {
      updated = await Customer.findOneAndUpdate({ name: update.name || String(name).trim() }, update, { new: true });
    }
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Bills Routes
app.get(['/api/bills', '/bills'], async (_req: Request, res: Response) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    return res.json(bills);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post(['/api/bills', '/bills'], async (req: Request, res: Response) => {
  try {
    const billData = req.body;
    const newBill = new Bill(billData);
    await newBill.save();

    // Update customer balance in MongoDB Atlas
    if (billData.customerId && billData.customerId.match(/^[0-9a-fA-F]{24}$/)) {
      await Customer.findByIdAndUpdate(billData.customerId, {
        balance: billData.finalBalance,
        lastBillNo: Number(billData.billNo) || 0
      }).catch(() => {});
    } else if (billData.customerName) {
      await Customer.findOneAndUpdate(
        { name: String(billData.customerName).trim() },
        { balance: billData.finalBalance, lastBillNo: Number(billData.billNo) || 0 }
      ).catch(() => {});
    }

    return res.status(201).json(newBill);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete(['/api/bills/:id', '/bills/:id'], async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      await Bill.findByIdAndDelete(id);
    } else {
      await Bill.findOneAndDelete({ billNo: id });
    }
    return res.json({ message: 'Bill removed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get(['/', '/api', '/api/health', '/health'], (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    database: isConnected ? 'Connected to MongoDB Atlas' : 'Connecting...',
    timestamp: new Date().toISOString()
  });
});

export default app;
