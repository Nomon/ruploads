var uploads = {};
var uploadId = 0;
var uploadExpires = {};
var defaultUploadExpire = 3600*1000;

// TODO: implement
function storeUploadToMongo(upload, callback) {
  var info = upload.data;
  return callback(null, info);
}

function storeUpload(upload, callback) {
  var info = upload.data;
  if(!info.id) {
    info.id = uploadId++;
  }
  uploads[info.id] = info;
  uploadExpires[info.id] = setTimeout(function() {
    delete uploads[info.id];
  }, defaultUploadExpire);
  callback(null, upload);
}

function storeUploadToRedis(upload, callback) {
  var info = upload.data;
  function expire(info) {
    redis.expire('h:Upload:'+info.id, Math.floor(defaultUploadExpire/1000));
  }
  function save(info) {
    this.redis.hmset('h:Upload:'+info.id, info, function(err) {
      return callback(err, upload);
    });
  }
  if(!info.id) {
    redis.inc('i:Upload:id', function(err, id) {
      if(err) {
        return callback(err);
      }
      info.id = id;
      save(info);
      expire(info);
    });
  } else {
    save(info);
    expire(info);
  }
}

var Upload = module.exports = function(info, req) {
  this.options = info.options || {};
  this.data = {
      completed:0
    , size: 0
    , status:""
    , id: info.id || null
    , contentType: "application/octet-stream"
  };
  this.range = info.range;
  if(req) {
    if(req.headers['x-upload-content-length']) {
      this.data.size = req.headers['x-upload-content-length'];
    }
    if(req.headers['x-upload-content-length']) {
      this.data.contentType = req.headers['x-upload-content-type'];
    }
  }
  if(this.options.redis) {
    this.store = storeUploadToRedis;
    this.store.redis = options.redis;
  } else if(this.options.mongodb) {
    this.store = storeUploadToMongo;
    this.store.collection = options.mongodb;
  } else {
    this.store = storeUpload;
  }
};

Upload.load = function(req, info, callback) {
  var upload = new Upload({options:info.options,id:info.id}, req);
  var id = info.id;
  var options = info.options;
  if(options.redis) {
    options.redis.hgetall('h:Upload:'+id, function(err, info) {
      upload.data = info;
      upload.range = info.range;
      return callback(err, upload);
    });
    options.redis.expire('h:Upload:'+id, defaultUploadExpire);
  } else if(options.mongodb) {
    options.mongodb.find({_id:id}, function(err, info) {
      upload.data = info;
      upload.range = info.range;
      return callback(err, info);
    });
  } else {
    upload.data = uploads[id];
    upload.range = info.range;
    clearTimeout(uploadExpires[id]);
    uploadExpires[id] = setTimeout(function() {delete uploads[id]});
    return callback(null, upload);
  }
};


Upload.prototype.save = function(callback) {
  var store, self = this, options = self.options;
  if(!this.data.id && options.id && typeof options.id == "function") {
    options.id(function(id) {
      self.data.id = id;
      storeUpload();
    });
  } else {
    storeUpload()
  }

  function storeUpload() {
    console.log("Storing", self.data);
    self.store(self, function(err) {
      if(err) {
        return callback(err);
      }
      return callback(null, self);
    });
  }
};

Upload.prototype.url = function() {
  return this.options.upload_url + '?upload_id='+this.data.id;
}
