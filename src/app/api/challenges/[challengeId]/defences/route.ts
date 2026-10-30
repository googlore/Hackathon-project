import { NextRequest, NextResponse } from "next/server";
import { apiRoute, readJsonObject, requireBearerToken, requireUuid, requiredString } from "@/lib/http";
import { supabaseRequest } from "@/lib/supabase-rest";

type RouteContext = { params: Promise<{ challengeId: string }> };
type CreatedDefence = { id: string };

export const POST = apiRoute<RouteContext>(async (request: NextRequest, { params }) => {
  const token = requireBearerToken(request);
  const { challengeId } = await params;
  const body = await readJsonObject(request);
  const rows = await supabaseRequest<CreatedDefence[]>("/rest/v1/defences?select=id", {
    method: "POST",
    token,
    prefer: "return=representation",
    body: {
      challenge_id: requireUuid(challengeId, "challengeId"),
      body: requiredString(body, "body", 1, 2000),
    },
  });
  return NextResponse.json({ defenceId: rows[0].id }, { status: 201 });
});
