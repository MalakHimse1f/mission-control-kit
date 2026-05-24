#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
chmod +x install.sh 2>/dev/null || true
./install.sh "$@"
