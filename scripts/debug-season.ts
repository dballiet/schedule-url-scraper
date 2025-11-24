function extractSeasonYear(text: string): number | null {
    const patterns = [
        /(20\d{2})-(\d{2})/,  // 2025-26
        /(\d{2})-(\d{2})/      // 25-26
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            let year = match[1];
            if (year.length === 2) {
                year = '20' + year;
            }
            return parseInt(year);
        }
    }
    return null;
}

function getCurrentSeasonYear(): number {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return month >= 7 ? year : year - 1;
}

const urls = [
    'https://buffalo.pucksystems2.com/page/show/8603099',
    'https://buffalo.pucksystems2.com/page/show/9147098-squirt-b1-2025-26-'
];

const currentSeason = getCurrentSeasonYear();
console.log(`Current season year: ${currentSeason}\n`);

urls.forEach(url => {
    const season = extractSeasonYear(url);
    console.log(`URL: ${url}`);
    console.log(`  Extracted season: ${season}`);
    console.log(`  Is current season: ${season === currentSeason}`);
    console.log();
});
