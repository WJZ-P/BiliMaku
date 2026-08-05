use aes_gcm::aead::{rand_core::RngCore, Aead, KeyInit, OsRng, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Requested default local session secret. This provides encrypted-at-rest
/// storage, while the application binary remains the source of the secret.
pub const DEFAULT_SESSION_SECRET: &str = "20040821";

const SCHEMA_VERSION: u8 = 1;
const ALGORITHM: &str = "AES-256-GCM";
const AAD: &[u8] = b"BiliCast:bilibili-session:v1";
const KEY_CONTEXT: &[u8] = b"BiliCast::account-cookie::aes-256-gcm::";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedPayload {
    pub schema_version: u8,
    pub algorithm: String,
    pub nonce: String,
    pub ciphertext: String,
}

fn derived_key() -> [u8; 32] {
    let mut digest = Sha256::new();
    digest.update(KEY_CONTEXT);
    digest.update(DEFAULT_SESSION_SECRET.as_bytes());
    digest.finalize().into()
}

pub fn encrypt(plaintext: &[u8]) -> Result<EncryptedPayload, String> {
    let cipher = Aes256Gcm::new_from_slice(&derived_key())
        .map_err(|error| format!("初始化 AES 会话加密器失败：{error}"))?;
    let mut nonce_bytes = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: plaintext,
                aad: AAD,
            },
        )
        .map_err(|error| format!("加密账号会话失败：{error}"))?;
    Ok(EncryptedPayload {
        schema_version: SCHEMA_VERSION,
        algorithm: ALGORITHM.to_string(),
        nonce: STANDARD.encode(nonce_bytes),
        ciphertext: STANDARD.encode(ciphertext),
    })
}

pub fn decrypt(payload: &EncryptedPayload) -> Result<Vec<u8>, String> {
    if payload.schema_version != SCHEMA_VERSION || payload.algorithm != ALGORITHM {
        return Err(format!(
            "账号会话加密格式不匹配：schemaVersion={}, algorithm={}",
            payload.schema_version, payload.algorithm
        ));
    }
    let nonce = STANDARD
        .decode(&payload.nonce)
        .map_err(|error| format!("解析账号会话 nonce 失败：{error}"))?;
    if nonce.len() != 12 {
        return Err("账号会话 nonce 长度错误".to_string());
    }
    let ciphertext = STANDARD
        .decode(&payload.ciphertext)
        .map_err(|error| format!("解析账号会话密文失败：{error}"))?;
    let cipher = Aes256Gcm::new_from_slice(&derived_key())
        .map_err(|error| format!("初始化 AES 会话解密器失败：{error}"))?;
    cipher
        .decrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: &ciphertext,
                aad: AAD,
            },
        )
        .map_err(|_| "账号会话密文校验失败".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aes_gcm_round_trip_preserves_cookie_payload() {
        let plaintext = br#"{"cookieHeader":"SESSDATA=test; bili_jct=csrf"}"#;
        let encrypted = encrypt(plaintext).expect("encrypt session");
        assert_eq!(encrypted.algorithm, "AES-256-GCM");
        assert!(!encrypted.ciphertext.contains("SESSDATA"));
        assert_eq!(decrypt(&encrypted).expect("decrypt session"), plaintext);
    }

    #[test]
    fn aes_gcm_rejects_tampered_ciphertext() {
        let mut encrypted = encrypt(b"cookie=value").expect("encrypt session");
        encrypted.ciphertext.push('A');
        assert!(decrypt(&encrypted).is_err());
    }
}
