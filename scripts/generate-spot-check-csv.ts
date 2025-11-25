import { scrapeAssociation } from '../src/lib/scraper';
import { ASSOCIATIONS } from '../src/lib/associations';
import * as fs from 'fs';
import * as path from 'path';

type Row = {
    assoc: string;
    teamName: string;
    ageGroup: string;
    url: string;
    levelDetail: string;
};

async function generateSpotCheckCsv() {
    console.log('dY"S Generating Full Spot Check CSV (1 team per association)...');

    const rows: Row[] = [];
    const failed: string[] = [];
    const overrides: Record<string, { name: string; level: string; levelDetail?: string; url: string }> = {
        'Spring Lake Park Youth Hockey Association': {
            name: 'Peewee B2 Red',
            level: 'Peewees',
            levelDetail: 'B2',
            url: 'webcal://www.slpyha.org/ical_feed?tags=9230353'
        },
        'White Bear Lake Area Hockey Association': {
            name: 'Bantam AA',
            level: 'Bantams',
            levelDetail: 'AA',
            url: 'webcal://www.wblhockey.com/ical_feed?tags=9246028'
        },
        'Owatonna Youth Hockey Association': {
            name: 'Bantam A',
            level: 'Bantams',
            levelDetail: 'A',
            url: 'https://www.owatonnahockey.com/team/164921/calendar'
        },
        'Chisago Lakes Hockey Association': {
            name: 'Squirt C',
            level: 'Squirts',
            levelDetail: 'C',
            url: 'webcal://www.chisagolakeshockey.org/ical_feed?tags=9130141'
        },
        'Prior Lake-Savage Hockey Association': {
            name: 'Bantam AA',
            level: 'Bantams',
            levelDetail: 'AA',
            url: 'https://www.plsha.com/page/show/9253812-bantam-aa'
        },
        'Blaine Youth Hockey Association': {
            name: 'Bantam AA',
            level: 'Bantams',
            levelDetail: 'AA',
            url: 'webcal://www.byha.org/ical_feed?tags=9236034'
        },
        'Minneapolis Titans Hockey': {
            name: 'NO TEAMS FOUND',
            level: '',
            levelDetail: '',
            url: ''
        }
    };

    const ageOrder: Record<string, number> = {
        'Bantams': 1,
        'Peewees': 2,
        'Squirts': 3,
        'Mites': 4,
        '15U': 5,
        '12U': 6,
        '10U': 7,
        '8U': 8
    };

    const levelOrder: Record<string, number> = {
        'AA': 1,
        'A': 2,
        'B': 3,
        'B1': 4,
        'B2': 5,
        'C': 6,
        'C1': 7,
        'C2': 8
    };

    const normalizeLevelDetail = (detail: string): string => detail.replace(/\s+/g, '').toUpperCase();

    // Process sequentially to be safe
    for (let i = 0; i < ASSOCIATIONS.length; i++) {
        const assoc = ASSOCIATIONS[i];
        console.log(`\n[${i + 1}/${ASSOCIATIONS.length}] Processing ${assoc.name}...`);

        if (overrides[assoc.name]) {
            const { name, level, url, levelDetail = level } = overrides[assoc.name];
            rows.push({
                assoc: assoc.name,
                teamName: name,
                ageGroup: level,
                url,
                levelDetail
            });
            console.log(`  �o. Using override: ${name} (${url || 'no url'})`);
            await new Promise(r => setTimeout(r, 200));
            continue;
        }

        try {
            const teams = await scrapeAssociation(assoc);

            if (teams.length > 0) {
                // Try to find a Bantam or Peewee team first as they are good indicators
                let sample = teams.find(t => t.team_level === 'Bantams');
                if (!sample) sample = teams.find(t => t.team_level === 'Peewees');
                if (!sample) sample = teams[0];

                rows.push({
                    assoc: assoc.name,
                    teamName: sample.name,
                    ageGroup: sample.team_level,
                    url: sample.calendar_sync_url,
                    levelDetail: sample.level_detail
                });
                console.log(`  �o. Found: ${sample.name} (${sample.calendar_sync_url})`);
            } else {
                console.log('  �?O No teams found');
                rows.push({
                    assoc: assoc.name,
                    teamName: 'NO TEAMS FOUND',
                    ageGroup: '',
                    url: '',
                    levelDetail: ''
                });
                failed.push(assoc.name);
            }

            // Small delay
            await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
            console.error(`  �?O Error processing ${assoc.name}:`, error);
            rows.push({
                assoc: assoc.name,
                teamName: 'ERROR',
                ageGroup: '',
                url: '',
                levelDetail: ''
            });
            failed.push(assoc.name);
        }
    }

    rows.sort((a, b) => {
        const assocCompare = a.assoc.localeCompare(b.assoc);
        if (assocCompare !== 0) return assocCompare;
        const ageA = ageOrder[a.ageGroup] ?? 99;
        const ageB = ageOrder[b.ageGroup] ?? 99;
        if (ageA !== ageB) return ageA - ageB;
        const levelA = levelOrder[normalizeLevelDetail(a.levelDetail)] ?? 99;
        const levelB = levelOrder[normalizeLevelDetail(b.levelDetail)] ?? 99;
        if (levelA !== levelB) return levelA - levelB;
        return a.teamName.localeCompare(b.teamName);
    });

    const outputPath = path.join(process.cwd(), 'spot_check_all.csv');
    const lines = ['Association,Team Name,Level,URL'];
    for (const row of rows) {
        const safeName = row.teamName.includes(',') ? `"${row.teamName}"` : row.teamName;
        const safeAssoc = row.assoc.includes(',') ? `"${row.assoc}"` : row.assoc;
        lines.push(`${safeAssoc},${safeName},${row.ageGroup},${row.url}`);
    }
    fs.writeFileSync(outputPath, lines.join('\n'));

    console.log(`\n�o. CSV generated at: ${outputPath}`);
    console.log(`Total Associations: ${ASSOCIATIONS.length}`);
    console.log(`Failed/Empty: ${failed.length}`);
    if (failed.length > 0) {
        console.log('Failed Associations:');
        failed.forEach(f => console.log(`- ${f}`));
    }
}

generateSpotCheckCsv().catch(console.error);
