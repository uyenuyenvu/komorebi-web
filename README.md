[Uploading README.md…]()
# 🍃 Komorebi — đọc truyện tranh

Code được tách theo từng chức năng, kèm môi trường chạy local với **Supabase giả lập**. Nhờ vậy có thể UT thoải mái mà không đụng tới dữ liệu thật.

## Cấu trúc thư mục

```
komorebi/
├─ public/                    ← CHỈ thư mục này được đưa lên Netlify
│  ├─ index.html              khung giao diện (HTML các màn hình, popup)
│  ├─ _redirects              cho Netlify mở index.html với mọi đường dẫn
│  ├─ config.js               URL + anon key Supabase thật (thay bằng file của cưng)
│  ├─ css/                    giao diện, nạp theo thứ tự số
│  │   00-base.css            màu, font, header, menu, form, đăng nhập
│  │   01-filters-detail-reader.css   bộ lọc, màn chi tiết, trang đọc
│  │   02-upload.css          màn upload 2 tab
│  │   03-layout-menu-home.css        nền, menu 3 chế độ, trang chủ, pulldown
│  │   04-master-dialog-settings.css  danh mục, hộp thoại, cài đặt
│  │   05-reader-user.css     lật trang, chuông, lịch sử, hồ sơ
│  │   06-icons-avatar.css    icon vẽ tay, khung avatar
│  │   07-upload-progress.css trạng thái tải từng ảnh
│  │   08-preview-roles.css   popup xem trước, phân quyền
│  │   09-header-reader-tools.css     header tự thu, nút bố cục
│  └─ js/                     logic, nạp theo thứ tự số (thứ tự quan trọng!)
│      01-auth.js             đăng nhập / đăng ký / đăng xuất
│      02-core.js             hằng số, tiện ích, tải dữ liệu từ Supabase
│      03-navigation.js       chuyển màn, menu bên
│      04-pulldown.js         pulldown checkbox dùng chung
│      05-home.js             trang chủ
│      06-library.js          thư viện, tìm kiếm, phân trang
│      07-detail.js           chi tiết truyện
│      08-reader.js           trang đọc
│      09-upload.js           upload, nén ảnh, tải song song, thử lại
│      10-header-autohide.js  header tự thu khi lướt
│      11-router.js           đường dẫn riêng cho từng màn (/thu-vien, /truyen/…)
│      12-roles.js            phân quyền uploader / reader
│      13-password.js         đổi mật khẩu
│      14-publish-preview.js  popup xem trước trước khi đăng
│      15-master-data.js      thể loại & tiến độ
│      16-theme.js            sáng / tối
│      17-edit-manga.js       sửa / xoá truyện, xoá chương
│      18-user.js             hồ sơ, yêu thích, lịch sử, thông báo
│      19-reading-layout.js   bố cục đọc dọc / ngang
│      99-boot.js             khởi động (luôn nạp cuối cùng)
├─ dev/                       chỉ dùng khi chạy local
│  ├─ server.mjs              dev server (Node 18+, không cần cài gói)
│  ├─ server.py               dev server bản Python (khi máy không có Node)
│  ├─ config.mock.js          cấu hình chế độ giả lập (độ trễ, tỉ lệ lỗi)
│  └─ mock-supabase.js        Supabase giả chạy ngay trong trình duyệt
├─ schema-komorebi.sql        dựng database thật trên Supabase
└─ package.json
```

> Các file JS là script thường, dùng chung biến toàn cục. Nếu thêm file mới, đặt số thứ tự sao cho nó nạp **sau** những file mà nó dùng tới, và luôn **trước** `99-boot.js`.

## Chạy local với Supabase giả lập (để UT)

```bash
cd komorebi
npm run dev            # hoặc: node dev/server.mjs
# máy không có Node:   python dev/server.py
```

Mở **http://localhost:5173** rồi đăng nhập bằng một trong hai tài khoản demo:

| Tài khoản | Mật khẩu | Quyền |
|---|---|---|
| `uploader@komorebi.local` | `123456` | Đăng, sửa truyện và danh mục |
| `reader@komorebi.local` | `123456` | Chỉ đọc |

Dữ liệu giả hoạt động như sau:
- Có sẵn **6 bộ truyện mẫu**, ảnh bìa và trang vẽ bằng SVG. Có sẵn danh mục mặc định, vài truyện yêu thích, lịch sử đọc và thông báo.
- Mọi thao tác đều chạy thật trên giao diện: upload ảnh thật, sửa, xoá, đổi mật khẩu… Dữ liệu chỉ nằm trong trình duyệt (localStorage và IndexedDB), **tải lại trang vẫn còn**. Không có gì được gửi lên Supabase thật.
- Phân quyền mô phỏng giống schema thật. Tài khoản `reader` cố ghi dữ liệu sẽ nhận lỗi `row-level security` như trên máy chủ.
- Góc dưới màn hình có huy hiệu **🧪 MOCK**, cho biết đang đăng nhập bằng ai, kèm nút **làm mới dữ liệu** để xoá sạch về dữ liệu mẫu.

Mấy lệnh tiện cho UT, gõ trong Console của trình duyệt (F12):

```js
__mock.users                                          // danh sách tài khoản demo
__mock.db()                                           // xem toàn bộ dữ liệu giả hiện tại
__mock.setRole('reader@komorebi.local', 'uploader')   // đổi quyền, rồi tải lại trang
__mock.reset()                                        // xoá sạch, quay về dữ liệu mẫu
```

Muốn giả lập mạng chậm hoặc chập chờn (ví dụ để test chức năng tự thử lại khi upload), sửa `dev/config.mock.js`:

```js
window.KOMOREBI_MOCK = { latency: 600, failRate: 0.3 };   // trễ 0.6s, 30% lần tải ảnh bị lỗi
```

## Chạy local với Supabase thật

Dùng chế độ này khi cần thử với một project Supabase test riêng.

```bash
npm run dev:real       # dùng public/config.js
```

## Đưa lên Netlify

1. Đặt `config.js` thật của cưng vào `public/`.
2. Kéo thả **thư mục `public`** lên tab Deploys của site, không kéo cả thư mục `komorebi`.
3. Nếu có thay đổi database thì chạy lại `schema-komorebi.sql` trong Supabase → SQL Editor. Chạy lại nhiều lần cũng an toàn.

Thư mục `dev/` không bao giờ được đưa lên. Bản trên Netlify luôn dùng Supabase thật.
