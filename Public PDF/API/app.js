var express = require('express');
var bodyParser = require('body-parser');
var dotenv = require('dotenv');

dotenv.load();
var app = express();
var path = require('path');
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
var middleware = require('./queries');

app.get('/api/players/:region/:summonername', middleware.playerlookup);
app.get('/api/elo/:region/:summonername', middleware.elo);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

module.exports = app;