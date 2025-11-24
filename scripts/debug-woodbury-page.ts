import * as cheerio from 'cheerio';
import axios from 'axios';

const URL = 'https://www.woodburyhockey.com/page/show/9248176-woodbury-bn-b1-royal';

async function main() {
    console.log(`Fetching ${URL}...`);
    try {
        const response = await axios.get(URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        let pageTitle = $('h1').first().text().trim();
        console.log(`H1: "${pageTitle}"`);

        if (!pageTitle) {
            const h2Text = $('h2').first().text().trim();
            console.log(`H2: "${h2Text}"`);
            const hasLevelIndicators = /\b(A{1,2}|B[12]?|C|[Gg]old|[Pp]urple|[Bb]lack|[Ww]hite|[Bb]lue|[Rr]ed|[Gg]reen|[Mm]achine)\b/.test(h2Text);
            if (hasLevelIndicators) {
                pageTitle = h2Text;
            }
        }

        console.log(`Final Page Title: "${pageTitle}"`);

        const getAgeGroup = (name: string) => {
            const lower = name.toLowerCase();
            if (lower.includes('mite')) return 'Mites';
            if (lower.includes('squirt') || lower.includes('sq-')) return 'Squirts';
            if (lower.includes('peewee') || lower.includes('pw-')) return 'Peewees';
            if (lower.includes('bantam') || lower.includes('btm-') || lower.includes('bn-')) return 'Bantams';
            return null;
        };

        const ageGroup = getAgeGroup(pageTitle);
        console.log(`Age Group: ${ageGroup}`);

        if (ageGroup) {
            const getLevelDetail = (name: string, ageGroup: string) => {
                const singular = ageGroup.endsWith('s') ? ageGroup.slice(0, -1) : ageGroup;
                const regex = new RegExp(`(${ageGroup}|${singular})`, 'i');
                let detail = name.replace(regex, '').trim();
                detail = detail.replace(/^(Team|Jr\.?|Boys|Girls)\s+/i, '');
                detail = detail.replace(/[-–]/g, '').trim();
                return detail || 'Unknown';
            };

            const detail = getLevelDetail(pageTitle, ageGroup);
            console.log(`Level Detail: "${detail}"`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
