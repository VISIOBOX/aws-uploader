var config = require('./config.js');
var path = require('path'),
    fs = require('fs');
    nodeStatic = require('node-static');
    uploader = require('./routes/uploader');

config.setup();

var utf8encode = function (str) {
    return unescape(encodeURIComponent(str));
};

var fileServer = new nodeStatic.Server(config.uploaderOptions.publicDir, config.uploaderOptions.nodeStatic);

fileServer.respond = function (pathname, status, _headers, files, stat, req, res, finish) {
    // Prevent browsers from MIME-sniffing the content-type:
    _headers['X-Content-Type-Options'] = 'nosniff';
    var conf = config.getConfigByHost(req);
    if(!conf){
        console.log('cannot find config for hostname');
        req.connection.destroy();
        return;
    }
    nodeStatic.Server.prototype.respond.call(this, pathname, status, _headers, files, stat, req, res, finish);
};

var expressApp = config.express();

expressApp.get('/', uploader.info);
expressApp.post('/', uploader.upload);
expressApp.options('/', uploader.opts);
expressApp.post('/simpleupload/', uploader.simpleUpload);
expressApp.options('/simpleupload/', uploader.simpleOpts);

require('http').createServer(expressApp).listen(config.cfg.apiPort, config.cfg.apiHost);
console.log('Start server on ' + config.cfg.apiHost + ':' + config.cfg.apiPort);
