var GithubIssue = function (authObj, user, repo) {
  this.authObj = authObj;
  this.user = user;
  this.repo = repo;
};

GithubIssue.prototype.updateIssue = function (issue, issueNumber) {
  this.authObj('repos', this.user, this.repo, 'issues'
    , issueNumber.toString()).patch( issue
    , function (err, json) {
      if (err)
        return console.log("Failed to patch issue ", issue, err, json);
    console.log("updated an issue", issue, issueNumber);
  });
};

GithubIssue.prototype.createIssue = function (issue, retry) {
  if (!retry)
    retry = false;

  // check to see if this issue already exists
  var that = this;
  console.log("creating issue", issue);
  this.getAllIssues(function(issues) {
    var isSimilar = issue.isSimilarTo(issues);
    if (isSimilar.multiple) return;
    // there's already a issue like this
    if (isSimilar.similar) {
      // if there is a different assignee, label, or status, patch the issue
      if (issue.isIssueUpdate(isSimilar.issue))
        that.updateIssue(issue.convertToPatchIssue(isSimilar.issue), isSimilar.issue.number);

      // add it in as a new comment if previous comments dont have the same body
      if (!issue.isSameBody(isSimilar.issue.body))
        that.addComment(issue.convertToComment(), isSimilar.issue, isSimilar.issue.number);

    } else {
      // create the issue
      console.log("creating this issue", issue);

      that.authObj('repos', that.user, that.repo, 'issues').post(
        issue , function (err, json) {
        if (err == 422 && retry) {
          issue.assignee = null;
          that.createIssue(issue, false);
          return console.log("Failed to create issue, retrying without assignee", issue, err, json);
        } 
        if (err)
          return console.log("Failed to create issue", issue, err, json);
        console.log("created the issue", issue);
      });
    }
  });
};

GithubIssue.prototype.createComment = function (comment, issueNumber) {
  this.authObj('repos', this.user, this.repo, 'issues'
    , issueNumber.toString(), 'comments').post(comment
    , function (err, json) {
      if (err)
        return console.log("Failed to comment on issue ", { body: comment }, err, json);
    console.log("created a comment ", comment, issueNumber);
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

GithubIssue.prototype.addComment = function (comment, issue, issueNumber) {
  var that = this;
  this.getComments(issueNumber, function (comments) {
    var filtered_comments = comments.filter(function (curr_comment) {
      if (comment.body.toUpperCase() === (new String(curr_comment.body).toUpperCase())) 
        return comment;
    });

    if (filtered_comments.length == 0 && (new String(issue.body).toUpperCase()) != comment.body.toUpperCase()) {
      // console.log("adding in another comment ", comment);
      that.createComment(comment, issueNumber);
    }
  });
};

GithubIssue.prototype.getAllIssues = function (next) {
  this.authObj('repos', this.user, this.repo, 'issues').get(function (err, issues) {
    if (err)
      console.log("Failed to get all issues for repo", this.repo, err, json)
    
    if (typeof(next) == 'function') next(issues);
  });
};

module.exports = GithubIssue;
