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
| `references/element-base-controls.md` | `process/modules/write-bricks/render/utils/`, `schema-traps.mjs` | Chưa đọc hết từng key |
| `references/containers-and-layout.md` | `process/modules/write-bricks/render/layout.mjs` | Chưa đọc hết từng key |
| `references/layout-recipes.md` | `render/layout.mjs` | Không lấy hero, footer mẫu, và design quality defaults |
| `references/forms.md` | `rules/form.mjs`, `widget-components/form.md`, `widget-components/input.md` | Đã vào loại ô. Không lấy webhook, create-post, multi-step |
| `references/interactions-and-animations.md` | `render/utils/interactions.mjs`, `components/states.mjs`, `modules/maintenance/animations.mjs` | Chưa đọc hết. State đã vào `states.mjs` |
| `references/responsive-breakpoints.md` | `process/modules/breakpoints/` | Không lấy mức giảm 15–25% và padding 30–40px. Mình co theo bậc, số lấy từ khung |
| `references/theme-styles-and-globals.md` | không viết theme style | Không lấy |
| `references/external-assets.md` | upload Media Library trong bước push | Không lấy hotlink và URL mẫu |
| `references/json-formats.md`, `patterns/` | không có | Không lấy. Mình không dán JSON tay |
| `references/novamira-verification.md`, `review-skill/` | `process/modules/visual-check/` | Không lấy cách verify của kệ. Mình dùng Playwright trong Docker |
| `snippets/widget-map.md` | `process/docs/widget-components/`, `kinds.mjs` | Đã vào ngày 2026-11-09. Không lấy `_gap`, URL localhost, ticker, và slider thành hàng kéo |
| `snippets/css-custom.md` | `render/utils/schema-traps.mjs` | Đã vào các bẫy CSS đã ghi trong `history/notes/components.md` |
| `references/query-loop.md` | chưa có element `posts` | Chưa đọc hết. Chỉ làm khi khung là vòng lặp |
| `references/woocommerce.md` | chưa có | Chưa đọc hết. Chỉ làm khi khung là shop |
| `references/acf-providers.md`, `references/dynamic-data.md` | chưa có | Chưa đọc hết. Chỉ làm khi plan có field |
| `references/conditions.md` | chưa có | Chưa đọc hết |
| `references/hooks.md`, `references/custom-elements.md`, `references/db-schema.md` | không thêm PHP element | Không lấy cho tới khi một khung cần hook thật |
| `references/assets-permissions.md` | `wp-content/mu-plugins/figma-to-bricks-bridge.php`, `.cursor/skills/bricks-bridge/SKILL.md` | Chưa đọc hết |
| `references/quick-reference.md` | `process/README.md`, `process/docs/AI-GUIDE.md` | Chưa đọc hết |

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
