import { useMemo, useState } from "react";
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerContent,
  ColorPickerEyeDropper,
  ColorPickerFormatSelect,
  ColorPickerHueSlider,
  ColorPickerInput,
  ColorPickerTrigger,
} from "@/components/ui/color-picker";
import type { SvgLayer } from "@/stores/use-editor-store";

const SKIP_VALUES = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
]);

function isSkippedColor(color: string): boolean {
  const lower = color.toLowerCase().trim();
  return (
    lower === "" ||
    SKIP_VALUES.has(lower) ||
    lower.startsWith("url(") ||
    lower.startsWith("var(")
  );
}

function normalizeHexColor(color: string): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    if (trimmed.length === 4) {
      const r = trimmed[1];
      const g = trimmed[2];
      const b = trimmed[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return trimmed.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function extractSvgColors(svgString: string): string[] {
  const colors = new Set<string>();

  // Match fill="..." and stroke="..."
  const attrRegex = /(?:fill|stroke)="([^"]+)"/g;
  let match = attrRegex.exec(svgString);
  while (match !== null) {
    const color = match[1].trim();
    if (!isSkippedColor(color)) {
      colors.add(normalizeHexColor(color));
    }
    match = attrRegex.exec(svgString);
  }

  // Match fill:... and stroke:... in style attributes
  const styleRegex = /(?:fill|stroke)\s*:\s*([^;}"'\s]+)/g;
  let styleMatch = styleRegex.exec(svgString);
  while (styleMatch !== null) {
    const color = styleMatch[1].trim();
    if (!isSkippedColor(color)) {
      colors.add(normalizeHexColor(color));
    }
    styleMatch = styleRegex.exec(svgString);
  }

  return [...colors];
}

export function applySvgColorMap(
  svgString: string,
  colorMap: Record<string, string>
): string {
  let result = svgString;
  for (const [original, replacement] of Object.entries(colorMap)) {
    if (original === replacement) continue;
    // Attribute values
    result = result.replaceAll(`fill="${original}"`, `fill="${replacement}"`);
    result = result.replaceAll(
      `stroke="${original}"`,
      `stroke="${replacement}"`
    );
    // Inline style (with and without space after colon)
    result = result.replaceAll(`fill:${original}`, `fill:${replacement}`);
    result = result.replaceAll(`stroke:${original}`, `stroke:${replacement}`);
    result = result.replaceAll(`fill: ${original}`, `fill: ${replacement}`);
    result = result.replaceAll(`stroke: ${original}`, `stroke: ${replacement}`);
  }
  return result;
}

interface SvgPropertiesProps {
  layer: SvgLayer;
  onUpdate: (updates: Partial<SvgLayer>) => void;
}

export function SvgProperties({ layer, onUpdate }: SvgPropertiesProps) {
  const colors = useMemo(
    () => extractSvgColors(layer.svgString),
    [layer.svgString]
  );

  const [openColor, setOpenColor] = useState<string | null>(null);

  const getDisplayColor = (original: string): string => {
    return layer.colorMap[original] ?? original;
  };

  const handleColorChange = (original: string, newColor: string) => {
    onUpdate({
      colorMap: {
        ...layer.colorMap,
        [original]: newColor,
      },
    });
  };

  if (colors.length === 0) {
    return (
      <div className="text-muted-foreground text-xs">
        No editable colors detected
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-muted-foreground text-xs">
        SVG Colors
      </label>
      <div className="flex flex-wrap gap-2">
        {colors.map((originalColor) => {
          const displayColor = getDisplayColor(originalColor);
          return (
            <ColorPicker
              key={originalColor}
              onOpenChange={(open) => setOpenColor(open ? originalColor : null)}
              onValueChange={(value) => handleColorChange(originalColor, value)}
              open={openColor === originalColor}
              value={displayColor}
            >
              <ColorPickerTrigger
                className="size-7 rounded border border-border p-0 shadow-sm transition-transform hover:scale-110"
                title={`Change color: ${displayColor}`}
              >
                <div
                  className="size-full rounded"
                  style={{ backgroundColor: displayColor }}
                />
              </ColorPickerTrigger>
              <ColorPickerContent>
                <ColorPickerArea />
                <ColorPickerHueSlider />
                <div className="flex items-center gap-2">
                  <ColorPickerEyeDropper />
                  <ColorPickerInput className="flex-1" withoutAlpha />
                  <ColorPickerFormatSelect />
                </div>
              </ColorPickerContent>
            </ColorPicker>
          );
        })}
      </div>
    </div>
  );
}
