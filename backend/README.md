# 🐟 KKM Sea Foodz - Node.js Firebase Backend

A high-performance Node.js & Express REST API powered by Google Firebase Firestore for storing customer records, billing invoices, and automated balance synchronization.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
The server will start on: **http://localhost:8080**

---

## 🔥 Connecting your Firebase Firestore Database

You can connect Firebase in **less than 1 minute**:

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (or create one) and enable **Firestore Database**.
3. Go to **Project Settings** (gear icon) -> **Service Accounts**.
4. Click **"Generate new private key"** and download the JSON file.
5. Rename the downloaded file to `serviceAccountKey.json` and place it in the `backend/` folder!

*(Alternatively, you can fill in `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` inside `.env`)*

---

## 📡 API Endpoints

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create or update customer
- `PUT /api/customers/:id` - Update customer balance or details
- `DELETE /api/customers/:id` - Delete customer
- `POST /api/customers/seed` - Seed default Tamil customers list

### Bills
- `GET /api/bills` - Get all billing history
- `POST /api/bills` - Save a new bill & automatically update customer balance
- `GET /api/bills/:id` - View single bill
- `DELETE /api/bills/:id` - Delete bill record

### Health & Status
- `GET /api/health` - Check backend uptime & Firebase connection status
