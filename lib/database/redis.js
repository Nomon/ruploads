/**
 * Module dependencies
 */
var redis = require('redis');

var Redis = module.exports = function(options) {
  if(!options || !options.port || !options.host) {
    throw new Error("Redis type storage requires redis_port and redis_host");
  }
  this.client = redis.createClient(options.port, options.host);
  if(options.database) {
    this.client.select(options.database);
  }
};

Redis.prototype.create = function(upload, callback) {
  var data = {id:upload.data.id,extra:upload.data.extra};
  this.client.hmset('h:Upload:'+data.id, data, function(err, d) {
    return callback(err, data);
  });
};

Redis.prototype.load =  function(id, callback) {
  this.client.hgetall('h:Upload:'+id, function(err, data) {
    return callback(err, (data && Object.keys(data).length > 0) ? data : null);
  });
};

