import { invoke } from "@tauri-apps/api/core";

export async function storeEmbedding(
  projectId: string,
  embedding: number[],
  modelVersion?: string
): Promise<void> {
  await invoke("store_embedding", { projectId, embedding, modelVersion });
}

export async function markEmbeddingFailed(
  projectId: string,
  reason: string
): Promise<void> {
  await invoke("mark_embedding_failed", { projectId, reason });
}

export async function deleteEmbedding(projectId: string): Promise<void> {
  await invoke("delete_embedding", { projectId });
}

export async function deleteEmbeddingsBatch(
  projectIds: string[]
): Promise<void> {
  if (projectIds.length === 0) return;
  await invoke("delete_embeddings_batch", { projectIds });
}

export async function searchSimilarEmbeddings(
  embedding: number[],
  limit = 50
): Promise<string[]> {
  return await invoke<string[]>("search_similar_embeddings", {
    embedding,
    limit,
  });
}

export async function getEmbeddedProjectIds(): Promise<string[]> {
  return await invoke<string[]>("get_embedded_project_ids");
}

export async function getFailedEmbeddingIds(): Promise<string[]> {
  return await invoke<string[]>("get_failed_embedding_ids");
}

export async function getEmbeddingStats(): Promise<{
  embedded: number;
  failed: number;
}> {
  return await invoke<{ embedded: number; failed: number }>(
    "get_embedding_stats"
  );
}

export async function getFailureReasons(): Promise<
  { reason: string; count: number }[]
> {
  return await invoke<{ reason: string; count: number }[]>(
    "get_failure_reasons"
  );
}

export async function resetFailedEmbeddings(): Promise<void> {
  await invoke("reset_failed_embeddings");
}
