import { Link, Unlink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ColorPicker,
  ColorPickerAlphaSlider,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerTrigger,
} from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { Layer, ShapeLayer } from "@/stores/use-editor-store";

interface ShapePropertiesProps {
  layer: ShapeLayer;
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

export function ShapeProperties({ layer, onUpdate }: ShapePropertiesProps) {
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
    <>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-muted-foreground text-xs">
            Fill
          </label>
          <ColorPicker
            onValueChange={(fill) => onUpdate({ fill })}
            value={layer.fill}
          >
            <ColorPickerTrigger className="w-full justify-start gap-2 px-2 text-left font-normal">
              <div
                className="size-4 rounded border border-border"
                style={{ backgroundColor: layer.fill }}
              />
              <span className="truncate">{layer.fill}</span>
            </ColorPickerTrigger>
            <ColorPickerContent>
              <ColorPickerArea className="h-40 w-full rounded-md border" />
              <div className="mt-4 flex flex-col gap-2">
                <ColorPickerHueSlider />
                <ColorPickerAlphaSlider />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <ColorPickerInput />
                <ColorPickerEyeDropper />
              </div>
            </ColorPickerContent>
          </ColorPicker>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-muted-foreground text-xs">
            Stroke
          </label>
          <ColorPicker
            onValueChange={(stroke) => onUpdate({ stroke })}
            value={layer.stroke || "#00000000"}
          >
            <ColorPickerTrigger className="w-full justify-start gap-2 px-2 text-left font-normal">
              <div
                className="size-4 rounded border border-border"
                style={{ backgroundColor: layer.stroke || "transparent" }}
              />
              <span className="truncate">{layer.stroke || "None"}</span>
            </ColorPickerTrigger>
            <ColorPickerContent>
              <ColorPickerArea className="h-40 w-full rounded-md border" />
              <div className="mt-4 flex flex-col gap-2">
                <ColorPickerHueSlider />
                <ColorPickerAlphaSlider />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <ColorPickerInput />
                <ColorPickerEyeDropper />
              </div>
            </ColorPickerContent>
          </ColorPicker>
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-muted-foreground text-xs">Stroke Width</label>
          <span className="text-muted-foreground text-xs">
            {layer.strokeWidth}px
          </span>
        </div>
        <Slider
          max={20}
          min={0}
          onValueChange={(value) => onUpdate({ strokeWidth: value[0] })}
          step={1}
          value={[layer.strokeWidth]}
        />
      </div>
      {layer.shapeType === "rect" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-muted-foreground text-xs">
              Corner Radius
            </label>
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
                  <span className="text-[10px] text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
