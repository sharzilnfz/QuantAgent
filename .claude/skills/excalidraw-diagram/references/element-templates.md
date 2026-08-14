# Element Templates

Copy-paste JSON templates for each Excalidraw element type. The `strokeColor` and `backgroundColor` values are placeholders — always pull actual colors from `color-palette.md` based on the element's semantic purpose.

For complete UML Class Diagram composite templates (three-compartment class boxes, all 8 relationship arrows, multiplicity labels), see `uml-class-templates.md`.

## Free-Floating Text (no container)

Use for: multiplicity labels, role names, stereotype labels on arrows, diagram titles.

```json
{
  "type": "text",
  "id": "label1",
  "x": 100, "y": 100,
  "width": 200, "height": 25,
  "text": "Section Title",
  "originalText": "Section Title",
  "fontSize": 20,
  "fontFamily": 3,
  "textAlign": "left",
  "verticalAlign": "top",
  "strokeColor": "<title color from palette>",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 11111,
  "version": 1,
  "versionNonce": 22222,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": null,
  "link": null,
  "locked": false,
  "containerId": null,
  "lineHeight": 1.25
}
```

## Line (structural, not arrow)

Use for: compartment dividers inside class boxes, structural grouping.

```json
{
  "type": "line",
  "id": "line1",
  "x": 100, "y": 100,
  "width": 0, "height": 200,
  "strokeColor": "<structural line color from palette>",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 44444,
  "version": 1,
  "versionNonce": 55555,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": null,
  "link": null,
  "locked": false,
  "points": [[0, 0], [0, 200]]
}
```

## Rectangle (Class Box Compartment)

Use for: each compartment of a UML class box (name, attributes, methods).

**Key**: Set `roundness: null` (no rounded corners) for UML class boxes. All compartments in a class share the same `groupIds` array.

```json
{
  "type": "rectangle",
  "id": "elem1",
  "x": 100, "y": 100, "width": 240, "height": 50,
  "strokeColor": "<stroke from palette based on class type>",
  "backgroundColor": "<fill from palette based on class type>",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 12345,
  "version": 1,
  "versionNonce": 67890,
  "isDeleted": false,
  "groupIds": ["class_group_1"],
  "boundElements": [{"id": "text1", "type": "text"}],
  "link": null,
  "locked": false,
  "roundness": null
}
```

## Text (centered in shape — Class Name)

Use for: class names in the top compartment.

```json
{
  "type": "text",
  "id": "text1",
  "x": 110, "y": 112,
  "width": 220, "height": 25,
  "text": "ClassName",
  "originalText": "ClassName",
  "fontSize": 20,
  "fontFamily": 3,
  "textAlign": "center",
  "verticalAlign": "middle",
  "strokeColor": "<class name color from palette>",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 11111,
  "version": 1,
  "versionNonce": 22222,
  "isDeleted": false,
  "groupIds": ["class_group_1"],
  "boundElements": null,
  "link": null,
  "locked": false,
  "containerId": "elem1",
  "lineHeight": 1.25
}
```

## Text (left-aligned in shape — Attributes/Methods)

Use for: attribute and method lists in class compartments.

```json
{
  "type": "text",
  "id": "attrs_text",
  "x": 110, "y": 158,
  "width": 220, "height": 50,
  "text": "- name: String\n- age: int",
  "originalText": "- name: String\n- age: int",
  "fontSize": 14,
  "fontFamily": 3,
  "textAlign": "left",
  "verticalAlign": "top",
  "strokeColor": "<attribute/method text color from palette>",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 1,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 11112,
  "version": 1,
  "versionNonce": 22223,
  "isDeleted": false,
  "groupIds": ["class_group_1"],
  "boundElements": null,
  "link": null,
  "locked": false,
  "containerId": "attrs_rect",
  "lineHeight": 1.25
}
```

## Arrow (Relationship)

Use for: all UML relationships. See `uml-class-templates.md` for the 8 specific arrow configurations.

**Key properties that vary by relationship type:**
- `strokeStyle`: `"solid"` or `"dashed"`
- `strokeWidth`: `1`, `2`, or `3`
- `startArrowhead`: `null`, `"diamond"`, `"triangle"`
- `endArrowhead`: `null`, `"arrow"`, `"triangle"`, `"diamond"`

```json
{
  "type": "arrow",
  "id": "arrow1",
  "x": 340, "y": 200, "width": 160, "height": 0,
  "strokeColor": "<relationship color from palette>",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 0,
  "opacity": 100,
  "angle": 0,
  "seed": 33333,
  "version": 1,
  "versionNonce": 44444,
  "isDeleted": false,
  "groupIds": [],
  "boundElements": null,
  "link": null,
  "locked": false,
  "points": [[0, 0], [160, 0]],
  "startBinding": {"elementId": "class_a_methods_rect", "focus": 0, "gap": 2},
  "endBinding": {"elementId": "class_b_name_rect", "focus": 0, "gap": 2},
  "startArrowhead": null,
  "endArrowhead": "arrow"
}
```

**Binding rules**: Arrows connect to the nearest compartment rectangle of the target class. For horizontal relationships, bind to the attributes or methods compartment. For vertical relationships (inheritance), bind the child's name compartment to the parent's methods compartment.

For curves (routing around other classes): use 3+ points in `points` array.
