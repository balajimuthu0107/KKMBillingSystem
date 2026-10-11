import { initializeFirebase, getDb } from './firebase.js';
import { DEFAULT_INITIAL_CUSTOMERS } from './routes/customers.js';

async function seed() {
  console.log('Seeding initial customers to Firebase Firestore...');
  const status = initializeFirebase();
  const db = getDb();

  if (!status.isConnected || !db) {
    console.error('Firebase is not connected! Please provide Firebase credentials before running seed.');
    process.exit(1);
  }

  try {
    const batch = db.batch();
    for (const customer of DEFAULT_INITIAL_CUSTOMERS) {
      const docRef = db.collection('customers').doc();
      batch.set(docRef, {
        ...customer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`Added customer to batch: ${customer.name} (${customer.address})`);
    }

    await batch.commit();
    console.log(`✅ Successfully seeded ${DEFAULT_INITIAL_CUSTOMERS.length} customers to Firebase Firestore!`);
  } catch (err: any) {
    console.error('Error seeding customers:', err.message);
  }
}

seed();
