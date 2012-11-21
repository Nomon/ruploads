var middleware = require('./middleware')
  , fs = require('fs');



module.exports = function(options) {
  options.directory = options.directory || "/tmp";
  var up = new RangedUploader(options);
  return middleware(up);
};

var RangedUploader  = function(options) {
  this.options = options;
};


