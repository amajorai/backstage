import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_ADJUSTMENTS,
  type LayerAdjustments,
} from "@/stores/use-editor-store";

interface AdjustmentPropertiesProps {
  adjustments: LayerAdjustments;
  onUpdate: (adjustments: LayerAdjustments) => void;
}

const SLIDERS: {
  key: keyof Pick<
    LayerAdjustments,
    "brightness" | "contrast" | "hue" | "saturation" | "blur"
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
    !adj.invert &&
    !adj.sepia &&
    !adj.grayscale
  );
}

export function AdjustmentProperties({
  adjustments,
  onUpdate,
}: AdjustmentPropertiesProps) {
  const update = (patch: Partial<LayerAdjustments>) =>
    onUpdate({ ...adjustments, ...patch });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-muted-foreground text-xs uppercase">
          Adjustments
        </span>
        {!isDefault(adjustments) && (
          <Button
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => onUpdate({ ...DEFAULT_ADJUSTMENTS })}
            size="sm"
            variant="ghost"
          >
            <RotateCcw className="size-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-muted-foreground text-xs">{label}</label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {adjustments[key]}
              </span>
            </div>
            <Slider
              max={max}
              min={min}
              onValueChange={(v) => update({ [key]: v[0] })}
              step={step}
              value={[adjustments[key] as number]}
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
              onClick={() => update({ [key]: !adjustments[key] })}
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
