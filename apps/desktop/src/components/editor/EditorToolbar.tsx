import {
  Bot,
  Building2,
  Crop,
  Eraser,
  ImageDown,
  ImagePlus,
  Lasso,
  MousePointer,
  PaintBucket,
  Paintbrush,
  Pipette,
  Redo2,
  Shapes,
  Smile,
  Sparkles,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore } from "@/stores/use-editor-store";
import { IconPicker } from "./IconPicker";
import { LogoPicker } from "./LogoPicker";

interface EditorToolbarProps {
  isProcessing: boolean;
  onRemoveBackground: () => void;
  onAddColorBackground: () => void;
  onAddImage: () => void;
  onAiGenerate: () => void;
  onSaveLayerAsImage: () => void;
  onGenerateCarousel: () => void;
  onAddIcon: (dataUrl: string) => void;
  showIconPicker: boolean;
  onShowIconPickerChange: (open: boolean) => void;
  showLogoPicker: boolean;
  onShowLogoPickerChange: (open: boolean) => void;
}

export function EditorToolbar({
  isProcessing,
  onRemoveBackground,
  onAddColorBackground,
  onAddImage,
  onAiGenerate,
  onSaveLayerAsImage,
  onGenerateCarousel,
  onAddIcon,
  showIconPicker,
  onShowIconPickerChange,
  showLogoPicker,
  onShowLogoPickerChange,
}: EditorToolbarProps) {
  const {
    activeTool,
    canUndo,
    canRedo,
    activeLayerIds,
    layers,
    canvasWidth,
    canvasHeight,
    setActiveTool,
    addTextLayer,
    addShapeLayer,
    updateLayer,
    undo,
    redo,
    brushSize,
    brushColor,
    brushOpacity,
    setBrushSize,
    setBrushColor,
    setBrushOpacity,
    magicSelectTolerance,
    setMagicSelectTolerance,
  } = useEditorStore();

  const activeLayer = layers.find((l) => activeLayerIds.includes(l.id));
  const canRemoveBg = activeLayer?.type === "image" && !isProcessing;
  const canAiGenerate = activeLayer?.type === "image" && !isProcessing;

  const handleAddText = () => {
    addTextLayer("Your Text");
    const newLayerId = useEditorStore.getState().activeLayerIds[0];
    if (newLayerId) {
      updateLayer(newLayerId, {
        x: canvasWidth / 2 - 100,
        y: canvasHeight / 2 - 24,
      });
    }
    setActiveTool("select");
  };

  const handleAddShape = (
    shapeType: "rect" | "ellipse" | "polygon" | "star",
    options?: { sides?: number; starPoints?: number; innerRadiusRatio?: number }
  ) => {
    addShapeLayer(shapeType, options);
    const newLayerId = useEditorStore.getState().activeLayerIds[0];
    if (newLayerId) {
      updateLayer(newLayerId, {
        x: canvasWidth / 2 - 100,
        y: canvasHeight / 2 - 75,
      });
    }
    setActiveTool("select");
  };

  const isBrushActive = activeTool === "brush";
  const isEraserActive = activeTool === "eraser";
  const isCropActive = activeTool === "crop";
  const isEyeDropperActive = activeTool === "eyedropper";
  const isMagicSelectActive = activeTool === "magic-select";
  const canPaintOnLayer =
    (activeLayer?.type === "image" || activeLayer?.type === "draw") &&
    !isProcessing;
  const canCrop = activeLayer?.type === "image" && !isProcessing;
  const canMagicSelect = activeLayer?.type === "image" && !isProcessing;
  const canSaveLayer = activeLayer?.type === "image";

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-border border-r bg-background py-2">
      <Tooltip>
        <TooltipTrigger
          aria-label="Select Tool"
          className={buttonVariants({
            size: "icon-sm",
            variant: activeTool === "select" ? "secondary" : "ghost",
          })}
          onClick={() => setActiveTool("select")}
        >
          <MousePointer className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Select (V)</TooltipContent>
      </Tooltip>

      {/* Magic Select tool */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canMagicSelect ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Popover>
              <PopoverTrigger
                aria-label="Magic Select Tool"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: isMagicSelectActive ? "secondary" : "ghost",
                })}
                disabled={!canMagicSelect}
                onClick={() => setActiveTool("magic-select")}
              >
                <Lasso className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" side="right">
                <p className="mb-2 font-medium text-sm">Magic Select</p>
                <p className="mb-2 text-muted-foreground text-xs">
                  Click to select · Delete to erase
                </p>
                <div>
                  <label className="mb-1 block text-muted-foreground text-xs">
                    Tolerance: {magicSelectTolerance}
                  </label>
                  <input
                    className="w-full accent-primary"
                    max={255}
                    min={0}
                    onChange={(e) =>
                      setMagicSelectTolerance(Number(e.target.value))
                    }
                    type="range"
                    value={magicSelectTolerance}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {canMagicSelect ? "Magic Select (W)" : "Select an image layer (W)"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          aria-label="Add Text"
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={handleAddText}
        >
          <Type className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Add Text (T)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Add Shape"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: "ghost",
                })}
              >
                <Shapes className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right">
                <DropdownMenuItem onClick={() => handleAddShape("rect")}>
                  Rectangle
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddShape("ellipse")}>
                  Ellipse
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAddShape("polygon", { sides: 3 })}
                >
                  Triangle
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAddShape("polygon", { sides: 4 })}
                >
                  Diamond
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAddShape("polygon", { sides: 5 })}
                >
                  Pentagon
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAddShape("polygon", { sides: 6 })}
                >
                  Hexagon
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAddShape("polygon", { sides: 8 })}
                >
                  Octagon
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddShape("star")}>
                  Star
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">Add Shape</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          aria-label="Eyedropper Tool"
          className={buttonVariants({
            size: "icon-sm",
            variant: isEyeDropperActive ? "secondary" : "ghost",
          })}
          onClick={() => setActiveTool("eyedropper")}
        >
          <Pipette className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Eyedropper (I)</TooltipContent>
      </Tooltip>

      {/* Brush tool */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canPaintOnLayer ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Popover>
              <PopoverTrigger
                aria-label="Brush Tool"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: isBrushActive ? "secondary" : "ghost",
                })}
                disabled={!canPaintOnLayer}
                onClick={() => setActiveTool("brush")}
              >
                <Paintbrush className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" side="right">
                <p className="mb-2 font-medium text-sm">Brush</p>
                <p className="mb-2 text-muted-foreground text-xs">
                  [ ] size · {"{ }"} opacity
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-muted-foreground text-xs">
                      Color
                    </label>
                    <ColorPicker
                      onValueChange={setBrushColor}
                      value={brushColor}
                    >
                      <ColorPickerTrigger className="w-full justify-start gap-2 px-2 font-normal">
                        <div
                          className="size-4 rounded border border-border"
                          style={{ backgroundColor: brushColor }}
                        />
                        <span className="truncate font-mono text-xs">
                          {brushColor}
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
                  <div>
                    <label className="mb-1 block text-muted-foreground text-xs">
                      Size: {brushSize}px
                    </label>
                    <input
                      className="w-full accent-primary"
                      max={200}
                      min={1}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      type="range"
                      value={brushSize}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-muted-foreground text-xs">
                      Opacity: {Math.round(brushOpacity * 100)}%
                    </label>
                    <input
                      className="w-full accent-primary"
                      max={100}
                      min={1}
                      onChange={(e) =>
                        setBrushOpacity(Number(e.target.value) / 100)
                      }
                      type="range"
                      value={Math.round(brushOpacity * 100)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {canPaintOnLayer ? "Brush (B)" : "Select an image layer (B)"}
        </TooltipContent>
      </Tooltip>

      {/* Eraser tool */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canPaintOnLayer ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Popover>
              <PopoverTrigger
                aria-label="Eraser Tool"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: isEraserActive ? "secondary" : "ghost",
                })}
                disabled={!canPaintOnLayer}
                onClick={() => setActiveTool("eraser")}
              >
                <Eraser className="size-4" />
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" side="right">
                <p className="mb-2 font-medium text-sm">Eraser</p>
                <p className="mb-2 text-muted-foreground text-xs">
                  [ ] size · {"{ }"} opacity
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-muted-foreground text-xs">
                      Size: {brushSize}px
                    </label>
                    <input
                      className="w-full accent-primary"
                      max={200}
                      min={1}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      type="range"
                      value={brushSize}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-muted-foreground text-xs">
                      Opacity: {Math.round(brushOpacity * 100)}%
                    </label>
                    <input
                      className="w-full accent-primary"
                      max={100}
                      min={1}
                      onChange={(e) =>
                        setBrushOpacity(Number(e.target.value) / 100)
                      }
                      type="range"
                      value={Math.round(brushOpacity * 100)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {canPaintOnLayer ? "Eraser (E)" : "Select an image layer (E)"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={canCrop ? undefined : "pointer-events-none opacity-40"}
          >
            <Button
              disabled={!canCrop}
              onClick={() => setActiveTool("crop")}
              size="icon-sm"
              variant={isCropActive ? "secondary" : "ghost"}
            >
              <Crop className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {canCrop ? "Crop Image (C)" : "Select an image layer to crop (C)"}
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={onAddImage}
        >
          <ImagePlus className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Add Image</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => onShowIconPickerChange(true)}
        >
          <Smile className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Icon Picker (K)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => onShowLogoPickerChange(true)}
        >
          <Building2 className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Logo Picker (L)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canSaveLayer ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Button
              disabled={!canSaveLayer}
              onClick={onSaveLayerAsImage}
              size="icon-sm"
              variant="ghost"
            >
              <ImageDown className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {canSaveLayer
            ? "Save Layer as Image (Ctrl+Shift+S)"
            : "Select an image layer to save (Ctrl+Shift+S)"}
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={onGenerateCarousel}
        >
          <Bot className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Generate Carousel (G)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canRemoveBg ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Button
              disabled={!canRemoveBg}
              onClick={onRemoveBackground}
              size="icon-sm"
              variant="ghost"
            >
              <Wand2 className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {!activeLayer || activeLayer.type !== "image"
            ? "Select an image layer to remove background (X)"
            : "Remove Background (X)"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canRemoveBg ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Button
              disabled={!canRemoveBg}
              onClick={onAddColorBackground}
              size="icon-sm"
              variant="ghost"
            >
              <PaintBucket className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {!activeLayer || activeLayer.type !== "image"
            ? "Select an image layer to add a color background (P)"
            : "Add Color Background (P)"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canAiGenerate ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Button
              disabled={!canAiGenerate}
              onClick={onAiGenerate}
              size="icon-sm"
              variant="ghost"
            >
              <Sparkles className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {!activeLayer || activeLayer.type !== "image"
            ? "Select an image layer to generate (A)"
            : "Generate Image (A)"}
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              disabled={!canUndo()}
              onClick={undo}
              size="icon-sm"
              variant="ghost"
            >
              <Undo2 className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">Undo (Ctrl+Z)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              disabled={!canRedo()}
              onClick={redo}
              size="icon-sm"
              variant="ghost"
            >
              <Redo2 className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">Redo (Ctrl+Y)</TooltipContent>
      </Tooltip>

      <IconPicker
        onOpenChange={onShowIconPickerChange}
        onSelect={onAddIcon}
        open={showIconPicker}
      />
      <LogoPicker onOpenChange={onShowLogoPickerChange} open={showLogoPicker} />
    </div>
  );
}
