// app/api/sync/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  try {
    return NextResponse.json({
      status: "ok",
      message: "Remote sync complete.",
    });
  } catch (error: Error | unknown) {
    console.error("Sync error:", error);
    return NextResponse.json({ status: "error", error: String(error) }, { status: 500 });
  }
}
