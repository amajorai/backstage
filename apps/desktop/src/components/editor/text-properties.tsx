import { Button } from "@repo/ui/button";
import { Command, CommandInput, CommandList } from "@repo/ui/command";
import { Input } from "@repo/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Slider } from "@repo/ui/slider";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronsUpDown,
  Italic,
  RefreshCw,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
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
import { cn } from "@/lib/utils";
import type { Layer, TextLayer } from "@/stores/use-editor-store";

interface TextPropertiesProps {
  layer: TextLayer;
  fontFamilies: string[];
  onUpdate: (updates: Partial<Layer>) => void;
  onRefreshFonts: () => void;
}

export function TextProperties({
  layer,
  fontFamilies,
  onUpdate,
  onRefreshFonts,
}: TextPropertiesProps) {
  const [openFont, setOpenFont] = useState(false);
  const [searchFont, setSearchFont] = useState("");

  const filteredFonts = useMemo(() => {
    if (!searchFont) return fontFamilies;
    const lower = searchFont.toLowerCase();
    return fontFamilies.filter((f) => f.toLowerCase().includes(lower));
  }, [fontFamilies, searchFont]);

  const toggleBold = () => {
    const current = layer.fontStyle;
    const isBold = current.includes("bold");
    const isItalic = current.includes("italic");
    let newStyle: TextLayer["fontStyle"] = "normal";
    if (!isBold && isItalic) newStyle = "bold italic";
    else if (!isBold) newStyle = "bold";
    else if (isItalic) newStyle = "italic";
    onUpdate({ fontStyle: newStyle });
  };

  const toggleItalic = () => {
    const current = layer.fontStyle;
    const isBold = current.includes("bold");
    const isItalic = current.includes("italic");
    let newStyle: TextLayer["fontStyle"] = "normal";
    if (isBold && !isItalic) newStyle = "bold italic";
    else if (!isItalic) newStyle = "italic";
    else if (isBold) newStyle = "bold";
    onUpdate({ fontStyle: newStyle });
  };

  const toggleDecoration = (val: "underline" | "line-through") => {
    const current = layer.textDecoration ?? "";
    const hasUnderline = current.includes("underline");
    const hasStrike = current.includes("line-through");
    if (val === "underline") {
      const next = hasUnderline
        ? hasStrike
          ? "line-through"
          : ""
        : hasStrike
          ? "underline line-through"
          : "underline";
      onUpdate({ textDecoration: next as TextLayer["textDecoration"] });
    } else {
      const next = hasStrike
        ? hasUnderline
          ? "underline"
          : ""
        : hasUnderline
          ? "underline line-through"
          : "line-through";
      onUpdate({ textDecoration: next as TextLayer["textDecoration"] });
    }
  };

  const cases: { value: TextLayer["textTransform"]; label: string }[] = [
    { value: "none", label: "Aa" },
    { value: "uppercase", label: "AA" },
    { value: "lowercase", label: "aa" },
    { value: "capitalize", label: "A_" },
  ];

  const aligns: {
    value: "left" | "center" | "right";
    icon: React.ReactNode;
  }[] = [
    { value: "left", icon: <AlignLeft className="size-3.5" /> },
    { value: "center", icon: <AlignCenter className="size-3.5" /> },
    { value: "right", icon: <AlignRight className="size-3.5" /> },
  ];

  const currentDecoration = layer.textDecoration ?? "";
  const currentTransform = layer.textTransform ?? "none";
  const currentAlign = layer.align ?? "left";

  return (
    <>
      {/* Text content */}
      <div>
        <label className="mb-1 block text-muted-foreground text-xs">Text</label>
        <Input
          className="h-8"
          onChange={(e) => onUpdate({ text: e.target.value })}
          value={layer.text}
        />
      </div>

      {/* Font family */}
      <div>
        <div className="flex items-center justify-between">
          <label className="mb-1 block text-muted-foreground text-xs">
            Font Family
          </label>
          <button
            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onRefreshFonts}
            title="Refresh fonts"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
        <Popover onOpenChange={setOpenFont} open={openFont}>
          <PopoverTrigger asChild>
            <Button
              aria-expanded={openFont}
              className="w-full justify-between px-2 text-left font-normal"
              role="combobox"
              variant="outline"
            >
              <span className="truncate">
                {layer.fontFamily || "Select font..."}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0">
            <Command shouldFilter={false}>
              <CommandInput
                onValueChange={setSearchFont}
                placeholder="Search font..."
                value={searchFont}
              />
              <CommandList>
                {filteredFonts.length === 0 ? (
                  <div className="p-2">
                    <p className="text-muted-foreground text-sm">
                      Font not found.
                    </p>
                    {searchFont && (
                      <button
                        className="mt-1 w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          onUpdate({ fontFamily: searchFont });
                          setOpenFont(false);
                        }}
                        type="button"
                      >
                        Use &quot;{searchFont}&quot;
                      </button>
                    )}
                  </div>
                ) : (
                  <Virtuoso
                    itemContent={(index) => {
                      const font = filteredFonts[index];
                      return (
                        <div
                          aria-selected={layer.fontFamily === font}
                          className={cn(
                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                            layer.fontFamily === font &&
                              "bg-accent text-accent-foreground"
                          )}
                          onClick={() => {
                            onUpdate({ fontFamily: font });
                            setOpenFont(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              onUpdate({ fontFamily: font });
                              setOpenFont(false);
                            }
                          }}
                          role="option"
                          tabIndex={0}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4 shrink-0",
                              layer.fontFamily === font
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="truncate">{font}</span>
                        </div>
                      );
                    }}
                    style={{ height: "300px" }}
                    totalCount={filteredFonts.length}
                  />
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Size + style toggles */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-muted-foreground text-xs">
            Size
          </label>
          <Input
            className="h-8"
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            type="number"
            value={layer.fontSize}
          />
        </div>
        <div className="flex gap-1 pt-5">
          <Button
            className="h-8 w-8 p-0"
            onClick={toggleBold}
            variant={layer.fontStyle.includes("bold") ? "secondary" : "ghost"}
          >
            <Bold className="size-4" />
          </Button>
          <Button
            className="h-8 w-8 p-0"
            onClick={toggleItalic}
            variant={layer.fontStyle.includes("italic") ? "secondary" : "ghost"}
          >
            <Italic className="size-4" />
          </Button>
          <Button
            className="h-8 w-8 p-0"
            onClick={() => toggleDecoration("underline")}
            variant={
              currentDecoration.includes("underline") ? "secondary" : "ghost"
            }
          >
            <Underline className="size-4" />
          </Button>
          <Button
            className="h-8 w-8 p-0"
            onClick={() => toggleDecoration("line-through")}
            variant={
              currentDecoration.includes("line-through") ? "secondary" : "ghost"
            }
          >
            <Strikethrough className="size-4" />
          </Button>
        </div>
      </div>

      {/* Alignment + Case */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-muted-foreground text-xs">
            Align
          </label>
          <div className="flex gap-1">
            {aligns.map(({ value, icon }) => (
              <Button
                className="h-8 flex-1 p-0"
                key={value}
                onClick={() => onUpdate({ align: value })}
                variant={currentAlign === value ? "secondary" : "ghost"}
              >
                {icon}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-muted-foreground text-xs">
            Case
          </label>
          <div className="flex gap-1">
            {cases.map(({ value, label }) => (
              <Button
                className="h-8 flex-1 p-0 text-xs"
                key={value}
                onClick={() => onUpdate({ textTransform: value })}
                variant={currentTransform === value ? "secondary" : "ghost"}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Color + Stroke */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-muted-foreground text-xs">
            Color
          </label>
          <ColorPicker
            onValueChange={(fill) => onUpdate({ fill })}
            value={layer.fill}
          >
            <ColorPickerTrigger
              className="w-full justify-start gap-2 px-2 text-left font-normal"
              variant="outline"
            >
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
            Border
          </label>
          <ColorPicker
            onValueChange={(stroke) => onUpdate({ stroke })}
            value={layer.stroke || "#00000000"}
          >
            <ColorPickerTrigger
              className="w-full justify-start gap-2 px-2 text-left font-normal"
              variant="outline"
            >
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

      {/* Border width */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-muted-foreground text-xs">Border Width</label>
          <span className="text-muted-foreground text-xs">
            {layer.strokeWidth}px
          </span>
        </div>
        <Slider
          max={20}
          min={0}
          onValueChange={(value) => onUpdate({ strokeWidth: value[0] })}
          step={1}
          value={[layer.strokeWidth || 0]}
        />
      </div>

      {/* Letter spacing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-muted-foreground text-xs">
            Letter Spacing
          </label>
          <span className="text-muted-foreground text-xs">
            {layer.letterSpacing ?? 0}px
          </span>
        </div>
        <Slider
          max={50}
          min={-10}
          onValueChange={(value) => onUpdate({ letterSpacing: value[0] })}
          step={0.5}
          value={[layer.letterSpacing ?? 0]}
        />
      </div>

      {/* Line spacing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-muted-foreground text-xs">Line Spacing</label>
          <span className="text-muted-foreground text-xs">
            {layer.lineHeight ?? 1}×
          </span>
        </div>
        <Slider
          max={4}
          min={0.5}
          onValueChange={(value) => onUpdate({ lineHeight: value[0] })}
          step={0.05}
          value={[layer.lineHeight ?? 1]}
        />
      </div>

      {/* Background */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-muted-foreground text-xs">Background</label>
          {layer.backgroundColor ? (
            <button
              className="text-muted-foreground text-xs hover:text-foreground"
              onClick={() => onUpdate({ backgroundColor: "" })}
              type="button"
            >
              Remove
            </button>
          ) : (
            <button
              className="text-muted-foreground text-xs hover:text-foreground"
              onClick={() => onUpdate({ backgroundColor: "#ffffff" })}
              type="button"
            >
              + Add
            </button>
          )}
        </div>
        {layer.backgroundColor && (
          <>
            <div className="flex gap-2">
              <div className="flex-1">
                <ColorPicker
                  onValueChange={(backgroundColor) =>
                    onUpdate({ backgroundColor })
                  }
                  value={layer.backgroundColor}
                >
                  <ColorPickerTrigger
                    className="w-full justify-start gap-2 px-2 text-left font-normal"
                    variant="outline"
                  >
                    <div
                      className="size-4 rounded border border-border"
                      style={{ backgroundColor: layer.backgroundColor }}
                    />
                    <span className="truncate">{layer.backgroundColor}</span>
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
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-muted-foreground text-xs">
                    Padding
                  </label>
                  <span className="text-muted-foreground text-xs">
                    {layer.backgroundPadding ?? 4}px
                  </span>
                </div>
                <Slider
                  max={40}
                  min={0}
                  onValueChange={(value) =>
                    onUpdate({ backgroundPadding: value[0] })
                  }
                  step={1}
                  value={[layer.backgroundPadding ?? 4]}
                />
              </div>
            </div>
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-muted-foreground text-xs">
                  Corner Radius
                </label>
                <span className="text-muted-foreground text-xs">
                  {layer.backgroundCornerRadius ?? 0}px
                </span>
              </div>
              <Slider
                max={40}
                min={0}
                onValueChange={(value) =>
                  onUpdate({ backgroundCornerRadius: value[0] })
                }
                step={1}
                value={[layer.backgroundCornerRadius ?? 0]}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
