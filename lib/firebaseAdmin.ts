import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  // En Firebase App Hosting las credenciales son automáticas
  // No necesitás service account key
  return initializeApp();
}

export const adminDb = getFirestore(getAdminApp());