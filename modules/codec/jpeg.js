var config = require('../../config.js'),
    sizeOf = require('image-size'),
    url = require('url'),
    http = require('http');

module.exports.jpeg = function(){

    this.readMetadata = function(pathOrBuffer, callback) {
        this.info = [];
        if (typeof pathOrBuffer == "object") {
            try{
                this.info = sizeOf(pathOrBuffer);
                callback(false, this.info);
            }catch(e){
                console.log("error parsing image meta: ",e);
                callback('parse_meta_error');
            }
        } else {
            var self = this;
            try{
                http.get(url.parse(pathOrBuffer.replace(/^https:\/\//i, 'http://')), function (response) {
                    var chunks = [];
                    response.on('data', function (chunk) {
                        chunks.push(chunk);
                    }).on('end', function() {
                        var buffer = Buffer.concat(chunks);
                        self.info = sizeOf(buffer);
                        callback(false, self.info);
                    });
                });
            }catch(e){
                console.log('Read image metadata error: '+ e);
                callback('parse_meta_error');
            }
        }
    };
};