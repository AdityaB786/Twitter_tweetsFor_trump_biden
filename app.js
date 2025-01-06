const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const cookiesPath = 'cookies.json';

app.use(express.static(path.join(__dirname, 'public')));
app.get('/run-script', async (req, res) => {
  const searchType = req.query.search || 'both';  

  console.log("Starting Twitter scraping process...");
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  try {
      console.log("Navigating to Twitter login page...");
      await page.goto('https://x.com/login', { waitUntil: 'networkidle2' });

      if (fs.existsSync(cookiesPath)) {
          const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
          await page.setCookie(...cookies);
      }

      console.log("Entering login credentials...");
      await page.waitForSelector('input[name="text"]', { timeout: 20000 });
      await page.type('input[name="text"]', process.env.USERNAME);
      await page.keyboard.press('Enter');

      await page.waitForSelector('input[name="password"]', { timeout: 20000 });
      await page.type('input[name="password"]', process.env.PASSWORD);
      await page.keyboard.press('Enter');

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      const loggedIn = await page.evaluate(() => document.querySelector('nav') !== null);
      if (!loggedIn) {
          return res.status(500).json({ error: "Login failed." });
      }

      // Helper function to scrape tweets from a specific search term
      const scrapeTweets = async (searchQuery) => {
          const searchUrl = `https://x.com/search?q=${searchQuery}&src=typed_query&f=live`;
          console.log(`Navigating to search page: ${searchUrl}`);
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

          return await page.evaluate(() => {
              return Array.from(document.querySelectorAll('article'))
                  .map(tweet => {
                      const contentElement = tweet.querySelector('div[lang]');
                      const tweetUrlElement = tweet.querySelector('a');
                      const tweetUrl = tweetUrlElement ? tweetUrlElement.href : null;
                      return {
                          content: contentElement ? contentElement.innerText.trim() : null,
                          url: tweetUrl,
                      };
                  })
                  .filter(tweet => tweet.content && tweet.url); // Ensure we have both content and URL
          });
      };

      let topTweets = [];

      // Handling "both" case where we scrape both Trump and Biden tweets
      if (searchType === 'both') {
          const trumpTweets = await scrapeTweets('trump');
          const bidenTweets = await scrapeTweets('biden');
          topTweets = [...trumpTweets, ...bidenTweets];  // Combine the tweets for both Trump and Biden
      } else {
          topTweets = await scrapeTweets(searchType);  // Scrape only the specified search type (Trump or Biden)
      }

      console.log("Latest Tweets:");
      topTweets.forEach((tweet, index) => {
          console.log(`${index + 1}. Content: ${tweet.content}`);
          console.log(`   URL: ${tweet.url}`);
      });

      const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
      const dbName = 'trump_biden_both';
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection('tweets');

      const dateTime = new Date().toISOString();
      const uniqueId = uuidv4();

      await collection.insertOne({
          _id: uniqueId,
          tweets: topTweets.map(tweet => ({
              content: tweet.content,
              url: tweet.url
          })),
          date_time: dateTime
      });

      const record = await collection.findOne({ _id: uniqueId });

      res.json({
          tweets: topTweets,
          date_time: dateTime,
          mongoRecord: record,
      });
  } catch (error) {
      console.error("An error occurred during scraping:", error);
      return res.status(500).json({ error: "Scraping failed. Check server logs for details." });
  } finally {
      console.log("Closing browser...");
      await browser.close();
  }
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
