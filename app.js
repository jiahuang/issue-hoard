
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
  , https = require('https')
  , DIFF_PARSER = require('./controllers/diff_parser')
  , GithubIssue = require('./controllers/github_issue')
  , GithubRepo = require('./controllers/github_repo');

var app = express();
var DIFF_PARSER = new DIFF_PARSER(ISSUES);

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

app.use(express.session({ secret: process.env.SECRET}));

// Has to go after express.session
app.use(app.router);

var github = rem.connect('github.com', 3.0).configure({
  key: process.env.GH_KEY,
  secret: process.env.GH_SECRET
});
var oauth = rem.oauth(github, process.env.HOST_URL+"/oauth/callback/");

// The oauth middleware intercepts the callback url that we set when we
// created the oauth middleware.
app.use(oauth.middleware(function (req, res, next) {
  console.log("User is now authenticated.");

  var user = oauth.session(req);
  user('user').get(function (err, json) {

    req.session.userinfo = json;
    cols.users.findAndModify({
      user: req.session.userinfo.login
    }, [['_id','asc']], { 
      $set : {
        user: req.session.userinfo.login,
        token: req.session['github.com:oauthAccessToken'],
        update_time: new Date()
      }
    }, {
      upsert: true,
      new: true
    }, function (err, user) {
      if (err) 
        return console.log("Error upserting user into db", err);
      req.session.userinfo = user;
      return res.redirect('/users/'+req.session.userinfo.user);
    });
  });
}));

app.get('/', function (req, res) {

  var authObj = oauth.session(req);
  if (!authObj) {
    return res.render("index.ejs", {user: null});
    // return res.send('who are you? <a href="/login/">Better login buddy</a>', 404);
  }
  return res.render("index.ejs", {user: req.session.userinfo.user});
  // return res.send('Hi there ' + req.session.userinfo.user, 200);
});

app.get('/users/:user', function (req, res) {
  var user = req.session.userinfo.user;
  var authObj = oauth.session(req);
  if (!authObj)
    return res.render("index.ejs", {user: null})

  var github_repo = new GithubRepo(authObj, user);
  github_repo.getPublicRepos(function (repos) {
    return res.render("user.ejs", {user: user, repos: repos});
  });
});

// create webhook for repos
app.post('/hooks/:user/:repo', function (req, res) {
  var authObj = oauth.session(req);
  
  if (!authObj || req.session.userinfo.user != req.params.user)
    res.send("Unauthorized", 401);

  var github_repo = new GithubRepo(authObj, req.session.userinfo.user);

  github_repo.createWebHook(req.params.repo, process.env.HOST_URL, function (err, json) {
    // add it to our db
    cols.users.update({
      user: req.session.userinfo.user
    }, {
      $push : {repos: {name: req.params.repo, added: new Date()}}
    }, function (db_err) {
      if (err || db_err)
        return res.send("Error", err, db_err, 500);

      return res.send("Added hook for "+req.params.repo, 200);
    });
  });
});

// delete webhook for repo
app.delete('/hooks/:user/:repo', function(req, res) {
  var authObj = oauth.session(req);
  
  if (!authObj || req.session.userinfo.user != req.params.user)
    res.send("Unauthorized", 401);

  var github_repo = new GithubRepo(authObj, req.session.userinfo.user);

  github_repo.deleteWebHook(req.params.repo, process.env.HOST_URL, function (err, json) {
    // remove it from our db
    cols.users.update({
      user: req.session.userinfo.user
    }, {
      $push : {repos: {name: req.params.repo, added: new Date()}}
    }, function (db_err) {
      if (err || db_err)
        return res.send("Error", err, db_err, 500);
      
      return res.send("Deleted hook for "+req.params.repo, 200);
    });
  });
});

app.get('/login', function (req, res) {
  oauth.startSession(req, {
    scope: ['public_repo']
  }, function (url) {
    console.log(url);
    res.redirect(url);
  });
});

app.get('/logout', function (req, res) {
  if (req.session) {
    req.session.userinfo = null;
    req.session.destroy(function() {});
  }
  res.redirect('/');
});

app.post('/users/:user/:repo/push', function (req, res) {
  // find that user's oauth token
  cols.users.findOne({
    user: req.params.user
  }, function (err, userObj) {
    if (err)
      return res.send('User '+req.params.user+' is not authenticated with this service.');

    var commits = req.body.commits;
    if (!commits && req.body.payload != null) {
      // weird github issue? payload is sent as a string
      var body = JSON.parse(req.body.payload);
      commits = body.commits;
    } 

    console.log("got hit");
    if (!commits || commits.length < 1)
      return res.send('Post body did not contain a list of commits. Is this webhook set up correctly?');
    
    var authObj = oauth.restore({oauthAccessToken: userObj.token});
    var github_issue = new GithubIssue(authObj, req.params.user, req.params.repo);
    var github_repo = new GithubRepo(authObj, req.params.user, req.params.repo);
    var all_issues = [];

    // get the list of all issues
    github_issue.getAllIssues(function (curr_issues) {
      // get the list of all commit diffs
      github_repo.getCommitDiffs(commits, function (diff) {
        // console.log("repo commit compare: "+curr_commit.parents[0].sha+'...'+curr_commit.sha );

        diff.files.forEach(function (file){
          all_issues = DIFF_PARSER.parseLines(file.patch, all_issues);
        });
        console.log("all issues", all_issues);
        all_issues.forEach(function (diff_issue, diff_number) {
          // sometimes this messes up due to callback indexes
          if (commits[diff_number])
            diff_issue.setAssignee(commits[diff_number].author.name);
          else
            diff_issue.setAssignee(commits[0].author.name);

          var isSimilar = diff_issue.isSimilarTo(curr_issues);
          // console.log("similar issue", isSimilar);
          if (isSimilar.similar) {
            // we have multiple issues with the same name or this isn't changing anything about the issue
            // uhhh no clue which one to edit, let's just skip it
            if (isSimilar.multiple) // diff_issue.equals(similar_issue[0])
              return console.log("donno what to do with this issue", diff_issue);
            
            // if there is a different assignee, label, or status, patch the issue
            if (diff_issue.isIssueUpdate(isSimilar.issue)) {
              github_issue.updateIssue(diff_issue.convertToPatchIssue(isSimilar.issue), isSimilar.issue.number);
            }

            // add it in as a new comment if previous comments dont have the same body
            github_issue.addComment(diff_issue.convertToComment(), isSimilar.issue, isSimilar.issue.number);

          } else if (diff_issue.isOpen()) {
            github_issue.createIssue(diff_issue.convertToNewIssue());
          }
        });
        
        all_issues = [];
      });
    });
  });
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