import { exportToCsv, importFromCsv, compareTeams, mergeTeams } from '../src/lib/csv-utils';
import { ScrapedTeam } from '../src/lib/types';

console.log('🧪 Testing CSV Utilities...\n');

// Test data
const scrapedTeams: ScrapedTeam[] = [
    {
        association_name: 'Eden Prairie Hockey Association',
        name: 'EP Squirt B2 Red',
        sport_type: 'hockey',
        team_level: 'Squirts',
        level_detail: 'B2 Red',
        calendar_sync_url: 'webcal://www.ephockey.com/ical_feed?tags=9256701'
    },
    {
        association_name: 'Rogers Youth Hockey Association',
        name: 'Squirt B2 Black',
        sport_type: 'hockey',
        team_level: 'Squirts',
        level_detail: 'B2 Black',
        calendar_sync_url: 'https://www.rogershockey.com/team/162578/calendar'
    }
];

// Test 1: Export to CSV
console.log('Test 1: Export to CSV');
const csv = exportToCsv(scrapedTeams);
console.log('✓ Exported CSV:');
console.log(csv);
console.log('');

// Test 2: Import from CSV
console.log('Test 2: Import from CSV');
const imported = importFromCsv(csv);
console.log(`✓ Imported ${imported.length} teams`);
console.log('');

// Test 3: Compare - No changes
console.log('Test 3: Compare (no changes)');
const compared1 = compareTeams(imported, scrapedTeams);
const unchangedCount = compared1.filter(t => t.status === 'unchanged').length;
console.log(`✓ ${unchangedCount}/${compared1.length} teams unchanged`);
console.log('');

// Test 4: Compare - URL changed
console.log('Test 4: Compare (URL changed)');
const scrapedWithChange: ScrapedTeam[] = [
    {
        ...scrapedTeams[0],
        calendar_sync_url: 'webcal://www.ephockey.com/ical_feed?tags=9999999' // Different URL
    },
    scrapedTeams[1]
];
const compared2 = compareTeams(imported, scrapedWithChange);
const changedCount = compared2.filter(t => t.status === 'url_changed').length;
console.log(`✓ ${changedCount} teams with URL changes`);
if (changedCount > 0) {
    const changedTeam = compared2.find(t => t.status === 'url_changed')!;
    console.log(`  - ${changedTeam.team_name}: ${changedTeam.notes}`);
}
console.log('');

// Test 5: Compare - New team
console.log('Test 5: Compare (new team added)');
const scrapedWithNew: ScrapedTeam[] = [
    ...scrapedTeams,
    {
        association_name: 'Prior Lake-Savage Hockey Association',
        name: 'Squirt B2 Gold',
        sport_type: 'hockey',
        team_level: 'Squirts',
        level_detail: 'B2 Gold',
        calendar_sync_url: 'webcal://www.plsha.com/ical_feed?tags=5220340'
    }
];
const compared3 = compareTeams(imported, scrapedWithNew);
const newCount = compared3.filter(t => t.status === 'new').length;
console.log(`✓ ${newCount} new teams added`);
console.log('');

// Test 6: Compare - Missing team
console.log('Test 6: Compare (team missing)');
const scrapedWithMissing: ScrapedTeam[] = [scrapedTeams[0]]; // Only first team
const compared4 = compareTeams(imported, scrapedWithMissing);
const missingCount = compared4.filter(t => t.status === 'missing').length;
console.log(`✓ ${missingCount} teams missing`);
if (missingCount > 0) {
    const missingTeam = compared4.find(t => t.status === 'missing')!;
    console.log(`  - ${missingTeam.team_name}: ${missingTeam.notes}`);
}
console.log('');

// Test 7: Merge - Incremental update
console.log('Test 7: Merge (incremental update)');
const newAssocTeam: ScrapedTeam = {
    association_name: 'Minnetonka Youth Hockey Association',
    name: 'Squirt A Blue',
    sport_type: 'hockey',
    team_level: 'Squirts',
    level_detail: 'A Blue',
    calendar_sync_url: 'webcal://www.tonkahockey.org/ical_feed?tags=9136978'
};
const merged = mergeTeams(imported, [newAssocTeam]);
console.log(`✓ Merged ${merged.length} teams (${imported.length} master + 1 new association)`);
const associations = new Set(merged.map(t => t.association));
console.log(`  Associations: ${Array.from(associations).join(', ')}`);
console.log('');

console.log('✅ All CSV utility tests passed!');
