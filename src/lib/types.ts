export interface Association {
    name: string;
    baseUrl: string;
}

export type AgeGroup = 'Mites' | 'Squirts' | 'Peewees' | 'Bantams' | '10U' | '12U' | '15U';

export const AGE_GROUPS: AgeGroup[] = [
    'Bantams',
    'Peewees',
    'Squirts',
    'Mites',
    '15U',
    '12U',
    '10U'
];

export interface ScrapedTeam {
    association_name: string;
    name: string;
    sport_type: 'hockey';
    team_level: AgeGroup;
    level_detail: string;
    calendar_sync_url: string;
}

export interface ScrapeStatus {
    association: string;
    status: 'pending' | 'discovering' | 'scanning_calendars' | 'completed' | 'failed';
    teamsFound: number;
    message?: string;
}
