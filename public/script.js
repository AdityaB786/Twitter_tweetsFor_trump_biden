const fetchTweets = async (type) => {
  const loadingDiv = document.getElementById('loading');
  const tweetsContainer = document.getElementById('tweetsContainer');
  tweetsContainer.innerHTML = '';
  loadingDiv.style.display = 'block';

  try {
    const response = await fetch(`/run-script?search=${type}`);
    const data = await response.json();
    loadingDiv.style.display = 'none';

    if (data.error) {
      tweetsContainer.innerHTML = `<p>Error: ${data.error}</p>`;
    } else {
      if (type === 'both') {
        // Filter the tweets based on the content (not the entire tweet object)
        const trumpTweets = data.tweets.filter(tweet => tweet.content && tweet.content.includes('Trump'));
        const bidenTweets = data.tweets.filter(tweet => tweet.content && tweet.content.includes('Biden'));

        tweetsContainer.innerHTML = `
          <div class="tweet-section">
            <h2>Trump's Tweets</h2>
            <div class="tweet-cards-container">
              ${trumpTweets.map(tweet => `
                <div class="tweet-card">
                  <h3>Tweet</h3>
                  <p>${tweet.content}</p>
                  <a href="${tweet.url}" target="_blank" class="read-more">Read More</a>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="tweet-section">
            <h2>Biden's Tweets</h2>
            <div class="tweet-cards-container">
              ${bidenTweets.map(tweet => `
                <div class="tweet-card">
                  <h3>Tweet</h3>
                  <p>${tweet.content}</p>
                  <a href="${tweet.url}" target="_blank" class="read-more">Read More</a>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        // Display tweets for the specific search type (Trump or Biden)
        tweetsContainer.innerHTML = `
          <div class="tweet-section">
            <h2>${type.charAt(0).toUpperCase() + type.slice(1)}'s Tweets</h2>
            <div class="tweet-cards-container">
              ${data.tweets.map(tweet => `
                <div class="tweet-card">
                  <h3>Tweet</h3>
                  <p>${tweet.content}</p>
                  <a href="${tweet.url}" target="_blank" class="read-more">Read More</a>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    loadingDiv.style.display = 'none';
    tweetsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
  }
};

document.getElementById('fetchTweetsBoth').addEventListener('click', () => fetchTweets('both'));
document.getElementById('fetchTweetsTrump').addEventListener('click', () => fetchTweets('trump'));
document.getElementById('fetchTweetsBiden').addEventListener('click', () => fetchTweets('biden'));
