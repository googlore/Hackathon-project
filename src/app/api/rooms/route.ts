import { NextRequest, NextResponse } from "next/server";
import { apiRoute, readJsonObject, requireBearerToken, requiredString, optionalString } from "@/lib/http";
import { supabaseRpc } from "@/lib/supabase-rest";
import type { RoomSummary } from "@/types/platform";

export const POST = apiRoute(async (request: NextRequest) => {
  const token = requireBearerToken(request);
  const body = await readJsonObject(request);
  const room = await supabaseRpc<RoomSummary>(token, "create_room", {
    p_name: requiredString(body, "name", 1, 80),
    p_display_name: requiredString(body, "displayName", 1, 40),
    p_subject: optionalString(body, "subject", 80),
    p_topic: optionalString(body, "topic", 120),
  });
  return NextResponse.json({ room }, { status: 201 });
});
