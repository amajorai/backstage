import { Button } from "@repo/ui/button";
import type { ReactNode } from "react";
import * as sounds from "@/lib/sounds";

interface EmptyStateProps {
  /** Icon to display */
  icon: ReactNode;
  /** Main title text */
  title: string;
  /** Description text */
  description: string;
  /** Optional action button or node */
  action?:
    | ReactNode
    | {
        label: string;
        icon?: ReactNode;
        onClick: () => void;
      };
}

function isValidAction(
  action: any
): action is { label: string; icon?: ReactNode; onClick: () => void } {
  return typeof action === "object" && action !== null && "onClick" in action;
}

/**
 * Empty state component for galleries and pages without content.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="text-muted-foreground opacity-40">{icon}</div>
      <div className="text-center">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
      {action &&
        (isValidAction(action) ? (
          <Button
            onClick={() => {
              sounds.click();
              action.onClick();
            }}
            variant="ghost"
          >
            {action.icon}
            {action.label}
          </Button>
        ) : (
          action
        ))}
    </div>
  );
}
