#!/bin/bash
# Tổng hợp bộ SFX sạch bản quyền bằng ffmpeg (thay tệp xịn hơn vào sfx/ nếu muốn).
set -e
FF="${XUONG_FFMPEG:-/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg}"
command -v "$FF" >/dev/null 2>&1 || FF=ffmpeg
GOC="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$GOC/sfx"
cd "$GOC/sfx"

# whoosh: nhiễu hồng lọc thấp, dâng rồi tắt nhanh — cho punch-in/chuyển cảnh
$FF -hide_banner -y -f lavfi -i "anoisesrc=colour=pink:d=0.4:a=0.8" \
  -af "lowpass=f=900,afade=t=in:d=0.12,afade=t=out:st=0.18:d=0.22,volume=1.6" whoosh.wav
# pop: xung sine ngắn tắt nhanh — cho ảnh/từ khoá bật lên
$FF -hide_banner -y -f lavfi -i "sine=frequency=520:duration=0.12" \
  -af "afade=t=out:st=0.02:d=0.1,volume=1.2" pop.wav
# ding: chuông sine tần cao ngân nhẹ — cho tick/chương
$FF -hide_banner -y -f lavfi -i "sine=frequency=1318:duration=0.6" \
  -af "afade=t=out:st=0.05:d=0.55,volume=0.9" ding.wav
# tick: click cực ngắn — cho counter/progress
$FF -hide_banner -y -f lavfi -i "sine=frequency=2200:duration=0.04" \
  -af "afade=t=out:d=0.035,volume=0.8" tick.wav
# riser: nhiễu dâng dần 1s — cho mở đầu/cao trào
$FF -hide_banner -y -f lavfi -i "anoisesrc=colour=brown:d=1.0:a=0.7" \
  -af "highpass=f=200,afade=t=in:d=0.85,afade=t=out:st=0.85:d=0.15,volume=1.4" riser.wav

echo "Đã tạo $(ls *.wav | wc -l | tr -d ' ') tệp SFX trong $GOC/sfx/"
