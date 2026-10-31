# Rules: Figma → Bricks

Các quy tắc bắt buộc khi thực thi flow trong `flow_figma_to_bricks.md`. File này sẽ được bổ sung dần trong quá trình làm việc.

## Phạm vi

1. **Template**: CHỈ tạo template loại `section`. KHÔNG tạo header/footer template.
2. **Media**: KHÔNG upload media vào WordPress. Element image/icon dùng trực tiếp **URL Figma MCP từ xa** `https://www.figma.com/api/mcp/asset/<uuid>/<file>` — **không** dùng `localhost:3845`, **không** kiểm tra lại / refill URL sau khi build. Vì không kiểm tra lại, URL phải **đúng node ngay từ PLAN**:
   - Chỉ lấy từ phản hồi `get_design_context` (`assetPathPrefix` + tên file) qua `analyze_figma_section.py --assets` / `--asset` → `scripts/data/<slug>/assets.json`. **Cấm** gõ tay hoặc ghép prefix của phiên MCP khác.
   - Script chỉ lan 1 URL sang node khác khi chứng minh được cùng asset: cùng `imageRef` (bitmap) hoặc cùng lớp component master + cùng màu/kích thước (icon). Còn `CHƯA CÓ` / `⚠ asset lớp trong` → gọi `get_design_context` cho đúng node đó, không chọn đại.
   - Builder lấy URL từ `spec.json` (`load_node_settings`) theo node id; plan header ghi `- Asset map: \`scripts/data/<slug>/assets.json\`` để **G1** chặn URL không thuộc map, `<asset:…>` và `localhost:3845`.
3. **Page mới** luôn tạo với status `draft`. Chỉ publish khi user xác nhận rõ ràng.
4. KHÔNG ghi đè page/template có sẵn khi user chưa chỉ định rõ `page_id`/`template_id`.

## Cấu trúc element

5. Element ID: đúng 6 ký tự hex lowercase (`f8a206`), unique trong payload. Gán ngay khi viết tree nguồn qua `ElementIdFactory(template_id).next()` — **không** dùng semantic id rồi remap sau.
6. `parent`/`children` phải khớp 2 chiều: nếu A có con B thì B phải có `parent: A` và A phải chứa B trong `children`.
7. Cấu trúc phân cấp chuẩn: `section` → `container` → (`block`/`div`) → element lá. Không đặt element lá trực tiếp dưới `section`.
8. Heading phải đặt `tag` đúng phân cấp (1 `h1` mỗi page, sau đó `h2`, `h3`...).

## Styling

9. Thứ tự ưu tiên: Core Framework classes → inline settings → custom CSS. Không viết custom CSS khi utility class hoặc settings làm được.
10. Responsive là bắt buộc @ **`:tablet_portrait` (991px)** — khớp review mobile ở bề rộng frame Figma mobile (rule 46). Chỉ thêm `:mobile_portrait` khi Figma có diff riêng ≤478px.
11. **1 template / 1 section** — desktop và mobile trong cùng template Bricks. **Mỗi section** chọn **một** chiến lược: `breakpoint-only` | `slider-responsive` | `dual-block` | `carousel-dual` | `n/a`. **Không** tạo template section thứ hai cho mobile.
12. **Widget mapping (PLAN):** map Figma → widget qua `snippets/widget-map.md` + **`bricks-skills/references/elements.md`**. Settings: **`style-settings.md`**. **Chiến lược theo layout Figma mobile** — không ép pattern: peek carousel → `slider-responsive`; scroll row thuần (không Splide) → `carousel-dual` (G0 bắt widget mobile scroll/div); còn lại theo Figma. Chi tiết: `bricks-skills/MAPPING-FIGMA-FLOW.md`.
13. **DO tuần tự:** với mỗi template, đạt **≥98% Desktop** (1440px, mục tiêu **100%**) rồi mới build/review **Mobile** (bề rộng frame Figma mobile — rule 46). Không nhảy template tiếp khi mobile chưa pass (trừ chiến lược `n/a`) — **ngoại lệ:** section đã hết giới hạn rule 39 → ghi fail rồi sang template kế (rule 56).
14. Màu sắc, font lấy đúng từ Figma (qua `get_variable_defs` hoặc design context), không tự chế giá trị. Section root mang `font-optical-sizing: none` (`SECTION_ROOT_CSS`): Figma dựng Inter ở `opsz` 14 còn browser mặc định `auto` → `opsz` 32 ở cỡ heading, chữ hẹp ~4% và wrap khác thiết kế.
15. Global classes mới phải có `id` và `name` rõ ràng, không trùng với class có sẵn trên site.

## Quy trình

16. Luôn gọi `get_site_info` xác nhận kết nối trước khi thực thi.
17. Với design dài, đọc Figma theo từng section (`get_design_context` từng node) — không đọc cả page một lần. PLAN phân tích **Desktop + Mobile** (2 luồng); DO build **Desktop → Mobile** tuần tự.
18. Sau mỗi lần ghi (`create_page`, `set_page_content`, `create_template`, `set_template_content`) phải đọc lại (`get_page`/`get_template`) để xác nhận số element đã lưu.
19. Một page dài thì ghi 1 lần duy nhất với đầy đủ elements — không ghi từng section chồng lên nhau (mỗi lần `set_page_content` là REPLACE toàn bộ, không phải append).
20. **Bắt buộc báo link:** ngay sau khi tạo xong page hoặc template (kể cả khi chưa DONE hay còn đang review), luôn gửi cho user link `url` (xem trực tiếp) và `edit_url` (mở Bricks editor) dạng markdown clickable. Không được kết thúc lượt mà thiếu link. Báo cáo sau khi hoàn thành: `page_id`/`template_id`, `url`, `edit_url`, số element, số global classes thêm mới; bảng **Desktop % | Mobile %** từng section.
21. **Trước DO:** `spec.md` báo `Asset chưa resolve: **0**` và không còn dòng `⚠ asset lớp trong` (rule 2). Không warm-up / `check_assets.py` — URL không được kiểm tra lại sau build.
22. **Label page:** mỗi element `template` trên page phải có field **`label` top-level** (và `_label` trong settings) — xem `snippets/page-template-label.json`.
23. **Review (5 gates):** G0 spec trong plan → **G1** → UPLOAD → **G2** → **G2.5** → **G3** (`review_gates --per-section`, `pageSettings` ẩn chrome) → **G4** so Figma section node (xem **Định nghĩa G4**). **DONE:** thêm full page PNG (`G3.5`). Không pass/fail G4 chỉ từ URL template preview không qua page.
24. **Sửa sau review:** ưu tiên `patch_template.py`; sau PATCH chạy `review_gates.py`. Ảnh sai node → sửa `assets.json` từ `get_design_context` rồi rebuild (không refill). Patch mobile không được phá desktop — re-run G2 desktop nếu nghi ngờ.
25. **Không dùng** `wp-cli`, database thủ công, hay REST `wp/v2/bricks_template` — thao tác template qua **Bricks MCP** only.
26. **Figma Desktop** không bắt buộc — asset lấy qua Figma MCP từ xa (rule 2).
27. Icon/ảnh từ Figma: dùng URL Figma MCP theo rule 2 — không thay bằng Font Awesome khi user yêu cầu fidelity cao.
28. **External CSS:** Bricks Settings → Performance → **External files**. Sau `set_template_content` gọi MCP `generate_css_file` (1 template) hoặc truyền `generate_css: true`. `regenerate_css` MCP = toàn site, chỉ khi cần refresh global.
29. **Dọn dẹp:** chỉ khi user cập nhật `work_info.md` → `Dọn dẹp: có` và gửi lại sau DONE bước 5 — xem bước 7 trong `flow_figma_to_bricks.md`.
30. **Script build mới mỗi lần thực thi:** đọc `work_info.md` → PLAN/DO phải **phân tích Figma + plan** và viết `scripts/build_<page-slug>.py` (hoặc build trực tiếp qua MCP) **mới cho page đó**. **KHÔNG** copy/khôi phục artifact phiên trước. **KHÔNG** `get_template(ID page khác)` + `deepcopy` upload sang template mới — dù cùng Figma frame (rule 48). Chỉ tái dùng `scripts/lib/*`, `snippets/*`, **`bricks-skills/`**, tooling chung.
31. **Catalog widget Bricks:** tra `bricks-skills/references/elements.md` + `style-settings.md`. Pattern: `bricks-skills/patterns/`. Mapping: `bricks-skills/MAPPING-FIGMA-FLOW.md`.
32. **Plan một file / page:** `plans/<page-slug>.md` — scripts G0/G2.5/review đọc file này. Section phức tạp: element tree + settings snapshot + G2 rules trong block section; annex tùy chọn `plans/<slug>/sections/`.
33. **Vòng lặp DO:** sau UPLOAD → G1→G2→G2.5→G3 (auto); G4 (auto + checklist agent); fail → PATCH/rebuild → lặp **cùng viewport**; desktop ≥98% mới mobile; PATCH mobile → re-run G2 desktop nếu nghi ngờ.

## G4 và kết thúc phiên (bắt buộc từ 2026-06)

> **Định nghĩa G4 (nguồn duy nhất — file khác chỉ trỏ về đây).** Một section × viewport **pass G4** khi đủ **cả hai**:
>
> 1. **G4 auto:** `g4_visual_gate.py` similarity **≥ 98%** với tham số chuẩn (`G4_THRESHOLD_PCT` · `G4_BLUR_RADIUS` · `G4_PIXEL_TOLERANCE` trong `scripts/lib/visual_compare.py`) — desktop @1440, và mobile @ bề rộng frame Figma mobile (`scripts/lib/review_viewport.py`) nếu plan có Figma Mobile URL. Đổi `--threshold` / `--blur-radius` / `--font-tolerance` = chỉ chẩn đoán, script trả fail.
> 2. **Checklist:** agent so Figma PNG ↔ `tpl_*` cùng viewport, ghi `✅` / `❌` từng dòng `### G4 acceptance checklist`; `validate_g4_evidence.py --require-checklist` exit 0.
>
> Rubric % (`review-skill/rubric.md`) chỉ để **chẩn đoán** khi G4 fail — không phải điều kiện pass. G4 do **agent** chốt (không chuyển QA từng section cho user); **user xác nhận visual là điều kiện của DONE**, không phải của G4.

37. **Cấm ghi G4 pass / DONE** khi chưa đủ 2 điều kiện ở **Định nghĩa G4**. **Cấm** ghi % G4 nếu chỉ pass G1–G3.
38. **Cấm kết luận “khớp Figma”** chỉ từ mô tả screenshot hoặc chỉ từ % G4 auto. Checklist bắt buộc so Figma node screenshot (MCP/export) **và** Bricks `tpl_*` cùng viewport — agent tự so, **không** chuyển QA cho user.
39. **PATCH trong DO:** mỗi section tối đa **2 vòng PATCH→G2→G3→G4** cùng viewport (`MAX_PATCH_ROUNDS` trong `ldp_autopilot.py`). Vượt 2 vòng hoặc PATCH làm điểm giảm → **dừng section** (không dừng flow), ghi fail + nguyên nhân vào plan/work_info rồi **chuyển section kế**; **không** PATCH thêm section đó trong cùng phiên trừ khi user mở phiên mới. `ldp_autopilot.py` mặc định **single-pass** (không PATCH); `--until-pass` mới PATCH và tự giới hạn theo rule này.
40. **Không lan man trong DO:** chỉ build/review đúng plan + `work_info.md` (template trong danh sách, không thêm section). **Không** hỏi user xác nhận từng lỗi visual — chỉ dừng khi gặp blocker cứng của rule 56.
41. **Kết thúc phiên:** user báo dừng hoặc DONE fail → cập nhật `work_info.md`: `Trạng thái DONE: chưa`, **thu hồi** mọi G4 pass chưa có checklist; ghi `Phiên: kết thúc`. **Không** tiếp tục build/PATCH sau khi user kết thúc phiên.

## Responsive — ít rule, một nguồn sự thật

> Thêm nhiều rule desktop + mobile **song song** (Critical rules, `_cssCustom` desktop + mobile, PATCH chồng PATCH) thường **tệ hơn lần build đầu** — rule mâu thuẫn nhau, gate pass cấu trúc nhưng layout vỡ.

42. **Plan mỗi section chỉ 3 lớp thông số:** (1) **Measurements** từ Figma desktop · (2) **`Mobile diff`** — bullet **chỉ** thứ thay đổi @991px · (3) **Settings snapshot** — giá trị Bricks, không lặp lại prose Desktop/Mobile.
43. **Cấm** duplicate: không cần block “Bricks widgets Desktop” + “Mobile” riêng nếu cùng DOM — ghi **một cây** + `Mobile diff`. **Cấm** thêm `Critical rules` ngoài snapshot (G2.5 đọc strategy + snapshot là đủ).
44. **Responsive = override tối thiểu:** ưu tiên `_padding:tablet_portrait`, `_direction:tablet_portrait`, `perPage:tablet_portrait` trong **settings Bricks**. `_cssCustom:tablet_portrait` **chỉ khi** settings không làm được — **một khối** / slider, không PATCH thêm CSS mobile sau khi desktop đã có `_cssCustom`.
45. **Build một lần đúng > PATCH sửa rule:** lần đầu đọc Figma node + snapshot → builder. Fail G4 → **sửa builder gốc** (rebuild upload), không stack patch JSON/`_cssCustom` lẻ tẻ. Vượt 2 vòng → dừng section (rule 39).
46. **Một breakpoint review mobile:** Figma chỉ Desktop + 1 frame mobile → chỉ `:tablet_portrait` (991px). **Chụp đúng bề rộng frame mobile của Figma** (375 / 390 / 414…, lấy từ `scripts/lib/review_viewport.py`), vì PNG tham chiếu được export 1:1; scale PNG về 390 cố định khiến browser vẫn layout ở 390 CSS px còn mọi số đo tham chiếu phình vài %, G4 lệch dần theo chiều dọc. **Không** bắt buộc `:mobile_portrait` (478px) trừ khi Figma có diff riêng.

47. **Đồng bộ tài liệu sau khi sửa flow:** cùng một lần cập nhật `rule_for_flow.md`, `flow_figma_to_bricks.md`, `review-skill/SKILL.md`, `plans/_plan-template.md`, `snippets/widget-map.md`, `bricks-skills/MAPPING-FIGMA-FLOW.md`, `scripts/validate_plan_g0.py`, `scripts/validate_build_script.py`, `scripts/lib/figma_section_order.py`. Plan đang build giữ banner **legacy**; plan mới chạy G0 `--strict`. **Không** DO/PATCH section legacy trước khi migrate snapshot.
48. **Cấm clone template page khác:** builder **KHÔNG** được `get_template(ID)` ngoài plan hiện tại rồi `deepcopy` → `set_template_content`. G4 có thể pass ~98% dù layout sai nếu kế thừa bug V1 ("khung đúng, layout sai"). Builder phải đọc Figma `get_design_context` + **Settings snapshot** trong plan.
49. **G0.5 build independence:** trước UPLOAD đầu DO, chạy `validate_build_script.py` (hoặc G0 tích hợp). Fail nếu phát hiện clone. Chỉ bypass `--allow-clone` / `BUILD_ALLOW_CLONE=1` khi debug — **cấm** ghi DONE khi build source = clone.
50. **G4 không chỉ % tổng:** so từng vùng (heading, grid, spacing, CTA). Nghi ngờ clone hoặc layout lệch dù gate pass → **rebuild từ Figma** (rule 45), không stack PATCH.
51. **Thứ tự section trên page:** `set_page_content` phải khớp thứ tự frame con trong Figma parent (`get_metadata`, sort theo `y`). PLAN ghi bảng `# | Figma name | node | template_id` theo thứ tự đó. **Cấm** sắp xếp theo template ID hay thứ tự build tuỳ ý.
52. **Thứ tự DO:** build + review **tuần tự** đúng bảng plan (section 1 → n). Desktop ≥98% → mobile ≥98% **cùng section** rồi mới section kế. Floating overlay **cuối** danh sách build (trước Footer nếu có).
53. **Thứ tự phiên (sửa chất lượng):** (1) cập nhật rule/flow/validate · (2) PLAN từ Figma metadata · (3) builder đọc `get_design_context` + Settings snapshot · (4) G4 theo **Định nghĩa G4** (rubric chỉ chẩn đoán vùng lệch) · (5) DONE **chỉ khi user xác nhận visual**. **Cấm** ghi DONE ngay sau G1–G3.
54. **`build_source: figma` hợp lệ** chỉ khi builder sinh tree từ Figma MCP/plan snapshot. **Cấm** gán `figma` cho materialize/refill/clone JSON (`scripts/data/*` copy từ template cũ).

## Chế độ template-only

55. **Kích hoạt:** user ghi `Tên template:` trong chat (kèm Figma URL có `node-id`) → **chỉ tạo template section, KHÔNG tạo page**:
    - **KHÔNG** gọi `create_page` / `set_page_content`; không đụng `work_info.md` của flow page đang chạy.
    - Tên template = đúng giá trị user ghi (không ghép `[Tên Page] -` của rule 35); trùng tên → rule 36.
    - Figma URL trỏ tới **một section** → 1 template; trỏ tới frame chứa nhiều section → mỗi frame con cấp 1 là 1 template, tên `[Tên template] - [Tên section]`.
    - Plan `plans/template-<slug>.md`, header `- Mode: `template-only`` và **không** có dòng `Page ID`.
    - PLAN → DO liền, **không PAUSE** dù 1 hay nhiều template (rule 56); danh sách template báo trong DONE. DO giữ nguyên G0–G4, Desktop ≥98% → Mobile ≥98% (rule 13). G3/G4 dùng screenshot template preview `tpl_*` (ngoại lệ của câu cuối rule 23); bỏ G3.5 full page.
    - G3.5 (`validate_g4_evidence.py`) vẫn bắt buộc `tpl_*`; phần `page_*` tự bỏ qua vì plan không có Page ID.
    - DONE: báo `template_id`, `url`, `edit_url` (link clickable, rule 20), Desktop % | Mobile %.
    - Thiếu Figma URL → dừng, hỏi user (không tự đoán node).

## Chạy liền mạch (bắt buộc)

56. **Một lượt chạy đến khi tạo template xong:** PLAN → tạo page/template shell → (**chế độ page:** DỪNG hỏi danh sách section, xem dưới) → DO mọi template trong plan → báo cáo, **không** dừng chờ user giữa DO.
    - **Chế độ page: PAUSE đúng 1 lần sau PLAN** (sau bước 6, trước DO). Báo `page_id`, `url`, `edit_url`, bảng section (`# | Figma name | node | template_id`), đường dẫn plan; hỏi user template nào **KHÔNG cần build** (ghi vào `work_info.md` → "Các template không cần build layout" hoặc trả lời trong chat). User xác nhận (kể cả "build hết") → DO; **cấm** tự vào DO khi chưa có xác nhận. Sau PAUSE không hỏi lại giữa các template.
    - **Chế độ template-only (rule 55): không PAUSE** — PLAN → DO liền, build tất cả template trong plan.
    - Section fail sau giới hạn rule 39 / G1–G3 → ghi fail vào plan + `work_info.md`, **chạy tiếp section kế**. Báo bảng pass/fail ở cuối, không hỏi giữa chừng.
    - **Không hỏi** trước khi chạy script của repo: `python3 scripts/*.py`, `python3 -m scripts.*`, `python3 - <<EOF` import `scripts.lib`, và Bricks MCP read/write lên page/template của plan hiện tại. Quyền chạy cấu hình ở `.cursor/permissions.json` + `.cursor/sandbox.json`; lệnh vẫn bị chặn → xin quyền đúng một lần rồi chạy tiếp, không hỏi lại mỗi bước.
    - rem base không hỏi: Figma → Bricks dùng **px** theo Figma (rem base mặc định 16px nếu cần).
    - **Blocker cứng (được dừng và hỏi):** thiếu Figma URL / `node-id`; preflight fail (Figma token, Bricks MCP không kết nối); user yêu cầu publish page hoặc ghi đè ID không có trong plan (rule 3, 4).
    - Vẫn giữ: DONE chỉ khi user xác nhận visual (rule 53); dọn dẹp chỉ khi `Dọn dẹp: có` (rule 29). Hai bước này **sau** khi template đã tạo xong, không chặn luồng build.

## Giới hạn kiểm tra

57. **Tối đa 3 lần kiểm tra / tác vụ** (đo viewport, chụp ảnh, so layout Figma ↔ Bricks), tính cả lần chạy thất bại. Lần 1: đo gộp + chụp · lần 2: đo lại sau khi sửa · lần 3: xác nhận cuối. Hết 3 lần mà chưa đạt → **dừng**, báo số liệu đã đo + nguyên nhân nghi ngờ + hướng xử lý; không thử thêm.
    - Công cụ ưu tiên: `cursor-ide-browser` + CDP (`Emulation.setDeviceMetricsOverride` đúng bề rộng frame Figma mobile, rule 46), đo toàn bộ bằng **một** `Runtime.evaluate` trả JSON. Xong phải `Emulation.clearDeviceMetricsOverride`.
    - **Cấm** Chrome CLI headless (`--window-size`, `--dump-dom`, `--virtual-time-budget`): bị kẹt `innerWidth=500`, chạy hàng trăm giây rồi fail.
    - Mọi lệnh Chrome/terminal dùng để kiểm tra phải có `timeout` (≤ 30s). Không để server nền (`http.server`) chạy sau khi đo xong.
    - Giới hạn này độc lập với rule 39 (2 vòng PATCH/section): rule 39 đếm vòng sửa, rule 57 đếm số lần đo trong mỗi tác vụ kiểm tra.

## Đặt tên

34. Page: tên theo yêu cầu user; slug không dấu, lowercase, gạch ngang.
35. Section template: đặt tên dạng `[Tên dự án/page] - [Tên section]` (ví dụ: `LDP CF Talk - Hero`).
36. KHÔNG ghi đè page/template đã tồn tại trùng tên. Trước khi tạo, gọi `list_pages`/`list_templates` kiểm tra tên; nếu trùng thì tự tăng số thứ tự ở cuối tên rồi tạo mới:
    - Tên có số cuối: tăng số đó lên đến khi hết trùng (`Page 1` đã có → `Page 2`; `Page 2` cũng có → `Page 3`).
    - Tên không có số: thêm ` 2` (`Landing CF` → `Landing CF 2`).
    - Slug và tên các section template kèm theo cũng đổi theo tên page mới (`page-2`, `Page 2 - Hero`...).
    - Quy tắc này KHÔNG áp dụng khi user chỉ định rõ `page_id`/`template_id` để sửa nội dung (rule 4 trong mục Phạm vi).
