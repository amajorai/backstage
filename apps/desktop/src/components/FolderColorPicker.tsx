import { Check } from "lucide-react";
import * as sounds from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { FOLDER_COLORS } from "@/stores/use-folder-store";

interface FolderColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

export function FolderColorPicker({ value, onChange }: FolderColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={cn(
          "flex size-7 items-center justify-center rounded-full border-2 bg-muted transition-transform hover:scale-110",
          value === null ? "border-foreground" : "border-transparent"
        )}
        onClick={() => {
          sounds.click();
          onChange(null);
        }}
        title="No color"
        type="button"
      >
        {value === null && <Check className="size-3.5 text-foreground" />}
      </button>
      {FOLDER_COLORS.map((color) => (
        <button
          className={cn(
            "flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110",
            value === color ? "border-foreground" : "border-transparent"
          )}
          key={color}
          onClick={() => {
            sounds.click();
            onChange(color);
          }}
          style={{ backgroundColor: color }}
          title={color}
          type="button"
        >
          {value === color && (
            <Check className="size-3.5 text-white drop-shadow" />
          )}
        </button>
      ))}
    </div>
  );
}
