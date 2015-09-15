var hapi = require('hapi')
var got = require('got')
var fs = require('fs')
var Hapi = require('hapi')
var Boom = require('boom')
var GoodLogger = require('good')
var GoodConsole = require('good-console')
var extend = require('extend-object')
var env = require('./env.json')

var server = new Hapi.Server()
var port = process.env.PORT || 5000

// extend process env with env.json if provided
extend(process.env, env)

server.connection({
  host: '0.0.0.0',
  port: port,
  routes: { cors: true }
})

server.route({
  method: 'GET',
  path: '/{client}/{code}',
  handler: function (req, reply) {
    var code = req.params.code
    var client = req.params.client
    var redirectUri = req.query.redirect_uri
    var state = req.query.state
    var domain = req.query.domain || 'github.com'

    // attempt to look up the secret
    var secret = process.env[client]

    if (!secret) {
      return reply(Boom.notFound('No secret is configured for client ID: \'' + client + '\''))
    }
    var options = {
      body: {
        client_id: client,
        client_secret: secret,
        code: code
      },
      json: true
    }

    // include the optional query params if present
    if (req.query.redirect_uri) {
      options.body.redirect_uri = req.query.redirect_uri
    }
    if (req.query.state) {
      options.body.state = req.query.state
    }

    // try to normalize responses a bit
    got.post('https://' + domain + '/login/oauth/access_token', options, function (err, body, response) {
      if (err) {
        if (err.statusCode === 404) {
          return reply(Boom.create(err.statusCode, 'GitHub could not find client ID: \'' + client + '\''))
        } else {
          return reply(Boom.create(500, err))
        }
      } else {
        if (body.error) {
          return reply(Boom.create(400, body.error_description))
        }
        return reply(body)
      }
    })
  }
})

server.register({
    register: GoodLogger,
    options: {
      reporters: [{
        reporter: GoodConsole,
        events: { log: '*', response: '*' }
      }]
    }
  },
  function (err) {
    if (err) {
      console.error(err)
    }
    else {
      server.start(function () {
        console.info('token server started at ' + server.info.uri)
      })
    }
})
