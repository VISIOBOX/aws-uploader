var spawn = require('child_process').spawn,
    config = require('../../config.js'),
    mkdirp = require("mkdirp"),
    getDirName = require("path").dirname,
    fs = require('fs');

module.exports.ffmpeg = function(path){
    this.path = path;

    this.readMetadata = function(pathOrBuffer, callback){
        this.info = [];
        var self = this;
        if(typeof pathOrBuffer == "object"){
            this.filePath = config.uploaderOptions.tmpDir + this.path;
            mkdirp(getDirName(self.filePath), function (err) {
                if (err){
                    console.log('error create dir: ' + err);
                    doCallback(true);
                }else{
                    fs.writeFile(self.filePath, pathOrBuffer, function(err) {
                        if(err) {
                            console.log('error create file: ' + err);
                            doCallback(true);
                        } else {
                            doProbe();
                        }
                    });
                }
            });
        }else{
            this.filePath = pathOrBuffer;
            doProbe();
        }

        function doProbe(){
            ffprobe = spawn('ffprobe', [
                '-i', self.filePath.replace(/^https:\/\//i, 'http://'),
                '-v','quiet',
                '-print_format','json',
                '-show_streams',
                '-select_streams','v'
            ]);
            // options
            ffprobe.stdout.on('data', function (data) {
                self.info.push(data);
            });

            ffprobe.stderr.on('data', function (data) {
                console.log("ffprobe error: " + data);
                doCallback(true);
            });

            ffprobe.on('exit', function (code) {
                if(code == 0){
                    try{
                        self.info = JSON.parse(self.info.join(''));
                        console.log(self.info);
                        doCallback(false, self.info);
                    }catch(e){
                        console.log('Invalid metadata: ', e);
                        doCallback("parse_meta_error");
                    }
                }else{
                    doCallback("parse_meta_error");
                }
            });
        }

        function doCallback(err, info){
            callback(err, info);
            try{
                fs.unlink(self.filePath);
            } catch(e){
                console.log(e);
            }
        }
    };

    this.makeCapture = function(target, callback){
        console.log('create capture');
        var tmpImagePath = config.uploaderOptions.tmpDir +
            this.path + ".jpeg";
        ffmpeg = spawn('ffmpeg', [
            '-ss','00:00:01.00',
            '-i', target.replace(/^https:\/\//i, 'http://'),
            '-y',
            '-f', 'image2',
            '-pix_fmt', 'yuvj444p',
            '-vcodec', 'mjpeg',
            '-vframes', '1',
            tmpImagePath
        ]);

        // options
        ffmpeg.stdout.on('data', function (data) {
        });

        ffmpeg.stderr.on('data', function (data) {
        });

        ffmpeg.on('exit', function (code) {
            if(code == 0){
                callback(false, tmpImagePath);
            }else{
                console.log('failed capture creation for ', tmpImagePath);
                callback(true);
            }
        });
    };
};