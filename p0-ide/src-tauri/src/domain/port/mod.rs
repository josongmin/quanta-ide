//! Ports — trait interfaces that the domain requires.
//!
//! Ports define the **contracts** between the domain/application layer and
//! the outside world (file system, network, database, etc.).
//!
//! Infrastructure modules provide concrete implementations (adapters) of
//! these traits, injected at application startup via the composition root.
