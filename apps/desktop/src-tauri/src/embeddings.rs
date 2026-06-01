use fastembed::{
    EmbeddingModel, ImageEmbedding, ImageEmbeddingModel, ImageInitOptions, TextEmbedding,
    TextInitOptions,
};
use rusqlite::{Connection, OptionalExtension};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager, State};

/// Current local embedding model. Image thumbnails are embedded with
/// nomic-embed-vision-v1.5 and text queries with nomic-embed-text-v1.5; the two
/// share an aligned 768-dim space, so a text query can retrieve images directly.
/// Both produce 768-dim vectors, matching the `vec0(embedding float[768])` schema.
pub const CURRENT_MODEL_VERSION: &str = "nomic-embed-vision-v1.5";

pub struct EmbeddingDb(pub Mutex<Connection>);

fn floats_to_bytes(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

pub fn init_embedding_db(app_data_dir: &Path) -> Result<Connection, String> {
    let db_path = app_data_dir.join("embeddings.db");

    // Register sqlite-vec extension globally for all rusqlite connections in this process
    unsafe {
        rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
            sqlite_vec::sqlite3_vec_init as *const (),
        )));
    }

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open embeddings.db: {e}"))?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .map_err(|e| format!("Failed to set pragmas: {e}"))?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS embedding_index (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT UNIQUE NOT NULL,
            embedded_at INTEGER NOT NULL,
            model_version TEXT NOT NULL DEFAULT 'nomic-embed-vision-v1.5',
            failed INTEGER NOT NULL DEFAULT 0,
            failure_reason TEXT
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(embedding float[768]);",
    )
    .map_err(|e| format!("Failed to create tables: {e}"))?;

    Ok(conn)
}

#[tauri::command]
pub fn store_embedding(
    state: State<EmbeddingDb>,
    project_id: String,
    embedding: Vec<f32>,
    model_version: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let model = model_version.unwrap_or_else(|| CURRENT_MODEL_VERSION.to_string());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let bytes = floats_to_bytes(&embedding);

    // Check if exists
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM embedding_index WHERE project_id = ?1",
            rusqlite::params![&project_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match existing {
        Some(rowid) => {
            conn.execute(
                "UPDATE embedding_index SET embedded_at = ?1, model_version = ?2, failed = 0, failure_reason = NULL WHERE id = ?3",
                rusqlite::params![now, &model, rowid],
            )
            .map_err(|e| e.to_string())?;
            // Replace vector
            conn.execute(
                "DELETE FROM vec_embeddings WHERE rowid = ?1",
                rusqlite::params![rowid],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO vec_embeddings(rowid, embedding) VALUES(?1, ?2)",
                rusqlite::params![rowid, &bytes],
            )
            .map_err(|e| e.to_string())?;
        }
        None => {
            conn.execute(
                "INSERT INTO embedding_index(project_id, embedded_at, model_version) VALUES(?1, ?2, ?3)",
                rusqlite::params![&project_id, now, &model],
            )
            .map_err(|e| e.to_string())?;
            let rowid = conn.last_insert_rowid();
            conn.execute(
                "INSERT INTO vec_embeddings(rowid, embedding) VALUES(?1, ?2)",
                rusqlite::params![rowid, &bytes],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn mark_embedding_failed(
    state: State<EmbeddingDb>,
    project_id: String,
    reason: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    conn.execute(
        "INSERT INTO embedding_index(project_id, embedded_at, model_version, failed, failure_reason)
         VALUES(?1, ?2, ?4, 1, ?3)
         ON CONFLICT(project_id) DO UPDATE SET
           failed = failed + 1,
           failure_reason = ?3,
           embedded_at = ?2",
        rusqlite::params![&project_id, now, &reason, CURRENT_MODEL_VERSION],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_embedding(state: State<EmbeddingDb>, project_id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let rowid: Option<i64> = conn
        .query_row(
            "SELECT id FROM embedding_index WHERE project_id = ?1",
            rusqlite::params![&project_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(rowid) = rowid {
        conn.execute(
            "DELETE FROM vec_embeddings WHERE rowid = ?1",
            rusqlite::params![rowid],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM embedding_index WHERE id = ?1",
            rusqlite::params![rowid],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_embeddings_batch(
    state: State<EmbeddingDb>,
    project_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    for project_id in &project_ids {
        let rowid: Option<i64> = conn
            .query_row(
                "SELECT id FROM embedding_index WHERE project_id = ?1",
                rusqlite::params![project_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        if let Some(rowid) = rowid {
            conn.execute(
                "DELETE FROM vec_embeddings WHERE rowid = ?1",
                rusqlite::params![rowid],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "DELETE FROM embedding_index WHERE id = ?1",
                rusqlite::params![rowid],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn search_similar_embeddings(
    state: State<EmbeddingDb>,
    embedding: Vec<f32>,
    limit: Option<usize>,
) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let k = limit.unwrap_or(50) as i64;
    let bytes = floats_to_bytes(&embedding);

    // Step 1: KNN search to get rowids
    let mut stmt = conn
        .prepare("SELECT rowid FROM vec_embeddings WHERE embedding MATCH ?1 AND k = ?2")
        .map_err(|e| e.to_string())?;

    let rowids: Vec<i64> = stmt
        .query_map(rusqlite::params![&bytes, k], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Step 2: Map rowids → project_ids (preserving order)
    let mut project_ids = Vec::with_capacity(rowids.len());
    for rowid in rowids {
        if let Ok(pid) = conn.query_row(
            "SELECT project_id FROM embedding_index WHERE id = ?1 AND failed = 0",
            rusqlite::params![rowid],
            |row| row.get::<_, String>(0),
        ) {
            project_ids.push(pid);
        }
    }

    Ok(project_ids)
}

#[tauri::command]
pub fn get_embedded_project_ids(state: State<EmbeddingDb>) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT project_id FROM embedding_index WHERE failed = 0")
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ids)
}

#[tauri::command]
pub fn get_failed_embedding_ids(state: State<EmbeddingDb>) -> Result<Vec<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT project_id FROM embedding_index WHERE failed > 0 AND failed < 3")
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ids)
}

#[tauri::command]
pub fn get_embedding_stats(state: State<EmbeddingDb>) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM embedding_index WHERE failed = 0",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let failed: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM embedding_index WHERE failed > 0",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(serde_json::json!({ "embedded": total, "failed": failed }))
}

#[tauri::command]
pub fn get_failure_reasons(
    state: State<EmbeddingDb>,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT failure_reason, COUNT(*) as cnt
             FROM embedding_index
             WHERE failed > 0 AND failure_reason IS NOT NULL
             GROUP BY failure_reason
             ORDER BY cnt DESC
             LIMIT 3",
        )
        .map_err(|e| e.to_string())?;

    let reasons: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(reason, count)| serde_json::json!({ "reason": reason, "count": count }))
        .collect();

    Ok(reasons)
}

#[tauri::command]
pub fn reset_failed_embeddings(state: State<EmbeddingDb>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM embedding_index WHERE failed > 0", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete every embedding NOT produced by `current_model`. Vectors from a
/// different model (e.g. the old Gemini `text-embedding-004` space) live in the
/// same 768-dim table but are not comparable, so mixing them corrupts KNN
/// results. Called once when switching to the local model so stale vectors are
/// purged and re-indexed. Deletes from BOTH tables to avoid orphaned vectors.
#[tauri::command]
pub fn clear_embeddings_other_model(
    state: State<EmbeddingDb>,
    current_model: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id FROM embedding_index WHERE model_version != ?1")
        .map_err(|e| e.to_string())?;
    let rowids: Vec<i64> = stmt
        .query_map(rusqlite::params![&current_model], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for rowid in rowids {
        conn.execute(
            "DELETE FROM vec_embeddings WHERE rowid = ?1",
            rusqlite::params![rowid],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM embedding_index WHERE id = ?1",
            rusqlite::params![rowid],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ── Local embedding engine (fastembed / ONNX, in-process) ────────────────────
//
// nomic-embed-vision-v1.5 embeds image thumbnails and nomic-embed-text-v1.5
// embeds text queries; both are 768-dim and share an aligned space. Models are
// loaded lazily on first use and dropped after an idle timeout to free RAM.

const MODEL_MARKER: &str = ".models-installed";

/// Lazily-loaded embedding models plus idle-unload bookkeeping. Held in Tauri
/// managed state. The models are kept behind individual mutexes so a text query
/// and an image embed don't block each other unnecessarily.
pub struct LocalEmbedder {
    text: Mutex<Option<TextEmbedding>>,
    image: Mutex<Option<ImageEmbedding>>,
    last_used: Mutex<Instant>,
    /// Seconds of inactivity before models are unloaded. 0 = never unload.
    idle_secs: Mutex<u64>,
    cache_dir: PathBuf,
}

impl LocalEmbedder {
    pub fn new(cache_dir: PathBuf, idle_secs: u64) -> Self {
        Self {
            text: Mutex::new(None),
            image: Mutex::new(None),
            last_used: Mutex::new(Instant::now()),
            idle_secs: Mutex::new(idle_secs),
            cache_dir,
        }
    }

    fn touch(&self) {
        if let Ok(mut t) = self.last_used.lock() {
            *t = Instant::now();
        }
    }

    fn new_text_model(&self) -> Result<TextEmbedding, String> {
        TextEmbedding::try_new(
            TextInitOptions::new(EmbeddingModel::NomicEmbedTextV15)
                .with_cache_dir(self.cache_dir.clone())
                .with_show_download_progress(true),
        )
        .map_err(|e| format!("Failed to load text embedding model: {e}"))
    }

    fn new_image_model(&self) -> Result<ImageEmbedding, String> {
        ImageEmbedding::try_new(
            ImageInitOptions::new(ImageEmbeddingModel::NomicEmbedVisionV15)
                .with_cache_dir(self.cache_dir.clone())
                .with_show_download_progress(true),
        )
        .map_err(|e| format!("Failed to load image embedding model: {e}"))
    }
}

fn marker_path(cache_dir: &Path) -> PathBuf {
    cache_dir.join(MODEL_MARKER)
}

#[tauri::command]
pub fn embedding_model_status(state: State<LocalEmbedder>) -> Result<serde_json::Value, String> {
    let installed = marker_path(&state.cache_dir).exists();
    let loaded = state
        .text
        .lock()
        .map(|t| t.is_some())
        .unwrap_or(false)
        || state.image.lock().map(|i| i.is_some()).unwrap_or(false);
    Ok(serde_json::json!({ "installed": installed, "loaded": loaded }))
}

/// Download (or warm) both embedding models. fastembed pulls the ONNX weights +
/// tokenizer from HuggingFace into `cache_dir` on first construction; subsequent
/// calls are fast. Progress is printed by fastembed to stderr, so the UI shows a
/// "started/finished" spinner around this call.
#[tauri::command]
pub async fn download_embedding_models(
    app: AppHandle,
    state: State<'_, LocalEmbedder>,
) -> Result<(), String> {
    let cache_dir = state.cache_dir.clone();
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let _ = app.emit("embedding-download-started", ());

    let cd_text = cache_dir.clone();
    let cd_image = cache_dir.clone();

    // fastembed construction is blocking (downloads + initializes ONNX sessions).
    let (text_model, image_model) =
        tauri::async_runtime::spawn_blocking(move || -> Result<(TextEmbedding, ImageEmbedding), String> {
            let text = TextEmbedding::try_new(
                TextInitOptions::new(EmbeddingModel::NomicEmbedTextV15)
                    .with_cache_dir(cd_text)
                    .with_show_download_progress(true),
            )
            .map_err(|e| format!("Failed to download text model: {e}"))?;
            let image = ImageEmbedding::try_new(
                ImageInitOptions::new(ImageEmbeddingModel::NomicEmbedVisionV15)
                    .with_cache_dir(cd_image)
                    .with_show_download_progress(true),
            )
            .map_err(|e| format!("Failed to download image model: {e}"))?;
            Ok((text, image))
        })
        .await
        .map_err(|e| e.to_string())??;

    // Warm the state with the freshly loaded models and mark as installed.
    if let Ok(mut t) = state.text.lock() {
        *t = Some(text_model);
    }
    if let Ok(mut i) = state.image.lock() {
        *i = Some(image_model);
    }
    std::fs::write(marker_path(&cache_dir), b"").map_err(|e| e.to_string())?;
    state.touch();

    let _ = app.emit("embedding-download-finished", ());
    Ok(())
}

/// Embed a single image (data URL or raw base64) into a 768-dim vector using
/// nomic-embed-vision-v1.5.
#[tauri::command]
pub fn embed_image(state: State<LocalEmbedder>, data_url: String) -> Result<Vec<f32>, String> {
    let base64_data = data_url
        .split_once(',')
        .map(|(_, b)| b)
        .unwrap_or(&data_url);
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Invalid image data: {e}"))?;

    let mut guard = state.image.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(state.new_image_model()?);
    }
    let model = guard.as_mut().ok_or("Image model unavailable")?;

    let embeddings = model
        .embed_bytes(&[bytes.as_slice()], None)
        .map_err(|e| format!("Image embedding failed: {e}"))?;
    drop(guard);
    state.touch();

    embeddings
        .into_iter()
        .next()
        .ok_or_else(|| "Image embedding produced no output".to_string())
}

/// Embed a text query into a 768-dim vector using nomic-embed-text-v1.5.
/// nomic's retrieval convention prefixes queries with `search_query: `, which is
/// what aligns text vectors with nomic-embed-vision image vectors.
#[tauri::command]
pub fn embed_text(state: State<LocalEmbedder>, text: String) -> Result<Vec<f32>, String> {
    let prefixed = format!("search_query: {text}");

    let mut guard = state.text.lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        *guard = Some(state.new_text_model()?);
    }
    let model = guard.as_mut().ok_or("Text model unavailable")?;

    let embeddings = model
        .embed(vec![prefixed], None)
        .map_err(|e| format!("Text embedding failed: {e}"))?;
    drop(guard);
    state.touch();

    embeddings
        .into_iter()
        .next()
        .ok_or_else(|| "Text embedding produced no output".to_string())
}

/// Update the idle-unload timeout (seconds; 0 = never unload).
#[tauri::command]
pub fn set_embedding_idle_timeout(state: State<LocalEmbedder>, secs: u64) -> Result<(), String> {
    if let Ok(mut s) = state.idle_secs.lock() {
        *s = secs;
    }
    Ok(())
}

/// Drop loaded models from memory immediately.
#[tauri::command]
pub fn unload_embedding_models(state: State<LocalEmbedder>) -> Result<(), String> {
    if let Ok(mut t) = state.text.lock() {
        *t = None;
    }
    if let Ok(mut i) = state.image.lock() {
        *i = None;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ExtendedColorType, ImageEncoder, Rgb, RgbImage};

    /// Encode a solid-color 64×64 image as lossless WebP — the same container
    /// format preview thumbnails are stored in (`canvas.toDataURL("image/webp")`).
    fn solid_webp(r: u8, g: u8, b: u8) -> Vec<u8> {
        let img = RgbImage::from_pixel(64, 64, Rgb([r, g, b]));
        let mut buf = Vec::new();
        image::codecs::webp::WebPEncoder::new_lossless(&mut buf)
            .write_image(img.as_raw(), 64, 64, ExtendedColorType::Rgb8)
            .expect("encode webp fixture");
        buf
    }

    fn cosine(a: &[f32], b: &[f32]) -> f32 {
        let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
        let na: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let nb: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
        dot / (na * nb)
    }

    /// Acceptance test for the local embedding feature. Proves the three things
    /// builds can't: (1) both models emit 768-dim vectors matching the vec0
    /// schema, (2) fastembed actually decodes WebP previews, (3) a text query
    /// retrieves the matching image (alignment + `search_query:` prefix work).
    ///
    /// Ignored by default: downloads ~700 MB of models on first run.
    /// Run with: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn nomic_embeds_dims_webp_and_alignment() {
        let cache = std::env::temp_dir().join("bs_embed_acceptance_test");

        let mut image_model = ImageEmbedding::try_new(
            ImageInitOptions::new(ImageEmbeddingModel::NomicEmbedVisionV15)
                .with_cache_dir(cache.clone()),
        )
        .expect("load nomic-embed-vision");
        let mut text_model = TextEmbedding::try_new(
            TextInitOptions::new(EmbeddingModel::NomicEmbedTextV15).with_cache_dir(cache),
        )
        .expect("load nomic-embed-text");

        // (2) WebP must decode and (1) the vector must be 768-dim.
        let red_webp = solid_webp(220, 20, 20);
        let image_embeddings = image_model
            .embed_bytes(&[red_webp.as_slice()], None)
            .expect("embed webp image (decode path)");
        let image_vec = &image_embeddings[0];
        assert_eq!(image_vec.len(), 768, "image embedding must be 768-dim");

        let text_embeddings = text_model
            .embed(
                vec![
                    "search_query: a solid red image".to_string(),
                    "search_query: a solid blue image".to_string(),
                ],
                None,
            )
            .expect("embed text queries");
        assert_eq!(text_embeddings[0].len(), 768, "text embedding must be 768-dim");

        // (3) The red image must align more with the "red" caption than "blue".
        let sim_red = cosine(image_vec, &text_embeddings[0]);
        let sim_blue = cosine(image_vec, &text_embeddings[1]);
        println!("cosine(red image, 'red') = {sim_red}; cosine(red image, 'blue') = {sim_blue}");
        assert!(
            sim_red > sim_blue,
            "text→image alignment broken: red image should match 'red' caption more than 'blue' (red={sim_red}, blue={sim_blue})"
        );
    }
}

/// Background loop: unload models after the configured idle period. Spawned once
/// at startup. Checks every 30s; a timeout of 0 disables unloading.
pub fn spawn_idle_unloader(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            ticker.tick().await;
            let state = app.state::<LocalEmbedder>();
            let idle_secs = state.idle_secs.lock().map(|s| *s).unwrap_or(0);
            if idle_secs == 0 {
                continue;
            }
            let idle_for = state
                .last_used
                .lock()
                .map(|t| t.elapsed().as_secs())
                .unwrap_or(0);
            if idle_for < idle_secs {
                continue;
            }
            let text_loaded = state.text.lock().map(|t| t.is_some()).unwrap_or(false);
            let image_loaded = state.image.lock().map(|i| i.is_some()).unwrap_or(false);
            if text_loaded || image_loaded {
                if let Ok(mut t) = state.text.lock() {
                    *t = None;
                }
                if let Ok(mut i) = state.image.lock() {
                    *i = None;
                }
            }
        }
    });
}
