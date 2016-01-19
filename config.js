var express = require('express'),
    bodyParser = require("body-parser"),
     _ = require('underscore');
var cfg;
var expressApp;

var setupConfig = function() {
    cfg = require('./config.json');
    return cfg;
};


var uploaderOptions  = {
    tmpDir: __dirname + '/public/tmp/',
    publicDir: __dirname + '/public',
    uploadDir: __dirname + '/public/files',
    uploadUrl: '/files/',
    accessControl: {
        allowOrigin: '*',
        allowMethods: 'OPTIONS, HEAD, GET, POST',
        allowHeaders: 'Content-Type, Content-Range, Content-Disposition, X-CSRFToken'
    },
    maxPostSize: 1100000000, // 1.1 GB
    nodeStatic: {
        cache: 3600 // seconds to cache served files
    }
};

var validationConfig = {
    main:{
        minFileSize: 5000,           //5KB
        maxFileSize: 1000000000, // 1 GB
        acceptFileTypes: /\.(jpe?g|png|mp4)$/i,
        acceptMimeTypes: /(image\/jpe?g||image\/png|video\/mp4|application\/mp4)$/i,
        dimensions: [
            {
                maxFileWidth: 10000,
                minFileWidth: 0,
                maxFileHeight: 10000,
                minFileHeight: 0
            }
        ],
        video:{
            checkStrictly:false
        },
        image:{
            checkStrictly:false
        }
    },
    simple:{
        minFileSize: 5000,           //5KB
        maxFileSize: 20000000, // 20 MB
        acceptFileTypes: /\.(jpe?g|png)$/i,
        acceptMimeTypes: /(image\/jpe?g|image\/png)$/i,
        dimensions: [
            {
                maxFileWidth: 10000,
                minFileWidth: 0,
                maxFileHeight: 10000,
                minFileHeight: 0
            }
        ],
        image:{
            checkStrictly:false
        }
    }
};

var setupExpress = function(cfg) {
    var allowCrossDomain = function(req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', uploaderOptions.accessControl.allowOrigin);
        res.setHeader('Access-Control-Allow-Methods', uploaderOptions.accessControl.allowMethods);
        res.setHeader('Access-Control-Allow-Headers', uploaderOptions.accessControl.allowHeaders);
        next();
    };

    expressApp = express();
    expressApp.set('port', process.env.PORT || 3000);
    expressApp.use(express.logger('dev'));

    expressApp.use(bodyParser.json());
    expressApp.use(bodyParser.urlencoded({extended: true}));
    expressApp.use(express.methodOverride());
    expressApp.use(express.cookieParser('your secret here'));
    expressApp.use(allowCrossDomain);
    expressApp.use(expressApp.router);


    // development only
    if (process.env.NODE_ENV != 'production') {
        expressApp.use(express.errorHandler());
    }
};



module.exports = {
    setup: function() {
        this.cfg = setupConfig();
        this.hostconf = require('./hostconf').hosconfig;
	   	setupExpress(this.cfg);
    },
    getConfigByHost:function(req, simple){
        try {
            var host = req.headers.origin.split(':')[1].replace(/\//g,"");
            var config = this.hostconf[host];
            var patchedConfig = {};
            if(simple){
                patchedConfig['validation'] = validationConfig.simple
            }else{
                if (config.hasOwnProperty('validation')) {
                    patchedConfig['validation'] = _.extend({}, validationConfig.main, config['validation']);
                }else{
                    patchedConfig['validation'] = validationConfig.main;
                }
            }
            patchedConfig['s3'] = config['s3'];
        } catch(e){
            console.log('cannot parse config for host or origin not found in headers:' + e);
        }
        return patchedConfig;
    },
    uploaderOptions: uploaderOptions,
    express: function() { return expressApp;}
};
