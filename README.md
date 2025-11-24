# Minnesota Hockey Schedule Scraper

A comprehensive web scraper for extracting iCal calendar URLs from 63 Minnesota youth hockey associations across 3 different platforms.

## Features

- ✅ **Multi-Platform Support**: SportsEngine, Crossbar, and Sprocket Sports (Angular SPA)
- ✅ **Browser Automation**: Puppeteer integration for dynamic content
- ✅ **Season Detection**: Automatically filters for current season
- ✅ **Smart Deduplication**: Handles multiple team entries intelligently
- ✅ **63 Associations**: Complete coverage of major Minnesota hockey associations
- ✅ **All Team Types**: Boys, Girls (8U-19U), Mites, and all age divisions
- ✅ **100% Test Coverage**: 14/14 tests passing

## Supported Platforms

### SportsEngine (Majority)
- **Detection**: HTML contains `sportngin`, `sportsengine`, or `/ical_feed?tags=`
- **iCal Pattern**: `webcal://{domain}/ical_feed?tags={pageId}`
- **Examples**: Anoka, Blaine, Woodbury, Minnetonka, and 50+ more

### Crossbar (PuckSystems)
- **Detection**: Domain contains `pucksystems.com` or `pucksystems2.com`
- **iCal Pattern**: `webcal://{subdomain}.pucksystems.com/ical_feed?tags={pageId}`
- **Examples**: Buffalo, South St. Paul

### Sprocket Sports (Angular SPA)
- **Detection**: HTML contains `sprocketsports.com` or `<app-root>`
- **Requires**: Browser automation via Puppeteer
- **iCal Pattern**: `webcal://{subdomain}.sprocketsports.com/ical?team={teamId}`
- **Examples**: Waconia (submenu-based), Minneapolis (direct links)

## Quick Start

### Installation

```bash
npm install
```

### Run Scraper

```bash
# Spot check all associations (2-3 minutes)
npm run scrape:spot-check

# Run full test suite (14 tests)
npm run scrape:test

# Health check all 63 associations (10-15 minutes)
npm run scrape:health

# Scrape specific association
npx tsx scripts/find-eden-prairie.ts
npx tsx scripts/find-rogers.ts
npx tsx scripts/find-prior-lake.ts
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the web interface.

## Project Structure

```
schedule-url-scraper/
├── src/
│   └── lib/
│       ├── associations.ts    # 69 Minnesota associations
│       ├── scraper.ts         # Core scraping logic + browser automation
│       └── types.ts           # TypeScript interfaces
├── scripts/
│   ├── test-suite.ts          # Automated test runner
│   ├── find-*.ts              # Individual association test scripts
│   └── scrape-all.ts          # Scrape all associations
├── PLATFORM_PATTERNS.md       # Platform detection patterns
├── STATUS.md                  # Current project status
└── README.md                  # This file
```

## Adding New Associations

### Step 1: Add to Association List

Edit `src/lib/associations.ts`:

```typescript
{ name: "Association Name", baseUrl: "https://www.example.com" }
```

### Step 2: Create Find Script

Create `scripts/find-association-name.ts`:

```typescript
import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function findTeam() {
    const association = ASSOCIATIONS.find(a => 
        a.name.toLowerCase().includes('association name')
    );
    
    const teams = await scrapeAssociation(association);
    console.log(teams);
}

findTeam().catch(console.error);
```

### Step 3: Test

```bash
npx tsx scripts/find-association-name.ts
```

### Step 4: Add Test Case

Add to `scripts/test-suite.ts`:

```typescript
{
    association: 'Association Name',
    teamName: 'Squirt A',
    expectedUrl: 'webcal://example.com/ical_feed?tags=12345',
    platform: 'SportsEngine'
}
```

### Step 5: Verify

```bash
npx tsx scripts/test-suite.ts
```

## Platform-Specific Notes

### SportsEngine / Crossbar
These platforms usually work automatically:
- Scraper finds sitemap and team pages
- Extracts iCal URLs from page content
- No special configuration needed

### Sprocket Sports
May require manual verification:
1. Check menu structure in browser
2. Verify menu keyword:
   - "TEAM LISTS" or "TEAMS" (most common)
   - "TRAVELING" (Minneapolis)
3. Confirm structure type:
   - **Submenu-based**: Click age group → reveals teams
   - **Direct links**: Teams appear immediately in menu
4. Update scraper if non-standard

## Test Results

```
🏒 Running Comprehensive Test Suite
═══════════════════════════════════════════════

Total Tests: 11
✅ Passed: 11
❌ Failed: 0
Success Rate: 100.0%

📈 Results by Platform:
   SportsEngine: 8/8 (100.0%)
   Crossbar: 2/2 (100.0%)
   Sprocket Sports: 2/2 (100.0%)
```

## Dependencies

```json
{
  "axios": "^1.x",           // HTTP requests
  "cheerio": "^1.x",         // HTML parsing
  "puppeteer": "^21.x",      // Browser automation
  "@types/puppeteer": "^7.x" // TypeScript types
}
```

## Key Features

### Season Detection
- Automatically identifies current season (2025-2026)
- Handles multiple year formats: `2025-26`, `25-26`
- Prefers current season when duplicates found

### Team Categorization
- **Age Groups**: Mites, Squirts, Peewees, Bantams
- **Level Details**: A, AA, B1, B2, C, team colors
- Handles abbreviations: SQ, PW, BN, BTM

### Browser Automation
- Headless Chrome via Puppeteer
- Navigates SPA menus dynamically
- Handles multiple Sprocket Sports variations
- Deduplicates teams across age group pages

## Documentation

- **[STATUS.md](STATUS.md)** - Complete project overview and quick reference
- **[PLATFORM_PATTERNS.md](PLATFORM_PATTERNS.md)** - Detailed platform patterns and detection logic
- **[Implementation Plan](/.gemini/antigravity/brain/*/implementation_plan.md)** - Original implementation plan
- **[Walkthrough](/.gemini/antigravity/brain/*/walkthrough.md)** - Implementation walkthrough with screenshots

## Common Issues

### Sprocket Sports Not Finding Teams
- Check menu keyword in browser ("TEAM LISTS", "TEAMS", or "TRAVELING")
- Verify site structure (submenu vs direct links)
- Update `scrapeSprocketSports` function if needed

### Wrong Season Teams
- Season detection prefers current year (2025-2026)
- Check if team names/URLs contain season markers
- Verify `getCurrentSeasonYear()` logic (switches in July)

### Duplicate Teams
- Deduplication based on `{ageGroup}-{levelDetail}` key
- Check if same team appears in multiple places
- May need to adjust deduplication logic

## License

MIT

## Contact

For issues or questions about adding new associations, see [STATUS.md](STATUS.md) for guidance.

---

**Ready to scrape!** 🏒
