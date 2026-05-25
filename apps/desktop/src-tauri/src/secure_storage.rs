use crate::security::*;
/// Secure Storage Module
///
/// Provides encrypted storage utilities for sensitive data like API keys and tokens.
/// Uses AES-256-GCM encryption with SHA-256 key derivation.
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fmt;
use std::fs;
use std::path::PathBuf;

/// Custom error type for secure storage operations
#[derive(Debug)]
pub enum SecureStorageError {
    EncryptionFailed(String),
    DecryptionFailed(String),
    InvalidFormat(String),
    IoError(std::io::Error),
    SystemInfoError(String),
}

impl fmt::Display for SecureStorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SecureStorageError::EncryptionFailed(msg) => write!(f, "Encryption failed: {}", msg),
            SecureStorageError::DecryptionFailed(msg) => write!(f, "Decryption failed: {}", msg),
            SecureStorageError::InvalidFormat(msg) => write!(f, "Invalid format: {}", msg),
            SecureStorageError::IoError(err) => write!(f, "IO error: {}", err),
            SecureStorageError::SystemInfoError(msg) => write!(f, "System info error: {}", msg),
        }
    }
}

impl Error for SecureStorageError {}

impl From<std::io::Error> for SecureStorageError {
    fn from(err: std::io::Error) -> Self {
        SecureStorageError::IoError(err)
    }
}

/// Result type for secure storage operations
pub type SecureStorageResult<T> = Result<T, SecureStorageError>;

/// Structure representing encrypted data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    /// Base64 encoded ciphertext
    pub ciphertext: String,
    /// Base64 encoded nonce
    pub nonce: String,
    /// Version of the encryption format
    pub version: u8,
}

/// Secure storage manager
pub struct SecureStorageManager {
    /// Master key for encryption
    master_key: Key<Aes256Gcm>,
    /// Storage directory
    storage_dir: PathBuf,
}

impl SecureStorageManager {
    /// Initialize secure storage with a persistent random master key.
    pub fn new(_app_name: &str, app_data_dir: &PathBuf) -> SecureStorageResult<Self> {
        let storage_dir = app_data_dir.join("secure_storage");
        if let Err(e) = fs::create_dir_all(&storage_dir) {
            return Err(SecureStorageError::IoError(e));
        }

        let master_key = Self::load_or_create_master_key(&storage_dir)?;

        Ok(Self {
            master_key,
            storage_dir,
        })
    }

    /// Load the persisted master key, or generate and save a new one on first run.
    ///
    /// Using a randomly-generated key stored on disk is stable across restarts and
    /// avoids the previous approach of deriving the key from system info (computer
    /// name, hostname) which could fail silently in sandboxed builds and produce a
    /// different key between runs, causing all stored secrets to be silently wiped.
    fn load_or_create_master_key(storage_dir: &PathBuf) -> SecureStorageResult<Key<Aes256Gcm>> {
        let key_file = storage_dir.join(".mk");

        if key_file.exists() {
            let key_bytes = fs::read(&key_file)?;
            if key_bytes.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&key_bytes);
                #[allow(deprecated)]
                return Ok(*Key::<Aes256Gcm>::from_slice(&arr));
            }
            // File is corrupt — fall through to regenerate
        }

        let mut key_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut key_bytes);
        fs::write(&key_file, &key_bytes)?;

        #[allow(deprecated)]
        Ok(*Key::<Aes256Gcm>::from_slice(&key_bytes))
    }

    /// Encrypt sensitive data
    ///
    /// # Arguments
    /// * `data` - Data to encrypt
    ///
    /// # Returns
    /// * `Ok(EncryptedData)` if encryption succeeds
    /// * `Err(SecureStorageError)` if encryption fails
    pub fn encrypt(&self, data: &str) -> SecureStorageResult<EncryptedData> {
        let cipher = Aes256Gcm::new(&self.master_key);
        let nonce_bytes = Self::generate_nonce();

        let ciphertext = cipher
            .encrypt(nonce_bytes.as_slice().into(), data.as_bytes())
            .map_err(|e| {
                SecureStorageError::EncryptionFailed(format!("Encryption failed: {}", e))
            })?;

        Ok(EncryptedData {
            ciphertext: general_purpose::STANDARD.encode(&ciphertext),
            nonce: general_purpose::STANDARD.encode(nonce_bytes.as_slice()),
            version: 1,
        })
    }

    /// Decrypt sensitive data
    ///
    /// # Arguments
    /// * `encrypted_data` - Data to decrypt
    ///
    /// # Returns
    /// * `Ok(String)` if decryption succeeds
    /// * `Err(SecureStorageError)` if decryption fails
    pub fn decrypt(&self, encrypted_data: &EncryptedData) -> SecureStorageResult<String> {
        let cipher = Aes256Gcm::new(&self.master_key);

        let ciphertext = general_purpose::STANDARD
            .decode(&encrypted_data.ciphertext)
            .map_err(|e| {
                SecureStorageError::DecryptionFailed(format!("Invalid base64 in ciphertext: {}", e))
            })?;

        let nonce_bytes = general_purpose::STANDARD
            .decode(&encrypted_data.nonce)
            .map_err(|e| {
                SecureStorageError::DecryptionFailed(format!("Invalid base64 in nonce: {}", e))
            })?;

        #[allow(deprecated)]
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = cipher.decrypt(&nonce, ciphertext.as_slice()).map_err(|e| {
            SecureStorageError::DecryptionFailed(format!("Decryption failed: {}", e))
        })?;

        String::from_utf8(plaintext).map_err(|e| {
            SecureStorageError::DecryptionFailed(format!("Invalid UTF-8 in decrypted data: {}", e))
        })
    }

    /// Store encrypted data to a file
    ///
    /// # Arguments
    /// * `key` - Storage key
    /// * `data` - Data to encrypt and store
    ///
    /// # Returns
    /// * `Ok(())` if storage succeeds
    /// * `Err(SecureStorageError)` if storage fails
    pub fn store(&self, key: &str, data: &str) -> SecureStorageResult<()> {
        // Validate key
        if key.is_empty() || key.len() > 255 {
            return Err(SecureStorageError::InvalidFormat(
                "Invalid storage key".to_string(),
            ));
        }

        // Encrypt data
        let encrypted = self.encrypt(data)?;

        // Serialize to JSON
        let json = serde_json::to_string(&encrypted).map_err(|e| {
            SecureStorageError::EncryptionFailed(format!("JSON serialization failed: {}", e))
        })?;

        // Write to file
        let file_path = self.storage_dir.join(format!("{}.enc", key));
        fs::write(&file_path, json)?;

        Ok(())
    }

    /// Retrieve and decrypt data from storage
    ///
    /// # Arguments
    /// * `key` - Storage key
    ///
    /// # Returns
    /// * `Ok(Option<String>)` with decrypted data or None if not found
    /// * `Err(SecureStorageError)` if retrieval fails
    pub fn retrieve(&self, key: &str) -> SecureStorageResult<Option<String>> {
        // Validate key
        if key.is_empty() || key.len() > 255 {
            return Err(SecureStorageError::InvalidFormat(
                "Invalid storage key".to_string(),
            ));
        }

        let file_path = self.storage_dir.join(format!("{}.enc", key));

        // Check if file exists
        if !file_path.exists() {
            return Ok(None);
        }

        // Read file
        let json = fs::read_to_string(&file_path)?;

        // Deserialize
        let encrypted: EncryptedData = serde_json::from_str(&json).map_err(|e| {
            SecureStorageError::InvalidFormat(format!("JSON deserialization failed: {}", e))
        })?;

        // Decrypt — if decryption fails the stored data is unreadable (e.g. key
        // rotated after reinstall), so delete the corrupted file and return None.
        let decrypted = match self.decrypt(&encrypted) {
            Ok(v) => v,
            Err(SecureStorageError::DecryptionFailed(_)) => {
                let _ = fs::remove_file(&file_path);
                return Ok(None);
            }
            Err(e) => return Err(e),
        };

        Ok(Some(decrypted))
    }

    /// Remove encrypted data from storage
    ///
    /// # Arguments
    /// * `key` - Storage key
    ///
    /// # Returns
    /// * `Ok(bool)` indicating whether data was removed
    /// * `Err(SecureStorageError)` if removal fails
    pub fn remove(&self, key: &str) -> SecureStorageResult<bool> {
        // Validate key
        if key.is_empty() || key.len() > 255 {
            return Err(SecureStorageError::InvalidFormat(
                "Invalid storage key".to_string(),
            ));
        }

        let file_path = self.storage_dir.join(format!("{}.enc", key));

        if file_path.exists() {
            fs::remove_file(&file_path)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Check if a key exists in storage
    ///
    /// # Arguments
    /// * `key` - Storage key
    ///
    /// # Returns
    /// * `Ok(bool)` indicating whether the key exists
    /// * `Err(SecureStorageError)` if check fails
    pub fn exists(&self, key: &str) -> SecureStorageResult<bool> {
        // Validate key
        if key.is_empty() || key.len() > 255 {
            return Err(SecureStorageError::InvalidFormat(
                "Invalid storage key".to_string(),
            ));
        }

        let file_path = self.storage_dir.join(format!("{}.enc", key));
        Ok(file_path.exists())
    }

    /// Generate a cryptographically secure nonce
    fn generate_nonce() -> [u8; 12] {
        let mut nonce = [0u8; 12];
        OsRng.fill_bytes(&mut nonce);
        nonce
    }

    /// List all stored keys
    ///
    /// # Returns
    /// * `Ok(Vec<String>)` with list of keys
    /// * `Err(SecureStorageError)` if listing fails
    pub fn list_keys(&self) -> SecureStorageResult<Vec<String>> {
        let mut keys = Vec::new();

        if let Ok(entries) = fs::read_dir(&self.storage_dir) {
            for entry in entries.flatten() {
                if let Some(file_name) = entry.file_name().to_str() {
                    if file_name.ends_with(".enc") {
                        if let Some(key) = file_name.strip_suffix(".enc") {
                            keys.push(key.to_string());
                        }
                    }
                }
            }
        }

        Ok(keys)
    }

    /// Clear all stored data
    ///
    /// # Returns
    /// * `Ok(())` if clearing succeeds
    /// * `Err(SecureStorageError)` if clearing fails
    pub fn clear_all(&self) -> SecureStorageResult<()> {
        if self.storage_dir.exists() {
            fs::remove_dir_all(&self.storage_dir)?;
            fs::create_dir_all(&self.storage_dir)?;
        }
        Ok(())
    }
}

/// Global secure storage instance (using OnceCell for thread safety)
static SECURE_STORAGE: once_cell::sync::OnceCell<SecureStorageManager> =
    once_cell::sync::OnceCell::new();

/// Initialize the global secure storage
///
/// # Arguments
/// * `app_name` - Application name
/// * `app_data_dir` - Application data directory
///
/// # Returns
/// * `Ok(())` if initialization succeeds
/// * `Err(SecureStorageError)` if initialization fails
pub fn init_secure_storage(app_name: &str, app_data_dir: &PathBuf) -> SecureStorageResult<()> {
    let manager = SecureStorageManager::new(app_name, app_data_dir)?;
    SECURE_STORAGE.set(manager).map_err(|_| {
        SecureStorageError::SystemInfoError("Secure storage already initialized".to_string())
    })
}

/// Get the global secure storage instance
///
/// # Returns
/// * `Some(&SecureStorageManager)` if initialized
/// * `None` if not initialized
pub fn get_secure_storage() -> Option<&'static SecureStorageManager> {
    SECURE_STORAGE.get()
}

// Tauri commands for frontend integration

#[tauri::command]
pub async fn secure_storage_store(
    _app_handle: tauri::AppHandle,
    key: String,
    value: String,
) -> Result<(), String> {
    // SECURITY: Validate input parameters
    crate::security::validate_user_input(&key, "storage key", 255)
        .map_err(|e| format!("Invalid storage key: {}", e))?;

    crate::security::validate_user_input(&value, "storage value", MAX_STORAGE_VALUE_LENGTH)
        .map_err(|e| format!("Invalid storage value: {}", e))?;

    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    storage.store(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn secure_storage_retrieve(
    _app_handle: tauri::AppHandle,
    key: String,
) -> Result<Option<String>, String> {
    // SECURITY: Validate input parameters
    crate::security::validate_user_input(&key, "storage key", 255)
        .map_err(|e| format!("Invalid storage key: {}", e))?;

    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    storage.retrieve(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn secure_storage_remove_encrypted(
    _app_handle: tauri::AppHandle,
    key: String,
) -> Result<bool, String> {
    // SECURITY: Validate input parameters
    crate::security::validate_user_input(&key, "storage key", 255)
        .map_err(|e| format!("Invalid storage key: {}", e))?;

    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    storage.remove(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn secure_storage_exists(
    _app_handle: tauri::AppHandle,
    key: String,
) -> Result<bool, String> {
    // SECURITY: Validate input parameters
    crate::security::validate_user_input(&key, "storage key", 255)
        .map_err(|e| format!("Invalid storage key: {}", e))?;

    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    storage.exists(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn secure_storage_store_batch(
    _app_handle: tauri::AppHandle,
    items: Vec<(String, String)>,
) -> Result<(), String> {
    // SECURITY: Validate batch size
    if items.len() > 100 {
        return Err("Batch too large (max 100 items)".to_string());
    }

    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    for (key, value) in items {
        // SECURITY: Validate each item
        crate::security::validate_user_input(&key, "storage key", 255)
            .map_err(|e| format!("Invalid storage key '{}': {}", key, e))?;

        crate::security::validate_user_input(&value, "storage value", MAX_STORAGE_VALUE_LENGTH)
            .map_err(|e| format!("Invalid storage value for key '{}': {}", key, e))?;

        storage
            .store(&key, &value)
            .map_err(|e| format!("Failed to store key '{}': {}", key, e.to_string()))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn secure_storage_retrieve_batch(
    _app_handle: tauri::AppHandle,
    keys: Vec<String>,
) -> Result<std::collections::HashMap<String, Option<String>>, String> {
    // SECURITY: Validate batch size
    if keys.len() > 100 {
        return Err("Batch too large (max 100 items)".to_string());
    }

    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    let mut results = std::collections::HashMap::new();

    for key in keys {
        // SECURITY: Validate each key
        crate::security::validate_user_input(&key, "storage key", 255)
            .map_err(|e| format!("Invalid storage key '{}': {}", key, e))?;

        let value = storage
            .retrieve(&key)
            .map_err(|e| format!("Failed to retrieve key '{}': {}", key, e.to_string()))?;

        results.insert(key, value);
    }

    Ok(results)
}

#[tauri::command]
pub async fn secure_storage_list_keys(
    _app_handle: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    storage.list_keys().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn secure_storage_clear_all(_app_handle: tauri::AppHandle) -> Result<(), String> {
    // Ensure secure storage is initialized
    let storage = get_secure_storage().ok_or("Secure storage not initialized")?;

    storage.clear_all().map_err(|e| e.to_string())
}
