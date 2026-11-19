import { connectDB, isDbConnected } from './db.js';
import { Customer } from './models/Customer.js';
import { DEFAULT_INITIAL_CUSTOMERS } from './routes/customers.js';

async function seed() {
  console.log('Seeding initial customers to MongoDB Atlas...');
  await connectDB();

  if (!isDbConnected()) {
    console.error('MongoDB Atlas is not connected! Please provide MONGODB_URI in backend/.env before running seed.');
    process.exit(1);
  }

  try {
    await Customer.deleteMany({});
    const seeded = await Customer.insertMany(DEFAULT_INITIAL_CUSTOMERS.map(customer => ({
      ...customer,
      lastBillNo: 0
    })));
    console.log(`✅ Successfully seeded ${seeded.length} customers to MongoDB Atlas!`);
    process.exit(0);
  } catch (err: any) {
    console.error('Error seeding customers:', err.message);
    process.exit(1);
  }
}

seed();
