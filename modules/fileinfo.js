var FFMpeg = require('./codec/ffmpeg.js').ffmpeg,
    JPEG = require('./codec/jpeg.js').jpeg,
    S3Uploader = require('./s3uploader').S3Uploader,
    fs = require('fs');

module.exports.FileInfo = function (options, config) {
    this.name = options.name;
    this.size = options.size;
    this.mime = options.mime;
    this.path = options.path;
    this.error = false;
    this.errorStatus = 0;
    this.expectedSize = options.expectedSize;
    this.cdn = config.s3.cdn;

    this.storageLocation = null;

    this.type = null;
    this.codec = null;
    this.width = 0;
    this.height = 0;
    this.duration = 0;

    this.setType = function(){
        if(this.mime.indexOf("image") >= 0) {
            this.type = "image";
        }
        if(this.mime.indexOf("video")  >= 0 || this.mime.indexOf("application")  >= 0){
            this.type = "video";
        }
    };

    this.setType();

    this.validate = function(successCallback, errorCallback, onlyMeta){
        var self = this;
        var validator = new Validator(this, config.validation, function(error){
            if(error){
                errorCallback();
            }else{
                //trying make preview after second validation
                if(onlyMeta){
                    self.makePreview(successCallback);
                }else{
                    successCallback();
                }
            }
        });
        if(onlyMeta){
            validator.validateMetaInfo();
        }else{
            validator.validate();
        }
    };
    this.saveFile = function(successCallback, errorCallback) {
        if (this.error == "parse_meta_error") {
            this.validate(successCallback, errorCallback, true);
        }else{
            this.makePreview(successCallback);
        }
    };
    this.makePreview = function(callback){
        console.log('making preview for file');
        if(this.type == "video"){
            var self = this;
            var codec = new FFMpeg(this.path);
            try{
                codec.makeCapture(self.storageLocation, function(err, previewPath){
                    if(err){
                       callback();
                    }else{
                        savePreview(previewPath);
                    }
                });
            }
            catch(e){
                console.log("Failed to create preview for video: ",e);
                callback();
            }

            var savePreview = function(path){
                console.log('save preview ',self.path + ".jpeg");
                var storagePath = self.path + ".jpeg";
                var s3uploader = new S3Uploader(config.s3);
                s3uploader.initUploader(
                    {
                        "Key": storagePath,
                        "ACL": 'public-read'
                    },
                    function(err, uploadStream){
                        console.log('upl created');
                        if(err){
                            console.log("Failed to load preview to storage: ", err);
                            callback();
                            return;
                        }
                        var read = fs.createReadStream(path);
                        s3uploader.uploader.ws.on('uploaded', function (data) {
                            console.log('capture created');
                            self.preview = storagePath;
                            callback();
                            fs.unlink(path);

                        });
                        read.pipe(s3uploader.uploader.ws);
                    }
                )
            }

        }
        if(this.type == "image"){
            this.preview = this.path;
            callback();
        }
    };
};


  /*
   //ERROR STATUSES:
     0 - OK
     10 - File is too small
     15 - File is too big
     20 - Bad ContentType
     25 - Bad filetype
     30 - Bad dimension
     40 - Bad format
     45 - Bad codec

  * */

var Validator = function (file, validationConfig, callback) {
    this.file = file;
    this.validationConfig = validationConfig;
    this.callback = callback;
    this.validateAll = false;

    this.validate = function(){
        this.validateAll = true;
        this.validateSize();
    };
    this.validateSize = function(){
        console.log('validate size');
        if (this.validationConfig.minFileSize && this.validationConfig.minFileSize > this.file.expectedSize) {
            this.file.error = 'File is too small';
            this.file.errorStatus = 10;
            this.callback(this.file.error);
            return;
        }
        if (this.validationConfig.maxFileSize && this.validationConfig.maxFileSize < this.file.expectedSize) {
            this.file.error = 'File is too big';
            this.file.errorStatus = 15;
            this.callback(this.file.error);
            return;
        }
        this.validateExtension();
    };
    this.validateExtension = function(){
        console.log('validate extension');
        if (!this.validationConfig.acceptFileTypes.test(this.file.name)) {
            this.file.error = 'Filetype not allowed';
            this.file.errorStatus = 25;
            this.callback(this.file.error);
            return;
        }
        this.validateContentType();
    };
    this.validateContentType = function(){
        console.log('validate content type');
        if (!this.file.mime.match(this.validationConfig.acceptMimeTypes)) {
            this.file.error = 'ContentType not allowed';
            this.file.errorStatus = 20;
            this.callback(this.file.error);
            return;
        }
        this.validateMetaInfo();
    };
    this.validateDimension = function(){
        function aspectRatio(width, height) {
            var x = width;
            var y = height;
            while (x && y){
                x > y ? x %= y : y %= x;
            }
            x += y;
            return [width/x, height/x];
        }
        var validDimension = true;
        for(var i=0; i<validationConfig.dimensions.length; i++){
            var allowedDimension = validationConfig.dimensions[i];
            if(validationConfig[this.file.type].checkStrictly){
                if (this.file.width != allowedDimension.width ||
                    this.file.height != allowedDimension.height) {
                    validDimension = false;
                    continue;
                }
            }else{
                if (this.file.width > allowedDimension.maxFileWidth ||
                    this.file.width < allowedDimension.minFileWidth ||
                    this.file.height > allowedDimension.maxFileHeight  ||
                    this.file.height < allowedDimension.minFileHeight) {
                    validDimension = false;
                    continue;
                }
            }
            if(allowedDimension.hasOwnProperty('ratio')){
                var isSame = aspectRatio(this.file.width, this.file.height).every(function(element, index) {
                    return element === allowedDimension.ratio[index];
                });
                if(!isSame){
                    validDimension = false;
                    continue;
                }
            }
            validDimension = true;
            break;
        }
        return validDimension;
    };
    this.validateMetaInfo = function(){
        console.log('validate metadata');
        var self = this;
        var path = this.file.filePart;
        if(!self.validateAll){
            path = this.file.storageLocation;
        }
        if("image" == this.file.type) {
            new JPEG().readMetadata(path, function(error, info){
                console.log(error);
                if(error == "parse_meta_error" && self.validateAll){
                    self.file.error = error;
                    self.callback(false); //make validation later;
                    return;
                }
                if(error){
                    self.file.error = "Bad image format";
                    self.file.errorStatus = 40;
                    self.callback(self.file.error);
                    return;
                }
                self.file.width = info.width;
                self.file.height = info.height;
                if(!self.validateDimension()){
                    self.file.error = "Bad image dimension`: " + self.file.width + "x" + self.file.height;
                    self.file.errorStatus = 30;
                    self.callback(self.file.error);
                    return;
                }
                self.callback(false);
            });
        }
        if("video" == this.file.type){
            new FFMpeg(self.file.path).readMetadata(path, function(error, info){
                console.log(error);
                if(error == "parse_meta_error" && self.validateAll){
                    self.file.error = error;
                    self.callback(false);  //make validation later;
                    return;
                }
                if(error || !info.hasOwnProperty('streams') || info['streams'].length == 0){
                    self.file.error = "Bad video format";
                    self.file.errorStatus = 40;
                    self.callback(self.file.error);
                    return;
                }
                var stream = info['streams'][0];
                if(stream.codec_name != 'h264') {
                    self.file.error = "Codec not allowed";
                    self.file.errorStatus = 45;
                    self.callback(self.file.error);
                    return;
                }
                self.file.width = stream.width;
                self.file.height = stream.height;
                if(!self.validateDimension()){
                    self.file.error = "Bad video dimension: " + stream.width + "x" + stream.height;
                    self.file.errorStatus = 30;
                    self.callback(self.file.error);
                    return;
                }
                self.file.codec = stream.codec_name;
                self.file.duration = Math.round(stream.duration);
                self.file.preview = null;
                self.callback(false);
            });
        }
    };
};