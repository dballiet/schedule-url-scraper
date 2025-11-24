import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

async function investigate() {
    console.log('🔍 Investigating Minnetonka\n');

    const minnetonka = ASSOCIATIONS.find(a => a.name.includes('Minnetonka'));
    if (!minnetonka) {
        console.log('❌ Minnetonka not found in associations');
        return;
    }

    console.log(`Association: ${minnetonka.name}`);
    console.log(`URL: ${minnetonka.baseUrl}\n`);

    // Check if sitemap exists
    console.log('1. Checking sitemap...');
    try {
        const sitemapUrl = `${minnetonka.baseUrl}/sitemap.xml`;
        const response = await axios.get(sitemapUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        console.log(`✓ Sitemap exists (${response.status})`);

        const $ = cheerio.load(response.data, { xmlMode: true });
        const allUrls = $('loc').map((_, el) => $(el).text().trim()).get();
        console.log(`  Total URLs in sitemap: ${allUrls.length}`);

        const relevantUrls = allUrls.filter(url => {
            const lower = url.toLowerCase();
            return lower.includes('team') || lower.includes('squirt') || lower.includes('bantam') ||
                lower.includes('mite') || lower.includes('peewee');
        });
        console.log(`  Relevant URLs (team/age-related): ${relevantUrls.length}`);

        if (relevantUrls.length > 0) {
            console.log('\n  Sample URLs:');
            relevantUrls.slice(0, 10).forEach((url, i) => console.log(`    ${i + 1}. ${url}`));
        }
    } catch (error: any) {
        console.log(`✗ Sitemap error: ${error.message}`);
    }

    // Check homepage
    console.log('\n2. Checking homepage for team links...');
    try {
        const response = await axios.get(minnetonka.baseUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);

        const teamLinks: string[] = [];
        $('a').each((_, el) => {
            const text = $(el).text().trim().toLowerCase();
            const href = $(el).attr('href');
            if (!href) return;

            const keywords = ['team', 'squirt', 'bantam', 'peewee', 'mite', 'travel', 'youth'];
            if (keywords.some(k => text.includes(k) || href.toLowerCase().includes(k))) {
                teamLinks.push(`${text} -> ${href}`);
            }
        });

        console.log(`  Found ${teamLinks.length} potentially relevant links`);
        if (teamLinks.length > 0) {
            console.log('\n  Sample links:');
            teamLinks.slice(0, 15).forEach((link, i) => console.log(`    ${i + 1}. ${link}`));
        }
    } catch (error: any) {
        console.log(`✗ Homepage error: ${error.message}`);
    }

    // Try scraping
    console.log('\n3. Running scraper...');
    const teams = await scrapeAssociation(minnetonka);
    console.log(`\n✓ Scraper found ${teams.length} teams`);

    if (teams.length > 0) {
        console.log('\n  Teams found:');
        teams.forEach((team, i) => {
            console.log(`    ${i + 1}. ${team.name} (${team.team_level} ${team.level_detail})`);
            console.log(`       URL: ${team.calendar_sync_url}`);
        });
    }

    // Check for specific teams
    console.log('\n4. Looking for specific teams...');
    const squirtB2Blue = teams.find(t =>
        t.name.toLowerCase().includes('squirt') &&
        (t.name.toLowerCase().includes('b2') || t.name.toLowerCase().includes('blue'))
    );
    const bantamAA = teams.find(t =>
        t.name.toLowerCase().includes('bantam') &&
        t.name.toLowerCase().includes('aa')
    );

    console.log(`  Squirt B2 Blue: ${squirtB2Blue ? '✓ Found' : '✗ Not found'}`);
    if (squirtB2Blue) {
        console.log(`    ${squirtB2Blue.name} -> ${squirtB2Blue.calendar_sync_url}`);
    }

    console.log(`  Bantam AA: ${bantamAA ? '✓ Found' : '✗ Not found'}`);
    if (bantamAA) {
        console.log(`    ${bantamAA.name} -> ${bantamAA.calendar_sync_url}`);
    }
}

investigate().catch(console.error);
