import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SupabaseError } from "@/lib/supabase-rest";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type StaticRouteContext = { params: Promise<{}> };

export function apiRoute<TContext = StaticRouteContext>(
  handler: (request: NextRequest, context: TContext) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context: TContext): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }
      if (error instanceof SupabaseError) {
        const mapped = mapSupabaseError(error);
        return NextResponse.json(
          { error: { code: mapped.code, message: mapped.message } },
          { status: mapped.status },
        );
      }
      console.error("Unhandled API route error", error);
      return NextResponse.json(
        { error: { code: "internal_error", message: "An unexpected error occurred." } },
        { status: 500 },
      );
    }
  };
}

export function requireUuid(value: string, name: string): string {
  const parts = value.toLowerCase().split("-");
  if (
    parts.length !== 5
    || parts[0].length !== 8
    || parts[1].length !== 4
    || parts[2].length !== 4
    || parts[3].length !== 4
    || parts[4].length !== 12
    || parts.some((part) => ![...part].every((character) => "0123456789abcdef".includes(character)))
  ) {
    throw new ApiError(`${name} must be a valid ID.`, 400, "invalid_input");
  }
  return value;
}

export function requireBearerToken(request: Request): string {
  const value = request.headers.get("authorization");
  const prefix = "Bearer ";
  if (!value?.toLowerCase().startsWith(prefix.toLowerCase())) {
    throw new ApiError("A guest access token is required.", 401, "unauthorized");
  }
  const token = value.slice(prefix.length).trim();
  if (!token || token.includes(" ")) {
    throw new ApiError("A guest access token is required.", 401, "unauthorized");
  }
  return token;
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError("Request body must be valid JSON.", 400, "invalid_json");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("Request body must be a JSON object.", 400, "invalid_body");
  }
  return value as Record<string, unknown>;
}

export function requiredString(
  body: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length < minimum || value.trim().length > maximum) {
    throw new ApiError(`${key} must be between ${minimum} and ${maximum} characters.`, 400, "invalid_input");
  }
  return value.trim();
}

export function optionalString(
  body: Record<string, unknown>,
  key: string,
  maximum: number,
): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximum) {
    throw new ApiError(`${key} must be at most ${maximum} characters.`, 400, "invalid_input");
  }
  return value.trim() || null;
}

function mapSupabaseError(error: SupabaseError): ApiError {
  if (error.code === "28000") return new ApiError("A valid guest session is required.", 401, "unauthorized");
  if (error.code === "42501") return new ApiError("You are not allowed to perform this action.", 403, "forbidden");
  if (error.code === "P0002") return new ApiError("The requested room or challenge was not found.", 404, "not_found");
  if (error.code === "23505") return new ApiError(error.message.includes("already settled")
    ? "This challenge has already been settled." : "This action conflicts with existing data.", 409, "conflict");
  if (error.code === "22023") return new ApiError("The request contains invalid values.", 400, "invalid_input");
  if (error.status === 401) return new ApiError("A valid guest session is required.", 401, "unauthorized");
  if (error.status === 403) return new ApiError("You are not allowed to perform this action.", 403, "forbidden");
  if (error.status === 404) return new ApiError("The requested resource was not found.", 404, "not_found");
  console.error("Supabase request failed", { status: error.status, code: error.code });
  return new ApiError("The data service could not complete the request.", 502, "upstream_error");
}
