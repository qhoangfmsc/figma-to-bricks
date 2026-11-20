Danh sách loại là `process/modules/recognize-parts/kinds.mjs`. `PartKind` và `SIGNAL_RULES` ở đó là nguồn duy nhất. Ảnh chỉ được gọi một key của `PartKind`, hoặc `block`. Id phần con không phải một loại.

Một nhóm trên ảnh là một dòng: `kind`, `node`, `selected`, `children`, `see`. `children` là node hoặc `null`. `null` không hủy component.

Ảnh gọi loại. `confirmNode` kiểm tra cấu trúc của loại đó. Hàng lặp đúng khi một nhóm con cùng ô. Hàng vạch không chữ là phần của carousel, không phải nhóm thứ hai. Ảnh chỉ hàng vạch thì nới một bước sang hàng thẻ. Loại không phải hàng lặp giữ node ảnh đã gọi, khi node còn trong cây.

Sửa một output sai: `.cursor/skills/fix-recognition/SKILL.md`. Thêm một component: `.cursor/skills/add-component/SKILL.md`. Kiểm tra sau khi dựng: `.cursor/skills/check-template/SKILL.md`. Kiểm tra gồm loại đã đúng chưa, tab chuyển được chưa, bảng có đủ hàng chưa, bảng giá có giá và dòng từ id chưa, slider chuyển slide được chưa khi có control, layout có giống frame chưa, và nguồn dynamic còn thiếu gì. Không bịa phần thiếu.
