# 🕸️ Xưởng Web — quản lý web, landing page & SEO AI tự động

Bộ công cụ **không phụ thuộc thư viện ngoài** (chỉ cần Node 20+) để quản lý website
`trang-web/`: dựng trang từ nội dung JSON, tạo landing page mới, chấm điểm SEO, sinh
sitemap/schema, lập kế hoạch từ khóa và viết bài chuẩn SEO bằng `claude` CLI.

Có thể tách thành repo riêng: chỉ cần mang theo thư mục `xuong-web/` + `trang-web/`
và đặt cạnh nhau (hoặc trỏ `WEB_THU_MUC` sang thư mục site khác).

```
xuong-web/
  cli.js                 dòng lệnh chính
  may-chu.js             máy chủ xem thử + API quản trị + nhận đăng ký tư vấn
  bang-dieu-khien/       giao diện quản trị (1 tệp HTML)
  tao-anh-mau.js         sinh bộ ảnh SVG tạm cho site
  dung/                  bộ dựng: JSON → HTML
    tien-ich.js  bieu-tuong.js  khoi.js  bo-cuc.js  dung.js
  seo/                   soát SEO, sitemap, từ khóa, viết bài, tối ưu meta, vòng tự động
    soat.js  sitemap.js  tu-khoa.js  bai-viet.js  landing.js  toi-uu.js  tu-dong.js  claude.js
```

## Chạy nhanh

```bash
node xuong-web/cli.js dung     # dựng toàn bộ site
node xuong-web/cli.js xem      # http://localhost:5680 + /bang-dieu-khien
node xuong-web/cli.js seo soat # chấm điểm SEO
```

| Lệnh | Việc nó làm |
|---|---|
| `dung` | Dựng mọi trang từ `trang-web/noi-dung/` ra HTML tĩnh + sitemap + robots |
| `xem [--cong 5680]` | Máy chủ xem thử, bảng điều khiển, API nhận đăng ký tư vấn |
| `landing "<mô tả>"` | Landing page mới do AI viết nội dung (`--khong-ai` dùng mẫu trống, `--slug`, `--ghi-de`) |
| `seo soat` | Chấm điểm từng trang + xuất báo cáo `du-lieu/seo/soat-moi-nhat.md` |
| `seo sitemap` | Sinh lại `sitemap.xml` + `robots.txt` |
| `seo tu-khoa "<chủ đề>"` | AI lập kế hoạch từ khóa, xếp hàng đợi nội dung (`--so 10`) |
| `seo bai-viet "<từ khóa>"` | AI viết 1 bài 900–1400 từ, tự kiểm tra rồi lưu vào `noi-dung/blog/` |
| `seo ke-hoach` | Xem hàng đợi từ khóa: cụm nào đã viết, cụm nào còn chờ |
| `seo tu-dong` | Vòng đầy đủ: dựng → soát → sửa meta yếu → viết bài mới → dựng & soát lại |

Biến môi trường: `WEB_PORT` (5680), `WEB_MODEL` (model cho `claude`, ví dụ `claude-sonnet-5`),
`WEB_THU_MUC` (trỏ sang thư mục site khác).

## Nội dung nguồn

Mọi trang đều sinh ra từ JSON trong `trang-web/noi-dung/` — sửa JSON rồi `dung` lại, không sửa HTML:

| Tệp | Vai trò |
|---|---|
| `cau-hinh.json` | Tên, tên miền, menu, chân trang, liên hệ, màu thương hiệu, mã GA4/GTM/Pixel |
| `trang/*.json` | Mỗi tệp một trang; `tep` quyết định đường dẫn xuất ra (`landing/abc.html`) |
| `blog/*.json` | Mỗi tệp một bài viết (`html` là thân bài đã lọc an toàn) |
| `mau/landing-mau.json` | Khung landing page cho lệnh `landing` |
| `seo/tu-khoa.json` | Hàng đợi từ khóa (do `seo tu-khoa` sinh) |

Một trang là danh sách **khối**; mỗi khối có `loai` tương ứng một hàm trong `dung/khoi.js`:

`hero`, `thongSo`, `noiDau`, `soDo`, `gioiThieu`, `khoaHocChinh`, `camNhan`,
`khoaHocKhac`, `suKien`, `keuGoi`, `faq`, `loTrinh`, `noiDungTho`.

Thêm khối mới = thêm một hàm vào `dung/khoi.js` + CSS tương ứng. Khối lạ sẽ bị bỏ qua
kèm cảnh báo, không làm hỏng lần dựng.

## Bộ dựng làm sẵn phần SEO

Mỗi trang tự có: `<title>`, meta description/keywords, canonical, Open Graph, Twitter Card,
`lang`, JSON-LD (`WebSite` + `Person` + `WebPage`), và schema suy ra từ khối —
`FAQPage` từ khối `faq`, `Course` từ `khoaHocChinh`, `EducationEvent` từ `suKien`,
`BlogPosting` cho bài blog. `sitemap.xml` và `robots.txt` (cho phép cả GPTBot/ClaudeBot/PerplexityBot)
sinh lại sau mỗi lần dựng.

## Bộ soát SEO chấm điểm thế nào

100 điểm trừ dần: mỗi **lỗi** −12, mỗi **nhắc nhở** −4. Các mục kiểm tra: độ dài và
trùng lặp tiêu đề/mô tả, canonical, `lang`, số thẻ h1/h2, alt ảnh, lazy-load, Open Graph,
Twitter Card, JSON-LD hợp lệ, viewport, số từ trong `<main>`, số liên kết nội bộ, và từ
khóa chính có xuất hiện ở tiêu đề/h1 không. Báo cáo lưu ở `du-lieu/seo/`.

## Phần AI (cần `claude` CLI đã đăng nhập)

- `seo tu-khoa` → cụm từ khóa long-tail kèm ý định, độ khó, tiêu đề gợi ý → xếp hàng đợi.
- `seo bai-viet` → viết bài, **tự kiểm tra** (độ dài tiêu đề/mô tả, có h2, ≥700 từ, có từ khóa);
  chưa đạt thì yêu cầu viết lại một lần. HTML đi qua bộ lọc: bỏ `script`, `iframe`, `on*`, `style`.
- `landing` → điền nội dung theo khung `mau/landing-mau.json`, chỉ nhận khối hợp lệ.
- `seo tu-dong` → chạy cả vòng và ghi nhật ký vào `du-lieu/seo/nhat-ky.json`.

Không có `claude` trong máy: mọi lệnh dựng/soát/sitemap vẫn chạy bình thường,
phần AI báo rõ là bỏ qua.

## Bảng điều khiển

`node xuong-web/cli.js xem` → http://localhost:5680/bang-dieu-khien

Xem điểm SEO từng trang, danh sách vấn đề, hàng đợi từ khóa, đăng ký tư vấn gần đây;
bấm nút để dựng lại, soát, tạo landing, viết bài, chạy vòng SEO tự động.

Form tư vấn trên site gửi về `POST /api/dang-ky`, lưu tại `du-lieu/web/dang-ky.json`
(thư mục `du-lieu/` đã nằm trong `.gitignore`). Khi đưa site lên hosting tĩnh, đổi
`action` của form sang dịch vụ form của bạn hoặc chạy máy chủ này sau reverse proxy.

## Đưa site lên mạng

`trang-web/` sau khi dựng là **HTML tĩnh thuần** — đẩy thẳng lên Netlify, Vercel,
Cloudflare Pages, GitHub Pages hay hosting thường đều chạy. Nhớ sửa `tenMien` trong
`cau-hinh.json` trước khi dựng bản chính thức, vì canonical/OG/sitemap lấy từ đó.
