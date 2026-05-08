import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdjustmentProperties } from "@/components/editor/adjustment-properties";
import { ImageColorProperties } from "@/components/editor/image-color-properties";
import { ImageProperties } from "@/components/editor/image-properties";
import { ShadowProperties } from "@/components/editor/shadow-properties";
import { ShapeProperties } from "@/components/editor/shape-properties";
import { SvgProperties } from "@/components/editor/svg-properties";
import { TextProperties } from "@/components/editor/text-properties";
import { Slider } from "@/components/ui/slider";
import {
  type AnimatedImageLayer,
  DEFAULT_ADJUSTMENTS,
  type DrawLayer,
  type ImageLayer,
  type Layer,
  type ShapeLayer,
  type SvgLayer,
  type TextLayer,
  useEditorStore,
} from "@/stores/use-editor-store";

const FALLBACK_FONTS = [
  "Inter",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Courier New",
  "Impact",
  "Comic Sans MS",
];

async function getSystemFonts(): Promise<string[]> {
  try {
    if ("queryLocalFonts" in window) {
      const fonts = await (
        window as unknown as {
          queryLocalFonts: () => Promise<
            { fullName: string; family: string }[]
          >;
        }
      ).queryLocalFonts();
      const fontNames = [...new Set(fonts.map((f) => f.fullName))].sort();
      return fontNames.length > 0 ? fontNames : FALLBACK_FONTS;
    }
  } catch (error) {
    console.warn("Could not query local fonts:", error);
  }
  return FALLBACK_FONTS;
}

export function PropertiesPanel() {
  const { layers, activeLayerIds, updateLayer, pushHistory } = useEditorStore();
  const activeLayer =
    activeLayerIds.length === 1
      ? layers.find((l) => l.id === activeLayerIds[0])
      : null;
  const isMultiple = activeLayerIds.length > 1;

  const [fontFamilies, setFontFamilies] = useState<string[]>(FALLBACK_FONTS);
  const lastPushRef = useRef<number>(0);

  useEffect(() => {
    getSystemFonts().then(setFontFamilies);
  }, []);

  const pushHistoryDebounced = () => {
    const now = Date.now();
    if (now - lastPushRef.current > 500) {
      pushHistory("Edit Properties");
      lastPushRef.current = now;
    }
  };

  const updateWithHistory = (updates: Partial<Layer>) => {
    pushHistoryDebounced();
    if (isMultiple) {
      activeLayerIds.forEach((id) => updateLayer(id, updates));
    } else if (activeLayer) {
      updateLayer(activeLayer.id, updates);
    }
  };

  if (!(activeLayer || isMultiple)) {
    return (
      <div className="flex h-full w-full items-center justify-center border-border border-l bg-background p-4">
        <p className="text-center text-muted-foreground text-sm">
          Select a layer to edit properties
        </p>
      </div>
    );
  }

  const handleRefreshFonts = async () => {
    toast.message("Refreshing fonts...");
    try {
      const fonts = await getSystemFonts();
      console.log("Loaded fonts:", fonts);
      setFontFamilies(fonts);
      toast.success(`Found ${fonts.length} fonts. Check console for list.`);
    } catch (e) {
      toast.error("Failed to load fonts");
    }
  };

  return (
    <div className="h-full w-full shrink-0 overflow-y-auto border-border border-l bg-background">
      <div className="border-border border-b px-4 py-3">
        <span className="font-semibold text-muted-foreground text-xs uppercase">
          Properties
        </span>
      </div>
      <div className="space-y-4 p-4">
        {/* Common: Opacity */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-muted-foreground text-xs">Opacity</label>
            <span className="text-muted-foreground text-xs">
              {Math.round((activeLayer ? activeLayer.opacity : 1) * 100)}%
            </span>
          </div>
          <Slider
            max={1}
            min={0}
            onValueChange={(value) => updateWithHistory({ opacity: value[0] })}
            step={0.01}
            value={[activeLayer ? activeLayer.opacity : 1]}
          />
          {isMultiple && (
            <p className="mt-2 text-center text-muted-foreground text-xs">
              {activeLayerIds.length} items selected
            </p>
          )}
        </div>

        {/* Text-specific properties */}
        {activeLayer?.type === "text" && (
          <>
            <TextProperties
              fontFamilies={fontFamilies}
              layer={activeLayer as TextLayer}
              onRefreshFonts={handleRefreshFonts}
              onUpdate={updateWithHistory}
            />
            <ShadowProperties
              layer={activeLayer as TextLayer}
              onUpdate={updateWithHistory}
            />
          </>
        )}

        {/* Shape-specific properties */}
        {activeLayer?.type === "shape" && (
          <ShapeProperties
            layer={activeLayer as ShapeLayer}
            onUpdate={updateWithHistory}
          />
        )}

        {/* Image-specific */}
        {activeLayer?.type === "image" && (
          <>
            <ImageColorProperties
              layer={activeLayer as ImageLayer}
              onUpdate={(updates) =>
                updateWithHistory(updates as Partial<Layer>)
              }
            />
            <div className="border-border border-t" />
            <ImageProperties
              layer={activeLayer as ImageLayer}
              onUpdate={updateWithHistory}
            />
          </>
        )}

        {/* SVG-specific */}
        {activeLayer?.type === "svg" && (
          <SvgProperties
            layer={activeLayer as SvgLayer}
            onUpdate={(updates) => updateWithHistory(updates as Partial<Layer>)}
          />
        )}

        {/* Draw-specific */}
        {activeLayer?.type === "draw" && (
          <AdjustmentProperties
            adjustments={
              (activeLayer as DrawLayer).adjustments ?? {
                ...DEFAULT_ADJUSTMENTS,
              }
            }
            onUpdate={(adjustments) => updateWithHistory({ adjustments })}
          />
        )}

        {/* Animated image-specific */}
        {activeLayer?.type === "animated-image" && (
          <AdjustmentProperties
            adjustments={
              (activeLayer as AnimatedImageLayer).adjustments ?? {
                ...DEFAULT_ADJUSTMENTS,
              }
            }
            onUpdate={(adjustments) => updateWithHistory({ adjustments })}
          />
        )}
      </div>
    </div>
  );
}
