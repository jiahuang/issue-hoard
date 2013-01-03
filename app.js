
/**
 * Module dependencies.
 */

var ISSUES = require('./issues')
  , express = require('express')
  // , routes = require('./routes')
  // , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , oauth = require("oauth")
  , mongo = require('mongodb'), ObjectID = mongo.ObjectID
  , rem = require('rem')
  , https = require('https');


var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.use(express.session({
  secret: process.env.SECRET,
  cookie: {
    domain: "peaceful-everglades-2301.herokuapp.com"
  }
}));

// app.get('/', routes.index);
// app.get('/users', user.list);
var github = rem.load('github', 3, {
  key: process.env.GH_KEY,
  secret: process.env.GH_SECRET
});
oauth = rem.oauth(github, "http://peaceful-everglades-2301.herokuapp.com/oauth/callback/");

// The oauth middleware intercepts the callback url that we set when we
// created the oauth middleware.
app.use(oauth.middleware(function (req, res, next) {
  console.log("User is now authenticated.");
  // req.user('user').get(function (err, json) {
  //   req.session.userinfo = json;
  //   res.redirect('/');
  // });
}));

app.get('/', function(req, res) {
  var user = null;

  return res.send('Hi there', 404);
});

app.get('/login', function (req, res) {
  oauth.startSession(req, {
    scope: ['gist']
  }, function (url) {
    res.redirect(url);
  });
});

// Start server.
var port = parseInt(process.env.PORT || 3000);
app.listen(port);
console.log('Server listening on port', port);
