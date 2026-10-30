import { NextRequest, NextResponse } from "next/server";
import { apiRoute, readJsonObject, requireBearerToken, requiredString } from "@/lib/http";
import { supabaseRpc } from "@/lib/supabase-rest";
import type { RoomSummary } from "@/types/platform";

export const POST = apiRoute(async (request: NextRequest) => {
  const token = requireBearerToken(request);
  const body = await readJsonObject(request);
  const room = await supabaseRpc<RoomSummary>(token, "join_room", {
    p_code: requiredString(body, "code", 6, 6).toUpperCase(),
    p_display_name: requiredString(body, "displayName", 1, 40),
  });
  return NextResponse.json({ room }, { status: 200 });
});
