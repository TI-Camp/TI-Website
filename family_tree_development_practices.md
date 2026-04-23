# Family Tree Development Practices

Rolling log of decisions for the family wheel visualization.

---

## 2024-XX-XX - Text Orientation & Positioning

### Decision: Blood relative positioning
- **Blood relative is ALWAYS radially closest to the previous generation ring (toward center)**
- **Spouse is ALWAYS radially furthest from center (toward outer edge)**
- "m." sits between blood relative and spouse
- Text rotation (180° flip on bottom half) handles readability but does NOT change radial positioning

### Radial positioning (consistent across all quadrants):
```
[Center] ←── Blood Relative ←── m. ←── Spouse ←── [Outer Edge]
```

The text is rotated for readability (so you don't read upside-down), but the blood relative is always physically closer to the center circle regardless of which quadrant.

---

---

## Data Structure Decisions

### Spouse data structure
Changed from single `spouse` string to `spouses` array of objects:
```javascript
spouses: [
  { name: "Clarence Burton", order: 1 },
  { name: "Jim Carruthers", order: 2 }
]
```

**Rationale:** Gen 1 has two people with remarriages (Coombs Richardson and Emily Richardson). Array preserves marriage order and is extensible for future needs (e.g., adding children-per-marriage linkage).

**Display:** Currently showing only first spouse (`spouses[0].name`). Future enhancement could show remarriages with different styling.

### Two Emily Richardsons
The family tree contains TWO people named Emily Richardson:
1. **Emily Richardson (ID 5)** - Gen 1, child of Annis & James
   - Married: Clarence Burton (1st), Jim Carruthers (2nd)
2. **Emily Richardson (ID 16)** - Gen 2, daughter of Roland Richardson & Althea Ford
   - Married: Joe Boughton (ancestor of the Boughton family)

### Data source
Primary data source: **`data/family_tree.json`** (extracted from RootsMagic database)
- Clean, readable JSON with Gen 0, 1, and 2 fully populated
- IDs match PersonID in original `Richardson Family Circle Data.rmgc` SQLite database
- For Gen 3+, extract more data from the .rmgc file using sqlite3 queries

Original source: `data/Richardson Family Circle Data.rmgc` (SQLite database)
- More reliable than PDF for relationship data
- Contains proper parent-child linkages and marriage records

---

## Naming Convention

**Decision: Use birth/maiden names as the display name.**

The tree displays people by their birth name (e.g., "Betsy Boughton", "Sarah Horning"). Spouse names appear separately via the "m." notation. This matches what the RootsMagic database stores, so the extracted data is correct for display names — but relationship structure and spelling still need manual verification.

---

## Color Ramp (for generation coloring)

**Current implementation:** Light pastels at 60% opacity with dark text (#1a2e1e)
```javascript
const genColors = [
  "rgba(135, 206, 235, 0.6)", // Gen 0 (center) - Sky blue
  "rgba(255, 215, 100, 0.6)", // Gen 1 - Gold
  "rgba(255, 100, 100, 0.6)", // Gen 2 - Light red
  "rgba(152, 251, 152, 0.6)", // Gen 3 - Pale green
  "rgba(200, 162, 200, 0.6)", // Gen 4 - Lavender
  "rgba(255, 160, 122, 0.6)", // Gen 5 - Light coral
  "rgba(127, 255, 212, 0.6)", // Gen 6 - Aquamarine
  "rgba(240, 230, 140, 0.6)"  // Gen 7+ - Khaki/pale yellow
];
```

**Rejected alternatives (too dark/aggressive):**
- Forest depth: Deep forest → emerald → teal → sage → seafoam → mint
- Earth to sky: Deep brown → terracotta → amber → sage → sky blue → lavender
- Cool to warm: Deep navy → indigo → purple → magenta → coral → gold
- Categorical (Tableau10): Each generation completely different hue

---

## Weighted Wedge Sizing (Gen 2+)

Wedge sizes are proportional to descendant count, not equal divisions. This ensures people with large family trees get enough space for future generations.

**Algorithm:**
```javascript
weight = Math.max(descendantCount + 1, MIN_WEIGHT)  // MIN_WEIGHT = 8
angleShare = (weight / totalWeight) * parentSpanDegrees
```

**Example (Roland's branch, 90°):**
| Person | Descendants | Weight | Angle |
|--------|-------------|--------|-------|
| Ted Richardson | 15 | 16 | 21.8° |
| Betsy Richardson | 1 | 8 (min) | 10.9° |
| Althea Richardson | 23 | 24 | 32.7° |
| Emily Richardson | 17 | 18 | 24.5° |

MIN_WEIGHT ensures even people with few descendants get readable wedges.

---

## Unsolved: Stacked Tangential Text

**The problem:** For narrow wedges (under ~15°), radial text doesn't fit. We need tangential text (running along the arc) that stacks vertically:
- Blood relative name (inner)
- m.
- Spouse name (outer)

**What we tried:**
1. Three separate SVG text elements at different radii, same angle, same tangent rotation
2. Various rotation calculations: `angle`, `angle + 90°`, `angle - 90°`
3. Different positioning: inner edge, outer edge, middle

**What went wrong:**
- Text appeared on a single line rather than stacking
- Text bled outside the wedge boundaries
- Rotation math may be incorrect for tangent direction in D3's coordinate system

**Possible issues to investigate:**
1. SVG text rotation behavior - does `rotate(θ, x, y)` behave as expected?
2. D3's coordinate system offset (-90° from standard math)
3. Whether tangential text stacking requires different approach (e.g., `<textPath>` along arcs?)

**Reference:** See `data/different_wedge_size_reference.png` for visual mockup of desired behavior.

---

## Questions to Clarify

1. ~~**Divorcees/Remarriages:**~~ **DECIDED — Option A: Stacked couples.** The blood relative card appears once. Multiple spouse cards branch off side by side, each with a connector down to their shared children. No person is duplicated in the tree. Scales to 3+ marriages (e.g., James Garvin with three wives).

2. **Deceased indicators:** Should we mark deceased family members differently? (e.g., italics, dates, cross symbol)

3. **Generation 2+ spacing:** As we add more generations, wedges get narrower. At what point do we abbreviate names or use initials?

4. **Click/hover behavior:** What should happen when someone clicks or hovers on a wedge? Show photo? Bio? Dates?

5. **Color coding:** Should different branches (Roland's, Emily's, Coombs', Adelaide's) have different background colors?
