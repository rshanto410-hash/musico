#!/usr/bin/env bash
# Downloads the latest Lavalink.jar into ./lavalink (the jar is not stored in git).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v java >/dev/null 2>&1; then
  echo "Java was not found. Lavalink needs Java 17 or newer." >&2
  exit 1
fi

echo "Java found:"
java -version 2>&1 | head -1

mkdir -p lavalink
curl -fL --retry 3 -o lavalink/Lavalink.jar \
  "https://github.com/lavalink-devs/Lavalink/releases/latest/download/Lavalink.jar"

echo "Downloaded: $(ls -lh lavalink/Lavalink.jar | awk '{print $5}') lavalink/Lavalink.jar"
