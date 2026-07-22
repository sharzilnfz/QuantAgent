---
name: excalidraw-uml-class-diagram
description: Create Excalidraw UML Class Diagram JSON files. Use when the user wants to visualize class structures, attributes, methods, visibility, and relationships (association, aggregation, composition, inheritance, realization, dependency).
---

# UML Class Diagram Creator (Excalidraw)

Generate `.excalidraw` JSON files for **UML Class Diagrams** — the standard notation for showing classes, their attributes, methods, and the relationships between them.

**Setup:** If the user asks you to set up this skill (renderer, dependencies, etc.), see `README.md` for instructions.

## Customization

**All colors and brand-specific styles live in one file:** `references/color-palette.md`. Read it before generating any diagram and use it as the single source of truth for all color choices — class box fills/strokes, text colors, relationship line colors, everything.

To make this skill produce diagrams in your own brand style, edit `color-palette.md`. Everything else in this file is universal UML methodology and Excalidraw best practices.

---

## Core Philosophy

**Every class diagram must enforce UML semantics, not just draw boxes.**

A UML class diagram is not a free-form sketch. It has strict structural rules: three-compartment class boxes, visibility prefixes, typed attributes and methods, and 8 distinct relationship arrow types. The diagram must communicate **the structure and contracts of a system** at a glance.

**The Structure Test**: Can a developer look at this diagram and immediately know: (1) what classes exist, (2) what each class owns (attributes) and does (methods), (3) what's public vs private, and (4) how classes relate to each other? If not, redesign.

**The Precision Test**: Does every relationship arrow use the correct arrowhead and line style for its UML type? A solid line with a triangle is inheritance, not an association. A dashed line with a triangle is realization, not a dependency. Getting these wrong is worse than not drawing them at all.

---

## UML Class Box Anatomy

Every class is a **three-compartment rectangle** with no rounded corners (`roundness: null`).

```
┌─────────────────────────┐
│      «stereotype»       │  ← Optional (interface, abstract, enum)
│       ClassName          │  ← Compartment 1: Name (centered, bold/large)
├─────────────────────────┤
│ - name: String           │  ← Compartment 2: Attributes (left-aligned)
│ - age: int               │
│ # id: long               │
├─────────────────────────┤
│ + getName(): String      │  ← Compartment 3: Methods (left-aligned)
│ + setName(in n: String)  │
│ - validate(): boolean    │
└─────────────────────────┘
```

### Compartment Rules

| Compartment | Content | Font Size | Text Align | Vertical Align |
|-------------|---------|-----------|------------|----------------|
| Name | Class name (optionally with stereotype on line above) | 20px (name), 14px (stereotype) | center | middle |
| Attributes | Visibility + name + `: ` + Type, one per line | 14px | left | top |
| Methods | Visibility + name + `(params)` + `: ` + ReturnType, one per line | 14px | left | top |

### Sizing Rules

- **Name compartment height**: 50px for concrete classes, 70px for stereotyped classes (interface, abstract, enum)
- **Attribute/Method compartment height**: 25px per line, minimum 40px
- **Box width**: Calculate from the longest text line × ~9px per character + 40px padding. Minimum 200px. All three compartments share the same width.
- **All compartments** in a class share the same `groupIds` array so they move together

### Implementation

Each compartment is a separate `rectangle` element + contained `text` element, stacked vertically with y-coordinates that align seamlessly (compartment N's y = compartment N-1's y + height). See `references/uml-class-templates.md` for complete JSON templates.

---

## Visibility Notation

Every attribute and method is prefixed with a visibility symbol. This is part of the `text` string, not a separate element.

| Symbol | Meaning | Example |
|--------|---------|---------|
| `+` | public | `+ name: String` |
| `-` | private | `- id: long` |
| `#` | protected | `# validate(): boolean` |
| `~` | package/default | `~ helper: Util` |

**Always include visibility.** If the user doesn't specify, default to `-` (private) for attributes and `+` (public) for methods, which matches standard OOP conventions.

---

## Attribute Format

```
visibility name: Type
```

Examples:
```
- name: String
- age: int
# id: long
+ isActive: boolean
~ config: Map<String, Object>
```

**Rules:**
- One attribute per line in the text element
- Visibility prefix is mandatory
- Type comes after the colon
- Static attributes: underline not possible in Excalidraw, so prefix with `$` → `- $instanceCount: int`

---

## Method Format

```
visibility name(parameters): ReturnType
```

Examples:
```
+ getName(): String
+ setName(in name: String): void
- validate(): boolean
# calculateAge(in birthDate: Date): int
+ process(in data: List, out result: Result): void
```

**Parameter directionality** — specify when it adds clarity:

| Direction | Meaning | Example |
|-----------|---------|---------|
| `in` | Input parameter (caller → method) | `in name: String` |
| `out` | Output parameter (method → caller) | `out result: Result` |
| `inout` | Both input and output | `inout buffer: byte[]` |

**Rules:**
- One method per line in the text element
- Visibility prefix is mandatory
- Parameters inside parentheses, comma-separated
- Return type after the colon (use `void` if no return)
- Abstract methods: prefix with `*` → `+ *draw(): void` (since italics aren't available)
- Static methods: prefix with `$` → `+ $getInstance(): Singleton`

---

## Class Stereotypes

Stereotypes denote special class types. They appear as `«stereotype»` text on the line above the class name, inside the name compartment.

| Stereotype | Use For | Color (from palette) |
|------------|---------|---------------------|
| `«interface»` | Interface — only methods, no attributes | Interface fill/stroke |
| `«abstract»` | Abstract class — cannot be instantiated | Abstract fill/stroke |
| `«enumeration»` | Enum — fixed set of values | Enum fill/stroke |
| *(none)* | Concrete class | Concrete Class fill/stroke |

### Interface Box

Interfaces typically have:
- `«interface»` + name in the top compartment (70px height)
- No attributes compartment (or an empty one)
- Methods compartment with abstract method signatures

### Enum Box

Enums typically have:
- `«enumeration»` + name in the top compartment (70px height)
- Values listed in the second compartment (no visibility prefix, just names)
- No methods compartment (or an empty one)

---

## Relationships Between Classes

There are **8 relationship types** in UML class diagrams. Each has a specific line style and arrowhead combination. **Getting these right is critical** — the arrow IS the meaning.

### Quick Reference

| # | Relationship | Line Style | Start Arrowhead | End Arrowhead | Stroke Width | Stroke Color |
|---|-------------|------------|-----------------|---------------|-------------|-------------|
| 1 | Association | solid | `null` | `null` | 2 | `#374151` |
| 2 | Directed Association | solid | `null` | `arrow` | 2 | `#374151` |
| 3 | Aggregation | solid | `diamond` | `null` | 1 | `#b45309` |
| 4 | Composition | solid | `diamond` | `null` | 3 | `#b45309` |
| 5 | Generalization | solid | `null` | `triangle` | 2 | `#1e40af` |
| 6 | Realization | dashed | `null` | `triangle` | 2 | `#047857` |
| 7 | Dependency | dashed | `null` | `arrow` | 1 | `#6b7280` |
| 8 | Usage | dashed | `null` | `arrow` | 1 | `#6b7280` |

### Detailed Descriptions

**1. Association** — A bidirectional relationship. "Class A knows about Class B and vice versa." Simple solid line, no arrowheads.

**2. Directed Association** — A unidirectional relationship. "Class A knows about Class B, but not the other way." Solid line with open arrow pointing from A to B.

**3. Aggregation** — A "has-a" relationship where the part can exist independently. "A Department has Employees, but Employees exist without the Department." Open diamond on the **whole** (source) side. Distinguished from Composition by **thin stroke (1px)**.

**4. Composition** — A stronger "has-a" relationship where the part cannot exist independently. "A House has Rooms. Rooms don't exist without the House." Filled diamond on the **whole** (source) side. Distinguished from Aggregation by **thick stroke (3px)**.

**5. Generalization (Inheritance)** — An "is-a" relationship. "Dog is an Animal." Solid line with hollow triangle pointing **to the parent/superclass**.

**6. Realization (Interface Implementation)** — "ArrayList implements List." Dashed line with hollow triangle pointing **to the interface**.

**7. Dependency** — A weak relationship where one class uses another temporarily. "Controller depends on Logger." Dashed line with open arrow pointing to the supplier.

**8. Usage Dependency** — A specific kind of dependency with a `«use»` stereotype label at the midpoint. "Formatter uses Locale." Same arrow as Dependency but add a free-floating `«use»` text label near the arrow.

### Arrow Binding Rules

- Arrows connect to class box **rectangle** elements via `startBinding` and `endBinding`
- For **horizontal** relationships: bind to the attributes or methods rectangle (whichever is closest to the source)
- For **vertical** relationships (inheritance/realization): bind child's name rectangle → parent's methods rectangle (child below parent)
- The `focus` property controls which edge of the rectangle the arrow connects to: `0` = center, `-1` = top/left, `1` = bottom/right
- Always set `gap: 2` for clean spacing

See `references/uml-class-templates.md` for copy-paste JSON for each arrow type.

---

## Multiplicity Labels

Multiplicity describes how many instances of one class relate to instances of another. Place as free-floating text **near the arrow endpoint** on each side.

| Notation | Meaning |
|----------|---------|
| `1` | Exactly one |
| `0..1` | Zero or one |
| `*` | Zero or more |
| `1..*` | One or more |
| `0..*` | Zero or more (explicit) |
| `n..m` | Between n and m |

**Placement rules:**
- Position 5-15px away from the arrow start/end point
- Offset **above** the line (y - 18px from the arrow y-coordinate)
- Font size: 12px
- Color: `#374151` (from palette)

---

## Role Names

Role names describe the role a class plays in a relationship. Place as free-floating text near the arrow endpoint, on the **opposite side** from the multiplicity label.

- Position 5-15px from the arrow endpoint
- Offset **below** the line (y + 5px from the arrow y-coordinate)
- Font size: 12px, color: `#6b7280`

Example: On an association between `Person` and `Company`, the labels might read:
- Near Person: multiplicity `1..*` (above), role `employee` (below)
- Near Company: multiplicity `1` (above), role `employer` (below)

---

## Design Process (Do This BEFORE Generating JSON)

### Step 1: Inventory the Classes

List every class, interface, and enum that needs to appear in the diagram. For each one, determine:
- Is it concrete, abstract, interface, or enum?
- What are its attributes (with visibility and types)?
- What are its methods (with visibility, parameters, and return types)?

### Step 2: Map the Relationships

For every pair of related classes, determine:
- Which of the 8 relationship types applies?
- What is the directionality? (which class is the source/target, whole/part, parent/child)
- Are there multiplicity constraints?
- Are there role names?

### Step 3: Plan the Layout

Arrange classes to minimize crossing arrows:

**Layout heuristics:**
- **Inheritance hierarchies**: Parent classes at the **top**, children below. Arrange top-to-bottom.
- **Interfaces**: Place at the **top** or **top-right**, with implementing classes below.
- **Associations**: Arrange left-to-right for horizontal relationships.
- **Aggregation/Composition**: The whole (diamond side) on the **left** or **top**, parts on the right or bottom.
- **Dependencies**: The dependent class on the **left**, the supplier on the **right**.
- **Minimize crossings**: If arrows would cross, rearrange class positions.

**Spacing:**
- Minimum 100px horizontal gap between class boxes
- Minimum 80px vertical gap between class boxes
- 200px+ gap between unrelated class groups

### Step 4: Calculate Dimensions

For each class box:
1. Find the longest text line (attribute or method string including visibility prefix)
2. Box width = max(longest_line × 9, 200) + 40px padding
3. Name compartment height = 50px (or 70px with stereotype)
4. Attributes compartment height = max(attribute_count × 25, 40)
5. Methods compartment height = max(method_count × 25, 40)
6. Total class height = name_h + attrs_h + methods_h

### Step 5: Generate JSON

Build section by section. **See the Large Diagram Strategy section below.** Use `references/uml-class-templates.md` as your starting point for each element.

### Step 6: Render & Validate (MANDATORY)

After generating the JSON, run the render-view-fix loop. See the **Render & Validate** section below.

---

## Large / Comprehensive Diagram Strategy

**For diagrams with 4+ classes, you MUST build the JSON one section at a time.** Do NOT attempt to generate the entire file in a single pass. This is a hard constraint — Claude Code has a ~32,000 token output limit per response, and a class diagram with many attributes/methods easily exceeds that.

### The Section-by-Section Workflow

**Phase 1: Build each section**

1. **Create the base file** with the JSON wrapper (`type`, `version`, `appState`, `files`) and the first class box.
2. **Add one class box per edit.** Each class gets its own dedicated pass. Think carefully about positioning relative to already-placed classes.
3. **Use descriptive string IDs** (e.g., `"animal_name_rect"`, `"dog_attrs_text"`, `"inheritance_dog_animal"`) so cross-section references are readable.
4. **Namespace seeds by class** (e.g., Animal uses 100xxx, Dog uses 200xxx, Cat uses 300xxx) to avoid collisions.
5. **Add relationship arrows** after all related classes are placed. When adding an arrow, update the `boundElements` array on both the source and target rectangles.

**Phase 2: Review the whole**

After all classes and relationships are in place, check:
- Are all arrow bindings correct (referencing elements that actually exist)?
- Are class boxes properly spaced with no overlaps?
- Do inheritance hierarchies flow top-to-bottom?
- Is the overall composition balanced?

**Phase 3: Render & validate**

Run the render-view-fix loop.

### What NOT to Do

- **Don't generate the entire diagram in one response.** You'll hit the output token limit and produce truncated, broken JSON.
- **Don't use a coding agent** to generate the JSON. The agent won't have sufficient context about UML rules.
- **Don't write a Python generator script.** Hand-crafted JSON with descriptive IDs is more maintainable.

---

## Modern Aesthetics

### Roughness
- `roughness: 0` — Clean, crisp edges. **Always use this for UML diagrams.** UML is a formal notation; hand-drawn style undermines precision.

### Stroke Width
- `strokeWidth: 2` — Standard for class boxes and most arrows.
- `strokeWidth: 1` — Thin. Use for Aggregation arrows and Dependency arrows (weaker relationships).
- `strokeWidth: 3` — Bold. Use for Composition arrows (strong ownership).

### Opacity
**Always use `opacity: 100` for all elements.**

### Corner Rounding
**Always use `roundness: null` for class boxes.** UML class notation uses sharp corners. Rounded corners are incorrect.

---

## Layout Principles

### Hierarchy Through Position
- Superclasses/interfaces at the **top**
- Subclasses/implementing classes **below**
- Associated classes to the **left/right**
- Dependent classes further to the **edges**

### Whitespace
- 100px minimum horizontal gap between class boxes
- 80px minimum vertical gap between class boxes
- 200px+ between unrelated groups

### Flow Direction
- Inheritance: top → bottom
- Associations: left → right
- Dependencies: left → right

### Connections Required
Every relationship MUST have an arrow. Position alone doesn't show relationships.

---

## Text Rules

**CRITICAL**: The JSON `text` property contains ONLY readable words (including visibility symbols, types, and parameter directionality).

```json
{
  "id": "myElement1",
  "text": "- name: String",
  "originalText": "- name: String"
}
```

Settings: `fontSize: 14` (attributes/methods), `fontSize: 20` (class names), `fontFamily: 3`, `textAlign` and `verticalAlign` per compartment rules above.

---

## JSON Structure

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [...],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20
  },
  "files": {}
}
```

## Element Templates

See `references/element-templates.md` for base JSON templates and `references/uml-class-templates.md` for complete UML class diagram composites (three-compartment class boxes, all 8 relationship arrow types, multiplicity labels, role names). Pull colors from `references/color-palette.md`.

---

## Render & Validate (MANDATORY)

You cannot judge a diagram from JSON alone. After generating or editing the Excalidraw JSON, you MUST render it to PNG, view the image, and fix what you see — in a loop until it's right.

### How to Render

```bash
cd .agents/skills/excalidraw-diagram/references && .venv/bin/python render_excalidraw.py <path-to-file.excalidraw>
```

This outputs a PNG next to the `.excalidraw` file. Then use the **Read tool** on the PNG to actually view it.

### The Loop

**1. Render & View** — Run the render script, then Read the PNG.

**2. Audit against UML correctness:**
- Does every class box have three compartments (name, attributes, methods)?
- Are visibility prefixes present on every attribute and method?
- Does every relationship use the correct arrow type (check the Quick Reference table)?
- Are inheritance arrows pointing UP to the superclass?
- Are diamonds on the WHOLE side for aggregation/composition?
- Are multiplicity labels placed near the correct endpoints?
- Are stereotype labels (`«interface»`, `«abstract»`, etc.) present where needed?

**3. Check for visual defects:**
- Text clipped by or overflowing its compartment rectangle
- Text or shapes overlapping other elements
- Arrows crossing through class boxes instead of routing around them
- Arrows landing on the wrong compartment or pointing into empty space
- Multiplicity/role labels floating ambiguously
- Uneven spacing between class boxes
- Compartment rectangles not aligned (gaps or overlaps between compartments of the same class)
- Text too small to read at the rendered size
- Overall composition feels lopsided

**4. Fix** — Edit the JSON. Common fixes:
- Widen class boxes when text is clipped (recalculate width from longest line)
- Adjust compartment heights when attributes/methods overflow
- Fix `y` coordinates so compartments stack seamlessly
- Add intermediate waypoints to arrow `points` arrays to route around classes
- Reposition multiplicity labels closer to their arrow endpoints

**5. Re-render & re-view.**

**6. Repeat** until the diagram passes both the UML correctness check and the visual defect check. Typically 2-4 iterations.

### When to Stop

The loop is done when:
- Every class has correct three-compartment structure
- All visibility prefixes are present
- All relationship arrows use the correct UML arrowhead/line style
- No text is clipped, overlapping, or unreadable
- Arrows route cleanly without crossing through class boxes
- Spacing is consistent and the composition is balanced
- You'd be comfortable showing it to a UML-literate developer without caveats

### First-Time Setup
If the render script hasn't been set up yet:
```bash
cd .agents/skills/excalidraw-diagram/references
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
```

---

## Quality Checklist

### UML Correctness (Check First)
1. **Three compartments**: Every class has name, attributes, and methods compartments
2. **Visibility prefixes**: Every attribute and method has `+`, `-`, `#`, or `~`
3. **Type annotations**: Every attribute has `: Type`, every method has `(): ReturnType`
4. **Stereotypes**: Interfaces have `«interface»`, abstract classes have `«abstract»`, enums have `«enumeration»`
5. **Correct arrows**: Each relationship uses the right arrowhead + line style (see Quick Reference)
6. **Arrow direction**: Inheritance/realization arrows point TO the parent/interface, diamonds are on the WHOLE side
7. **Multiplicity**: Present where specified by the user or implied by the domain

### Structural
8. **Compartment alignment**: Compartments stack with no gaps or overlaps
9. **Consistent sizing**: Class boxes with similar content have similar dimensions
10. **Layout hierarchy**: Superclasses above subclasses, interfaces above implementors
11. **Minimum spacing**: 100px horizontal, 80px vertical between class boxes
12. **Arrow routing**: Arrows don't cross through class boxes

### Technical (Excalidraw JSON)
13. **Text clean**: `text` and `originalText` contain only readable content
14. **Font**: `fontFamily: 3` for all text
15. **Roughness**: `roughness: 0` for all elements
16. **Opacity**: `opacity: 100` for all elements
17. **No rounded corners**: `roundness: null` on class box rectangles
18. **Group IDs**: All compartments of a class share the same `groupIds`
19. **Bindings**: Arrows have correct `startBinding`/`endBinding` to actual element IDs

### Visual Validation (Render Required)
20. **Rendered to PNG**: Diagram has been rendered and visually inspected
21. **No text overflow**: All text fits within its compartment
22. **No overlapping elements**: Class boxes and arrows don't overlap unintentionally
23. **Even spacing**: Similar class boxes have consistent spacing
24. **Arrows land correctly**: Arrows connect to intended class compartments
25. **Readable at export size**: All text (including 12px multiplicity labels) is legible
26. **Balanced composition**: No large empty voids or overcrowded regions
