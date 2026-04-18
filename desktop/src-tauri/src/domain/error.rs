//! Domain-level error types.
//!
//! All domain errors are framework-agnostic — they know nothing about Tauri,
//! HTTP, or any specific infrastructure. Adapter layers map these into
//! transport-appropriate responses.

use thiserror::Error;

/// Unified domain error.
///
/// Guarantees `Send + Sync` so it can cross async boundaries safely.
#[derive(Debug, Error)]
pub enum DomainError {
    /// A requested entity was not found.
    #[error("not found: {0}")]
    NotFound(String),

    /// The caller supplied invalid input.
    #[error("invalid input: {0}")]
    InvalidInput(String),

    /// An I/O operation failed at the infrastructure boundary.
    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    /// Catch-all for unexpected infrastructure failures.
    /// Wrapped as `String` to avoid `#[from]` ambiguity with `io::Error`
    /// and to guarantee a single conversion path per source type.
    #[error("internal: {0}")]
    Internal(String),
}

impl DomainError {
    /// Wrap any `anyhow::Error` into [`DomainError::Internal`].
    pub fn internal(err: impl std::fmt::Display) -> Self {
        Self::Internal(err.to_string())
    }
}

// Compile-time assertion: DomainError must be Send + Sync.
const _: () = {
    const fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<DomainError>();
};

/// Convenience alias used throughout the domain & application layers.
pub type DomainResult<T> = Result<T, DomainError>;
