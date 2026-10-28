import { NextRequest } from "next/server";
import { handlers } from "@/auth";

export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  if (!request.nextUrl.pathname.endsWith("/session") || !response.ok) {
    return response;
  }

  const session: unknown = await response.clone().json().catch(() => null);
  if (!session || typeof session !== "object" || !("accessToken" in session)) {
    return response;
  }

  const publicSession = { ...session };
  delete publicSession.accessToken;
  const headers = new Headers(response.headers);
  const cookies = response.headers.getSetCookie();
  headers.delete("set-cookie");
  headers.delete("content-length");
  for (const cookie of cookies) headers.append("set-cookie", cookie);

  return new Response(JSON.stringify(publicSession), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const POST = handlers.POST;
