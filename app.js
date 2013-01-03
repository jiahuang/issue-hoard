
/**
 * Module dependencies.
 */

var ISSUES = require('./issues')
  , express = require('express')
  , http = require('http')
  , path = require('path')
  , oauth = require("oauth")
  , mongo = require('mongodb'), ObjectID = mongo.ObjectID
  , rem = require('rem')
  , https = require('https');


var app = express();

app.configure(function(){
  app.use(express.cookieParser());
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
    domain: process.env.HOST_URL
  }
}));

var github = rem.load('github', 3, {
  key: process.env.GH_KEY,
  secret: process.env.GH_SECRET
});

oauth = rem.oauth(github, "http://"+process.env.HOST_URL+"/oauth/callback/");

// The oauth middleware intercepts the callback url that we set when we
// created the oauth middleware.
app.use(oauth.middleware(function (req, res, next) {
  console.log("User is now authenticated.");
  req.user('user').get(function (err, json) {

    req.session.userinfo = json;
    console.log(req.session.oauthAccessToken);

    res.redirect('/');
  });
}));

app.get('/', function(req, res) {
  console.log(req);

  var user = null;
  github('users', req.session).get(function (err, json) {
    if (err || !json) {
      return res.send("well that didn't work", 404);
    }
    // console.log("got user", json);
    user = oauth.session(req);
    if (!user)
    return res.send('who are you?', 200);

    // get a list of all the public repos
    user('users', 'jiahuang', 'repos').get(function (err, repos) { 
      // console.log(repos);
      // repos.forEach(function (index, repo) {
      //   console.log(repo.name);
      //   repo.name;
      //   user('repos', 'jiahuang', repo.name).post({
      //     name: "web",
      //     active: "true",
      //     events: ["push"],
      //     config: {
      //       url: "http://peaceful-everglades-2301.herokuapp.com/jiahuang/"+repo.name+"/push",
      //       content_type: "json"
      //     }
      //   }, function (err, json) {
      //     if (err) return console.error('Error creating push webhook:', err);
      //     console.log(json);
      //   });
      // });

      return res.send('Hi there', 200);

    }); 

  });  
});

app.get('/login', function (req, res) {
  oauth.startSession(req, {
    scope: ['']
  }, function (url) {
    res.redirect(url);
  });
});

app.post('/push', function (req, res) {

});

// Start server.
var port = parseInt(process.env.PORT || 3000);
app.listen(port);
console.log('Server listening on port', port);
