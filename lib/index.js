var middleware = require('./middleware')
  , fs = require('fs')
  , path = require('path');



module.exports = function(options) {
  options.directory = options.directory || "/tmp/uploads";
  var up = new RangedUploader(options);
  return middleware(up);
};

var RangedUploader  = function(options) {
  this.options = options;
  if(!fs.existsSync(options.directory)) {
    fs.mkdirSync(options.directory)
    console.log("Directory created");
  }
};


