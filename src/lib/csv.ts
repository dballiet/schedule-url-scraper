import Papa from 'papaparse';
import { ScrapedTeam } from './types';

export function formatTeamsToCsv(teams: ScrapedTeam[]): string {
    // Define the columns as per requirements
    const data = teams.map(team => ({
        association_name: team.association_name,
        name: team.name,
        sport_type: team.sport_type,
        team_level: team.team_level,
        level_detail: team.level_detail,
        calendar_sync_url: team.calendar_sync_url
    }));

    return Papa.unparse(data, {
        header: true,
        columns: [
            'association_name',
            'name',
            'sport_type',
            'team_level',
            'level_detail',
            'calendar_sync_url'
        ]
    });
}
