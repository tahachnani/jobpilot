import Navigation from "@/components/Navigation";
import { creerClientServeur } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LayoutApplication({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Navigation email={user.email ?? ""} />
      <main className="flex-1 p-5 lg:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
