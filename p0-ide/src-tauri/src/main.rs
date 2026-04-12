//! Quanta IDE binary entry point.

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Entry point — delegates immediately to the composition root in `lib.rs`.
fn main() {
    quanta_ide_lib::run();
}
