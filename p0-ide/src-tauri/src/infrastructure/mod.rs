//! **Infrastructure layer** — concrete implementations of domain ports.
//!
//! Each sub-module provides a real adapter for a specific external concern
//! (file system, processes, persistence). These are injected into
//! application services at startup.
//!
//! Add modules here as concrete use-cases demand them — not before.

pub mod fs;
