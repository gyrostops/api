const axios = require('axios');
const cheerio = require('cheerio');

class TikTokScraper {
  constructor() {
    this.baseURL = 'https://snaptik.app';
    this.userAgent = 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';
  }

  // Ambil token dari halaman utama
  async getToken() {
    try {
      console.log('🔄 Mengambil token...');
      
      const response = await axios.get(`${this.baseURL}/en2`, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });

      const $ = cheerio.load(response.data);
      const token = $('input[name="token"]').val();
      
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      console.log('✅ Token berhasil diambil:', token);
      return token;
      
    } catch (error) {
      console.error('❌ Error mengambil token:', error.message);
      throw error;
    }
  }

  // Extract photo download links dari HTML
  extractPhotoLinks(html) {
    const photos = [];
    const $ = cheerio.load(html);

    // Cari semua foto dalam kolom
    $('.column .photo').each((index, element) => {
      const $photo = $(element);
      const imgSrc = $photo.find('img').attr('src');
      const downloadLink = $photo.find('.dl-footer a').attr('href');
      
      if (imgSrc && downloadLink) {
        photos.push({
          index: index + 1,
          imageUrl: imgSrc,
          downloadUrl: downloadLink,
          type: 'photo'
        });
      }
    });

    return photos;
  }

  // Extract render button data
  extractRenderData(html) {
    const $ = cheerio.load(html);
    const renderButton = $('button[data-token]');
    
    if (renderButton.length > 0) {
      const token = renderButton.attr('data-token');
      const isAd = renderButton.attr('data-ad') === 'true';
      
      return {
        hasRenderButton: true,
        token: token,
        isAd: isAd,
        type: 'render'
      };
    }
    
    return { hasRenderButton: false };
  }

  // Extract video info dari response
  extractVideoInfo(html) {
    try {
      const $ = cheerio.load(html);
      
      // Extract video title dan author
      const title = $('.video-title').text().trim() || 'Tidak ada judul';
      const author = $('.info span').text().trim() || 'Tidak diketahui';
      const thumbnail = $('#thumbnail').attr('src') || '';

      // Extract download links untuk video
      const downloadLinks = [];
      
      // Link download biasa
      $('a[href*="rapidcdn"], a[href*="download"]').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && href.includes('http')) {
          downloadLinks.push({
            type: 'video',
            url: href,
            quality: text.includes('HD') ? 'HD' : 'Normal',
            label: text
          });
        }
      });

      // Link HD dari button
      const hdButton = $('button[data-tokenhd]');
      if (hdButton.length > 0) {
        const hdTokenUrl = hdButton.attr('data-tokenhd');
        const backupUrl = hdButton.attr('data-backup');
        
        if (hdTokenUrl) {
          downloadLinks.push({
            type: 'video',
            url: hdTokenUrl,
            quality: 'HD',
            label: 'Download Video HD'
          });
        }
        
        if (backupUrl) {
          downloadLinks.push({
            type: 'video',
            url: backupUrl,
            quality: 'Normal',
            label: 'Download Video (Backup)'
          });
        }
      }

      // Extract foto-foto untuk slideshow
      const photos = this.extractPhotoLinks(html);
      
      // Extract render data
      const renderData = this.extractRenderData(html);

      // Tentukan tipe konten
      const contentType = photos.length > 0 ? 'slideshow' : 'video';

      return {
        title,
        author,
        thumbnail,
        contentType,
        downloadLinks,
        photos,
        renderData
      };
      
    } catch (error) {
      console.error('❌ Error extract video info:', error.message);
      return null;
    }
  }

  // Decode obfuscated JavaScript jika diperlukan
  decodeObfuscatedJS(body) {
    try {
      const re = /eval\(function\(h,u,n,t,e,r\)\{[\s\S]*?\}\(\s*"([^"]*)"\s*,\s*\d+\s*,\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\)/;
      const match = body.match(re);
      
      if (!match) {
        // Jika tidak ter-obfuscate, return body asli
        return body;
      }

      const [, h, N, tStr, eStr, rStr] = match;
      const OFFSET = +tStr;
      const BASE_FROM = +eStr;
      const DELIM = N.charAt(BASE_FROM);
      const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/";

      function fromBase(str, base) {
        const tbl = ALPHABET.split("").slice(0, base);
        return str.split("").reverse().reduce((acc, ch, idx) => {
          const v = tbl.indexOf(ch);
          return acc + (v < 0 ? 0 : v * Math.pow(base, idx));
        }, 0);
      }

      const segs = h.split(DELIM).filter(s => s);
      let plain = "";
      
      for (const seg of segs) {
        let s = seg;
        for (let d = 0; d < N.length; d++) {
          s = s.split(N[d]).join(d.toString());
        }
        const code = fromBase(s, BASE_FROM) - OFFSET;
        plain += String.fromCharCode(code);
      }

      return Buffer.from(plain, "latin1").toString("utf8");
      
    } catch (error) {
      console.log('⚠️ Decode gagal, menggunakan response asli');
      return body;
    }
  }

  // Main scraping function
  async scrape(tiktokUrl) {
    try {
      console.log('🚀 Memulai scraping TikTok...');
      console.log('📱 URL:', tiktokUrl);
      console.log('━'.repeat(60));

      // Step 1: Get token
      const token = await this.getToken();

      // Step 2: Submit form
      console.log('🔄 Mengirim request ke API...');
      
      const formData = new URLSearchParams();
      formData.append('url', tiktokUrl);
      formData.append('lang', 'en2');
      formData.append('token', token);

      const response = await axios.post(`${this.baseURL}/abc2.php`, formData, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': '*/*',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.baseURL}/en2`,
          'Origin': this.baseURL
        }
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Response berhasil diterima');

      // Step 3: Decode response jika perlu
      console.log('🔄 Memproses response...');
      const decodedHtml = this.decodeObfuscatedJS(response.data);

      // Step 4: Extract video info
      const videoInfo = this.extractVideoInfo(decodedHtml);
      
      if (!videoInfo) {
        throw new Error('Tidak dapat mengekstrak informasi video');
      }

      // Validasi hasil
      if (videoInfo.downloadLinks.length === 0 && videoInfo.photos.length === 0) {
        throw new Error('Tidak ada download links atau foto yang ditemukan');
      }

      return {
        success: true,
        data: {
          originalUrl: tiktokUrl,
          ...videoInfo
        }
      };

    } catch (error) {
      console.error('❌ Error:', error.message);
      return {
        success: false,
        error: error.message,
        originalUrl: tiktokUrl
      };
    }
  }

  // Format output yang rapi
  formatOutput(result) {
    if (!result.success) {
      return `
❌ SCRAPING GAGAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL: ${result.originalUrl}
Error: ${result.error}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `.trim();
    }

    const { data } = result;
    let output = `
✅ SCRAPING BERHASIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 INFORMASI KONTEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Judul: ${data.title}
👤 Author: ${data.author}
🎬 Tipe: ${data.contentType.toUpperCase()}
🔗 URL Asli: ${data.originalUrl}
🖼️ Thumbnail: ${data.thumbnail ? 'Ada' : 'Tidak ada'}`;

    // Tampilkan video download links jika ada
    if (data.downloadLinks.length > 0) {
      output += `

📥 VIDEO DOWNLOAD LINKS (${data.downloadLinks.length} link)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      data.downloadLinks.forEach((link, index) => {
        output += `
${index + 1}. ${link.label}
   🔸 Kualitas: ${link.quality}
   🔸 Type: ${link.type}
   🔸 URL: ${link.url}`;
      });
    }

    // Tampilkan foto download links jika ada
    if (data.photos.length > 0) {
      output += `

📸 FOTO DOWNLOAD LINKS (${data.photos.length} foto)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      data.photos.forEach((photo, index) => {
        output += `
${index + 1}. Foto ${photo.index}
   🔸 Preview: ${photo.imageUrl}
   🔸 Download: ${photo.downloadUrl}
   🔸 Type: ${photo.type}`;
      });
    }

    // Tampilkan render data jika ada
    if (data.renderData && data.renderData.hasRenderButton) {
      output += `

🎬 RENDER DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔸 Render Token: ${data.renderData.token ? 'Ada' : 'Tidak ada'}
🔸 Contains Ad: ${data.renderData.isAd ? 'Ya' : 'Tidak'}
🔸 Type: ${data.renderData.type}`;
    }

    output += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return output;
  }
}

// Fungsi helper untuk penggunaan mudah
async function scrapeTikTok(url) {
  const scraper = new TikTokScraper();
  const result = await scraper.scrape(url);
  return result;
}

// Export untuk penggunaan sebagai module
module.exports = { TiktokScraper, scrapeTiktok };


