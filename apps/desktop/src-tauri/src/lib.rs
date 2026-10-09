use tauri::{Emitter, Manager};
#[cfg(any(target_os = "windows", target_os = "linux"))]
use tauri_plugin_decorum::WebviewWindowExt;

// Declare modules
pub mod backup;
#[cfg(feature = "bria")]
pub mod background_removal;
pub mod acp;
pub mod embeddings;
pub mod http_bridge;
mod http_auth;
pub mod secure_storage;
mod storage_key;
mod data_migration;
pub mod security;
pub mod upscale;
mod upscaler_integrity;
mod logo_fetch;
pub mod youtube_oauth;

#[tauri::command]
async fn migrate_app_data(app: tauri::AppHandle) -> Result<bool, String> {
    let new_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    data_migration::migrate_app_data_to(&new_data_dir)
}

#[tauri::command]
async fn fetch_as_base64(url: String) -> Result<String, String> {
    let mut response = crate::logo_fetch::client()?.get(crate::logo_fetch::logo_url(&url)?).send().await.map_err(|error| error.to_string())?;
    if !response.status().is_success() || response.content_length().is_some_and(|size| size > crate::logo_fetch::MAX_LOGO_BYTES as u64) { return Err("Logo download failed".into()); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if bytes.len() + chunk.len() > crate::logo_fetch::MAX_LOGO_BYTES { return Err("Logo exceeds its size limit".into()); }
        bytes.extend_from_slice(&chunk);
    }

    use base64::Engine;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
fn is_bria_available() -> bool {
    cfg!(feature = "bria")
}

/// Whether this build includes the local (fastembed/ONNX) embedding engine.
/// False on targets without an ort prebuilt (e.g. macOS Intel); the frontend
/// uses this to fall back to Gemini embeddings.
#[tauri::command]
fn local_embeddings_available() -> bool {
    cfg!(feature = "local-embeddings")
}

#[tauri::command]
async fn backup_manifest(zip_path: String) -> Result<Option<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || backup::inspect_manifest(std::path::Path::new(&zip_path)))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn import_backup(app: tauri::AppHandle, zip_path: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        backup::restore(std::path::Path::new(&zip_path), &app_data_dir, |completed, total, name| {
            let _ = app.emit("import-progress", serde_json::json!({ "pct": completed * 100 / total.max(1), "name": name }));
        })
    }).await.map_err(|e| e.to_string())?
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
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                let main_window = app.get_webview_window("main").unwrap();
                main_window.create_overlay_titlebar().unwrap();
            }

            // Initialize Secure Storage
            let app_data_dir = app.path().app_data_dir().unwrap();
            let app_name = app.package_info().name.clone();

            data_migration::migrate_app_data_to(&app_data_dir).map_err(std::io::Error::other)?;
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
            // Excluded on builds without the `local-embeddings` feature (e.g.
            // macOS Intel); those fall back to Gemini embeddings at runtime.
            #[cfg(feature = "local-embeddings")]
            {
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
            }

            // Initialize ACP tool-call state
            app.manage(acp::AcpState::new());

            http_bridge::initialize_token().map_err(std::io::Error::other)?;
            // Start local HTTP bridge for MCP clients
            let pending = app.state::<acp::AcpState>().pending.clone();
            let app_handle = app.handle().clone();
            let configured_port: u16 = {
                use tauri_plugin_store::StoreExt;
                app.store("settings.json").ok().and_then(|store| store.get("mcp_port")).and_then(|value| value.as_u64()).and_then(|number| u16::try_from(number).ok()).unwrap_or(37842)
            };
            let port = std::env::var("BACKSTAGE_HTTP_PORT").ok().and_then(|value| value.parse().ok()).unwrap_or(configured_port);
            tauri::async_runtime::spawn(async move {
                http_bridge::start(pending, app_handle, port, configured_port).await;
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
            #[cfg(feature = "local-embeddings")]
            embeddings::embedding_model_status,
            #[cfg(feature = "local-embeddings")]
            embeddings::download_embedding_models,
            #[cfg(feature = "local-embeddings")]
            embeddings::embed_image,
            #[cfg(feature = "local-embeddings")]
            embeddings::embed_text,
            #[cfg(feature = "local-embeddings")]
            embeddings::set_embedding_idle_timeout,
            #[cfg(feature = "local-embeddings")]
            embeddings::unload_embedding_models,
            fetch_as_base64,
            http_bridge::mcp_bridge_configuration,
            is_bria_available,
            local_embeddings_available,
            import_backup,
            backup_manifest,
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
