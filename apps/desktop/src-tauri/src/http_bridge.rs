use std::collections::HashMap;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};
use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::acp::{tool_definitions, ToolResultSender};

static BRIDGE_TOKEN: std::sync::OnceLock<String> = std::sync::OnceLock::new();

pub fn initialize_token() -> Result<(), String> {
    let storage =
        crate::secure_storage::get_secure_storage().ok_or("Secure storage is not initialized")?;
    let token = match storage
        .retrieve("mcp_bridge_token")
        .map_err(|error| error.to_string())?
    {
        Some(token) if crate::http_auth::valid_token(&token) => token,
        Some(_) => return Err("Stored MCP bridge token is invalid".into()),
        None => {
            let token = crate::http_auth::new_token();
            storage
                .store("mcp_bridge_token", &token)
                .map_err(|error| error.to_string())?;
            token
        }
    };
    BRIDGE_TOKEN
        .set(token)
        .map_err(|_| "MCP bridge token is already initialized".into())
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeConfiguration {
    pub url: String,
    pub token: String,
    pub configured_port: u16,
}
static BRIDGE_CONFIGURATION: std::sync::OnceLock<BridgeConfiguration> = std::sync::OnceLock::new();
static LISTENING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
#[tauri::command]
pub fn mcp_bridge_configuration() -> Result<BridgeConfiguration, String> {
    if !LISTENING.load(Ordering::Acquire) {
        return Err("MCP bridge is not listening".into());
    }
    BRIDGE_CONFIGURATION
        .get()
        .cloned()
        .ok_or_else(|| "MCP bridge is not initialized".into())
}

static CALL_COUNTER: AtomicU64 = AtomicU64::new(0);

fn generate_call_id() -> String {
    let n = CALL_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("http_{n}")
}

#[derive(Clone)]
pub struct HttpBridgeState {
    pub pending: Arc<Mutex<HashMap<String, ToolResultSender>>>,
    pub app: AppHandle,
}

#[derive(Serialize)]
struct ToolsResponse {
    tools: serde_json::Value,
}

#[derive(Deserialize)]
struct ToolCallRequest {
    name: String,
    arguments: serde_json::Value,
}

#[derive(Deserialize)]
struct McpRequest {
    id: Option<serde_json::Value>,
    method: String,
    params: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct ToolCallResponse {
    content: Vec<ToolContent>,
    #[serde(rename = "isError")]
    is_error: bool,
}

#[derive(Serialize)]
struct ToolContent {
    #[serde(rename = "type")]
    content_type: String,
    text: String,
}

async fn handle_list_tools(State(s): State<HttpBridgeState>) -> impl IntoResponse {
    let _ = s;
    Json(ToolsResponse {
        tools: tool_definitions(),
    })
}

async fn handle_tool_call(
    State(s): State<HttpBridgeState>,
    Json(body): Json<ToolCallRequest>,
) -> impl IntoResponse {
    call_tool(s, body.name, body.arguments).await
}

async fn call_tool(
    s: HttpBridgeState,
    name: String,
    arguments: serde_json::Value,
) -> (StatusCode, Json<ToolCallResponse>) {
    let call_id = generate_call_id();

    let (tx, rx) = std::sync::mpsc::sync_channel::<Result<serde_json::Value, String>>(1);
    s.pending.lock().unwrap().insert(call_id.clone(), tx);

    let emit_result = s.app.emit(
        "acp-tool-call",
        serde_json::json!({
            "callId": call_id,
            "toolName": name,
            "arguments": arguments,
        }),
    );

    if emit_result.is_err() {
        s.pending.lock().unwrap().remove(&call_id);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ToolCallResponse {
                content: vec![ToolContent {
                    content_type: "text".to_string(),
                    text: "Failed to emit tool call event".to_string(),
                }],
                is_error: true,
            }),
        );
    }

    let result =
        tokio::task::spawn_blocking(move || rx.recv_timeout(Duration::from_secs(30))).await;

    s.pending.lock().unwrap().remove(&call_id);

    match result {
        Ok(Ok(Ok(value))) => (
            StatusCode::OK,
            Json(ToolCallResponse {
                content: vec![ToolContent {
                    content_type: "text".to_string(),
                    text: match &value {
                        serde_json::Value::String(s) => s.clone(),
                        other => other.to_string(),
                    },
                }],
                is_error: false,
            }),
        ),
        Ok(Ok(Err(err))) => (
            StatusCode::OK,
            Json(ToolCallResponse {
                content: vec![ToolContent {
                    content_type: "text".to_string(),
                    text: err,
                }],
                is_error: true,
            }),
        ),
        _ => (
            StatusCode::GATEWAY_TIMEOUT,
            Json(ToolCallResponse {
                content: vec![ToolContent {
                    content_type: "text".to_string(),
                    text: "Tool call timed out after 30 seconds".to_string(),
                }],
                is_error: true,
            }),
        ),
    }
}

async fn handle_mcp(State(s): State<HttpBridgeState>, Json(body): Json<McpRequest>) -> Response {
    let id = body.id.unwrap_or(serde_json::Value::Null);
    let response = match body.method.as_str() {
        "initialize" => serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": body
                    .params
                    .as_ref()
                    .and_then(|p| p.get("protocolVersion"))
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!("2024-11-05")),
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "backstage",
                    "version": "0.0.1"
                }
            }
        }),
        "tools/list" => serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "tools": tool_definitions()
            }
        }),
        "tools/call" => {
            let params = body.params.unwrap_or_default();
            let name = params
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| serde_json::json!({}));
            let (status, Json(result)) = call_tool(s, name, arguments).await;
            if status == StatusCode::OK {
                serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": result
                })
            } else {
                serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": {
                        "code": -32000,
                        "message": result
                            .content
                            .first()
                            .map(|content| content.text.clone())
                            .unwrap_or_else(|| "Tool call failed".to_string())
                    }
                })
            }
        }
        _ => serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": {
                "code": -32601,
                "message": format!("Method not found: {}", body.method)
            }
        }),
    };

    Json(response).into_response()
}

pub async fn start(
    pending: Arc<Mutex<HashMap<String, ToolResultSender>>>,
    app: AppHandle,
    port: u16,
    configured_port: u16,
) {
    let state = HttpBridgeState { pending, app };

    let router = Router::new()
        .route("/api/tools", get(handle_list_tools))
        .route("/api/tools/call", post(handle_tool_call))
        .route("/mcp", post(handle_mcp))
        .with_state(state);

    let Some(token) = BRIDGE_TOKEN.get().cloned() else {
        return;
    };
    let router = crate::http_auth::protect(router, token.clone());

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(_) => return,
    };

    let _ = BRIDGE_CONFIGURATION.set(BridgeConfiguration {
        url: format!("http://127.0.0.1:{port}"),
        token,
        configured_port,
    });
    LISTENING.store(true, Ordering::Release);
    let _ = axum::serve(listener, router).await;
    LISTENING.store(false, Ordering::Release);
}
