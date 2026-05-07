import { Link, Unlink } from "lucide-react";
import { useState } from "react";
import { AdjustmentProperties } from "@/components/editor/adjustment-properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_ADJUSTMENTS,
  type ImageLayer,
  type Layer,
} from "@/stores/use-editor-store";

interface ImagePropertiesProps {
  layer: ImageLayer;
  onUpdate: (updates: Partial<Layer>) => void;
}

// Helper to get corner radii array
function getCornerRadii(
  cornerRadius: number | [number, number, number, number]
): [number, number, number, number] {
  if (typeof cornerRadius === "number") {
    return [cornerRadius, cornerRadius, cornerRadius, cornerRadius];
  }
  return cornerRadius;
}

export function ImageProperties({ layer, onUpdate }: ImagePropertiesProps) {
  const [linked, setLinked] = useState(() => {
    if (typeof layer.cornerRadius === "number") return true;
    const [a, b, c, d] = layer.cornerRadius;
    return a === b && b === c && c === d;
  });

  const radii = getCornerRadii(layer.cornerRadius);

  const handleRadiusChange = (index: number, value: number) => {
    if (linked) {
      onUpdate({ cornerRadius: value });
    } else {
      const newRadii: [number, number, number, number] = [...radii];
      newRadii[index] = value;
      onUpdate({ cornerRadius: newRadii });
    }
  };

  const handleSliderChange = (value: number) => {
    if (linked) {
      onUpdate({ cornerRadius: value });
    } else {
      onUpdate({ cornerRadius: [value, value, value, value] });
    }
  };

  const toggleLinked = () => {
    if (linked) {
      // Switching to unlinked - keep current values as array
      setLinked(false);
    } else {
      // Switching to linked - use the first corner value for all
      const uniformRadius = radii[0];
      onUpdate({ cornerRadius: uniformRadius });
      setLinked(true);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-muted-foreground text-xs">Corner Radius</label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {linked ? `${radii[0]}px` : "Mixed"}
          </span>
          <Button
            className="size-6"
            onClick={toggleLinked}
            size="icon"
            title={linked ? "Unlink corners" : "Link corners"}
            variant="ghost"
          >
            {linked ? (
              <Link className="size-3" />
            ) : (
              <Unlink className="size-3" />
            )}
          </Button>
        </div>
      </div>
      {linked ? (
        <Slider
          max={100}
          min={0}
          onValueChange={(value) => handleSliderChange(value[0])}
          step={1}
          value={[radii[0]]}
        />
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {["TL", "TR", "BR", "BL"].map((label, index) => (
            <div className="flex flex-col items-center gap-1" key={label}>
              <Input
                className="h-8 w-full px-1 text-center text-xs"
                max={100}
                min={0}
                onChange={(e) =>
                  handleRadiusChange(index, Number(e.target.value) || 0)
                }
                type="number"
                value={radii[index]}
              />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="my-2 border-border border-t" />
      <AdjustmentProperties
        adjustments={layer.adjustments ?? { ...DEFAULT_ADJUSTMENTS }}
        onUpdate={(adjustments) => onUpdate({ adjustments })}
      />
    </div>
  );
}
