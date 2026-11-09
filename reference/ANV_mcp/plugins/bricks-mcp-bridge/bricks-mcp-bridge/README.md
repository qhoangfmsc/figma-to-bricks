# Bricks MCP Bridge

WordPress plugin — MCP server cho Bricks Builder (Streamable HTTP).

## Cài lên web — bạn cần tự deploy

Plugin **không** nằm trên npm/composer. Source trong repo `plugins/bricks-mcp-bridge/` — copy lên từng site WordPress có Bricks:

| Cách | Lệnh / thao tác |
|------|------------------|
| Docker local | `docker cp plugins/bricks-mcp-bridge <container>:/var/www/html/wp-content/plugins/` |
| FTP / SFTP | Upload folder vào `wp-content/plugins/bricks-mcp-bridge/` |
| Zip | Nén folder → WP Admin → Plugins → Add New → Upload |
| Server có git | Clone/pull repo, symlink hoặc copy folder plugin |

Sau đó: **Plugins → Activate → Bricks MCP Bridge** → copy Bearer token vào `.env` (`BRICKS_MCP_TOKEN`).

Mỗi môi trường (local / staging / production) cần **bản plugin + token riêng**.

## Inline vs External files — dùng cả hai không lỗi

Bricks → **Settings → Performance → CSS loading method**:

| Setting | Bricks làm gì | MCP cần gì |
|---------|----------------|------------|
| **Inline styles** (mặc định) | CSS trong `<style>` mỗi request | Không cần generate file |
| **External files** | File `uploads/bricks/css/post-{id}.min.css` | Cần generate sau upload |

### `sync_css: true` (khuyến nghị trong DO)

Gọi sau mỗi `set_template_content` — **tự theo setting site**:

- **External** → gọi `Assets_Files::generate_post_css_file()` cho template vừa upload
- **Inline** → trả về success, `generated: false`, **không lỗi**

```json
{
  "template_id": 8036,
  "elements_json": "...",
  "sync_css": true
}
```

Python (mặc định `sync_css=True`):

```python
from scripts.lib.bricks_mcp import get_site_info, set_template_content

info = get_site_info()
print(info["css_loading"], info.get("css_loading_label"))  # inline | file

set_template_content(8036, elements)  # sync_css=True mặc định
```

### `page_settings_json` (section screenshot)

Ẩn site header/footer trên preview template — giống Bricks export `pageSettings`:

```json
{
  "template_id": 8041,
  "elements_json": "[...]",
  "page_settings_json": "{\"headerDisabled\":true,\"footerDisabled\":true}"
}
```

`get_template` trả thêm `page_settings`. Merge vào meta `_bricks_page_settings`.

Python:

```python
from scripts.lib.bricks_mcp import SECTION_REVIEW_PAGE_SETTINGS, set_template_content

set_template_content(8041, elements, page_settings=SECTION_REVIEW_PAGE_SETTINGS)
```

### Tool riêng

| Tool | Khi nào |
|------|---------|
| `set_page_settings` | Chỉ ghi `headerDisabled` / `footerDisabled` — không re-upload elements |
| `generate_css_file` | Chỉ regenerate 1 template (external mode) |
| `regenerate_css` | Toàn site — hiếm khi cần trong DO |
| `get_site_info` | Đầu phiên — xem `css_loading` / `css_loading_label` |

### Element id — đúng 6 ký tự

MCP **từ chối** upload nếu `id` không khớp `^[a-zA-Z0-9]{6}$` (ví dụ `cmgrd` 5 ký tự → lỗi).

- G1 Python (`validate_template_json.py`) cùng rule
- Đổi `pageSettings` trên template có id lỗi: dùng `set_page_settings` (không cần re-upload elements)

```python
from scripts.lib.bricks_mcp import SECTION_REVIEW_PAGE_SETTINGS, set_page_settings

set_page_settings(SECTION_REVIEW_PAGE_SETTINGS, template_id=8039)
```

## Version 1.2.0

- `page_settings_json` trên `set_template_content` / `set_page_content`
- `get_template` trả `page_settings`
- Tool `set_page_settings` — merge `_bricks_page_settings` không qua elements
- Element id validation: **chỉ 6 ký tự alphanumeric**

## Version 1.1.0

- `generate_css_file` — 1 post/template
- `sync_css` — an toàn với mọi CSS loading method
- `generate_css` — alias của `sync_css`
