"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import type { authClient } from "@/lib/auth-client";
import * as sounds from "@/lib/sounds";
import Dashboard from "./dashboard";
import { SettingsTab } from "./settings-tab";

export function DashboardTabs({
  customerState,
  session,
}: {
  customerState: ReturnType<typeof authClient.customer.state>;
  session: typeof authClient.$Infer.Session;
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger onClick={sounds.click} value="overview">
          Overview
        </TabsTrigger>
        <TabsTrigger onClick={sounds.click} value="settings">
          Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-6" value="overview">
        <Dashboard customerState={customerState} session={session} />
      </TabsContent>

      <TabsContent className="mt-6" value="settings">
        <SettingsTab />
      </TabsContent>
    </Tabs>
  );
}
