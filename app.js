
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
    // console.log(req.session['github.com:oauthAccessToken']);
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
      console.log("size of the push", body);
    } 

    // console.log(commits);
    if (!commits || commits.length < 1)
      return res.send('Post body did not contain a list of commits. Is this webhook set up correctly?');
    
    var authObj = oauth.restore({oauthAccessToken: userObj.token});
    var github_issue = new GithubIssue(authObj, req.params.user, req.params.repo);
    var github_repo = new GithubRepo(authObj, req.params.user, req.params.repo);
    var all_issues = [];

    // get the list of all issues
    github_issue.getAllIssues(function (curr_issues) {
      // get the list of all commit diffs
      github_repo.getCommitDiffs(function (diff) {
        console.log("repo commit compare: "+curr_commit.parents[0].sha+'...'+curr_commit.sha );

        diff.files.forEach(function (file){
          all_issues = DIFF_PARSER.parseLines(file.patch, all_issues);
        });

        all_issues.forEach(function (diff_issue) {
          var isSimilar = diff_issue.isSimilarTo(curr_issues);
          diff_issue.setAssignee(curr_commit.author.name);

          if (isSimilar.similar) {
            // we have multiple issues with the same name or this isn't changing anything about the issue
            // uhhh no clue which one to edit, let's just skip it
            if (isSimilar.multiple) // diff_issue.equals(similar_issue[0])
              return console.log("donno what to do with this issue", diff_issue);
            
            // otherwise it's a patch/new comment of the current issue
            var curr_labels = similar_issue[0].labels.map(function (label) {
              return label.name;
            });
            similar_issue[0].labels = curr_labels;
            console.log("author", curr_commit.author);

            // if there is a different assignee, label, or status, patch the issue
            if (diff_issue.isIssueUpdate(similar_issue[0])) {
              github_issue.updateIssue(diff_issue.convertToPatchIssue(curr_labels), similar_issue[0]);
            }

            // add it in as a new comment if previous comments dont have the same body
            github_issue.addComment(diff_issue.convertToComment(), similar_issue[0]);

          } else if (diff_issue.isOpen()) {
            github_issue.create_issue(diff_issue.convertToNewIssue());
          } 
        });
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