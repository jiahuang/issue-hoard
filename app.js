
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
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.use(express.session({
  secret: process.env.SECRET
}));

// Has to go after express.session
app.use(app.router);

var github = rem.connect('github.com', 3.0).configure({
  key: process.env.GH_KEY,
  secret: process.env.GH_SECRET
});

var oauth = rem.oauth(github, "http://"+process.env.HOST_URL+"/oauth/callback/");

// The oauth middleware intercepts the callback url that we set when we
// created the oauth middleware.
app.use(oauth.middleware(function (req, res, next) {
  console.log("User is now authenticated.");

  var user = oauth.session(req);
  user('user').get(function (err, json) {

    req.session.userinfo = json;
    console.log(req.session['github.com:oauthAccessToken']);
    cols.users.update({
      user: req.session.userinfo.login
    }, {
      user: req.session.userinfo.login,
      token: req.session['github.com:oauthAccessToken'],
      update_time: new Date()
    }, {
      upsert: true
    }, function (err, docs) {
      if (err) 
        console.log("Error inserting user into db", req.session.userinfo);

      return res.redirect('/');
    });

  });
}));

app.get('/', function (req, res) {

  var user = oauth.session(req);
  if (!user) {
    return res.send('who are you? <a href="/login/">Better login buddy</a>', 404);
  }

  // get a list of all the public repos
  // user('users', req.session.userinfo.login, 'repos').get(function (err, repos) { 
  //   // console.log(repos);
  //   repos.forEach(function (repo, index) {
  //     console.log(repo.name);
  //     if (repo.name == 'github-todo') { // just for testing
  //       user('repos', 'jiahuang', repo.name, 'hooks').post({
  //         name: "web",
  //         active: "true",
  //         events: ["push"],
  //         config: {
  //           url: "http://peaceful-everglades-2301.herokuapp.com/users/jiahuang/"+repo.name+"/push",
  //           content_type: "json"
  //         }
  //       }, function (err, json) {
  //         if (err) return console.error('Error creating push webhook:', err, json);
  //         console.log(json);
  //       });
  //     }
  //   });

    return res.send('Hi there ' + req.session.userinfo.login, 200);

  // });
});

app.get('/login', function (req, res) {
  oauth.startSession(req, {
    scope: ['public_repo']
  }, function (url) {
    console.log(url);
    res.redirect(url);
  });
});

app.post('/users/:user/:repo/push', function (req, res) {
  // get the commit diff

  // check the commit diff for ISSUES

  // for each issue found
  // if the issue already exists, create another comment

  // if it's new, create it and assign it to someone

  // if it's deleted, close the issue
  console.log(req.params.user, req.params.repo, req.body);
});

var mongodb, cols = {};

function setupMongo(next) {
  mongo.connect(process.env.MONGOLAB_URI, {}, function (error, db) {
    mongodb = db;
    if (error) {
      console.error('Error connecting to mongo:', error);
      process.exit(1);
    }
    console.log("Connected to Mongo:", process.env.MONGOLAB_URI);

    mongodb.on("error", function (error) {
      console.log("Error connecting to MongoLab");
    });

    cols.users = new mongo.Collection(mongodb, 'users');

    next();
  });
}

setupMongo(function () {
  // Start server.
  var port = parseInt(process.env.PORT || 3000);
  app.listen(port);
  console.log('Server listening on port', port);
});