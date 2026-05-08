import { useCallback, useEffect, useRef, useState } from "react";
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
import { applyRasterColorMap, extractRasterColors } from "@/lib/raster-color";
import type { ImageLayer } from "@/stores/use-editor-store";

interface ImageColorPropertiesProps {
  layer: ImageLayer;
  onUpdate: (updates: Partial<ImageLayer>) => void;
}

export function ImageColorProperties({
  layer,
  onUpdate,
}: ImageColorPropertiesProps) {
  const [colors, setColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [openColor, setOpenColor] = useState<string | null>(null);
  // Optimistic local color map (updates immediately for swatch preview)
  const [localColorMap, setLocalColorMap] = useState<Record<string, string>>(
    () => layer.imageColorMap ?? {}
  );

  const baseUrl = layer.baseDataUrl ?? layer.dataUrl;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    extractRasterColors(baseUrl)
      .then(setColors)
      .finally(() => setLoading(false));
  }, [baseUrl]);

  // Sync local map when layer changes from outside (e.g. undo)
  useEffect(() => {
    setLocalColorMap(layer.imageColorMap ?? {});
  }, [layer.imageColorMap]);

  const getDisplayColor = (original: string): string => {
    return localColorMap[original] ?? original;
  };

  const applyToCanvas = useCallback(
    async (newMap: Record<string, string>) => {
      if (applyingRef.current) return;
      applyingRef.current = true;
      try {
        const newDataUrl = await applyRasterColorMap(baseUrl, newMap);
        onUpdate({
          dataUrl: newDataUrl,
          baseDataUrl: baseUrl,
          imageColorMap: newMap,
        });
      } finally {
        applyingRef.current = false;
      }
    },
    [baseUrl, onUpdate]
  );

  const handleColorChange = useCallback(
    (original: string, newColor: string) => {
      const newMap = { ...localColorMap, [original]: newColor };
      // Update swatch immediately
      setLocalColorMap(newMap);
      // Debounce the expensive canvas op — only fires 400ms after drag stops
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        applyToCanvas(newMap);
      }, 400);
    },
    [localColorMap, applyToCanvas]
  );

  if (loading) {
    return (
      <div className="text-muted-foreground text-xs">Detecting colors…</div>
    );
  }

  if (colors.length === 0) {
    return (
      <div className="text-muted-foreground text-xs">
        No colors detected (transparent or uniform image)
      </div>
    );
  }

  return (
    <div>
      <label className="mb-2 block text-muted-foreground text-xs">
        Image Colors
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
