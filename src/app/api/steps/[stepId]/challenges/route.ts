import { NextRequest, NextResponse } from "next/server";
import { apiRoute, readJsonObject, requireBearerToken, requireUuid, requiredString, optionalString } from "@/lib/http";
import { supabaseRequest } from "@/lib/supabase-rest";

type RouteContext = { params: Promise<{ stepId: string }> };
type CreatedChallenge = { id: string };

export const POST = apiRoute<RouteContext>(async (request: NextRequest, { params }) => {
  const token = requireBearerToken(request);
  const { stepId } = await params;
  const body = await readJsonObject(request);
  const rows = await supabaseRequest<CreatedChallenge[]>("/rest/v1/challenges?select=id", {
    method: "POST",
    token,
    prefer: "return=representation",
    body: {
      step_id: requireUuid(stepId, "stepId"),
      claim: requiredString(body, "claim", 10, 2000),
      correction: optionalString(body, "correction", 2000),
      verification: optionalString(body, "verification", 2000),
    },
  });
  return NextResponse.json({ challengeId: rows[0].id }, { status: 201 });
});
