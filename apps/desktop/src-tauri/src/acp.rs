use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

pub type ToolResultSender = mpsc::SyncSender<Result<serde_json::Value, String>>;

pub struct AcpState {
    pub pending: Arc<Mutex<HashMap<String, ToolResultSender>>>,
}

impl AcpState {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

fn generate_call_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("call_{nanos}")
}

pub fn tool_definitions() -> serde_json::Value {
    serde_json::json!([
        {
            "name": "backstage_get_projects",
            "description": "List all thumbnail projects in the gallery. Returns id, name, dimensions, and timestamps.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "backstage_get_editor_state",
            "description": "Get the current editor state: canvas dimensions, all layers with their properties, and active layer IDs.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "backstage_add_text_layer",
            "description": "Add a text layer to the current canvas.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "text": { "type": "string", "description": "Text content" },
                    "x": { "type": "number", "description": "X position in pixels" },
                    "y": { "type": "number", "description": "Y position in pixels" },
                    "fontSize": { "type": "number", "description": "Font size in pixels (default 48)" },
                    "fontFamily": { "type": "string", "description": "Font family name" },
                    "fill": { "type": "string", "description": "Text color as hex, e.g. '#ffffff'" },
                    "fontStyle": { "type": "string", "enum": ["normal", "bold", "italic", "bold italic"] },
                    "align": { "type": "string", "enum": ["left", "center", "right"] }
                },
                "required": ["text"]
            }
        },
        {
            "name": "backstage_add_shape_layer",
            "description": "Add a shape layer (rectangle, ellipse, polygon, or star) to the canvas.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "shapeType": { "type": "string", "enum": ["rect", "ellipse", "polygon", "star"] },
                    "x": { "type": "number" },
                    "y": { "type": "number" },
                    "width": { "type": "number" },
                    "height": { "type": "number" },
                    "fill": { "type": "string", "description": "Fill color as hex" },
                    "stroke": { "type": "string", "description": "Stroke color as hex" },
                    "strokeWidth": { "type": "number" }
                },
                "required": ["shapeType"]
            }
        },
        {
            "name": "backstage_update_layer",
            "description": "Update properties of a layer by its ID. For text layers: text, fontSize, fontFamily, fill, fontStyle, align. For shape layers: fill, stroke, strokeWidth, width, height. Common to all: x, y, rotation, opacity, visible, name.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "layerId": { "type": "string" },
                    "updates": { "type": "object", "description": "Partial layer properties to update" }
                },
                "required": ["layerId", "updates"]
            }
        },
        {
            "name": "backstage_remove_layer",
            "description": "Remove a layer from the canvas by its ID.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "layerId": { "type": "string" }
                },
                "required": ["layerId"]
            }
        },
        {
            "name": "backstage_select_layers",
            "description": "Select one or more layers by their IDs to bring them into focus in the properties panel.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "layerIds": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["layerIds"]
            }
        },
        {
            "name": "backstage_set_canvas_size",
            "description": "Resize the canvas. Common sizes: 1280x720 (YouTube thumbnail HD), 1920x1080 (Full HD).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "width": { "type": "number" },
                    "height": { "type": "number" }
                },
                "required": ["width", "height"]
            }
        },
        {
            "name": "backstage_open_project",
            "description": "Open a project in the editor by its ID.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "projectId": { "type": "string" }
                },
                "required": ["projectId"]
            }
        },
        {
            "name": "backstage_undo",
            "description": "Undo the last editor action.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "backstage_redo",
            "description": "Redo a previously undone editor action.",
            "inputSchema": { "type": "object", "properties": {}, "required": [] }
        },
        {
            "name": "backstage_move_layer",
            "description": "Move a layer up or down in z-order (stacking order).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "layerId": { "type": "string" },
                    "direction": { "type": "string", "enum": ["up", "down"] }
                },
                "required": ["layerId", "direction"]
            }
        },
        {
            "name": "backstage_duplicate_layer",
            "description": "Create a copy of an existing layer.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "layerId": { "type": "string" }
                },
                "required": ["layerId"]
            }
        },
        {
            "name": "backstage_navigate",
            "description": "Navigate to a different page in the app.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "page": {
                        "type": "string",
                        "enum": ["gallery", "ai-generate", "ai-projects", "trash", "settings", "explore", "archive"]
                    }
                },
                "required": ["page"]
            }
        }
    ])
}

#[tauri::command]
pub async fn acp_prompt(
    app: AppHandle,
    state: State<'_, AcpState>,
    agent_command: String,
    agent_args: Vec<String>,
    env_vars: HashMap<String, String>,
    prompt_text: String,
    image_data: Option<String>,
    image_mime_type: Option<String>,
) -> Result<String, String> {
    let pending = state.pending.clone();
    tauri::async_runtime::spawn_blocking(move || {
        run_acp_prompt(
            app,
            pending,
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

#[tauri::command]
pub fn acp_tool_result(
    state: State<'_, AcpState>,
    call_id: String,
    result: serde_json::Value,
    is_error: bool,
) -> Result<(), String> {
    let mut pending = state.pending.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = pending.remove(&call_id) {
        let payload = if is_error {
            Err(result.as_str().unwrap_or("Tool error").to_string())
        } else {
            Ok(result)
        };
        sender
            .send(payload)
            .map_err(|_| "Session ended before tool result arrived".to_string())?;
        Ok(())
    } else {
        Err(format!("No pending tool call: {call_id}"))
    }
}

fn run_acp_prompt(
    app: AppHandle,
    pending: Arc<Mutex<HashMap<String, ToolResultSender>>>,
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

    let (reader_tx, reader_rx) = mpsc::channel::<serde_json::Value>();
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
        &app,
        &pending,
        &reader_rx,
        &writer_tx,
        prompt_text,
        image_data,
        image_mime_type,
    );

    drop(writer_tx);
    let _ = child.kill();
    let _ = child.wait();
    let _ = reader_thread.join();
    let _ = writer_thread.join();

    result
}

fn execute_acp_session(
    app: &AppHandle,
    pending: &Arc<Mutex<HashMap<String, ToolResultSender>>>,
    reader_rx: &mpsc::Receiver<serde_json::Value>,
    writer_tx: &mpsc::Sender<String>,
    prompt_text: String,
    image_data: Option<String>,
    image_mime_type: Option<String>,
) -> Result<String, String> {
    // 1. Initialize with tool definitions
    send_msg(
        writer_tx,
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "1",
                "capabilities": {
                    "tools": tool_definitions()
                }
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

    // 4. Process messages until prompt response, handling tool calls along the way
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

        // Final response to the prompt request (id=3)
        if msg.get("id") == Some(&serde_json::json!(3)) {
            if let Some(err) = msg.get("error") {
                return Err(format!("ACP agent error: {err}"));
            }
            break;
        }

        let method = msg.get("method").and_then(|m| m.as_str());

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

        if method == Some("tools/list") {
            if let Some(req_id) = msg.get("id").cloned() {
                send_msg(
                    writer_tx,
                    serde_json::json!({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": { "tools": tool_definitions() }
                    }),
                )?;
            }
            continue;
        }

        if method == Some("tools/call") {
            if let Some(req_id) = msg.get("id").cloned() {
                let tool_name = msg["params"]["name"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();
                let arguments = msg["params"]["arguments"].clone();

                let call_id = generate_call_id();
                let (sender, receiver) =
                    mpsc::sync_channel::<Result<serde_json::Value, String>>(1);
                {
                    pending.lock().unwrap().insert(call_id.clone(), sender);
                }

                let _ = app.emit(
                    "acp-tool-call",
                    serde_json::json!({
                        "callId": call_id,
                        "toolName": tool_name,
                        "arguments": arguments
                    }),
                );

                let tool_result = receiver.recv_timeout(Duration::from_secs(30));
                {
                    pending.lock().unwrap().remove(&call_id);
                }

                match tool_result {
                    Ok(Ok(value)) => {
                        let text = match &value {
                            serde_json::Value::String(s) => s.clone(),
                            other => other.to_string(),
                        };
                        send_msg(
                            writer_tx,
                            serde_json::json!({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "result": {
                                    "content": [{ "type": "text", "text": text }],
                                    "isError": false
                                }
                            }),
                        )?;
                    }
                    Ok(Err(err)) => {
                        send_msg(
                            writer_tx,
                            serde_json::json!({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "result": {
                                    "content": [{ "type": "text", "text": err }],
                                    "isError": true
                                }
                            }),
                        )?;
                    }
                    Err(_) => {
                        send_msg(
                            writer_tx,
                            serde_json::json!({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "result": {
                                    "content": [{ "type": "text", "text": "Tool call timed out after 30s" }],
                                    "isError": true
                                }
                            }),
                        )?;
                    }
                }
            }
            continue;
        }

        if method == Some("sessionUpdate") {
            if let Some(params) = msg.get("params") {
                if params.get("kind").and_then(|k| k.as_str())
                    == Some("agent_message_chunk")
                {
                    if let Some(content) = params.get("content") {
                        if content.get("type").and_then(|t| t.as_str()) == Some("text") {
                            if let Some(text) =
                                content.get("text").and_then(|t| t.as_str())
                            {
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
