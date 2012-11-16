var fsStorage = require('./storage/fs')
  , gridfsStorage = require('./storage/gridfs')
  , s3Storage = require('./storage/s3')
  , Upload = require('./upload');

var Chunk = module.exports = function(req, upload) {
  var store, options = upload.options;
  if(options.s3) {
    store = new s3Storage(options);
  } else if(options.gridfs) {
    store = new gridfsStorage(options);
  } else {
    store = new fsStorage(options);
  }
  this.req = req;
  this.options = options;
  this.store = store;
  this.upload = upload;
};

Chunk.prototype.save = function(callback) {
  var upload = this.upload, self = this;
  this.store.storeChunk(this.req, upload, function(err, bytesWritten) {
    if(err) {
      return callback(err);
    }
    console.log("Wrote ",bytesWritten);
    upload.data.completed += bytesWritten;
      if(upload.data.completed >= upload.data.size) {
        upload.data.status = "finished";
      }
      upload.store(upload, function(err, upload) {
        return callback(err, upload);
      });

  });
}