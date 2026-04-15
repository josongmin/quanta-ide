//! Quanta IDE — desktop shell for the Software Intelligence Platform.
//!
//! # Architecture (Hexagonal / Ports & Adapters)
//!
//! The target layering is:
//!
//! ```text
//!  adapter         (driving / inbound — Tauri cmds, events)
//!  application     (use-case orchestration)
//!  domain          (entities, VOs, ports, errors)
//!  infrastructure  (driven / outbound — fs, process, persistence)
//! ```
//!
//! **Dependency rule:** arrows point inward. Outer layers depend on inner
//! layers, never the reverse. Infrastructure implements domain ports;
//! adapters call application services.
//!
//! Only `domain::error` is materialised today. Additional layers will be
//! added as concrete use-cases demand them — not before (YAGNI).

// ── Layer modules ───────────────────────────────────────────────────
pub mod domain;

use log::info;

/// Composition root — wires all layers together and starts Tauri.
///
/// This is the only place where concrete infrastructure types meet
/// abstract domain ports. Everything else programs to interfaces.
///
/// # Panics
///
/// Panics if the Tauri runtime fails to initialise (missing webview,
/// invalid config, etc.). This is intentional — the app cannot recover.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(
    clippy::expect_used,
    clippy::missing_panics_doc,
    clippy::disallowed_methods
)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }
            info!("Quanta IDE started");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to start Quanta IDE");
}
