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
import { Slider } from "@/components/ui/slider";
import type { Layer, TextLayer } from "@/stores/use-editor-store";

interface ShadowPropertiesProps {
  layer: TextLayer;
  onUpdate: (updates: Partial<Layer>) => void;
}

export function ShadowProperties({ layer, onUpdate }: ShadowPropertiesProps) {
  return (
    <>
      {/* Shadow */}
      <div className="border-border border-t pt-4">
        <span className="mb-2 block text-muted-foreground text-xs">Shadow</span>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-muted-foreground text-xs">
              Color
            </label>
            <ColorPicker
              onValueChange={(shadowColor) => onUpdate({ shadowColor })}
              value={layer.shadowColor}
            >
              <ColorPickerTrigger className="w-full justify-start gap-2 px-2 text-left font-normal">
                <div
                  className="size-4 rounded border border-border"
                  style={{
                    backgroundColor: layer.shadowColor.startsWith("rgba")
                      ? "transparent"
                      : layer.shadowColor,
                    backgroundImage:
                      layer.shadowColor.startsWith("rgba") &&
                      layer.shadowColor.endsWith("0)")
                        ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                        : "none",
                    backgroundSize: "8px 8px",
                  }}
                />
                <span className="truncate">
                  {layer.shadowColor === "rgba(0,0,0,0.5)"
                    ? "Default Shadow"
                    : layer.shadowColor}
                </span>
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
              Blur ({layer.shadowBlur}px)
            </label>
            <Slider
              max={50}
              min={0}
              onValueChange={(value) => onUpdate({ shadowBlur: value[0] })}
              step={1}
              value={[layer.shadowBlur]}
            />
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-muted-foreground text-xs">
              Offset X ({layer.shadowOffsetX}px)
            </label>
            <Slider
              max={50}
              min={-50}
              onValueChange={(value) => onUpdate({ shadowOffsetX: value[0] })}
              step={1}
              value={[layer.shadowOffsetX]}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-muted-foreground text-xs">
              Offset Y ({layer.shadowOffsetY}px)
            </label>
            <Slider
              max={50}
              min={-50}
              onValueChange={(value) => onUpdate({ shadowOffsetY: value[0] })}
              step={1}
              value={[layer.shadowOffsetY]}
            />
          </div>
        </div>
      </div>

      {/* Glow */}
      <div className="border-border border-t pt-4">
        <span className="mb-2 block text-muted-foreground text-xs">Glow</span>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-muted-foreground text-xs">
              Color
            </label>
            <ColorPicker
              onValueChange={(glowColor) => onUpdate({ glowColor })}
              value={layer.glowColor || "#ffffff00"}
            >
              <ColorPickerTrigger className="w-full justify-start gap-2 px-2 text-left font-normal">
                <div
                  className="size-4 rounded border border-border"
                  style={{
                    backgroundColor: layer.glowColor || "transparent",
                  }}
                />
                <span className="truncate">{layer.glowColor || "None"}</span>
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
              Size ({layer.glowSize ?? 0}px)
            </label>
            <Slider
              max={30}
              min={0}
              onValueChange={(value) => onUpdate({ glowSize: value[0] })}
              step={1}
              value={[layer.glowSize ?? 0]}
            />
          </div>
        </div>
      </div>
    </>
  );
}
