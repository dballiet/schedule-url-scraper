import { ASSOCIATIONS } from '../src/lib/associations';
import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

function getAgeGroup(name: string): 'Mites' | 'Squirts' | 'Peewees' | 'Bantams' | null {
    const lower = name.toLowerCase();
    if (lower.includes('mite')) return 'Mites';
    if (lower.includes('squirt')) return 'Squirts';
    if (lower.includes('peewee')) return 'Peewees';
    if (lower.includes('bantam')) return 'Bantams';
    return null;
}

async function debug() {
    const targetUrls = [
        'https://www.tonkahockey.org/page/show/9209292', // Squirt B2 Blue
        'https://www.tonkahockey.org/page/show/9136984'  // Bantam AA
    ];

    console.log('🔎 Debugging Minnetonka Pages\n');

    for (const url of targetUrls) {
        console.log(`\n=== ${url} ===`);

        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);

            // Check for h1
            const h1 = $('h1').first().text().trim();
            const h2 = $('h2').first().text().trim();
            const title = $('title').first().text().trim();

            console.log(`Title: "${title}"`);
            console.log(`H1: "${h1}"`);
            console.log(`H2: "${h2}"`);

            const h1AgeGroup = getAgeGroup(h1);
            const h2AgeGroup = getAgeGroup(h2);
            const titleAgeGroup = getAgeGroup(title);

            console.log(`Age group from H1: ${h1AgeGroup || 'NONE'}`);
            console.log(`Age group from H2: ${h2AgeGroup || 'NONE'}`);
            console.log(`Age group from Title: ${titleAgeGroup || 'NONE'}`);

            // Check for webcal/ical links
            const links: string[] = [];
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                if (href && (href.includes('ical') || href.includes('webcal') || href.includes('.ics'))) {
                    links.push(href);
                }
            });

            console.log(`iCal/webcal links found: ${links.length}`);
            if (links.length > 0) {
                links.forEach(link => console.log(`  - ${link}`));
            }

            // Check for calendar/schedule links
            const scheduleLinks: string[] = [];
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().toLowerCase();
                if (href && (text.includes('calendar') || text.includes('schedule'))) {
                    scheduleLinks.push(`${text.trim()} -> ${href}`);
                }
            });

            console.log(`Schedule/calendar links: ${scheduleLinks.length}`);
            if (scheduleLinks.length > 0) {
                scheduleLinks.slice(0, 5).forEach(link => console.log(`  - ${link}`));
            }

        } catch (error: any) {
            console.log(`ERROR: ${error.message}`);
        }
    }
}

debug().catch(console.error);
