# Local

Chỉ dùng khi dev muốn một WordPress trên máy mình. Staging không chạy folder này.

```bash
node local/up.mjs        # bật
node local/up.mjs stop   # dừng, giữ database
node local/up.mjs down   # xóa container và database
```

Site nằm trong `.env`. Stack máy mình nằm trong `.env.local`. `WP_URL` phải trùng cổng `WP_PORT`.

Pipeline và verify đọc `WP_URL`. Đổi `WP_URL` sang staging thì không cần bật folder này.
