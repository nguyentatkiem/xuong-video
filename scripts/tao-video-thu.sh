#!/bin/bash
# Tạo video thử 24s: hình testsrc, tiếng 5s kêu + 3s im lặng lặp lại — để thử cắt im lặng.
set -e
RA="${1:-video-thu.mp4}"
ffmpeg -hide_banner -y \
  -f lavfi -i "testsrc2=d=24:s=1280x720:r=30" \
  -f lavfi -i "aevalsrc=if(lt(mod(t\,8)\,5)\,0.5*sin(2*PI*440*t)\,0.0005*sin(2*PI*440*t)):d=24" \
  -c:v libx264 -preset veryfast -c:a aac -b:a 128k "$RA"
echo "Đã tạo $RA"
