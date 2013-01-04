var DiffIssue = function (obj) {
  this.label = obj.label;
  this.title = obj.title;
  this.assigned = obj.assigned;
  this.comment = obj.comment;
  this.type = obj.type;
  return this;
}

DiffIssue.prototype.equals = function (diffObj) {
  try
  {
    if (diffObj.label == this.label && diffObj.title == this.title
      && diffObj.assigned == this.assigned && diffObj.comment == this.comment
      && diffObj.type == this.type)
      return true;
    return false;
  } catch (err) {
    return false;
  }
}

module.exports = DiffIssue;