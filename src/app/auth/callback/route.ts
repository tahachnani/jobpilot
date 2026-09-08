import { NextResponse, type NextRequest } from "next/server";

/**
 * Ancienne adresse de retour, conservée pour les liens déjà envoyés.
 * Tout est traité par /auth/confirm, qui accepte les deux formats.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = "/auth/confirm";
  return NextResponse.redirect(url);
}
