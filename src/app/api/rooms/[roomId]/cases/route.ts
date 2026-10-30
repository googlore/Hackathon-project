import { NextRequest, NextResponse } from "next/server";
import { apiRoute, readJsonObject, requireBearerToken, requireUuid, requiredString, optionalString, ApiError } from "@/lib/http";
import { supabaseRpc } from "@/lib/supabase-rest";

type RouteContext = { params: Promise<{ roomId: string }> };

export const POST = apiRoute<RouteContext>(async (request: NextRequest, { params }) => {
  const token = requireBearerToken(request);
  const { roomId } = await params;
  const body = await readJsonObject(request);
  if (!Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > 50) {
    throw new ApiError("steps must contain between 1 and 50 solution steps.", 400, "invalid_input");
  }
  const steps = body.steps.map((step, index) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw new ApiError(`steps[${index}] must be an object.`, 400, "invalid_input");
    }
    const content = (step as Record<string, unknown>).content;
    if (typeof content !== "string" || content.trim().length < 1 || content.trim().length > 4000) {
      throw new ApiError(`steps[${index}].content must be between 1 and 4000 characters.`, 400, "invalid_input");
    }
    return { content: content.trim() };
  });
  const caseId = await supabaseRpc<string>(token, "submit_case", {
    p_room_id: requireUuid(roomId, "roomId"),
    p_prompt: requiredString(body, "prompt", 1, 4000),
    p_steps: steps,
    p_source: optionalString(body, "source", 120),
  });
  return NextResponse.json({ caseId }, { status: 201 });
});
