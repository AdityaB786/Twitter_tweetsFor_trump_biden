const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const port = 3000;
const cookiesPath = 'cookies.json';

app.use(express.static(path.join(__dirname, 'public')));
app.get('/run-script', async (req, res) => {
    let ipAddress = 'Unknown';
    try {
      const response = await axios.get('https://api.ipify.org?format=json');
      ipAddress = response.data.ip;
    } catch (error) {
      console.error('Error fetching IP address:', error);
    }
  
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
      await page.type('input[name="text"]', 'sahajbhati31299');
      await page.keyboard.press('Enter');
  
      console.log("Waiting for password input...");
      await page.waitForSelector('input[name="password"]', { timeout: 20000 });
      await page.type('input[name="password"]', 'sahaj123');
      await page.keyboard.press('Enter');
  
      console.log("Waiting for successful login...");
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  
      const loggedIn = await page.evaluate(() => document.querySelector('nav') !== null);
      if (!loggedIn) {
        await page.screenshot({ path: 'login_error_screenshot.png' });
        res.status(500).json({ error: "Login failed. Check the screenshot for details." });
        return;
      }
  
      console.log("Login successful. Navigating directly to the Trending page...");
      await page.goto('https://x.com/explore/tabs/trending', { waitUntil: 'networkidle2', timeout: 60000 });
  
      console.log("Waiting for the trends section to load...");
      const trendsSectionSelector = 'div[data-testid="trend"] span';
      await page.waitForSelector(trendsSectionSelector, { timeout: 90000 });
  
      console.log("Scrolling to load all trends...");
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise((resolve) => setTimeout(resolve, 5000));
  
      console.log("Capturing debug screenshot...");
      await page.screenshot({ path: 'debug_trends_page.png' });
  
      console.log("Extracting trends...");
      const trends = await page.evaluate(() => {
        const trendSelector = 'div[data-testid="trend"] span';
        const trendElements = Array.from(document.querySelectorAll(trendSelector));
  
        return trendElements
          .map((el) => el.textContent.trim())
          .filter((trend) => trend && trend.startsWith('#') && !trend.includes('·') && !/^\d+(\.\d+)?[kKmM]? posts$/i.test(trend))
          .filter((trend, index, self) => self.indexOf(trend) === index)
          .slice(0, 5);
      });
  
      if (trends.length === 0) {
        res.status(500).json({ error: "No trending topics found. Debug screenshot saved." });
        return;
      }
  
      console.log(`Trending Topics as of ${new Date().toISOString()}:`);
      trends.forEach((trend, index) => {
        console.log(`${index + 1}. ${trend}`);
      });
  
      const uri = 'mongodb://localhost:27017';
      const dbName = 'twitterScraper';
      const collectionName = 'trends';
  
      const client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);
      const collection = db.collection(collectionName);
  
      const dateTime = new Date().toISOString();
      const uniqueId = uuidv4();
  
      await collection.insertOne({
        _id: uniqueId,
        trends,
        date_time: dateTime,
        ip_address: ipAddress,
      });
  
      console.log("Data saved to MongoDB successfully.");
  
      const record = await collection.findOne({ _id: uniqueId });
  
      res.json({
        trends,
        date_time: dateTime,
        ip_address: `The IP address used for this query was: ${ipAddress}`,
        mongoRecord: record, 
      });
  
    } catch (error) {
      console.error("An error occurred during the scraping process:", error);
      await page.screenshot({ path: 'error_screenshot.png' });
      res.status(500).json({ error: "Scraping failed. Check server logs and screenshot for details." });
    } finally {
      console.log("Closing browser...");
      await browser.close();
    }
  });
  
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
