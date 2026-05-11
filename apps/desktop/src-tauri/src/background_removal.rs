#![cfg(feature = "bria")]

use base64::Engine;
use futures_util::StreamExt;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use ort::session::Session;
use ort::session::builder::GraphOptimizationLevel;
use ort::value::Tensor;
use serde::Serialize;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

// RMBG-1.4
const BRIA_MODEL_URL: &str =
    "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx";
const MODEL_SUBDIR: &str = "models/rmbg";
const MODEL_FILENAME: &str = "model.onnx";

// RMBG-2.0
const BRIA_V2_MODEL_URL: &str =
    "https://huggingface.co/briaai/RMBG-2.0/resolve/main/onnx/model.onnx";
const MODEL_V2_SUBDIR: &str = "models/rmbg2";
const MODEL_V2_FILENAME: &str = "model.onnx";

const INPUT_SIZE: usize = 1024;

#[derive(Serialize, Clone)]
pub struct BriaModelStatus {
    pub exists: bool,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    downloaded: u64,
    total: u64,
}

fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(data_dir.join(MODEL_SUBDIR).join(MODEL_FILENAME))
}

fn model_v2_path(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(data_dir.join(MODEL_V2_SUBDIR).join(MODEL_V2_FILENAME))
}

#[tauri::command]
pub async fn bria_model_status(app: AppHandle) -> Result<BriaModelStatus, String> {
    let path = model_path(&app)?;
    let exists = path.exists();
    let size_bytes = if exists {
        std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    Ok(BriaModelStatus {
        exists,
        path: path.to_string_lossy().to_string(),
        size_bytes,
    })
}

#[tauri::command]
pub async fn download_bria_model(app: AppHandle) -> Result<(), String> {
    let path = model_path(&app)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::new();
    let response = client
        .get(BRIA_MODEL_URL)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    let mut downloaded = 0u64;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let _ = app.emit("bria-download-progress", DownloadProgress { downloaded, total });
    }

    Ok(())
}

/// Resize to INPUT_SIZE×INPUT_SIZE and return flat NCHW f32 data normalized to [-0.5, 0.5].
fn preprocess(img: &DynamicImage) -> Vec<f32> {
    let rgb = img.to_rgb8();
    let resized = image::imageops::resize(
        &rgb,
        INPUT_SIZE as u32,
        INPUT_SIZE as u32,
        image::imageops::FilterType::Lanczos3,
    );

    let n = INPUT_SIZE;
    let mut data = vec![0.0f32; 3 * n * n];
    for (x, y, pixel) in resized.enumerate_pixels() {
        let xi = x as usize;
        let yi = y as usize;
        data[yi * n + xi] = pixel[0] as f32 / 255.0 - 0.5;
        data[n * n + yi * n + xi] = pixel[1] as f32 / 255.0 - 0.5;
        data[2 * n * n + yi * n + xi] = pixel[2] as f32 / 255.0 - 0.5;
    }
    data
}

fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

fn apply_mask(original: &DynamicImage, mask_flat: &[f32]) -> DynamicImage {
    let (orig_w, orig_h) = original.dimensions();
    let rgba = original.to_rgba8();

    let mask_img: image::GrayImage = ImageBuffer::from_fn(
        INPUT_SIZE as u32,
        INPUT_SIZE as u32,
        |x, y| {
            let idx = y as usize * INPUT_SIZE + x as usize;
            let val = sigmoid(mask_flat[idx]);
            image::Luma([(val * 255.0) as u8])
        },
    );

    let mask_resized = image::imageops::resize(
        &mask_img,
        orig_w,
        orig_h,
        image::imageops::FilterType::Lanczos3,
    );

    let result: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_fn(orig_w, orig_h, |x, y| {
            let p = rgba.get_pixel(x, y);
            let alpha = mask_resized.get_pixel(x, y)[0];
            Rgba([p[0], p[1], p[2], alpha])
        });

    DynamicImage::ImageRgba8(result)
}

#[tauri::command]
pub async fn remove_background_bria(
    app: AppHandle,
    image_data: String,
) -> Result<String, String> {
    let path = model_path(&app)?;

    if !path.exists() {
        return Err("BRIA model not found. Download it in Settings → Processing.".to_string());
    }

    let base64_data = if let Some(idx) = image_data.find(',') {
        &image_data[idx + 1..]
    } else {
        &image_data
    };

    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())?;

    let img = image::load_from_memory(&image_bytes).map_err(|e| e.to_string())?;

    let result = tokio::task::spawn_blocking(move || -> Result<DynamicImage, String> {
        let mut session = Session::builder()
            .map_err(|e| e.to_string())?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| e.to_string())?
            .commit_from_file(&path)
            .map_err(|e| e.to_string())?;

        let input_name = session.inputs()[0].name().to_string();
        let n = INPUT_SIZE;
        let data = preprocess(&img);

        // (shape, Vec<f32>) form implements OwnedTensorArrayData
        let tensor = Tensor::<f32>::from_array(([1usize, 3, n, n], data))
            .map_err(|e| e.to_string())?;

        let outputs = session
            .run(ort::inputs![input_name => tensor])
            .map_err(|e| e.to_string())?;

        // try_extract_tensor returns (&Shape, &[T])
        let (_, mask_data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;

        Ok(apply_mask(&img, mask_data))
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut png_bytes = Vec::new();
    result
        .write_to(
            &mut std::io::Cursor::new(&mut png_bytes),
            image::ImageFormat::Png,
        )
        .map_err(|e| e.to_string())?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Ok(format!("data:image/png;base64,{b64}"))
}

// ── RMBG-2.0 ─────────────────────────────────────────────────────────────────

/// Resize to INPUT_SIZE×INPUT_SIZE and return flat NCHW f32 data with
/// ImageNet normalization (mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]).
fn preprocess_v2(img: &DynamicImage) -> Vec<f32> {
    let rgb = img.to_rgb8();
    let resized = image::imageops::resize(
        &rgb,
        INPUT_SIZE as u32,
        INPUT_SIZE as u32,
        image::imageops::FilterType::Lanczos3,
    );

    const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
    const STD: [f32; 3] = [0.229, 0.224, 0.225];

    let n = INPUT_SIZE;
    let mut data = vec![0.0f32; 3 * n * n];
    for (x, y, pixel) in resized.enumerate_pixels() {
        let xi = x as usize;
        let yi = y as usize;
        for c in 0..3 {
            data[c * n * n + yi * n + xi] =
                (pixel[c] as f32 / 255.0 - MEAN[c]) / STD[c];
        }
    }
    data
}

#[tauri::command]
pub async fn bria_v2_model_status(app: AppHandle) -> Result<BriaModelStatus, String> {
    let path = model_v2_path(&app)?;
    let exists = path.exists();
    let size_bytes = if exists {
        std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    Ok(BriaModelStatus {
        exists,
        path: path.to_string_lossy().to_string(),
        size_bytes,
    })
}

#[tauri::command]
pub async fn download_bria_v2_model(
    app: AppHandle,
    hf_token: Option<String>,
) -> Result<(), String> {
    let path = model_v2_path(&app)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::new();
    let mut request = client.get(BRIA_V2_MODEL_URL);
    if let Some(token) = hf_token {
        if !token.is_empty() {
            request = request.header("Authorization", format!("Bearer {}", token));
        }
    }
    let response = request.send().await.map_err(|e| e.to_string())?;

    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED
        || status == reqwest::StatusCode::FORBIDDEN
    {
        return Err(
            "Access denied (401/403). RMBG-2.0 is a gated model — agree to the license on HuggingFace and enter your HF token in Settings → Processing."
                .to_string(),
        );
    }
    if !status.is_success() {
        return Err(format!("Download failed: HTTP {}", status));
    }

    let total = response.content_length().unwrap_or(0);
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    let mut downloaded = 0u64;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let _ = app.emit(
            "bria-v2-download-progress",
            DownloadProgress { downloaded, total },
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn remove_background_bria_v2(
    app: AppHandle,
    image_data: String,
) -> Result<String, String> {
    let path = model_v2_path(&app)?;

    if !path.exists() {
        return Err(
            "BRIA RMBG-2.0 model not found. Download it in Settings → Processing.".to_string(),
        );
    }

    let base64_data = if let Some(idx) = image_data.find(',') {
        &image_data[idx + 1..]
    } else {
        &image_data
    };

    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| e.to_string())?;

    let img = image::load_from_memory(&image_bytes).map_err(|e| e.to_string())?;

    let result = tokio::task::spawn_blocking(move || -> Result<DynamicImage, String> {
        let mut session = Session::builder()
            .map_err(|e| e.to_string())?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| e.to_string())?
            .commit_from_file(&path)
            .map_err(|e| e.to_string())?;

        let input_name = session.inputs()[0].name().to_string();
        let n = INPUT_SIZE;
        let data = preprocess_v2(&img);

        let tensor = Tensor::<f32>::from_array(([1usize, 3, n, n], data))
            .map_err(|e| e.to_string())?;

        let outputs = session
            .run(ort::inputs![input_name => tensor])
            .map_err(|e| e.to_string())?;

        let (_, mask_data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;

        Ok(apply_mask(&img, mask_data))
    })
    .await
    .map_err(|e| e.to_string())??;

    let mut png_bytes = Vec::new();
    result
        .write_to(
            &mut std::io::Cursor::new(&mut png_bytes),
            image::ImageFormat::Png,
        )
        .map_err(|e| e.to_string())?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
    Ok(format!("data:image/png;base64,{b64}"))
}
