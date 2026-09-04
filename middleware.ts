import { type NextRequest } from "next/server";
import { actualiserSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await actualiserSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
