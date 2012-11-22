# ruploads

## About ruploads

ruploads middleware adds support for resumable uploads via Content-Range and Range headers using HTTP statuscode 308.
ruploads comes with an IOS client, browser client utilizing HTML5 File api, the node.js client extends superagent with resume capabilities and ads support
for streamed uploads for extremely large files.

When an upload completes, either via the first request or later resume the results are delivered to the next middleware in chain in
the same req.files format express.js uses through formidable.

### HTTP Flow - asking upload status, target identified by ETag:

```
PUT /uploads HTTP/1.1
Host: localhost:3000
Content-Length: 0
Content-Range: bytes */123445678
ETag: "abcdefg"
```

### HTTP Flow - the server responds with the range it already has for "abcdefg":

```
HTTP/1.1 308 Resume Incomplete
Content-Length: 0
Range: 0-12345664
ETag: "abcdefg"
```

## Usage

Basic middleware usage, for options see code comments.
```js
var express = require('express')
  , ruploads = require('ruploads');

var app = express();
var uploads = ruploads({});
/*
  use uploads.set('')
*/
app.use(express.basicAuth('user','pass'));
app.all('/uploads', uploads, function(req, res, next) {
    console.log("upload complete", req.files);
});
```

## Upload and resume HTTP request flow

Client initializez a new resumable upload by issuing A PUT to the upload path:
```   
PUT /upload HTTP/1.1
Host: localhost:3000
Content-Type: application/octet-stream
Content-Disposition: form-data; name="myfile"; filename="ad.gif"
Content-Length: 123445678
ETag: "etag identifying the file, like md5 or other identifier."
```

If the upload is interupted, the client can ask for the upload state:
```
PUT /upload HTTP/1.1
Host: localhost:3000
Content-Type: application/octet-stream
Content-Disposition: form-data; name="myfile"; filename="ad.gif"
Content-Length: 0
Content-Range: bytes */123445678
ETag: "etag identifying the file, like md5 or other identifier."
```

And server responds with what byte range it did already receive:
```
HTTP/1.1 308 Resume Incomplete
Content-Length: 0
Range: bytes=0-12345664
```

And the client resumes the upload from bytes 12345664:
```
PUT /uploads HTTP/1.1
Host: localhost:3000
Content-Length: 111100014
Content-Type: application/octet-stream
Content-Range: bytes 12345665-123445677/123445678
ETag: "etag identifying the file, like md5 or other identifier."
```

<bytes 12345665-123445677>
