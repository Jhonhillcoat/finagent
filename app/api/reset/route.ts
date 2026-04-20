import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { OWNER_ID } from "@/lib/config";

const BATCH = 400;

export async function POST() {
  try {
    const col = adminDb.collection("users").doc(OWNER_ID).collection("analyses");
    const snap = await col.get();
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = adminDb.batch();
      for (const d of docs.slice(i, i + BATCH)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    const userRef = adminDb.collection("users").doc(OWNER_ID);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      await userRef.update({
        lastAnalysis: FieldValue.delete(),
        lastAnalysisId: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error en /api/reset:", err);
    return NextResponse.json({ error: err.message ?? "Error interno" }, { status: 500 });
  }
}
