//! The project link, shown in About and on Home. Icons are Lucide's (ISC).

use egui::Ui;

use crate::theme::Tokens;
use crate::{CoolVectorApp, icons};

/// One link row: icon, label, opens the command's URL.
fn link(app: &mut CoolVectorApp, ui: &mut Ui, icon: &str, label: &str, cmd: &str, url: &str) {
    let t = Tokens::get(ui.ctx());
    ui.horizontal(|ui| {
        icons::icon(ui, icon, 16.0, t.icon);
        let r = ui.add(egui::Button::new(egui::RichText::new(label).color(t.accent).size(13.0)).frame(false)).on_hover_text(url);
        if r.clicked() {
            app.open_link(cmd);
        }
    });
}

/// CoolCanvas's own link, and nothing else.
pub fn links(app: &mut CoolVectorApp, ui: &mut Ui) {
    let l = app.session.execute("help.links", &serde_json::json!({})).unwrap_or_default();
    let website = l["website"].as_str().unwrap_or("").to_string();
    link(app, ui, "globe", tl!("CoolCanvas website"), "help.website", &website);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn link_clicks_open_the_right_urls() {
        use std::sync::{Arc, Mutex};
        let opened = Arc::new(Mutex::new(vec![]));
        let o = opened.clone();
        let services = crate::Services { open_url: Some(Box::new(move |u: &str| o.lock().unwrap().push(u.to_string()))), ..Default::default() };
        let mut app = CoolVectorApp::new(coolvector_engine::Session::new(), services);
        crate::menus::invoke(&mut app, "help.website", serde_json::json!({}));
        assert_eq!(*opened.lock().unwrap(), ["https://yxmdigital.com"]);
        // The control channel / MCP path returns the URL without opening a browser.
        let v = app.run("help.website", serde_json::json!({})).unwrap();
        assert_eq!(v["url"], "https://yxmdigital.com");
        assert_eq!(opened.lock().unwrap().len(), 1);
        let ctx = egui::Context::default();
        crate::theme::install_fonts(&ctx);
        let mut out = ctx.run_ui(egui::RawInput::default(), |ui| links(&mut app, ui));
        out.textures_delta.clear();
    }
}
