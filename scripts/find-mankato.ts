import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';

async function main() {
    const mankato = ASSOCIATIONS.find(a => a.name.toLowerCase().includes('mankato'));

    if (!mankato) {
        console.error('Mankato association not found!');
        process.exit(1);
    }

    console.log(`\n🔎 Testing Mankato Area Hockey Association...`);
    console.log(`\nAssociation: ${mankato.name}`);
    console.log(`URL: ${mankato.baseUrl}\n`);

    try {
        const teams = await scrapeAssociation(mankato);

        console.log('\n' + '='.repeat(80));
        console.log('📊 Results Summary');
        console.log('='.repeat(80));
        console.log(`Total teams found: ${teams.length}\n`);

        // Group by age group
        const byAgeGroup = teams.reduce((acc, team) => {
            if (!acc[team.team_level]) acc[team.team_level] = [];
            acc[team.team_level].push(team);
            return acc;
        }, {} as Record<string, typeof teams>);

        for (const [ageGroup, ageTeams] of Object.entries(byAgeGroup)) {
            console.log(`\n${ageGroup}:`);
            ageTeams.forEach(t => {
                const tagMatch = t.calendar_sync_url.match(/tags=(\d+)/);
                const tagId = tagMatch ? tagMatch[1] : 'N/A';
                const isOldSeason = tagId.startsWith('88');
                const marker = isOldSeason ? '⚠️ OLD?' : '✅';
                console.log(`  ${marker} ${t.name} (tags=${tagId})`);
            });
        }

        // Check specifically for old season Peewee teams
        console.log('\n' + '='.repeat(80));
        console.log('🔍 Old Season Check (885xxxx tags should NOT appear)');
        console.log('='.repeat(80));

        const oldSeasonTeams = teams.filter(t => {
            const tagMatch = t.calendar_sync_url.match(/tags=(\d+)/);
            if (!tagMatch) return false;
            return tagMatch[1].startsWith('885');
        });

        if (oldSeasonTeams.length === 0) {
            console.log('✅ SUCCESS: No old season teams found!');
        } else {
            console.log(`❌ FAILURE: Found ${oldSeasonTeams.length} old season teams:`);
            oldSeasonTeams.forEach(t => {
                console.log(`  - ${t.name} (${t.calendar_sync_url})`);
            });
        }

    } catch (error) {
        console.error('Error scraping Mankato:', error);
    }
}

main();
