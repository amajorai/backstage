use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

#[tauri::command]
pub async fn acp_prompt(
    agent_command: String,
    agent_args: Vec<String>,
    env_vars: HashMap<String, String>,
    prompt_text: String,
    image_data: Option<String>,
    image_mime_type: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_acp_prompt(
            agent_command,
            agent_args,
            env_vars,
            prompt_text,
            image_data,
            image_mime_type,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

fn run_acp_prompt(
    agent_command: String,
    agent_args: Vec<String>,
    env_vars: HashMap<String, String>,
    prompt_text: String,
    image_data: Option<String>,
    image_mime_type: Option<String>,
) -> Result<String, String> {
    let mut child = Command::new(&agent_command)
        .args(&agent_args)
        .envs(&env_vars)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn agent '{}': {}", agent_command, e))?;

    let stdin = child.stdin.take().ok_or("Failed to get agent stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get agent stdout")?;

    // reader_thread → main: parsed JSON-RPC messages
    let (reader_tx, reader_rx) = mpsc::channel::<serde_json::Value>();
    // main → writer_thread: serialized JSON-RPC lines
    let (writer_tx, writer_rx) = mpsc::channel::<String>();

    let reader_thread = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(l) if !l.trim().is_empty() => {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&l) {
                        if reader_tx.send(val).is_err() {
                            break;
                        }
                    }
                }
                Err(_) => break,
                _ => {}
            }
        }
    });

    let writer_thread = thread::spawn(move || {
        let mut stdin = stdin;
        for msg in writer_rx {
            if writeln!(stdin, "{msg}").is_err() {
                break;
            }
            let _ = stdin.flush();
        }
    });

    let result = execute_acp_session(
        &reader_rx,
        &writer_tx,
        prompt_text,
        image_data,
        image_mime_type,
    );

    // Cleanup: drop writer channel (closes stdin), kill child, join threads
    drop(writer_tx);
    let _ = child.kill();
    let _ = child.wait();
    let _ = reader_thread.join();
    let _ = writer_thread.join();

    result
}

fn execute_acp_session(
    reader_rx: &mpsc::Receiver<serde_json::Value>,
    writer_tx: &mpsc::Sender<String>,
    prompt_text: String,
    image_data: Option<String>,
    image_mime_type: Option<String>,
) -> Result<String, String> {
    // 1. Initialize
    send_msg(
        writer_tx,
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "1",
                "capabilities": {}
            }
        }),
    )?;
    wait_for_response(reader_rx, writer_tx, 1, 30)?;

    // 2. New session
    send_msg(
        writer_tx,
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "newSession",
            "params": {}
        }),
    )?;
    let session_resp = wait_for_response(reader_rx, writer_tx, 2, 30)?;
    let session_id = session_resp["result"]["sessionId"]
        .as_str()
        .ok_or("No sessionId in newSession response")?
        .to_string();

    // 3. Build prompt blocks
    let mut prompt_blocks = vec![serde_json::json!({
        "type": "text",
        "text": prompt_text
    })];
    if let (Some(data), Some(mime)) = (image_data, image_mime_type) {
        prompt_blocks.push(serde_json::json!({
            "type": "image",
            "data": data,
            "mimeType": mime
        }));
    }

    send_msg(
        writer_tx,
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "prompt",
            "params": {
                "sessionId": session_id,
                "prompt": prompt_blocks
            }
        }),
    )?;

    // 4. Collect response: handle notifications + permission requests until final response
    let mut collected_text = String::new();
    let deadline = Instant::now() + Duration::from_secs(120);

    loop {
        let now = Instant::now();
        if now >= deadline {
            return Err("ACP prompt timed out after 120s".to_string());
        }
        let remaining = deadline - now;
        let msg = reader_rx
            .recv_timeout(remaining)
            .map_err(|_| "ACP prompt timed out waiting for response".to_string())?;

        // Final response to prompt request (id=3)
        if msg.get("id") == Some(&serde_json::json!(3)) {
            if let Some(err) = msg.get("error") {
                return Err(format!("ACP agent error: {err}"));
            }
            break;
        }

        let method = msg.get("method").and_then(|m| m.as_str());

        // requestPermission: agent blocks waiting for our response, must reply
        if method == Some("requestPermission") {
            if let Some(req_id) = msg.get("id").cloned() {
                send_msg(
                    writer_tx,
                    serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": { "selectedOption": "reject_once" }
                    }),
                )?;
            }
            continue;
        }

        // sessionUpdate notifications carry text chunks
        if method == Some("sessionUpdate") {
            if let Some(params) = msg.get("params") {
                if params.get("kind").and_then(|k| k.as_str()) == Some("agent_message_chunk") {
                    if let Some(content) = params.get("content") {
                        if content.get("type").and_then(|t| t.as_str()) == Some("text") {
                            if let Some(text) = content.get("text").and_then(|t| t.as_str()) {
                                collected_text.push_str(text);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(collected_text.trim().to_string())
}

fn send_msg(
    writer_tx: &mpsc::Sender<String>,
    msg: serde_json::Value,
) -> Result<(), String> {
    writer_tx
        .send(msg.to_string())
        .map_err(|_| "Failed to send message to agent (channel closed)".to_string())
}

fn wait_for_response(
    reader_rx: &mpsc::Receiver<serde_json::Value>,
    writer_tx: &mpsc::Sender<String>,
    id: u64,
    timeout_secs: u64,
) -> Result<serde_json::Value, String> {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    let id_val = serde_json::json!(id);

    loop {
        let now = Instant::now();
        if now >= deadline {
            return Err(format!(
                "Timeout after {timeout_secs}s waiting for ACP response to request {id}"
            ));
        }
        let remaining = deadline - now;
        let msg = reader_rx
            .recv_timeout(remaining)
            .map_err(|_| format!("Timeout waiting for ACP response to request {id}"))?;

        // Handle permission requests even during handshake
        if msg.get("method").and_then(|m| m.as_str()) == Some("requestPermission") {
            if let Some(req_id) = msg.get("id").cloned() {
                let _ = send_msg(
                    writer_tx,
                    serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": { "selectedOption": "reject_once" }
                    }),
                );
            }
            continue;
        }

        if msg.get("id") == Some(&id_val) {
            if let Some(err) = msg.get("error") {
                return Err(format!("ACP error response: {err}"));
            }
            return Ok(msg);
        }
    }
}
