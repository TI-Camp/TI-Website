# Claude Handoff — TI-Website Full Context

**Last updated:** May 26, 2026
**Purpose:** Complete context for any new Claude session picking up this project.

---

## Project Overview

**Treasure Island Camp** — a private family website for a 100-year-old island camp in Pointe au Baril, Georgian Bay, Ontario. Serves ~53 member families, all descended from Annis Richardson (founded 1926). This is the **centennial year (1926–2026)**.

- **GitHub:** https://github.com/TI-Camp/TI-Website
- **Hosting:** Vercel — auto-deploys on push to `main`
- **Live URL:** https://ti-camp.org (custom domain, bought through Vercel)
- **Old URL:** https://ti-website-gamma.vercel.app (redirects to ti-camp.org)
- **www:** www.ti-camp.org redirects to ti-camp.org
- **Stack:** Plain HTML/CSS + vanilla JavaScript. No frameworks. Google Fonts (Playfair Display + Lato).
- **Auth:** Password-protected via Vercel middleware. Password: `Grammie1926`. Cookie-based (30-day).

---

## Architecture

### Pages
| File | Purpose | Status |
|------|---------|--------|
| `index.html` | Landing page with Cloudinary photo slideshow + batch upload | Complete |
| `family.html` | D3.js interactive family tree (204 people, 6 generations) | Complete |
| `profile.html` | Single-template profile page (`?id=slug`) | WIP — photo upload needs debugging |
| `how-to.html` | 34 video slots in 11 collapsible sections | Skeleton ready, needs video content |
| `documents.html` | Bylaws/policies | Structure ready, needs content |
| `schedule.html` | Embedded Google Sheet booking calendar | Complete |
| `login.html` | Password entry | Complete |

### API Endpoints (Vercel Serverless)
| File | Purpose |
|------|---------|
| `api/login.js` | Password validation, sets auth cookie |
| `api/photos.js` | Fetches slideshow photos from Cloudinary (`ti-slideshow` tag) |
| `api/notify.js` | Sends moderation email for slideshow photo uploads |
| `api/profile-edit.js` | Sends moderation email for profile edits (nicknames, bio, photo, etc.) |
| `api/moderate.js` | Handles approve/reject actions for both photos and profile edits |

### External Services
| Service | Account | Purpose |
|---------|---------|---------|
| **Cloudinary** | treasureislandcamp@gmail.com, cloud: `dqni1tcfn` | Photo storage (slideshow + profile photos) |
| **Resend** | Free tier, sends from `onboarding@resend.dev` | Moderation emails |
| **GitHub API** | Fine-grained token (90-day, TI-Camp org) | Commits profile edits to `profiles.json` |
| **Google Sheets** | Embedded | Schedule/booking calendar |

### Key Data Files
| File | Location | In Git? | Purpose |
|------|----------|---------|---------|
| `profiles.json` | Project root | Yes | 305 profile entries (name, nicknames, bio, dates, facts) |
| `family.html` (treeData) | Inline JS | Yes | Family tree structure with 203 person nodes, each with unique `id` |
| `data/family_tree.json` | `data/` | No (gitignored) | Source family data (RootsMagic export) |
| `.env` / `.env.local` | Project root | No (gitignored) | Secrets (see below) |

---

## Environment Variables

All stored in Vercel dashboard AND local `.env`:

```
CLOUDINARY_CLOUD_NAME=dqni1tcfn
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
RESEND_API_KEY=<key>
MODERATION_SECRET=<HMAC secret for signing moderation URLs>
MODERATOR_EMAIL=boughtonbd@gmail.com
GITHUB_TOKEN=<fine-grained PAT, expires ~Aug 2026, TI-Camp org, Contents read+write>
```

---

## Profile System — Current State

### What's Working
- **profile.html** — Ancestry-inspired layout with header card (photo, name, dates), nicknames box, timeline section
- **305 profiles** in `profiles.json` — all family members have skeleton entries
- **203 unique IDs** on tree nodes in `family.html` — slug format (`benjamin-boughton`), with `-N` suffix for duplicates (e.g., `emily-richardson-1`, `emily-richardson-2`)
- **Nickname editing** — full moderation flow: edit UI → POST to profile-edit.js → moderation email with HMAC-signed base64url links → approve commits to profiles.json via GitHub API → Vercel redeploys
- **"View Profile" icons** on tree cards — amber circle with arrow, hover-reveal on desktop, always visible on mobile
- **Nickname search** — family tree search includes nicknames from profiles.json
- **Login redirect** — middleware preserves query params through auth flow via `?returnTo=` param

### What's Not Built Yet
- [ ] **Mobile responsiveness on profile page** — widened container (960px) broke mobile layout. Needs dedicated pass with screenshots.
- [ ] Extend edit UI to remaining fields (birth/death dates, birthplace, maiden name)
- [ ] "Add new person" flow — for family members not yet in the tree (minimum: full name + parents, moderated)
- [ ] Photo crop/adjust tool — user feedback: want to reposition photo in frame before upload
- [ ] **Documents page: TI Manual integration** — Adapt the TI Manual Google Doc into the documents page with better aesthetics. Includes cabin specs, board member info.
- [ ] Nickname box overlaps long names on desktop — partially fixed with wider container + padding-right, needs more work on mobile

---

## Moderation System — How It Works

### For Slideshow Photos (homepage)
1. User uploads photos via homepage modal → Cloudinary `ti-camp-photos/` folder, tagged `ti-pending`
2. `api/notify.js` sends email with per-photo approve/reject buttons
3. `api/moderate.js` handles: approve → re-tag to `ti-slideshow` | reject → delete from Cloudinary

### For Profile Edits (nicknames, bio, photos)
1. User makes edit on profile page → POST to `api/profile-edit.js`
2. Email sent with HMAC-signed approve/reject links (encoded as single base64url param `?d=...` to survive Resend click tracking)
3. `api/moderate.js` handles:
   - **Text edits:** approve → fetch `profiles.json` from GitHub API → apply edit → commit back
   - **Photo edits:** approve → rename in Cloudinary (remove `-pending`) → re-tag → commit public ID to `profiles.json`
   - **Reject (text):** no action needed
   - **Reject (photo):** delete pending photo from Cloudinary

---

## Known Gotchas & Patterns

### Resend Click Tracking
Resend's click tracker double-encodes `&` in URLs, breaking multi-param query strings. Solution: encode entire payload as a single base64url parameter `?d=...`. This applies to ALL moderation emails.

### Clean URLs + Middleware
`vercel.json` has `cleanUrls: true`. The middleware matcher must exclude both `login.html` AND `login` (without extension) or you get an infinite redirect loop. Also must exclude `.json` files or `profiles.json` gets blocked.

### GitHub API Conflicts
Approved profile edits commit to `profiles.json` via GitHub API. This means the remote can have commits you don't have locally. Always `git pull --rebase` before pushing.

### Local Development
- Use `vercel dev` (not `npx serve`) — needed for API endpoints, middleware, and env vars
- `npx serve` strips query params via clean URL redirects
- May need `vercel env pull` to sync env vars to `.env.local`

### Duplicate Names in Tree
8 duplicate name groups, resolved with `-N` suffix (lowest generation gets `-1`):
- Emily Richardson (Gen 2, Gen 3)
- Robert Fillmore Lovett (Gen 2, 3, 4, 5)
- Hugh Garvin (Gen 2, 3, 4)
- Michael Richardson (Gen 4, 5)
- John Mathers McCaslin (Gen 3, 4)
- Frances Garvin (Gen 3, Gen 3 — different branches)
- Tim Taylor (Gen 4, 5)
- Robert Lovett Crawford (Gen 4, 5)

---

## Design System

### Colors
```css
--green-dark:  #1e4d2b  /* headings, nav, dark backgrounds */
--green-mid:   #2e6b3e  /* accents, hover states */
--green-light: #4a8c5c  /* lighter accents */
--cream:       #f5f0e6  /* page background */
--cream-dark:  #ede6d8  /* subtle section contrast */
--amber:       #c8860a  /* highlights, active states, profile icons */
--text-dark:   #1a2e1e  /* primary text */
--text-mid:    #3d5a42  /* secondary text */
```

### Fonts
- **Playfair Display** (serif) — headings
- **Lato** (sans-serif) — body text

---

## Cloudinary Structure

| Folder/Tag | Purpose |
|------------|---------|
| `ti-camp-photos/` | Slideshow photos |
| `ti-slideshow` tag | Approved slideshow photos (visible on homepage) |
| `ti-pending` tag | Slideshow photos awaiting moderation |
| `ti-profile-photos/` | Profile photos |
| `ti-profile` tag | Approved profile photos |
| `ti-profile-pending` tag | Profile photos awaiting moderation |
| Upload preset: `ti-camp` | Unsigned upload preset for client-side uploads |

---

## Development History (Summary)

| Session | Date | Key Work |
|---------|------|----------|
| 1-5 | Mar 1–24 | Landing page, Cloudinary integration, slideshow, photo moderation, family wheel |
| 6 | Apr 5 | Abandoned wheel, designed vertical tree spec |
| 7-10 | Apr 22–May 14 | D3 vertical tree, all 4 branches, relationship calculator, journey animation, how-to skeleton |
| 11 | May 18 | Mobile nav fixes, responsive tree header, collapsed sections |
| 12 | May 19-21 | Profile pages: scaffold, nicknames edit+moderation, GitHub API commits, tree node IDs, View Profile icons, 305 skeleton profiles |
| 13 | May 22 | Profile photo upload modal, photo moderation APIs, nickname search fix |

---

## Files Reference

### Gitignored (need manual backup)
- `.env`, `.env.local` — secrets
- `data/` — source databases, reference images
- `.claude/` — Claude Code local settings
- `WORKLOG.md` — full session log
- `CHLOE_SUGGESTIONS.md` — stakeholder feedback
- `security.md` — security review notes
- `profile_page_plan.md` — profile page decisions and planning
- `profile_photo_plan.md` — photo upload implementation plan

### Key Source Files
- `family.html` — the big one (~2400 lines, tree data + D3 rendering + search + relationship finder)
- `profile.html` — profile page template (~1000 lines)
- `index.html` — homepage with slideshow (~1160 lines)
- `api/moderate.js` — moderation handler (~240 lines, handles both photo and profile edit moderation)
- `api/profile-edit.js` — profile edit submission (~110 lines)
- `middleware.js` — auth middleware (16 lines but critical)
- `vercel.json` — clean URLs config
- `profiles.json` — 310 profile entries

---

## Immediate Next Steps

1. **Mobile responsiveness on profile page** — priority #1. Get screenshots from Ben, fix layout for mobile.
2. **Extend edit UI** — add edit capability for birth/death dates, birthplace, maiden name (bio is done, same moderation flow)
3. **"Add new person" flow** — for family members to add people not yet in the tree (name + parents minimum, moderated)
4. **Photo crop/adjust tool** — let users reposition photo in frame before uploading
5. **Documents page: TI Manual** — adapt Google Doc content into styled documents page (cabin specs, board info)
6. **Film how-to videos** — equipment ready
7. **Security review session** — see security.md

## Development History (Summary)

| Session | Date | Key Work |
|---------|------|----------|
| 1-5 | Mar 1–24 | Landing page, Cloudinary integration, slideshow, photo moderation, family wheel |
| 6 | Apr 5 | Abandoned wheel, designed vertical tree spec |
| 7-10 | Apr 22–May 14 | D3 vertical tree, all 4 branches, relationship calculator, journey animation, how-to skeleton |
| 11 | May 18 | Mobile nav fixes, responsive tree header, collapsed sections |
| 12 | May 19-21 | Profile pages: scaffold, nicknames edit+moderation, GitHub API commits, tree node IDs, View Profile icons, 305 skeleton profiles |
| 13 | May 22 | Profile photo upload modal, photo moderation APIs, nickname search fix |
| 14 | May 23 | Handoff doc, new family members (Mariah, Patrick, Emily Thornton, Alex Richardson, Saptarshi) |
| 15 | May 24 | Photo upload UX fixes (circular preview, spinner), deploy bug investigation (was domain redirect all along) |
| 16 | May 26 | Domain setup (ti-camp.org + www redirect), bio editing, timeline event editing, schedule sheet URL update |

---

## For New Computer Setup

1. Clone repo: `git clone https://github.com/TI-Camp/TI-Website.git`
2. `npm install`
3. Restore `.env` from backup (or `vercel env pull` for `.env.local`)
4. Restore `data/` folder from backup
5. Restore planning docs from backup
6. Install Vercel CLI: `npm install -g vercel`
7. Link project: `vercel link`
8. Run locally: `vercel dev`
