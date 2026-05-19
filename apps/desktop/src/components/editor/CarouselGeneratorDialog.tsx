import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Label } from "@repo/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Slider } from "@repo/ui/slider";
import { Textarea } from "@repo/ui/textarea";
import { Bot, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
} from "@/components/ui/tags-input";
import type { CanvasContext, CarouselGeneratorConfig } from "@/lib/gemini-text";

const TONE_PRESETS = [
  "Professional",
  "Casual",
  "Playful",
  "Educational",
  "Inspirational",
  "Bold",
  "Minimalist",
];

const COLOR_SCHEMES = [
  { value: "vibrant", label: "Vibrant & Colorful" },
  { value: "pastel", label: "Soft Pastel" },
  { value: "monochrome", label: "Monochrome" },
  { value: "dark", label: "Dark Mode" },
  { value: "warm", label: "Warm Tones" },
  { value: "cool", label: "Cool Tones" },
  { value: "custom", label: "Match Template" },
];

const CONTENT_STYLE_PRESETS = [
  "Icons",
  "Emojis",
  "Minimal Text",
  "Detailed Text",
  "Statistics",
  "Quotes",
];

export interface CarouselGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: CarouselGeneratorConfig) => Promise<void>;
  currentCanvasContext?: CanvasContext;
}

export function CarouselGeneratorDialog({
  open,
  onOpenChange,
  onGenerate,
  currentCanvasContext,
}: CarouselGeneratorDialogProps) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<"full" | "template">("full");
  const [tones, setTones] = useState<string[]>(["Professional"]);
  const [colorScheme, setColorScheme] = useState("vibrant");
  const [contentStyles, setContentStyles] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const availableTonePresets = TONE_PRESETS.filter((t) => !tones.includes(t));
  const availableStylePresets = CONTENT_STYLE_PRESETS.filter(
    (s) => !contentStyles.includes(s)
  );

  const handleAddTonePreset = (preset: string) => {
    if (!tones.includes(preset)) {
      setTones([...tones, preset]);
    }
  };

  const handleAddStylePreset = (preset: string) => {
    if (!contentStyles.includes(preset)) {
      setContentStyles([...contentStyles, preset]);
    }
  };

  const handleColorSchemeChange = (value: string | null) => {
    if (value) {
      setColorScheme(value);
    }
  };

  const handleGenerate = async () => {
    if (!topic) {
      return;
    }
    setIsGenerating(true);
    try {
      await onGenerate({
        topic,
        count,
        mode,
        tones,
        colorScheme,
        contentStyles,
        customInstructions: customInstructions || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            Generate Carousel
          </DialogTitle>
          <DialogDescription>
            Use AI to create a multi-slide carousel on any topic.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Textarea
              id="topic"
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 Tips for Better Productivity, How to cook Pasta..."
              value={topic}
            />
          </div>

          <div className="space-y-2">
            <Label>Number of Slides: {count}</Label>
            <Slider
              max={10}
              min={3}
              onValueChange={(val) => setCount(val[0])}
              step={1}
              value={[count]}
            />
            <div className="flex justify-between px-1 text-muted-foreground text-xs">
              <span>3</span>
              <span>10</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Generation Mode</Label>
            <RadioGroup
              className="flex gap-4"
              onValueChange={(v) => setMode(v as "full" | "template")}
              value={mode}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="mode-full" value="full" />
                <Label className="cursor-pointer" htmlFor="mode-full">
                  Full Theme
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="mode-template" value="template" />
                <Label className="cursor-pointer" htmlFor="mode-template">
                  Template Only
                </Label>
              </div>
            </RadioGroup>
            <p className="text-muted-foreground text-xs">
              {mode === "full"
                ? "AI creates complete design including colors, layout, and content."
                : "AI fills in content using your current template layout."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tone / Vibe</Label>
            <TagsInput
              addOnPaste
              blurBehavior="add"
              onValueChange={setTones}
              value={tones}
            >
              {tones.map((tone) => (
                <TagsInputItem key={tone} value={tone}>
                  <TagsInputItemText>{tone}</TagsInputItemText>
                  <TagsInputItemDelete />
                </TagsInputItem>
              ))}
              <TagsInputInput placeholder="Add custom tone..." />
            </TagsInput>
            {availableTonePresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-muted-foreground text-xs">
                  Suggestions:
                </span>
                {availableTonePresets.map((preset) => (
                  <Badge
                    className="cursor-pointer text-xs"
                    key={preset}
                    onClick={() => handleAddTonePreset(preset)}
                    variant="outline"
                  >
                    + {preset}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {mode === "full" && (
            <div className="space-y-2">
              <Label>Color Scheme</Label>
              <Select
                onValueChange={handleColorSchemeChange}
                value={colorScheme}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_SCHEMES.map((scheme) => (
                    <SelectItem key={scheme.value} value={scheme.value}>
                      {scheme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Content Style (optional)</Label>
            <TagsInput
              addOnPaste
              blurBehavior="add"
              onValueChange={setContentStyles}
              value={contentStyles}
            >
              {contentStyles.map((style) => (
                <TagsInputItem key={style} value={style}>
                  <TagsInputItemText>{style}</TagsInputItemText>
                  <TagsInputItemDelete />
                </TagsInputItem>
              ))}
              <TagsInputInput placeholder="Add custom style..." />
            </TagsInput>
            {availableStylePresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-muted-foreground text-xs">
                  Suggestions:
                </span>
                {availableStylePresets.map((preset) => (
                  <Badge
                    className="cursor-pointer text-xs"
                    key={preset}
                    onClick={() => handleAddStylePreset(preset)}
                    variant="outline"
                  >
                    + {preset}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Collapsible onOpenChange={setAdvancedOpen} open={advancedOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-4 py-2 font-medium text-sm hover:bg-muted">
              Advanced Options
              <ChevronDown
                className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-2">
                <Label htmlFor="custom-instructions">Custom Instructions</Label>
                <Textarea
                  id="custom-instructions"
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. Use blue accent colors, include call-to-action on last slide..."
                  rows={3}
                  value={customInstructions}
                />
              </div>
              {mode === "template" && currentCanvasContext && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium">Template Context</p>
                  <p className="text-muted-foreground text-xs">
                    {currentCanvasContext.layers.length} layers detected. AI
                    will use layer names to understand content placement.
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end pt-2">
            <Button disabled={!topic || isGenerating} onClick={handleGenerate}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
