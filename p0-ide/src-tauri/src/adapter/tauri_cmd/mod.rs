//! Tauri command handlers — the **driving adapter** (inbound).
//!
//! Each `#[tauri::command]` function lives here. Commands translate
//! between the Tauri IPC boundary (JSON ↔ DTOs) and application services.
//! They must remain thin: validate input, call a service, map the result.
