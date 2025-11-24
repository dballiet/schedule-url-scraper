import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

async function inspect() {
    const urls = [
        'https://buffalo.pucksystems2.com/page/show/7046-teams'
    ];

    let output = '';

    for (const url of urls) {
        console.log(`Fetching ${url}...`);
        output += `\n--- URL: ${url} ---\n`;
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 10000,
                validateStatus: () => true
            });
            output += `Status: ${response.status}\n`;

            if (response.status === 200) {
                if (url.endsWith('.xml')) {
                    output += `Content: ${response.data.substring(0, 10000)}\n...`;
                } else {
                    const $ = cheerio.load(response.data);
                    $('a').each((_, el) => {
                        const text = $(el).text().trim();
                        const href = $(el).attr('href');
                        if (href) {
                            output += `Link: [${text}] -> ${href}\n`;
                        }
                    });
                }
            }
        } catch (error) {
            output += `Error: ${error}\n`;
        }
    }

    fs.writeFileSync('buffalo_inspection.txt', output);
    console.log('Inspection complete. Check buffalo_inspection.txt');
}

inspect();
