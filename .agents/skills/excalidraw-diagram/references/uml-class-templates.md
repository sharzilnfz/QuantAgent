# UML Class Diagram — Element Templates

Copy-paste JSON templates for every UML element. Pull colors from `color-palette.md` based on the class type and relationship category.

---

## Class Box (Three-Compartment)

A UML class box is three stacked rectangles sharing the same `groupIds`. The top compartment holds the class name, the middle holds attributes, the bottom holds methods. Each compartment is a rectangle + contained text element.

### Sizing Rules

- **Class name compartment**: height = 50px (or 70px with stereotype text above)
- **Attribute compartment**: height = 25px per attribute, minimum 40px
- **Method compartment**: height = 25px per method, minimum 40px
- **Width**: all three compartments share the same width. Calculate from the longest text line (attribute or method) × ~9px per character + 40px padding. Minimum 200px.
- **Compartment divider lines**: Use `line` elements at the boundary between compartments, same stroke color as the class box.

### Concrete Class

```json
[
  {
    "type": "rectangle",
    "id": "class_name_rect",
    "x": 100, "y": 100, "width": 240, "height": 50,
    "strokeColor": "#1e40af",
    "backgroundColor": "#dbeafe",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 100001,
    "version": 1,
    "versionNonce": 100002,
    "isDeleted": false,
    "groupIds": ["class_group_1"],
    "boundElements": [{"id": "class_name_text", "type": "text"}],
    "link": null,
    "locked": false,
    "roundness": null
  },
  {
    "type": "text",
    "id": "class_name_text",
    "x": 110, "y": 112,
    "width": 220, "height": 25,
    "text": "ClassName",
    "originalText": "ClassName",
    "fontSize": 20,
    "fontFamily": 3,
    "textAlign": "center",
    "verticalAlign": "middle",
    "strokeColor": "#1e3a5f",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 1,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 100003,
    "version": 1,
    "versionNonce": 100004,
    "isDeleted": false,
    "groupIds": ["class_group_1"],
    "boundElements": null,
    "link": null,
    "locked": false,
    "containerId": "class_name_rect",
    "lineHeight": 1.25
  },
  {
    "type": "rectangle",
    "id": "class_attrs_rect",
    "x": 100, "y": 150, "width": 240, "height": 75,
    "strokeColor": "#1e40af",
    "backgroundColor": "#dbeafe",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 100005,
    "version": 1,
    "versionNonce": 100006,
    "isDeleted": false,
    "groupIds": ["class_group_1"],
    "boundElements": [{"id": "class_attrs_text", "type": "text"}],
    "link": null,
    "locked": false,
    "roundness": null
  },
  {
    "type": "text",
    "id": "class_attrs_text",
    "x": 110, "y": 158,
    "width": 220, "height": 60,
    "text": "- name: String\n- age: int",
    "originalText": "- name: String\n- age: int",
    "fontSize": 14,
    "fontFamily": 3,
    "textAlign": "left",
    "verticalAlign": "top",
    "strokeColor": "#374151",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 1,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 100007,
    "version": 1,
    "versionNonce": 100008,
    "isDeleted": false,
    "groupIds": ["class_group_1"],
    "boundElements": null,
    "link": null,
    "locked": false,
    "containerId": "class_attrs_rect",
    "lineHeight": 1.25
  },
  {
    "type": "rectangle",
    "id": "class_methods_rect",
    "x": 100, "y": 225, "width": 240, "height": 75,
    "strokeColor": "#1e40af",
    "backgroundColor": "#dbeafe",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 100009,
    "version": 1,
    "versionNonce": 100010,
    "isDeleted": false,
    "groupIds": ["class_group_1"],
    "boundElements": [{"id": "class_methods_text", "type": "text"}],
    "link": null,
    "locked": false,
    "roundness": null
  },
  {
    "type": "text",
    "id": "class_methods_text",
    "x": 110, "y": 233,
    "width": 220, "height": 60,
    "text": "+ getName(): String\n+ setName(in n: String): void",
    "originalText": "+ getName(): String\n+ setName(in n: String): void",
    "fontSize": 14,
    "fontFamily": 3,
    "textAlign": "left",
    "verticalAlign": "top",
    "strokeColor": "#374151",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 1,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 100011,
    "version": 1,
    "versionNonce": 100012,
    "isDeleted": false,
    "groupIds": ["class_group_1"],
    "boundElements": null,
    "link": null,
    "locked": false,
    "containerId": "class_methods_rect",
    "lineHeight": 1.25
  }
]
```

### Interface Box

Same structure as class box but with `«interface»` stereotype text above the class name. Use interface colors from the palette.

```json
[
  {
    "type": "rectangle",
    "id": "iface_name_rect",
    "x": 500, "y": 100, "width": 240, "height": 70,
    "strokeColor": "#047857",
    "backgroundColor": "#d1fae5",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 200001,
    "version": 1,
    "versionNonce": 200002,
    "isDeleted": false,
    "groupIds": ["iface_group_1"],
    "boundElements": [{"id": "iface_name_text", "type": "text"}],
    "link": null,
    "locked": false,
    "roundness": null
  },
  {
    "type": "text",
    "id": "iface_name_text",
    "x": 510, "y": 108,
    "width": 220, "height": 55,
    "text": "«interface»\nIMovable",
    "originalText": "«interface»\nIMovable",
    "fontSize": 16,
    "fontFamily": 3,
    "textAlign": "center",
    "verticalAlign": "middle",
    "strokeColor": "#1e3a5f",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 1,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 200003,
    "version": 1,
    "versionNonce": 200004,
    "isDeleted": false,
    "groupIds": ["iface_group_1"],
    "boundElements": null,
    "link": null,
    "locked": false,
    "containerId": "iface_name_rect",
    "lineHeight": 1.25
  },
  {
    "type": "rectangle",
    "id": "iface_methods_rect",
    "x": 500, "y": 170, "width": 240, "height": 50,
    "strokeColor": "#047857",
    "backgroundColor": "#d1fae5",
    "fillStyle": "solid",
    "strokeWidth": 2,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 200005,
    "version": 1,
    "versionNonce": 200006,
    "isDeleted": false,
    "groupIds": ["iface_group_1"],
    "boundElements": [{"id": "iface_methods_text", "type": "text"}],
    "link": null,
    "locked": false,
    "roundness": null
  },
  {
    "type": "text",
    "id": "iface_methods_text",
    "x": 510, "y": 178,
    "width": 220, "height": 35,
    "text": "+ move(in dx: int, in dy: int): void",
    "originalText": "+ move(in dx: int, in dy: int): void",
    "fontSize": 14,
    "fontFamily": 3,
    "textAlign": "left",
    "verticalAlign": "top",
    "strokeColor": "#374151",
    "backgroundColor": "transparent",
    "fillStyle": "solid",
    "strokeWidth": 1,
    "strokeStyle": "solid",
    "roughness": 0,
    "opacity": 100,
    "angle": 0,
    "seed": 200007,
    "version": 1,
    "versionNonce": 200008,
    "isDeleted": false,
    "groupIds": ["iface_group_1"],
    "boundElements": null,
    "link": null,
    "locked": false,
    "containerId": "iface_methods_rect",
    "lineHeight": 1.25
  }
]
```

### Abstract Class Box

Same structure as concrete class but with `«abstract»` stereotype. Use abstract class colors.

The only structural difference from a concrete class: the top compartment is 70px tall (to fit the stereotype line) and the stereotype+name text is two lines.

```json
{
  "_comment": "Same as Concrete Class template but with these changes:",
  "name_rect_height": 70,
  "strokeColor": "#6d28d9",
  "backgroundColor": "#ede9fe",
  "name_text": "«abstract»\nAbstractClassName"
}
```

### Enumeration Box

Two compartments: name (with `«enumeration»` stereotype) and values list. No methods compartment.

```json
{
  "_comment": "Same as Interface template structure but with enum colors:",
  "strokeColor": "#b45309",
  "backgroundColor": "#fef3c7",
  "name_text": "«enumeration»\nColor",
  "values_text": "RED\nGREEN\nBLUE"
}
```

---

## Relationship Arrows

All 8 UML relationship types as arrow templates. Arrows bind to class box rectangles via `startBinding` and `endBinding`.

### 1. Association (Bidirectional)

Solid line, no arrowheads on either end.

```json
{
  "type": "arrow",
  "id": "assoc_arrow",
  "x": 340, "y": 200, "width": 160, "height": 0,
  "strokeColor": "#374151",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 300001,
  "version": 1,
  "versionNonce": 300002,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": null,
  "link": null,
  "locked": false,
  "points": [[0, 0], [160, 0]],
  "startBinding": {"elementId": "class_a_methods_rect", "focus": 0, "gap": 2},
  "endBinding": {"elementId": "class_b_methods_rect", "focus": 0, "gap": 2},
  "startArrowhead": null,
  "endArrowhead": null
}
```

### 2. Directed Association

Solid line, open arrow on the target end.

```json
{
  "type": "arrow",
  "id": "dir_assoc_arrow",
  "strokeColor": "#374151",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "_comment": "All other properties same as Association"
}
```

### 3. Aggregation (Has-A, Weak)

Solid line, open diamond on the whole (source) end. No arrowhead on the part end.

```json
{
  "type": "arrow",
  "id": "aggregation_arrow",
  "strokeColor": "#b45309",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "startArrowhead": "diamond",
  "endArrowhead": null,
  "_comment": "Diamond on the WHOLE side (start). Thin stroke distinguishes from composition."
}
```

### 4. Composition (Has-A, Strong)

Solid line, filled diamond on the whole (source) end. No arrowhead on the part end.

```json
{
  "type": "arrow",
  "id": "composition_arrow",
  "strokeColor": "#b45309",
  "strokeWidth": 3,
  "strokeStyle": "solid",
  "startArrowhead": "diamond",
  "endArrowhead": null,
  "_comment": "Diamond on the WHOLE side (start). Thick stroke (3px) distinguishes from aggregation (1px)."
}
```

### 5. Generalization (Inheritance)

Solid line, hollow triangle on the superclass (target) end.

```json
{
  "type": "arrow",
  "id": "generalization_arrow",
  "strokeColor": "#1e40af",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "startArrowhead": null,
  "endArrowhead": "triangle",
  "_comment": "Triangle points TO the superclass/parent."
}
```

### 6. Realization (Interface Implementation)

Dashed line, hollow triangle on the interface (target) end.

```json
{
  "type": "arrow",
  "id": "realization_arrow",
  "strokeColor": "#047857",
  "strokeWidth": 2,
  "strokeStyle": "dashed",
  "startArrowhead": null,
  "endArrowhead": "triangle",
  "_comment": "Dashed line + triangle points TO the interface."
}
```

### 7. Dependency

Dashed line, open arrow on the target end.

```json
{
  "type": "arrow",
  "id": "dependency_arrow",
  "strokeColor": "#6b7280",
  "strokeWidth": 1,
  "strokeStyle": "dashed",
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "_comment": "Dashed + arrow. Lighter stroke for weaker coupling."
}
```

### 8. Usage Dependency

Same as Dependency, but add a `«use»` stereotype label near the midpoint of the arrow.

```json
{
  "type": "arrow",
  "id": "usage_arrow",
  "strokeColor": "#6b7280",
  "strokeWidth": 1,
  "strokeStyle": "dashed",
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "_comment": "Same as dependency. Place a free-floating «use» text label at the arrow midpoint."
}
```

**«use» label** (free-floating text near arrow midpoint):
```json
{
  "type": "text",
  "id": "usage_label",
  "x": 410, "y": 185,
  "width": 50, "height": 20,
  "text": "«use»",
  "originalText": "«use»",
  "fontSize": 12,
  "fontFamily": 3,
  "textAlign": "center",
  "verticalAlign": "top",
  "strokeColor": "#6b7280",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 300020,
  "version": 1,
  "versionNonce": 300021,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": null,
  "link": null,
  "locked": false,
  "containerId": null,
  "lineHeight": 1.25
}
```

---

## Multiplicity Label

Free-floating text placed near an arrow endpoint. Position it 5-15px away from the arrow start/end point, offset above or below the line.

```json
{
  "type": "text",
  "id": "mult_label_start",
  "x": 345, "y": 182,
  "width": 30, "height": 18,
  "text": "1..*",
  "originalText": "1..*",
  "fontSize": 12,
  "fontFamily": 3,
  "textAlign": "center",
  "verticalAlign": "top",
  "strokeColor": "#374151",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 400001,
  "version": 1,
  "versionNonce": 400002,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": null,
  "link": null,
  "locked": false,
  "containerId": null,
  "lineHeight": 1.25
}
```

Common multiplicities: `1`, `0..1`, `*`, `1..*`, `0..*`

---

## Role Name Label

Free-floating text near an arrow endpoint, typically placed on the opposite side from the multiplicity label.

```json
{
  "type": "text",
  "id": "role_label",
  "x": 345, "y": 205,
  "width": 60, "height": 18,
  "text": "owner",
  "originalText": "owner",
  "fontSize": 12,
  "fontFamily": 3,
  "textAlign": "left",
  "verticalAlign": "top",
  "strokeColor": "#6b7280",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 400010,
  "version": 1,
  "versionNonce": 400011,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": null,
  "link": null,
  "locked": false,
  "containerId": null,
  "lineHeight": 1.25
}
```
