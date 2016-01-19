var Uploader = require('s3-upload-stream').Uploader;


module.exports.S3Uploader = function(s3config){
    this.defaultBucket = "temp";

    this.initUploader = function(destinationConfig, successCallback){
        this.destinationConfig = destinationConfig;
        this.successCallback = successCallback;
        this.connection = s3config.connection;
        if(!this.destinationConfig['Bucket']){
            if(s3config.bucket)
                this.destinationConfig['Bucket'] =  s3config.bucket;
            else
                this.destinationConfig['Bucket'] = this.defaultBucket;
        }
        this.uploader = new Uploader(this.connection, this.destinationConfig, this.successCallback);

        this.uploader.ws.on('error', function (err) {
           console.log('S3 ERROR: ', err);
        });
    };
    this.abortUpload = function(){
        if(this.uploader){
            try{
                this.uploader.abortUpload();
            }catch(e){
                console.log(e);
            }
        }
    };
};