import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

import Dashboard from "./dashboard";
import { SettingsTab } from "./settings-tab";

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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="overview">
          <Dashboard customerState={customerState} session={session} />
        </TabsContent>

        <TabsContent className="mt-6" value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
