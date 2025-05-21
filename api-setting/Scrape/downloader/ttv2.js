const axios = require('axios');
const cheerio = require('cheerio');

async function ttdlv2(url) {
const headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://snaptik.app',
          'Referer': 'https://snaptik.app/en2',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        };
        const data = {
        "link": url
        };
        
  try {
    const response = await axios.post(
      'https://snaptik.app/abc2.php', data, { headers: headers });
      return response.data
      } catch (error) {
      console.error('Error:', error);
      return { error: 'Request Failed' };
      }
      }
module.exports = ttdlv2;
