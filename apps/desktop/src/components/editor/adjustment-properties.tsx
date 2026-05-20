import { Button } from "@repo/ui/button";
import { Slider } from "@repo/ui/slider";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import * as sounds from "@/lib/sounds";
import {
  DEFAULT_ADJUSTMENTS,
  type LayerAdjustments,
} from "@/stores/use-editor-store";

interface AdjustmentPropertiesProps {
  adjustments: LayerAdjustments;
  onUpdate: (adjustments: LayerAdjustments) => void;
  onAutoAdjust?: () => Promise<Partial<LayerAdjustments>>;
}

const SLIDERS: {
  key: keyof Pick<
    LayerAdjustments,
    "brightness" | "contrast" | "hue" | "saturation" | "blur" | "sharpen"
  >;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "brightness", label: "Brightness", min: -100, max: 100, step: 1 },
  { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1 },
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1 },
  { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1 },
  { key: "blur", label: "Blur", min: 0, max: 20, step: 0.5 },
  { key: "sharpen", label: "Sharpen", min: 0, max: 1, step: 0.05 },
];

const TOGGLES: {
  key: keyof Pick<LayerAdjustments, "invert" | "sepia" | "grayscale">;
  label: string;
}[] = [
  { key: "grayscale", label: "Grayscale" },
  { key: "sepia", label: "Sepia" },
  { key: "invert", label: "Invert" },
];

function isDefault(adj: LayerAdjustments): boolean {
  return (
    adj.brightness === 0 &&
    adj.contrast === 0 &&
    adj.hue === 0 &&
    adj.saturation === 0 &&
    adj.blur === 0 &&
    (adj.sharpen ?? 0) === 0 &&
    !adj.invert &&
    !adj.sepia &&
    !adj.grayscale
  );
}

export function AdjustmentProperties({
  adjustments,
  onUpdate,
  onAutoAdjust,
}: AdjustmentPropertiesProps) {
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const update = (patch: Partial<LayerAdjustments>) =>
    onUpdate({ ...adjustments, ...patch });

  const handleAuto = async () => {
    if (!onAutoAdjust) return;
    setIsAutoLoading(true);
    try {
      const suggested = await onAutoAdjust();
      onUpdate({ ...DEFAULT_ADJUSTMENTS, ...suggested });
    } finally {
      setIsAutoLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-muted-foreground text-xs uppercase">
          Adjustments
        </span>
        <div className="flex items-center gap-1">
          {onAutoAdjust && (
            <Button
              className="h-6 gap-1 px-2 text-xs"
              disabled={isAutoLoading}
              onClick={() => {
                sounds.click();
                handleAuto();
              }}
              size="sm"
              variant="ghost"
            >
              {isAutoLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
              Auto
            </Button>
          )}
          {!isDefault(adjustments) && (
            <Button
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => {
                sounds.click();
                onUpdate({ ...DEFAULT_ADJUSTMENTS });
              }}
              size="sm"
              variant="ghost"
            >
              <RotateCcw className="size-3" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-muted-foreground text-xs">{label}</label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {adjustments[key] ?? 0}
              </span>
            </div>
            <Slider
              max={max}
              min={min}
              onValueChange={(v) => update({ [key]: v[0] })}
              step={step}
              value={[(adjustments[key] ?? 0) as number]}
            />
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          {TOGGLES.map(({ key, label }) => (
            <button
              className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                adjustments[key]
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground"
              }`}
              key={key}
              onClick={() => {
                sounds.click();
                update({ [key]: !adjustments[key] });
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
