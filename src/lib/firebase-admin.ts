import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import firebaseConfig from "../../firebase-applet-config.json";

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || firebaseConfig.projectId;
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (serviceAccountRaw) {
    try {
      const parsed = JSON.parse(serviceAccountRaw);
      initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || projectId,
      });
    } catch (err) {
      console.warn(
        "[FirebaseAdmin] Invalid FIREBASE_SERVICE_ACCOUNT_JSON; falling back to projectId-only init.",
        err
      );
      initializeApp({ projectId });
    }
  } else {
    initializeApp({ projectId });
  }
}

export const adminAuth = getAuth();
