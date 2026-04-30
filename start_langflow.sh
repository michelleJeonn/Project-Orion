#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$PROJECT_ROOT/langflow_venv"

# ── Create isolated venv for Langflow if it doesn't exist ─────────────────────
if [ ! -d "$VENV" ]; then
    echo "► Creating Langflow virtual environment..."
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install --upgrade pip --quiet

    echo "► Installing Langflow (this takes a few minutes the first time)..."
    "$VENV/bin/pip" install langflow --quiet

    echo "► Installing backend dependencies..."
    "$VENV/bin/pip" install -r "$PROJECT_ROOT/requirements.txt" --quiet
    echo "✓ Environment ready."
fi

echo ""
echo "► Starting Langflow UI at http://localhost:7860"
echo "  Load components from: langflow_components_real/"
echo "  Press Ctrl+C to stop."
echo ""

# PYTHONPATH lets the components import from the backend package.
# We cd to /tmp so Python doesn't pick up the local langflow_components_real/
# directory as a package namespace instead of the installed langflow.
cd /tmp && PYTHONPATH="$PROJECT_ROOT" \
    "$VENV/bin/langflow" run \
    --components-path "$PROJECT_ROOT/langflow_components_real" \
    --host 0.0.0.0 \
    --port 7860
