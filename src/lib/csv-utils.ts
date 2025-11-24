import Papa from 'papaparse';
import { ScrapedTeam } from './types';

export interface CsvTeamRecord {
    association: string;
    team_name: string;
    age_group: string;
    level_detail: string;
    calendar_url: string;
    status?: 'unchanged' | 'new' | 'url_changed' | 'missing';
    notes?: string;
}

/**
 * Convert scraped teams to CSV string
 */
export function exportToCsv(teams: ScrapedTeam[]): string {
    const records: CsvTeamRecord[] = teams.map(team => ({
        association: team.association_name,
        team_name: team.name,
        age_group: team.team_level,
        level_detail: team.level_detail,
        calendar_url: team.calendar_sync_url,
        status: 'new',
        notes: ''
    }));

    return Papa.unparse(records);
}

/**
 * Parse CSV string into team records
 */
export function importFromCsv(csvContent: string): CsvTeamRecord[] {
    const parsed = Papa.parse<CsvTeamRecord>(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.toLowerCase().trim()
    });

    if (parsed.errors.length > 0) {
        console.error('CSV parsing errors:', parsed.errors);
    }

    return parsed.data;
}

/**
 * Create unique key for team matching
 */
function makeTeamKey(association: string, ageGroup: string, levelDetail: string): string {
    return `${association.toLowerCase()}|${ageGroup.toLowerCase()}|${levelDetail.toLowerCase()}`;
}

/**
 * Compare master CSV against newly scraped teams
 * Returns combined results with status flags
 */
export function compareTeams(
    master: CsvTeamRecord[],
    scraped: ScrapedTeam[]
): CsvTeamRecord[] {
    const results: CsvTeamRecord[] = [];

    // Build lookup maps
    const masterMap = new Map<string, CsvTeamRecord>();
    for (const team of master) {
        const key = makeTeamKey(team.association, team.age_group, team.level_detail);
        masterMap.set(key, team);
    }

    const scrapedMap = new Map<string, ScrapedTeam>();
    for (const team of scraped) {
        const key = makeTeamKey(team.association_name, team.team_level, team.level_detail);
        scrapedMap.set(key, team);
    }

    // Process scraped teams (new or updated)
    for (const team of scraped) {
        const key = makeTeamKey(team.association_name, team.team_level, team.level_detail);
        const masterTeam = masterMap.get(key);

        if (!masterTeam) {
            // Brand new team
            results.push({
                association: team.association_name,
                team_name: team.name,
                age_group: team.team_level,
                level_detail: team.level_detail,
                calendar_url: team.calendar_sync_url,
                status: 'new',
                notes: 'Added in this scrape'
            });
        } else if (masterTeam.calendar_url !== team.calendar_sync_url) {
            // URL changed
            results.push({
                association: team.association_name,
                team_name: team.name,
                age_group: team.team_level,
                level_detail: team.level_detail,
                calendar_url: team.calendar_sync_url,
                status: 'url_changed',
                notes: `URL changed from ${masterTeam.calendar_url}`
            });
        } else {
            // Unchanged
            results.push({
                association: team.association_name,
                team_name: team.name,
                age_group: team.team_level,
                level_detail: team.level_detail,
                calendar_url: team.calendar_sync_url,
                status: 'unchanged',
                notes: ''
            });
        }

        // Mark as processed
        masterMap.delete(key);
    }

    // Process remaining master teams (missing in new scrape)
    for (const [_, team] of masterMap) {
        results.push({
            association: team.association,
            team_name: team.team_name,
            age_group: team.age_group,
            level_detail: team.level_detail,
            calendar_url: team.calendar_url,
            status: 'missing',
            notes: 'Not found in latest scrape'
        });
    }

    return results;
}

/**
 * Merge master CSV with scraped teams (for incremental updates)
 * If scraped associations overlap with master, use comparison logic
 * If scraped associations are new, add them
 */
export function mergeTeams(
    master: CsvTeamRecord[],
    scraped: ScrapedTeam[]
): CsvTeamRecord[] {
    // Get unique associations from scraped data
    const scrapedAssociations = new Set(scraped.map(t => t.association_name.toLowerCase()));

    // Keep master teams that weren't scraped this time
    const unchangedMaster = master.filter(t =>
        !scrapedAssociations.has(t.association.toLowerCase())
    );

    // Compare teams from scraped associations
    const scrapedAssocTeams = master.filter(t =>
        scrapedAssociations.has(t.association.toLowerCase())
    );

    const comparedTeams = compareTeams(scrapedAssocTeams, scraped);

    return [...unchangedMaster, ...comparedTeams];
}
