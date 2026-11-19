import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;

export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    console.warn(`
-------------------------------------------------------------------------------------
[MongoDB Atlas Notice] No MONGODB_URI detected in environment variables!
Backend will operate in smart in-memory fallback mode until configured.
To connect to MongoDB Atlas:
1. Open backend/.env
2. Add: MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/billing?retryWrites=true&w=majority"
-------------------------------------------------------------------------------------`);
    isConnected = false;
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`[MongoDB Atlas] Successfully connected to database!`);
    return true;
  } catch (err: any) {
    console.error(`[MongoDB Atlas] Connection failed: ${err.message}`);
    isConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
