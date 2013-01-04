var DiffIssue = require('./diff_issue');

var DiffParser = function (issues) {
  this.issues = issues;
}

DiffParser.prototype.parseLine = function (line) {
  var noDiff = new RegExp(/^[-+]{1,1}[^-+]{1,1}/);
  // get rid of the lines that dont have a - or a +
  if (!noDiff.exec(line))
    return null
  // try to match the strings in issues and have () and :
  var match = new RegExp("("+this.issues.join('|')+")\\s\(.*\)\:");
  var lineMatch = match.exec(line);
  if (!lineMatch)
    return null

  // get the issue type
  var issueType = lineMatch[1];
  // get the issue name
  var issueName = (new RegExp(/\(.*?[@\)]/).exec(line))[0].slice(1, -1);
  // get the assignee
  var assignee = null;
  if (line.indexOf('@') >= 0)
    assignee = (new RegExp(/@.*\)/).exec(line))[0].slice(1, -1);
  // get the comment
  var commentMatch = line.match(/\)\s*\:/);
  var comment = line.substring(commentMatch.index + commentMatch[0].length);

  if (!issueType || !issueName || !comment)
    return null

  return new DiffIssue({ 
    label: issueType, 
    title: issueName, 
    assigned: assignee, 
    comment: comment,
    type: noDiff.exec(line)[0][0] == '+'? 'opened': 'closed'
  });
}

DiffParser.prototype.parseLines = function (input) {
  var that = this;
  var parsedIssues = [];
  input = input.split('\n');

  input.forEach(function (line, index) {
    var parsedLine = that.parseLine(line);
    if (parsedLine) {
      // check for the opposite opened/closed
      var filtered = null;
      // if there has been an opposing edit, 
      // remove it and make this an edit
      if (parsedLine.type == 'opened') {
        filtered = issueFilter(parsedIssues, parsedLine, 'closed');
      } else {
        filtered = issueFilter(parsedIssues, parsedLine, 'opened');
      }
      
      if (filtered.removed) {
        parsedIssues = filtered.array;
        parsedLine.type = 'edit';
      }

      parsedIssues.push(parsedLine);
    }
  });

  function issueFilter(array, parsedItem, type) {
    var removedOne = false;
    return { array: array.filter(function (parsedIssue){
      if (parsedIssue.title != parsedItem.title && 
        parsedIssue.type != type || removedOne) {
        return parsedIssue;
      } else {
        removedOne = true;
      }
    }), removed: removedOne };
  }

  return parsedIssues;
}

module.exports = DiffParser;
