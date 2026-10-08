//! Release-pinned archives and installed executable/model bytes.
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, io::Read, path::Path};

#[derive(Deserialize)]
pub struct Asset {
    pub sha256: String,
    pub bytes: u64,
}
#[derive(Deserialize)]
pub struct Manifest {
    pub archive: String,
    pub files: BTreeMap<String, Asset>,
}

pub fn manifest(platform: &str) -> Result<Manifest, String> {
    let mut manifests: BTreeMap<String, Manifest> =
        serde_json::from_str(include_str!("upscaler-integrity.json"))
            .map_err(|error| error.to_string())?;
    manifests
        .remove(platform)
        .ok_or_else(|| "Unsupported upscaler platform".into())
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub fn verify_installation(directory: &Path, expected: &Manifest) -> Result<bool, String> {
    if !directory.exists() {
        return Ok(false);
    }
    fn visit(
        root: &Path,
        relative: &Path,
        expected: &Manifest,
        seen: &mut usize,
    ) -> Result<bool, String> {
        let path = root.join(relative);
        let metadata = fs::symlink_metadata(&path).map_err(|error| error.to_string())?;
        if metadata.file_type().is_symlink() {
            return Ok(false);
        }
        if metadata.is_dir() {
            for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
                if !visit(
                    root,
                    &relative.join(entry.map_err(|error| error.to_string())?.file_name()),
                    expected,
                    seen,
                )? {
                    return Ok(false);
                }
            }
            return Ok(true);
        }
        let name = relative.to_string_lossy().replace('\\', "/");
        let Some(asset) = expected.files.get(&name) else {
            return Ok(false);
        };
        if !metadata.is_file() || metadata.len() != asset.bytes {
            return Ok(false);
        }
        let bytes = fs::read(root.join(relative)).map_err(|error| error.to_string())?;
        *seen += 1;
        Ok(digest(&bytes) == asset.sha256)
    }
    let mut seen = 0;
    Ok(visit(directory, Path::new(""), expected, &mut seen)? && seen == expected.files.len())
}

pub fn install(bytes: &[u8], directory: &Path, expected: &Manifest) -> Result<(), String> {
    if bytes.len() > 64 * 1024 * 1024 || digest(bytes) != expected.archive {
        return Err("Upscaler archive integrity check failed".into());
    }
    let parent = directory
        .parent()
        .ok_or("Upscaler directory has no parent")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let staging = tempfile::tempdir_in(parent).map_err(|error| error.to_string())?;
    let mut archive =
        zip::ZipArchive::new(std::io::Cursor::new(bytes)).map_err(|error| error.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name();
        let base = name.rsplit('/').next().ok_or("Invalid release entry")?;
        let target = if name.contains("/models/") || name.starts_with("models/") {
            format!("models/{base}")
        } else {
            base.to_owned()
        };
        let Some(asset) = expected.files.get(&target) else {
            continue;
        };
        if entry.size() != asset.bytes {
            return Err("Release asset size mismatch".into());
        }
        let mut content = Vec::new();
        entry
            .by_ref()
            .take(asset.bytes + 1)
            .read_to_end(&mut content)
            .map_err(|error| error.to_string())?;
        if content.len() as u64 != asset.bytes || digest(&content) != asset.sha256 {
            return Err("Release asset integrity mismatch".into());
        }
        let path = staging.path().join(&target);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(&path, &content).map_err(|error| error.to_string())?;
        #[cfg(unix)]
        if !target.starts_with("models/") && !target.ends_with(".dll") {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(0o755))
                .map_err(|error| error.to_string())?;
        }
    }
    if !verify_installation(staging.path(), expected)? {
        return Err("Release installation is incomplete".into());
    }
    let backup = tempfile::tempdir_in(parent).map_err(|error| error.to_string())?;
    let previous = backup.path().join("previous");
    let existed = directory.exists();
    if existed {
        fs::rename(directory, &previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(staging.path(), directory) {
        if existed {
            let _ = fs::rename(previous, directory);
        }
        return Err(error.to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn unverified_archives_and_changed_cached_assets_are_rejected() {
        let root = tempfile::tempdir().unwrap();
        let destination = root.path().join("upscaler");
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        zip.start_file(
            "release/realesrgan-ncnn-vulkan",
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
        zip.write_all(b"trusted executable").unwrap();
        zip.start_file(
            "release/models/model.bin",
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
        zip.write_all(b"trusted model").unwrap();
        let bytes = zip.finish().unwrap().into_inner();
        let expected = Manifest {
            archive: digest(&bytes),
            files: BTreeMap::from([
                (
                    "realesrgan-ncnn-vulkan".into(),
                    Asset {
                        sha256: digest(b"trusted executable"),
                        bytes: 18,
                    },
                ),
                (
                    "models/model.bin".into(),
                    Asset {
                        sha256: digest(b"trusted model"),
                        bytes: 13,
                    },
                ),
            ]),
        };
        install(&bytes, &destination, &expected).unwrap();
        assert!(verify_installation(&destination, &expected).unwrap());
        let mut modified = bytes.clone();
        modified[0] ^= 1;
        assert!(install(&modified, &destination, &expected).is_err());
        assert!(verify_installation(&destination, &expected).unwrap());
        fs::write(
            destination.join("realesrgan-ncnn-vulkan"),
            b"hostile executable",
        )
        .unwrap();
        assert!(!verify_installation(&destination, &expected).unwrap());
        install(&bytes, &destination, &expected).unwrap();
        fs::write(destination.join("vcomp140.dll"), b"unlisted dependency").unwrap();
        assert!(!verify_installation(&destination, &expected).unwrap());
        install(&bytes, &destination, &expected).unwrap();
        assert!(verify_installation(&destination, &expected).unwrap());
    }
}
