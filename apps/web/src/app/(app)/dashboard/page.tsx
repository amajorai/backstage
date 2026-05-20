import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { DashboardTabs } from "./dashboard-tabs";

export default async function DashboardPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { data: customerState } = await authClient.customer.state({
    fetchOptions: {
      headers: await headers(),
    },
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-bold text-2xl">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {session.user.name}</p>
      </div>

      <DashboardTabs customerState={customerState} session={session} />
    </div>
  );
}
