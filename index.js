var urlJoin = require('url-join');
var appendQuery = require('append-query');
var itembase = require('itembase');
var extend = require('xtend');
var from = require('from2');

var config = require('./default.config');

var DEFAULT_DOCUMENT_LIMIT = 50;

var validStatusCode = function(response, callback) {
	var status = response.statusCode;
	var valid = (/2\d\d/).test(status);

	if(!valid) {
		var err = new Error('Non 2xx status code: ' + status);
		err.statusCode = response.statusCode;
		err.headers = response.headers;
		err.body = response.body;
		callback(err);
	}

	return valid;
};

var toISOString = function(date) {
	return (typeof date === 'string') ? date : date.toISOString();
};

module.exports = function(url, tokens, options) {
	if(typeof url === 'object') {
		options = url;
		url = options.url;
		tokens = options.tokens;
	}
	if(typeof tokens === 'string') {
		tokens = { access_token: tokens };
	}

	options = options || {};

	var urls = extend(config, options.urls);
	var client = options.client;
	var query = options.query;

	var canRefresh = client && tokens.refresh_token;
	var apiUrl = /https?:/.test(url) ? url : urlJoin(urls.api, url);
	var tokenUrl;

	if(canRefresh) {
		tokenUrl = urlJoin(urls.accounts, '/oauth/v2/token');
		tokenUrl = appendQuery(tokenUrl, {
			client_id: client.id,
			client_secret: client.secret,
			grant_type: 'refresh_token',
			refresh_token: tokens.refresh_token
		});
	}

	var data;
	var current = 0;
	var offset = 0;
	var now = new Date();

	var stream = from.obj(function(size, next) {
		if(data && current < data.num_documents_returned) {
			return next(null, data.documents[current++]);
		}
		if(data && offset >= data.num_documents_found) {
			return next(null, null);
		}

		request(false, next);
	});

	var refresh = function(callback) {
		itembase().post(tokenUrl, function(err, response, body) {
			if(err) {
				return callback(err);
			}
			if(!validStatusCode(response, callback)) {
				return;
			}

			tokens = body;
			stream.emit('tokens', tokens);
			callback(null, tokens);
		});
	};

	var request = function(refreshed, callback) {
		var resourceQuery = extend({ created_at_to: now, document_limit: DEFAULT_DOCUMENT_LIMIT },
			query || {}, { start_at_document: offset });
		resourceQuery.created_at_to = toISOString(resourceQuery.created_at_to);

		var resourceUrl = appendQuery(apiUrl, resourceQuery);

		itembase(tokens.access_token).get(resourceUrl, function(err, response, body) {
			if(err) {
				return callback(err);
			}
			if(response.statusCode === 401 && canRefresh && !refreshed) {
				return refresh(function(err) {
					if(err) {
						return callback(err);
					}

					request(true, callback);
				});
			}
			if(!validStatusCode(response, callback)) {
				return;
			}

			data = body;
			current = 0;
			offset += body.num_documents_returned;
			callback(null, data.documents[current++]);
		});
	};

	return stream;
};
