import { creerClientServeur } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = creerClientServeur();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/connexion", request.url), {
    status: 303,
  });
}
