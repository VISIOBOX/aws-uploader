var uploadhandler = require('../modules/uploadhandler'),
    config = require('../config.js');

var setupHandler = function(req, res){

    var handleResultCallback = function (result, err) {

        if(err){
            res.statusCode = 400;
            res.setHeader('Content-Type', req.headers.accept
                    .indexOf('application/json') !== -1 ?
                    'application/json' : 'text/plain');

            res.set("Connection", "close");
            res.end(JSON.stringify({error:err}));
            req.connection.destroy();
            return;
        }
        res.writeHead(200, {
            'Content-Type': req.headers.accept
                .indexOf('application/json') !== -1 ?
                'application/json' : 'text/plain'
        });
        res.end(JSON.stringify(result));
    };

    return new uploadhandler.UploadHandler(req, res, handleResultCallback);
};

var setNoCacheHeaders = function (req, res) {
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', 'inline; filename="files.json"');
};


exports.info = function(req, res){
    res.send(200);
};

function checkHost(req, res, isSimple){
    var conf = config.getConfigByHost(req, isSimple);
    if(!conf){
        console.log('cannot find config for hostname');
        res.status(403).send('host is not allowed');
        return false;
    }
    return conf;
}

exports.upload = function(req, res){
    var conf = checkHost(req, res);
    if(!conf){
        return;
    }
    var handler = setupHandler(req, res);
    setNoCacheHeaders(req, res);
    handler.post(conf);
};

exports.opts = function(req, res){
    if(!checkHost(req, res)){
        return;
    }
    res.send(200);
};

exports.simpleUpload = function(req, res){
    var conf = checkHost(req, res, true);
    if(!conf){
        return;
    }
    var handler = setupHandler(req, res);
    setNoCacheHeaders(req, res);
    handler.post(conf);
};

exports.simpleOpts = function(req, res){
    if(!checkHost(req, res, true)){
        return;
    }
    res.send(200);
};