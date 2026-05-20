"use client";
import { Button } from "@repo/ui/button";
import { authClient } from "@/lib/auth-client";
import * as sounds from "@/lib/sounds";

export default function Dashboard({
  customerState,
  session,
}: {
  customerState: ReturnType<typeof authClient.customer.state>;
  session: typeof authClient.$Infer.Session;
}) {
  const hasProSubscription = customerState?.activeSubscriptions?.length! > 0;

  return (
    <>
      <p>Plan: {hasProSubscription ? "Pro" : "Free"}</p>
      {hasProSubscription ? (
        <Button
          onClick={async () => {
            sounds.click();
            await authClient.customer.portal();
          }}
        >
          Manage Subscription
        </Button>
      ) : (
        <Button
          onClick={async () => {
            sounds.click();
            await authClient.checkout({ slug: "pro" });
          }}
        >
          Upgrade to Pro
        </Button>
      )}
    </>
  );
}
