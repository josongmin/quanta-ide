# Quanta IDE — root justfile

# Verify every build artifact is redirected outside the repo.
# Keeps IDE indexing fast. Run locally before pushing structural changes.
check-artifacts:
    @bash scripts/check-artifact-locations.sh

tauri-dev:
    #!/usr/bin/env bash
    set -e
    echo "Killing existing Tauri / Vite processes..."
    pkill -f "tauri dev" 2>/dev/null || true
    pkill -f "tauri-driver" 2>/dev/null || true
    pkill -f "quanta-ide" 2>/dev/null || true
    lsof -ti :5174 | xargs kill -9 2>/dev/null || true
    sleep 0.5
    echo "Starting Tauri dev..."
    cd desktop && pnpm tauri:dev
