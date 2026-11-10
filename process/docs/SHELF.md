# Kệ ANV đã đọc tới đâu

Mỗi file trong `reference/ANV_mcp/skills/` có một dòng ở đây. Cột **Chỗ của mình** là file được mở từ giờ. File kệ không được sửa để cập nhật rule.

Trạng thái:

- **Đã vào** — nội dung khớp đã nằm ở mình. Không mở file kệ để đè.
- **Không lấy** — đã xem và cố ý không dùng. Không mở lại.
- **Chưa đọc hết** — mở đúng file kệ một lần, chép phần khớp vào file mình, đổi dòng này thành Đã vào hoặc Không lấy.

## bricks-skills

| File kệ | Chỗ của mình | Trạng thái |
|---|---|---|
| `bricks-skills/SKILL.md` | `.cursor/skills/pipeline/SKILL.md`, `process/docs/DETECT.md` | Đã vào. Flow 6 phase và BEM không lấy |
| `bricks-skills/CLAUDE.md`, `README.md`, `CLEANUP.md`, `MAPPING-FIGMA-FLOW.md` | không có file tương ứng | Không lấy. Flow viết JSON tay |
| `references/popups-and-templates.md` | `process/modules/write-bricks/components/popup-settings.mjs` | Đã vào. Key đối chiếu `includes/popups.php` ngày 2026-11-09. Không có `bricks/template/id` |
| `references/elements-catalog.md` | `process/docs/widget-components/`, `components/README.md` | Đã vào ngày 2026-11-09. Tên Woo và posts chỉ được ghi là chưa nhận. README thắng khi lệch CATALOG |
| `references/element-base-controls.md` | `render/size.mjs`, `render/style.mjs` | Đã đọc hết 2026-11-09. Key spacing, typography, background, border, shadow, width min/max đã khớp. Không có `_borderRadius` riêng |
| `references/containers-and-layout.md` | `render/layout.mjs`, `render/size.mjs` | Đã đọc hết 2026-11-09. Hug đã là `_width: auto` kèm `_flexShrink: 0`. Grid dùng `_gridGap`. Không lấy `_columnCount`, `_sticky*`, `_background.layers` (không có trong 1.12.3) |
| `references/layout-recipes.md` | `render/layout.mjs` | Không lấy hero, footer mẫu, và design quality defaults |
| `references/forms.md` | `rules/form.mjs`, `widget-components/form.md`, `widget-components/input.md` | Đã vào loại ô. Không lấy webhook, create-post, multi-step |
| `references/interactions-and-animations.md` | `render/utils/interactions.mjs`, `components/states.mjs`, `popup-settings.mjs` | Đã đọc hết 2026-11-09. Popup dùng `show` + `target: popup` + `templateId`. Không có `toggle`, `addClass`, `showPopup`. Animation để pass cuối |
| `references/responsive-breakpoints.md` | `process/modules/breakpoints/` | Không lấy mức giảm 15–25% và padding 30–40px. Mình co theo bậc, số lấy từ khung |
| `references/theme-styles-and-globals.md` | không viết theme style | Không lấy |
| `references/external-assets.md` | upload Media Library trong bước push | Không lấy hotlink và URL mẫu |
| `references/json-formats.md`, `patterns/` | không có | Không lấy. Mình không dán JSON tay |
| `references/novamira-verification.md`, `review-skill/` | `process/modules/visual-check/` | Không lấy cách verify của kệ. Mình dùng Playwright headless trên máy này |
| `snippets/widget-map.md` | `process/docs/widget-components/`, `kinds.mjs` | Đã vào ngày 2026-11-09. Không lấy `_gap`, URL localhost, ticker, và slider thành hàng kéo |
| `snippets/css-custom.md` | `render/utils/schema-traps.mjs` | Đã vào các bẫy CSS đã ghi trong `history/notes/components.md` |
| `references/query-loop.md` | `process/modules/standby/query.mjs`, `widget-components/posts.md` | Đã dựng module riêng 2026-11-09. Không vào detect. Key `query` |
| `references/woocommerce.md` | `process/modules/standby/woocommerce.mjs` | Đã dựng module riêng 2026-11-09. Tên khớp file trong theme. Không vào detect |
| `references/acf-providers.md`, `references/dynamic-data.md` | `process/modules/standby/dynamic.mjs` | Đã dựng module riêng 2026-11-09. Không lấy `{shortcode:}` |
| `references/conditions.md` | `process/modules/standby/conditions.mjs`, `popup-settings.mjs` | Đã dựng `_conditions` riêng. Popup vẫn dùng `templateConditions` |
| `references/hooks.md`, `references/custom-elements.md`, `references/db-schema.md` | không thêm PHP element | Không lấy cho tới khi một khung cần hook thật |
| `references/assets-permissions.md` | bridge, CSS external files | Đã đọc phần CSS file. `cssLoading` của mình là `file`. Không lấy theme styles, critical CSS, global classes |
| `references/quick-reference.md` | `process/README.md`, `render/` | Đã đọc hết 2026-11-09. `%root%`, id 6 ký tự, breakpoint đã khớp. Không lấy global class và theme style |

## plugins

| File kệ | Chỗ của mình | Trạng thái |
|---|---|---|
| `plugins/bricks-mcp-bridge/` | `wp-content/plugins/f2b-mcp/` | Đã vào 2026-11-09. Endpoint `f2b-mcp/v1`, không trùng plugin cũ. Pipeline local vẫn dùng mu-plugin `f2b` |

## figma-skills

| File kệ | Chỗ của mình | Trạng thái |
|---|---|---|
| `figma-skills/SKILL.md`, `MAPPING-FIGMA-FLOW.md` | `process/modules/read-figma/` | Đã vào phần đọc REST và cây. Không lấy flow agent viết code UI |
| `figma-skills/figma-to-ui-rules.md` | `process/docs/DETECT.md`, `render/` | Đã vào ngày 2026-11-09. Không lấy phẳng hóa frame một con, element `icon`, và `_gridGap` |
| `figma-skills/references/FigmaToCode/README.md` | không có | Không lấy. Đó là xuất code, không phải Bricks |
| `TROUBLESHOOTING.md` | `process/modules/common/read-errors.mjs` | Đã vào cách ghi lỗi. Không chép danh sách lỗi của kệ |

## todo/rules

| File kệ | Chỗ của mình | Trạng thái |
|---|---|---|
| `todo/rules/figma_rules.md` | `render/layout.mjs`, `render/size.mjs`, `process/docs/DETECT.md` | Đã vào flex, absolute, clip, viền. Không lấy giảm chữ 15–25% và padding 30–40px. Không bỏ `State` của variant |
| `todo/rules/bricks_rules.md` | `schema-traps.mjs`, `popup-settings.mjs` | Đã đọc hết mục. Không lấy flow viết JSON, phase, `bricks-mcp`, `splideJson` đoán, carousel-dual. Lấy bẫy `brxe-container` rộng 1100px: popup phải có `popupContentWidth`. `customScriptsBodyFooter` đi theo template, `customScriptsHeader` thì không |
| `todo/rules/general_rules.md` | `process/docs/DETECT.md` | Đã đọc. Không lấy dọn `infor_todo`, URL `localhost:3845`, viết JSON tay. DOM phẳng và bọc ảnh là việc render đã làm |
| `todo/rules/prompt_mode_rules.md` | không có | Không lấy. Mình luôn có Figma, không chấm theo plan tự viết |
| `todo/rules/figma_rules.md` | `render/layout.mjs`, `components/button.mjs` | Đã vào từ trước. Gộp nút thành một element là rule của mình. Không lấy regex tên làm cổng |
| `todo/scripts/` | không chạy | Không lấy |
| `todo/plans/`, `todo/bricks-json/`, `todo/scratch/`, `todo/assets/` | không có | Không lấy. Đó là trang và JSON mẫu của kệ |

## Brick-Build-Page

`reference/Brick-Build-Page` là Bricks 2.x. Không có dòng nào ở đây cả. Không dùng cho build, template, hay docs của mình.
