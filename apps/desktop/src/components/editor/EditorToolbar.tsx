import { Button, buttonVariants } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
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
  Scissors,
  Shapes,
  Smile,
  Sparkles,
  Type,
  Undo2,
  Wand2,
  Zap,
} from "lucide-react";
import * as sounds from "@/lib/sounds";
import { useEditorStore } from "@/stores/use-editor-store";
import { IconPicker } from "./IconPicker";
import { LogoPicker } from "./LogoPicker";

interface EditorToolbarProps {
  isProcessing: boolean;
  onRemoveBackground: () => void;
  onSmartCrop: () => void;
  onAddColorBackground: () => void;
  onAddImage: () => void;
  onAiGenerate: () => void;
  onQuickAiEdit: () => void;
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
  onSmartCrop,
  onAddColorBackground,
  onAddImage,
  onAiGenerate,
  onQuickAiEdit,
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
  } = useEditorStore();

  const activeLayer = layers.find((l) => activeLayerIds.includes(l.id));
  const canRemoveBg = activeLayer?.type === "image" && !isProcessing;
  const canAiGenerate = !isProcessing;

  const handleAddText = () => {
    sounds.click();
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
    sounds.click();
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
          onClick={() => {
            sounds.click();
            setActiveTool("select");
          }}
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
            <button
              aria-label="Magic Select Tool"
              className={buttonVariants({
                size: "icon-sm",
                variant: isMagicSelectActive ? "secondary" : "ghost",
              })}
              disabled={!canMagicSelect}
              onClick={() => {
                sounds.click();
                setActiveTool("magic-select");
              }}
              type="button"
            >
              <Lasso className="size-4" />
            </button>
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
          onClick={() => {
            sounds.click();
            setActiveTool("eyedropper");
          }}
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
            <button
              aria-label="Brush Tool"
              className={buttonVariants({
                size: "icon-sm",
                variant: isBrushActive ? "secondary" : "ghost",
              })}
              disabled={!canPaintOnLayer}
              onClick={() => {
                sounds.click();
                setActiveTool("brush");
              }}
              type="button"
            >
              <Paintbrush className="size-4" />
            </button>
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
            <button
              aria-label="Eraser Tool"
              className={buttonVariants({
                size: "icon-sm",
                variant: isEraserActive ? "secondary" : "ghost",
              })}
              disabled={!canPaintOnLayer}
              onClick={() => {
                sounds.click();
                setActiveTool("eraser");
              }}
              type="button"
            >
              <Eraser className="size-4" />
            </button>
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
              onClick={() => {
                sounds.click();
                setActiveTool("crop");
              }}
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

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={canCrop ? undefined : "pointer-events-none opacity-40"}
          >
            <Button
              disabled={!canCrop}
              onClick={() => {
                sounds.click();
                onSmartCrop();
              }}
              size="icon-sm"
              variant="ghost"
            >
              <Scissors className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {canCrop
            ? "Smart Crop — trim invisible borders (Q)"
            : "Select an image layer to smart crop (Q)"}
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => {
            sounds.click();
            onAddImage();
          }}
        >
          <ImagePlus className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Add Image</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => {
            sounds.click();
            onShowIconPickerChange(true);
          }}
        >
          <Smile className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Icon Picker (K)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => {
            sounds.click();
            onShowLogoPickerChange(true);
          }}
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
              onClick={() => {
                sounds.download();
                onSaveLayerAsImage();
              }}
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
          onClick={() => {
            sounds.click();
            onGenerateCarousel();
          }}
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
              onClick={() => {
                sounds.click();
                onRemoveBackground();
              }}
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
              onClick={() => {
                sounds.click();
                onAddColorBackground();
              }}
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
              onClick={() => {
                sounds.click();
                onAiGenerate();
              }}
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

      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              canRemoveBg ? undefined : "pointer-events-none opacity-40"
            }
          >
            <Button
              disabled={!canRemoveBg}
              onClick={() => {
                sounds.click();
                onQuickAiEdit();
              }}
              size="icon-sm"
              variant="ghost"
            >
              <Zap className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          {!activeLayer || activeLayer.type !== "image"
            ? "Select an image layer to quick edit (Z)"
            : "Quick AI Edit (Z)"}
        </TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              disabled={!canUndo()}
              onClick={() => {
                sounds.click();
                undo();
              }}
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
              onClick={() => {
                sounds.click();
                redo();
              }}
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
