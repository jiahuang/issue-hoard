var GithubRepo = function (authObj, user, repo) {
  this.authObj = authObj;
  this.user = user;
  this.repo = repo;
}

GithubRepo.prototype.getCommitDiffs = function(commits, next){
  commits.forEach(function (commit, index) {
    // get this entire commit
    // GET /repos/:owner/:repo/git/commits/:sha
    this.authObj('repos', this.user, this.repo, 'git'
      , 'commits', commit.id).get(function (err, curr_commit) {
      if (err)
        return console.log("Failed to get repos/"+this.user+"/"+this.repo+'/git/commits/'+commit.id);
      console.log("repo");

        // get the diff between this commit and its parent
      this.authObj('repos', this.user, this.repo, 'compare', 
        curr_commit.parents[0].sha+'...'+curr_commit.sha).get(function (err, diff) { 
        if (err)
          return console.log("Failed to get repos/"+this.user+"/"+this.repo+'/compare/'+curr_commit.parents[0].sha+'...'+curr_commit.sha);
        
        if (typeof(next) == 'function') next(diff);
      });
    });
  });
}

module.exports = GithubRepo;
