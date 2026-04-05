# Family Tree Visualization — Spec

## Problem

The full family wheel (204 people across 6 generations in concentric rings) has hit fundamental limits:
- Gen 2+ text rendering is unsolved — narrow wedges can't fit readable names
- The RootsMagic source data needs manual verification for Gen 3–5
- Users don't need to see all 200+ people at once — they want to find **their branch**

## Proposal: Two-Level Approach

### Level 1 — Hub Wheel (Entry Point)

A simplified version of the current family wheel showing **only Gen 0 and Gen 1**:

```
                    ┌─────────────┐
                    │   Roland    │
                    │  "Bobo"    │
          ┌─────────┤            ├─────────┐
          │         └─────┬──────┘         │
          │               │                │
     Emily's         Grammie &        Adelaide's
     Quadrant          Bobo           Quadrant
          │          (center)              │
          │               │                │
          │         ┌─────┴──────┐         │
          └─────────┤            ├─────────┘
                    │  Coombs    │
                    │            │
                    └────────────┘
```

- **Center circle:** James Clement Richardson Jr. & Sarah Annis Withenbury (Gen 0)
- **4 quadrants (Gen 1):** Roland, Emily, Coombs, Adelaide — each with spouse name(s)
- **Each quadrant is clickable** — takes the user to that branch's tree view
- Visual cues: hover highlight, cursor pointer, "Click to explore" hint
- Keeps the existing colorblind-safe Okabe-Ito palette and search bar

### Level 2 — Branch Tree (Detail View)

Clicking a Gen 1 quadrant opens a **top-down vertical family tree** for that branch.

```
                  Roland Richardson
                   m. Althea Ford
            ┌──────┬───────┬──────┐
           Ted   Betsy  Althea  Emily
                        "Fifi"
                     ┌─────┴─────┐
               m. McCaslin   m. Surface
               ┌──┴──┐         │
             child  child     child
```

**Why vertical tree instead of more wheel rings:**
- Horizontal space scales naturally with siblings
- Text is always horizontal and readable
- Remarriages are easy to show (grouped children under labeled marriages)
- Solved problem — D3's `d3.tree()` handles layout automatically
- No tangential text, no narrow wedge math, no stacking problems

---

## Navigation

**URL scheme (shareable/bookmarkable):**
- `family.html` — hub wheel
- `family.html?branch=roland` — Roland's branch
- `family.html?branch=emily` — Emily's branch
- `family.html?branch=coombs` — Coombs' branch
- `family.html?branch=adelaide` — Adelaide's branch

**Flow:**
1. User arrives → sees hub wheel
2. Clicks quadrant → page transitions to branch tree
3. Branch header shows breadcrumb: **Family Circle > Roland Richardson**
4. "Back to Family Circle" button returns to hub wheel
5. Browser back button works naturally

---

## Tree Node Design

Each person is rendered as a card:

```
┌──────────────────────────┐
│ ● Name                   │   ● = generation color dot
│   m. Spouse Name         │
│   m. Second Spouse       │   (if remarried)
└──────────────────────────┘
```

- **Dimensions:** ~160×70px
- **Background:** White with subtle border
- **Name:** Playfair Display, bold, dark green
- **Spouse:** Lato, regular weight, prefixed with italic "m."
- **Generation color:** Small dot (top-left), using Okabe-Ito palette
- **Future:** Space reserved on left for 40×40 photo avatar

---

## Remarriage Handling

People with multiple marriages get their children grouped under labeled marriage nodes:

```
Althea "Fifi" Richardson
├── m. John McCaslin Jr. ──────── (marriage label, not a full card)
│   ├── Child A
│   └── Child B
└── m. Jim Surface ──────────── (marriage label)
    └── Child C
```

Marriage labels are styled differently from person cards (smaller, italic, no background card) so they read as connectors, not people.

**Gen 1 people with multiple marriages** (in current data):
- Emily Richardson: Clarence Burton (1st), Jim Carruthers (2nd)
- Coombs Richardson: Henry LaBoiteaux (1st), Robert Fillmore Lovett (2nd)

**Gen 2 people with multiple marriages:**
- Althea "Fifi" Richardson: John McCaslin Jr. (1st), Jim Surface (2nd)
- Mary Tylor Burton: R.D. Garrison (1st), Richard P. Stewart (2nd)
- James Garvin: Frances Harrison (1st), Jean Strang (2nd), Gladys Randall (3rd)

---

## Data

### Current sources
- **`data/family_tree.json`** — Manually curated, Gen 0–2 only. Clean spouse names, marriage order, descendant counts. Source of truth for the hub wheel.
- **`data/family.json`** — Machine-extracted from RootsMagic, all 204 people. Has a `tree` section with nested `children` arrays (exactly what D3 needs). Spouse data requires cross-referencing via `spouse_family_ids` in the `all_people` section. **Gen 3–5 data quality is unverified.**
- **`data/Richardson Family Circle Data.rmgc`** — Original RootsMagic SQLite database. Known to have errors.

### Data strategy
1. Hub wheel uses existing hardcoded Gen 0+1 data (already working)
2. Branch trees will load from `family.json` tree structure
3. Spouse names enriched at load time by cross-referencing `all_people`
4. **Manual verification needed** for Gen 3–5 before going live — display a "Data may contain errors" note until verified

---

## Technical Approach

### Stack
- D3.js v7 (already in use)
- Plain HTML/CSS/JS (no frameworks)
- `d3.hierarchy()` + `d3.tree()` for layout
- `d3.zoom()` for pan/zoom
- `d3.linkVertical()` for connectors

### Tree layout
```javascript
const root = d3.hierarchy(branchData);
const treeLayout = d3.tree().nodeSize([180, 120]);
// 180px horizontal spacing between siblings
// 120px vertical spacing between generations
treeLayout(root);
```

### Preprocessing for remarriages
Before passing data to D3, insert pseudo-nodes for marriages:
```javascript
// For each person with multiple spouses:
// Replace their children array with:
//   [marriageNode1, marriageNode2, ...]
// Where each marriageNode.children = children from that marriage
```

---

## Search

Search bar stays in the header. Behavior:
- On hub wheel: searching dims non-matching quadrants (existing behavior)
- On branch tree: searching highlights matching node card and pans/zooms to center it
- Cross-branch search: if a match is in a different branch, show a link to navigate there

---

## Mobile

- SVG with `viewBox` for responsive scaling
- `d3.zoom()` enables pinch-to-zoom on touch devices
- Initial view fits Gen 1–2 of the branch; user zooms for deeper generations
- "Fit to screen" button resets zoom

---

## Phasing

### Phase 1 (Current — Pre-Approval)
- [x] This spec document
- [x] `vertical-tree-proposal.html` prototype (Roland's branch, hardcoded data)

### Phase 2 (After Stakeholder Approval)
- [ ] Simplify `family.html` — strip Gen 2 ring, add click handlers to Gen 1 quadrants
- [ ] Build branch tree view (same page or `?branch=` param)
- [ ] Wire up `family.json` data loading
- [ ] Spouse enrichment preprocessing
- [ ] Search across tree view

### Phase 3 (Polish)
- [ ] Manual data verification for Gen 3–5
- [ ] Mobile optimization
- [ ] Collapse/expand for deep branches
- [ ] Print-friendly full wheel (optional "poster view")
- [ ] Photo avatars on tree nodes

---

## Open Questions for Stakeholder

1. **Nicknames:** Should the tree show nicknames? (e.g., "Althea 'Fifi' Richardson" or just "Althea Richardson")
2. **Deceased indicators:** Show any marker for deceased family members?
3. **Dates:** Include birth/death years in the cards?
4. **Photos:** Priority for adding photos to tree nodes?
5. **Full wheel:** Still want a "poster view" of the complete wheel, or drop it entirely?
6. **Data accuracy:** Who can help verify Gen 3–5 names? Should we crowdsource corrections?
