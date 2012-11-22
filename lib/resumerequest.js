
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
  this.directory = options.directory || "/tmp";
  this.filename = getFileName(req.headers['content-disposition'] || req.headers['x-content-disposition']);
  var m;
  if (m = (req.headers['content-disposition'] || req.headers['x-content-disposition']).match(/name="([^"]+)"/i)) {
    this.name = m[1];
  }
  this.id = req.headers['etag'];
  req.pause();
}

ResumeRequest.prototype.info = function(callback) {
  var self = this;
  self.mongo.GridStore.list(self.mongodb, {id:1}, function(err, items) {
    console.log("ResumeRequest.info:",items);
    if(items.length > 0) {
      if(typeof items[0] == "string") {
        self.itemId = new ObjectID.createFromHexString(items[0]);
      } else {
        self.itemId = items[0];
      }
      console.log("gridfs has the file");
      self.mongodb.collection('fs.files', function(err, coll) {
        coll.findOne({_id:self.itemId},{length:1}, function(err, doc) {
          if(err) {
            return callback(err);
          }
          if(doc) {
            console.log("existing file", doc);
            self.size += doc.length;
          }
          return callback();
        });
      });
    } else {
      return callback();
    }
  });
}

ResumeRequest.prototype.uploadFileName = function() {
  var name = '';
  for (var i = 0; i < 32; i++) {
    name += Math.floor(Math.random() * 16).toString(16);
  }
  return path.join(this.directory, name);
}

ResumeRequest.prototype.assemble = function() {
  var self = this;
  if(!self.itemId) {
    self.itemId = new self.mongo.ObjectID();
  }
  console.log("ResumeRequest.assemble");
  self.mongo.GridStore.list(self.mongodb, {id:1}, function(err, items) {
    console.log("ResumeRequest.info:",items);
    if(items.length > 0) {
      if(typeof items[0] == "string") {
        self.itemId = new self.mongo.ObjectID.createFromHexString(items[0]);
      } else {
        self.itemId = items[0];
      }
    }
    var gridStore = new self.mongo.GridStore(self.mongodb, self.itemId, self.id, "r");
    gridStore.open(function(err, gs) {
      gs.seek(0, function() {
        gs.read(function(err, data) {
          this.final = self.uploadFileName();
          fs.writeFile(this.final, data, function(err, res) {
            gs.close(function() {
              fs.readFile(self.directory+'/'+self.filename, function(err, data) {
                fs.appendFile(this.final, data, function() {
                  console.log("Written");
                  self.respond();
                  self.cleanChunks();
                });
              });

            });
          });
        });
      })
    });
  });
};

ResumeRequest.cleanChunks = function() {
  var self = this;
  var gridStore = new self.mongo.GridStore(self.mongodb, self.itemId, self.id, "w");
  gridStore.open(function(err, gs) {
    if(!err) {
      gs.unlink(function() {
        console.log("Cleaned up gridstore chunks for download "+self.id);
        gs.close();
      });
    }
  });

}

ResumeRequest.prototype.execute = function() {
  console.log("UploadRequest");
  // is this the last chunk?
  var self = this, stream, outputStream;
  stream = this.req;
  outputStream = this.writeStream = fs.createWriteStream(this.directory+'/'+this.filename);
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
      return self.assemble(function() {
        self.respond();
      });
    } else {
      console.log("not last chunk, lets store it..");
      return self.saveChunk(function() {
        self.respond();
      });
    }
  });
  stream.resume();
};

ResumeRequest.prototype.saveChunk = function(callback) {
  var self = this;
  if(!self.itemId) {
    self.itemId = new self.mongo.ObjectID();
  }
  self.mongo.GridStore.list(self.mongodb, {id:1}, function(err, items) {
    console.log("ResumeRequest.info:",items);
    if(items.length > 0) {
      if(typeof items[0] == "string") {
        self.itemId = new self.mongo.ObjectID.createFromHexString(items[0]);
      } else {
        self.itemId = items[0];
      }
    }
    var gridStore = new self.mongo.GridStore(self.mongodb, self.itemId, self.id, "w+");
    gridStore.open(function(err, gs) {
      console.log("GS open");
      var seekTo = 0;
      if(self.range.start > 0) {
        seekTo = self.range.start;
      }
      console.log("Appending to gs, seeking to",seekTo);
      gs.seek(seekTo, function() {
        gs.writeFile(self.directory + '/' + self.filename, function(err, res) {
          console.log("Written");
          gs.close(function() {
            return callback(err, self);
          });
        });
      });

    });
  });

};

ResumeRequest.prototype.respond = function() {
  var self = this;
  if(this.range.stop+1>=this.range.size) {
    console.log("continuing to video route.");
    /*this.req.files = this.req.files || {};
    var file = this.req.files[this.name] = {};
    this.getFileInfo(function(err, stats) {
      if(err) {
        return this.next(err);
      }
      file.size = stats.size;
      file.path = this.directory + '/' + this.filename;
      file.name = this.filename;
      file._writeStream = this.writeStream;
      console.log("File completed: ",file);
      return self.next();
    });*/
  } else if(this.received == this.requestSize && this.received < this.range.size) {
    console.log("asking more data with",'0-'+(this.range.start+this.received));
    this.res.set('Range','0-'+(this.range.start+this.received));
    this.res.writeHead(308, 'Resume incomplete');
    this.res.end();
  }
}