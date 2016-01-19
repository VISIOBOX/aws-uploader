## О проекте

Node.js сервер multipart загрузки медиафайлов в **Amazon S3** хранилище с возможностью низкоуровневой валидации.

### Основные функции и возможности
* Multipart-загрузка видео-файлов и изображений в S3
* Низкоуровневая валидация медиафайлов с помощью кодеков.
* Создание превью для видеофайлов
* Гибкая конфигурация валидации файлов
* Конфигурация инстанса на основе доменов для работы с несколькими клиентами
* Отслеживание прогресса и статуса загрузки каждого файла на клиенте
* Поддержка плагина **JQuery-Fileupload**.

### Ограничения и зависимости
Проект представляет собой обертку над [**s3-upload-stream**] (https://github.com/nathanpeck/s3-upload-stream) 
и [**node-formidable**] (https://github.com/felixge/node-formidable) 
с использованием Express и несколькими библиотеками валидации медиафайлов.
На данный момент поддерживается загрузка видео файлов только формата MP4 с кодеком H264

## Конфигурация

### Настройка FFMPEG
Для возможности работы с видеофайлами необходимо установить FFMPEG с поддержкой кодека h264 и модуля ffprobe:
https://ffmpeg.org/download.html

Или самостоятельная сборка на примере Ubuntu: http://trac.ffmpeg.org/wiki/CompilationGuide/Ubuntu

После установки в консоле наберите:

1. `ffmpeg`. Ответ будет в стиле: ffmpeg version N-56671-ge024953 Copyright (c) 2000-2013 the FFmpeg developers ...
2. `ffprobe`. Ответ будет в стиле: ffprobe version N-56671-ge024953 Copyright (c) 2007-2013 the FFmpeg developers ...

### Конфигурация сервера
Конфигурация сервера находится в файле **config.json**
По умолчанию веб-сервер будет запущен на **localhost:8095**, вы можете изменить эти настройки по своему усмотрению.

### Конфигурация хостов и доступа к AWS
Конфигурационный файл **hostconf.js**
Простейший пример конфигурации для:
``` 
"some_domain.com": { //Домен, с которого будет производиться загрузка файлов. localhost for example
        "s3": {
            "connection": {
                "accessKeyId": "XXXXXXXXXXXXXXXXXX", //Amazon access key
                "secretAccessKey": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", //Amazon secret key
                "region": "eu-west-1"
            },
            "bucket": "BUCKET_NAME",
            "cdn": "http://CLOUDFRONT_DOMAIN.cloudfront.net"
        }
 }
```

### Конфигурация валидации
#### Конфигурация валидатора по умолчанию:
По умолчанию конфигурация валидации выглядит так (файл config.js):

```
{
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
}
```

Для расширения исходных параметров валидации, используйте переменную **validation** в файле **hostconf.js**:
``` 
"some_domain.com": {
     "s3": {
         "connection": {
             "accessKeyId": "XXXXXXXXXXXXXXXXXX", //Amazon access key
             "secretAccessKey": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", //Amazon secret key
             "region": "eu-west-1"
         },
         "bucket": "BUCKET_NAME",
         "cdn": "http://CLOUDFRONT_DOMAIN.cloudfront.net"
     },
     "validation": {
         dimensions: [
             {
                 maxFileWidth: 7000,
                 minFileWidth: 192,
                 maxFileHeight: 5000,
                 minFileHeight: 48,
                 width: 192,
                 height: 48,
                 ratio: [4, 1]
             },
             {
                 maxFileWidth: 7000,
                 minFileWidth: 192,
                 maxFileHeight: 5000,
                 minFileHeight: 64,
                 width: 1920,
                 height: 1080,
                 ratio: [16, 9]
             }
         ],
         video: {
             checkStrictly:true
         },
         image: {
             checkStrictly:false
         }
     }
}
```

#### Параметры валидации:
##### Корневые параметры:
* **minFileSize** - Минимальный размер файла в байтах. Не обязательный параметр, по умолчанию **5000** (5кб). 
* **maxFileSize** - Максимальный размер файла в байтах. Не обязательный параметр, по умолчанию **1000000000** (1гб).
* **acceptFileTypes** - Допустимые форматы файлов. Regex. Не обязательный параметр, по умолчанию **/\.(jpe?g|png|mp4)$/i** (JPEG, JPG, PNG, MP4). 
* **acceptMimeTypes** - Допустимые mime-type файлов. Regex. Не обязательный параметр, 
по умолчанию **/(image\/jpe?g||image\/png|video\/mp4|application\/mp4)$/i** (image/jpeg, image/jpg, image/png, video/mp4, application/mp4). 

##### Параметры секции **dimensions**: 
* **maxFileWidth** - Максимальная ширина медиафайла. Обязательный параметр если **checkStrictly=false**.
* **minFileWidth** - Минимальная ширина медиафайла. Обязательный параметр если **checkStrictly=false**. 
* **maxFileHeight** - Максимальная высота медиафайла. Обязательный параметр если **checkStrictly=false**.
* **minFileHeight** - Минимальная высота медиафайла. Обязательный параметр если **checkStrictly=false**.
* **width** - Строгая валидация ширины файла. Обязательный параметр если **checkStrictly=true**.
* **height** - Строгая валидация высоты файла. Обязательный параметр если **checkStrictly=true**.
* **ratio** - Проверка aspect ratio. Не обязательный параметр.

##### Параметры секции **video** и **image**:
*  **checkStrictly** - Если **true**, высота и ширина файла проверяется строго по **width** и **height** параметрам. Не обязательный параметр. По умолчанию **false**

## Формат ответа
Для каждого загружаемого файла при завершении загрузки выдается следующий ответ:
```
{
  "file": {
      "name": "lamborghini_44-wallpaper-2400x1350.jpg",
      "size": 795206,
      "mime": "image/jpeg",
      "path": "content/13-01-2016/84cb1834a3e242d43e407501daf6cc00e73398585760929d0d6d0cfeb4c2381e.jpg",
      "error": false,
      "errorStatus": 0,
      "expectedSize": 795516,
      "cdn": "http://CLOUDFRONT_DOMAIN.cloudfront.net",
      "storageLocation": "https://BUCKET_NAME.s3-eu-west-1.amazonaws.com/content%2F13-01-2016%2F84cb1834a3e242d43e407501daf6cc00e73398585760929d0d6d0cfeb4c2381e.jpg",
      "type": "image",
      "codec": null,
      "width": 2400,
      "height": 1350,
      "duration": 0,
      "valid": true,
      "preview": "content/13-01-2016/84cb1834a3e242d43e407501daf6cc00e73398585760929d0d6d0cfeb4c2381e.jpg"
  }
}
```

Возможно, следующие параметры требуют пояснения:

* **path** - URI файла в CDN Cloud Front
* **preview** - URI превью файла в CDN Cloud Front (Для изображения будет тем-же, что и path)
* **codec** - Тип кодека проставляется только для видео.
* **duration** - Длительность для видео в секундах.

### Статусы валидации:
Возвращается параметром **errorStatus** в ответе:

 * **0** - OK
 * **10** - File is too small
 * **15** - File is too big
 * **20** - Bad ContentType
 * **25** - Bad filetype
 * **30** - Bad dimension
 * **40** - Bad format
 * **45** - Bad codec


## Пример и запуск
###Запуск aws-uploader:
* Установка зависимостей: `npm install`
* Запуск: `node server`

Перед запуском выполните необходимую конфигурацию проекта.

###Запуск примера:
* Команда: `node example`
* Доступно по адресу: http://localhost:8050

Если вы меняли конфигурацию и адрес сервера загрузчика, 
внесите необходимые изменения в файл **aws-uploader/example/public/js/uploader.js**


## Простая загрузка
Простая загрузка доступна по uri **/simpleupload** только для изображений с конфигурацией по умолчанию:
```
{
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
```
Простая загрузка дает возможность грузить изображения без строгой валидации и без необходимости определять конфигурацию. 
Это допустимо, например, для загрузки аватарок. 

## TODO
* Не обязательная валидация видео и изображений.
* Отдельные конфигурации валидации для разных типов файлов.
* Указание в конфигурации, какие параметры файлов нужно валидировать.
* Вынести пути хранения локальных файлов в конфигурационный файл.
* Вынести типы видео-кодеков в конфигурационный файл.
* Загрузка и валидация видео других форматов.
* Загрузка аудиофайлов.
* Работа с локальным хранилищем и другими типами облачных хранилищ.
* Генерация различных превью медиафайлов указанных в конфигурации. 

