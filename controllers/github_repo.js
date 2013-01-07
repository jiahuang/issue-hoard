var GithubRepo = function (authObj, user, repo) {
  this.authObj = authObj;
  this.user = user;
  this.repo = repo;
}

GithubRepo.prototype.getCommitDiffs = function(commits, next){
  var that = this;
  commits.forEach(function (commit, index) {
    // get this entire commit
    // GET /repos/:owner/:repo/git/commits/:sha
    that.authObj('repos', that.user, that.repo, 'git'
      , 'commits', commit.id).get(function (err, curr_commit) {
      if (err)
        return console.log("Failed to get repos/"+that.user+"/"+that.repo+'/git/commits/'+commit.id);
      console.log("repo");

        // get the diff between this commit and its parent
      that.authObj('repos', that.user, that.repo, 'compare', 
        curr_commit.parents[0].sha+'...'+curr_commit.sha).get(function (err, diff) { 
        if (err)
          return console.log("Failed to get repos/"+that.user+"/"+that.repo+'/compare/'+curr_commit.parents[0].sha+'...'+curr_commit.sha);
        
        if (typeof(next) == 'function') next(diff, index);
      });
    });
  });
}

GithubRepo.prototype.getPublicRepos = function (next) {
  this.authObj('users', this.user, 'repos').get(function (err, repos) { 
    if (err)
      return console.log("Failed to get public repos of", err, repos);

    if (typeof(next) == 'function') next(repos);
  });
}

GithubRepo.prototype.createWebHook = function (repoName, host_url, next) {
  // check current webhooks, if it's not already there, create it
  var url = host_url+'/users/'+this.user+'/'+repoName+'/push';
  this.authObj('repos', this.user, repoName, 'hooks').get(
    function (err, hooks){
    var hook_filter = hooks.filter(function (hook) {
      console.log(hook.config.url);
      if (new String(hook.config.url).toUpperCase() == url.toUpperCase())
        return hook.config.url;
    });

    // a webhook already exists, skip
    if (hook_filter.length > 0)
      return console.log("webhook for this repo already exists", repoName);

    console.log("trying to create webhook for ", repoName, url);
    this.authObj('repos', this.user, repoName, 'hooks').post({
      name: "web",
      active: "true",
      events: ["push"],
      config: {
        url: url,
        content_type: "json"
      }
    }, function (err, json) {
      if (typeof(next) != 'function') return;

      if (err) {
        next(err, json);
        return console.error('Error creating push webhook:', err, json);
      }

      if (typeof(next) == 'function') next(false, json);
      console.log("created webhook for this repo", repoName);
    });
  });
}

module.exports = GithubRepo;
