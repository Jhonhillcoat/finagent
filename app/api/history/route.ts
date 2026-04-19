import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { OWNER_ID } from "@/lib/config";

export async function GET() {
  try {
    const snap = await adminDb
      .collection("users").doc(OWNER_ID).collection("analyses")
      .orderBy("createdAt", "desc").limit(24).get();
    const history = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET_LAST() {
  try {
    const doc = await adminDb.collection("users").doc(OWNER_ID).get();
    const data = doc.data();
    return NextResponse.json({ analysis: data?.lastAnalysis ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
