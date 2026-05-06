import {
  type ChatSession,
  type FunctionDeclaration,
  type GenerateContentResult,
  GoogleGenerativeAI,
  type Part,
  type Tool,
} from "@google/generative-ai";
import { getEmojiExamplesForPrompt, searchIcons } from "./icon-resolver";

const GEMINI_JSON_REGEX = /```json\n([\s\S]*?)\n```/;
const GEMINI_CODE_BLOCK_REGEX = /```\n([\s\S]*?)\n```/;

// Legacy simple slide format
export interface CarouselSlide {
  title: string;
  content: string;
  backgroundColor?: string;
  textColor?: string;
}

// New Konva-compatible layer specification
export interface KonvaLayerSpec {
  type: "text" | "shape" | "icon" | "emoji";
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  // Text properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: "normal" | "bold" | "italic" | "bold italic";
  fill?: string;
  textAlign?: "left" | "center" | "right";
  // Shape properties
  shapeType?: "rect" | "ellipse";
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  // Icon/Emoji properties
  iconKeyword?: string;
  iconLibrary?: "lucide" | "huge"; // Added library support
  emojiKeyword?: string;
  iconColor?: string;
  iconSize?: number;
}

export interface CarouselSlideKonva {
  layers: KonvaLayerSpec[];
}

export interface CarouselGeneratorConfig {
  topic: string;
  count: number;
  mode: "full" | "template";
  tones: string[];
  colorScheme: string;
  contentStyles: string[];
  customInstructions?: string;
}

export interface CanvasContext {
  width: number;
  height: number;
  layers: Array<{
    name: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }>;
}

// Tool Definitions (Unified approach)
const searchIconsTool: FunctionDeclaration = {
  name: "search_icons",
  description:
    "Search for available icons (Lucide and HugeIcons) by name, keyword, or description.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: {
        type: "STRING",
        description: "Search query (e.g., 'rocket', 'arrow', 'user')",
      },
    },
    required: ["query"],
  },
};

const tools: Tool[] = [
  {
    functionDeclarations: [searchIconsTool],
  },
];

interface ToolArgs {
  query: string;
}

// Execute tools locally
function executeToolCall(
  name: string,
  args: ToolArgs
): Record<string, unknown> {
  if (name === "search_icons") {
    const results = searchIcons(args.query);
    return {
      results: results.map((r) => ({ name: r.name, library: r.library })),
    };
  }
  return { error: "Unknown tool" };
}

async function handleToolCalls(
  chat: ChatSession,
  response: GenerateContentResult
): Promise<GenerateContentResult> {
  let currentResponse = response;
  for (let i = 0; i < 5; i++) {
    const functionCalls = currentResponse.response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const parts: Part[] = [];
      for (const call of functionCalls) {
        const result = executeToolCall(call.name, call.args as ToolArgs);
        parts.push({
          functionResponse: {
            name: call.name,
            response: result,
          },
        });
      }
      currentResponse = await chat.sendMessage(parts);
    } else {
      return currentResponse;
    }
  }
  return currentResponse;
}

function extractJson(text: string): string {
  const jsonMatch = text.match(GEMINI_JSON_REGEX) ||
    text.match(GEMINI_CODE_BLOCK_REGEX) || [null, text];
  return jsonMatch[1] || text;
}

// Full Theme Mode with Tool Use
export async function generateCarouselKonvaFull(
  apiKey: string,
  config: CarouselGeneratorConfig,
  canvasWidth: number,
  canvasHeight: number
): Promise<CarouselSlideKonva[]> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = "gemini-flash-latest";

  const toneString =
    config.tones.length > 0 ? config.tones.join(", ") : "Professional";
  const contentStyleString =
    config.contentStyles.length > 0
      ? config.contentStyles.join(", ")
      : "Educational";
  const colorScheme =
    config.colorScheme === "auto"
      ? "choose appropriate colors"
      : config.colorScheme;

  const emojiExamples = getEmojiExamplesForPrompt();

  const systemInstruction = `You are a social media design expert. Generate a ${config.count}-slide carousel about "${config.topic}".

CRITICAL: Search for icons using 'search_icons("keyword")'. It covers Lucide and HugeIcons.
Do not guess icon names. Use the library field returned by the tool (it will be "lucide" or "huge").
    
DESIGN REQUIREMENTS:
- Canvas size: ${canvasWidth}x${canvasHeight} pixels
- Tone: ${toneString}
- Styling: ${contentStyleString}
- Colors: ${colorScheme}
${config.customInstructions ? `- Instructions: ${config.customInstructions}` : ""}

OUTPUT FORMAT:
Return a JSON array where each object represents a slide with a "layers" array.
Each layer object must have:
- type: "text" | "shape" | "icon" | "emoji"
- name: descriptive string
- x, y, width, height: numbers
- (for text) text, fontSize, fontFamily, fill, textAlign
- (for shapes) shapeType, fill, stroke, cornerRadius
- (for icons) iconKeyword (name from tool), iconLibrary ("lucide" or "huge" from tool), iconColor, iconSize
- (for emojis) emojiKeyword (from Fluent Emojis: ${emojiExamples})

LAYOUT GUIDELINES:
1. Always start with a background shape layer matching canvas size.
2. Use decent padding (40px+).
3. Ensure high contrast for text.
4. Use 1-2 relevant icons/emojis per slide.
5. Create a cohesive story across slides.
`;

  const chat = ai
    .getGenerativeModel({
      model,
      tools,
      systemInstruction,
    })
    .startChat();

  try {
    // Initial Trigger
    console.log("Sending initial prompt to Gemini...");
    let response = await chat.sendMessage(
      `Generate the ${config.count} slides JSON. Search for icons as needed.`
    );

    // Handle Function Calls (Multi-turn)
    response = await handleToolCalls(chat, response);

    const finalJsonString: string | null = response.response.text();

    if (!finalJsonString) {
      throw new Error("No JSON generated after tool inputs");
    }

    const jsonStr = extractJson(finalJsonString);
    const slides = JSON.parse(jsonStr);

    if (!Array.isArray(slides)) {
      throw new Error("Gemini response is not an array");
    }
    return slides as CarouselSlideKonva[];
  } catch (error) {
    console.error("Gemini Full Mode Error:", error);
    throw error;
  }
}

// Template Mode (Simplified - Tool use optional but available)
export async function generateCarouselKonvaTemplate(
  apiKey: string,
  config: CarouselGeneratorConfig,
  canvasContext: CanvasContext,
  pageCount: number
): Promise<CarouselSlideKonva[]> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = "gemini-flash-latest";

  const existingLayersDescription = canvasContext.layers
    .map((l) => `- ${l.name} (${l.type}): pos (${l.x},${l.y})`)
    .join("\n");

  const systemInstruction = `You are a social media editor. Update content for a ${pageCount}-slide carousel obeying the EXISTING TEMPLATE layout.

TEMPLATE LAYERS:
${existingLayersDescription}

TOPIC: "${config.topic}"
TONE: ${config.tones.join(", ")}
STYLE: ${config.contentStyles.join(", ")}
${config.customInstructions ? `INSTRUCTIONS: ${config.customInstructions}` : ""}

TASK:
1. Update text layers with new content about the topic.
2. If there are generic icon layers (e.g. "Icon"), use the 'search_icons' tool to find a relevant replacement icon name.
3. Keep positions unchanged.

OUTPUT:
JSON array of slides. Each slide contains a "layers" array with updates:
- name: exact match from template
- text: new string
- iconKeyword: new icon name
- iconLibrary: "lucide" or "huge"
- fill: new color (optional)
`;

  const chat = ai
    .getGenerativeModel({
      model,
      tools,
      systemInstruction,
    })
    .startChat();

  try {
    let response = await chat.sendMessage("Generate the updates JSON.");

    response = await handleToolCalls(chat, response);

    const text = response.response.text();
    if (!text) {
      throw new Error("No text generated");
    }

    const jsonStr = extractJson(text);
    return JSON.parse(jsonStr) as CarouselSlideKonva[];
  } catch (error) {
    console.error("Gemini Template Mode Error:", error);
    throw error;
  }
}

// Backwards compatibility wrapper
export function generateCarouselContent(
  _apiKey: string,
  _topic: string,
  _count: number,
  _style: string
): Promise<CarouselSlide[]> {
  console.warn("Using legacy generateCarouselContent");
  return Promise.resolve([]);
}
