import { Router, Request, Response } from 'express';
import { getDb, isFirebaseConnected } from '../firebase.js';

export interface CustomerData {
  id: string | number;
  name: string;
  address: string;
  balance: number;
  updatedAt?: string;
}

export const DEFAULT_INITIAL_CUSTOMERS: Omit<CustomerData, 'id'>[] = [
  { name: "பச்சையப்பன்", address: "கந்தம்பாளையம்", balance: 0 },
  { name: "முருகன்", address: "வேட்டவலம்", balance: 0 },
  { name: "ஹரிதாஸ்", address: "வேட்டவலம்", balance: 0 },
  { name: "முரளி", address: "வேட்டவலம்", balance: 0 },
  { name: "பெருமாள்", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "கோபி", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "முரளி", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "ராஜா", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "ஏழுமலை", address: "கண்டாச்சிபுரம்", balance: 0 },
  { name: "சுரேஷ்", address: "உளுந்தூர்பேட்டை", balance: 0 },
  { name: "விஜி", address: "விருத்தாச்சலம்", balance: 0 },
  { name: "SRS சிவராஜ்", address: "விழுப்புரம்", balance: 0 }
];

// Fallback in-memory customer storage
let memoryCustomers: CustomerData[] = DEFAULT_INITIAL_CUSTOMERS.map((c, i) => ({
  ...c,
  id: i + 1,
  updatedAt: new Date().toISOString()
}));

const router = Router();

// GET all customers
router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    if (isFirebaseConnected() && db) {
      const snapshot = await db.collection('customers').get();
      if (snapshot.empty) {
        // Auto-seed default customers if collection is empty
        const batch = db.batch();
        const seeded: CustomerData[] = [];
        for (const c of DEFAULT_INITIAL_CUSTOMERS) {
          const docRef = db.collection('customers').doc();
          const docData = {
            name: c.name,
            address: c.address,
            balance: c.balance,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          batch.set(docRef, docData);
          seeded.push({ id: docRef.id, ...docData });
        }
        await batch.commit();
        return res.json(seeded);
      }

      const customers: CustomerData[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        customers.push({
          id: doc.id,
          name: data.name || '',
          address: data.address || '',
          balance: Number(data.balance) || 0,
          updatedAt: data.updatedAt
        });
      });
      return res.json(customers);
    }

    // Fallback mode
    return res.json(memoryCustomers);
  } catch (err: any) {
    console.error('Error in GET /api/customers:', err);
    return res.status(500).json({ error: err.message, fallback: memoryCustomers });
  }
});

// POST create customer
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, address = '', balance = 0 } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const cleanBalance = Number(balance) || 0;
    const now = new Date().toISOString();
    const db = getDb();

    if (isFirebaseConnected() && db) {
      // Check if customer already exists with this name & address
      const existingSnap = await db.collection('customers')
        .where('name', '==', name.trim())
        .where('address', '==', address.trim())
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const updatedData = {
          name: name.trim(),
          address: address.trim(),
          balance: cleanBalance,
          updatedAt: now
        };
        await existingDoc.ref.update(updatedData);
        return res.json({ id: existingDoc.id, ...updatedData });
      }

      const docRef = await db.collection('customers').add({
        name: name.trim(),
        address: address.trim(),
        balance: cleanBalance,
        createdAt: now,
        updatedAt: now
      });

      return res.status(201).json({
        id: docRef.id,
        name: name.trim(),
        address: address.trim(),
        balance: cleanBalance,
        updatedAt: now
      });
    }

    // Fallback in-memory
    const existingIdx = memoryCustomers.findIndex(
      c => c.name === name.trim() && c.address === address.trim()
    );
    if (existingIdx >= 0) {
      memoryCustomers[existingIdx].balance = cleanBalance;
      memoryCustomers[existingIdx].updatedAt = now;
      return res.json(memoryCustomers[existingIdx]);
    }

    const newCust: CustomerData = {
      id: Date.now(),
      name: name.trim(),
      address: address.trim(),
      balance: cleanBalance,
      updatedAt: now
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
    const id = String(req.params.id);
    const { name, address, balance } = req.body;
    const now = new Date().toISOString();
    const db = getDb();

    if (isFirebaseConnected() && db) {
      const docRef = db.collection('customers').doc(id);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const updatePayload: any = { updatedAt: now };
        if (name !== undefined) updatePayload.name = name.trim();
        if (address !== undefined) updatePayload.address = address.trim();
        if (balance !== undefined) updatePayload.balance = Number(balance) || 0;

        await docRef.update(updatePayload);
        const updated = (await docRef.get()).data();
        return res.json({ id: docRef.id, ...updated });
      } else {
        // If doc by ID doesn't exist, search by name and address
        if (name) {
          const matchSnap = await db.collection('customers')
            .where('name', '==', name.trim())
            .where('address', '==', (address || '').trim())
            .limit(1)
            .get();

          if (!matchSnap.empty) {
            const matchedDoc = matchSnap.docs[0];
            await matchedDoc.ref.update({
              balance: Number(balance) || 0,
              updatedAt: now
            });
            return res.json({ id: matchedDoc.id, ...matchedDoc.data(), balance: Number(balance) || 0 });
          }
        }

        // Create new
        const newDoc = await db.collection('customers').add({
          name: name || '',
          address: address || '',
          balance: Number(balance) || 0,
          createdAt: now,
          updatedAt: now
        });
        return res.json({ id: newDoc.id, name, address, balance: Number(balance) || 0 });
      }
    }

    // Fallback mode
    const idx = memoryCustomers.findIndex(c => String(c.id) === String(id) || (name && c.name === name));
    if (idx >= 0) {
      if (name !== undefined) memoryCustomers[idx].name = name;
      if (address !== undefined) memoryCustomers[idx].address = address;
      if (balance !== undefined) memoryCustomers[idx].balance = Number(balance) || 0;
      memoryCustomers[idx].updatedAt = now;
      return res.json(memoryCustomers[idx]);
    }

    const created: CustomerData = {
      id: isNaN(Number(id)) ? Date.now() : Number(id),
      name: name || '',
      address: address || '',
      balance: Number(balance) || 0,
      updatedAt: now
    };
    memoryCustomers.push(created);
    return res.json(created);
  } catch (err: any) {
    console.error(`Error in PUT /api/customers/${req.params.id}:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// DELETE customer
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const db = getDb();

    if (isFirebaseConnected() && db) {
      await db.collection('customers').doc(id).delete();
      return res.json({ success: true, message: `Customer ${id} deleted` });
    }

    memoryCustomers = memoryCustomers.filter(c => String(c.id) !== String(id));
    return res.json({ success: true, message: `Customer ${id} deleted from local store` });
  } catch (err: any) {
    console.error(`Error in DELETE /api/customers/${req.params.id}:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// Seed endpoint
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    if (isFirebaseConnected() && db) {
      const batch = db.batch();
      const seeded: CustomerData[] = [];
      for (const c of DEFAULT_INITIAL_CUSTOMERS) {
        const docRef = db.collection('customers').doc();
        const docData = {
          name: c.name,
          address: c.address,
          balance: c.balance,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        batch.set(docRef, docData);
        seeded.push({ id: docRef.id, ...docData });
      }
      await batch.commit();
      return res.json({ success: true, message: 'Seeded default customers to Firebase Firestore', customers: seeded });
    }

    memoryCustomers = DEFAULT_INITIAL_CUSTOMERS.map((c, i) => ({
      ...c,
      id: i + 1,
      updatedAt: new Date().toISOString()
    }));
    return res.json({ success: true, message: 'Seeded customers to local store', customers: memoryCustomers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
