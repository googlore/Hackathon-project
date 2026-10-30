import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireBearerToken, requireUuid } from "@/lib/http";
import { supabaseRpc } from "@/lib/supabase-rest";
import type { RoomState } from "@/types/platform";

type RouteContext = { params: Promise<{ roomId: string }> };

export const GET = apiRoute<RouteContext>(async (request: NextRequest, { params }) => {
  const token = requireBearerToken(request);
  const { roomId } = await params;
  const state = await supabaseRpc<RoomState | null>(token, "get_room_state", {
    p_room_id: requireUuid(roomId, "roomId"),
  });
  if (!state) {
    return NextResponse.json({ error: { code: "not_found", message: "Room not found." } }, { status: 404 });
  }
  return NextResponse.json({ room: state });
});
