import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

async function inspect() {
    const urls = [
        'https://buffalo.pucksystems2.com/page/show/8603099', // Found by scraper
        'https://buffalo.pucksystems2.com/page/show/9147098'  // Expected by user
    ];

    for (const url of urls) {
        console.log(`\n=== Checking ${url} ===`);
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const title = $('h1').first().text().trim();
            const seasonLinks = $('a').toArray()
                .map(el => $(el).text().trim())
                .filter(text => text.match(/20\d{2}-\d{2}/));

            console.log(`Title: ${title}`);
            console.log(`Season indicators found: ${seasonLinks.join(', ')}`);
            console.log(`URL contains: ${url}`);
        } catch (error) {
            console.log(`Error: ${error}`);
        }
    }
}

inspect();
