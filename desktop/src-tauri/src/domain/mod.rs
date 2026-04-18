//! **Domain layer** — the innermost hexagonal ring.
//!
//! Contains pure business logic, value objects, entities, and port traits.
//! Zero framework dependencies: no Tauri, no Tokio, no Serde (except on DTOs
//! that cross the boundary via `application`).

pub mod error;
