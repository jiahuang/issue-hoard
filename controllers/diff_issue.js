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

DiffIssue.prototype.similarTo = function (diffObj) {
  try {
    if (diffObj.title == this.title) return true;
  } catch (err) {
    return false;
  }
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
  if (this.assignee != diffObj.assignee.login || 
    diffObj.labels.indexOf(this.label) == -1 || 
    diffObj.state != this.status ) {
    // console.log("issue update from", this.label, this.status, this.assignee, diffObj.labels, diffObj.state, diffObj.assignee.login);
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
  return {
    title: this.title,
    body: this.body,
    assignee: this.assignee,
    labels: [this.label]
  };
};

DiffIssue.prototype.convertToComment = function () {
  return { body: this.body};
};

DiffIssue.prototype.convertToPatchIssue = function (curr_labels) {
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