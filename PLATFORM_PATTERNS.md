# Platform Patterns for Hockey Association Websites

## Overview
This document captures the patterns observed across different platform providers used by hockey associations.

## Test Results Summary (as of 2025-11-22)
- **Total Tests**: 11
- **Passed**: 11 (100.0%)
- **Failed**: 0 (0.0%)

### By Platform:
- **SportsEngine**: 8/8 passed (100.0%)
- **Crossbar**: 2/2 passed (100.0%)
- **Sprocket Sports**: 2/2 passed (100.0%)

---

## SportsEngine Platform

### Characteristics:
- **URL Patterns**:
  - Sitemap: `https://[association].com/sitemap.xml`
  - Team Pages: `https://[association].com/page/show/[PAGE_ID]-[team-slug]-[season]`
  - Calendar Feed: `webcal://[association].com/ical_feed?tags=[PAGE_ID]`

### Calendar URL Discovery:
- **Primary Method**: Extract Page ID from team URL, construct `webcal://` feed manually
  - Pattern: `/page/show/(\d+)` → `webcal://[domain]/ical_feed?tags=$1`
- **Season Detection**: URL often includes season year (e.g., `2025-26`, `2024-25`)
- **Deduplication**: Required! Sitemaps contain multiple seasons of same team
- **Page Structure**: 
  - Most use `<h1>` for team name
  - Some (e.g., Minnetonka) use `<h2>` for team name - scraper checks both

### Tested Associations (SportsEngine):
| Association | Status | Notes |
|------------|--------|-------|
| Anoka | ✅ PASS | Full support with season filtering |
| Blaine | ✅ PASS | Handles URL abbreviations (pw-, btm-) |
| Buffalo | ✅ PASS | Full support with season filtering |
| Minnetonka | ✅ PASS | Requires `<h2>` tag detection |
| Shakopee | ✅ PASS | Standard SportsEngine |
| St. Michael/Albertville | ✅ PASS | Standard SportsEngine |
| Stillwater | ✅ PASS | Standard SportsEngine |
| Woodbury | ✅ PASS | Handles abbreviations in titles |

### Key Learnings:
1. **H2 Tag Fallback**: Some use `<h2>` for team names. Fallback must require level indicators to avoid hub pages
2. **Level Matching**: "Bantam AA" vs "Bantam A" - use word boundaries or exact matching
3. **URL Abbreviations**: Many use abbreviations (`pw-`, `btm-`, `bn-`, `sq-`) in URLs and titles
4. **Title Abbreviations**: Page titles may use space-separated abbreviations like "BN B1 Royal" or "PW A"

---

## Crossbar Platform

### Characteristics:
- **URL Patterns**:
  - Domain: `https://[association].pucksystems.com` or `https://[association].pucksystems2.com`
  - Team Pages: `https://[association].com/team/[TEAM_ID]/calendar`
  - Teams List: `https://[association].com/teams`

### Calendar URL Discovery:
- **Primary Method**: Team page URL with `/calendar` suffix
- **No webcal Feeds**: Crossbar typically doesn't offer webcal:// feeds
- **Fallback**: Use the schedule/calendar page URL directly

### Tested Associations (Crossbar):
| Association | Status | Notes |
|------------|--------|-------|
| Chaska Chanhassen (CCHA) | ✅ PASS | Found correct calendar URL |
| St. Paul Capitals | ✅ PASS | Standard Crossbar |

### Key Learnings:
1. **Association Matching**: "St. Paul" is ambiguous - can match "South St. Paul". Use full names

---

## Sprocket Sports Platform (SPA)

### Characteristics:
- **Platform**: Angular Single Page Application (SPA)
- **Detection**: 
  - HTML contains `sprocketsports.com` in links/scripts
  - Angular app root element `<app-root>` present
- **Requires**: Puppeteer for browser automation (content loads dynamically)

### iCal Link Pattern:
```
webcal://{subdomain}.sprocketsports.com/ical?team={teamId}
```
- Example: `webcal://waconiahockey.sprocketsports.com/ical?team=26272`
- Example: `webcal://mplshockey.sprocketsports.com/ical?team=26296`

### Site Structure Variations:

#### Variation 1: Submenu-Based (e.g., Waconia)
**Navigation Flow:**
```
Home → "TEAM LISTS" → "Squirt Teams" → Individual team links
```

**Characteristics:**
- Menu keyword: "TEAM LISTS" or "TEAMS"
- Requires clicking age group submenu to reveal teams
- Submenu links contain word "Teams" (e.g., "Squirt Teams", "Bantam Teams")
- Individual team links have `navigationTeamID` parameter

**Example Associations:**
- Waconia Hockey Association

#### Variation 2: Direct Links (e.g., Minneapolis)
**Navigation Flow:**
```
Home → "TRAVELING" → Direct team links (no submenu)
```

**Characteristics:**
- Menu keyword: "TRAVELING"
- Team links appear directly in menu (no submenu click needed)
- Links are individual teams: "Squirt A", "Squirt B1 Black", "Squirt C Black"
- Each link already contains `navigationTeamID` parameter

**Example Associations:**
- Minneapolis Youth Hockey Association

### Team ID Extraction:
- Look for query parameter: `navigationTeamID={id}`
- Example URL: `https://waconiahockey.com/team/58437/program/13289/overview?navigationTeamID=26272`

### Subdomain Extraction:
- Parse from base URL: `www.waconiahockey.org` → `waconiahockey`
- Parse from base URL: `www.mplshockey.com` → `mplshockey`
- Pattern: Strip `www.` prefix, take first segment before `.`

### Implementation Details:
**Browser Automation:**
- Launch headless Chrome via Puppeteer
- Navigate and wait for network idle (`networkidle2`)
- Click menu items to reveal content
- Evaluate JavaScript to extract links
- Handle both submenu and direct link structures
- Deduplicate teams (same team may appear multiple times)

**Detection Logic:**
```typescript
const isSubmenu = linkText.toLowerCase().includes('team');

if (isSubmenu) {
    // Click submenu link to reveal teams
    // Extract teams from revealed list
} else if (link.href.includes('navigationTeamID')) {
    // Extract team directly from current link
}
```

### Tested Associations (Sprocket Sports):
| Association | Status | Structure | Notes |
|------------|--------|-----------|-------|
| Waconia | ✅ PASS | Submenu | Uses "TEAM LISTS" menu |
| Minneapolis | ✅ PASS | Direct Links | Uses "TRAVELING" menu |

---

## Scraper Logic Requirements

### Must Have:
1. **Season Detection**: Extract and filter by current season year
2. **Deduplication**: Same team may appear multiple times for different seasons
3. **Platform Auto-Detection**: 
   - Check for Sprocket Sports indicators first (SPA detection)
   - Extract SportsEngine Page IDs to construct feeds
   - Fall back to schedule/calendar page URLs for Crossbar
4. **Sitemap First** (non-SPA): Use sitemap.xml to discover team pages efficiently
5. **Age Group Detection**: Identify Mites, Squirts, Peewees, Bantams
6. **Level Detail Extraction**: Parse team designations (A, AA, B1, B2, colors, etc.)
7. **Flexible Page Titles**: Check `<h1>` and `<h2>` (with validation) for team names

### Best Practices:
1. **MAX_PAGES**: Currently 200 for comprehensive coverage
2. **Filter invalid links**: `javascript:void(0)`, `#`, `mailto:`, `webcal://` during fetch
3. **Prioritize current season**: Teams with "2025-26" in URL over those without
4. **Handle all platforms**: SportsEngine, Crossbar, and Sprocket Sports (SPA)
5. **Browser automation only when needed**: Detect SPAs to avoid unnecessary overhead

---

## Test Coverage

### Current Regression Suite:
```
SportsEngine (8 tests)
  ✅ Anoka - Bantam A
  ✅ Blaine - Peewee B2
  ✅ Buffalo - Squirt B1
  ✅ Minnetonka - Bantam AA
  ✅ Shakopee - Squirt A
  ✅ St. Michael/Albertville - Bantam B
  ✅ Stillwater - Squirt A
  ✅ Woodbury - Bantam B1 Royal

Crossbar (2 tests)
  ✅ Chaska Chanhassen - Squirt B1 Gold
  ✅ St. Paul Capitals - Peewee A

Sprocket Sports (2 tests)
  ✅ Waconia - Squirt C (submenu variation)
  ✅ Minneapolis - Squirt C Black (direct links variation)
```

**Success Rate: 11/11 (100%)**

---

## Adding New Associations

### Quick Steps:
1. **Add to associations list**: `src/lib/associations.ts`
2. **Create find script**: `scripts/find-{name}.ts`
3. **Test scraping**: `npx tsx scripts/find-{name}.ts`
4. **Add test case**: `scripts/test-suite.ts`
5. **Run full suite**: `npx tsx scripts/test-suite.ts`

### Platform-Specific Considerations:

**SportsEngine/Crossbar:** Usually work automatically
- Scraper finds sitemap and team pages
- Extracts iCal URLs from page content

**Sprocket Sports:** May require investigation
- Check menu structure in browser
- Verify menu keyword ("TEAM LISTS", "TEAMS", or "TRAVELING")
- Confirm if structure is submenu-based or direct links
- Update scraper if using non-standard menu keyword

---

## Future Improvements

### Short Term:
1. Cache browser instances for faster Sprocket Sports scraping
2. Parallel team extraction for Sprocket Sports sites
3. Add more platform detection patterns

### Long Term:
1. Support for additional platforms as discovered
2. Implement fuzzy team name matching
3. Add caching to avoid re-scraping same associations
4. API endpoints if associations provide them
