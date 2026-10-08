// SVGL's API addFullUrl maps every catalog asset to this HTTPS origin/library path.
pub const MAX_LOGO_BYTES: usize = 8 * 1024 * 1024;
pub fn logo_url(raw: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(raw).map_err(|_| "Invalid logo URL")?;
    if raw.contains('%')
        || raw.contains('\\')
        || raw.contains("/../")
        || raw.contains("/./")
        || url.scheme() != "https"
        || url.host_str() != Some("svgl.app")
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.path().starts_with("/library/")
        || !url.path().ends_with(".svg")
    {
        return Err("Only SVGL catalog SVG URLs are supported".into());
    }
    Ok(url)
}
pub fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|error| error.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_catalog_assets_reach_the_native_fetcher() {
        assert_eq!(
            logo_url("https://svgl.app/library/apple.svg")
                .unwrap()
                .host_str(),
            Some("svgl.app")
        );
        for url in [
            "http://127.0.0.1/admin",
            "https://169.254.169.254/latest/meta-data",
            "https://svgl.app@127.0.0.1/library/a.svg",
            "https://svgl.app.attacker.test/library/a.svg",
            "https://svgl.app:444/library/a.svg",
            "https://svgl.app/library/../a.svg",
            "https://svgl.app/library/%2e%2e/a.svg",
            "https://svgl.app/library/a.svg?next=http://localhost",
            "https://svgl.app/library/a.svg#x",
        ] {
            assert!(logo_url(url).is_err(), "{url}");
        }
    }
}
