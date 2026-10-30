import { NextRequest, NextResponse } from "next/server";
import { apiRoute } from "@/lib/http";
import { supabaseRequest } from "@/lib/supabase-rest";
import type { GuestSession } from "@/types/platform";

export const POST = apiRoute(async (_request: NextRequest) => {
  const session = await supabaseRequest<GuestSession>("/auth/v1/signup", {
    method: "POST",
    body: { data: {} },
  });
  if (!session.access_token || !session.user?.id) {
    throw new Error("Supabase did not return a guest session.");
  }
  return NextResponse.json(session, { status: 201 });
});
