module.exports.hosconfig = {
    "localhost": {
        "s3": {
            "connection": {
                "accessKeyId": "XXXXXXXXXXXXXXXXXX",
                "secretAccessKey": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                "region": "eu-west-1"
            },
            "bucket": "BUCKET_NAME",
            "cdn": "http://CLOUDFRONT_DOMAIN.cloudfront.net"
        },
        validation: {
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
};
