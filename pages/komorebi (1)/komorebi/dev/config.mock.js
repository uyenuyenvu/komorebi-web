// Cấu hình khi chạy local với Supabase GIẢ LẬP (npm run dev)
// File này chỉ được dùng bởi dev server, không bao giờ đưa lên Netlify.
window.SOBEP_CONFIG = {
  SUPABASE_URL: "https://mock.komorebi.local",
  SUPABASE_ANON_KEY: "mock-anon-key"
};
window.KOMOREBI_MOCK = {
  latency: 120,   // độ trễ giả lập mỗi lần gọi máy chủ (ms)
  failRate: 0     // tỉ lệ lỗi mạng khi tải ảnh, VD 0.3 = 30% để test chức năng tự thử lại
};
