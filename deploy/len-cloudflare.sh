#!/usr/bin/env bash
# Deploy lấy link công khai qua Cloudflare Tunnel — app vẫn chạy trên máy này.
# Cách dùng:  ./deploy/len-cloudflare.sh      (Ctrl+C để tắt link)
# Lưu ý: link *.trycloudflare.com đổi MỖI LẦN chạy lại; link chỉ sống khi máy còn bật.
# Cảnh giác: ai có link đều dựng được video (tốn CPU + lượt gọi claude của máy bạn).
set -euo pipefail
cd "$(dirname "$0")/.."

command -v cloudflared >/dev/null || { echo "Thiếu cloudflared — cài rồi chạy lại (brew install cloudflared)"; exit 1; }
PORT="${PORT:-5675}"

# 1) Bật app nếu chưa chạy
song() { curl -s -o /dev/null --max-time 2 "http://localhost:$PORT"; }
if ! song; then
  (node server/index.js >/tmp/xuong-video.log 2>&1 &)
  for i in $(seq 1 15); do song && break; sleep 1; done
fi
song || { echo "App ($PORT) không lên — xem /tmp/xuong-video.log"; exit 1; }

# 2) Mở tunnel và chờ link
rm -f /tmp/tunnel-xuong-video.log
cloudflared tunnel --url "http://localhost:$PORT" >/tmp/tunnel-xuong-video.log 2>&1 &
TUNNEL=$!
trap 'kill $TUNNEL 2>/dev/null || true' EXIT

LINK=""
for i in $(seq 1 30); do
  LINK=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/tunnel-xuong-video.log | head -1 || true)
  [ -n "$LINK" ] && break
  sleep 1
done
[ -n "$LINK" ] || { echo "Không lấy được link — xem /tmp/tunnel-xuong-video.log"; exit 1; }

echo ""
echo "🎬 Xưởng Video đang công khai tại: $LINK"
echo "   (Ctrl+C để tắt link — app local vẫn chạy tiếp)"
wait $TUNNEL
