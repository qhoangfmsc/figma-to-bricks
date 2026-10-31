# Template — Ghi kết quả review vào work_info.md

Copy vào mục **Đánh giá kết quả thực thi** sau mỗi vòng review (5 gates).

```markdown
## Đánh giá kết quả thực thi

**Ngưỡng:** G0/G1/G2/G2.5 pass (script) · G3/G3.5 auto-screenshot · G4 ≥98% (visual + **checklist plan**)

- Dọn dẹp: chưa
- Plan file: plans/<page-slug>.md
- G4 evidence: `notes/<slug>/assets/bricks/` — **script chụp, user không upload**
- Patch / wrapper một lần (nếu có, để xóa): <path hoặc `không`>
- Trạng thái DONE: <chưa | pass> — **chỉ `pass` khi mọi section có G4 checklist all pass**
- Phiên: <đang DO | kết thúc>

### Review gates (Desktop + Mobile)

| Section | G0 | G1 | G2 | G2.5 | G3 | G4 Desktop | G4 Mobile | G4 pass? | Template |
|---------|----|----|----|------|----|------------|-----------|----------|----------|
| Hero | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | chưa | 8036 |
| ... | | | | | | | | | |

**Cột G4 %:** chỉ điền sau checklist pass. **Cột G4 pass?:** `chưa` | `✅` — không ghi ✅ nếu thiếu checklist.

Figma: [Desktop](<url>) · [Mobile](<url>)
Page: <url> (draft)

**Gate:**
- **G0** — `validate_plan_g0.py --strict`
- **G1** — `validate_template_json.py` exit 0
- **G2** — `validate_css_compiled.py` exit 0
- **G2.5** — `validate_section_structure.py` exit 0
- **G3** — section PNG @1440 + @390
- **G3.5** — `validate_g4_evidence.py` exit 0
- **G4** — rubric visual vs Figma (≥98%) — **chỉ sau G3.5**

**Lặp lại:** fail G1→fix JSON · fail G2→fix CSS+upload · fail G2.5→fix strategy/dual-block · fail G3/G4→PATCH→upload→G2→…→G4
```
