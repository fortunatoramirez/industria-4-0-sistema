#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "Falta .env. Ejecute ./1_preparar.sh"; exit 1; }
npm start
