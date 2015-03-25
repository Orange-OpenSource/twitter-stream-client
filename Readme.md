TwitterStreamClient is a client for the Twitter Streaming API

## Quick start

To install TwitterStreamClient, run: 

```
npm install twitter-stream-client
```

A simple Twitter Stream client would be:

```javascript
var TwitterClient = require('twitter-stream-client');
var twitterClient = new TwitterClient ({
        OAuth: {
            consumerKey: 'TWITTER CONSUMER KEY',
            consumerSecret:  'TWITTER CONSUMER SECRET',
        },
        keywords: '#hashtag',
        accessToken: 'TWITTER ACCESS TOKEN',
        accessTokenSecret: 'TWITTER ACCESS TOKEN SECRET'
});

twitterClient.on('newtweet', function (tweet) {
    console.log(tweet.text);
});
```

##  Events

TwitterStreamClient is an [EventEmitter](http://nodejs.org/api/events.html) and sends the following events:

* __connected__: when we have a response from Twitter
* __twitterdown__: when we did not get the keep alive tick from Twitter for longer than keepAliveTime (see API#constructor)
* __newtweet__: when we have a new tweet from Twitter, the parsed tweet is passed as a parameter to the callback
* __missedtweets__: when twitter sends a "limit" error, we emit this event with the number of missed tweets on this particular time (not the total)
* __error__: when the connection request gets an error code as a response or Twitter sends a string that is not JSON

## API

#### TwitterClient (options, proxy)
TwitterClient is the constructor and has two arguments:

`options` is a hash which must contain:

* __`OAuth`__, a hash containing `consumerKey` (you Twitter consumer key) and `consumerSecret` (your Twitter consumer secret)
* __`keywords`__ (string), a comma-separated list of keywords to wtach on Twitter
* __`accessToken`__ (string), your Twitter access token
* __`accessTokenSecret`__ (string), your Twitter access token secret

`options` can also contain:

* __`keepAliveTime`__ (integer),  default 64000, if Twitter does not send a keep alive tick after this duration, we consider the connection is lost and send `twitterdown` event and restart the client 
* __`trackRequest`__ (string), default `'/1.1/statuses/filter.json?stall_warnings=true&track'`, can be used to change the streaming API we use 
* __`host`__ (string), default `'stream.twitter.com'`,
* __`port`__ (string), default `'443'`,
* __`languagesFilter`__ (string), comma separated list of languages (Twitter codes) to add as filter to the request default `''`

If set `proxy` is a hash which must contain:

* __`host`__ (string), the host of your proxy
* __`port`__ (string), the port of your proxy

#### connect () 
Actually connects to Twitter API, if you save the tweets in the listener of `newtweet` event, the database must be ready and connected before calling connect().

#### disconnect () 
Disconnect from Twitter API

## Licence
MIT