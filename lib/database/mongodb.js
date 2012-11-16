/**
 * Module dependencies
 */
var mongo = require('mongodb'),
  Server = mongo.Server,
  Db = mongo.Db;

new mongodb.Db('test', server, {}).open(function (error, client) {
  if (error) throw error;
  var collection = new mongodb.Collection(client, 'test_collection');
  collection.findAndModify({hello: 'world'}, [['_id','asc']], {$set: {hi: 'there'}}, {},
    function(err, object) {
      if (err) console.warn(err.message);
      else console.dir(object);  // undefined if no matching object exists.
    });
});

var MongoDB = module.exports = function(options) {
  var self = this;
  if(!options || !options.host || !options.port || !options.collection) {
    throw new Error("MongoDB type storage requires port, host and collection");
  }
  var server = new Server(options.host, options.port, {auto_reconnect: true});
  var db = new Db(options.collection || 'uploads', server);
  db.open(function(err, db) {
    db.collection('test', function(err, collection) {
      if(err) {
        throw err;
      }
      self.collection = collection;
    });
  });
};

MongoDB.prototype.create = function(upload, callback) {
  this.collection.insert({_id:upload.data.id,extra:upload.data.extra}, function(err, res) {
    if(res) {
      res.id = res._id;
    }
    return callback(err, res);
  });
};

MongoDB.prototype.load =  function(id, callback) {
  this.collection.findOne({_id:id}, function(err, res) {
    if(res) {
      res.id = res._id;
    }
    return callback(err, res);
  });
};

