# IGH Season Filtering Issue

## Problem

User reported that IGH (Inver Grove Heights) only has **Bantam C** for the 2025-2026 season, but the scraper is returning **Bantam B2**.

## Root Cause

Investigation of IGH's sitemap reveals the issue:

### Old Team (2023-2024 - SHOULD BE FILTERED OUT)
- **URL:** `https://www.ighha.org/page/show/8258877-bantam-b2-2023-2024-`
- **Team:** Bantam B2 2023-2024
- **Calendar URL:** `webcal://www.ighha.org/ical_feed?tags=8258877` ❌ (This is what scraper picked up)

### Current Team (2025-2026 - SHOULD BE SELECTED)
- **URL:** `https://www.ighha.org/page/show/9256141-bantam-c-2025-2026-`
- **Team:** Bantam C 2025-2026
- **Calendar URL:** `webcal://www.ighha.org/ical_feed?tags=9256141` ✅ (This is what should be selected)

## Season Filtering Logic Failure

The current season filtering logic in `scraper.ts` is supposed to:

1. Extract season year from team names using `extractSeasonYear()`
2. Compare extracted year to current season year from `getCurrentSeasonYear()`
3. Prioritize current season teams and filter out old duplicates

**Current Season Calculation:**
- Current date: November 2024
- Month: 11 (>= 7, so we're in 2024-2025 season)
- Expected current season year: 2024

**Why it's failing:**
- The 2023-2024 page should be filtered out (2023 < 2024)
- The 2025-2026 page should be preferred (2025 >= 2024)
- But the scraper is picking 2023-2024 instead

## Potential Causes

1. **Season year not being extracted** - Maybe the "2023-2024" format isn't matched by regex
2. **Filtering logic bug** - The comparison/filtering may have a logic error
3. **Page ordering** - Old pages might be processed first and blocking new ones
4. **ID-based deduplication issue** - The deduplication might be keeping the wrong entry

## Impact

This is likely affecting **other associations** as well, not just IGH. Any association with pages from multiple seasons could have this issue.

## Options

1. **Fix season filtering globally** - Debug and fix the core issue
2. **Add association-specific overrides** - Force IGH to use 2025-2026 pages
3. **Accept as limitation** - Document and move on

## Recommendation

**Fix season filtering globally** - This is a core data quality issue that undermines the entire scraper. The user specifically removed the brittle IGH filter expecting season filtering to handle old teams, but it's not working.
