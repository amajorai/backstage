use rand::{rngs::OsRng, RngCore};
use sha2::{Digest, Sha256};
use std::{fs, path::Path};

pub(crate) fn master_key(app_name: &str, directory: &Path) -> Result<Vec<u8>, String> {
    let identity = format!(
        "{:x}",
        Sha256::digest(directory.to_string_lossy().as_bytes())
    );
    let entry = keyring::Entry::new(app_name, &format!("encryption-key-{identity}"))
        .map_err(|e| e.to_string())?;
    load_key(
        directory,
        || match entry.get_secret() {
            Ok(bytes) => Ok(Some(bytes)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        },
        |bytes| entry.set_secret(bytes).map_err(|e| e.to_string()),
    )
}

fn load_key(
    directory: &Path,
    read: impl Fn() -> Result<Option<Vec<u8>>, String>,
    write: impl Fn(&[u8]) -> Result<(), String>,
) -> Result<Vec<u8>, String> {
    let legacy_path = directory.join(".mk");
    let legacy = match fs::read(&legacy_path) {
        Ok(bytes) if bytes.len() == 32 => Some(bytes),
        Ok(_) => return Err("Legacy encryption key is corrupt; secrets were retained".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.to_string()),
    };
    let bytes = match read()? {
        Some(bytes) => {
            if legacy.as_ref().is_some_and(|legacy| legacy != &bytes) {
                return Err("Stored encryption keys disagree; secrets were retained".into());
            }
            bytes
        }
        None => {
            let bytes = if let Some(bytes) = legacy.as_ref() {
                bytes.clone()
            } else {
                for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
                    let entry = entry.map_err(|e| e.to_string())?;
                    if entry
                        .path()
                        .extension()
                        .is_some_and(|extension| extension == "enc")
                    {
                        return Err(
                            "Encryption key is unavailable; existing secrets were retained".into(),
                        );
                    }
                }
                let mut bytes = vec![0u8; 32];
                OsRng.fill_bytes(&mut bytes);
                bytes
            };
            write(&bytes)?;
            if read()?.as_ref() != Some(&bytes) {
                return Err("Encryption key migration could not be verified".into());
            }
            bytes
        }
    };
    if bytes.len() != 32 {
        return Err("Encryption key has invalid length".into());
    }
    if legacy.is_some() {
        fs::remove_file(legacy_path).map_err(|e| e.to_string())?;
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    #[test]
    fn legacy_key_is_removed_only_after_verified_migration_and_restart_uses_same_key() {
        let root = tempfile::tempdir().unwrap();
        let legacy = vec![7; 32];
        fs::write(root.path().join(".mk"), &legacy).unwrap();
        fs::write(root.path().join("secret.enc"), b"ciphertext").unwrap();
        let vault = RefCell::new(None);
        let read = || Ok(vault.borrow().clone());
        let write = |bytes: &[u8]| {
            *vault.borrow_mut() = Some(bytes.to_vec());
            Ok(())
        };
        assert_eq!(load_key(root.path(), read, write).unwrap(), legacy);
        assert!(!root.path().join(".mk").exists());
        assert_eq!(load_key(root.path(), read, write).unwrap(), legacy);
        assert_eq!(
            fs::read(root.path().join("secret.enc")).unwrap(),
            b"ciphertext"
        );
    }
    #[test]
    fn unavailable_or_corrupt_keys_never_replace_or_remove_existing_secrets() {
        let root = tempfile::tempdir().unwrap();
        fs::write(root.path().join("secret.enc"), b"ciphertext").unwrap();
        assert!(load_key(
            root.path(),
            || Ok(None),
            |_| panic!("must not generate a key")
        )
        .is_err());
        fs::write(root.path().join(".mk"), [7; 32]).unwrap();
        assert!(load_key(root.path(), || Err("vault unavailable".into()), |_| Ok(())).is_err());
        assert!(root.path().join(".mk").exists());
        assert!(load_key(root.path(), || Ok(None), |_| Err("write failed".into())).is_err());
        fs::write(root.path().join(".mk"), b"invalid").unwrap();
        assert!(load_key(root.path(), || Ok(None), |_| Ok(())).is_err());
        assert_eq!(
            fs::read(root.path().join("secret.enc")).unwrap(),
            b"ciphertext"
        );
    }
}
