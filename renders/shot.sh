#!/bin/bash
# shot.sh <html-file> <png-out> [WxH]
set -e
size="${3:-1200,900}"
google-chrome --headless=new --no-sandbox --disable-gpu-sandbox \
  --enable-unsafe-swiftshader --use-angle=swiftshader \
  --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=15000 \
  --window-size="$size" \
  --screenshot="$2" "file://$1" 2>/dev/null
