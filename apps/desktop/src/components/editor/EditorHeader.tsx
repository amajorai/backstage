import {
  ArrowLeft,
  ChevronDown,
  Download,
  Grid2X2,
  Ruler,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { TitleBar } from "@/components/TitleBar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/use-editor-store";

interface EditorHeaderProps {
  projectName: string;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onShowConfirmClose: () => void;
  onNameChange: (name: string) => void;
  onExportTemplate?: () => void;
  onImportTemplate?: () => void;
}

export function EditorHeader({
  projectName,
  hasUnsavedChanges,
  onClose,
  onShowConfirmClose,
  onNameChange,
  onExportTemplate,
  onImportTemplate,
}: EditorHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { showRulers, showGrid, toggleRulers, toggleGrid } = useEditorStore();

  const handleBack = () => {
    if (hasUnsavedChanges) {
      onShowConfirmClose();
    } else {
      onClose();
    }
  };

  return (
    <TitleBar
      className="h-12 border-b-0"
      showIcon={false}
      title={
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger
              className={buttonVariants({
                size: "icon-sm",
                variant: "ghost",
              })}
              onClick={handleBack}
            >
              <ArrowLeft className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Back to Gallery</TooltipContent>
          </Tooltip>
          {isEditingName ? (
            <input
              autoFocus
              className="max-w-50 border-none bg-transparent font-medium text-sm outline-none"
              defaultValue={projectName}
              onBlur={(e) => {
                onNameChange(e.target.value);
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  setIsEditingName(false);
                }
              }}
              ref={nameInputRef}
            />
          ) : (
            <span
              className="cursor-text truncate font-medium text-muted-foreground text-sm hover:text-foreground"
              onClick={() => {
                setIsEditingName(true);
                setTimeout(() => nameInputRef.current?.focus(), 0);
              }}
            >
              {projectName}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "ml-2 h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
              )}
            >
              File <ChevronDown className="size-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onImportTemplate}>
                <Upload className="mr-2 size-4" /> Import Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportTemplate}>
                <Download className="mr-2 size-4" /> Export Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
              <DropdownMenuSeparator />
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
