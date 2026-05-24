#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
chmod +x upgrade.sh install.sh 2>/dev/null || true
./upgrade.sh "$@"
