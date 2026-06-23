import { NextRequest, NextResponse } from "next/server";

function unauthorized(realm: string): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"` },
  });
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return (
      checkCredentials(
        request,
        process.env.ADMIN_USER ?? "",
        process.env.ADMIN_PASSWORD ?? "",
        "Admin"
      ) ?? NextResponse.next()
    );
  }

  if (pathname.startsWith("/search") || pathname.startsWith("/api/search")) {
    return (
      checkCredentials(
        request,
        process.env.SEARCH_USER ?? "",
        process.env.SEARCH_PASSWORD ?? "",
        "Shop"
      ) ?? NextResponse.next()
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/search/:path*", "/api/search/:path*"],
};
