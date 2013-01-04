var ISSUES = require ('../issues');
var DiffIssue = require ('../controllers/diff_issue'),
  DiffParser = require ('../controllers/diff_parser');

var cases = [
  { str: "+#TODO (name @user): comment", 
    res: new DiffIssue({
      label: "TODO",
      title: "name ",
      assigned: "user",
      comment: " comment",
      type: "opened"
  }) },
  { str: "-// TODO (name @user) : comment", 
    res: new DiffIssue({
      label: "TODO",
      title: "name ",
      assigned: "user",
      comment: " comment",
      type: "closed"
  }) },
  { str: "-// TODO (name ): comment\n+//TODO (name @user2): comment 2", 
    res: new DiffIssue({
      label: "TODO",
      title: "name ",
      assigned: "user2",
      comment: " comment 2",
      type: "edit"
  }) }, 
  { str: "// TODO (name @user): comment\n//TODO (name, user2): comment 2", 
    res: null}
];

function diffParserTest(){
  var parser = new DiffParser(ISSUES);

  cases.forEach(function (testCase) {
    var res = parser.parseLines(testCase.str)[0];
    // if (parser.parseLines(testCase.str).length > 1) {
    //   console.log("FAILED! Too long", parser.parseLines(testCase.str));
    // }
    if ((testCase != null && res != null) && !res.equals(testCase.res))
      console.log("FAILED! expected: ", testCase.res, "\ngot: ", res);
  });
}

diffParserTest();
