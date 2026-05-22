use base64::Engine;
use serde::Serialize;
use std::io::Read;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// xinntao/Real-ESRGAN v0.2.5.0 — these ZIPs bundle the binary + DLLs + models/ folder
const RELEASE_BASE: &str =
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0";
const UPSCALER_SUBDIR: &str = "upscaler";

#[cfg(target_os = "windows")]
const BINARY_NAME: &str = "realesrgan-ncnn-vulkan.exe";
#[cfg(not(target_os = "windows"))]
const BINARY_NAME: &str = "realesrgan-ncnn-vulkan";

#[cfg(target_os = "windows")]
const RELEASE_ZIP: &str = "realesrgan-ncnn-vulkan-20220424-windows.zip";
#[cfg(target_os = "macos")]
const RELEASE_ZIP: &str = "realesrgan-ncnn-vulkan-20220424-macos.zip";
#[cfg(target_os = "linux")]
const RELEASE_ZIP: &str = "realesrgan-ncnn-vulkan-20220424-ubuntu.zip";

fn upscaler_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(data_dir.join(UPSCALER_SUBDIR))
}

fn binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(upscaler_dir(app)?.join(BINARY_NAME))
}

#[derive(Serialize, Clone)]
pub struct UpscalerStatus {
    pub available: bool,
    pub path: String,
}

#[tauri::command]
pub async fn upscaler_status(app: AppHandle) -> Result<UpscalerStatus, String> {
    let path = binary_path(&app)?;
    let models_dir = upscaler_dir(&app)?.join("models");
    // Require binary + both model .param files so a partial extract triggers a retry
    let models_ok = ["realesrgan-x4plus.param", "realesrgan-x4plus-anime.param"]
        .iter()
        .all(|f| models_dir.join(f).exists());
    Ok(UpscalerStatus {
        available: path.exists() && models_ok,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn download_upscaler(app: AppHandle) -> Result<(), String> {
    let dir = upscaler_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let client = reqwest::Client::new();

    let zip_url = format!("{RELEASE_BASE}/{RELEASE_ZIP}");
    let response = client
        .get(&zip_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed: HTTP {}",
            response.status()
        ));
    }

    let zip_bytes = response.bytes().await.map_err(|e| e.to_string())?;
    let zip_path = dir.join("realesrgan.zip");
    std::fs::write(&zip_path, &zip_bytes[..]).map_err(|e| e.to_string())?;
    extract_zip(&zip_path, &dir)?;
    let _ = std::fs::remove_file(&zip_path);

    Ok(())
}

fn extract_zip(zip_path: &PathBuf, dest_dir: &PathBuf) -> Result<(), String> {
    let zip_data = std::fs::read(zip_path).map_err(|e| e.to_string())?;
    let mut archive =
        zip::ZipArchive::new(std::io::Cursor::new(zip_data)).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }

        let name = entry.name().to_string();
        let file_name = match std::path::Path::new(&name)
            .file_name()
            .and_then(|n| n.to_str())
        {
            Some(n) => n.to_string(),
            None => continue,
        };

        let is_binary = file_name == BINARY_NAME
            || file_name == "realesrgan-ncnn-vulkan"
            || file_name == "realesrgan-ncnn-vulkan.exe";
        let is_model = (name.contains("/models/") || name.starts_with("models/"))
            && (file_name.ends_with(".bin") || file_name.ends_with(".param"));
        // Windows needs vcomp140.dll / vcomp140d.dll alongside the binary
        let is_dll = file_name.ends_with(".dll");

        if !is_binary && !is_model && !is_dll {
            continue;
        }

        let out_path = if is_model {
            dest_dir.join("models").join(&file_name)
        } else {
            dest_dir.join(&file_name)
        };

        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        std::fs::write(&out_path, &buf).map_err(|e| e.to_string())?;

        #[cfg(unix)]
        if is_binary {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(
                &out_path,
                std::fs::Permissions::from_mode(0o755),
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn upscale_image(
    app: AppHandle,
    data_url: String,
    scale: u8,
    model: String,
) -> Result<String, String> {
    let bin = binary_path(&app)?;
    if !bin.exists() {
        return Err(
            "Upscaler not installed. Use the upscale button to download it first."
                .to_string(),
        );
    }

    let dir = upscaler_dir(&app)?;
    let models_dir = dir.join("models");

    let base64_data = data_url
        .split_once(',')
        .map(|(_, b)| b)
        .ok_or("Invalid data URL")?;

    let img_bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())?;

    let pid = std::process::id();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("bs_usc_in_{pid}_{ts}.png"));
    let output_path = temp_dir.join(format!("bs_usc_out_{pid}_{ts}.png"));

    std::fs::write(&input_path, &img_bytes).map_err(|e| e.to_string())?;

    // realesrgan-x4plus / realesrgan-x4plus-anime are x4-only networks;
    // always run at 4× and let the caller resize to 2× if needed.
    let run_scale = scale.max(4);

    // Remove any stale output file so the existence check below is reliable.
    let _ = std::fs::remove_file(&output_path);

    let result = tokio::process::Command::new(&bin)
        .args([
            "-i",
            input_path.to_str().unwrap_or_default(),
            "-o",
            output_path.to_str().unwrap_or_default(),
            "-s",
            &run_scale.to_string(),
            "-n",
            &model,
            "-m",
            models_dir.to_str().unwrap_or_default(),
        ])
        .output()
        .await;

    let _ = std::fs::remove_file(&input_path);

    let output = result.map_err(|e| format!("Failed to run upscaler: {e}"))?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&output_path);
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Upscaler failed: {}", stderr.trim()));
    }

    if !output_path.exists() {
        return Err("Upscaler produced no output file".to_string());
    }

    let out_bytes = std::fs::read(&output_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&output_path);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&out_bytes);
    Ok(format!("data:image/png;base64,{b64}"))
}
