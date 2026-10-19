//! Help → the project link. Vector Studio is CoolCanvas's, and says so and nothing else. The
//! engine's provenance is recorded where a licence requires it — `NOTICE`, `ATTRIBUTION.md` and
//! the licence files that ship with the app — not in its interface. The command returns the URL;
//! the frontend opens it.

use serde_json::{Value, json};

use super::*;

pub const WEBSITE_URL: &str = "https://yxmdigital.com";

pub fn specs() -> Vec<CommandSpec> {
    vec![
        cmd!(query "help.website", "CoolCanvas Website", ["Help"], None, "{} → {url}", always, |_, _| url(WEBSITE_URL.into())),
        cmd!(query "help.links", "Links", [], None, "{} → {website}", always, |_, _| Ok(json!({ "website": WEBSITE_URL }))),
    ]
}

fn url(u: String) -> Result<Value> {
    Ok(json!({ "url": u }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links() {
        let mut s = Session::new();
        assert_eq!(s.execute("help.website", &json!({})).unwrap()["url"], "https://yxmdigital.com");
        assert_eq!(s.execute("help.links", &json!({})).unwrap()["website"], "https://yxmdigital.com");
    }

    /// Nothing in the interface names the project this engine was derived from.
    #[test]
    fn no_upstream_brand_reaches_the_interface() {
        for mark in ["vectorcraft", "artcraft", "storytold", "discord"] {
            assert!(!WEBSITE_URL.to_ascii_lowercase().contains(mark), "{WEBSITE_URL} still names {mark}");
        }
    }
}
