export interface Association {
    name: string;
    baseUrl: string;
}

export interface ScrapedTeam {
    association_name: string;
    name: string;
    sport_type: 'hockey';
    team_level: 'Mites' | 'Squirts' | 'Peewees' | 'Bantams';
    level_detail: string;
    calendar_sync_url: string;
}

export interface ScrapeStatus {
    association: string;
    status: 'pending' | 'discovering' | 'scanning_calendars' | 'completed' | 'failed';
    teamsFound: number;
    message?: string;
}
