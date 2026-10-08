pub fn migrate_app_data_to(new_data_dir: &std::path::Path) -> Result<bool, String> {
    std::fs::create_dir_all(new_data_dir).map_err(|error| error.to_string())?;
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

    // Secret migration must complete before a new vault key can be generated.
    let old_secrets = old_data_dir.join("secure_storage");
    if old_secrets.exists() {
        copy_secrets(&old_secrets, &new_data_dir.join("secure_storage"))?;
    }
    copy_dir_best_effort(&old_data_dir, &new_data_dir);
    std::fs::write(&marker, b"").map_err(|error| error.to_string())?;
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

fn copy_secrets(source: &std::path::Path, destination: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in std::fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
        {
            return Err("Legacy secret storage contains an unsupported entry".into());
        }
        std::fs::copy(entry.path(), destination.join(entry.file_name()))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rebrand_migrates_secrets_before_initialization_and_never_reimports_on_restart() {
        let root = tempfile::tempdir().unwrap();
        let old = root.path().join("pub.youtube.desktop");
        let new = root.path().join("backstage.desktop");
        std::fs::create_dir_all(old.join("secure_storage")).unwrap();
        std::fs::write(old.join("secure_storage/.mk"), [7; 32]).unwrap();
        std::fs::write(old.join("secure_storage/token.enc"), b"original ciphertext").unwrap();
        assert!(migrate_app_data_to(&new).unwrap());
        assert_eq!(
            std::fs::read(new.join("secure_storage/.mk")).unwrap(),
            vec![7; 32]
        );
        assert_eq!(
            std::fs::read(new.join("secure_storage/token.enc")).unwrap(),
            b"original ciphertext"
        );
        // Vault migration removes this legacy key; the next launch cannot reimport it.
        std::fs::remove_file(new.join("secure_storage/.mk")).unwrap();
        std::fs::write(new.join("secure_storage/token.enc"), b"updated ciphertext").unwrap();
        assert!(!migrate_app_data_to(&new).unwrap());
        assert!(!new.join("secure_storage/.mk").exists());
        assert_eq!(
            std::fs::read(new.join("secure_storage/token.enc")).unwrap(),
            b"updated ciphertext"
        );
    }
}
