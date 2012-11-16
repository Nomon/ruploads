/**
 * module dependencies
 */
var fs = require('fs')
  , util = require('util');


var FS = module.exports = function(options) {
  options = options || {};
  this.directory = options.directory || '/tmp';
}

FS.prototype.storeChunk = function(stream, upload, callback) {
  var file, outStream, range;
  range = upload.range;
  console.log("Storing chunk with info",upload.data);
  file = upload.data.id+'_'+range.start+'_'+range.stop+'.chunk';
  var outputStream = fs.createWriteStream(this.directory+'/'+file);
  stream.pipe(outputStream);
  stream.on('end', function() {
    return callback(null, Number(range.stop) - Number(range.start) + 1);
  });
  stream.on('error', function() {
      self.getUploadStatus(upload, function() {
        fs.stat(file, function(err, stats) {
          if(err) {
            return callback(err);
          }
        });
      });
  });
  stream.resume();
};

FS.prototype.storeFile = function(stream, upload, callback) {
  var file, outStream;
  file = info.name;
  var outputStream = fs.createWriteStream(this.directory+'/'+file);
  stream.pipe(outputStream);
  stream.on('end', callback);
  stream.on('error', function() {

  });
};


FS.prototype.getUploadStatus = function(upload, callback) {

};