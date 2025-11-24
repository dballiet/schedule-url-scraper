import axios from 'axios';
import * as cheerio from 'cheerio';

async function fetchHtml(url: string) {
    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        return res.data;
    } catch (e) {
        console.error(`Failed to fetch ${url}: ${e.message}`);
        return null;
    }
}

async function investigate() {
    console.log('🕵️ Investigating Failures\n');

    // 1. Minneapolis Titans
    console.log('--- Minneapolis Titans ---');
    const titansUrl = 'https://www.minneapolistitanshockey.com';
    const sitemapUrl = `${titansUrl}/sitemap.xml`;
    console.log(`Fetching sitemap: ${sitemapUrl}`);
    const xml = await fetchHtml(sitemapUrl);
    if (xml) {
        const $ = cheerio.load(xml, { xmlMode: true });
        const urls: string[] = [];
        $('loc').each((_, el) => {
            const u = $(el).text();
            if (u.includes('pee-wee') || u.includes('peewee') || u.includes('bantam')) {
                urls.push(u);
            }
        });
        console.log(`Found ${urls.length} relevant URLs in sitemap:`);
        urls.slice(0, 5).forEach(u => console.log(`- ${u}`));

        if (urls.length > 0) {
            console.log(`\nChecking first URL: ${urls[0]}`);
            const html = await fetchHtml(urls[0]);
            if (html) {
                const $page = cheerio.load(html);
                const title = $page('h1').first().text().trim();
                console.log(`Page Title: "${title}"`);
                // Check for calendar links
                const calLinks = $page('a[href*="ical"]').length;
                console.log(`Found ${calLinks} ical links`);
            }
        }
    }

    // 2. Mound Westonka
    console.log('\n--- Mound Westonka ---');
    const mwUrl = 'https://www.westonkahockey.org/season_management_season_page/tab_schedule?page_node_id=9253480';
    console.log(`Fetching schedule page: ${mwUrl}`);
    const mwHtml = await fetchHtml(mwUrl);
    if (mwHtml) {
        const $ = cheerio.load(mwHtml);
        console.log('Searching for team links...');
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (text.includes('Bantam') || text.includes('Peewee')) {
                console.log(`Found link: ${text} -> ${href}`);
            }
        });
    }
}

investigate();
