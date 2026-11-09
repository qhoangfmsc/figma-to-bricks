#!/usr/bin/env python3
"""
scripts/lib/brix.py
Helper nhỏ để dựng cây element Bricks 1.12.3 bằng Python thay vì gõ tay JSON.
Tuân thủ todo/rules/bricks_rules.md (px units, _columnGap/_rowGap thay _gap,
_border.radius thay _borderRadius, _objectFit có gạch dưới, image element cho SVG...).
"""

import json
import random
import string

_USED_IDS = set()


def rid():
    while True:
        i = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        if i not in _USED_IDS:
            _USED_IDS.add(i)
            return i


def reset_ids():
    _USED_IDS.clear()


# ── Design tokens (per-session, truyền vào từ build script — KHÔNG hardcode
#    token của dự án nào trong lib chung, xem CLEANUP.md/general_rules.md) ────

def root_vars_css(tokens):
    """Sinh chuỗi `:root{--a:...;--b:...}` cho page settings `customCss`.

    tokens: dict {"sl-espresso": "#2B1C13", ...} — tên biến KHÔNG kèm `--`.
    """
    body = "".join(f"--{name}:{value};" for name, value in tokens.items())
    return ":root{" + body + "}"


def google_fonts_links_html(families_query):
    """Sinh chuỗi <link> Google Fonts cho page settings `customScriptsHeader`.

    families_query: phần query sau `css2?`, ví dụ:
      "family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700"
    """
    return (
        '<link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        f'<link href="https://fonts.googleapis.com/css2?{families_query}&display=swap" '
        'rel="stylesheet">'
    )


def var(name):
    return {"raw": f"var(--{name})"}


def hex_(h):
    return {"hex": h}


def typo(font=None, size=None, weight=None, line_height=None, letter_spacing=None,
         color=None, italic=False, transform=None, align=None, white_space=None,
         extra=None):
    t = {}
    if font:
        t["font-family"] = font
    if size:
        t["font-size"] = size
    if weight:
        t["font-weight"] = str(weight)
    if line_height:
        t["line-height"] = line_height
    if letter_spacing:
        t["letter-spacing"] = letter_spacing
    if color:
        t["color"] = color
    if italic:
        t["font-style"] = "italic"
    if transform:
        t["text-transform"] = transform
    if align:
        t["text-align"] = align
    if white_space:
        t["white-space"] = white_space
    if extra:
        t.update(extra)
    return t


def border(radius=None, width=None, style="solid", color=None):
    b = {}
    if radius is not None:
        if isinstance(radius, str):
            radius = {"top": radius, "right": radius, "bottom": radius, "left": radius}
        b["radius"] = radius
    if width is not None:
        if isinstance(width, str):
            width = {"top": width, "right": width, "bottom": width, "left": width}
        b["width"] = width
        b["style"] = style
        if color:
            b["color"] = color
    return b


def spacing(top=None, right=None, bottom=None, left=None, all_=None):
    if all_ is not None:
        return {"top": all_, "right": all_, "bottom": all_, "left": all_}
    s = {}
    if top is not None:
        s["top"] = top
    if right is not None:
        s["right"] = right
    if bottom is not None:
        s["bottom"] = bottom
    if left is not None:
        s["left"] = left
    return s


class B:
    """Builder cho 1 section template — accumulate flat element list."""

    def __init__(self):
        self.elements = []
        self._by_id = {}

    def el(self, name, parent, settings=None, label=None, tag=None):
        eid = rid()
        settings = dict(settings or {})
        if tag is not None:
            settings["tag"] = tag
        node = {
            "id": eid,
            "name": name,
            "parent": parent,
            "children": [],
            "settings": settings,
        }
        if label:
            node["label"] = label
        self.elements.append(node)
        self._by_id[eid] = node
        if parent != "0":
            self._by_id[parent]["children"].append(eid)
        return eid

    # ── layout ──
    def section(self, settings=None, label=None):
        return self.el("section", "0", settings=settings, label=label)

    def container(self, parent, settings=None, label=None):
        # ⚠️ Bricks core .brxe-container default là `width: 1100px` CỐ ĐỊNH (không phải
        # 100% như .brxe-block) và không có media query responsive nào ghi đè — nếu chỉ
        # set _widthMax mà thiếu _width:100% thì container KHÔNG co lại trên mobile
        # (tràn ngang toàn trang). Xem bricks_rules.md §21.
        s = {"_width": "100%"}
        if settings:
            s.update(settings)
        return self.el("container", parent, settings=s, label=label)

    def block(self, parent, direction=None, justify=None, align=None,
              column_gap=None, row_gap=None, wrap=None, display="flex",
              padding=None, bg=None, extra=None, label=None, tag=None):
        s = {}
        if display:
            s["_display"] = display
        if direction:
            s["_direction"] = direction
        if justify:
            s["_justifyContent"] = justify
        if align:
            s["_alignItems"] = align
        if column_gap:
            s["_columnGap"] = column_gap
        if row_gap:
            s["_rowGap"] = row_gap
        if wrap:
            s["_flexWrap"] = wrap
        if padding:
            s["_padding"] = padding
        if bg:
            s["_background"] = {"color": bg}
        if extra:
            s.update(extra)
        return self.el("block", parent, settings=s, label=label, tag=tag)

    def grid(self, parent, columns, column_gap=None, row_gap=None,
             padding=None, extra=None, label=None):
        s = {
            "_display": "grid",
            "_gridTemplateColumns": columns,
        }
        if column_gap:
            s["_columnGap"] = column_gap
        if row_gap:
            s["_rowGap"] = row_gap
        if padding:
            s["_padding"] = padding
        if extra:
            s.update(extra)
        return self.el("block", parent, settings=s, label=label)

    # ── content ──
    def heading(self, parent, text, tag="h2", settings=None, label=None):
        s = {"text": text}
        if settings:
            s.update(settings)
        return self.el("heading", parent, settings=s, label=label or text[:30], tag=tag)

    def text(self, parent, text_html, settings=None, label=None):
        s = {"text": text_html}
        if settings:
            s.update(settings)
        return self.el("text-basic", parent, settings=s, label=label)

    def button(self, parent, text_, url, settings=None, label=None, internal=True):
        s = {
            "text": text_,
            "link": {"type": "internal" if internal else "external", "url": url},
        }
        if settings:
            s.update(settings)
        return self.el("button", parent, settings=s, label=label or text_)

    def icon_el(self, parent, icon_name, library="ionicons", size=None,
                color=None, settings=None, label=None):
        s = {"icon": {"icon": icon_name, "library": library}}
        if size:
            s["iconSize"] = size
        if color:
            # Element `icon` dùng control `iconColor` (includes/elements/icon.php:26)
            # — key `_color` không tồn tại trong Bricks 1.12.3, bị ignore silently.
            s["iconColor"] = color
        if settings:
            s.update(settings)
        return self.el("icon", parent, settings=s, label=label or icon_name)

    def image_wrapped(self, parent, url, alt, ratio=None, w=None, h=None,
                       wrapper_settings=None, img_settings=None, label=None):
        """div wrapper (kích thước) > image (object-fit cover)."""
        ws = {"_position": "relative", "_overflow": "hidden"}
        if ratio:
            ws["_aspectRatio"] = ratio
        if w:
            ws["_width"] = w
        if h:
            ws["_height"] = h
        if wrapper_settings:
            ws.update(wrapper_settings)
        wrapper_id = self.el("block", parent, settings=ws, label=label or "Image wrapper")

        is_ = {
            "image": {"external": True, "url": url, "size": "full"},
            "altText": alt,
            "_width": "100%",
            "_height": "100%",
            "_objectFit": "cover",
        }
        if img_settings:
            is_.update(img_settings)
        self.el("image", wrapper_id, settings=is_, label=alt)
        return wrapper_id

    def form(self, parent, fields, actions, settings=None, label=None):
        s = {"fields": fields, "actions": actions}
        if settings:
            s.update(settings)
        return self.el("form", parent, settings=s, label=label or "Form")

    # ── output ──
    def set_css(self, eid, css_template):
        """Set _cssCustom với %root% đã thay bằng #brxe-{id} thật (bricks_rules.md §13 —
        Bricks KHÔNG tự thay %root% khi ghi JSON trực tiếp qua REST, chỉ UI builder mới làm)."""
        self._by_id[eid]["settings"]["_cssCustom"] = css_template.replace("%root%", f"#brxe-{eid}")

    def to_list(self):
        return self.elements

    def to_json(self, indent=2):
        return json.dumps(self.elements, ensure_ascii=False, indent=indent)


def placeholder_url(w, h, label, bg="dddddd", fg="333333"):
    text = label.replace(" ", "+")
    return f"https://placehold.co/{w}x{h}/{bg}/{fg}?font=roboto&text={text}"
