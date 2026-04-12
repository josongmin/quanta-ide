//! Quanta IDE — desktop shell for the Software Intelligence Platform.
//!
//! # Architecture (Hexagonal / Ports & Adapters)
//!
//! ```text
//!  ┌─────────────────────────────────────────────┐
//!  │  adapter::tauri_cmd   (driving / inbound)    │
//!  │  adapter::event                              │
//!  ├─────────────────────────────────────────────┤
//!  │  application::service  (use-cases)           │
//!  │  application::dto      (boundary objects)    │
//!  ├─────────────────────────────────────────────┤
//!  │  domain::model         (entities, VOs)       │
//!  │  domain::port          (trait interfaces)    │
//!  │  domain::error         (domain errors)       │
//!  ├─────────────────────────────────────────────┤
//!  │  infrastructure::fs         (driven / out)   │
//!  │  infrastructure::process                     │
//!  │  infrastructure::persistence                 │
//!  └─────────────────────────────────────────────┘
//! ```
//!
//! **Dependency rule:** arrows point inward. Outer layers depend on inner
//! layers, never the reverse. Infrastructure implements domain ports;
//! adapters call application services.

// ── Layer modules ───────────────────────────────────────────────────
pub mod adapter;
pub mod application;
pub mod domain;
pub mod infrastructure;

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
