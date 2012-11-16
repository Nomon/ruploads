/**
  * Module dependencies
  */
var serializer = require('serializer');

/**
 * Securely encrypts/decrypts information to be appended to upload_url instead of using server side storage.
 *
 * @type {Function}
 */
var Bearer = module.exports = function(options) {
  if(!options || !options.encrypt_key || !options.validate_key) {
    throw new Error("Bearer type storage requires encrypt_key and validate_key");
  }
  this.serializer = serializer.createSecureSerializer(options.encrypt_key, options.validate_key);
};

Bearer.prototype.create = function(upload, callback) {
  var data = {id:upload.data.id,extra:upload.data.extra};
  console.log("Bearer serializing ",data);
  var token = this.serializer.stringify(data);
  return callback(null, token);
};

Bearer.prototype.load =  function(id, callback) {
  var data = this.serializer.parse(id);
  return callback(null, data);
};

