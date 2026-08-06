#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env
npm install
echo "Preparación terminada. Revise .env antes de ejecutar ./2_iniciar.sh"
