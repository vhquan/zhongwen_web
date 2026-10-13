#!/bin/sh
set -eu

mkdir -p /app/data
if [ ! -f /app/data/zhongwen.sqlite ]; then
  cp /app/seed/zhongwen.sqlite /app/data/zhongwen.sqlite
fi

exec "$@"
