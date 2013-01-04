
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
  , DIFF_PARSER = require('./controllers/diff_parser');

var DIFF_PARSER = new DIFF_PARSER(ISSUES);
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

// TODO (clean up code @tcr): testing this updater 
app.post('/users/:user/:repo/push', function (req, res) {
  // find that user's oauth token
  cols.users.findOne({
    user: req.params.user
  }, function (err, userObj) {
    if (err)
      return res.send('User '+req.params.user+' is not authenticated with this service.');
    
    var commits = req.body.commits; 
    // console.log(commits);
    if (!commits || commits.length < 1)
      return res.send('Post body did not contain a list of commits. Is this webhook set up correctly?');
    
    var authObj = oauth.restore({oauthAccessToken: userObj.token});
    var all_issues = [];
    // get the list of all issues
    authObj('repos', req.params.user, req.params.repo, 
      'issues').get(function (err, curr_issues) {

      // var lastCommit = commits.length;
      commits.forEach(function (commit, index) {
        // console.log('commit index', index, lastCommit);
        // if (index == lastCommit -1)
          // res.send('Made the following issue updates to '+
            // req.params.user+"'s "+req.params.repo+' repo', all_issues);
        
        // get this entire commit
        // GET /repos/:owner/:repo/git/commits/:sha
        authObj('repos', req.params.user, req.params.repo, 'git'
          , 'commits', commit.id).get(function (err, curr_commit) {
            // get the diff between this commit and its parent
          authObj('repos', req.params.user, req.params.repo, 'compare', 
            curr_commit.parents[0].sha+'...'+curr_commit.sha).get(function (err, diff) { 
            // console.log("diff", json.diff_url);
            // console.log("diff files", diff.files);
            diff.files.forEach(function (file){
              var diff_issues = DIFF_PARSER.parseLines(file.patch);
              console.log("issues", diff_issues);
              diff_issues.forEach(function (diff_issue) {
                var similar_issue = curr_issues.filter(function (curr_issue){
                  if (curr_issue.similarTo(similar_issue))
                    return curr_issue;
                });
                if (similar_issue.length > 0) {
                  // we have multiple issues with the same name or this isn't changing anything about the issue
                  // uhhh no clue which one to edit, let's just skip it
                  if (similar_issue.length > 1 || similar_issue[0].equals(diff_issue))
                    return;
                  
                  // otherwise it's a patch of the current issue
                  var curr_labels = similar_issue[0].labels.map(function (label) {
                    return label.name;
                  });
                  if (curr_labels.indexOf(diff_issue.label) == -1) {
                    curr_labels.push(diff_issue.label);
                  }
                  var patch_issue = {
                      title: diff_issue.title, 
                      body: diff_issue.comment,
                      assignee: diff_issue.getAssignee(curr_commit.author.name),
                      status: diff_issue.status,
                      labels: curr_labels
                    };

                  authObj('repos', req.params.user, req.params.repo, 'issues'
                    , similar_issue[0].number).patch( patch_issue
                    , function (err, json) {
                      if (err)
                        return console.log("Failed to patch issue ", patch_issue, err);
                      
                      // if (!err)
                        // all_issues.push(patch_issue)
                  });
                } else if (diff_issue.isOpen()) {
                  // we're creating a new issue
                  var create_issue = {
                    title: diff_issue.title,
                    body: diff_issue.comment,
                    assignee: diff_issue.getAssignee(curr_commit.author.name),
                    labels: [diff_issue.label]
                  };

                  authObj('repos', req.params.user, req.params.repo, 'issues').post(
                    create_issue , function (err, json) {
                      if (err)
                        return console.log("Failed to create issue ", create_issue, err, json);
                      // if (!err)
                        // all_issues.push(create_issue);
                  });
                }
              });
            });
          });
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