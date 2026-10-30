import { NextRequest, NextResponse } from "next/server";
import { apiRoute, ApiError, readJsonObject, requireBearerToken, requireUuid, requiredString } from "@/lib/http";
import { supabaseRpc } from "@/lib/supabase-rest";

type RouteContext = { params: Promise<{ challengeId: string }> };
interface Settlement {
  challengeId: string;
  status: "upheld" | "rejected";
  pointsAwarded: number;
  winnerId: string | null;
}

export const POST = apiRoute<RouteContext>(async (request: NextRequest, { params }) => {
  const token = requireBearerToken(request);
  const { challengeId } = await params;
  const body = await readJsonObject(request);
  const verdict = requiredString(body, "verdict", 1, 10);
  if (verdict !== "upheld" && verdict !== "rejected") {
    throw new ApiError("verdict must be upheld or rejected.", 400, "invalid_input");
  }
  const settlement = await supabaseRpc<Settlement>(token, "settle_challenge", {
    p_challenge_id: requireUuid(challengeId, "challengeId"),
    p_verdict: verdict,
  });
  return NextResponse.json({ settlement });
});
