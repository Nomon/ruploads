/*
 * module dependencies
 */
var url = require('url');
var UploadRequest = require('./uploadrequest')
  , UploadResponse = require('./uploadresponse')
  , InfoRequest = require('./inforequest')
  , ResumeRequest = require('./resumerequest');

function parseRangeHeader(req) {
  var info = {};
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

module.exports = function(uploader) {
  var options = uploader.options;
  var uploader = uploader;
  return function (req, res, next) {
    var disposition = req.headers['x-content-disposition'] || req.headers['content-disposition'];
    var range = parseRangeHeader(req);
    var size = req.headers['content-length'];
    var request;
    if(!range) {
      range = {"start":0,"stop":size-1,size:size};
    }
    console.log("Upload with",range);
    if(range.type == "info") {
      console.log("INFO");
      request = new InfoRequest(req, res, next, options);
    } else if(size > 0 && range.start == 0) {
      console.log("Upload with UploadRequest");
      request = new UploadRequest(req, res, next, options);
    } else if(size > 0 && range.start > 0) {
      console.log("Upload with ResumeRequest");
      request = new ResumeRequest(req, res, next, options);
    }
    if(request) {
      request.execute();
    }
  }
};