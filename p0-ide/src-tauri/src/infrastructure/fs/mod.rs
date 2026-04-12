//! File-system adapter — concrete implementation of file-related domain ports.
//!
//! All `std::fs` / `tokio::fs` usage is confined here so the domain
//! remains testable with in-memory fakes.
