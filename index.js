/*jslint node: true */
'use strict';

var https = require('https'),
    OAuth = require('oauth').OAuth,
    EventEmitter = require('events').EventEmitter,
    util = require('util');

function TwitterStreamClient(options, proxy) {
    this.config = {};
    this.twitterKeepaliveTimeout = null;
    this.retryConnectionTimeout = null;
    this.retryConnectionDelay = 60000;
    this.request = null;
    this.missedTweetsTotal = 0;

    EventEmitter.call(this);

    if (undefined !== options && undefined !== options.OAuth &&
        options.OAuth.consumerKey !== null && options.OAuth.consumerSecret !== null &&
        options.keywords !== null && options.accessToken !== null &&
        options.accessTokenSecret !== null) {
        this.config = {
            twitter: {
                OAuth: {
                    tokenRequestUrl: options.OAuth.tokenRequestUrl ||  'https://twitter.com/oauth/request_token',
                    tokenAccessUrl: options.OAuth.tokenAccessUrl ||  'https://twitter.com/oauth/access_token',
                    consumerKey: options.OAuth.consumerKey ||  null,
                    consumerSecret: options.OAuth.consumerSecret ||  null,
                    version: options.OAuth.version ||  '1.0A',
                    authorizeCallback: options.OAuth.authorizeCallback ||  null,
                    signatureMethod: options.OAuth.signatureMethod ||  'HMAC-SHA1'
                },
                keepAliveTime: options.keepAliveTime ||  64000,
                trackRequest: options.trackRequest ||  '/1.1/statuses/filter.json?stall_warnings=true&track',
                keywords: options.keywords,
                host: options.host ||  'stream.twitter.com',
                port: options.port ||  '443',
                accessToken: options.accessToken,
                accessTokenSecret: options.accessTokenSecret
            },
            proxy: proxy ||  false
        };
        if (options.languagesFilter) {
            this.config.twitter.trackRequest += '&languages=' + options.languagesFilter;
        }
    } else {
        console.log(this.config);
        throw 'Twitter Stream Client config elements missing';
    }
}
util.inherits(TwitterStreamClient, EventEmitter);

// Close connection to Twitter Stream API
TwitterStreamClient.prototype.disconnect = function() {
    clearTimeout(this.twitterKeepaliveTimeout);
    if (this.request) {
        this.request.abort();
    }

    console.log('disconnected from Twitter API');
};

TwitterStreamClient.prototype.twitterDownAlert = function() {
    console.error('Twitter seems to be down');
    this.emit('twitterdown');
    this.disconnect();
    this.connect();
};

TwitterStreamClient.prototype.restartTwitterKeepAlive = function() {
    clearTimeout(this.twitterKeepaliveTimeout);
    this.twitterKeepaliveTimeout = setTimeout(this.twitterDownAlert.bind(this), this.config.twitter.keepAliveTime);
};

TwitterStreamClient.prototype.openTwitterSocket = function(socket) {
    var oauth = new OAuth(
            this.config.twitter.OAuth.tokenRequestUrl,
            this.config.twitter.OAuth.tokenAccessUrl,
            this.config.twitter.OAuth.consumerKey,
            this.config.twitter.OAuth.consumerSecret,
            this.config.twitter.OAuth.version,
            this.config.twitter.OAuth.authorizeCallback,
            this.config.twitter.OAuth.signatureMethod
        ),
        requestPath = this.config.twitter.trackRequest + '=' + encodeURIComponent(this.config.twitter.keywords),
        url = 'https://' + this.config.twitter.host + ':' + this.config.twitter.port + requestPath,
        options = {
            path: requestPath,
            host: this.config.twitter.host,
            headers: {
                'Authorization': oauth.authHeader(url, this.config.twitter.accessToken, this.config.twitter.accessTokenSecret, 'GET')
            },
            agent: false
        };

    if (socket !== undefined) {
        socket.setKeepAlive(true);
        options.socket = socket;
    }

    this.request = https.get(options, function(response) {
        var buffer = '',
            tweetSeparator = '\r\n',
            index,
            tweet;

        if (response.statusCode === 200) {
            clearTimeout(this.retryConnectionTimeout);
            console.log('Connected to Twitter streaming API');
            this.emit('connected');
            this.restartTwitterKeepAlive();

            response.on('data', function(chunk) {
                this.restartTwitterKeepAlive();
                buffer += chunk.toString('utf8');
                index = buffer.indexOf(tweetSeparator);

                while (index > -1) {
                    tweet = buffer.slice(0, index);

                    if (tweet.length > 0) {
                        try {
                            tweet = JSON.parse(tweet);

                            if (tweet !== undefined && tweet.user !== undefined && tweet.text !== undefined) {
                                this.emit('newtweet', tweet);
                            } else {
                                this.emit('missedtweets', tweet.limit.track - this.missedTweetsTotal);
                                this.missedTweetsTotal = tweet.limit.track;
                            }
                        } catch (error) {
                            console.log(error)
                            this.connectionError(' unexpected data from Twitter, buffer is: ' + buffer);
                        }
                    }

                    buffer = buffer.slice(index + tweetSeparator.length);
                    index = buffer.indexOf(tweetSeparator);
                }
            }.bind(this));

        } else {
            this.connectionError(response.statusCode);
        }

    }.bind(this));

    this.request.on('error', function(error) {
        this.connectionError(error.code);
    }.bind(this));

    this.request.end();
};

TwitterStreamClient.prototype.connectionError = function(message) {
    console.log('Twitter connection error: ' + message);
    this.emit('error', message);

    this.retryConnectionDelay = this.retryConnectionDelay * 2;
    console.log('Will try to reconnect in ' + this.retryConnectionDelay / 1000 + 's')
    clearTimeout(this.retryConnectionTimeout);
    this.retryConnectionTimeout = setTimeout(function() {
        this.disconnect();
        this.connect();
    }.bind(this), this.retryConnectionDelay);
};

TwitterStreamClient.prototype.connect = function() {
    if (!this.config.proxy) {
        console.log('connect to Twitter Stream API no proxy');
        this.openTwitterSocket();
    } else {
        var proxyRequest = null;
        console.log('connect to Twitter Stream API through proxy');
        proxyRequest = require('http').request({
            host: this.config.proxy.host,
            port: this.config.proxy.port,
            method: 'CONNECT',
            path: this.config.twitter.host + ':' + this.config.twitter.port
        });

        proxyRequest.on('error', function(e) {
            this.connectionError('Cannot connect to proxy : ' + e.code);
        }.bind(this));

        proxyRequest.on('connect', function(response, proxySocket) {
            this.openTwitterSocket(proxySocket);
        }.bind(this)).end();
    }
};

module.exports = TwitterStreamClient;