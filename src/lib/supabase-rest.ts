interface SupabaseErrorBody {
  message?: string;
  error_description?: string;
  code?: string;
}

interface SupabaseOptions {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
  prefer?: string;
}

export class SupabaseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured.");
  }
  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function supabaseRequest<T>(
  endpoint: string,
  options: SupabaseOptions = {},
): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const headers = new Headers({
    apikey: anonKey,
    Accept: "application/json",
  });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.prefer) headers.set("Prefer", options.prefer);

  const response = await fetch(`${url}${endpoint}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const responseText = await response.text();
  let data: unknown = null;
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new SupabaseError("Supabase returned an invalid response.", response.status, null);
    }
  }
  if (!response.ok) {
    const body = data as SupabaseErrorBody | null;
    throw new SupabaseError(
      body?.message ?? body?.error_description ?? "Supabase request failed.",
      response.status,
      body?.code ?? null,
    );
  }
  return data as T;
}

export function supabaseRpc<T>(
  token: string,
  functionName: string,
  parameters: Record<string, unknown>,
): Promise<T> {
  return supabaseRequest<T>(`/rest/v1/rpc/${functionName}`, {
    method: "POST",
    token,
    body: parameters,
  });
}
