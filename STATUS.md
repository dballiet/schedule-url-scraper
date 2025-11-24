# Hockey Schedule Scraper - Current Status

## Overview
This scraper supports **69 Minnesota hockey associations** across **3 platforms**, successfully extracting iCal calendar URLs for youth hockey teams.

## Supported Platforms

### 1. SportsEngine (Majority)
**Detection**: HTML contains `sportngin`, `sportsengine`, or `/ical_feed?tags=` patterns

**Examples**:
- Anoka Area Hockey Association
- Blaine Youth Hockey Association
- Woodbury Area Hockey Club
- Minnetonka Youth Hockey Association
- And 60+ more...

**iCal Pattern**: `webcal://{domain}/ical_feed?tags={pageId}`

### 2. Crossbar (PuckSystems)
**Detection**: Domain contains `pucksystems.com` or `pucksystems2.com`

**Examples**:
- Buffalo Hockey Association
- South St. Paul Youth Hockey Association

**iCal Pattern**: `webcal://{subdomain}.pucksystems.com/ical_feed?tags={pageId}`

### 3. Sprocket Sports (Angular SPA)
**Detection**: HTML contains `sprocketsports.com` or `<app-root>` element

**Requires**: Puppeteer for browser automation (dynamic content)

**Examples**:
- Waconia Hockey Association (submenu-based structure)
- Minneapolis Youth Hockey Association (direct links structure)

**iCal Pattern**: `webcal://{subdomain}.sprocketsports.com/ical?team={teamId}`

#### Sprocket Sports Variations

**Variation 1: Submenu-Based** (e.g., Waconia)
- Click "TEAM LISTS" → Click "Squirt Teams" → Extract individual team links
- Team links contain `navigationTeamID` parameter

**Variation 2: Direct Links** (e.g., Minneapolis)  
- Click "TRAVELING" → Team links appear immediately
- No submenu navigation needed

## Test Results

**Test Suite**: 11/11 PASSING (100%)

| Platform | Tests | Status |
|----------|-------|--------|
| SportsEngine | 8/8 | ✅ 100% |
| Crossbar | 2/2 | ✅ 100% |
| Sprocket Sports | 2/2 | ✅ 100% |

**Verified Teams**:
- Anoka Bantam A
- Blaine Peewee B2
- Woodbury Bantam B1 Royal  
- Waconia Squirt C (Sprocket Sports, submenu)
- Minneapolis Squirt C Black (Sprocket Sports, direct)
- And 6 more...

## Key Features

### Season Detection
- Automatically filters for current season (2025-2026)
- Handles multiple year formats: `2025-26`, `25-26`
- Prefers current season when duplicates found

### Team Categorization
- **Age Groups**: Mites, Squirts, Peewees, Bantams
- **Level Detail**: A, AA, B1, B2, C, team colors, etc.
- Handles abbreviations: SQ, PW, BN, BTM

### Browser Automation (Sprocket Sports)
- Headless Chrome via Puppeteer
- Navigates SPA menus dynamically
- Handles multiple site structures
- Deduplicates teams across age group pages

## Adding New Associations

### Quick Start
1. Add to `src/lib/associations.ts`:
```typescript
{ name: "Association Name", baseUrl: "https://www.example.com" }
```

2. Run scraper:
```bash
npx tsx scripts/find-association-name.ts
```

3. Create test case in `scripts/test-suite.ts`

### Platform-Specific Notes

**SportsEngine/Crossbar**: Usually work automatically
- Scraper finds sitemap and team pages
- Extracts iCal URLs from page content

**Sprocket Sports**: May require testing
- Verify menu structure (submenu vs direct links)
- Check if menu keyword is non-standard
- Test with browser automation

## Files Modified

| File | Purpose |
|------|---------|
| `src/lib/scraper.ts` | Core scraping logic + browser automation |
| `src/lib/associations.ts` | List of 69 associations |
| `PLATFORM_PATTERNS.md` | Platform detection patterns |
| `scripts/test-suite.ts` | Automated test cases |
| `package.json` | Dependencies (includes Puppeteer) |

## Dependencies

```json
{
  "axios": "HTTP requests",
  "cheerio": "HTML parsing",
  "puppeteer": "Browser automation (Sprocket Sports)",
  "@types/puppeteer": "TypeScript types"
}
```

## Running Tests

```bash
# Run full test suite (11 tests)
npx tsx scripts/test-suite.ts

# Test specific association
npx tsx scripts/find-waconia.ts
npx tsx scripts/find-minneapolis.ts
npx tsx scripts/find-blaine.ts
```

## Next Steps for New Associations

1. **Identify platform** (SportsEngine, Crossbar, or Sprocket Sports)
2. **Check if in list** (`src/lib/associations.ts`)
3. **Add if missing** with correct base URL
4. **Test scraping** with find script
5. **Add test case** to ensure it keeps working
6. **Document** any new patterns discovered

## Common Issues

### Sprocket Sports Not Finding Teams
- Check menu keyword ("TEAM LISTS", "TEAMS", or "TRAVELING")
- Verify site structure (submenu vs direct links)
- Update `scrapeSprocketSports` function if needed

### Wrong Season Teams
- Season detection prefers current year
- Check if team names/URLs contain season markers
- Verify `getCurrentSeasonYear()` logic

### Duplicate Teams
- Deduplication based on age group + level detail
- Check if team appears in multiple places
- May need to adjust deduplication key

---

**Ready for adding more associations!** 🏒
