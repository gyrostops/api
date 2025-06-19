const scrapeTiktok = require('tiktok.js')
const axios = require('axios')
const cheerio = require('cheerio')

async function scrapeTiktok(url){
  try{
    const anu = await scrapeTiktok(url);
    const result = new TiktokScraper();
    return result.data;
  }catch(error){
    console.log('Scrapenya Rusak jir benerin gih.', error);
  }
}
module.exports = scrapeTiktok;
