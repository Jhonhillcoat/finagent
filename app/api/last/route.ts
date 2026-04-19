import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { OWNER_ID } from "@/lib/config";

export async function GET() {
  try {
    const doc = await adminDb.collection("users").doc(OWNER_ID).get();
    const data = doc.data();
    return NextResponse.json({ analysis: data?.lastAnalysis ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, analysis: null }, { status: 500 });
  }
}
