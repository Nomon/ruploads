var fs = require('fs');

var UploadResponse = module.exports = function(request, res) {
  this.res = res;
  this.request = request;
    var size = this.request.upload.completedSize;
    if(size > 0) {
      size--;
    }
    res.set('Range','0-'+size);

}

UploadResponse.prototype.send = function(next) {
  //console.log(this.request);
  var self = this;
  if(this.request.upload.completedLength > 0 && this.request.upload.completedLength >= this.request.range.size) {
    // whole file.
    self.request.req.files = self.request.req.files || {};
    var file = self.request.files[self.request.name];
    fs.stat(self.request.upload.directory + '/' + self.options.upload.filename, function(err, stat) {
      console.log("Stat", stat);
    });
  }
  /*
    console.log(this.request.upload.completedSize, this.request.range.size, this.request.size);
    if(this.request.upload.completedSize < this.request.range.size) {
    console.log("Resume incomplete");
    this.res.writeHead(308, "Resume incomplete");
    this.res.end();
  } else if(this.request.writes && this.request.size > 0 && this.request.upload.completedSize == this.request.range.size) {
    console.log("next");
    return next();
  } else {
    this.res.end();
  }*/
}