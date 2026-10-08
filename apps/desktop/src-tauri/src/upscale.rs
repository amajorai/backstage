use base64::Engine;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// xinntao/Real-ESRGAN v0.2.5.0 — these ZIPs bundle the binary + DLLs + models/ folder
const RELEASE_BASE: &str = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0";
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

#[cfg(target_os = "windows")]
const PLATFORM: &str = "windows";
#[cfg(target_os = "macos")]
const PLATFORM: &str = "macos";
#[cfg(target_os = "linux")]
const PLATFORM: &str = "ubuntu";

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
    let expected = crate::upscaler_integrity::manifest(PLATFORM)?;
    let verified = crate::upscaler_integrity::verify_installation(&upscaler_dir(&app)?, &expected)?;
    Ok(UpscalerStatus {
        available: verified,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn download_upscaler(app: AppHandle) -> Result<(), String> {
    let dir = upscaler_dir(&app)?;
    let expected = crate::upscaler_integrity::manifest(PLATFORM)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|error| error.to_string())?;
    let mut response = client
        .get(format!("{RELEASE_BASE}/{RELEASE_ZIP}"))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success()
        || response
            .content_length()
            .is_some_and(|size| size > 64 * 1024 * 1024)
    {
        return Err("Upscaler download failed".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if bytes.len() + chunk.len() > 64 * 1024 * 1024 {
            return Err("Upscaler archive exceeds its size limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    tauri::async_runtime::spawn_blocking(move || {
        crate::upscaler_integrity::install(&bytes, &dir, &expected)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn upscale_image(
    app: AppHandle,
    data_url: String,
    scale: u8,
    model: String,
) -> Result<String, String> {
    let bin = binary_path(&app)?;
    let expected = crate::upscaler_integrity::manifest(PLATFORM)?;
    if !crate::upscaler_integrity::verify_installation(&upscaler_dir(&app)?, &expected)? {
        return Err(
            "Upscaler integrity is unverified. Use the upscale button to reinstall it first."
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

    let mut cmd = tokio::process::Command::new(&bin);
    cmd.args([
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
    ]);

    // On Windows, run the console binary without flashing up a cmd window.
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let result = cmd.output().await;

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
