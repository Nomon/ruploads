

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
    this.res.set('Range','0-'+this.size);
    this.res.writeHead(308, 'Resume incomplete');
  }
  this.res.end();
}


InfoRequest.prototype.execute = function() {
  var self = this;
  this.mongo.GridStore.list(self.mongodb, {id:1}, function(err, items) {
    console.log("Inforequest.execute:",items);
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
          self.respond();
        });
      });
    } else {
      self.respond();
    }
  });
};