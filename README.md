# 🎬 Xưởng Video

Cỗ máy dựng video tự động chạy trên máy của bạn: **kéo video vào → chọn style → chờ → nhận video đã edit** kèm gói SEO (tiêu đề, mô tả, tags, chapters) và phụ đề.

Mọi xử lý đều cục bộ: **ffmpeg** render, **Claude CLI** làm "đạo diễn" (đọc transcript, quyết định giây nào zoom, từ khoá nào bật lên, chia chương, viết tiêu đề/mô tả).

## Chạy

```bash
pnpm install
pnpm dev          # → http://localhost:5675
```

Yêu cầu máy có sẵn:

| Công cụ | Bắt buộc | Ghi chú |
|---|---|---|
| `ffmpeg` **bản đầy đủ** | ✅ | `brew install ffmpeg-full` — bản `ffmpeg` gọn của Homebrew **thiếu libass**, sẽ không vẽ được chữ/phụ đề. App tự ưu tiên `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg` nếu có. |
| `claude` CLI | ⚪ | Không có/không đăng nhập → app tự dùng nhịp edit dự phòng, vẫn ra video. |
| `mlx_whisper` | ⚪ | `pip install mlx-whisper` (Apple Silicon). Không có → bỏ qua phụ đề + từ khoá, các bước khác vẫn chạy. |

Biến môi trường: `PORT` (mặc định 5675), `XUONG_FFMPEG` (ép đường dẫn ffmpeg), `XUONG_MODEL` (model cho claude, ví dụ `claude-sonnet-5`), `XUONG_BO_QUA_CLAUDE=1` (tắt đạo diễn AI).

## Pipeline (6 bước cho mỗi video)

```
video gốc
 1. ffprobe        → đọc thông tin
 2. silencedetect  → CẮT KHOẢNG LẶNG + đổi khung (16:9 / 9:16 crop / 9:16 nền mờ) + chuẩn âm lượng loudnorm
 3. whisper        → transcript từng từ (nếu máy có)
 4. claude -p      → "đạo diễn": điểm zoom, từ khoá pop, chương, tiêu đề/mô tả/tags (EDL JSON)
 5. ffmpeg render  → zoom nhấn nhá + màu + phụ đề ASS (karaoke từng-từ hoặc dòng) + tiêu đề/watermark/thẻ chương + fade
 6. xuất bản       → ra.mp4 + mo-ta-seo.md + phu-de.srt + bao-cao.json
```

## Style

11 style trong [styles/](styles/) — mỗi style là **một tệp JSON**, muốn thêm style mới chỉ cần thêm tệp (không sửa code):

- **Podcast**: Clip dọc Hormozi · Podcast trầm chuyên nghiệp
- **Vlog**: Storytime minh hoạ · Vlog đời thường (Casey Neistat) · Aesthetic nhẹ nhàng
- **Công nghệ**: Clean Tech tối giản (MKBHD) · Fast-paced dồn dập (Fireship)
- **Review**: Review cận cảnh · Review dọc TikTok
- **Đa dụng**: Listicle Top N · Documentary deep-dive

Các trường của một style: `khung` (ngang | doc-crop | doc-blur), `mucCatMacDinh` (nhe/vua/manh), `zoom` (bật/tắt, mật độ, tỉ lệ), `phuDe` (tu = karaoke từng-từ | dong | khong), `tuKhoa`, `mauSac` (toi/pastel/am/phim), `theChuong`, `loudnorm`.

## Cấu trúc

```
loi/core.js          # hàm thuần: cắt im lặng, filtergraph, ASS, EDL — có test
server/duong-day.js  # pipeline 6 bước, gọi ffmpeg + whisper + claude
server/index.js      # Express: upload, hàng đợi (1 việc/lúc), API tiến độ
styles/*.json        # 11 preset style
web/                 # giao diện trắng-xanh: kéo thả, chọn style, tiến độ, kết quả
test/core.test.js    # 22 test cho lõi — pnpm test
scripts/tao-video-thu.sh  # tạo video mẫu có khoảng lặng để thử máy
```

Dữ liệu mỗi lần dựng nằm ở `du-lieu/viec/<id>/` (video gốc, các tệp trung gian, kết quả) — xoá thư mục là sạch.

## Lộ trình (chưa làm)

- Ảnh/B-roll pop-up: claude đề xuất "giây nào cần ảnh gì", ghép từ thư viện ảnh của kênh
- SFX whoosh/pop đồng bộ hiệu ứng + cắt theo beat nhạc nền
- Xuất đồng thời 3 khung 16:9 / 9:16 / 1:1 cho một lần dựng
- Speed ramp, chuyển cảnh xfade, counter số chạy (cần chuyển renderer sang Remotion)
