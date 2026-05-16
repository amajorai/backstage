use rusqlite::{Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

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
            model_version TEXT NOT NULL DEFAULT 'text-embedding-004',
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
    let model = model_version.unwrap_or_else(|| "text-embedding-004".to_string());
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
         VALUES(?1, ?2, 'text-embedding-004', 1, ?3)
         ON CONFLICT(project_id) DO UPDATE SET
           failed = failed + 1,
           failure_reason = ?3,
           embedded_at = ?2",
        rusqlite::params![&project_id, now, &reason],
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
