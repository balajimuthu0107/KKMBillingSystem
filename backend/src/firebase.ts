import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

let dbInstance: admin.firestore.Firestore | null = null;
let isConnected = false;
let connectionMode: 'service_account_file' | 'env_vars' | 'default_app' | 'mock_fallback' = 'mock_fallback';

export function initializeFirebase(): { db: admin.firestore.Firestore | null; isConnected: boolean; mode: string } {
  if (dbInstance) {
    return { db: dbInstance, isConnected, mode: connectionMode };
  }

  // Check 1: Explicit path in FIREBASE_SERVICE_ACCOUNT_PATH or default ./serviceAccountKey.json
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(explicitPath)) {
    try {
      const fileData = fs.readFileSync(explicitPath, 'utf8');
      const serviceAccount = JSON.parse(fileData);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      dbInstance = admin.firestore();
      isConnected = true;
      connectionMode = 'service_account_file';
      console.log(`[Firebase] Successfully connected using Service Account JSON file (${explicitPath})`);
      return { db: dbInstance, isConnected, mode: connectionMode };
    } catch (err: any) {
      console.error(`[Firebase] Failed to initialize using serviceAccountKey.json: ${err.message}`);
    }
  }

  // Check 2: Raw JSON string in FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      dbInstance = admin.firestore();
      isConnected = true;
      connectionMode = 'service_account_file';
      console.log(`[Firebase] Successfully connected using FIREBASE_SERVICE_ACCOUNT environment JSON`);
      return { db: dbInstance, isConnected, mode: connectionMode };
    } catch (err: any) {
      console.error(`[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT: ${err.message}`);
    }
  }

  // Check 3: Individual environment variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      dbInstance = admin.firestore();
      isConnected = true;
      connectionMode = 'env_vars';
      console.log(`[Firebase] Successfully connected using Firebase Environment Variables (${process.env.FIREBASE_PROJECT_ID})`);
      return { db: dbInstance, isConnected, mode: connectionMode };
    } catch (err: any) {
      console.error(`[Firebase] Failed to initialize with environment variables: ${err.message}`);
    }
  }

  // Check 4: Google Application Default Credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      admin.initializeApp();
      dbInstance = admin.firestore();
      isConnected = true;
      connectionMode = 'default_app';
      console.log(`[Firebase] Successfully connected using GOOGLE_APPLICATION_CREDENTIALS`);
      return { db: dbInstance, isConnected, mode: connectionMode };
    } catch (err: any) {
      console.error(`[Firebase] Failed to initialize default credentials: ${err.message}`);
    }
  }

  // Fallback mode: No credentials provided yet
  console.warn(`
-------------------------------------------------------------------------------------
[Firebase Notice] No Firebase credentials detected!
Backend will operate with smart local in-memory persistence until configured.
To link your Firebase database:
1. Place 'serviceAccountKey.json' in 'backend/' OR
2. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in 'backend/.env'
-------------------------------------------------------------------------------------`);
  connectionMode = 'mock_fallback';
  return { db: null, isConnected: false, mode: connectionMode };
}

export function getDb(): admin.firestore.Firestore | null {
  if (!dbInstance && !isConnected) {
    initializeFirebase();
  }
  return dbInstance;
}

export function isFirebaseConnected(): boolean {
  return isConnected;
}

export function getConnectionMode(): string {
  return connectionMode;
}
