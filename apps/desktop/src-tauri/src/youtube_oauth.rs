use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use rand::RngCore;
use sha2::Digest;
use std::time::SystemTime;
use tauri::Emitter;
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;

#[derive(serde::Serialize, Clone, Default)]
struct OAuthCompletePayload {
    success: bool,
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_at: Option<i64>,
    channel_id: Option<String>,
    channel_name: Option<String>,
    channel_thumbnail: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub async fn youtube_oauth_initiate(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: String,
) -> Result<String, String> {
    // Generate PKCE code_verifier: 64 random bytes, base64url-encoded
    let mut verifier_bytes = [0u8; 64];
    rand::thread_rng().fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);

    // code_challenge = base64url(SHA-256(code_verifier))
    let mut hasher = sha2::Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);

    // Bind on a random OS-assigned port
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind TCP listener: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {e}"))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{port}");

    let scope = "https://www.googleapis.com/auth/youtube.upload \
                 https://www.googleapis.com/auth/youtube.readonly \
                 https://www.googleapis.com/auth/yt-analytics.readonly";

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
         ?client_id={client_id}\
         &redirect_uri={redirect_uri}\
         &response_type=code\
         &scope={scope}\
         &code_challenge={code_challenge}\
         &code_challenge_method=S256\
         &access_type=offline\
         &prompt=consent",
        client_id = urlencoding_encode(&client_id),
        redirect_uri = urlencoding_encode(&redirect_uri),
        scope = urlencoding_encode(scope),
        code_challenge = urlencoding_encode(&code_challenge),
    );

    // Spawn background task to handle the OAuth callback
    tokio::spawn(async move {
        if let Err(e) = handle_oauth_callback(
            app.clone(),
            listener,
            code_verifier,
            client_id,
            client_secret,
            port,
        )
        .await
        {
            let _ = app.emit(
                "yt_oauth_complete",
                OAuthCompletePayload {
                    success: false,
                    error: Some(e),
                    ..Default::default()
                },
            );
        }
    });

    Ok(auth_url)
}

async fn handle_oauth_callback(
    app: tauri::AppHandle,
    listener: tokio::net::TcpListener,
    code_verifier: String,
    client_id: String,
    client_secret: String,
    port: u16,
) -> Result<(), String> {
    // Wait up to 5 minutes for the browser callback
    let (mut stream, _) =
        tokio::time::timeout(std::time::Duration::from_secs(300), listener.accept())
            .await
            .map_err(|_| "OAuth timed out waiting for browser callback".to_string())?
            .map_err(|e| format!("Failed to accept TCP connection: {e}"))?;

    // Read the HTTP request
    let mut buf = vec![0u8; 4096];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed to read from stream: {e}"))?;
    let request = String::from_utf8_lossy(&buf[..n]);

    // Parse: GET /?code=AUTH_CODE&... HTTP/1.1
    let code = request
        .lines()
        .next()
        .and_then(|line| {
            // line looks like: GET /?code=...&state=... HTTP/1.1
            let parts: Vec<&str> = line.splitn(3, ' ').collect();
            if parts.len() < 2 {
                return None;
            }
            let path = parts[1]; // e.g. /?code=...
            let query = path.splitn(2, '?').nth(1).unwrap_or("");
            extract_query_param(query, "code")
        })
        .ok_or_else(|| "Could not extract authorization code from callback".to_string())?;

    // Send success page to browser
    let html_body = r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Connected — Backstage</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: #09090b;
    color: #fafafa;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 16px;
    padding: 48px 56px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.5);
  }
  .icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(34,197,94,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon svg { width: 26px; height: 26px; stroke: #22c55e; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; color: #fafafa; }
  p { font-size: 14px; color: #71717a; line-height: 1.5; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">
    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
  </div>
  <div>
    <h1>Connected to Backstage!</h1>
    <p style="margin-top:6px">You can close this tab and return to the app.</p>
  </div>
</div>
</body>
</html>"#;
    let html_response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n{}",
        html_body
    );
    let _ = stream.write_all(html_response.as_bytes()).await;
    drop(stream);

    let redirect_uri = format!("http://127.0.0.1:{port}");

    // Exchange authorization code for tokens
    let client = reqwest::Client::new();
    let token_response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", code_verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {e}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse token response: {e}"))?;

    // Surface only Google's structured error fields — never the raw response,
    // which may contain a valid access_token even when another field is missing.
    let token_error = || -> String {
        let desc = token_response["error_description"]
            .as_str()
            .or_else(|| token_response["error"].as_str())
            .unwrap_or("unexpected token response shape");
        format!("Token exchange failed: {desc}")
    };

    let access_token = token_response["access_token"]
        .as_str()
        .ok_or_else(|| token_error())?
        .to_string();
    let refresh_token = token_response["refresh_token"]
        .as_str()
        .ok_or_else(|| token_error())?
        .to_string();
    let expires_in = token_response["expires_in"]
        .as_i64()
        .ok_or_else(|| token_error())?;

    let expires_at = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| format!("System time error: {e}"))?
        .as_secs() as i64
        + expires_in;

    // Fetch channel info
    let channel_response = client
        .get("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true")
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| format!("Channel info request failed: {e}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse channel response: {e}"))?;

    let item = channel_response["items"]
        .get(0)
        .ok_or_else(|| "No YouTube channel found for this account".to_string())?;

    let channel_id = item["id"]
        .as_str()
        .ok_or_else(|| "Missing channel id".to_string())?
        .to_string();
    let channel_name = item["snippet"]["title"]
        .as_str()
        .ok_or_else(|| "Missing channel title".to_string())?
        .to_string();
    let channel_thumbnail = item["snippet"]["thumbnails"]["default"]["url"]
        .as_str()
        .unwrap_or("")
        .to_string();

    app.emit(
        "yt_oauth_complete",
        OAuthCompletePayload {
            success: true,
            access_token: Some(access_token),
            refresh_token: Some(refresh_token),
            expires_at: Some(expires_at),
            channel_id: Some(channel_id),
            channel_name: Some(channel_name),
            channel_thumbnail: Some(channel_thumbnail),
            error: None,
        },
    )
    .map_err(|e| format!("Failed to emit event: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn youtube_token_refresh(
    refresh_token: String,
    client_id: String,
    client_secret: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("refresh_token", refresh_token.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {e}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse refresh response: {e}"))?;

    Ok(response)
}

#[tauri::command]
pub async fn youtube_oauth_revoke(access_token: String) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://oauth2.googleapis.com/revoke?token={token}",
        token = urlencoding_encode(&access_token)
    );
    // Ignore errors — the token may already be expired
    let _ = client.post(&url).send().await;
    Ok(())
}

/// Minimal percent-encoding for URL query parameter values.
fn urlencoding_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'~' => out.push(byte as char),
            b => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Extract a single query parameter value from a query string, percent-decoding `%3D` → `=`.
fn extract_query_param(query: &str, key: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        let k = it.next()?;
        if k == key {
            let v = it.next().unwrap_or("").replace("%3D", "=");
            return Some(v);
        }
    }
    None
}
