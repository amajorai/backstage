"use client";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function Dashboard({
  customerState,
  session,
}: {
  customerState: ReturnType<typeof authClient.customer.state>;
  session: typeof authClient.$Infer.Session;
}) {
  const hasProSubscription = customerState?.activeSubscriptions?.length! > 0;
  console.log("Active subscriptions:", customerState?.activeSubscriptions);

  return (
    <>
      <p>Plan: {hasProSubscription ? "Pro" : "Free"}</p>
      {hasProSubscription ? (
        <Button onClick={async () => await authClient.customer.portal()}>
          Manage Subscription
        </Button>
      ) : (
        <Button
          onClick={async () => await authClient.checkout({ slug: "pro" })}
        >
          Upgrade to Pro
        </Button>
      )}
    </>
  );
}
