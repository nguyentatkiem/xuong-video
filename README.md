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
| `mlx_whisper` | ⚪ | `uv tool install mlx-whisper` (Apple Silicon). Không có → bỏ qua phụ đề + từ khoá, các bước khác vẫn chạy. Lần dựng đầu sẽ tải model (~1,6GB). |

Biến môi trường: `PORT` (mặc định 5675), `XUONG_FFMPEG` (ép đường dẫn ffmpeg), `XUONG_MODEL` (model cho claude, ví dụ `claude-sonnet-5`), `XUONG_BO_QUA_CLAUDE=1` (tắt đạo diễn AI), `XUONG_WHISPER_MODEL` (mặc định `mlx-community/whisper-large-v3-turbo`), `XUONG_NGON_NGU` (mặc định `vi`), `XUONG_DAO_DIEN_MAT=0` (tắt việc đạo diễn xem khung hình), `XUONG_TU_SOAT=0` (tắt lượt tự soát), `XUONG_PEXELS_KEY` (bật ảnh stock Pexels).

> Lưu ý PATH: whisper tự gọi `ffmpeg` trong PATH để đọc audio — app đã tự chèn thư mục của bản ffmpeg tốt vào PATH khi gọi whisper, nên không cần chỉnh gì thêm.

## Pipeline v2 (8 bước cho mỗi video)

```
video gốc
 1. ffprobe        → đọc thông tin
 2. silencedetect  → CẮT KHOẢNG LẶNG
 3. whisper        → transcript từng từ (large-v3-turbo, tiếng Việt)
 4. claude -p      → ĐẠO DIỄN CÓ MẮT: tự Read các khung hình mẫu + transcript + manifest media
                     → EDL v2: chia CẢNH gán động tác camera, từ khoá, chương, ảnh chèn,
                       số đếm, cặp sửa lỗi transcript, tiêu đề/mô tả/tags
 5. ffmpeg render  → CAMERA ẢO (push-in / pull-out / pan trái-phải / punch-in / rung)
                     + flash chuyển chương + màu + ảnh/B-roll overlay
                     + phụ đề karaoke có tô từ khoá + thẻ chương động + progress bar
                     + counter số chạy + CTA cuối + SFX bám sự kiện + nhạc nền ducking → −14 LUFS
 6. tự soát        → claude xem khung hình BẢN DỰNG, chưa đạt thì tự sửa EDL và render lại 1 lần
 7. xuất đa khung  → tuỳ chọn thêm 16:9 / 9:16 / 1:1 dùng chung EDL
 8. xuất bản       → ra*.mp4 + mo-ta-seo.md + phu-de.srt + bao-cao.json
```

## CLI dựng hàng loạt

```bash
node scripts/dung.js video.mp4 --style podcast-hormozi --tieu-de "..." --ten-kenh "@kenh"
node scripts/dung.js thu-muc/ --style storytime --muc-cat manh --xuat-them ngang,vuong
```

## Thư viện của kênh

- `media/` + `media/manifest.json` — ảnh/B-roll của kênh kèm mô tả; đạo diễn chỉ được chèn tệp có trong manifest. Có `XUONG_PEXELS_KEY` thì đạo diễn được phép yêu cầu ảnh stock (`"tep": "pexels:mô tả"`).
- `sfx/` — 5 tệp tổng hợp sẵn (whoosh/pop/ding/tick/riser, tạo bởi `scripts/tao-sfx.sh`), thay tệp xịn hơn tuỳ ý.
- `nhac/` — nhạc nền theo mood (xem `nhac/DOC-TOI.md`); tự ducking khi có giọng nói.

## Đồ hoạ HTML (v3 — học từ skill "AI Dark Keynote")

Ngoài lớp chữ ASS, các style có `"doHoaHtml": true` render **lớp đồ hoạ HTML/CSS thật** qua Chromium (Playwright): 18 module (tag, rows, bigtype, myth gạch đỏ, chart vẽ dần, gridfill, flow, steps, lockup, cta, counter, progress, lower3…), video lồng thẻ bo góc trên canvas có lưới + quầng sáng (`"khungThe": true`), phụ đề 0,8–1,3s/dòng bôi vàng từ khoá, và **soi bố cục bằng đo đạc thật trước khi render** (đè thẻ/đè phụ đề/đè nhau → đạo diễn tự sửa toạ độ, còn lỗi thì gỡ phần tử).

- Mỗi style một `skin` (token màu + nền) trên cùng engine `do-hoa/overlay.html` — thêm skin là thêm chất mới
- Cần `pnpm install` + `npx playwright install chromium`; thiếu Chromium thì tự rơi về lớp ASS
- Render chậm hơn (~5–7× thời lượng clip); UI có công tắc "Lớp đồ hoạ: Đẹp (HTML) / Nhanh (ASS)"
- Font Be Vietnam Pro (giấy phép OFL) đóng gói trong `assets/fonts/`

## Style

12 style trong [styles/](styles/) — mỗi style là **một tệp JSON**, muốn thêm style mới chỉ cần thêm tệp (không sửa code):

- **AI Dark Keynote** 🌒 — style học nguyên bản từ video mẫu: đen ấm + vàng, thẻ video đổi khung, đồ hoạ dựng theo lời nói

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

- Speed-ramp có giữ khớp tiếng (đổi kiến trúc lượt 1)
- Cắt theo beat nhạc nền (aubio) + whip-pan có nhoè chuyển động
- Chuyển renderer sang Remotion cho bảng so sánh/scorecard động ngoài tầm ASS
- Nhiều worker song song cho hàng đợi

## v4 — FFmpeg nâng cao + engine học Remotion (không license)

- **Speed-ramp giữ khớp tiếng**: đạo diễn trả `ramp[]`, pass1 setpts+atempo từng khúc, mọi mốc phụ đề/đồ hoạ được ánh xạ thời gian theo (`taoAnhXaThoiGian`); `cham: true` bật slow-mo nội suy khung `minterpolate`
- **Chuyển cảnh xfade** tại ranh giới khung thẻ (style khai `chuyenCanh[]`) — giữ nguyên thời lượng bằng kỹ thuật đóng băng khung cuối rồi quét sang cảnh mới, tiếng không bị đụng
- **5 module mới** (tổng 23): `waveform` (sóng âm nhảy theo tiếng, peaks bóc bằng ffmpeg), `sticker` (mũi tên/confetti/lấp lánh vẽ canvas), `lottie` (bỏ tệp LottieFiles vào `lottie/`), `databar`/`datapie` (biểu đồ SỐ LIỆU THẬT động); mọi module thêm được `vao3d: true`
- **Beat-reveal**: style có `beatSync: true` (fast-paced, storytime, review-doc) tự nẹp đồ hoạ vào phách nhạc dò từ sóng âm
- **Style 14 "Audiogram"** 🌊 cho nội dung thuần tiếng; **loudness 2-pass** đo thật rồi chuẩn tuyến tính
- Đã cân nhắc MoviePy (bỏ — chậm, trùng năng lực) và Remotion (học kiến trúc; nếu sau này tích hợp thật: miễn phí cá nhân/công ty ≤3 người, tổ chức lớn hơn cần license Automators $0.01/render)
