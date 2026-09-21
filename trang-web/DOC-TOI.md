# 🌐 trang-web — website Nguyễn Tất Kiểm

Website tĩnh dựng bằng [Xưởng Web](../xuong-web/DOC-TOI.md). **Không sửa tệp `.html` ở đây** —
chúng được sinh lại mỗi lần dựng. Sửa nội dung trong `noi-dung/`, sửa giao diện trong `tai-nguyen/`.

```
trang-web/
  noi-dung/            ← nguồn nội dung (sửa ở đây)
    cau-hinh.json        tên, tên miền, menu, liên hệ, mạng xã hội, mã đo lường
    trang/*.json         trang chủ, landing page, trang chính sách
    blog/*.json          bài viết
    mau/landing-mau.json khung landing page cho lệnh tạo tự động
  tai-nguyen/          ← tài nguyên tĩnh (sửa ở đây)
    css/style.css        toàn bộ giao diện
    js/app.js            menu, tìm kiếm, form tư vấn, đếm số
    anh/*.svg            ảnh (hiện là ảnh mẫu, xem bên dưới)
  index.html  landing/  blog/  sitemap.xml  robots.txt   ← tự sinh, đừng sửa tay
```

## Sửa nội dung

```bash
node xuong-web/cli.js xem    # sửa JSON → bấm "Dựng lại site" ở bảng điều khiển → F5
```

Trước khi chạy thật, sửa trong `noi-dung/cau-hinh.json`:

- `tenMien` — canonical, Open Graph và sitemap đều lấy từ đây.
- `lienHe` — email, điện thoại hiển thị ở chân trang.
- `mangXaHoi` — link thật của YouTube/Facebook/LinkedIn/TikTok.
- `seo.phanTich` — điền `ga4`, `gtm` hoặc `facebookPixel` thì mã đo lường tự được chèn.

## Thay ảnh thật

Ảnh trong `tai-nguyen/anh/` hiện là **ảnh mẫu SVG** do `node xuong-web/tao-anh-mau.js` sinh ra.
Thay bằng ảnh thật bằng cách ghi đè đúng tên tệp (đổi đuôi thì sửa đường dẫn trong JSON):

| Tệp | Dùng ở đâu | Gợi ý kích thước |
|---|---|---|
| `chan-dung-hero.svg` | Ảnh lớn ở hero | 1040×1280, nền đã tách |
| `chan-dung-trich-dan.svg` | Khối “Vì sao doanh nghiệp cũ quá nặng” | 960×840 |
| `chan-dung-gioi-thieu.svg` | Khối “Nguyễn Tất Kiểm là ai?” | 960×1120 |
| `chan-dung-so-do.svg` | Ảnh tròn giữa sơ đồ | 480×480 |
| `chan-dung-cta.svg` | Dải kêu gọi hành động | 480×640, nền đã tách |
| `hop-solo-ai-ceo.svg` | Hộp sản phẩm khóa học | 840×840 |
| `hoc-vien-1…4.svg` | Ảnh đại diện học viên | 192×192 |
| `video-1…3.svg` | Ảnh nền video cảm nhận | 960×540 |
| `khoa-hoc-1…6.svg` | Bìa 6 khóa học | 1120×490 |
| `su-kien-1…3.svg` | Ảnh sự kiện | 600×600 |
| `og-mac-dinh.svg` | Ảnh xem trước khi chia sẻ | 1200×630 |

Ảnh chụp thật nên dùng `.webp` hoặc `.jpg` đã nén; nhớ giữ `alt` mô tả đúng trong JSON
để không rớt điểm ở bộ soát SEO.

## Form đăng ký tư vấn

Nút “Đăng ký tư vấn” mở hộp thoại, gửi `POST /api/dang-ky`. Khi chạy `xuong-web` làm máy chủ,
dữ liệu lưu ở `du-lieu/web/dang-ky.json` và hiện trong bảng điều khiển. Nếu đưa lên hosting
tĩnh, sửa `action` của form trong `xuong-web/dung/bo-cuc.js` sang dịch vụ form bạn dùng
(Google Form, Formspree, webhook CRM…) rồi dựng lại.
