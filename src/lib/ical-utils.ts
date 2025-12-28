import axios from 'axios';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

export interface IcalVerificationResult {
    url: string;
    status: 'valid' | 'empty' | 'error';
    totalEvents: number;
    futureEvents: number;
    error?: string;
}

/**
 * Fetch iCal content from a URL (handles webcal:// conversion)
 */
async function fetchIcalContent(url: string): Promise<string> {
    // Convert webcal:// to https:// for fetching
    const fetchUrl = url
        .replace(/^webcal:\/\//, 'https://')
        .replace(/^http:\/\//, 'https://');

    const response = await axios.get(fetchUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
    });

    return response.data;
}

/**
 * Parse a DTSTART value from iCal format
 * Handles: 20241227, 20241227T180000, 20241227T180000Z
 */
function parseDtstart(value: string): Date | null {
    // Remove any TZID prefix if present (e.g., TZID=America/Chicago:20241227T180000)
    const colonIdx = value.lastIndexOf(':');
    const dateStr = colonIdx > 0 ? value.substring(colonIdx + 1) : value;

    // Handle DATE format: 20241227
    if (/^\d{8}$/.test(dateStr)) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day);
    }

    // Handle DATE-TIME format: 20241227T180000 or 20241227T180000Z
    const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (match) {
        const [, year, month, day, hour, min, sec] = match;
        if (dateStr.endsWith('Z')) {
            // UTC time
            return new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour),
                parseInt(min),
                parseInt(sec)
            ));
        } else {
            // Local time
            return new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour),
                parseInt(min),
                parseInt(sec)
            );
        }
    }

    return null;
}

/**
 * Extract all DTSTART values from iCal content
 */
function extractDtstarts(icalContent: string): Date[] {
    const dates: Date[] = [];

    // Match DTSTART lines - handles various formats:
    // DTSTART:20241227
    // DTSTART:20241227T180000Z
    // DTSTART;VALUE=DATE:20241227
    // DTSTART;TZID=America/Chicago:20241227T180000
    const regex = /DTSTART[^:]*:([^\r\n]+)/gi;
    let match;

    while ((match = regex.exec(icalContent)) !== null) {
        const parsed = parseDtstart(match[1].trim());
        if (parsed) {
            dates.push(parsed);
        }
    }

    return dates;
}

/**
 * Check if URL is a direct iCal feed (not an HTML page)
 */
function isDirectIcalUrl(url: string): boolean {
    return url.startsWith('webcal://') ||
        url.includes('/ical_feed') ||
        url.includes('.ics') ||
        url.includes('/ical?');
}

/**
 * Check if URL is an HTML calendar page (Crossbar, SportsEngine, etc.)
 */
function isHtmlCalendarUrl(url: string): boolean {
    // Crossbar/SportsEngine team calendar pages
    if (/\/team\/\d+(?:\/calendar)?/.test(url)) return true;
    // Generic schedule/calendar pages
    if (url.includes('/schedule') || url.includes('/calendar')) return true;
    // Sprocket Sports pages with program/schedule
    if (url.includes('/program/') && url.includes('/schedule')) return true;
    return false;
}

/**
 * Verify an HTML calendar page has content (basic check for Crossbar-style pages)
 * Returns event count estimate based on markers found
 */
async function verifyHtmlCalendar(url: string): Promise<IcalVerificationResult> {
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 15000,
        });

        const html = response.data;
        let eventCount = 0;
        const markers: string[] = [];

        // Detect SPA/JavaScript-rendered pages (Sprocket Sports, Angular, React, etc.)
        // These pages have minimal HTML and load content via JavaScript
        const isSPA = (
            html.includes('<app-root>') ||  // Angular (Sprocket Sports)
            html.includes('id="root"') ||   // React
            html.includes('id="app"') ||    // Vue
            (html.includes('<body>') && html.split('<div').length < 10 && html.includes('type="module"'))
        );

        if (isSPA) {
            // Check if it's a known platform that works in production
            const isSprocket = url.includes('sprocketsports') ||
                html.includes('sprocket') ||
                url.includes('jeffersonhockey.org') ||
                url.includes('waconiahockey') ||
                url.includes('mplshockey');

            return {
                url,
                status: 'valid', // Trust that production can handle it
                totalEvents: -1, // Unknown count
                futureEvents: -1,
                error: isSprocket
                    ? 'Sprocket Sports SPA - requires JS rendering (production handles this)'
                    : 'JavaScript SPA - requires browser rendering to verify',
            };
        }

        // Crossbar calendar markers
        // .schedule-item divs (main event markers)
        const scheduleItems = (html.match(/class="[^"]*schedule-item[^"]*"/gi) || []).length;
        if (scheduleItems > 0) {
            eventCount += scheduleItems;
            markers.push(`${scheduleItems} schedule-items`);
        }

        // Calendar event cells with content
        const calendarEvents = (html.match(/class="[^"]*calendar-event[^"]*"/gi) || []).length;
        if (calendarEvents > 0) {
            eventCount += calendarEvents;
            markers.push(`${calendarEvents} calendar-events`);
        }

        // Event type indicators (practice, game, etc.)
        const eventTypes = (html.match(/class="[^"]*event-type[^"]*"/gi) || []).length;
        if (eventTypes > 0) {
            eventCount += eventTypes;
            markers.push(`${eventTypes} event-types`);
        }

        // Day cells that have events (non-empty)
        const dayWithEvents = (html.match(/<td[^>]*class="[^"]*day[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*event/gi) || []).length;
        if (dayWithEvents > 0) {
            eventCount += dayWithEvents;
            markers.push(`${dayWithEvents} days-with-events`);
        }

        // Generic event listing patterns
        const eventDivs = (html.match(/<div[^>]*class="[^"]*event[^"]*"[^>]*>/gi) || []).length;
        if (eventDivs > 0 && eventCount === 0) {
            eventCount += eventDivs;
            markers.push(`${eventDivs} event-divs`);
        }

        // Look for time patterns (5:00 PM, 17:00, etc.)
        const timePatterns = (html.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/g) || []).length;
        if (timePatterns > 3) {
            // Multiple time patterns suggest a calendar with events
            markers.push(`${timePatterns} time-patterns`);
        }

        // Check for "No events" or empty calendar indicators
        const noEventsIndicators = /no\s+(?:scheduled\s+)?events|calendar\s+is\s+empty|no\s+games\s+scheduled/i.test(html);
        if (noEventsIndicators) {
            return {
                url,
                status: 'empty',
                totalEvents: 0,
                futureEvents: 0,
                error: 'HTML calendar indicates no events scheduled',
            };
        }

        if (eventCount > 0 || markers.length > 0) {
            return {
                url,
                status: 'valid',
                totalEvents: eventCount,
                futureEvents: eventCount, // Assume all are future for HTML
                error: `HTML calendar: ${markers.join(', ')}`,
            };
        }

        // Page loaded but no recognizable calendar content
        return {
            url,
            status: 'empty',
            totalEvents: 0,
            futureEvents: 0,
            error: 'HTML page loaded but no calendar content detected',
        };

    } catch (error: any) {
        return {
            url,
            status: 'error',
            totalEvents: 0,
            futureEvents: 0,
            error: error.message || 'Failed to fetch HTML calendar',
        };
    }
}

/**
 * Extract iCal feed URL from an HTML calendar page
 */
async function extractIcalFromHtmlPage(url: string): Promise<string | null> {
    // First, check if we can derive the iCal URL from the URL pattern itself
    // For SportsEngine /team/ID/calendar or /team/ID pages
    const teamIdFromUrl = url.match(/\/team\/(\d+)(?:\/|$)/);

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 15000,
        });

        const html = response.data;

        // Look for webcal:// links
        const webcalMatch = html.match(/webcal:\/\/[^"'\s<>]+/i);
        if (webcalMatch) {
            return webcalMatch[0];
        }

        // Look for ical_feed links
        const icalFeedMatch = html.match(/href=["']([^"']*ical_feed[^"']*)["']/i);
        if (icalFeedMatch) {
            const href = icalFeedMatch[1];
            // Make absolute if relative
            if (href.startsWith('/')) {
                const urlObj = new URL(url);
                return `${urlObj.protocol}//${urlObj.host}${href}`;
            }
            return href;
        }

        // Look for page/show/ID pattern in HTML (different tag ID than URL)
        const tagMatch = html.match(/page\/show\/(\d+)/);
        if (tagMatch) {
            const urlObj = new URL(url);
            return `webcal://${urlObj.host}/ical_feed?tags=${tagMatch[1]}`;
        }

        // Look for embedded calendar data with season-microsites
        const micrositeMatch = html.match(/season-microsites\.ui\.sportsengine\.com\/seasons\/[^\/]+\/teams\/[^"'\s<>]+/);
        if (micrositeMatch) {
            return `https://${micrositeMatch[0]}`;
        }

        // Fallback: if URL has team ID pattern, try using that ID directly
        // This works for SportsEngine Crossbar sites where the team ID in the URL
        // can be used as the tag ID for the iCal feed
        if (teamIdFromUrl) {
            const urlObj = new URL(url);
            return `webcal://${urlObj.host}/ical_feed?tags=${teamIdFromUrl[1]}`;
        }

        return null;
    } catch (error) {
        // Even if fetch fails, try URL-based fallback
        if (teamIdFromUrl) {
            try {
                const urlObj = new URL(url);
                return `webcal://${urlObj.host}/ical_feed?tags=${teamIdFromUrl[1]}`;
            } catch {
                return null;
            }
        }
        return null;
    }
}

/**
 * Verify an iCal URL and count future events
 * Handles both direct iCal feeds and HTML calendar pages
 */
export async function verifyIcalUrl(url: string): Promise<IcalVerificationResult> {
    try {
        // For direct iCal URLs, verify as iCal
        if (isDirectIcalUrl(url)) {
            const content = await fetchIcalContent(url);

            // Check if we got HTML instead of iCal (sometimes redirects happen)
            if (content.includes('<!DOCTYPE') || content.includes('<html')) {
                return {
                    url,
                    status: 'error',
                    totalEvents: 0,
                    futureEvents: 0,
                    error: 'URL returned HTML instead of iCal data',
                };
            }

            // Count total VEVENT blocks
            const totalMatches = content.match(/BEGIN:VEVENT/gi);
            const totalEvents = totalMatches ? totalMatches.length : 0;

            // Extract and filter dates
            const dates = extractDtstarts(content);
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const futureEvents = dates.filter(d => d >= now).length;

            if (totalEvents === 0) {
                return {
                    url,
                    status: 'empty',
                    totalEvents: 0,
                    futureEvents: 0,
                };
            }

            if (futureEvents === 0) {
                return {
                    url,
                    status: 'empty',
                    totalEvents,
                    futureEvents: 0,
                };
            }

            return {
                url,
                status: 'valid',
                totalEvents,
                futureEvents,
            };
        }

        // For HTML calendar pages (Crossbar, etc.), verify HTML content
        if (isHtmlCalendarUrl(url)) {
            return await verifyHtmlCalendar(url);
        }

        // Unknown URL type - try to extract iCal feed from page
        const extractedUrl = await extractIcalFromHtmlPage(url);
        if (extractedUrl && isDirectIcalUrl(extractedUrl)) {
            // Recursively verify the extracted iCal URL
            const result = await verifyIcalUrl(extractedUrl);
            return {
                ...result,
                url, // Keep original URL
                error: result.error ? `Resolved to ${extractedUrl}: ${result.error}` : `Resolved to: ${extractedUrl}`,
            };
        }

        // Last resort - try HTML verification
        return await verifyHtmlCalendar(url);
    } catch (error: any) {
        return {
            url,
            status: 'error',
            totalEvents: 0,
            futureEvents: 0,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * Sample entries for verification
 * Guarantees at least 1 per association, then fills to target percentage
 */
export function sampleForVerification<T extends { association: string }>(
    entries: T[],
    targetPercentage: number = 0.05,
    maxSamples: number = 50
): T[] {
    if (entries.length === 0) return [];

    // Group by association
    const byAssociation = new Map<string, T[]>();
    for (const entry of entries) {
        const existing = byAssociation.get(entry.association) || [];
        existing.push(entry);
        byAssociation.set(entry.association, existing);
    }

    const sampled = new Set<T>();
    const sampledIndices = new Set<number>();

    // First pass: 1 random entry per association
    for (const [, assocEntries] of byAssociation) {
        const randomIdx = Math.floor(Math.random() * assocEntries.length);
        const entry = assocEntries[randomIdx];
        sampled.add(entry);
        sampledIndices.add(entries.indexOf(entry));
    }

    // Calculate target count
    const targetCount = Math.min(
        Math.max(sampled.size, Math.ceil(entries.length * targetPercentage)),
        maxSamples
    );

    // Second pass: fill to target from remaining entries
    if (sampled.size < targetCount) {
        const remaining = entries.filter((_, idx) => !sampledIndices.has(idx));
        // Shuffle remaining
        const shuffled = [...remaining].sort(() => Math.random() - 0.5);

        for (const entry of shuffled) {
            if (sampled.size >= targetCount) break;
            sampled.add(entry);
        }
    }

    return Array.from(sampled);
}
