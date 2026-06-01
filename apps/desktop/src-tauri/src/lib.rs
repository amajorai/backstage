use tauri::{Emitter, Manager};
use tauri_plugin_decorum::WebviewWindowExt;

// Declare modules
#[cfg(feature = "bria")]
pub mod background_removal;
pub mod acp;
pub mod embeddings;
pub mod http_bridge;
pub mod secure_storage;
pub mod security;
pub mod upscale;
pub mod youtube_oauth;

#[tauri::command]
async fn migrate_app_data(app: tauri::AppHandle) -> Result<bool, String> {
    let new_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // Skip if already migrated
    let marker = new_data_dir.join(".migrated_from_youtube_pub");
    if marker.exists() {
        return Ok(false);
    }

    let roaming_dir = new_data_dir.parent().ok_or("no parent")?;
    let old_data_dir = roaming_dir.join("pub.youtube.desktop");

    if !old_data_dir.exists() {
        // Mark as done so we don't check again on every launch
        let _ = std::fs::write(&marker, b"");
        return Ok(false);
    }

    copy_dir_best_effort(&old_data_dir, &new_data_dir);
    let _ = std::fs::write(&marker, b"");
    Ok(true)
}

fn copy_dir_best_effort(src: &std::path::Path, dst: &std::path::Path) {
    let _ = std::fs::create_dir_all(dst);
    let entries = match std::fs::read_dir(src) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let ty = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_best_effort(&entry.path(), &dest_path);
        } else {
            // Skip files that are locked (e.g. SQLite WAL) — non-fatal
            let _ = std::fs::copy(entry.path(), dest_path);
        }
    }
}

#[tauri::command]
async fn fetch_as_base64(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let bytes = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
fn is_bria_available() -> bool {
    cfg!(feature = "bria")
}

#[tauri::command]
async fn import_backup(app: tauri::AppHandle, zip_path: String) -> Result<(), String> {
    use std::io::Read;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let file =
        std::fs::File::open(&zip_path).map_err(|e| format!("Cannot open ZIP: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP: {e}"))?;

    let total = archive.len();
    let mut extracted = 0usize;

    for i in 0..total {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();

        // Skip directories and files whose handles are permanently open on the
        // Rust side — they will be recreated cleanly on the next launch.
        if entry.is_dir()
            || name.ends_with(".db-shm")
            || name.ends_with(".db-wal")
            || name == "embeddings.db"
            || name.ends_with("/embeddings.db")
        {
            continue;
        }

        let out_path = app_data_dir.join(&name);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut buf = Vec::with_capacity(entry.size() as usize);
        entry
            .read_to_end(&mut buf)
            .map_err(|e| format!("Read entry {name}: {e}"))?;
        std::fs::write(&out_path, &buf)
            .map_err(|e| format!("Write {name}: {e}"))?;

        extracted += 1;
        let pct = (extracted * 100 / total.max(1)) as u8;
        let _ = app.emit(
            "import-progress",
            serde_json::json!({ "pct": pct, "name": name }),
        );
    }

    // Remove any stale WAL/SHM files that were NOT in the backup so SQLite
    // doesn't try to apply pages from the old database to the restored one.
    for fname in &["gallery.db-wal", "gallery.db-shm"] {
        let stale = app_data_dir.join(fname);
        if stale.exists() {
            let _ = std::fs::remove_file(&stale);
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            main_window.create_overlay_titlebar().unwrap();

            #[cfg(target_os = "macos")]
            {
                main_window.set_traffic_lights_inset(12.0, 16.0).unwrap();
            }

            // Initialize Secure Storage
            let app_data_dir = app.path().app_data_dir().unwrap();
            let app_name = app.package_info().name.clone();

            secure_storage::init_secure_storage(&app_name, &app_data_dir)
                .expect("Failed to initialize secure storage");

            // Initialize Embedding DB (sqlite-vec)
            let embedding_conn = embeddings::init_embedding_db(&app_data_dir)
                .expect("Failed to initialize embedding database");
            app.manage(embeddings::EmbeddingDb(std::sync::Mutex::new(
                embedding_conn,
            )));

            // Initialize the local embedding engine (fastembed / ONNX). Models
            // live under app_data/models/embeddings and load lazily on first use.
            let embed_cache_dir = app_data_dir.join("models").join("embeddings");
            let idle_secs: u64 = {
                use tauri_plugin_store::StoreExt;
                app.store("settings.json")
                    .ok()
                    .and_then(|store| store.get("embedding_idle_timeout_secs"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(300)
            };
            app.manage(embeddings::LocalEmbedder::new(embed_cache_dir, idle_secs));
            embeddings::spawn_idle_unloader(app.handle().clone());

            // Initialize ACP tool-call state
            app.manage(acp::AcpState::new());

            // Start local HTTP bridge for MCP clients
            let pending = app.state::<acp::AcpState>().pending.clone();
            let app_handle = app.handle().clone();
            let port: u16 = std::env::var("BACKSTAGE_HTTP_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .or_else(|| {
                    use tauri_plugin_store::StoreExt;
                    let store = app.store("settings.json").ok()?;
                    store
                        .get("mcp_port")
                        .and_then(|v| v.as_u64())
                        .and_then(|n| u16::try_from(n).ok())
                })
                .unwrap_or(37842);
            tauri::async_runtime::spawn(async move {
                http_bridge::start(pending, app_handle, port).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            acp::acp_prompt,
            acp::acp_tool_result,
            secure_storage::secure_storage_store,
            secure_storage::secure_storage_retrieve,
            secure_storage::secure_storage_remove_encrypted,
            secure_storage::secure_storage_exists,
            secure_storage::secure_storage_store_batch,
            secure_storage::secure_storage_retrieve_batch,
            secure_storage::secure_storage_list_keys,
            secure_storage::secure_storage_clear_all,
            embeddings::store_embedding,
            embeddings::mark_embedding_failed,
            embeddings::delete_embedding,
            embeddings::delete_embeddings_batch,
            embeddings::search_similar_embeddings,
            embeddings::get_embedded_project_ids,
            embeddings::get_failed_embedding_ids,
            embeddings::get_embedding_stats,
            embeddings::get_failure_reasons,
            embeddings::reset_failed_embeddings,
            embeddings::clear_embeddings_other_model,
            embeddings::embedding_model_status,
            embeddings::download_embedding_models,
            embeddings::embed_image,
            embeddings::embed_text,
            embeddings::set_embedding_idle_timeout,
            embeddings::unload_embedding_models,
            fetch_as_base64,
            is_bria_available,
            import_backup,
            migrate_app_data,
            upscale::upscaler_status,
            upscale::download_upscaler,
            upscale::upscale_image,
            youtube_oauth::youtube_oauth_initiate,
            youtube_oauth::youtube_token_refresh,
            youtube_oauth::youtube_oauth_revoke,
            #[cfg(feature = "bria")]
            background_removal::bria_model_status,
            #[cfg(feature = "bria")]
            background_removal::download_bria_model,
            #[cfg(feature = "bria")]
            background_removal::remove_background_bria,
            #[cfg(feature = "bria")]
            background_removal::bria_v2_model_status,
            #[cfg(feature = "bria")]
            background_removal::download_bria_v2_model,
            #[cfg(feature = "bria")]
            background_removal::remove_background_bria_v2,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
