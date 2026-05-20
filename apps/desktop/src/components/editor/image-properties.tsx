import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Slider } from "@repo/ui/slider";
import { FlipHorizontal2, FlipVertical2, Link, Unlink } from "lucide-react";
import { useState } from "react";
import { AdjustmentProperties } from "@/components/editor/adjustment-properties";
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
import { computeAutoAdjustments } from "@/lib/auto-adjust";
import * as sounds from "@/lib/sounds";
import {
  DEFAULT_ADJUSTMENTS,
  type ImageLayer,
  type Layer,
} from "@/stores/use-editor-store";

interface ImagePropertiesProps {
  layer: ImageLayer;
  onUpdate: (updates: Partial<Layer>) => void;
}

function getCornerRadii(
  cornerRadius: number | [number, number, number, number]
): [number, number, number, number] {
  if (typeof cornerRadius === "number") {
    return [cornerRadius, cornerRadius, cornerRadius, cornerRadius];
  }
  return cornerRadius;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="border-border border-t pt-3">
      <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
        {label}
      </span>
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  const isTransparent = color.startsWith("rgba") && color.endsWith("0)");
  return (
    <div
      className="size-4 shrink-0 rounded border border-border"
      style={{
        backgroundColor: isTransparent ? "transparent" : color,
        backgroundImage: isTransparent
          ? "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)"
          : "none",
        backgroundSize: "8px 8px",
      }}
    />
  );
}

export function ImageProperties({ layer, onUpdate }: ImagePropertiesProps) {
  const [linkedRadius, setLinkedRadius] = useState(() => {
    if (typeof layer.cornerRadius === "number") return true;
    const [a, b, c, d] = layer.cornerRadius;
    return a === b && b === c && c === d;
  });
  const [locked, setLocked] = useState(layer.lockAspectRatio ?? true);

  const radii = getCornerRadii(layer.cornerRadius);
  const visualW = Math.round(layer.width * layer.scaleX);
  const visualH = Math.round(layer.height * layer.scaleY);

  const handleWChange = (val: number) => {
    if (val < 1) return;
    const newScaleX = val / layer.width;
    if (locked) {
      const newScaleY = (newScaleX / layer.scaleX) * layer.scaleY;
      onUpdate({ scaleX: newScaleX, scaleY: newScaleY });
    } else {
      onUpdate({ scaleX: newScaleX });
    }
  };

  const handleHChange = (val: number) => {
    if (val < 1) return;
    const newScaleY = val / layer.height;
    if (locked) {
      const newScaleX = (newScaleY / layer.scaleY) * layer.scaleX;
      onUpdate({ scaleX: newScaleX, scaleY: newScaleY });
    } else {
      onUpdate({ scaleY: newScaleY });
    }
  };

  const handleRadiusChange = (index: number, value: number) => {
    if (linkedRadius) {
      onUpdate({ cornerRadius: value });
    } else {
      const newRadii: [number, number, number, number] = [...radii];
      newRadii[index] = value;
      onUpdate({ cornerRadius: newRadii });
    }
  };

  const toggleLinkedRadius = () => {
    if (linkedRadius) {
      setLinkedRadius(false);
    } else {
      onUpdate({ cornerRadius: radii[0] });
      setLinkedRadius(true);
    }
  };

  const shadowColor = layer.shadowColor ?? "rgba(0,0,0,0.5)";
  const shadowBlur = layer.shadowBlur ?? 0;
  const shadowOffsetX = layer.shadowOffsetX ?? 0;
  const shadowOffsetY = layer.shadowOffsetY ?? 0;
  const glowColor = layer.glowColor ?? "#ffffff00";
  const glowSize = layer.glowSize ?? 0;
  const fillMode = layer.fillMode ?? "stretch";

  return (
    <div className="space-y-3">
      {/* Position & Size */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-muted-foreground text-xs">
              X
            </label>
            <Input
              className="h-8 text-xs"
              onChange={(e) => onUpdate({ x: Number(e.target.value) || 0 })}
              type="number"
              value={Math.round(layer.x)}
            />
          </div>
          <div>
            <label className="mb-1 block text-muted-foreground text-xs">
              Y
            </label>
            <Input
              className="h-8 text-xs"
              onChange={(e) => onUpdate({ y: Number(e.target.value) || 0 })}
              type="number"
              value={Math.round(layer.y)}
            />
          </div>
        </div>
        <div className="flex items-end gap-1">
          <div className="flex-1">
            <label className="mb-1 block text-muted-foreground text-xs">
              W
            </label>
            <Input
              className="h-8 text-xs"
              min={1}
              onChange={(e) => handleWChange(Number(e.target.value) || 1)}
              type="number"
              value={visualW}
            />
          </div>
          <Button
            className="size-8 shrink-0"
            onClick={() => {
              sounds.click();
              const next = !locked;
              setLocked(next);
              onUpdate({ lockAspectRatio: next });
            }}
            size="icon"
            title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            variant="ghost"
          >
            {locked ? (
              <Link className="size-3" />
            ) : (
              <Unlink className="size-3" />
            )}
          </Button>
          <div className="flex-1">
            <label className="mb-1 block text-muted-foreground text-xs">
              H
            </label>
            <Input
              className="h-8 text-xs"
              min={1}
              onChange={(e) => handleHChange(Number(e.target.value) || 1)}
              type="number"
              value={visualH}
            />
          </div>
        </div>
      </div>

      {/* Transform */}
      <SectionDivider label="Transform" />
      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-muted-foreground text-xs">
            Rotation
          </label>
          <div className="flex items-center gap-2">
            <Slider
              className="flex-1"
              max={180}
              min={-180}
              onValueChange={([v]) => onUpdate({ rotation: v })}
              step={1}
              value={[layer.rotation]}
            />
            <Input
              className="h-7 w-14 shrink-0 px-1 text-center text-xs"
              max={180}
              min={-180}
              onChange={(e) =>
                onUpdate({ rotation: Number(e.target.value) || 0 })
              }
              type="number"
              value={Math.round(layer.rotation)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            className="h-8 flex-1 gap-1 text-xs"
            onClick={() => {
              sounds.click();
              onUpdate({ flipHorizontal: !layer.flipHorizontal });
            }}
            variant={layer.flipHorizontal ? "secondary" : "outline"}
          >
            <FlipHorizontal2 className="size-3" />
            Flip H
          </Button>
          <Button
            className="h-8 flex-1 gap-1 text-xs"
            onClick={() => {
              sounds.click();
              onUpdate({ flipVertical: !layer.flipVertical });
            }}
            variant={layer.flipVertical ? "secondary" : "outline"}
          >
            <FlipVertical2 className="size-3" />
            Flip V
          </Button>
        </div>
      </div>

      {/* Corner Radius */}
      <SectionDivider label="Corner Radius" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {linkedRadius ? `${radii[0]}px` : "Mixed"}
          </span>
          <Button
            className="size-6"
            onClick={() => {
              sounds.click();
              toggleLinkedRadius();
            }}
            size="icon"
            title={linkedRadius ? "Unlink corners" : "Link corners"}
            variant="ghost"
          >
            {linkedRadius ? (
              <Link className="size-3" />
            ) : (
              <Unlink className="size-3" />
            )}
          </Button>
        </div>
        {linkedRadius ? (
          <Slider
            max={100}
            min={0}
            onValueChange={([v]) => onUpdate({ cornerRadius: v })}
            step={1}
            value={[radii[0]]}
          />
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {(["TL", "TR", "BR", "BL"] as const).map((label, index) => (
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

      {/* Fill Mode */}
      <SectionDivider label="Fill Mode" />
      <div className="flex gap-1">
        {(["stretch", "fit", "fill"] as const).map((mode) => (
          <button
            className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors ${
              fillMode === mode
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground"
            }`}
            key={mode}
            onClick={() => {
              sounds.click();
              onUpdate({ fillMode: mode });
            }}
            type="button"
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Shadow */}
      <SectionDivider label="Shadow" />
      <div className="space-y-2">
        <ColorPicker
          onValueChange={(c) => onUpdate({ shadowColor: c })}
          value={shadowColor}
        >
          <ColorPickerTrigger className="w-full justify-start gap-2 px-2 text-left font-normal">
            <ColorSwatch color={shadowColor} />
            <span className="truncate text-xs">{shadowColor}</span>
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
        {(
          [
            {
              label: "Blur",
              key: "shadowBlur",
              min: 0,
              max: 50,
              value: shadowBlur,
            },
            {
              label: "X",
              key: "shadowOffsetX",
              min: -100,
              max: 100,
              value: shadowOffsetX,
            },
            {
              label: "Y",
              key: "shadowOffsetY",
              min: -100,
              max: 100,
              value: shadowOffsetY,
            },
          ] as const
        ).map(({ label, key, min, max, value }) => (
          <div key={key}>
            <label className="mb-1 block text-muted-foreground text-xs">
              {label}
            </label>
            <div className="flex items-center gap-2">
              <Slider
                className="flex-1"
                max={max}
                min={min}
                onValueChange={([v]) => onUpdate({ [key]: v })}
                step={1}
                value={[value]}
              />
              <Input
                className="h-7 w-14 shrink-0 px-1 text-center text-xs"
                max={max}
                min={min}
                onChange={(e) =>
                  onUpdate({ [key]: Number(e.target.value) || 0 })
                }
                type="number"
                value={value}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Glow */}
      <SectionDivider label="Glow" />
      <div className="space-y-2">
        <ColorPicker
          onValueChange={(c) => onUpdate({ glowColor: c })}
          value={glowColor}
        >
          <ColorPickerTrigger className="w-full justify-start gap-2 px-2 text-left font-normal">
            <ColorSwatch color={glowColor} />
            <span className="truncate text-xs">{glowColor}</span>
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
        <div>
          <label className="mb-1 block text-muted-foreground text-xs">
            Size
          </label>
          <div className="flex items-center gap-2">
            <Slider
              className="flex-1"
              max={30}
              min={0}
              onValueChange={([v]) => onUpdate({ glowSize: v })}
              step={1}
              value={[glowSize]}
            />
            <Input
              className="h-7 w-14 shrink-0 px-1 text-center text-xs"
              max={30}
              min={0}
              onChange={(e) =>
                onUpdate({ glowSize: Number(e.target.value) || 0 })
              }
              type="number"
              value={glowSize}
            />
          </div>
        </div>
      </div>

      {/* Adjustments */}
      <div className="border-border border-t pt-3">
        <AdjustmentProperties
          adjustments={layer.adjustments ?? { ...DEFAULT_ADJUSTMENTS }}
          onAutoAdjust={() => computeAutoAdjustments(layer.dataUrl)}
          onUpdate={(adjustments) => onUpdate({ adjustments })}
        />
      </div>
    </div>
  );
}
