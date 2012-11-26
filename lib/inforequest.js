var fs = require('fs');

function parseRangeHeader(req) {
  var info = {};
  console.log(req.headers);
  if(req.headers && req.headers['content-range']) {
    var ranges = req.headers['content-range'].match(/bytes\s(\*|\d+)-?(\d+)?\/(\d+)/i);
    if(ranges && ranges[1] && ranges[3] && !ranges[2]) {
      info.type = "info";
      info.size = Number(ranges[3]);
      info.stop = Number(ranges[3]);
    } else if(ranges && ranges[1] && ranges[2] && ranges[3]) {
      info.type = "data";
      info.start = Number(ranges[1]);
      info.stop = Number(ranges[2]);
      info.size = Number(ranges[3]);
    } else {
      return null;
    }
  } else {
    return null;
  }
  return info;
}

var InfoRequest = module.exports = function(req, res, next, options) {
  this.req = req;
  this.res = res;
  this.options = options;
  this.range = parseRangeHeader(req);
  this.directory = this.options.directory || '/tmp/uploads';
  this.id = req.headers['etag'];
  this.size = 0;
  this.next = next;
  this.mongodb = options.mongodb;
  this.mongo = options.mongo;
}

InfoRequest.prototype.respond = function() {
  if(this.size >= this.range.size) {
    return this.next();
  } else {
    var size = 0;
    if(this.size > 0) {
      size = this.size-1;
    }
    console.log("Sending",'0-'+size);
    this.res.set('Range','0-'+size);
    this.res.set('Set-Cookie','upload_id='+this.id);
    this.res.writeHead(308, 'Resume incomplete');
  }
  this.res.end();
}


InfoRequest.prototype.execute = function() {
  var self = this;
  fs.stat(this.directory + '/' +this.id, function(err, stats) {
    if(err || !stats) {
      this.size = 0;
      return self.respond();
    }
    self.size = stats.size;
    return self.respond();
  });
};