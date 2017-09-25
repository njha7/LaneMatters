var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  var text = process.env.APP_NAME;
  console.log(text);
  res.send(text);
});

module.exports = router;
