import { NextRequest, NextResponse } from "next/server";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

function unauthorized(realm: string): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"`, ...NO_CACHE_HEADERS },
  });
}

function withNoCacheHeaders(response: NextResponse): NextResponse {
  Object.entries(NO_CACHE_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

function checkCredentials(
  request: NextRequest,
  expectedUser: string,
  expectedPassword: string,
  realm: string
): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) return unauthorized(realm);

  const [user, password] = Buffer.from(authHeader.slice(6), "base64")
    .toString()
    .split(":");

  if (user !== expectedUser || password !== expectedPassword)
    return unauthorized(realm);

  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return (
      checkCredentials(
        request,
        process.env.ADMIN_USER ?? "",
        process.env.ADMIN_PASSWORD ?? "",
        "Admin"
      ) ?? withNoCacheHeaders(NextResponse.next())
    );
  }

  if (pathname.startsWith("/search") || pathname.startsWith("/api/search")) {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Basic ")) return unauthorized("Shop");
    const colonIdx = Buffer.from(authHeader.slice(6), "base64").toString().indexOf(":");
    const password = Buffer.from(authHeader.slice(6), "base64").toString().slice(colonIdx + 1);
    if (password !== (process.env.SEARCH_PASSWORD ?? "")) return unauthorized("Shop");
    return withNoCacheHeaders(NextResponse.next());
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/search/:path*", "/api/search/:path*"],
};
