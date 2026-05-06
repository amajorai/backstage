import {
  Bot,
  Building2,
  Circle,
  Eraser,
  ImageDown,
  ImagePlus,
  MousePointer,
  Paintbrush,
  RectangleHorizontal,
  Redo2,
  Smile,
  Sparkles,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  onAddImage: () => void;
  onAiGenerate: () => void;
  onSaveLayerAsImage: () => void;
  onGenerateCarousel: () => void;
  onAddIcon: (dataUrl: string) => void;
}

export function EditorToolbar({
  isProcessing,
  onRemoveBackground,
  onAddImage,
  onAiGenerate,
  onSaveLayerAsImage,
  onGenerateCarousel,
  onAddIcon,
}: EditorToolbarProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
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

  const handleAddShape = (shapeType: "rect" | "ellipse") => {
    addShapeLayer(shapeType);
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
        <TooltipTrigger
          aria-label="Add Rectangle"
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => handleAddShape("rect")}
        >
          <RectangleHorizontal className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Add Rectangle (R)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          aria-label="Add Ellipse"
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => handleAddShape("ellipse")}
        >
          <Circle className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Add Ellipse (O)</TooltipContent>
      </Tooltip>

      {/* Brush tool */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Popover>
              <PopoverTrigger
                aria-label="Brush Tool"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: isBrushActive ? "secondary" : "ghost",
                })}
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
                    <input
                      className="h-8 w-full cursor-pointer rounded border border-border bg-transparent"
                      onChange={(e) => setBrushColor(e.target.value)}
                      type="color"
                      value={brushColor}
                    />
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
        <TooltipContent side="right">Brush (B)</TooltipContent>
      </Tooltip>

      {/* Eraser tool */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Popover>
              <PopoverTrigger
                aria-label="Eraser Tool"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: isEraserActive ? "secondary" : "ghost",
                })}
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
        <TooltipContent side="right">Eraser (E)</TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-8 bg-border" />

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={onAddImage}
        >
          <ImagePlus className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Add Image (I)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => setShowIconPicker(true)}
        >
          <Smile className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Icon Picker</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          onClick={() => setShowLogoPicker(true)}
        >
          <Building2 className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="right">Logo Picker</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              className="disabled:opacity-100"
              disabled={!activeLayer || activeLayer.type !== "image"}
              onClick={onSaveLayerAsImage}
              size="icon-sm"
              variant="ghost"
            >
              <ImageDown className="size-4" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">
          Save Layer as Image{" "}
          {(!activeLayer || activeLayer.type !== "image") && "(Select Image)"}
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
        <TooltipContent side="right">Generate Carousel</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              className="disabled:opacity-100"
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
          Remove Background{" "}
          {(!activeLayer || activeLayer.type !== "image") && "(Select Image)"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              className="disabled:opacity-100"
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
          Generate Image{" "}
          {(!activeLayer || activeLayer.type !== "image") && "(Select Image)"}
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
        onOpenChange={setShowIconPicker}
        onSelect={onAddIcon}
        open={showIconPicker}
      />
      <LogoPicker onOpenChange={setShowLogoPicker} open={showLogoPicker} />
    </div>
  );
}
