$(document).ready(function(){

    var itemTemplate = _.template(
        '<div id="item-<%= id %>">' +
            '<div class="list-group-item" >' +
            '<% if(uploadFailure) { %>' +
                '<div class="row-action-primary"><i class="material-icons">Fail</i></div>'+
                '<div class="row-content">' +
                    '<h4 class="list-group-item-heading"><%= name %></h4> ' +
                    '<p class="list-group-item-text"><%= errorText %></p>' +
                '</div>' +
            '<% } else { %>'+
                '<% if(fileData) { %>'+
                    '<div class="row-action-primary"><a href="<%= fileData.storageLocation %>" target="_blank">' +
                        '<img src="<%= fileData.cdn %>/<%= fileData.preview %>">' +
                        '</a>'+
                    '</div>' +
                    '<div class="row-content">' +
                        '<div class="least-content"><%= fileData.size %> bytes</div>' +
                        '<h4 class="list-group-item-heading"><%= name %></h4>' +
                        '<p class="list-group-item-text"><%= fileData.type %> <%= fileData.width %>x<%= fileData.height %>' +
                        '</p>' +
                    '</div>'+
                '<% } else { %>'+
                    '<div class="row-action-primary"><img src="<%= preview %>"></div>' +
                    '<div class="row-content">' +
                        '<h4 class="list-group-item-heading"><%= name %></h4>' +
                        '<div class="progress progress-striped">' +
                            '<div class="progress-bar progress-bar-info" style="width: <%= progress %>%"></div>' +
                        '</div>' +
                    '</div>' +
                '<% } %>'+
            '<% } %>'+
            '<div class="list-group-separator"></div>'+
            '</div>'+
        '</div>');

    var container = $('#uploadFilesContainer');

    function updateItem(file){
        console.log(file.model.id);
        var item = container.find('#item-'+file.model.id);
        item.html(itemTemplate(file.model));
    }

    var UploaderModule = function(fileuploader) {
        var options = {
            url: 'http://localhost:8095/',
            dataType: 'json',
            limitConcurrentUploads:15,
            context: fileuploader[0],
            autoUpload: true,
            acceptFileTypes: /(\.|\/)(jpe?g|mp4)$/i,
            maxFileSize: 1000000 * 500, // 500 MB
            minFileSize: 5000, //5 KB
            formData:{ type: "awstest"},
            disableImageResize : true,
            imageForceResize : false,
            imageCrop: false,
            previewMaxWidth:125,
            previewMinWidth:125,
            previewMaxHeight:125,
            previewMinHeight:90
        };
        fileuploader.fileupload(
            options
        ).on('fileuploadprocessalways', function (e, data) {
            var file = data.files[0];
            var model = {name:file.name,
                        id:parseInt(Math.random() * 100000),
                        uploadFailure:false,
                        fileData:null,
                        progress:0};
            data.files[0].model = model;
            if (file.error || file.size < data.minFileSize) {
                console.log('error: ', file.error);
                model['uploadFailure'] = true;
                model['errorText'] = file.error;
            } else {
                model['preview'] = file.preview;
            }
            container.append(itemTemplate(model));
        }).on('fileuploadprocessstart', function (e, data) {
            console.log('process start');
        }).on('fileuploadprocessstop', function (e, data) {
            console.log('process stop');
        }).on('fileuploadstart', function (e, data) {
            console.log('upload start');
        }).on('fileuploadprogress', function (e, data) {
            var progress = parseInt((data.loaded * 100 / data.total), 10);
            data.files[0].model['progress'] = progress;
            updateItem(data.files[0]);
        }).on('fileuploaddone', function (e, data) {
            console.log('file uploaded');
            if(data.textStatus != "success") {
                console.log('error: ', data.files[0].name);
                data.files[0].model['uploadFailure'] = true;
                return;
            }
            var model = data.files[0].model;
            model.fileData = data.result.file;
            updateItem(data.files[0]);
        }).on('fileuploadstop', function(e, data){
            console.log('upload stop');
        }).on('fileuploadfail', function (e, data) {
            console.log('upload fail');
            var errorText = null;
            var errorID = null;
            try{
                errorID = parseInt(data.jqXHR.responseJSON['error']);
            }catch(e){
                console.log("Bad error status: ", data.jqXHR.responseJSON);
            }
            if(errorID && errorID == 10 || errorID == 15){
                errorText = 'Wrong file size';
            }
            if(errorID && errorID == 20 || errorID == 25 || errorID == 40){
                errorText = 'Wrong file format';
            }
            if(errorID && errorID == 30){
                errorText = 'Wrong resolution or aspect ratio';
            }
            if(errorID && errorID == 45){
                errorText = 'Wrong codec';
            }
            data.files[0].model['uploadFailure'] = true;
            data.files[0].model['errorText'] = errorText;
            console.log(errorText);
            updateItem(data.files[0]);
        });
    };


    UploaderModule($('#uploader'));
});

