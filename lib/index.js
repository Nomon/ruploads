var Chunk = require('./chunk')
  , Upload = require('./upload');








var RangedUploader  = module.exports = function(options) {
  this.options = options;
};

/**
 * Creates a new resumable upload
 *
 * @param info
 * @param options
 *
 * Options:
 * `redis`: a redis client, used to store the info of the upload (optional)
 */
RangedUploader.prototype.create = function(info, options, callback) {
  if(typeof options == "function") {
    callback = options;
    options = this.options;
  }
  var upload = new Upload(info);
  upload.save(callback);
};

/**
 * Resumes an upload
 *
 * @param info
 * @param options
 *
 * Options:
 * `redis`: a redis client, used to store the info of the upload (optional)
 */
RangedUploader.prototype.resume = function(info, options, callback) {
  if(typeof options == "function") {
    callback = options;
    options = this.options;
  }
  var upload = new Upload(options);
  upload.info(info, callback);
};

/**
 * Gets the state of the upload and its already uploaded chunks.
 *
 * @param id
 * @param options
 * @param callback
 */
RangedUploader.prototype.info = function(id, options, callback) {
  if(typeof options == "function") {
    callback = options;
    options = this.options;
  }
  var upload = new Upload(options);
  upload.info(info, callback);
};

RangedUploader.route = require('./route');

