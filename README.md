TwitterStreamClient is a client for the Twitter Streaming API

## Initialization and configuration

Install

```
npm install orange-twitterstreamclient --registry http://10.194.224.187:4873/
```

```javascript
var TwitterClient = require('orange-twitterstreamclient'),
    twitterClient;

mongoose.connect(process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/ParisGamesWeek');
pusherClient.init();

twitterClient = new TwitterClient({
        twitter: {
            OAuth: {
                consumerKey: 'TWITTER CONSUMER KEY',
                consumerSecret:  'TWITTER CONSUMER SECRET',
            },
            keepAliveTime: 64000,
            keywords: '#hashtag',
            accessToken: 'TWITTER ACCESS TOKEN',
            accessTokenSecret: 'TWITTER ACCESS TOKEN SECRET',
        }
    },
    proxy: {
        host: 'my-proxy',
        port: '1080'
    });
```

##  Events
TwitterStreamClient sends 3 events

* connected
* twitterdown
* newtweet
* twittererror