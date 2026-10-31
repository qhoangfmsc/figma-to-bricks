# scripts/data — dữ liệu build theo page

Nguồn sự thật cho **full Bricks element trees** (ưu tiên hơn plan skeleton).

## Cấu trúc

```
scripts/data/
  <plan-slug>/           # vd. ldp-template-v2 (từ plans/page-ldp-template-v2.md)
    trees/
      {template_id}.json # canonical — vd. 8111.json
      {slug}.json        # alias — vd. hero.json, section-1.json
    figma/
      {node-id}.json     # Figma context export (Phase C / manual)
  ldp-v2/                # legacy manifest + trees (migrate → ldp-template-v2/)
```

## Quy tắc

| Quy tắc | Chi tiết |
|---------|----------|
| **Build ưu tiên cache** | `build_from_plan.py` load `trees/{id}.json` trước; plan-parse chỉ fallback |
| **Không ghi đè mù** | `--force-generic` bị chặn nếu cache nhiều elements hơn plan-parse (`tree_guard.py`) |
| **Backup sau upload** | `scripts/refill/generic-{id}.json` — bản upload gần nhất |
| **Legacy** | `scripts/lib/ldp_v2/live/trees/` — fallback cho LDP V2; dần gom về `data/ldp-template-v2/` |

## LDP Template V2 (page 8110)

| Template | File chính | Elements (approx) |
|----------|------------|-------------------|
| 8111 Hero | `8111.json`, `hero.json` | 33 |
| 8112 Section 1 | `8112.json`, `section-1.json` | 39 |
| 8113 Bento | `8113.json`, `bento.json` | 18 |
| 8116 Speakers | `8116.json`, `speakers.json` | 38 |
| 8118 Trusted | `8118.json`, `trusted.json` | 25 |
| 8114 Compare | `8114.json`, `compare.json` | 48 |
| 8119 Partners | `8119.json`, `partners.json` | 49 |
| 8120 Events | `8120.json`, `events.json` | 15 |
| 8115 Contact | `8115.json`, `contact.json` | 22 |
| 8117 Floating | `8117.json`, `floating.json` | 9 |

Restore toàn page từ cache:

```bash
python3 scripts/build_from_plan.py --plan plans/page-ldp-template-v2.md --all
```
