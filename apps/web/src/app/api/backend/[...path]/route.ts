import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { signTenantHost } from "@/lib/ingress-signature";
import { isSameApplicationOrigin } from "@/lib/request-origin";
import { sessionCookieName } from "@/lib/session-cookie";
import { normalizeTenantHost } from "@/lib/tenant-host";
import {
  containsTenantSelector,
  isTenantSelectorName,
} from "@/lib/tenant-selector";

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!["GET", "HEAD"].includes(request.method)) {
    if (
      !isSameApplicationOrigin(
        request.headers.get("origin"),
        process.env.AUTH_URL,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 },
      );
    }
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: sessionCookieName(),
  });
  if (typeof token?.accessToken !== "string") {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const apiBase = process.env.SYNDES_API_URL;
  if (!apiBase) {
    return NextResponse.json(
      { error: "API is not configured" },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  if ([...request.nextUrl.searchParams.keys()].some(isTenantSelectorName)) {
    return NextResponse.json(
      { error: "Tenant routing is derived server-side" },
      { status: 400 },
    );
  }
  const requestType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (requestType.includes("application/json")) {
    const payload = await request
      .clone()
      .json()
      .catch(() => undefined);
    if (containsTenantSelector(payload)) {
      return NextResponse.json(
        { error: "Tenant routing is derived server-side" },
        { status: 400 },
      );
    }
  } else if (requestType.includes("application/x-www-form-urlencoded")) {
    const form = await request
      .clone()
      .formData()
      .catch(() => undefined);
    if (form && [...form.keys()].some(isTenantSelectorName)) {
      return NextResponse.json(
        { error: "Tenant routing is derived server-side" },
        { status: 400 },
      );
    }
  }
  const target = new URL(
    `/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    apiBase,
  );
  if (target.origin !== new URL(apiBase).origin) {
    return NextResponse.json({ error: "Invalid API target" }, { status: 400 });
  }

  const host = normalizeTenantHost(request.nextUrl.hostname);
  if (!host) {
    return NextResponse.json({ error: "Invalid host" }, { status: 400 });
  }

  const ingressSecret = process.env.INGRESS_SIGNING_SECRET;
  if (!ingressSecret) {
    return NextResponse.json(
      { error: "Ingress is not configured" },
      { status: 503 },
    );
  }

  const headers = new Headers({
    authorization: `Bearer ${token.accessToken}`,
  });
  const timestamp = Date.now().toString();
  Object.entries(signTenantHost(host, timestamp, ingressSecret)).forEach(
    ([name, value]) => headers.set(name, value),
  );

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  // Never forward client-supplied x-syndes-validated-* or tenant/database selectors.
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    const type = upstream.headers.get("content-type");
    if (type) responseHeaders.set("content-type", type);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ error: "API unavailable" }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
