import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { getDb } from "@/lib/db";
import { bytesToDataUrl, dataUrlToBytes, ensureDir } from "@/lib/fs-utils";
import { migrate } from "@/lib/schema-migration";

const AI_PROJECTS_DIR = "ai-projects";
const GRAPH_SCHEMA_VERSION = 1;

export interface AiGenerationNode {
  id: string;
  parentId: string | null;
  position: { x: number; y: number };
  prompt: string;
  autoPrompt: string;
  model: string;
  imageCount: number;
  timestamp: number;
}

export interface AiProjectGraph {
  schemaVersion: number;
  nodes: AiGenerationNode[];
  activeNodeId: string | null;
}

export interface AiProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

const graphMigrations = {
  // v0 had no schemaVersion — same shape, just stamp the version
  0: (d: Record<string, unknown>) => ({ ...d, schemaVersion: 1 }),
} as const;

async function getBaseDir(): Promise<string> {
  const appData = await appDataDir();
  return join(appData, AI_PROJECTS_DIR);
}

async function getProjectDir(projectId: string): Promise<string> {
  const base = await getBaseDir();
  return join(base, projectId);
}

export async function createAiProject(id: string, name: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.execute(
    "INSERT INTO ai_projects (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
    [id, name, now, now]
  );
  const dir = await getProjectDir(id);
  await ensureDir(dir);
  const emptyGraph: AiProjectGraph = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    nodes: [],
    activeNodeId: null,
  };
  await writeGraphFile(dir, emptyGraph);
}

export async function listAiProjects(): Promise<AiProjectRecord[]> {
  const db = await getDb();
  return db.select<AiProjectRecord[]>(
    "SELECT * FROM ai_projects ORDER BY updatedAt DESC"
  );
}

export async function renameAiProject(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE ai_projects SET name = ?, updatedAt = ? WHERE id = ?",
    [name, Date.now(), id]
  );
}

export async function deleteAiProject(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM ai_projects WHERE id = ?", [id]);
  const dir = await getProjectDir(id);
  if (await exists(dir)) {
    await remove(dir, { recursive: true });
  }
}

async function graphPath(projectId: string): Promise<string> {
  const dir = await getProjectDir(projectId);
  return join(dir, "graph.json");
}

async function writeGraphFile(
  dir: string,
  graph: AiProjectGraph
): Promise<void> {
  const path = await join(dir, "graph.json");
  await writeFile(path, new TextEncoder().encode(JSON.stringify(graph)));
}

export async function loadProjectGraph(
  projectId: string
): Promise<AiProjectGraph> {
  const path = await graphPath(projectId);
  if (!(await exists(path))) {
    return {
      schemaVersion: GRAPH_SCHEMA_VERSION,
      nodes: [],
      activeNodeId: null,
    };
  }
  const bytes = await readFile(path);
  const raw = JSON.parse(new TextDecoder().decode(bytes));
  return migrate<AiProjectGraph>(raw, graphMigrations, GRAPH_SCHEMA_VERSION);
}

export async function saveProjectGraph(
  projectId: string,
  graph: AiProjectGraph
): Promise<void> {
  const db = await getDb();
  const dir = await getProjectDir(projectId);
  await ensureDir(dir);
  await writeGraphFile(dir, { ...graph, schemaVersion: GRAPH_SCHEMA_VERSION });
  await db.execute("UPDATE ai_projects SET updatedAt = ? WHERE id = ?", [
    Date.now(),
    projectId,
  ]);
}

export async function saveNodeImage(
  projectId: string,
  nodeId: string,
  index: number,
  dataUrl: string
): Promise<void> {
  const dir = await getProjectDir(projectId);
  await ensureDir(dir);
  const path = await join(dir, `${nodeId}_${index}.webp`);
  await writeFile(path, dataUrlToBytes(dataUrl));
}

export async function loadNodeImages(
  projectId: string,
  nodeId: string,
  imageCount: number
): Promise<string[]> {
  const dir = await getProjectDir(projectId);
  const images: string[] = [];
  for (let i = 0; i < imageCount; i++) {
    const path = await join(dir, `${nodeId}_${i}.webp`);
    if (!(await exists(path))) continue;
    const bytes = await readFile(path);
    images.push(bytesToDataUrl(bytes, "image/webp"));
  }
  return images;
}

export function computeTreeLayout(
  nodes: AiGenerationNode[]
): Map<string, { x: number; y: number }> {
  const NODE_W = 240;
  const NODE_H = 220;
  const H_GAP = 40;
  const V_GAP = 60;

  const childrenMap = new Map<string | null, string[]>();
  for (const n of nodes) {
    if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
    childrenMap.get(n.parentId)!.push(n.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let leafX = 0;

  function dfs(nodeId: string, depth: number): void {
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) {
      positions.set(nodeId, {
        x: leafX * (NODE_W + H_GAP),
        y: depth * (NODE_H + V_GAP),
      });
      leafX++;
      return;
    }
    const startLeaf = leafX;
    for (const child of children) {
      dfs(child, depth + 1);
    }
    const endLeaf = leafX - 1;
    const startX = startLeaf * (NODE_W + H_GAP);
    const endX = endLeaf * (NODE_W + H_GAP);
    positions.set(nodeId, {
      x: (startX + endX) / 2,
      y: depth * (NODE_H + V_GAP),
    });
  }

  for (const root of childrenMap.get(null) ?? []) {
    dfs(root, 0);
  }

  return positions;
}
