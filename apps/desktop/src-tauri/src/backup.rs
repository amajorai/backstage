use std::collections::HashSet;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};

const MAX_ARCHIVE: u64 = 512 * 1024 * 1024;
const MAX_ENTRY: u64 = 256 * 1024 * 1024;
const MAX_TOTAL: u64 = 2 * 1024 * 1024 * 1024;
const MAX_MANIFEST: u64 = 64 * 1024;
const FILES: &[&str] = &[
    "gallery.db",
    "embeddings.db",
    "embeddings.db-wal",
    "embeddings.db-shm",
    "settings.json",
    "license.json",
    "manifest.json",
];
const DIRS: &[&str] = &[
    "thumbnails",
    "trash",
    "revisions",
    "recovery",
    "ai-projects",
];

fn safe_name(name: &str) -> Result<PathBuf, String> {
    if name.is_empty()
        || name.len() > 1024
        || name.contains(['\\', ':'])
        || name.chars().any(char::is_control)
    {
        return Err("Invalid backup filename".into());
    }
    let path = Path::new(name);
    for segment in name.split('/') {
        let stem = segment.split('.').next().unwrap_or_default().to_ascii_uppercase();
        if segment.ends_with(['.', ' ']) || ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str()) || (stem.len() == 4 && (stem.starts_with("COM") || stem.starts_with("LPT")) && stem.as_bytes()[3].is_ascii_digit()) {
            return Err("Backup contains an invalid platform filename".into());
        }
    }
    if path
        .components()
        .any(|part| !matches!(part, Component::Normal(_)))
        || name
            .split('/')
            .any(|part| part == "." || part == ".." || part.is_empty())
    {
        return Err("Backup paths must stay within application data".into());
    }
    let first = name.split('/').next().unwrap_or_default();
    if !(FILES.contains(&name) || DIRS.contains(&first)) {
        return Err("Backup contains unsupported application data".into());
    }
    Ok(path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn archive(root: &Path, entries: &[(&str, &[u8])]) -> PathBuf {
        let path = root.join("backup.zip");
        let mut zip = zip::ZipWriter::new(std::fs::File::create(&path).unwrap());
        for (name, bytes) in entries {
            zip.start_file(*name, zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated)).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap();
        path
    }
    #[test]
    fn invalid_later_entries_cannot_overwrite_existing_application_data() {
        for name in ["../outside", "/tmp/outside", "thumbnails/../../outside", "thumbnails\\outside", "thumbnails/C:outside", "secure_storage/key", "thumbnails/CON"] {
            let root = tempfile::tempdir().unwrap();
            let data = root.path().join("data");
            std::fs::create_dir(&data).unwrap();
            std::fs::write(data.join("settings.json"), b"existing").unwrap();
            let zip = archive(root.path(), &[("settings.json", b"{}"), (name, b"untrusted")]);
            assert!(restore(&zip, &data, |_, _, _| {}).is_err(), "{name}");
            assert_eq!(std::fs::read(data.join("settings.json")).unwrap(), b"existing");
        }
    }
    #[test]
    fn ordinary_legacy_backup_restores_preferences_but_requires_agent_reconfiguration() {
        let root = tempfile::tempdir().unwrap();
        let data = root.path().join("data"); std::fs::create_dir(&data).unwrap();
        let zip = archive(root.path(), &[("settings.json", br#"{"theme":"dark","acp_agents":[{"command":"attacker"}],"acp_text_gen_agent_id":"evil"}"#), ("thumbnails/ordinary.webp", b"image")]);
        assert!(inspect_manifest(&zip).unwrap().is_none());
        restore(&zip, &data, |_, _, _| {}).unwrap();
        let settings: serde_json::Value = serde_json::from_slice(&std::fs::read(data.join("settings.json")).unwrap()).unwrap();
        assert_eq!(settings["theme"], "dark");
        assert_eq!(settings["acp_agents"], serde_json::json!([]));
        assert!(settings["acp_text_gen_agent_id"].is_null());
        assert_eq!(std::fs::read(data.join("thumbnails/ordinary.webp")).unwrap(), b"image");
    }
    #[test]
    fn oversized_manifest_and_false_entry_size_are_rejected() {
        let root = tempfile::tempdir().unwrap();
        let oversized = vec![b' '; MAX_MANIFEST as usize + 1];
        let path = archive(root.path(), &[("manifest.json", &oversized)]);
        assert!(inspect_manifest(&path).is_err());
        let path = archive(root.path(), &[("thumbnails/image.webp", b"image")]);
        let mut bytes = std::fs::read(&path).unwrap();
        let offset = bytes.windows(4).position(|bytes| bytes == b"PK\x01\x02").unwrap();
        bytes[offset + 24..offset + 28].copy_from_slice(&((MAX_ENTRY + 1) as u32).to_le_bytes());
        std::fs::write(&path, bytes).unwrap();
        assert!(inspect_manifest(&path).is_err());
    }
    #[test]
    fn excessive_zip_directory_is_rejected_before_archive_indexing() {
        let root = tempfile::tempdir().unwrap(); let path = root.path().join("directory.zip");
        for (count, directory_bytes) in [(10_001u16, 0u32), (1, 16 * 1024 * 1024 + 1)] {
            let mut footer = [0u8; 22]; footer[..4].copy_from_slice(b"PK\x05\x06");
            footer[8..10].copy_from_slice(&count.to_le_bytes()); footer[10..12].copy_from_slice(&count.to_le_bytes()); footer[12..16].copy_from_slice(&directory_bytes.to_le_bytes());
            std::fs::write(&path, footer).unwrap();
            assert!(inspect_manifest(&path).unwrap_err().contains("directory exceeds budget"));
        }
    }
    #[cfg(unix)]
    #[test]
    fn destination_links_cannot_write_outside_the_application_directory() {
        let root = tempfile::tempdir().unwrap(); let data = tempfile::tempdir().unwrap(); let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), data.path().join("thumbnails")).unwrap();
        let path = archive(root.path(), &[("thumbnails/image.webp", b"untrusted")]);
        assert!(restore(&path, data.path(), |_, _, _| {}).is_err());
        assert!(!outside.path().join("image.webp").exists());
    }
}

fn open_archive(path: &Path) -> Result<zip::ZipArchive<std::fs::File>, String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() > MAX_ARCHIVE {
        return Err("Backup archive exceeds 512 MiB".into());
    }
    // Bound the central-directory index before ZipArchive allocates it.
    let length = file.metadata().map_err(|e| e.to_string())?.len();
    let tail_length = length.min(65_557) as usize;
    file.seek(SeekFrom::End(-(tail_length as i64))).map_err(|e| e.to_string())?;
    let mut tail = vec![0; tail_length];
    file.read_exact(&mut tail).map_err(|e| e.to_string())?;
    let end = tail.windows(4).rposition(|bytes| bytes == b"PK\x05\x06").ok_or("Missing ZIP directory footer")?;
    if end + 22 > tail.len() { return Err("Invalid ZIP directory footer".into()); }
    let word = |offset| u16::from_le_bytes([tail[end + offset], tail[end + offset + 1]]);
    let number = |offset| u32::from_le_bytes(tail[end + offset..end + offset + 4].try_into().unwrap()) as u64;
    if end + 22 + word(20) as usize != tail.len() || word(4) != 0 || word(6) != 0 || word(8) != word(10) || word(10) > 10_000 || number(12) > 16 * 1024 * 1024 || number(16).checked_add(number(12)).is_none_or(|end| end > length) || (end >= 20 && &tail[end - 20..end - 16] == b"PK\x06\x07") {
        return Err("Backup ZIP directory exceeds budget or uses unsupported ZIP64/spanning".into());
    }
    file.rewind().map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    if archive.len() > 10_000 {
        return Err("Backup contains too many entries".into());
    }
    let mut names = HashSet::new();
    let mut total = 0u64;
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|e| e.to_string())?;
        let name = entry.name().trim_end_matches('/');
        safe_name(name)?;
        if !names.insert(name.to_string()) {
            return Err("Duplicate backup entry".into());
        }
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err("Backup links are unsupported".into());
        }
        let limit = entry_limit(name);
        if entry.size() > limit {
            return Err("Backup entry exceeds size limit".into());
        }
        total = total
            .checked_add(entry.size())
            .ok_or("Backup size overflow")?;
        if total > MAX_TOTAL {
            return Err("Backup exceeds 2 GiB extraction limit".into());
        }
    }
    Ok(archive)
}

fn entry_limit(name: &str) -> u64 {
    match name {
        "manifest.json" => MAX_MANIFEST,
        "settings.json" | "license.json" => 1024 * 1024,
        _ => MAX_ENTRY,
    }
}

pub fn inspect_manifest(path: &Path) -> Result<Option<serde_json::Value>, String> {
    let mut archive = open_archive(path)?;
    let Ok(entry) = archive.by_name("manifest.json") else {
        return Ok(None);
    };
    let mut bytes = Vec::new();
    entry
        .take(MAX_MANIFEST + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_MANIFEST {
        return Err("Backup manifest exceeds size limit".into());
    }
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| "Backup manifest is corrupt")?;
    if !value.is_object() {
        return Err("Backup manifest must be an object".into());
    }
    Ok(Some(value))
}

fn reject_destination_links(root: &Path, relative: &Path) -> Result<(), String> {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        current.push(component.as_os_str());
        match std::fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err("Backup destination contains a link".into())
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(())
}

pub fn restore(
    path: &Path,
    destination: &Path,
    progress: impl Fn(usize, usize, &str),
) -> Result<(), String> {
    let mut archive = open_archive(path)?;
    let stage = tempfile::tempdir_in(destination).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    let mut total = 0u64;
    // Stage and validate every entry before overwriting any existing data.
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
        let name = entry.name().trim_end_matches('/').to_string();
        let relative = safe_name(&name)?;
        reject_destination_links(destination, &relative)?;
        if entry.is_dir() {
            continue;
        }
        let limit = entry_limit(&name);
        let temporary = index.to_string();
        let mut file =
            std::fs::File::create(stage.path().join(&temporary)).map_err(|e| e.to_string())?;
        let declared = entry.size();
        let actual = std::io::copy(&mut (&mut entry).take(limit + 1), &mut file)
            .map_err(|e| e.to_string())?;
        total = total.checked_add(actual).ok_or("Backup size overflow")?;
        if actual > limit || actual != declared || total > MAX_TOTAL {
            return Err("Backup exceeds actual extraction budget".into());
        }
        if name == "manifest.json" {
            let value: serde_json::Value = serde_json::from_reader(
                std::fs::File::open(stage.path().join(&temporary)).map_err(|e| e.to_string())?,
            )
            .map_err(|_| "Backup manifest is corrupt")?;
            if !value.is_object() {
                return Err("Backup manifest must be an object".into());
            }
            continue;
        }
        if name == "settings.json" {
            let mut settings: serde_json::Value = serde_json::from_reader(
                std::fs::File::open(stage.path().join(&temporary)).map_err(|e| e.to_string())?,
            )
            .map_err(|_| "Backup settings are corrupt")?;
            let object = settings
                .as_object_mut()
                .ok_or("Backup settings must be an object")?;
            object.insert("acp_agents".into(), serde_json::json!([]));
            object.insert("acp_text_gen_agent_id".into(), serde_json::Value::Null);
            drop(file);
            file =
                std::fs::File::create(stage.path().join(&temporary)).map_err(|e| e.to_string())?;
            serde_json::to_writer(&mut file, &settings).map_err(|e| e.to_string())?;
            file.flush().map_err(|e| e.to_string())?;
        }
        file.sync_all().map_err(|e| e.to_string())?;
        if name.ends_with(".db-shm") || name.ends_with(".db-wal") || name == "embeddings.db" {
            continue;
        }
        files.push((relative, temporary));
    }
    let root = cap_std::fs::Dir::open_ambient_dir(destination, cap_std::ambient_authority())
        .map_err(|e| e.to_string())?;
    let staged = cap_std::fs::Dir::open_ambient_dir(stage.path(), cap_std::ambient_authority())
        .map_err(|e| e.to_string())?;
    for (index, (relative, temporary)) in files.iter().enumerate() {
        reject_destination_links(destination, relative)?;
        let parent = relative.parent().filter(|p| !p.as_os_str().is_empty());
        let output = if let Some(parent) = parent {
            root.create_dir_all(parent).map_err(|e| e.to_string())?;
            root.open_dir(parent).map_err(|e| e.to_string())?
        } else {
            root.try_clone().map_err(|e| e.to_string())?
        };
        staged
            .rename(
                temporary,
                &output,
                relative.file_name().ok_or("Missing backup filename")?,
            )
            .map_err(|e| e.to_string())?;
        progress(index + 1, files.len(), &relative.to_string_lossy());
    }
    for name in ["gallery.db-wal", "gallery.db-shm"] {
        match root.remove_file(name) {
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(())
}
