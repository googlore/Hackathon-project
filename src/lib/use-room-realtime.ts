"use client";

import { useEffect, useState } from "react";
import type { RoomState } from "@/types/platform";

export interface RoomRealtimeState {
  room: RoomState | null;
  connected: boolean;
  error: string | null;
}

export function useRoomRealtime(
  roomId: string | null,
  accessToken: string | null,
): RoomRealtimeState {
  const [state, setState] = useState<RoomRealtimeState>({
    room: null,
    connected: false,
    error: null,
  });

  useEffect(() => {
    if (!roomId || !accessToken) {
      setState({ room: null, connected: false, error: null });
      return;
    }

    const controller = new AbortController();
    const connect = async () => {
      while (!controller.signal.aborted) {
        try {
          const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/events`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok || !response.body) {
            throw new Error(response.status === 401
              ? "Your guest session has expired."
              : "Unable to connect to room updates.");
          }

          setState((current) => ({ ...current, connected: true, error: null }));
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) throw new Error("The room update stream closed.");
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const event of events) {
              const data = event.split("\n")
                .find((line) => line.startsWith("data: "))
                ?.slice(6);
              if (data) {
                setState({ room: JSON.parse(data) as RoomState, connected: true, error: null });
              }
            }
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setState((current) => ({
            ...current,
            connected: false,
            error: error instanceof Error ? error.message : "Room updates disconnected.",
          }));
          await new Promise<void>((resolve) => setTimeout(resolve, 2000));
        }
      }
    };

    void connect();
    return () => controller.abort();
  }, [roomId, accessToken]);

  return state;
}
