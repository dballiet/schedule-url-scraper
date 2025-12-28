/**
 * Quick verification for multiple associations
 */
import { scrapeAssociation } from '../src/lib/scraper';
import { Association } from '../src/lib/types';

const associations: Association[] = [
    { name: 'Red Wing Amateur Hockey Association', baseUrl: 'https://www.redwinghockey.org' },
    { name: 'Rogers Youth Hockey Association', baseUrl: 'https://www.rogershockey.com' },
    { name: 'St. Francis Youth Hockey Association', baseUrl: 'https://www.sfyha.org' },
];

async function main() {
    for (const assoc of associations) {
        console.log('\n=== ' + assoc.name + ' ===');
        const teams = await scrapeAssociation(assoc, ['Mites', 'Squirts', '10U']);

        const badUrls = teams.filter(t =>
            (t.calendar_sync_url.endsWith('/schedule') && !t.calendar_sync_url.includes('/team/')) ||
            t.calendar_sync_url.includes('/events/')
        );

        console.log('Teams found:', teams.length);
        console.log('Bad URLs (should be 0):', badUrls.length);

        if (badUrls.length > 0) {
            badUrls.forEach(t => console.log('  BAD:', t.name, '-', t.calendar_sync_url));
        }
    }
}

main().catch(console.error);
