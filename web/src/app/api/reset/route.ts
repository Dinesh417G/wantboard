import { NextResponse } from "next/server";
import { reset } from "@/lib/store";

/** Restore the demo data (judges can start fresh). Real PayPal transactions are not touched. */
export async function POST() {
  reset();
  return NextResponse.json({ ok: true });
}
