(async () => {
  const { wrapper } = await import('axios-cookiejar-support');
  const { CookieJar } = await import('tough-cookie');
  const axios = require('axios');
  const cheerio = require('cheerio');

const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  headers: {
    'authority': 'kol.id',
    'accept': '*/*',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    'origin': 'https://kol.id',
    'referer': 'https://kol.id/download-video/tiktok',
    'sec-ch-ua': '"Chromium";v="137", "Not/A)Brand";v="24"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
    'x-requested-with': 'XMLHttpRequest'
  }
}));

async function fetchCsrfToken() {
  const resp = await client.get('https://kol.id/download-video/tiktok');
  const $ = cheerio.load(resp.data);
  const token = $('meta[name="csrf-token"]').attr('content');
  if (!token) throw new Error('CSRF token tidak ditemukan');
  return token;
}
  

async function downloadTikTok(query) {
  try {
    new URL(query);
  } catch {
    throw new Error('URL TikTok tidak valid');
  }

  const token = await fetchCsrfToken();
  const payload = { url: query, _token: token };
  const resp = await client.post(
    'https://kol.id/download-video/tiktok',
    payload,
    { timeout: 15_000 }
  );
  if (!resp.data || resp.data.error) {
    throw new Error(resp.data.message || 'Gagal mendapatkan data dari kol.id');
  }
  return resp.data;
}

module.exports = { downloadTikTok };
})();
