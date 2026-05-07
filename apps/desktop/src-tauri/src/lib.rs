use tauri::Manager;
use tauri_plugin_decorum::WebviewWindowExt;

// Declare modules
#[cfg(feature = "bria")]
pub mod background_removal;
pub mod secure_storage;
pub mod security;

#[tauri::command]
async fn migrate_app_data(app: tauri::AppHandle) -> Result<bool, String> {
    let new_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let roaming_dir = new_data_dir.parent().ok_or("no parent")?;
    let old_data_dir = roaming_dir.join("pub.youtube.desktop");

    if !old_data_dir.exists() {
        return Ok(false);
    }

    copy_dir_recursive(&old_data_dir, &new_data_dir).map_err(|e| e.to_string())?;
    Ok(true)
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            secure_storage::secure_storage_store,
            secure_storage::secure_storage_retrieve,
            secure_storage::secure_storage_remove_encrypted,
            secure_storage::secure_storage_exists,
            secure_storage::secure_storage_store_batch,
            secure_storage::secure_storage_retrieve_batch,
            secure_storage::secure_storage_list_keys,
            secure_storage::secure_storage_clear_all,
            fetch_as_base64,
            is_bria_available,
            migrate_app_data,
            #[cfg(feature = "bria")]
            background_removal::bria_model_status,
            #[cfg(feature = "bria")]
            background_removal::download_bria_model,
            #[cfg(feature = "bria")]
            background_removal::remove_background_bria,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
