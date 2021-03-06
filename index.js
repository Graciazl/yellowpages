/**
 * Created by Gracia on 17/2/13.
 */

var http = require('http'),
    URL = require('url'),
    iconv = require('iconv-lite'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    path = require('path'),
    async = require('async');

var yellowpage51ca = 'http://www.51.ca/service/servicedisplay.php?s=218a1f619be430d93fbfa1872669596e&serviceid=3',
    yellowpageYork = 'http://info.yorkbbs.ca/default/zhusu';

var key = 'localImages',
    eleYorkBBS = '.item-sort',
    ele51CA = '.itempos',
    prefixYorkBBS = 'http://info.yorkbbs.ca',
    prefix51CA = 'http://www.51.ca/service/',
    prefixYorkBBSImg = 'http://i.ybbs.ca/media/c1/';

function loadHttp(url, callback) {
    var options = URL.parse(url);

    options.headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.65 Safari/537.36'
    };

    return new Promise(function (resolve, reject) {
        var req = http.get(options, function (response) {
            var html = [];

            response.on('data', function (data) {
                html.push(data);
            });

            response.on('end', function () {
                var result = callback(html);

                resolve(result);
            });
        });

        req.on('error', function (err) {
            if (err.code === 'ENOTFOUND') {
                console.log('err:' + 'Can not open ' + url);
            } else if (err.code === 'ECONNRESET') {
                req.setTimeout(60000, function () {
                    req.abort();
                });
            } else {
                reject(err);
            }
        });

        req.end();
    });
}

function getUtf8(html) {
    return html.toString('utf8');
}

function getGb2312(html) {
    var buffer = Buffer.concat(html);
    return iconv.decode(buffer, 'gb2312');
}

function getImgBuffer(chunk) {
    return Buffer.concat(chunk);
}

function getDom(html) {
    return new Promise(function (resolve, reject) {
        var body = cheerio.load(html);
        resolve(body);
    });
}

function getUrlList(body, ele, prefix) {
    var $ = body,
        urlList = [],
        intactUrl = [];

    var items = $(ele).get().length;

    for (var item = 0; item < items; item++) {
        var url = $(ele).eq(item).siblings().attr('href');
        urlList.push(url);
    }

    intactUrl = urlList.map(function (e) {
        return prefix + e;
    });

    return intactUrl;
}

function getUrlListYorkBBS(url) {
    return new Promise(function (resolve, reject) {
        var urlList = getUrlList(url, eleYorkBBS, prefixYorkBBS);
        resolve(urlList);
    });
}

function getUrlList51CA(url) {
    return new Promise(function (resolve, reject) {
        var urlList = getUrlList(url, ele51CA, prefix51CA);
        resolve(urlList);
    });
}

function getPageYorkBBS(data) {
    return new Promise(function (resolve, reject) {
        var $ = data[0],
            url = data[1],
            content = {};

        var imgUrlList = getImagesURL($, '.views-detail-text', 'img', 'src');

        content.name = $('.views > h1').text().trim();
        content.category = $('#SubCategoryName').text();
        content.tags = getTags('.item-cont-tags');
        content.contact = $('.item-views-cont').eq(0).children().first().find('span > em').first().text();
        content.phone = $('.item-cont-bigphone').children().first().text();
        content.phone2 = '';
        content.language = $('.item_cont_lg').children().text();
        content.email = getEmail('.item-views-cont-email');
        content.serviceArea = '';
        content.address = $('.views-bigphone-address').text().trim();
        content.postalCode = '';
        content.coordinates = $('.adver-map').children().last().children().eq(0).attr('href');
        content.homepage = $('.item-views-cont').eq(0).children().last().find('span > em > a').attr('href');
        content.updateTime = $('.postmeta').children().last().text().split('：')[1];
        content.uploadImages = getRewritedUrl(prefixYorkBBSImg, imgUrlList);
        content.localImages = '';
        content.url = url;
        content.id = $('.postmeta').children().first().text().split('：')[1];

        function getTags(ele) {
            var tagsArr = [];

            $(ele).children().each(function (index) {
                tagsArr.push($(this).text());
            });

            return tagsArr.join(',');
        }

        function getEmail(ele) {
            var encodeStr = $(ele).children().attr('href');

            if (encodeStr !== undefined) {
                var encodeEmail = encodeStr.split('#')[1];

                return emailDecode(encodeEmail);

            } else {
                return '';
            }
        }

        function getRewritedUrl(prefix, imgUrl) {
            if (imgUrl !== '') {
                var imgUrlArr = imgUrl.split(',');

                var imgRewritedUrl = imgUrlArr.map(function (e) {
                    var baseUrl = path.basename(e),
                        dirUrl = path.dirname(e),
                        ext = path.extname(e);

                    if (baseUrl.indexOf('_') !== -1 && dirUrl.indexOf('ybbs') !== -1) {
                        return prefix + baseUrl.split('_')[0] + ext;
                    } else {
                        return e;
                    }
                });

                return imgRewritedUrl.join(',');

            } else {
                return '';
            }
        }

        var result = [content, content.id, content.uploadImages];

        resolve(result);
    });
}

function emailDecode(encodeEmail) {
    var email = '',
        r = parseInt(encodeEmail.substr(0, 2), 16),
        len = encodeEmail.length;

    for (var n = 2; n < len - 1; n += 2) {
        var i = parseInt(encodeEmail.substr(n, 2), 16) ^ r;
        email += String.fromCharCode(i);
    }

    return email;
}

function getPage51CA(data) {
    return new Promise(function (resolve, reject) {
        var $ = data[0],
            url = data[1],
            content = {};

        content.name = $('.MainTitle').text();
        content.category = getValue('.ColumnTitle', 0);
        content.tags = '';
        content.contact = getValue('.ColumnTitle', 3);
        content.phone = getValue('.ColumnTitle', 4);
        content.phone2 = getValue('.ColumnTitle', 6);
        content.language = getLanguage('#CatTitleBox > span > img');
        content.email = getEmail('.ColumnTitle', 5);
        content.serviceArea = getValue('.ColumnTitle', 7);
        content.address = getValue('.ColumnTitle', 9);
        content.postalCode = '';
        content.coordinates = $('.ColumnTitle').eq(8).siblings().attr('href');
        content.homepage = '';
        content.updateTime = getValue('.ColumnTitle', 1);
        content.uploadImages = getImagesURL($, 'body', '.picsSlideGroup', 'href');
        content.localImages = '';
        content.url = url;
        content.id = $('input[name="itemid"]').attr('value');

        function getValue(ele, index) {
            return $(ele).eq(index).parent().text().split('】')[1];
        }

        function getEmail(ele, index) {
            var node = $(ele).eq(index).siblings();

            if (node.attr('href') === undefined) {
                return '';
            } else {
                return node.attr('href').split(':')[1];
            }
        }

        function getLanguage(ele) {
            var lan = [];

            $(ele).each(function () {
                switch ($(this).attr('src')) {
                    case 'http://www.51.ca/images/lang_e.gif':
                        lan.push('英');
                        break;

                    case 'http://www.51.ca/images/lang_m.gif':
                        lan.push('国');
                        break;

                    case 'http://www.51.ca/images/lang_c.gif':
                        lan.push('粤');
                        break;
                }
            });

            return lan.join(',');
        }

        var result = [content, content.id, content.uploadImages];

        resolve(result);
    });
}

function getImagesURL(body, ele1, ele2, attr) {
    var imgArr = [],
        $ = body;

    if ($(ele1).has(ele2)) {
        $(ele1).find(ele2).each(function (index) {
            imgArr.push($(this).attr(attr));
        });

        return imgArr.join(',');

    } else {
        return '';
    }
}

function saveImage(url, fileName) {
    loadHttp(url, getImgBuffer)
        .then(function (imgBuffer) {
            fs.writeFile(fileName, imgBuffer, function (err) {
                if (err) {
                    return reject(err);
                }
            });
        });
}

function createFolder(folder) {
    fs.mkdir(folder, function (err) {
        if (err) {
            return reject(err);
        }
    });
}

function checkFolderExists(folder) {
    fs.readdir(folder, function (err, files) {
        if (err) {
            if (err.code === 'ENOENT') {
                createFolder(folder);
            } else {
                return reject(err);
            }
        }
    });
}

function createPath(folder, url) {
    var fileName = path.basename(url);

    return path.join(folder, fileName);
}

function imageProcess(data, key) {
    var content = data[0],
        id = data[1],
        imgs = data[2],
        imgPath = [];

    if (imgs !== '') {
        var imgsUrl = imgs.split(',');

        checkFolderExists(id);

        async.mapLimit(imgsUrl, 1, function (url, callback) {
            var filePath = createPath(id, url);

            saveImage(url, filePath);
            imgPath.push(filePath);

            callback(null);
        });
    }

    content[key] = imgPath.join(',');

    return content;
}

function downloadImages(data) {
    return new Promise(function (resolve, reject) {
        var result = imageProcess(data, key);
        resolve(result);
    });
}

function contentProcessYorkBBS(url) {
    var body = loadHttp(url, getUtf8).then(getDom);

    return Promise.all([body, url])
        .then(getPageYorkBBS)
        .then(downloadImages)
        .then(function (data) {
            console.log(data);
        });
}

function contentProcess51CA(url) {
    var body = loadHttp(url, getGb2312).then(getDom);

    return Promise.all([body, url])
        .then(getPage51CA)
        .then(downloadImages)
        .then(function (data) {
            console.log(data);
        });
}

loadHttp(yellowpage51ca, getGb2312)
    .then(getDom)
    .then(getUrlList51CA)
    .then(function (urls) {
        async.mapLimit(urls, 1, function (url, callback) {
            contentProcess51CA(url);
            callback(null);
        });
    });

loadHttp(yellowpageYork, getUtf8)
    .then(getDom)
    .then(getUrlListYorkBBS)
    .then(function (urls) {
        async.mapLimit(urls, 1, function (url, callback) {
            contentProcessYorkBBS(url);
            callback(null);
        });
    });