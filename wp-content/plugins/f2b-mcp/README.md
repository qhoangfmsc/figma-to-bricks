# F2B MCP

Plugin WordPress của project này. Bricks **1.12.3**. Endpoint: `POST /wp-json/f2b-mcp/v1/mcp`. Plugin cũ trên staging vẫn là `bricks-mcp-bridge/v1`. Auth là Bearer token tạo lúc kích hoạt plugin. Token nằm ở Settings → F2B MCP.

Pipeline dựng template vẫn đi qua `wp-content/mu-plugins/figma-to-bricks-bridge.php` và `mcp/bricks-bridge/server.mjs` trên Docker local. Plugin này dùng khi cần đọc hoặc sửa một site đã cài nó, ví dụ staging.

Cursor gắn bằng `.cursor/mcp.json` (file này không vào git). URL và token lấy từ trang settings của đúng site. Không ghi token vào file được commit.

Tool: `get_site_info`, `list_pages`, `get_page`, `create_page`, `set_page_content`, `list_templates`, `get_template`, `create_template`, `set_template_content`, `set_page_settings`, `generate_css_file`, `upload_media`.

`cssLoading` = `file` thì `sync_css` gọi `Bricks\Assets_Files::generate_post_css_file`. Meta key lấy từ hằng `BRICKS_DB_*` của theme. Pipeline không gửi global class. Plugin chỉ gộp class khi payload có sẵn.
