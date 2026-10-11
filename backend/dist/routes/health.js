import { Router } from 'express';
import { isFirebaseConnected, getConnectionMode } from '../firebase.js';
const router = Router();
router.get('/', (_req, res) => {
    const connected = isFirebaseConnected();
    const mode = getConnectionMode();
    res.json({
        status: 'ok',
        service: 'KKM Sea Foodz Billing Backend',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        firebase: {
            connected,
            connectionMode: mode,
            message: connected
                ? 'Firebase Firestore is active and handling requests.'
                : 'Firebase is currently running in fallback mode. Place serviceAccountKey.json in the backend directory or configure .env to activate Cloud Firestore.'
        }
    });
});
export default router;
