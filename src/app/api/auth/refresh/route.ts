import { NextRequest, NextResponse } from "next/server";
import { apiRoute, readJsonObject, requiredString } from "@/lib/http";
import { supabaseRequest } from "@/lib/supabase-rest";
import type { GuestSession } from "@/types/platform";

export const POST = apiRoute(async (request: NextRequest) => {
  const body = await readJsonObject(request);
  const session = await supabaseRequest<GuestSession>("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: requiredString(body, "refreshToken", 1, 2048) },
  });
  if (!session.access_token || !session.user?.id) {
    throw new Error("Supabase did not return a refreshed guest session.");
  }
  return NextResponse.json(session);
});
