import { create } from "zustand";
import {
  type AiGenerationNode,
  type AiProjectGraph,
  type AiProjectRecord,
  computeTreeLayout,
  createAiProject,
  deleteAiProject,
  listAiProjects,
  loadNodeImages,
  loadProjectGraph,
  renameAiProject,
  saveNodeImage,
  saveProjectGraph,
} from "@/lib/ai-project-storage";

interface AiProjectStore {
  projects: AiProjectRecord[];
  isLoaded: boolean;
  openProjectId: string | null;
  openGraph: AiProjectGraph | null;

  load: () => Promise<void>;
  createProject: (name?: string) => Promise<string>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;
  renameProject: (id: string, name: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;

  addGeneration: (args: {
    images: string[];
    prompt: string;
    autoPrompt: string;
    model: string;
    parentNodeId: string | null;
  }) => Promise<string>;

  setActiveNode: (nodeId: string | null) => Promise<void>;
  loadNodeImages: (nodeId: string) => Promise<string[]>;
}

export const useAiProjectStore = create<AiProjectStore>((set, get) => ({
  projects: [],
  isLoaded: false,
  openProjectId: null,
  openGraph: null,

  load: async () => {
    const projects = await listAiProjects();
    set({ projects, isLoaded: true });
  },

  createProject: async (name = "Untitled AI Session") => {
    const id = crypto.randomUUID();
    await createAiProject(id, name);
    const projects = await listAiProjects();
    set({ projects });
    return id;
  },

  openProject: async (id) => {
    const graph = await loadProjectGraph(id);
    set({ openProjectId: id, openGraph: graph });
  },

  closeProject: () => {
    set({ openProjectId: null, openGraph: null });
  },

  renameProject: async (id, name) => {
    await renameAiProject(id, name);
    const projects = await listAiProjects();
    set({ projects });
  },

  removeProject: async (id) => {
    await deleteAiProject(id);
    const projects = await listAiProjects();
    const { openProjectId } = get();
    if (openProjectId === id) {
      set({ projects, openProjectId: null, openGraph: null });
    } else {
      set({ projects });
    }
  },

  addGeneration: async ({
    images,
    prompt,
    autoPrompt,
    model,
    parentNodeId,
  }) => {
    const { openProjectId, openGraph } = get();
    if (!(openProjectId && openGraph)) throw new Error("No project open");

    const nodeId = crypto.randomUUID();

    // Save images to disk
    await Promise.all(
      images.map((url, i) => saveNodeImage(openProjectId, nodeId, i, url))
    );

    // Compute position using fresh layout after adding node
    const newNode: AiGenerationNode = {
      id: nodeId,
      parentId: parentNodeId,
      position: { x: 0, y: 0 },
      prompt,
      autoPrompt,
      model,
      imageCount: images.length,
      timestamp: Date.now(),
    };

    const updatedNodes = [...openGraph.nodes, newNode];
    const positions = computeTreeLayout(updatedNodes);
    for (const n of updatedNodes) {
      const pos = positions.get(n.id);
      if (pos) n.position = pos;
    }

    const updatedGraph: AiProjectGraph = {
      nodes: updatedNodes,
      activeNodeId: nodeId,
    };

    await saveProjectGraph(openProjectId, updatedGraph);

    // Refresh project list for updatedAt
    const projects = await listAiProjects();
    set({ openGraph: updatedGraph, projects });

    return nodeId;
  },

  setActiveNode: async (nodeId) => {
    const { openProjectId, openGraph } = get();
    if (!(openProjectId && openGraph)) return;
    const updatedGraph: AiProjectGraph = { ...openGraph, activeNodeId: nodeId };
    await saveProjectGraph(openProjectId, updatedGraph);
    set({ openGraph: updatedGraph });
  },

  loadNodeImages: async (nodeId) => {
    const { openProjectId, openGraph } = get();
    if (!(openProjectId && openGraph)) return [];
    const node = openGraph.nodes.find((n) => n.id === nodeId);
    if (!node) return [];
    return loadNodeImages(openProjectId, nodeId, node.imageCount);
  },
}));
