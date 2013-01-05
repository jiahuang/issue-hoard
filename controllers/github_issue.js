var GithubIssue = function (authObj, user, repo) {
  this.authObj = authObj;
  this.user = user;
  this.repo = repo;
};

GithubIssue.prototype.updateIssue = function (issue, issueNumber) {
  console.log("patching this issue", issue);
  this.authObj('repos', this.user, this.repo, 'issues'
    , issueNumber.toString()).patch( issue
    , function (err, json) {
      if (err)
        return console.log("Failed to patch issue ", issue, err, json);
  });
};

GithubIssue.prototype.createIssue = function (issue) {
  console.log("creating this issue", issue);
  this.authObj('repos', this.user, this.repo, 'issues').post(
    issue , function (err, json) {
      if (err)
        return console.log("Failed to create issue ", issue, err, json);
  });
};

GithubIssue.prototype.createComment = function (comment, issueNumber) {
  this.authObj('repos', this.user, this.repo, 'issues'
    , issueNumber.toString(), 'comments').post(comment
    , function (err, json) {
      if (err)
        return console.log("Failed to comment on issue ", { body: comment }, err, json);
  });
};

GithubIssue.prototype.getComments = function (issueNumber, next) {
  this.authObj('repos', this.user, this.repo, 'issues'
    , issueNumber.toString(), 'comments').get(function (err, comments) {
    if (err)
      return console.log("Failed to get comments", err, comments);
    if (typeof(next) == 'function') next(comments);
  });
};

GithubIssue.prototype.addComment = function (comment, issueNumber) {
  this.getComments(issueNumber, function (comments) {
    var filtered_comments = comments.filter(function (curr_comment) {
      if (comment.body.toUpperCase() === (new String(curr_comment.body).toUpperCase())) 
        return comment;
    });

    if (filtered_comments.length == 0) {
      console.log("adding in another comment", { body: diff_issue.body });
      this.createComment(comment, issueNumber);
    }
  });
};

GithubIssue.prototype.getAllIssues = function (next) {
  this.authObj('repos', this.user, this.repo, 'issues').get(function (err, issues) {
    if (typeof(next) == 'function') next(issues);
  });
};

module.exports = GithubIssue;