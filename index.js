/*jslint node: true */
"use strict";

var https = require('https'),
    OAuth = require('oauth').OAuth,
    proxyRequest,
    request,
    twitterKeepaliveTimeout = null,
    config;


// Close connection to Twitter Stream API
var disconnectFromTwitter = function () {
    clearTimeout(twitterKeepaliveTimeout);
    if (request !== undefined) {
        request.abort();
    }

    console.log('disconnected from Twitter API');
};

var twitterDownAlert = function () {
    console.error("Twitter seems to be down");
    config.callbacks.onTwitterDown && config.callbacks.onTwitterDown.apply();
};

var restartTwitterKeepAlive = function () {
    clearTimeout(twitterKeepaliveTimeout);
    twitterKeepaliveTimeout = setTimeout(twitterDownAlert, config.twitter.keepAliveTime);
};

function checkAndSaveOptions (options) {
    if(undefined !== options && undefined !== options.twitter && undefined !== options.twitter.OAuth 
        && options.twitter.OAuth.consumerKey !== null && options.twitter.OAuth.consumerSecret !== null
        && options.twitter.keywords !== null &&  options.callbacks.newTweet !== undefined
        && options.twitter.accessToken !== null && options.twitter.accessTokenSecret !== null) {        
        config = {
            twitter: {
                OAuth: {
                    tokenRequestUrl: options.twitter.OAuth.tokenRequestUrl || "https://twitter.com/oauth/request_token",
                    tokenAccessUrl: options.twitter.OAuth.tokenAccessUrl || "https://twitter.com/oauth/access_token",
                    consumerKey: options.twitter.OAuth.consumerKey || null,
                    consumerSecret: options.twitter.OAuth.consumerSecret || null,
                    version: options.twitter.OAuth.version || "1.0A",
                    authorizeCallback: options.twitter.OAuth.authorizeCallback || null,
                    signatureMethod: options.twitter.OAuth.signatureMethod || "HMAC-SHA1"
                },
                keepAliveTime: options.twitter.keepAliveTime || 32000,
                trackRequest: options.twitter.trackRequest || "/1.1/statuses/filter.json?stall_warnings=true&track",
                keywords: options.twitter.keywords,
                host: options.twitter.host || "stream.twitter.com",
                port: options.twitter.port || "443",
                accessToken: options.twitter.accessToken,
                accessTokenSecret: options.twitter.accessTokenSecret
            },
            proxy: options.proxy || false,
            callbacks: options.callbacks,
        };
    } else {
        console.log(config);
        throw "Twitter Stream Client config elements missing";
    }
};

var openTwitterSocket = function (socket) {
    var oauth = new OAuth(
            config.twitter.OAuth.tokenRequestUrl,
            config.twitter.OAuth.tokenAccessUrl,
            config.twitter.OAuth.consumerKey,
            config.twitter.OAuth.consumerSecret,
            config.twitter.OAuth.version,
            config.twitter.OAuth.authorizeCallback,
            config.twitter.OAuth.signatureMethod
        ),
        requestPath = config.twitter.trackRequest + '=' + encodeURIComponent(config.twitter.keywords),
        url = 'https://' + config.twitter.host + ':' + config.twitter.port + requestPath,
        options = {
            path: requestPath,
            host: config.twitter.host,
            headers: {'Authorization': oauth.authHeader(url, config.twitter.accessToken, config.twitter.accessTokenSecret, "GET")},
            agent: false
        };

    if (socket !== undefined) {
        socket.setKeepAlive(true);
        options.socket = socket;
    }

    request = https.get(options, function (response) {
        var data = "",
            tweetSeparator = '\r\n',
            index,
            tweet;
        console.log('Connected to Twitter streaming API');
        config.callbacks.onTwitterConnection && config.callbacks.onTwitterConnection.apply();
        restartTwitterKeepAlive();

        response.on('data', function (chunk) {
            restartTwitterKeepAlive();
            data += chunk.toString('utf8');

            do {
                index = data.indexOf(tweetSeparator);
                tweet = data.slice(0, index);
                data = data.slice(index + tweetSeparator.length);

                if (tweet.length > 0) {
                    try {
                        tweet = JSON.parse(tweet);

                        if (tweet !== undefined && tweet.user !== undefined && tweet.text !== undefined) {
                            config.callbacks.newTweet.apply(null, [tweet]);
                        }
                    } catch (error) {
                        console.log(error.message);
                    }
                }
            } while (index > -1);
        });
    });

    request.on('error', function (error) {
        console.log(error.message);
        config.callbacks.onTwitterError && config.callbacks.onTwitterDown.apply();
        throw "error while connecting to Twitter API: " + error.code;
    });

    request.end();
};

// Listen to hashtags through the twitter streaming API
function connect (options) {
    checkAndSaveOptions(options);
    if (!config.proxy) {
        console.log("connect to Twitter Stream API no proxy");
        openTwitterSocket();
    } else {
        console.log("connect to Twitter Stream API through proxy");
        proxyRequest = require('http').request({
            host: config.proxy.host,
            port: config.proxy.port,
            method: 'CONNECT',
            path: config.twitter.host + ':' + config.twitter.port
        });

        proxyRequest.on('error', function (e) {
            throw "Can't connect to proxy : " + e.code;
        });

        proxyRequest.on('connect', function (response, proxySocket) {
            openTwitterSocket(proxySocket);
        }).end();
    }
};

module.exports = {
    connect: connect,
    disconnect: disconnectFromTwitter
};