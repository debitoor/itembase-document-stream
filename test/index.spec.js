var qs = require('querystring');
var nock = require('nock');
var concat = require('concat-stream');
var pump = require('pump');

var itembase = require('../');

var fixtures = require('./fixtures');
var config = require('../default.config');

var now = (new Date()).toISOString();

describe('itembase document stream', function() {
	describe('get all buyers', function() {
		var apiServer, result, options;

		before(function() {
			apiServer = nock(config.api, {
					reqheaders: {
						Authorization: 'Bearer test_access_token'
					}
				})
				.get('/v1/users/test_user_id/buyers?' + qs.stringify({
					created_at_to: now,
					document_limit: 2,
					start_at_document: 0
				}))
				.reply(200, {
					num_documents_found: 3,
					num_documents_returned: 2,
					documents: fixtures.buyers.slice(0, 2)
				})
				.get('/v1/users/test_user_id/buyers?' + qs.stringify({
					created_at_to: now,
					document_limit: 2,
					start_at_document: 2
				}))
				.reply(200, {
					num_documents_found: 3,
					num_documents_returned: 1,
					documents: fixtures.buyers.slice(2, 3)
				});
		});

		before(function(done) {
			var stream = itembase('/v1/users/test_user_id/buyers', 'test_access_token', {
				query: { created_at_to: now, document_limit: 2 }
			});
			var sink = concat({ encoding: 'object' }, function(data) {
				result = data;
			});

			stream.once('start', function(result) {
				options = result;
			});

			pump(stream, sink, done);
		});

		it('should return all buyers', function() {
			expect(result).to.deep.equal(fixtures.buyers);
		});

		it('should emit start event', function() {
			expect(options).to.deep.equal({
				total: 3,
				limit: 2
			});
		});

		it('should have called all mocks', function() {
			expect(apiServer.isDone()).to.be.ok;
		});
	});

	describe('refresh token', function() {
		var expiredApiServer, apiServer, accountsServer, result, tokens;

		before(function() {
			expiredApiServer = nock(config.api, {
					reqheaders: {
						Authorization: 'Bearer test_access_token'
					}
				})
				.get('/v1/users/test_user_id/buyers?' + qs.stringify({
					created_at_to: now,
					document_limit: 50,
					start_at_document: 0
				}))
				.reply(401);

			apiServer = nock(config.api, {
					reqheaders: {
						Authorization: 'Bearer test_access_token_new'
					}
				})
				.get('/v1/users/test_user_id/buyers?' + qs.stringify({
					created_at_to: now,
					document_limit: 50,
					start_at_document: 0
				}))
				.reply(200, {
					num_documents_found: 1,
					num_documents_returned: 1,
					documents: fixtures.buyers.slice(0, 1)
				});

			accountsServer = nock(config.accounts)
				.post('/oauth/v2/token?' + qs.stringify({
					client_id: 'test_client_id',
					client_secret: 'test_client_secret',
					grant_type: 'refresh_token',
					refresh_token: 'test_refresh_token'
				}))
				.reply(200, {
					access_token: 'test_access_token_new',
					refresh_token: 'test_refresh_token_new'
				});
		});

		before(function(done) {
			var stream = itembase(
				'/v1/users/test_user_id/buyers',
				{
					access_token: 'test_access_token',
					refresh_token: 'test_refresh_token'
				}, {
					query: { created_at_to: now },
					client: {
						id: 'test_client_id',
						secret: 'test_client_secret'
					}
				});

			var sink = concat({ encoding: 'object' }, function(data) {
				result = data;
			});

			stream.once('tokens', function(result) {
				tokens = result;
			});

			pump(stream, sink, done);
		});

		it('should return all buyers', function() {
			expect(result).to.deep.equal(fixtures.buyers.slice(0, 1));
		});

		it('should emit new tokens', function() {
			expect(tokens).to.deep.equal({
				access_token: 'test_access_token_new',
				refresh_token: 'test_refresh_token_new'
			});
		});

		it('should have called all expired api server mocks', function() {
			expect(expiredApiServer.isDone()).to.be.ok;
		});

		it('should have called all api server mocks', function() {
			expect(apiServer.isDone()).to.be.ok;
		});

		it('should have called all accounts server mocks', function() {
			expect(accountsServer.isDone()).to.be.ok;
		});
	});
});
