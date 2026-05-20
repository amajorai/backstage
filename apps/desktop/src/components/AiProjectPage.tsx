import { buttonVariants } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  type Node,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Check, GitBranch, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GeminiImagePage } from "@/components/GeminiImagePage";
import type { AiGenerationNode } from "@/lib/ai-project-storage";
import * as sounds from "@/lib/sounds";
import { useAiProjectStore } from "@/stores/use-ai-project-store";

interface GenerationNodeData {
  node: AiGenerationNode;
  images: string[];
  isActive: boolean;
  onClick: () => void;
}

function GenerationNode({ data }: { data: GenerationNodeData }) {
  const { node, images, isActive, onClick } = data;
  const promptDisplay = (node.prompt || node.autoPrompt || "").slice(0, 80);

  return (
    <div
      className={`cursor-pointer rounded-xl border-2 bg-background p-2 shadow-md transition-all hover:shadow-lg ${
        isActive ? "border-primary shadow-primary/20" : "border-border"
      }`}
      onClick={onClick}
      style={{ width: 220 }}
    >
      <Handle position={Position.Top} type="target" />
      <div className="grid grid-cols-2 gap-1">
        {images.slice(0, 4).map((url, i) => (
          <img
            alt={`Generated ${i + 1}`}
            className="aspect-video w-full rounded-md object-cover"
            key={i}
            src={url}
          />
        ))}
        {images.length === 0 &&
          Array.from({ length: Math.min(node.imageCount, 4) }).map((_, i) => (
            <div
              className="aspect-video w-full animate-pulse rounded-md bg-muted"
              key={i}
            />
          ))}
      </div>
      {promptDisplay && (
        <p className="mt-1.5 line-clamp-2 text-[10px] text-muted-foreground">
          {promptDisplay}
        </p>
      )}
      <p className="mt-1 text-[9px] text-muted-foreground/60">
        {new Date(node.timestamp).toLocaleTimeString()}
      </p>
      {isActive && (
        <div className="mt-1 flex items-center gap-1 text-[9px] text-primary">
          <GitBranch className="size-2.5" />
          <span>Active branch</span>
        </div>
      )}
      <Handle position={Position.Bottom} type="source" />
    </div>
  );
}

const nodeTypes = { generation: GenerationNode };

interface AiProjectPageProps {
  projectId: string;
  onClose: () => void;
  onSettings: () => void;
}

export function AiProjectPage({
  projectId,
  onClose,
  onSettings,
}: AiProjectPageProps) {
  const {
    openProject,
    openGraph,
    addGeneration,
    setActiveNode,
    renameProject,
    projects,
  } = useAiProjectStore();

  const project = projects.find((p) => p.id === projectId);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [nodeImages, setNodeImages] = useState<Map<string, string[]>>(
    new Map()
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const loadNodeImages = useAiProjectStore((s) => s.loadNodeImages);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    openProject(projectId);
  }, [projectId, openProject]);

  // Load images for all nodes
  useEffect(() => {
    if (!openGraph) return;
    for (const node of openGraph.nodes) {
      if (!nodeImages.has(node.id)) {
        loadNodeImages(node.id).then((imgs) => {
          setNodeImages((prev) => new Map(prev).set(node.id, imgs));
        });
      }
    }
  }, [openGraph, nodeImages, loadNodeImages]);

  // Sync React Flow nodes/edges from graph
  useEffect(() => {
    if (!openGraph) return;
    const activeId = openGraph.activeNodeId;

    const flowNodes: Node[] = openGraph.nodes.map((n) => ({
      id: n.id,
      type: "generation",
      position: n.position,
      data: {
        node: n,
        images: nodeImages.get(n.id) ?? [],
        isActive: n.id === activeId,
        onClick: () => {
          sounds.click();
          setActiveNode(n.id === activeId ? null : n.id);
        },
      },
    }));

    const flowEdges: Edge[] = openGraph.nodes
      .filter((n) => n.parentId)
      .map((n) => ({
        id: `${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: "smoothstep",
        animated: n.id === activeId,
      }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [openGraph, nodeImages, setNodes, setEdges, setActiveNode]);

  const handleGenerationComplete = useCallback(
    async (args: {
      images: string[];
      prompt: string;
      autoPrompt: string;
      model: string;
    }) => {
      await addGeneration({
        ...args,
        parentNodeId: openGraph?.activeNodeId ?? null,
      });
    },
    [addGeneration, openGraph]
  );

  const startRename = () => {
    setRenameValue(project?.name ?? "");
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project?.name) {
      await renameProject(projectId, trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => setIsRenaming(false);

  const isEmpty = !openGraph || openGraph.nodes.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-border border-b px-3">
        <button
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          onClick={() => {
            sounds.click();
            onClose();
          }}
          type="button"
        >
          <ArrowLeft className="size-4" />
        </button>

        {isRenaming ? (
          <div className="flex flex-1 items-center gap-1">
            <Input
              className="h-7 max-w-56 text-sm"
              onBlur={commitRename}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") cancelRename();
              }}
              ref={renameInputRef}
              value={renameValue}
            />
            <button
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              onClick={commitRename}
              type="button"
            >
              <Check className="size-3.5" />
            </button>
            <button
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              onClick={cancelRename}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            className="group flex items-center gap-1.5 font-medium text-sm hover:text-foreground/80"
            onClick={startRename}
            type="button"
          >
            {project?.name ?? "AI Session"}
            <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
        )}

        <div className="flex-1" />

        {openGraph && openGraph.activeNodeId && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
            <GitBranch className="size-3" />
            Branching from selected node
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* React Flow canvas */}
        <div className="relative min-h-0 flex-1 border-border border-r">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <GitBranch className="size-10 opacity-30" />
              <p className="text-sm">
                Generate your first image to start the session tree.
              </p>
            </div>
          ) : (
            <ReactFlow
              edges={edges}
              fitView
              nodes={nodes}
              nodeTypes={nodeTypes}
              onEdgesChange={onEdgesChange}
              onNodesChange={onNodesChange}
            >
              <Background
                color="hsl(var(--muted-foreground) / 0.15)"
                variant={BackgroundVariant.Dots}
              />
              <Controls />
            </ReactFlow>
          )}
        </div>

        {/* Generation panel */}
        <div className="flex h-full w-[400px] shrink-0 flex-col overflow-hidden">
          <GeminiImagePage
            canvasHeight={720}
            canvasWidth={1280}
            editorLayers={null}
            fullPage={false}
            onClose={onClose}
            onGenerationComplete={handleGenerationComplete}
            onSaveAsImage={() => {}}
            onSettings={onSettings}
          />
        </div>
      </div>
    </div>
  );
}
