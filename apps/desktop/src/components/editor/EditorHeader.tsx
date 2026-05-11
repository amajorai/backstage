import { ChevronDown, Grid2X2, Ruler } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { TitleBar } from "@/components/TitleBar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/use-editor-store";
import { ToolOptionsBar } from "./ToolOptionsBar";

interface EditorHeaderProps {
  projectName: string;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onShowConfirmClose: () => void;
  onNameChange: (name: string) => void;
}

export function EditorHeader({
  projectName,
  hasUnsavedChanges,
  onClose,
  onShowConfirmClose,
  onNameChange,
}: EditorHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editValue, setEditValue] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const { showRulers, showGrid, toggleRulers, toggleGrid } = useEditorStore();

  useLayoutEffect(() => {
    if (nameInputRef.current && measureRef.current) {
      nameInputRef.current.style.width = `${measureRef.current.scrollWidth}px`;
    }
  }, [editValue, isEditingName]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      onShowConfirmClose();
    } else {
      onClose();
    }
  };

  return (
    <TitleBar
      center={<ToolOptionsBar />}
      className="h-12 border-b-0"
      showIcon={false}
      title={
        <div className="flex items-center gap-3">
          {/* hidden span to measure text width */}
          <span
            aria-hidden
            className="pointer-events-none invisible absolute whitespace-pre font-medium text-sm"
            ref={measureRef}
          >
            {editValue || " "}
          </span>

          {isEditingName ? (
            <input
              autoFocus
              className="border-none bg-transparent font-medium text-sm outline-none"
              onBlur={() => {
                onNameChange(editValue);
                setIsEditingName(false);
              }}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  setIsEditingName(false);
                }
              }}
              ref={nameInputRef}
              value={editValue}
            />
          ) : (
            <span
              className="cursor-text truncate font-medium text-muted-foreground text-sm hover:text-foreground"
              onClick={() => {
                setEditValue(projectName);
                setIsEditingName(true);
              }}
            >
              {projectName}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
              )}
            >
              View <ChevronDown className="size-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={toggleRulers}>
                <Ruler className="mr-2 size-4" />
                Rulers
                <div className="ml-auto flex items-center gap-2">
                  {showRulers && <span className="text-xs opacity-60">✓</span>}
                  <span className="ml-auto text-muted-foreground text-xs tracking-widest opacity-60">
                    ⇧R
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleGrid}>
                <Grid2X2 className="mr-2 size-4" />
                Grid
                <div className="ml-auto flex items-center gap-2">
                  {showGrid && <span className="text-xs opacity-60">✓</span>}
                  <span className="ml-auto text-muted-foreground text-xs tracking-widest opacity-60">
                    ⇧G
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  );
}
