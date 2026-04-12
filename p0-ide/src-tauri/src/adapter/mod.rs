//! **Adapter layer** — driving (inbound) adapters.
//!
//! Adapters translate external protocols (Tauri IPC, events) into
//! application-layer calls. They are the outermost hexagonal ring and
//! depend on `application` and `domain`, never the reverse.

pub mod tauri_cmd;
