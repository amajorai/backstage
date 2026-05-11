import { Layers, Square } from "lucide-react";
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
import { useEditorStore } from "@/stores/use-editor-store";

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground text-xs">{label}</span>
      <Slider
        className="w-24"
        max={max}
        min={min}
        onValueChange={([v]) => onChange(v)}
        step={step}
        value={[value]}
      />
      <span className="w-8 shrink-0 text-right text-xs tabular-nums">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function SelectOptions() {
  const {
    selectActiveLayerOnly,
    setSelectActiveLayerOnly,
    activeLayerIds,
    layers,
  } = useEditorStore();

  const activeLayer = layers.find((l) => activeLayerIds.includes(l.id));

  return (
    <div className="flex items-center gap-3">
      <button
        className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors ${
          selectActiveLayerOnly
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        onClick={() => setSelectActiveLayerOnly(!selectActiveLayerOnly)}
        type="button"
      >
        <Layers className="size-3" />
        Active Layer Only
      </button>
      {activeLayer && (
        <>
          <Divider />
          <span className="flex items-center gap-1 text-muted-foreground text-xs">
            <Square className="size-3" />
            {activeLayer.name}
          </span>
        </>
      )}
    </div>
  );
}

function BrushOptions() {
  const {
    brushColor,
    brushSize,
    brushOpacity,
    setBrushColor,
    setBrushSize,
    setBrushOpacity,
  } = useEditorStore();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-muted-foreground text-xs">Color</span>
        <ColorPicker onValueChange={setBrushColor} value={brushColor}>
          <ColorPickerTrigger className="h-6 w-6 rounded border border-border p-0">
            <div
              className="size-full rounded"
              style={{ backgroundColor: brushColor }}
            />
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
      <Divider />
      <SliderField
        format={(v) => `${v}px`}
        label="Size"
        max={200}
        min={1}
        onChange={setBrushSize}
        value={brushSize}
      />
      <Divider />
      <SliderField
        format={(v) => `${v}%`}
        label="Opacity"
        max={100}
        min={1}
        onChange={(v) => setBrushOpacity(v / 100)}
        value={Math.round(brushOpacity * 100)}
      />
    </div>
  );
}

function EraserOptions() {
  const { brushSize, brushOpacity, setBrushSize, setBrushOpacity } =
    useEditorStore();

  return (
    <div className="flex items-center gap-3">
      <SliderField
        format={(v) => `${v}px`}
        label="Size"
        max={200}
        min={1}
        onChange={setBrushSize}
        value={brushSize}
      />
      <Divider />
      <SliderField
        format={(v) => `${v}%`}
        label="Opacity"
        max={100}
        min={1}
        onChange={(v) => setBrushOpacity(v / 100)}
        value={Math.round(brushOpacity * 100)}
      />
    </div>
  );
}

function MagicSelectOptions() {
  const { magicSelectTolerance, setMagicSelectTolerance } = useEditorStore();

  return (
    <div className="flex items-center gap-3">
      <SliderField
        label="Tolerance"
        max={255}
        min={0}
        onChange={setMagicSelectTolerance}
        value={magicSelectTolerance}
      />
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  select: "Select",
  brush: "Brush",
  eraser: "Eraser",
  crop: "Crop",
  eyedropper: "Eyedropper",
  "magic-select": "Magic Select",
  text: "Text",
  rect: "Rectangle",
  ellipse: "Ellipse",
};

export function ToolOptionsBar() {
  const { activeTool } = useEditorStore();

  const renderOptions = () => {
    switch (activeTool) {
      case "select":
        return <SelectOptions />;
      case "brush":
        return <BrushOptions />;
      case "eraser":
        return <EraserOptions />;
      case "magic-select":
        return <MagicSelectOptions />;
      default:
        return null;
    }
  };

  const options = renderOptions();

  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-muted-foreground text-xs">
        {TOOL_LABELS[activeTool] ?? activeTool}
      </span>
      {options && (
        <>
          <Divider />
          {options}
        </>
      )}
    </div>
  );
}
