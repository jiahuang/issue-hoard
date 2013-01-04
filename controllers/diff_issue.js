var DiffIssue = function (obj) {
  this.label = obj.label.trim();
  this.title = obj.title.trim();
  if (obj.assigned != null)
    this.assigned = obj.assigned.trim();
  this.comment = obj.comment.trim();
  this.status = obj.status.trim();
  return this;
}

DiffIssue.prototype.equals = function (diffObj) {
  try
  {
    if (diffObj.label == this.label && diffObj.title == this.title
      && diffObj.assigned == this.assigned && diffObj.comment == this.comment
      && diffObj.status == this.status)
      return true;
    return false;
  } catch (err) {
    return false;
  }
}

DiffIssue.prototype.similarTo = function (diffObj) {
  try {
    if (diffObj.title == this.title)
      return true;
  } catch (err) {
    return false;
  }
}

DiffIssue.prototype.isOpen = function () {
  return this.status == 'open' ? true : false;
}

DiffIssue.prototype.getAssignee = function (assignee) {
  if (this.assigned != null)
    return this.assigned;
  this.assigned = assignee.trim();
  return this.assigned;
}

module.exports = DiffIssue;