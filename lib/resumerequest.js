var fs = require('fs')
  , path = require('path');

function getFileName(header) {
  var m = header.match(/filename="(.*?)"($|; )/i)
  if (!m) return;

  var filename = m[1].substr(m[1].lastIndexOf('\\') + 1);
  filename = filename.replace(/%22/g, '"');
  filename = filename.replace(/&#([\d]{4});/g, function(m, code) {
    return String.fromCharCode(code);
  });
  return filename;
}

function parseRangeHeader(req) {
  var info = {};
  if(req.headers && req.headers['content-range']) {
    var ranges = req.headers['content-range'].match(/bytes\s(\*|\d+)-?(\d+)?\/(\d+)/i);
    if(ranges && ranges[1] && ranges[3] && !ranges[2]) {
      info.type = "info";
      info.size = Number(ranges[3]);
      info.stop = Number(ranges[2]);
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

var ResumeRequest = module.exports = function(req, res, next, options) {
  this.req = req;
  this.res = res;
  this.options = options;
  this.range = parseRangeHeader(req);
  this.size = 0;
  this.next = next;
  this.mongodb = options.mongodb;
  this.mongo = options.mongo;
  this.requestSize = Number(req.headers['content-length']);
  this.received = 0;
  this.directory = options.directory || "/tmp/uploads";
  this.filename = getFileName(req.headers['content-disposition'] || req.headers['x-content-disposition']);
  var m;
  this.fname = "";
  if (m = (req.headers['content-disposition'] || req.headers['x-content-disposition']).match(/name="([^"]+)"/i)) {
    this.name = m[1];
  }
  if (m = (req.headers['content-disposition'] || req.headers['x-content-disposition']).match(/filename="([^"]+)"/i)) {
    this.fname = m[1];
  }
  this.id = req.headers['etag'] + this.fname;
  req.pause();
};

ResumeRequest.prototype.info = function(callback) {
  var self = this;
  console.log("Statting",this.directory + '/' +this.id);
  fs.stat(this.directory + '/' +this.id, function(err, stats) {
    if(err || !stats) {
      return callback(err, stats)
    }
    self.size = stats.size;
    return callback(err, stats);
  });
};


ResumeRequest.prototype.execute = function() {
  // is this the last chunk?
  var self = this, stream, outputStream;
  stream = this.req;
  var at = 0;
  stream.pause();
  this.info(function(err, stats) {
    if(!err && stats) {
      console.log("exists",stats);
      self.received = self.range.start;
      var start = self.received;
      if(self.req && self.req.query) {
        // Workaround for old ios builds <= 5
        // EveryplayUpload.m:390: bytesCompleted = [bytes integerValue];
        // fixed in build6 to:
        // EveryplayUpload.m:390: bytesCompleted = [bytes integerValue] + 1;
        if(self.req.query.build && Number(self.req.query.build) <= 5) {
          start--;
          console.log("Working around build lte 5 issues with offset by 1 in stream seeking.");
        }
      }
      outputStream = self.writeStream = fs.createWriteStream(self.directory+'/'+self.id, {flags:'r+',start:start});
    } else {
      outputStream = self.writeStream = fs.createWriteStream(self.directory+'/'+self.id);
    }
    stream.on('data', function(d) {
      var drain = outputStream.write(d);
      if(!drain) {
        stream.pause();
      }
    });

    outputStream.on('drain', function() {
      stream.resume();
    });

    stream.on('end', function() {
      outputStream.end();
      self.received = outputStream.bytesWritten;
      console.log("Wrote ",self.received," bytes to ",self.directory+'/'+self.filename);
      self.size += self.received;
      if(self.range.stop+1 >= self.range.size) {
        console.log("Last chunk, lets assemble.");
        self.respond();
      } else {
        self.respond();
      }
    });
    stream.resume();
  });

};

ResumeRequest.prototype.respond = function() {
  var self = this;
  if(this.range.stop+1>=this.range.size) {
    console.log("continuing to video route.");
    this.req.files = this.req.files || {};
    var file = this.req.files[this.name] = {};
    this.info(function(err, stats) {
      if(err) {
        return this.next(err);
      }
      file.size = stats.size;
      file.path = self.directory + '/' + self.id;
      file.name = self.id;
      file._writeStream = this.writeStream;
      console.log("File completed: ",file);
      return self.next();
    });
  } else if(this.received == this.requestSize && this.received < this.range.size) {
    console.log("asking more data with",'0-'+(this.range.start+this.received));
    this.res.set('Range','0-'+(this.range.start+this.received));
    this.res.writeHead(308, 'Resume incomplete');
    this.res.end();
  }
}
