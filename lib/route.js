var url = require('url')
  , Upload = require('./upload')
  , Chunk = require('./chunk');


function parseRangeHeader(req) {
  var info = {};
  console.log(req.headers);
  if(req.headers && req.headers['content-range']) {
    var ranges = req.headers['content-range'].match(/bytes\s(\*|\d+)-?(\d+)?\/(\d+)/i);
    if(ranges && ranges[1] && ranges[3] && !ranges[2]) {
      info.type = "info";
      info.size = ranges[3];
    } else if(ranges && ranges[1] && ranges[2] && ranges[3]) {
      info.type = "data";
      info.start = ranges[1];
      info.stop = ranges[2];
      info.size = ranges[3];
    } else {
      return null;
    }
  } else {
    return null;
  }
  return info;
}

function getRequestInfo(req, options) {
  var info = {options:options};
  var parsedUrl = url.parse(req.url, true);
  if(!options.upload_path || parsedUrl.pathname == options.upload_path) {
    if(req.method == "POST") {
      info.method = "create";
      return info;
    } else if(req.method == "PUT" && parsedUrl.query && parsedUrl.query.upload_id) {
      var ranged = parseRangeHeader(req);
      if(!ranged) {
        return null;
      }
      info.method = ranged.type;
      info.range = ranged;
    }
    if(!parsedUrl.query || !parsedUrl.query.upload_id) {
      return null;
    }
    info.id = parsedUrl.query.upload_id;
    return info;
  } else {
    return null;
  }
}

var route = module.exports = function(options) {
  if(!options || !options.upload_url) {
    throw new Error("upload_url option is required.");
  }
  return function(req, res, next) {
    var info;
    info = getRequestInfo(req, options);
    if(info) {
      if(info.method == "create") {
        return route.createUpload(info, req, res, next);
      } else if(info.method == "info") {
        return route.uploadInfo(info, req, res, next);
      } else if(info.method == "data") {
        return route.uploadData(info, req, res, next);
      }
    }
    return next();
  }
}

route.createUpload = function createUpload(info, req, res, next) {
  console.log("POST, creating new upload");
  var upload = new Upload(info, req);
  return upload.save(function(err, info) {
    if(err) {
      return next(err);
    }
    res.writeHead(200, {"Location":upload.url()});
    return res.end();
  });
};

route.uploadInfo = function uploadInfo(info, req, res, next) {
  console.log("PUT, getting upload status");
  Upload.load(req, info, function(err, upload) {
    if(err) {
      return next(err);
    }
    if(upload.data.size == upload.data.completed) {
      res.writeHead(201);
      res.end();
    } else {
      res.writeHead(308, {'Range':0+"-"+upload.data.completed});
      res.end();
    }
  });
};

route.uploadData = function uploadData(info, req, res, nexr) {
  console.log("PUT, uploading data");
  req.pause(); // no data events yet, we will do an asynchronous load on upload first+.
  Upload.load(req, info, function(err, upload) {
    if(err) {
      return next(err);
    }
    var chunk = new Chunk(req, upload);
    return chunk.save(function(err, upload) { // will drain request.
      console.log("Saved, responding", upload);
      res.writeHead(308, {'Range':upload.range.start+"-"+upload.range.stop});
      return res.end();
    });
  });
}