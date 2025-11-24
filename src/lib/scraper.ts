import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { Association, ScrapedTeam } from './types';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

async function fetchHtml(url: string): Promise<string | null> {
    try {
        if (url.startsWith('javascript:') || url.startsWith('webcal:') || url.endsWith('.ics')) return null;
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000,
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Failed to fetch ${url}: ${error.message}`);
        } else {
            console.error(`Failed to fetch ${url}:`, error);
        }
        return null;
    }
}

function normalizeUrl(baseUrl: string, href: string): string {
    try {
        if (href.startsWith('javascript:')) return href;
        return new URL(href, baseUrl).toString();
    } catch {
        return href;
    }
}

function getAgeGroup(name: string): 'Mites' | 'Squirts' | 'Peewees' | 'Bantams' | null {
    const lower = name.toLowerCase();
    if (lower.includes('mite')) return 'Mites';
    if (lower.includes('squirt') || lower.includes('sq-') || /\bsq\b/.test(lower)) return 'Squirts';
    if (lower.includes('peewee') || lower.includes('pw-') || /\bpw\b/.test(lower)) return 'Peewees';
    if (lower.includes('bantam') || lower.includes('btm-') || lower.includes('bn-') || /\b(btm|bn)\b/.test(lower)) return 'Bantams';
    return null;
}

function getLevelDetail(name: string, ageGroup: string): string {
    const singular = ageGroup.endsWith('s') ? ageGroup.slice(0, -1) : ageGroup;
    const regex = new RegExp(`(${ageGroup}|${singular})`, 'i');
    let detail = name.replace(regex, '').trim();
    detail = detail.replace(/^(Team|Jr\.?|Boys|Girls)\s+/i, '');
    detail = detail.replace(/[-–]/g, '').trim();
    return detail || 'Unknown';
}

function extractSeasonYearRange(text: string): { start: number, end: number } | null {
    const patterns = [
        /(20\d{2})-(20\d{2})/, // Matches "2023-2024"
        /(20\d{2})-(\d{2})/,   // Matches "2023-24"
        /(\d{2})-(\d{2})/      // Matches "23-24"
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let startYear = match[1];
            let endYear = match[2];

            // Convert 2-digit years to 4-digit
            if (startYear.length === 2) {
                startYear = '20' + startYear;
            }
            if (endYear.length === 2) {
                endYear = '20' + endYear;
            }

            return {
                start: parseInt(startYear),
                end: parseInt(endYear)
            };
        }
    }
    return null;
}

function extractSeasonYear(text: string): number | null {
    const range = extractSeasonYearRange(text);
    return range ? range.start : null;
}

function getCurrentSeasonYear(): number {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return month >= 7 ? year : year - 1;
}

function isCurrentSeason(text: string, currentSeasonYear: number): boolean {
    const range = extractSeasonYearRange(text);
    if (!range) return false;

    // Check if current season year falls within the range OR if range starts next year
    // e.g., for "2024-2025" range is [2024, 2025] - currentSeasonYear 2024 should match
    // e.g., for "2025-2026" range is [2025, 2026] - currentSeasonYear 2024 should ALSO match (next season)
    // e.g., for "2022-2023" range is [2022, 2023] - currentSeasonYear 2024 should NOT match (old season)

    return (currentSeasonYear >= range.start && currentSeasonYear <= range.end) ||
        (range.start === currentSeasonYear + 1);
}

/**
 * Detect if a page is likely not a team page (e.g., registration, jamboree, PDF)
 */
function isLikelyNonTeamPage(name: string, url: string): boolean {
    const lower = name.toLowerCase();

    // Reject obvious non-team keywords
    const rejectKeywords = [
        'click me', 'click here', 'register', 'registration',
        'jamboree', 'bracket', 'volunteer', 'fundraiser',
        'frequently asked', 'faq', 'info page', 'information',
        'contact', 'board', 'coaching corner', 'coaches corner',
        'game day roster', 'layout', 'cost', 'fees',
        'camp', 'clinic', 'article', 'news', 'trophy', 'achievement',
        'photo album', 'pictures', 'champions', 'congratulations'
    ];

    if (rejectKeywords.some(kw => lower.includes(kw))) {
        return true;
    }

    // Reject pages that are likely just navigation
    if (name.includes('>') || lower.includes('click here')) {
        return true;
    }

    // Reject direct document links
    if (url.endsWith('.pdf') || url.endsWith('.doc') || url.endsWith('.docx') ||
        url.includes('/attachments/document/')) {
        return true;
    }

    // Reject if URL points to external sites (not team calendars)
    if (url.includes('givemn.org') || url.includes('gamesheetstats.com') ||
        url.includes('google.com/spreadsheets') || url.includes('onenationexteriors.com') ||
        url.includes('discover.sportsengineplay.com') || url.includes('/trophycase') ||
        url.includes('/news_article/') || url.includes('/news/') ||
        url.includes('youtube.com') || url.includes('youtu.be')) {
        return true;
    }

    return false;
}

/**
 * Validate that a URL is a proper calendar URL
 */
function isValidCalendarUrl(url: string): boolean {
    // Must be webcal:// or contain calendar/schedule/ical paths
    return url.startsWith('webcal://') ||
        url.includes('/ical_feed') ||
        url.includes('.ics') ||
        url.includes('/calendar') ||
        url.includes('/schedule');
}

async function findCalendarUrl(teamUrl: string): Promise<string | null> {
    const idMatch = teamUrl.match(/\/page\/show\/(\d+)/);
    if (idMatch) {
        const id = idMatch[1];
        const baseUrl = new URL(teamUrl).origin;
        return `webcal://${new URL(baseUrl).hostname}/ical_feed?tags=${id}`;
    }

    const html = await fetchHtml(teamUrl);
    if (!html) return null;

    const $ = cheerio.load(html);
    let bestUrl: string | null = null;

    $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        if (href.startsWith('webcal://') || href.includes('.ics') || href.includes('ical_feed')) {
            bestUrl = normalizeUrl(teamUrl, href);
            return false;
        }
    });

    if (bestUrl && isValidCalendarUrl(bestUrl)) return bestUrl;

    let pageId: string | null = null;
    $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const match = href.match(/\/page\/show\/(\d+)/);
        if (match) {
            const text = $(el).text().trim().toLowerCase();
            if (text === 'home' || text.includes('team')) {
                pageId = match[1];
            }
        }
    });

    if (pageId) {
        const baseUrl = new URL(teamUrl).origin;
        return `webcal://${new URL(baseUrl).hostname}/ical_feed?tags=${pageId}`;
    }

    if (teamUrl.includes('/calendar') || teamUrl.includes('/schedule')) {
        return teamUrl;
    }

    let scheduleUrl: string | null = null;
    $('a').each((_, el) => {
        const text = $(el).text().toLowerCase();
        const href = $(el).attr('href');
        if (!href) return;

        if (text.includes('schedule') || text.includes('calendar')) {
            const absolute = normalizeUrl(teamUrl, href);
            if (absolute !== teamUrl && absolute.includes(new URL(teamUrl).hostname)) {
                scheduleUrl = absolute;
            }
        }
    });

    // Only return if it's a valid calendar URL
    if (scheduleUrl && isValidCalendarUrl(scheduleUrl)) return scheduleUrl;
    return null;
}

async function fetchSitemap(baseUrl: string): Promise<string[]> {
    const sitemapUrl = normalizeUrl(baseUrl, '/sitemap.xml');
    console.log(`Checking sitemap: ${sitemapUrl}`);
    const xml = await fetchHtml(sitemapUrl);
    if (!xml) return [];

    const urls: string[] = [];
    const $ = cheerio.load(xml, { xmlMode: true });

    $('loc').each((_, el) => {
        const url = $(el).text().trim();
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.includes('team') ||
            lowerUrl.includes('bantam') ||
            lowerUrl.includes('squirt') ||
            lowerUrl.includes('peewee') ||
            lowerUrl.includes('mite') ||
            lowerUrl.includes('travel') ||
            lowerUrl.includes('youth') ||
            lowerUrl.includes('pw-') ||
            lowerUrl.includes('btm-') ||
            lowerUrl.includes('bn-') ||
            lowerUrl.includes('sq-') ||
            lowerUrl.includes('10u') ||
            lowerUrl.includes('12u') ||
            lowerUrl.includes('15u')) {
            urls.push(url);
        }
    });

    console.log(`Found ${urls.length} relevant URLs in sitemap.`);
    return urls;
}

function extractPageId(url: string): number | null {
    const match = url.match(/(?:tags=|page\/show\/)(\d+)/);
    return match ? parseInt(match[1]) : null;
}

async function scrapeSprocketSports(association: Association): Promise<ScrapedTeam[]> {
    console.log(`Using browser automation for Sprocket Sports site...`);
    const teams: ScrapedTeam[] = [];

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.goto(association.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        console.log('Looking for team lists...');

        try {
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'));
                const teamLink = links.find(a =>
                    a.textContent?.toUpperCase().includes('TEAM LIST') ||
                    a.textContent?.toUpperCase().includes('TEAMS') ||
                    a.textContent?.toUpperCase().includes('TRAVELING')
                );
                if (teamLink) (teamLink as HTMLElement).click();
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.log('Could not find team lists link, continuing...');
        }

        const ageGroups = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .filter(a => {
                    const text = a.textContent?.toLowerCase() || '';
                    return text.includes('squirt') || text.includes('bantam') ||
                        text.includes('peewee') || text.includes('mite');
                })
                .map(a => ({
                    text: a.textContent?.trim() || '',
                    href: (a as HTMLAnchorElement).href
                }));
        });

        console.log(`Found ${ageGroups.length} age group categories`);

        for (const group of ageGroups) {
            // Skip if this looks like a submenu (contains 'team' or 'teams')
            const isSubmenu = group.text.toLowerCase().includes('team');

            if (isSubmenu) {
                // Original Waconia-style: click submenu then extract teams
                console.log(`Checking ${group.text}...`);

                try {
                    await page.evaluate((text) => {
                        const links = Array.from(document.querySelectorAll('a'));
                        const link = links.find(a => a.textContent?.trim() === text);
                        if (link) (link as HTMLElement).click();
                    }, group.text);

                    await new Promise(resolve => setTimeout(resolve, 1500));

                    const categoryTeams = await page.$$eval('a[href*="navigationTeamID"]', (links) => {
                        return links.map(link => {
                            const href = (link as HTMLAnchorElement).href;
                            const match = href.match(/navigationTeamID=(\d+)/);
                            const teamId = match ? match[1] : null;
                            const name = link.textContent?.trim() || '';
                            return { name, teamId, href };
                        }).filter(t => t.teamId && t.name);
                    });

                    console.log(`  Found ${categoryTeams.length} teams in ${group.text}`);

                    for (const team of categoryTeams) {
                        const ageGroup = getAgeGroup(team.name);
                        if (!ageGroup) continue;

                        const urlMatch = association.baseUrl.match(/https?:\/\/(?:www\.)?([^./]+)/);
                        const subdomain = urlMatch ? urlMatch[1] : 'unknown';

                        teams.push({
                            association_name: association.name,
                            name: team.name,
                            sport_type: 'hockey',
                            team_level: ageGroup,
                            level_detail: getLevelDetail(team.name, ageGroup),
                            calendar_sync_url: `webcal://${subdomain}.sprocketsports.com/ical?team=${team.teamId}`
                        });
                    }
                } catch (e) {
                    console.log(`  Error extracting teams from ${group.text}:`, e);
                }
            } else if (group.href && group.href.includes('navigationTeamID')) {
                // Minneapolis-style: age group links ARE the team links
                const match = group.href.match(/navigationTeamID=(\d+)/);
                const teamId = match ? match[1] : null;

                if (teamId && group.text) {
                    const ageGroup = getAgeGroup(group.text);
                    if (!ageGroup) continue;

                    const urlMatch = association.baseUrl.match(/https?:\/\/(?:www\.)?([^./]+)/);
                    const subdomain = urlMatch ? urlMatch[1] : 'unknown';

                    teams.push({
                        association_name: association.name,
                        name: group.text,
                        sport_type: 'hockey',
                        team_level: ageGroup,
                        level_detail: getLevelDetail(group.text, ageGroup),
                        calendar_sync_url: `webcal://${subdomain}.sprocketsports.com/ical?team=${teamId}`
                    });
                }
            }
        }

    } finally {
        await browser.close();
    }

    const uniqueTeams = Array.from(
        teams.reduce((map, team) => {
            const key = `${team.team_level}-${team.level_detail}-${team.calendar_sync_url}`;
            if (!map.has(key)) {
                map.set(key, team);
            }
            return map;
        }, new Map<string, ScrapedTeam>()).values()
    );

    console.log(`Found ${uniqueTeams.length} unique teams via browser automation`);
    return uniqueTeams;
}

const associationOverrides: Record<string, string[]> = {
    'Mound Westonka Hockey Association': [
        'https://www.westonkahockey.org/season_management_season_page/tab_schedule?page_node_id=9253480'
    ],
    'Minneapolis Titans Hockey': [
        'https://www.minneapolistitanshockey.com/page/show/9080091-pee-wee-2025-2026'
    ]
};

export async function scrapeAssociation(association: Association): Promise<ScrapedTeam[]> {
    console.log(`Scraping ${association.name}...`);

    const html = await fetchHtml(association.baseUrl);
    if (html && (html.includes('sprocketsports.com') || html.includes('app-root'))) {
        console.log('Detected Sprocket Sports platform...');
        return scrapeSprocketSports(association);
    }

    const teams: ScrapedTeam[] = [];
    const visitedUrls = new Set<string>();
    const pagesToVisit: string[] = [association.baseUrl];

    const sitemapUrls = await fetchSitemap(association.baseUrl);
    if (sitemapUrls.length > 0) {
        pagesToVisit.push(...sitemapUrls);
    }

    if (associationOverrides[association.name]) {
        console.log(`Adding override URLs for ${association.name}`);
        pagesToVisit.push(...associationOverrides[association.name]);
    }

    const baseHtml = html || await fetchHtml(association.baseUrl);
    if (baseHtml) {
        const $ = cheerio.load(baseHtml);
        let linksFound = 0;
        $('a').each((_, el) => {
            const text = $(el).text().trim().toLowerCase();
            const href = $(el).attr('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

            if (linksFound < 100) {
                linksFound++;
            }

            const url = normalizeUrl(association.baseUrl, href);
            const lowerHref = href.toLowerCase();

            const keywords = ['teams', 'travel', 'youth', 'programs', 'boys', 'girls', 'hockey'];
            const hasKeyword = keywords.some(k => text.includes(k) || lowerHref.includes(k));
            const ageGroup = getAgeGroup(text);

            if (hasKeyword || ageGroup) {
                if (!pagesToVisit.includes(url)) {
                    pagesToVisit.push(url);
                }
            }
        });
    }

    const MAX_PAGES = 200;
    let pagesProcessed = 0;

    while (pagesToVisit.length > 0 && pagesProcessed < MAX_PAGES) {
        const url = pagesToVisit.shift()!;
        if (visitedUrls.has(url)) continue;
        visitedUrls.add(url);
        pagesProcessed++;

        console.log(`Scanning page (${pagesProcessed}/${MAX_PAGES}): ${url}`);
        const pageHtml = await fetchHtml(url);
        if (!pageHtml) continue;

        const $page = cheerio.load(pageHtml);

        let pageTitle = $page('h1').first().text().trim();

        if (!pageTitle) {
            const h2Text = $page('h2').first().text().trim();
            const hasLevelIndicators = /\b(A{1,2}|B[12]?|C|[Gg]old|[Pp]urple|[Bb]lack|[Ww]hite|[Bb]lue|[Rr]ed|[Gg]reen|[Mm]achine)\b/.test(h2Text);
            if (hasLevelIndicators) {
                pageTitle = h2Text;
            }
        }

        const pageAgeGroup = getAgeGroup(pageTitle);

        if (pageAgeGroup) {
            // Skip if this looks like a non-team page
            if (isLikelyNonTeamPage(pageTitle, url)) {
                console.log(`  Skipping non-team page: ${pageTitle}`);
                continue;
            }

            const calendarUrl = await findCalendarUrl(url);
            if (calendarUrl) {
                if (!teams.some(t => t.calendar_sync_url === calendarUrl)) {
                    teams.push({
                        association_name: association.name,
                        name: pageTitle,
                        sport_type: 'hockey',
                        team_level: pageAgeGroup,
                        level_detail: getLevelDetail(pageTitle, pageAgeGroup),
                        calendar_sync_url: calendarUrl
                    });
                }
            }
        }

        $page('a').each((_, el) => {
            const text = $page(el).text().trim();
            const href = $page(el).attr('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

            const ageGroup = getAgeGroup(text);
            if (ageGroup) {
                const absUrl = normalizeUrl(url, href);
                if (visitedUrls.has(absUrl) || absUrl.startsWith('webcal:') || absUrl.endsWith('.ics')) return;

                // Skip if this looks like a non-team page
                if (isLikelyNonTeamPage(text, absUrl)) {
                    return;
                }

                const lowerText = text.toLowerCase();
                const levelIndicators = [' a', ' aa', ' b1', ' b2', ' c', ' gold', ' purple', ' black', ' white', ' blue', ' red', ' green', ' orange', ' grey', ' gray', ' navy', ' royal'];
                const hasLevelIndicator = levelIndicators.some(ind => lowerText.includes(ind));
                const isLikelyLevelPage = !hasLevelIndicator || lowerText.includes('level') || lowerText.includes('page');

                if (isLikelyLevelPage) {
                    if (!pagesToVisit.includes(absUrl) && !visitedUrls.has(absUrl)) {
                        pagesToVisit.unshift(absUrl);
                    }
                } else {
                    if (!teams.some(t => t.calendar_sync_url === absUrl)) {
                        teams.push({
                            association_name: association.name,
                            name: text,
                            sport_type: 'hockey',
                            team_level: ageGroup,
                            level_detail: getLevelDetail(text, ageGroup),
                            calendar_sync_url: absUrl
                        });
                    }
                }
            }
        });
    }

    console.log(`Found ${teams.length} potential teams. Filtering for current season...`);

    const currentSeason = getCurrentSeasonYear();
    const teamMap = new Map<string, ScrapedTeam>();

    for (const team of teams) {
        const key = `${team.team_level}-${team.level_detail}`.toLowerCase();

        // Check if this team is from the current season
        const teamIsCurrentSeason = isCurrentSeason(team.name, currentSeason) ||
            isCurrentSeason(team.calendar_sync_url, currentSeason);

        const existing = teamMap.get(key);
        if (!existing) {
            teamMap.set(key, team);
        } else {
            // Check if existing team is from current season
            const existingIsCurrentSeason = isCurrentSeason(existing.name, currentSeason) ||
                isCurrentSeason(existing.calendar_sync_url, currentSeason);

            // Priority 1: Prefer current season over old seasons
            if (teamIsCurrentSeason && !existingIsCurrentSeason) {
                teamMap.set(key, team);
            } else if (!teamIsCurrentSeason && existingIsCurrentSeason) {
                // Keep existing (it's current season, new one is old)
            } else {
                // Both are current season or both are old - use other criteria
                const seasonFromUrl = extractSeasonYear(team.calendar_sync_url);
                const seasonFromName = extractSeasonYear(team.name);
                const teamSeason = seasonFromUrl || seasonFromName;

                const existingSeason = extractSeasonYear(existing.calendar_sync_url) || extractSeasonYear(existing.name);

                if (teamSeason && existingSeason && teamSeason > existingSeason) {
                    // Newer year
                    teamMap.set(key, team);
                } else if (teamSeason && !existingSeason) {
                    // Team has year, existing doesn't
                    teamMap.set(key, team);
                } else if (!teamSeason && !existingSeason) {
                    // Neither has year, compare by page ID (newer pages have higher IDs)
                    const teamId = extractPageId(team.calendar_sync_url);
                    const existingId = extractPageId(existing.calendar_sync_url);

                    if (teamId && existingId && teamId > existingId) {
                        teamMap.set(key, team);
                    }
                }
            }
        }
    }

    const filteredTeams = Array.from(teamMap.values());
    console.log(`After season filtering: ${filteredTeams.length} teams (removed ${teams.length - filteredTeams.length} old season duplicates)`);

    for (const team of filteredTeams) {
        console.log(`Resolving calendar for ${team.name}...`);
        const resolved = await findCalendarUrl(team.calendar_sync_url);
        if (resolved) team.calendar_sync_url = resolved;
    }

    return filteredTeams;
}
