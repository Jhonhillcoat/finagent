import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") ?? "anonymous";

  const snap = await adminDb
    .collection("users")
    .doc(userId)
    .collection("analyses")
    .orderBy("createdAt", "desc")
    .limit(12)
    .get();

  const history = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ history });
}
