import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { AGE_GROUPS, AgeGroup, Association, ScrapedTeam } from './types';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const MIN_HOST_GAP_MS = 800;
const HOST_JITTER_MS = 400;
const MAX_FETCH_RETRIES = 2;
const htmlCache = new Map<string, Promise<string | null>>();
const hostLastRequest = new Map<string, number>();
const hostErrorCount = new Map<string, number>();

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function applyHostDelay(url: string) {
    try {
        const host = new URL(url).hostname;
        const last = hostLastRequest.get(host) || 0;
        const errorCount = hostErrorCount.get(host) || 0;
        // Progressive throttling: increase delay based on recent errors
        const throttleMultiplier = Math.pow(1.5, errorCount);
        const gap = (MIN_HOST_GAP_MS + Math.random() * HOST_JITTER_MS) * throttleMultiplier;
        const waitFor = Math.max(0, last + gap - Date.now());
        if (waitFor > 0) await sleep(waitFor);
        hostLastRequest.set(host, Date.now());
    } catch {
        // If URL parsing fails, just continue without delaying
    }
}

async function fetchHtml(url: string): Promise<string | null> {
    if (url.startsWith('javascript:') || url.startsWith('webcal:') || url.endsWith('.ics')) return null;
    if (htmlCache.has(url)) return htmlCache.get(url)!;

    const fetchPromise = (async () => {
        let attempt = 0;
        while (attempt <= MAX_FETCH_RETRIES) {
            try {
                await applyHostDelay(url);
                const response = await axios.get(url, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 10000,
                });
                // Reset error count on successful request
                try {
                    const host = new URL(url).hostname;
                    hostErrorCount.set(host, 0);
                } catch { }
                return response.data;
            } catch (error) {
                const isAxios = axios.isAxiosError(error);
                const status = isAxios ? error.response?.status : null;
                const retryable = status === 429 || status === 503 || status === 504;
                const shouldRetry = retryable && attempt < MAX_FETCH_RETRIES;

                // Track rate limit errors for progressive throttling
                if (status === 429 || status === 503) {
                    try {
                        const host = new URL(url).hostname;
                        const currentErrors = hostErrorCount.get(host) || 0;
                        hostErrorCount.set(host, currentErrors + 1);
                        console.warn(`Rate limited by ${host} (error count: ${currentErrors + 1}), increasing delay...`);
                    } catch { }
                }

                if (!shouldRetry) {
                    if (isAxios) {
                        console.error(`Failed to fetch ${url}: ${error.message}`);
                    } else {
                        console.error(`Failed to fetch ${url}:`, error);
                    }
                    return null;
                }

                const backoff = 1000 * Math.pow(2, attempt) + Math.random() * 300;
                attempt++;
                await sleep(backoff);
            }
        }
        return null;
    })();

    htmlCache.set(url, fetchPromise);
    return fetchPromise;
}

async function fetchIcalContent(url: string): Promise<string | null> {
    // Convert webcal:// to https:// for fetching
    const fetchUrl = url.replace(/^webcal:\/\//, 'https://');
    try {
        await applyHostDelay(fetchUrl);
        const response = await axios.get(fetchUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000,
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Failed to fetch iCal ${url}: ${error.message}`);
        }
        return null;
    }
}

async function getIcalEventCount(url: string): Promise<number> {
    const content = await fetchIcalContent(url);
    if (!content) return -1; // Error fetching
    const matches = content.match(/BEGIN:VEVENT/g);
    return matches ? matches.length : 0;
}

function normalizeUrl(baseUrl: string, href: string): string {
    try {
        if (href.startsWith('javascript:')) return href;
        return new URL(href, baseUrl).toString();
    } catch {
        return href;
    }
}

function isRogersHost(url: string): boolean {
    return url.includes('rogershockey.com');
}

async function discoverRogersTeamCalendars(baseUrl: string): Promise<string[]> {
    const calendars = new Set<string>();
    const baseHtml = await fetchHtml(baseUrl);
    if (baseHtml) {
        const directIds = baseHtml.match(/\/team\/(\d+)\/calendar/gi) || [];
        directIds.forEach(match => calendars.add(normalizeUrl(baseUrl, match)));

        const idMatches = baseHtml.match(/teamId\\":(\d+)/g) || [];
        idMatches.forEach(m => {
            const num = m.match(/(\d+)/);
            if (num) calendars.add(`${baseUrl}/team/${num[1]}/calendar`);
        });
    }

    // Probe nearby IDs based on observed ranges
    const ranges = [
        [162560, 162585], // squirt/youth
        [164470, 164500], // mites
        [189520, 189550]  // girls 10U/12U/15U
    ];
    for (const [start, end] of ranges) {
        for (let id = start; id <= end; id++) {
            calendars.add(`${baseUrl}/team/${id}/calendar`);
        }
    }

    return Array.from(calendars);
}

function buildSprocketCalendarUrl(association: Association, href?: string, navigationTeamId?: string | null): string | null {
    if (href) {
        let absolute = normalizeUrl(association.baseUrl, href);
        if (absolute.includes('/overview') && navigationTeamId) {
            absolute = absolute.replace('/overview', '/schedule');
        }
        if (absolute.includes('/schedule') || absolute.includes('/calendar')) {
            return absolute;
        }
    }

    if (navigationTeamId) {
        const urlMatch = association.baseUrl.match(/https?:\/\/(?:www\.)?([^./]+)/);
        const subdomain = urlMatch ? urlMatch[1] : new URL(association.baseUrl).hostname;
        return `https://${subdomain}.sprocketsports.com/ical?team=${navigationTeamId}`;
    }

    return null;
}

function buildAbsoluteUrl(baseUrl: string, href: string): string | null {
    if (!href) return null;
    const trimmed = href.trim();
    if (!trimmed || trimmed === '#' || trimmed === '/' ||
        trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') ||
        trimmed.startsWith('http://#') || trimmed.startsWith('https://#')) {
        return null;
    }

    try {
        const absolute = new URL(trimmed, baseUrl);
        if (!['http:', 'https:'].includes(absolute.protocol)) return null;
        return absolute.toString();
    } catch {
        return null;
    }
}

function getSameHostUrl(baseUrl: string, href: string, baseHost: string): string | null {
    const absolute = buildAbsoluteUrl(baseUrl, href);
    if (!absolute) return null;

    try {
        const host = new URL(absolute).hostname;
        if (host !== baseHost) return null;
    } catch {
        return null;
    }

    // Skip obvious non-team or noisy pages early
    if (absolute.includes('/news_article/') || absolute.includes('/news/')) return null;
    if (absolute.includes('/register') || absolute.includes('/registration')) return null;
    if (absolute.includes('trophycase') || absolute.includes('/attachments/document/')) return null;

    return absolute;
}

function getAgeGroup(name: string): AgeGroup | null {
    const lower = name.toLowerCase();
    if (lower.includes('mite')) return 'Mites';
    if (lower.includes('squirt') || lower.includes('sq-') || /\bsq\b/.test(lower) || /\bsqu\b/.test(lower)) return 'Squirts';
    if (lower.includes('peewee') || /\bpee\s*wee\b/.test(lower) || lower.includes('peew') ||
        lower.includes('pw-') || /\bpw\b/.test(lower) || /\bpws\b/.test(lower)) return 'Peewees';
    if (lower.includes('bantam') || lower.includes('bant-') || lower.includes('ban ') ||
        lower.includes('btm-') || lower.includes('bn-') || /\b(btm|bn|ban|bant)\b/.test(lower)) return 'Bantams';
    const tenU = /(?:\b10\s*u|\bu\s*10|\b10-u|\bu-10|\b10u\b|\bu10\b)(?=\b|[^0-9])/;
    const twelveU = /(?:\b12\s*u|\bu\s*12|\b12-u|\bu-12|\b12u\b|\bu12\b)(?=\b|[^0-9])/;
    const fifteenU = /(?:\b15\s*u|\bu\s*15|\b15-u|\bu-15|\b15u\b|\bu15\b)(?=\b|[^0-9])/;
    if (tenU.test(lower)) return '10U';
    if (twelveU.test(lower)) return '12U';
    if (fifteenU.test(lower)) return '15U';
    return null;
}

function isAllowedAgeGroup(ageGroup: AgeGroup | null, allowed: Set<AgeGroup>): ageGroup is AgeGroup {
    return !!ageGroup && allowed.has(ageGroup);
}

function getLevelDetail(name: string, ageGroup: string): string {
    const singular = ageGroup.endsWith('s') ? ageGroup.slice(0, -1) : ageGroup;
    const regex = new RegExp(`(${ageGroup}|${singular})`, 'i');
    let detail = name.replace(regex, '').trim();
    detail = detail.replace(/^(Team|Jr\.?|Boys|Girls)\s+/i, '');
    detail = detail.replace(/[-–]/g, ' ').trim();
    return detail || 'Unknown';
}

function isAggregateLevelDetail(detail: string): boolean {
    const normalized = detail.toLowerCase().replace(/\s+/g, ' ').trim();
    return normalized === 'all' ||
        normalized === 'all team' ||
        normalized === 'all teams' ||
        normalized === 'all levels';
}

function normalizeMiteLevelDetail(detail: string): string {
    const token = detail.match(/\b(aa|a|b1|b2|b|c1|c2|c|d|[1-4]|6u|8u)\b/i);
    return token ? token[1].toUpperCase() : detail;
}

function normalizeCompetitiveLevelDetail(detail: string): string {
    // Remove leftover age-group abbreviations then capture a known level token
    const stripped = detail.toLowerCase()
        .replace(/\b(bantam|bantams|ban|btm|bn|squirt|squirts|sq|peewee|peewees|pw)\b/g, '')
        .trim();
    const matches = stripped.match(/\b(aa|a|b1|b2|b|c1|c2|c)\b/gi);
    if (matches && matches.length > 0) {
        return matches[matches.length - 1].toUpperCase();
    }
    return detail;
}

function normalizeLevelDetailForAgeGroup(ageGroup: string, detail: string): string {
    if (ageGroup === 'Mites') return normalizeMiteLevelDetail(detail);
    if (ageGroup === 'Squirts' || ageGroup === 'Peewees' || ageGroup === 'Bantams' ||
        ageGroup === '10U' || ageGroup === '12U' || ageGroup === '15U') {
        return normalizeCompetitiveLevelDetail(detail);
    }
    return detail;
}

function getNormalizedLevelToken(ageGroup: string, detail: string): string | null {
    if (ageGroup === 'Mites') {
        const token = detail.match(/\b(aa|a|b1|b2|b|c1|c2|c|d|[1-4])\b/i);
        return token ? token[1].toUpperCase() : null;
    }
    if (ageGroup === 'Squirts' || ageGroup === 'Peewees' || ageGroup === 'Bantams' ||
        ageGroup === '10U' || ageGroup === '12U' || ageGroup === '15U') {
        const stripped = detail.toLowerCase()
            .replace(/\b(bantam|bantams|ban|btm|bn|squirt|squirts|sq|peewee|peewees|pw)\b/g, '')
            .trim();
        const matches = stripped.match(/\b(aa|a|b1|b2|b|c1|c2|c)\b/gi);
        return matches && matches.length > 0 ? matches[matches.length - 1].toUpperCase() : null;
    }
    return null;
}

function isValidCompetitiveLevel(ageGroup: string, levelDetail: string): boolean {
    if (ageGroup === 'Squirts' || ageGroup === 'Peewees' || ageGroup === 'Bantams' ||
        ageGroup === '10U' || ageGroup === '12U' || ageGroup === '15U') {
        const normalized = levelDetail.toLowerCase().trim();
        return /^(aa|a|b1|b2|b|c1|c2|c)$/.test(normalized);
    }
    return true;
}

function isAggregateOrInHouse(name: string, detail: string): boolean {
    const combined = `${name} ${detail}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const keywords = [
        'team', 'teams', 'program', 'league', 'open', 'intro', 'skills',
        'clinic', 'camp', 'practice', 'edge work', '3v3', '3 v 3',
        'scrimmage', 'tournament', 'jamboree', 'classic', 'cup', 'tornado',
        'coach', 'manager', 'schedule', 'miska', 'wild night', 'evaluation', 'evaluations', 'mini mite',
        'night', 'session', 'summer', 'level', 'jersey', 'travel', 'in house', 'house', 'ih', 'goalie'
    ];
    return keywords.some(k => combined.includes(k));
}

function shouldSkipTeam(ageGroup: string, levelDetail: string, name: string): boolean {
    const combinedLower = `${name} ${levelDetail}`.toLowerCase();
    const isNumberedMite = ageGroup === 'Mites' && /\b[1-4]\b/.test(levelDetail);

    if (isAggregateLevelDetail(levelDetail)) return true;
    const normalizedName = name.toLowerCase().replace(/\s+/g, '');
    const normalizedAge = ageGroup.toLowerCase().replace(/\s+/g, '');
    if (levelDetail.toLowerCase() === 'unknown' && normalizedName === normalizedAge) return true;
    const lowerName = name.toLowerCase();
    if (ageGroup === 'Mites' && /ih/.test(lowerName)) return true;
    if (ageGroup === 'Mites' && levelDetail.toLowerCase() === '8u' &&
        lowerName.includes('mite') && !/(black|white|blue|gold|red|green|purple|navy|orange|gray|grey|silver|maroon|royal|aa|a|b1|b2|b|c|d)/.test(lowerName)) {
        return true;
    }
    if (ageGroup === 'Mites' && lowerName.includes('hockey mite')) return true;
    if (isAggregateOrInHouse(name, levelDetail)) {
        // Allow numbered mite groups even if the page says "teams"
        if (isNumberedMite) {
            const blocked = ['mini mite', 'mini-mite', 'intro', 'house', 'session', 'summer', 'sunday'];
            if (blocked.some(k => combinedLower.includes(k))) return true;
        } else {
            return true;
        }
    }
    const token = getNormalizedLevelToken(ageGroup, levelDetail) ||
        getNormalizedLevelToken(ageGroup, name) ||
        levelDetail;
    if (!isValidCompetitiveLevel(ageGroup, token)) return true;
    return false;
}

function getAgePriority(ageGroup: string): number {
    const order: Record<string, number> = {
        'Bantams': 1,
        'Peewees': 2,
        'Squirts': 3,
        'Mites': 4,
        '15U': 5,
        '12U': 6,
        '10U': 7,
        '8U': 8
    };
    return order[ageGroup] ?? 99;
}

function getLevelPriority(levelDetail: string, ageGroup: string): number {
    const token = getNormalizedLevelToken(ageGroup, levelDetail) || levelDetail;
    const normalized = token.replace(/\s+/g, '').toUpperCase();
    const order: Record<string, number> = {
        'AA': 1,
        'A': 2,
        'B': 3,
        'B1': 4,
        'B2': 5,
        'C': 6,
        'C1': 7,
        'C2': 8,
        'D': 9,
        '1': 10,
        '2': 11,
        '3': 12,
        '4': 13
    };
    return order[normalized] ?? 99;
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

    // Fallback: single explicit year like "2025" in slugs (treat as season start)
    const singleYearMatch = text.match(/\b(20\d{2})\b/);
    if (singleYearMatch) {
        const year = parseInt(singleYearMatch[1]);
        return { start: year, end: year + 1 };
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
    const lowerUrl = url.toLowerCase();

    // Reject obvious non-team keywords
    const rejectKeywords = [
        'click me', 'click here', 'register', 'registration',
        'jamboree', 'bracket', 'volunteer', 'fundraiser',
        'frequently asked', 'faq', 'info page', 'information',
        'contact', 'board', 'coaching corner', 'coaches corner',
        'game day roster', 'layout', 'cost', 'fees',
        'camp', 'clinic', 'article', 'news', 'trophy', 'achievement',
        'photo album', 'pictures', 'picture', 'photo', 'champions', 'congratulations',
        'schedule and results', 'tournament', 'classic', 'showcase',
        'festival', 'cup', 'invite', 'invitational', 'preview', 'goalie'
    ];

    if (rejectKeywords.some(kw => lower.includes(kw))) {
        return true;
    }

    // Reject pages that are likely just navigation
    if (name.includes('>') || lower.includes('click here')) {
        return true;
    }

    const urlRejectKeywords = [
        'tournament', 'team-placement', 'camp-and-team-placement',
        'responsibilities', 'awards', 'photo-day'
    ];
    if (urlRejectKeywords.some(k => lowerUrl.includes(k))) {
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

    // Skip generic schedules (often tournament pages) unless clearly tied to a specific team
    if ((lowerUrl.endsWith('/schedule') || lowerUrl.includes('/schedule/facility')) &&
        !lowerUrl.includes('/team/')) {
        const eventKeywords = ['classic', 'tournament', 'showcase', 'festival', 'cup', 'invite', 'invitational'];
        if (eventKeywords.some(k => lower.includes(k))) {
            return true;
        }
        // Generic association schedules without team context are noisy
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
        url.includes('/schedule') ||
        url.includes('season-microsites.ui.sportsengine.com/seasons/');
}

async function findCalendarUrl(teamUrl: string): Promise<string | null> {
    const idMatch = teamUrl.match(/\/page\/show\/(\d+)/);
    const html = await fetchHtml(teamUrl);
    if (!html) {
        if (idMatch) {
            const id = idMatch[1];
            const baseUrl = new URL(teamUrl).origin;
            return `webcal://${new URL(baseUrl).hostname}/ical_feed?tags=${id}`;
        }
        return null;
    }

    const $ = cheerio.load(html);
    let bestUrl: string | null = null;

    const seasonMicrositePattern = /(?:season-microsites\.ui\.sportsengine\.com)?\/seasons\/[^/]+\/teams\/[^/?#]+/i;

    $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        if (href.startsWith('webcal://') || href.includes('.ics') || href.includes('ical_feed')) {
            bestUrl = normalizeUrl(teamUrl, href);
            return false;
        }

        if (seasonMicrositePattern.test(href)) {
            bestUrl = normalizeUrl(teamUrl, href);
            return false;
        }
    });

    if (!bestUrl) {
        $('script[src*="season-microsites"]').each((_, el) => {
            const src = $(el).attr('src');
            if (!src) return;
            const url = normalizeUrl(teamUrl, src);
            const pathMatch = url.match(/path=([^&]+)/);
            if (pathMatch) {
                const decoded = decodeURIComponent(pathMatch[1]);
                if (seasonMicrositePattern.test(decoded)) {
                    bestUrl = `https://season-microsites.ui.sportsengine.com${decoded}`;
                    return false;
                }
            }
        });
    }

    if (bestUrl && isValidCalendarUrl(bestUrl)) return bestUrl;

    if (idMatch) {
        const id = idMatch[1];
        const baseUrl = new URL(teamUrl).origin;
        return `webcal://${new URL(baseUrl).hostname}/ical_feed?tags=${id}`;
    }

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

        // Skip layout container tabs (usually tournament/info subpages, not team calendars)
        if (lowerUrl.includes('layout_container/show_layout_tab')) return;

        if (lowerUrl.includes('team') ||
            lowerUrl.includes('bantam') ||
            lowerUrl.includes('squirt') ||
            lowerUrl.includes('peewee') ||
            lowerUrl.includes('pee-wee') ||
            lowerUrl.includes('pee wee') ||
            lowerUrl.includes('mite') ||
            lowerUrl.includes('travel') ||
            lowerUrl.includes('youth') ||
            lowerUrl.includes('pw-') ||
            lowerUrl.includes('btm-') ||
            lowerUrl.includes('bn-') ||
            lowerUrl.includes('sq-') ||
            lowerUrl.includes('10u') ||
            lowerUrl.includes('u10') ||
            lowerUrl.includes('12u') ||
            lowerUrl.includes('u12') ||
            lowerUrl.includes('15u') ||
            lowerUrl.includes('u15')) {
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

async function scrapeSprocketSports(association: Association, allowedAgeGroups: Set<AgeGroup>): Promise<ScrapedTeam[]> {
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
            const tokens = ['squirt', 'bantam', 'peewee', 'mite', '10u', '12u', '15u', 'u10', 'u12', 'u15'];
            return links
                .filter(a => {
                    const text = a.textContent?.toLowerCase() || '';
                    return tokens.some(token => text.includes(token));
                })
                .map(a => ({
                    text: a.textContent?.trim() || '',
                    href: (a as HTMLAnchorElement).href
                }));
        });

        const filteredAgeGroups = ageGroups.filter(group =>
            isAllowedAgeGroup(getAgeGroup(group.text), allowedAgeGroups)
        );

        console.log(`Found ${filteredAgeGroups.length} age group categories (filtered from ${ageGroups.length})`);

        for (const group of filteredAgeGroups) {
            // Skip if this looks like a submenu (contains 'team' or 'teams')
            const isSubmenu = group.text.toLowerCase().includes('team');
            const groupAge = getAgeGroup(group.text);
            if (!isAllowedAgeGroup(groupAge, allowedAgeGroups)) continue;

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
                        if (!isAllowedAgeGroup(ageGroup, allowedAgeGroups)) continue;
                        const levelDetail = getLevelDetail(team.name, ageGroup);
                        const normalizedDetail = normalizeLevelDetailForAgeGroup(ageGroup, levelDetail);
                        if (shouldSkipTeam(ageGroup, normalizedDetail, team.name)) continue;
                        const token = getNormalizedLevelToken(ageGroup, levelDetail) ||
                            normalizedDetail ||
                            levelDetail.trim();
                        const calendarUrl = buildSprocketCalendarUrl(association, team.href, team.teamId);
                        if (!calendarUrl) continue;

                        teams.push({
                            association_name: association.name,
                            name: team.name,
                            sport_type: 'hockey',
                            team_level: ageGroup,
                            level_detail: token,
                            calendar_sync_url: calendarUrl
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
                    if (!isAllowedAgeGroup(ageGroup, allowedAgeGroups)) continue;
                    const levelDetail = getLevelDetail(group.text, ageGroup);
                    const normalizedDetail = normalizeLevelDetailForAgeGroup(ageGroup, levelDetail);
                    if (shouldSkipTeam(ageGroup, normalizedDetail, group.text)) continue;
                    const token = getNormalizedLevelToken(ageGroup, levelDetail) ||
                        normalizedDetail ||
                        levelDetail.trim();
                    const calendarUrl = buildSprocketCalendarUrl(association, group.href, teamId);
                    if (!calendarUrl) continue;

                    teams.push({
                        association_name: association.name,
                        name: group.text,
                        sport_type: 'hockey',
                        team_level: ageGroup,
                        level_detail: token,
                        calendar_sync_url: calendarUrl
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
    ],
    'Edina Hockey Association': [
        'https://www.edinahockeyassociation.com/page/show/9116601-teams',
        'https://www.edinahockeyassociation.com/page/show/9116606-bantams',
        'https://www.edinahockeyassociation.com/page/show/9116605-peewees',
        'https://www.edinahockeyassociation.com/page/show/9116609-squirts'
    ],
    'Elk River Youth Hockey Association': [
        // Missing from sitemap; provided by user
        'https://www.elkriverhockey.org/team/188851/calendar',
        'https://www.elkriverhockey.org/team/195248/calendar'
    ],
    'Hopkins Youth Hockey Association': [
        // Missing Mite color variant provided by user
        'https://www.hopkinshockey.com/team/154799/calendar',
        'https://www.hopkinshockey.com/team/154798/calendar',
        'https://www.hopkinshockey.com/team/201758/calendar',
        'https://www.hopkinshockey.com/team/201759/calendar',
        'https://www.hopkinshockey.com/team/201760/calendar',
        'https://www.hopkinshockey.com/team/201761/calendar',
        'https://www.hopkinshockey.com/team/154796/calendar',
        'https://www.hopkinshockey.com/team/198986/calendar',
        'https://www.hopkinshockey.com/team/198987/calendar',
        'https://www.hopkinshockey.com/team/154797/calendar'
    ],
    'Rogers Youth Hockey Association': [
        // Missing Squirt B2 Blue provided by user
        'https://www.rogershockey.com/team/162579/calendar',
        // Missing Squirt B1 Blue provided by user
        'https://www.rogershockey.com/team/162577/calendar'
    ],
    'Lakeville Hockey Association': [
        // Missing Peewee North AA provided by user
        'https://www.lakevillehockey.org/page/show/9122007-pee-wee-north-aa'
    ]
};

const associationSeedTeams: Record<string, ScrapedTeam[]> = {
    'Hopkins Youth Hockey Association': [
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 2 Blue', sport_type: 'hockey', team_level: 'Mites', level_detail: '2', calendar_sync_url: 'https://www.hopkinshockey.com/team/201758/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 2 Gray', sport_type: 'hockey', team_level: 'Mites', level_detail: '2', calendar_sync_url: 'https://www.hopkinshockey.com/team/201759/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 2 Green', sport_type: 'hockey', team_level: 'Mites', level_detail: '2', calendar_sync_url: 'https://www.hopkinshockey.com/team/201760/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 2 White', sport_type: 'hockey', team_level: 'Mites', level_detail: '2', calendar_sync_url: 'https://www.hopkinshockey.com/team/201761/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 3 Blue', sport_type: 'hockey', team_level: 'Mites', level_detail: '3', calendar_sync_url: 'https://www.hopkinshockey.com/team/154796/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 3 Gray', sport_type: 'hockey', team_level: 'Mites', level_detail: '3', calendar_sync_url: 'https://www.hopkinshockey.com/team/198986/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 3 Green', sport_type: 'hockey', team_level: 'Mites', level_detail: '3', calendar_sync_url: 'https://www.hopkinshockey.com/team/198987/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 3 White', sport_type: 'hockey', team_level: 'Mites', level_detail: '3', calendar_sync_url: 'https://www.hopkinshockey.com/team/154797/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 4 Blue', sport_type: 'hockey', team_level: 'Mites', level_detail: '4', calendar_sync_url: 'https://www.hopkinshockey.com/team/154798/calendar' },
        { association_name: 'Hopkins Youth Hockey Association', name: 'Mite 4 White', sport_type: 'hockey', team_level: 'Mites', level_detail: '4', calendar_sync_url: 'https://www.hopkinshockey.com/team/154799/calendar' }
    ],
    'Rogers Youth Hockey Association': [
        { association_name: 'Rogers Youth Hockey Association', name: 'Squirt B2 Blue', sport_type: 'hockey', team_level: 'Squirts', level_detail: 'B2', calendar_sync_url: 'https://www.rogershockey.com/team/162579/calendar' },
        { association_name: 'Rogers Youth Hockey Association', name: 'Squirt B1 Blue', sport_type: 'hockey', team_level: 'Squirts', level_detail: 'B1', calendar_sync_url: 'https://www.rogershockey.com/team/162577/calendar' }
    ],
    // Eastview co-ops with AVB Hockey for some Bantam teams - these are linked on Eastview's site but hosted on avbhockey.com
    'Eastview Hockey Association': [
        { association_name: 'Eastview Hockey Association', name: 'Bantam A', sport_type: 'hockey', team_level: 'Bantams', level_detail: 'A', calendar_sync_url: 'webcal://www.avbhockey.com/ical_feed?tags=9095170' },
        { association_name: 'Eastview Hockey Association', name: 'Bantam B1 - White', sport_type: 'hockey', team_level: 'Bantams', level_detail: 'B1', calendar_sync_url: 'webcal://www.avbhockey.com/ical_feed?tags=9095171' },
        { association_name: 'Eastview Hockey Association', name: 'Bantam B2 - White', sport_type: 'hockey', team_level: 'Bantams', level_detail: 'B2', calendar_sync_url: 'webcal://www.avbhockey.com/ical_feed?tags=9095172' }
    ]
};

export async function scrapeAssociation(association: Association, ageGroups: AgeGroup[] = AGE_GROUPS): Promise<ScrapedTeam[]> {
    console.log(`Scraping ${association.name}...`);

    const allowedAgeGroups = new Set<AgeGroup>(ageGroups);
    const html = await fetchHtml(association.baseUrl);
    if (html && (html.includes('sprocketsports.com') || html.includes('app-root'))) {
        console.log('Detected Sprocket Sports platform...');
        return scrapeSprocketSports(association, allowedAgeGroups);
    }
    const teams: ScrapedTeam[] = [];
    const visitedUrls = new Set<string>();
    const pagesToVisit: string[] = [association.baseUrl];
    const baseHost = new URL(association.baseUrl).hostname;

    if (isRogersHost(association.baseUrl)) {
        const rogersCalendars = await discoverRogersTeamCalendars(association.baseUrl);
        for (const url of rogersCalendars) {
            if (!pagesToVisit.includes(url)) {
                pagesToVisit.push(url);
            }
        }
    }

    const sitemapUrls = await fetchSitemap(association.baseUrl);
    const currentSeason = getCurrentSeasonYear();

    if (sitemapUrls.length > 0) {
        // Filter sitemap URLs to remove explicit old seasons and subseason views
        const relevantSitemapUrls = sitemapUrls.filter(url => {
            // Skip SportsEngine subseason URLs (historical views)
            if (url.includes('subseason=')) return false;

            const range = extractSeasonYearRange(url);
            if (range) {
                // If it has a year, it MUST be the current or next season
                return isCurrentSeason(url, currentSeason);
            }
            return true; // Keep generic URLs
        });
        console.log(`Filtered sitemap: ${relevantSitemapUrls.length} / ${sitemapUrls.length} URLs kept (removed old seasons)`);
        for (const url of relevantSitemapUrls) {
            const sameHostUrl = getSameHostUrl(association.baseUrl, url, baseHost);
            if (sameHostUrl && !pagesToVisit.includes(sameHostUrl)) {
                pagesToVisit.push(sameHostUrl);
            }
        }
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
            const url = getSameHostUrl(association.baseUrl, href || '', baseHost);
            if (!url) return;
            if (url.includes('layout_container/show_layout_tab')) return;

            if (linksFound < 100) {
                linksFound++;
            }

            // Check for old season in URL or text
            const urlRange = extractSeasonYearRange(url);
            const textRange = extractSeasonYearRange(text);

            if (urlRange && !isCurrentSeason(url, currentSeason)) return;
            if (textRange && !isCurrentSeason(text, currentSeason)) return;

            // Skip SportsEngine subseason URLs (historical views)
            if (url.includes('subseason=')) return;

            const lowerHref = (href || '').toLowerCase();

            const keywords = ['teams', 'travel', 'youth', 'programs', 'boys', 'girls', 'hockey'];
            const hasKeyword = keywords.some(k => text.includes(k) || lowerHref.includes(k));
            const ageGroup = getAgeGroup(text);
            const matchesAgeGroup = isAllowedAgeGroup(ageGroup, allowedAgeGroups);

            if (hasKeyword || matchesAgeGroup) {
                if (!pagesToVisit.includes(url)) {
                    pagesToVisit.push(url);
                }
            }
        });
    }

    const MAX_PAGES = 500;
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

        if (!pageTitle || !getAgeGroup(pageTitle)) {
            const h2Text = $page('h2').first().text().trim();
            const hasLevelIndicators = /\b(A{1,2}|B[12]?|C|[Gg]old|[Pp]urple|[Bb]lack|[Ww]hite|[Bb]lue|[Rr]ed|[Gg]reen|[Mm]achine)\b/.test(h2Text);
            const h2AgeGroup = getAgeGroup(h2Text);
            if (hasLevelIndicators || !pageTitle || (h2AgeGroup && !getAgeGroup(pageTitle))) {
                pageTitle = h2Text;
            }
        }

        if (!pageTitle) {
            const titleText = $page('title').first().text().trim();
            if (titleText) pageTitle = titleText.split('|')[1]?.trim() || titleText;
        }

        const pageAgeGroup = getAgeGroup(pageTitle);

        if (isAllowedAgeGroup(pageAgeGroup, allowedAgeGroups)) {
            // Skip if this looks like a non-team page
            if (isLikelyNonTeamPage(pageTitle, url)) {
                console.log(`  Skipping non-team page: ${pageTitle}`);
                continue;
            }

            let shouldAddTeam = true;
            const levelDetail = getLevelDetail(pageTitle, pageAgeGroup);
            const normalizedDetail = normalizeLevelDetailForAgeGroup(pageAgeGroup, levelDetail);
            if (shouldSkipTeam(pageAgeGroup, normalizedDetail, pageTitle)) {
                console.log(`  Skipping aggregate page: ${pageTitle}`);
                shouldAddTeam = false;
            }
            if (!url.includes('/team/') && !url.includes('/page/show/') && url.toLowerCase().includes('/schedule')) {
                console.log(`  Skipping generic schedule page: ${url}`);
                shouldAddTeam = false;
            }
            if (shouldAddTeam) {
                const token = getNormalizedLevelToken(pageAgeGroup, levelDetail) ||
                    normalizedDetail ||
                    levelDetail.trim();

                const calendarUrl = await findCalendarUrl(url);
                if (calendarUrl) {
                    if (!teams.some(t => t.calendar_sync_url === calendarUrl)) {
                        teams.push({
                            association_name: association.name,
                            name: pageTitle,
                            sport_type: 'hockey',
                            team_level: pageAgeGroup,
                            level_detail: token,
                            calendar_sync_url: calendarUrl
                        });
                    }
                }
            }
        }

        $page('a').each((_, el) => {
            const text = $page(el).text().trim();
            const href = $page(el).attr('href');
            const absUrl = getSameHostUrl(url, href || '', baseHost);
            if (!absUrl) return;
            if (absUrl.includes('layout_container/show_layout_tab')) return;

            // Check for old season in URL or text
            const urlRange = extractSeasonYearRange(absUrl);
            const textRange = extractSeasonYearRange(text);

            if (urlRange && !isCurrentSeason(absUrl, currentSeason)) return;
            if (textRange && !isCurrentSeason(text, currentSeason)) return;

            // Skip SportsEngine subseason URLs (historical views)
            if (absUrl.includes('subseason=')) return;

            const ageGroup = getAgeGroup(text);
            if (isAllowedAgeGroup(ageGroup, allowedAgeGroups)) {
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
                    const levelDetail = getLevelDetail(text, ageGroup);
                    const normalizedDetail = normalizeLevelDetailForAgeGroup(ageGroup, levelDetail);
                    if (shouldSkipTeam(ageGroup, normalizedDetail, text)) return;
                    const token = getNormalizedLevelToken(ageGroup, levelDetail) ||
                        normalizedDetail ||
                        levelDetail.trim();

                    if (!teams.some(t => t.calendar_sync_url === absUrl)) {
                        teams.push({
                            association_name: association.name,
                            name: text,
                            sport_type: 'hockey',
                            team_level: ageGroup,
                            level_detail: token,
                            calendar_sync_url: absUrl
                        });
                    }
                }
            }
        });
    }

    if (associationSeedTeams[association.name]) {
        teams.push(...associationSeedTeams[association.name]);
    }

    console.log(`Found ${teams.length} potential teams. Filtering for current season...`);

    const teamMap = new Map<string, ScrapedTeam>();

    for (const team of teams) {
        const normalizedToken = getNormalizedLevelToken(team.team_level, team.level_detail) || team.level_detail;
        const key = `${team.team_level}-${normalizedToken}-${team.name}`.toLowerCase();

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

    const filteredTeams = Array.from(teamMap.values()).filter(team => allowedAgeGroups.has(team.team_level));
    console.log(`After season and age filtering: ${filteredTeams.length} teams (removed ${teams.length - filteredTeams.length} old/filtered duplicates)`);

    const resolvedTeams: ScrapedTeam[] = [];

    for (const team of filteredTeams) {
        console.log(`Resolving calendar for ${team.name}...`);
        const seasonHint = extractSeasonYear(team.calendar_sync_url) || extractSeasonYear(team.name);
        (team as any).__seasonHint = seasonHint || null;
        const resolved = await findCalendarUrl(team.calendar_sync_url);
        if (resolved) {
            team.calendar_sync_url = resolved;
        } else if (!isValidCalendarUrl(team.calendar_sync_url)) {
            console.log(`  Skipping ${team.name} — no calendar found`);
            continue;
        }
        resolvedTeams.push(team);
    }

    // Filter out teams with empty iCal feeds (old/inactive seasons)
    console.log('Checking for empty iCal feeds...');
    const activeTeams: ScrapedTeam[] = [];
    for (const team of resolvedTeams) {
        if (team.calendar_sync_url.includes('ical_feed') ||
            team.calendar_sync_url.startsWith('webcal://')) {
            const eventCount = await getIcalEventCount(team.calendar_sync_url);
            if (eventCount === 0) {
                console.log(`  Filtering empty calendar: ${team.name}`);
                continue;
            }
        }
        activeTeams.push(team);
    }
    console.log(`After empty feed filtering: ${activeTeams.length} teams (removed ${resolvedTeams.length - activeTeams.length} empty calendars)`);

    const dedupedTeams = Array.from(activeTeams.reduce((map, team) => {
        const token = getNormalizedLevelToken(team.team_level, team.level_detail) || team.level_detail;
        const key = `${team.team_level}-${token}-${team.calendar_sync_url}`.toLowerCase();
        const existing = map.get(key);
        if (!existing || team.name.length < existing.name.length) {
            map.set(key, team);
        }
        return map;
    }, new Map<string, ScrapedTeam>()).values());

    const seasonFilteredTeams = (() => {
        const groups = new Map<string, { team: ScrapedTeam; season: number; pageId: number }[]>();
        for (const team of dedupedTeams) {
            const token = getNormalizedLevelToken(team.team_level, team.level_detail) || team.level_detail;
            const key = `${team.team_level}-${token}`.toLowerCase();
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push({
                team,
                season: (team as any).__seasonHint ||
                    extractSeasonYear(team.calendar_sync_url) ||
                    extractSeasonYear(team.name) || 0,
                pageId: extractPageId(team.calendar_sync_url) || 0
            });
        }

        const filtered: ScrapedTeam[] = [];
        for (const entries of groups.values()) {
            const maxSeason = Math.max(...entries.map(e => e.season));
            if (maxSeason > 0) {
                entries.filter(e => e.season === maxSeason).forEach(e => filtered.push(e.team));
            } else {
                // No season info; keep all so color variants remain
                entries.forEach(e => filtered.push(e.team));
            }
        }
        return filtered;
    })();

    // Prefer webcal for the same calendar target, but keep distinct calendars (e.g., color splits)
    const canonicalTeams = Array.from(seasonFilteredTeams.reduce((map, team) => {
        const token = getNormalizedLevelToken(team.team_level, team.level_detail) || team.level_detail;
        const tokenKey = `${team.team_level}-${token}`.toLowerCase();
        if (!map.has(tokenKey)) map.set(tokenKey, new Map<string, ScrapedTeam>());

        const byUrl = map.get(tokenKey)!;
        const urlKey = team.calendar_sync_url.toLowerCase();
        const existing = byUrl.get(urlKey);

        if (!existing) {
            // If an existing non-webcal entry shares the base page id, replace with webcal
            const pageId = extractPageId(team.calendar_sync_url) || 0;
            const samePage = Array.from(byUrl.values()).find(t => (extractPageId(t.calendar_sync_url) || 0) === pageId);
            if (samePage && team.calendar_sync_url.startsWith('webcal://') && !samePage.calendar_sync_url.startsWith('webcal://')) {
                byUrl.delete(samePage.calendar_sync_url.toLowerCase());
                byUrl.set(urlKey, team);
            } else if (!samePage) {
                byUrl.set(urlKey, team);
            }
        } else {
            const existingPageId = extractPageId(existing.calendar_sync_url) || 0;
            const currentPageId = extractPageId(team.calendar_sync_url) || 0;
            if (team.calendar_sync_url.startsWith('webcal://') && !existing.calendar_sync_url.startsWith('webcal://')) {
                byUrl.set(urlKey, team);
            } else if (currentPageId > existingPageId) {
                byUrl.set(urlKey, team);
            } else if (currentPageId === existingPageId && team.name.length < existing.name.length) {
                byUrl.set(urlKey, team);
            }
        }
        return map;
    }, new Map<string, Map<string, ScrapedTeam>>())).flatMap(m => Array.from(m[1].values()));

    if (associationSeedTeams[association.name]) {
        for (const seed of associationSeedTeams[association.name]) {
            const exists = canonicalTeams.some(t => t.calendar_sync_url === seed.calendar_sync_url);
            if (!exists) canonicalTeams.push(seed);
        }
    }

    const sortedTeams = canonicalTeams.sort((a, b) => {
        const ageA = getAgePriority(a.team_level);
        const ageB = getAgePriority(b.team_level);
        if (ageA !== ageB) return ageA - ageB;
        const levelA = getLevelPriority(a.level_detail, a.team_level);
        const levelB = getLevelPriority(b.level_detail, b.team_level);
        if (levelA !== levelB) return levelA - levelB;
        return a.name.localeCompare(b.name);
    });

    return sortedTeams;
}
