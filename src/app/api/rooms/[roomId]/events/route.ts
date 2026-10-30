import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireBearerToken, requireUuid } from "@/lib/http";
import { supabaseRpc } from "@/lib/supabase-rest";
import type { RoomState } from "@/types/platform";

type RouteContext = { params: Promise<{ roomId: string }> };

export const maxDuration = 60;

export const GET = apiRoute<RouteContext>(async (request: NextRequest, { params }) => {
  const token = requireBearerToken(request);
  const { roomId: rawRoomId } = await params;
  const roomId = requireUuid(rawRoomId, "roomId");
  const initialState = await supabaseRpc<RoomState | null>(token, "get_room_state", {
    p_room_id: roomId,
  });
  if (!initialState) {
    return NextResponse.json({ error: { code: "not_found", message: "Room not found." } }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastPayload = "";
      const sendState = (state: RoomState) => {
        const payload = JSON.stringify(state);
        if (payload !== lastPayload) {
          controller.enqueue(encoder.encode(`event: room\ndata: ${payload}\n\n`));
          lastPayload = payload;
        }
      };
      const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 2000));
      const poll = async () => {
        try {
          sendState(initialState);
          while (!cancelled && !request.signal.aborted) {
            await delay();
            if (cancelled || request.signal.aborted) break;
            const state = await supabaseRpc<RoomState | null>(token, "get_room_state", {
              p_room_id: roomId,
            });
            if (!state) {
              controller.error(new Error("Room is no longer available."));
              return;
            }
            sendState(state);
          }
          if (!cancelled) controller.close();
        } catch (error) {
          if (!cancelled) {
            console.error("Room event stream failed", error);
            controller.error(error);
          }
        }
      };
      void poll();
      request.signal.addEventListener("abort", () => {
        cancelled = true;
      }, { once: true });
    },
    cancel() {
      cancelled = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
