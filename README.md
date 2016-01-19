# itembase-document-stream [![Build Status](https://travis-ci.org/debitoor/itembase-document-stream.svg)](https://travis-ci.org/debitoor/itembase-document-stream)

Stream itembase documents. Handles pagination and refreshing the access token if necessary.

	npm install itembase-document-stream

## Usage

As a minimum the constructor requires the resource URL and a valid access token.

```javascript
var itembase = require('itembase-document-stream');
var JSONStream = require('JSONStream');

itembase('/v1/users/:user_id/transactions', 'access_token')
	.pipe(JSONStream.stringify())
	.pipe(process.stdout);
```

It's also possible to pass more complex options.

```javascript
var tokens = {
	access_token: 'access_token',
	refresh_token: 'refresh_token'
};

var options = {
	client: { id: 'client_id', secret: 'client_secret' },
	urls: { api: 'http://sandbox.api.itembase.io', accounts: 'http://sandbox.accounts.itembase.io' },
	query: { document_limit: 10 }
};

var stream = itembase('/v1/users/:user_id/transactions', tokens, options);

stream.on('tokens', function(tokens) {
	// Tokens have been refreshed
	console.log(tokens);
});

stream.on('data', function(data) {
	console.log(data);
});
```

The `client` option, together with the `refresh_token`, is necessary to be able to refresh the access token if it expires. Otherwise an `error` event is emitted.

It's also possible to override the base URLs in the options map, and pass additional query parameters to the API request.

Additionally a `start` event is emitted when the first request is performed. It contains, among other things, total number of documents to expect.

## License

[MIT](http://opensource.org/licenses/MIT)
