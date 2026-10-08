use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    Router,
};
use base64::Engine;
use rand::RngCore;
use subtle::ConstantTimeEq;

pub fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}
pub fn valid_token(token: &str) -> bool {
    token.len() == 43
        && token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}
fn authorized(header: Option<&str>, token: &str) -> bool {
    let Some(presented) = header.and_then(|value| value.strip_prefix("Bearer ")) else {
        return false;
    };
    if presented.len() != token.len() || !valid_token(token) {
        return false;
    }
    bool::from(presented.as_bytes().ct_eq(token.as_bytes()))
}
async fn authenticate(State(token): State<String>, request: Request, next: Next) -> Response {
    if !authorized(
        request
            .headers()
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok()),
        &token,
    ) {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    next.run(request).await
}
pub fn protect<S: Clone + Send + Sync + 'static>(router: Router<S>, token: String) -> Router<S> {
    router.route_layer(middleware::from_fn_with_state(token, authenticate))
}
#[cfg(test)]
mod tests {
    use super::*;
    use axum::routing::{get, post};
    use tower::ServiceExt;
    #[tokio::test]
    async fn every_bridge_entrypoint_requires_the_local_bearer() {
        let token = new_token();
        assert!(valid_token(&token));
        let router = protect(
            Router::new()
                .route("/api/tools", get(|| async { "tools" }))
                .route("/api/tools/call", post(|| async { "call" }))
                .route("/mcp", post(|| async { "mcp" })),
            token.clone(),
        );
        for (method, path) in [
            ("GET", "/api/tools"),
            ("POST", "/api/tools/call"),
            ("POST", "/mcp"),
        ] {
            for header in [
                None,
                Some("Bearer attacker".to_owned()),
                Some(format!("Bearer {}", "b".repeat(43))),
                Some(format!("Bearer {token}")),
            ] {
                let mut request = Request::builder().method(method).uri(path);
                if let Some(value) = header.as_ref() {
                    request = request.header(AUTHORIZATION, value);
                }
                let response = router
                    .clone()
                    .oneshot(request.body(axum::body::Body::empty()).unwrap())
                    .await
                    .unwrap();
                assert_eq!(
                    response.status(),
                    if header.as_deref() == Some(format!("Bearer {token}").as_str()) {
                        StatusCode::OK
                    } else {
                        StatusCode::UNAUTHORIZED
                    }
                );
            }
        }
    }
}
