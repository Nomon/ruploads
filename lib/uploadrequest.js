

/*
 * module dependencies
 */
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

var UploadRequest = module.exports = function(req, res, next, options) {
  req.pause();
  this.req = req;
  this.res = res;
  this.options = options;
  this.next = next;
  this.range = parseRangeHeader(req);
  this.mongodb = options.mongodb;
  this.mongo = options.mongo;
  this.requestSize = Number(req.headers['content-length']);
  if(!this.range) {
    this.range = {"start":0,"stop":this.requestSize-1,size:this.requestSize};
  }
  this.received = 0;
  this.directory = options.directory || "/tmp";
  this.filename = getFileName(req.headers['content-disposition'] || req.headers['x-content-disposition']);
  var m;
  if (m = (req.headers['content-disposition'] || req.headers['x-content-disposition']).match(/name="([^"]+)"/i)) {
    this.name = m[1];
  }
  this.id = req.headers['etag'];
  console.log("New upload request, range start:",this.range.start,"stop:",this.range.stop,"size:",this.range.size,"chunk:",this.requestSize);
};

UploadRequest.prototype.execute = function() {
  console.log("UploadRequest");
  var self = this, stream, outputStream;
  stream = this.req;
  console.log("Creating write stream to ",this.directory+'/'+this.filename);
  outputStream = this.writeStream = fs.createWriteStream(this.directory+'/'+this.filename);
  stream.on('data', function(d) {
    var drain = outputStream.write(d);
    if(!drain) {
      console.log("paused");
      stream.pause();
    }
  });

  outputStream.on('drain', function() {
    console.log("resumed");
    stream.resume();
  });

  stream.on('end', function() {
    self.received = outputStream.bytesWritten;
    console.log("chunk saved to disk with",self.received,outputStream);
    if(self.received >= self.range.size) {
      console.log("it was the whole file");
      // whole file at once, no need to do anything else.
      return self.respond();
    } else if(self.received >= self.requestSize && self.received < self.range.size) {
      // chunk arrived completely
      console.log("saving to gridFS, this is chunked and not last");
      self.saveChunk(function(err) {
        return self.respond();
      });
    } else {
      console.log("saving to gridFS");
      self.saveChunk(function(err) {
        return self.respond();
      });
    }
  });
  stream.resume();
};

UploadRequest.prototype.getFileInfo = function(callback) {
  fs.stat(this.directory+'/'+this.filename, function(err, stats) {
    return callback(err, stats);
  });
}


UploadRequest.prototype.respond = function() {
  var self = this;
  if(this.received >= this.range.size) {
    console.log("We received the whole file");
    this.req.files = this.req.files || {};
    var file = this.req.files[this.name] = {};
    this.getFileInfo(function(err, stats) {
      if(err) {
        return this.next(err);
      }
      file.size = stats.size;
      file.path = self.directory + '/' + self.filename;
      file.name = self.filename;
      file._writeStream = this.writeStream;
      console.log("File completed: ",file);
      return self.next();
    });
  } else if(this.received == this.requestSize && this.received < this.range.size) {
    this.res.set('Range','0-'+(this.range.start+this.received));
    this.res.writeHead(308, 'Resume incomplete');
    this.res.end();
  }
};

UploadRequest.prototype.saveChunk = function(callback) {
  var self = this;
  if(!self.itemId) {
    self.itemId = new self.mongo.ObjectID();
  }
  var gridStore = new self.mongo.GridStore(self.mongodb, self.itemId, self.id, "w");
  gridStore.open(function(err, gs) {
    var seekTo = 0;
    gs.seek(seekTo, function() {
      gs.writeFile(self.directory + '/' + self.filename, function(err, res) {
        gs.close(function() {
          console.log("File written");
          return callback(err, self);
        });
      })
    });
  });
};