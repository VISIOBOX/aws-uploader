var fs = require('fs'),
    formidable = require('formidable'),
    path = require('path'),
    config = require('../config.js'),
    AWS  = require('aws-sdk'),
    dateFormat = require('dateformat'),
    StringDecoder = require('string_decoder').StringDecoder,
    S3Uploader = require('./s3uploader').S3Uploader,
    fileinfo = require('./fileinfo');

var sha256 = AWS.util.crypto.sha256;

formidable.IncomingForm.prototype._uploadPath = function(filename, fileType) {
    var ext = filename.split('.').pop();
    var hash = sha256(((new Date().toString()) + Math.random()),'hex');
    var name = hash + "." + ext;

    var generateDestinationPath = function(){
        return fileType + "/" + dateFormat(new Date(), "dd-mm-yyyy") + "/";
    };
    return path.join(generateDestinationPath(), name);
};


formidable.IncomingForm.prototype._error = function(err) {
    if (this.error) {
        return;
    }
    this.error = err;
    this.emit('error', err);
};

module.exports.UploadHandler = function (req, res, callback) {
    this.req = req;
    this.res = res;
    this.callback = callback;

    this.post = function (hostConfig) {
        var handler = this,
            form = new formidable.IncomingForm(),
            file = null,
            counter = 1,
            validateBufferSize = 5000,
            entityDir = "temp",
            finish = function (err) {
                counter -= 1;
                if (!counter) {
                    delete file.filePart;
                    handler.callback({file: file}, err);
                }
            };

        var s3uploader = new S3Uploader(hostConfig.s3);
        form.onPart = function(part) {
            console.log('on part for ', part.name);

            if (part.filename === undefined) {
                var value = '',
                    decoder = new StringDecoder(form.encoding);

                part.on('data', function(buffer) {
                    form._fieldsSize += buffer.length;
                    if (form._fieldsSize > form.maxFieldsSize) {
                        form._error(new Error('maxFieldsSize exceeded, received '+form._fieldsSize+' bytes of field data'));
                        return;
                    }
                    value += decoder.write(buffer);
                });
                part.on('end', function() {
                    form.emit('field', part.name, value);
                });

                form.on('field', function (name, value) {
                    if(name == "type") entityDir = value
                });
                return;
            }

            form._flushing++;
            var uploadPath = form._uploadPath(part.filename , entityDir);

            //Dummy file
            file = new fileinfo.FileInfo({
                path: uploadPath,
                name: part.filename,
                mime: part.mime,
                expectedSize: form.bytesExpected,
                size : 0
            }, hostConfig);
            //for video
            if(file.type == "video"){
                form.bytesExpected < 150000 ? validateBufferSize = form.bytesExpected : validateBufferSize = 150000;
            }
            var totalBuffer = 0;
            var bufs = [];
            var validated = false;
            var uploaderInitialized = false;
            var lastBytesToSend = false;
            part.on('data', function(buffer) {
                if (buffer.length == 0) {
                    return;
                }
                file.size += buffer.length;
                totalBuffer +=buffer.length;
                bufs.push(buffer);
                if(!validated && form.bytesReceived >= validateBufferSize){
                    form.pause();
                    validated = true;
                    console.log('validation process ', file.name);
                    file.filePart = Buffer.concat(bufs);
                    file.validate(
                        function(){  //success validation callback

                            file.valid = true;
                            console.log('validation done ',file.name);
                            s3uploader.initUploader(
                                {
                                    "Key": uploadPath,
                                    "ACL": 'public-read'
                                },
                                function (err, uploadStream) {
                                    if (err){
                                        console.log(err, uploadStream);
                                        req.connection.destroy();
                                    } else {

                                        s3uploader.uploader.ws.on('chunk', function (data) {
                                            console.log('chunked');
                                            form.resume();
                                        });
                                        s3uploader.uploader.ws.on('uploaded', function (data) {
                                            console.log('uploaded');
                                            form._flushing--;
                                            file.storageLocation = data.Location;
                                            form.emit('file', part.name, file);
                                        });

                                        s3uploader.uploader.ws.on('error', function (err) {
                                            console.log('S3 ERROR FOR FILE: ', file.name);
                                            form._error(new Error("Storage upload aborted"));
                                        });

                                        uploaderInitialized = true;
                                        console.log('aws created');
                                        form.emit('fileBegin', part, file);
                                        form.resume();
                                        if(lastBytesToSend && totalBuffer > 0) {
                                            console.log('here');
                                            try {
                                                s3uploader.uploader.absorbBuffer(Buffer.concat(bufs));
                                                bufs = [];
                                                s3uploader.uploader.uploadHandler(function () {
                                                    s3uploader.uploader.ws.end();
                                                });
                                            } catch (e) {
                                                form._error(new Error("Storage upload aborted"));
                                                console.log("Buffer absorbing failed: ", e);
                                            }
                                        }
                                    }
                                }
                            );
                        },
                        function(){ //error validation callback
                            console.log('validation error for file: ' +file.name + ': ', file.error);
                            form._error(new Error(file.errorStatus));
                        }
                    );
                } else {
                    if(file.valid){
                        var isLastBytes = (form.bytesExpected - form.bytesReceived) + totalBuffer
                            < s3uploader.uploader.partSizeThreshold;
                        if(!isLastBytes && totalBuffer >= s3uploader.uploader.partSizeThreshold){
                            console.log('sending bytes: ', totalBuffer);
                            form.pause();
                            totalBuffer = 0;
                            s3uploader.uploader.ws.write(Buffer.concat(bufs));
                            bufs = [];
                        }
                    }
                }
            });

            part.on('end', function() {
                console.log('part end');
                console.log('sending last bytes: ', totalBuffer);
                if(totalBuffer > 0){
                    if(uploaderInitialized){
                        try{
                            s3uploader.uploader.absorbBuffer(Buffer.concat(bufs));
                            bufs = [];
                            s3uploader.uploader.uploadHandler(function(){
                                s3uploader.uploader.ws.end();
                            });
                        }catch(e){
                            lastBytesToSend = true;
                            console.log("Buffer absorbing failed: ", e);
                        }
                    }else{
                        lastBytesToSend = true;
                    }
                }
            });
        };

        form.on('fileBegin', function (part, file) {
            console.log('on file begin');
        }).on('file', function (name, file) {
            file.saveFile(
                function(){
                    console.log('preview done');
                    form._maybeEnd();
                },
                function(){
                    console.log('save file error');
                    console.log('validation error for file: ' +file.name + ': ', file.error);
                    finish(file.errorStatus);
                }
            );
        }).on('aborted', function () {
            console.log('aborted');
            s3uploader.abortUpload();
        }).on('error', function (e) {
            console.log("ERROR: ", e.message);
            s3uploader.abortUpload();
            finish(e.message);
        }).on('progress', function (bytesReceived) {
            if (bytesReceived > config.uploaderOptions.maxPostSize) {
                s3uploader.abortUpload();
                handler.req.connection.destroy();
            }
        }).on('end', function(){
            console.log('uploading is over');
            finish();
        });
        form.parse(handler.req);
    };
};