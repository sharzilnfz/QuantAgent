# Color Palette & Brand Style — UML Class Diagrams

**This is the single source of truth for all colors and brand-specific styles.** To customize diagrams for your own brand, edit this file — everything else in the skill is universal UML methodology.

---

## Class Box Colors

Each class stereotype has a distinct fill/stroke pair so the diagram communicates type at a glance.

| Class Type | Fill | Stroke |
|------------|------|--------|
| Concrete Class | `#dbeafe` | `#1e40af` |
| Abstract Class | `#ede9fe` | `#6d28d9` |
| Interface | `#d1fae5` | `#047857` |
| Enumeration | `#fef3c7` | `#b45309` |

**Rule**: Always pair a darker stroke with a lighter fill for contrast. Compartment divider lines use the same stroke color as the class box.

---

## Text Colors (Hierarchy)

Use color to create visual hierarchy within class boxes and for labels.

| Level | Color | Use For |
|-------|-------|---------| 
| Class Name | `#1e3a5f` | Class name in the top compartment (bold/large) |
| Stereotype | `#6b7280` | `«interface»`, `«abstract»`, `«enumeration»` labels |
| Attributes & Methods | `#374151` | Attribute and method text in compartments |
| Visibility Markers | `#6b7280` | `+`, `-`, `#`, `~` prefixes |
| Multiplicity Labels | `#374151` | `1`, `0..1`, `*`, `1..*` near arrow endpoints |
| Relationship Labels | `#6b7280` | Role names, stereotype labels on arrows |
| On light fills | `#374151` | Text inside light-colored class boxes |

---

## Relationship Line Colors

Each relationship category has its own stroke color so the diagram communicates semantics through color.

| Relationship Type | Stroke Color | Style |
|-------------------|-------------|-------|
| Association / Directed Association | `#374151` | solid |
| Aggregation | `#b45309` | solid, strokeWidth 1 |
| Composition | `#b45309` | solid, strokeWidth 3 |
| Generalization (Inheritance) | `#1e40af` | solid |
| Realization (Interface Implementation) | `#047857` | dashed |
| Dependency | `#6b7280` | dashed |
| Usage Dependency | `#6b7280` | dashed |

---

## Default Stroke & Line Colors

| Element | Color |
|---------|-------|
| Compartment divider lines | Same stroke as parent class box |
| Structural lines (diagram borders, grouping) | `#64748b` |

---

## Background

| Property | Value |
|----------|-------|
| Canvas background | `#ffffff` |
