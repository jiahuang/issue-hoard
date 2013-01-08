var DiffIssue = function (obj) {
  this.label = obj.label.trim();
  this.title = obj.title.trim();
  if (obj.assignee != null)
    this.assignee = obj.assignee.trim();
  this.body = obj.body.trim();
  this.status = obj.status.trim();
  return this;
}

DiffIssue.prototype.equals = function (diffObj) {
  try
  {
    if (diffObj.label == this.label && diffObj.title == this.title
      && diffObj.assignee == this.assignee && diffObj.body == this.body
      && diffObj.status == this.status)
      return true;
    return false;
  } catch (err) {
    return false;
  }
}

DiffIssue.prototype.isSimilarTo = function (issues) {
  var that = this;

  var similar_issues = issues.filter(function (curr_issue){
    if (that.title.toUpperCase() == new String(curr_issue.title).toUpperCase())
      return curr_issue;
  });

  if (similar_issues.length > 1)
    return {multiple: true, similar: true, issue: null};
  else if (similar_issues.length == 1)
    return {multiple: false, similar: true, issue: similar_issues[0]};

  return { multiple:false, similar: false, issue: null};
}

DiffIssue.prototype.isOpen = function () {
  return this.status == 'open' ? true : false;
}

DiffIssue.prototype.setAssignee = function (assignee) {
  if (this.assignee && this.assignee != 'undefined') return this.assignee;
  this.assignee = assignee.trim();
  return this.assignee;
}

DiffIssue.prototype.isIssueUpdate = function (diffObj) {
  var that = this;
  var filter = diffObj.labels.filter(function (label) {
    if (new String(label.name).toUpperCase() === that.label.toUpperCase()) return label;
  });
  if (filter.length == 0)
    return true;
  if (this.assignee != diffObj.assignee.login ||
    diffObj.state != this.status ) {
    return true;
  }
  return false;
}

DiffIssue.prototype.isSameBody = function (str) {
  var str = new String(str);
  if (this.body.toUpperCase() === str.toUpperCase()) return true;
  return false;
}

DiffIssue.prototype.convertToNewIssue = function () {
  this.labels = [this.label];
  return this;
};

DiffIssue.prototype.convertToComment = function () {
  return { body: this.body};
};

DiffIssue.prototype.convertToPatchIssue = function (curr_issue) {
  var curr_labels = curr_issue.labels.map(function (label){
    return label.name;
  });
  if (curr_labels.indexOf(this.label) == -1) {
    curr_labels.push(this.label);
  }
  return {
    assignee: this.assignee,
    labels: curr_labels, 
    state: this.status
  };
};

module.exports = DiffIssue;