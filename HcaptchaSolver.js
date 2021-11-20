// ==UserScript==
// @name         drcaptcha
// @namespace    Hcaptcha 
// @version      4.3
// @description  autosolve
// @author       Mashud Rana
// @match        *://*.hcaptcha.com/*hcaptcha-challenge*
// @match        *://*.hcaptcha.com/*checkbox*
// @grant        GM_xmlhttpRequest
// @connect      www.imageidentify.com
// @connect      https://cdnjs.cloudflare.com
// @connect      https://cdn.jsdelivr.net
// @connect      https://unpkg.com
// @connect      *://*.hcaptcha.com/*
// @require      https://unpkg.com/jimp@0.5.2/browser/lib/jimp.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/2.0.0-alpha.2/tesseract.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd

// ==/UserScript==
(function() {

    //TODO: Enable debug mode to print console logs
    'use strict';
    var selectedImageCount = 0;
    var tensorFlowModel = undefined;
    var worker = undefined;

    var identifiedObjectsList = [];
    var exampleImageList = [];
    var identifyObjectsFromImagesCompleted = false;
    var currentExampleUrls = [];

    //Node Selectors
    const CHECK_BOX = "#checkbox";
    const SUBMIT_BUTTON = ".button-submit";
    const TASK_IMAGE_BORDER = ".task-image .border";
    const IMAGE = ".task-image .image";
    const TASK_IMAGE = ".task-image";
    const PROMPT_TEXT = ".prompt-text";
    const NO_SELECTION = ".no-selection";
    const CHALLENGE_INPUT_FIELD = ".challenge-input .input-field";
    const CHALLENGE_INPUT = ".challenge-input";
    const CHALLENGE_IMAGE = ".challenge-example .image .image";
    const IMAGE_FOR_OCR = ".challenge-image .zoom-image";

    //Attributes
    const ARIA_CHECKED = "aria-checked";
    const ARIA_HIDDEN = "aria-hidden";

    //Values that can be changed for other languages
    const AIRPLANE = "airplane";
    const BICYCLE = "bicycle";
    const BOAT = "boat";
    const BUS = "bus";
    const CAR = "car";
    const MOTORBUS = "motorbus";
    const MOTORCYCLE = "motorcycle";
    const SURFBOARD = "surfboard";
    const TRAIN = "train";
    const TRUCK = "truck";
    const TRANSPORT_TYPES = [AIRPLANE, BICYCLE, BOAT, BUS, CAR, MOTORBUS, MOTORCYCLE, SURFBOARD, TRAIN, TRUCK];

    const SENTENCE_TEXT_A = "Please click each image containing a ";
    const SENTENCE_TEXT_AN = "Please click each image containing an ";
    const LANGUAGE_FOR_OCR = "eng";

    // Option to override the default image matching
    const ENABLE_TENSORFLOW = false;

    // Max Skips that can be done while solving the captcha
    // This is likely not to happen, if it occurs retry for new images
    const MAX_SKIPS = 10;
    var skipCount = 0;

    String.prototype.includesOneOf = function(arrayOfStrings) {

        //If this is not an Array, compare it as a String
        if (!Array.isArray(arrayOfStrings)) {
            return this.toLowerCase().includes(arrayOfStrings.toLowerCase());
        }

        for (var i = 0; i < arrayOfStrings.length; i++) {
            if ((arrayOfStrings[i].substr(0, 1) == "=" && this.toLowerCase() == arrayOfStrings[i].substr(1).toLowerCase()) ||
                (this.toLowerCase().includes(arrayOfStrings[i].toLowerCase()))) {
                return true;
            }
        }
        return false;
    }

    String.prototype.equalsOneOf = function(arrayOfStrings) {

        //If this is not an Array, compare it as a String
        if (!Array.isArray(arrayOfStrings)) {
            return this.toLowerCase() == arrayOfStrings.toLowerCase();
        }

        for (var i = 0; i < arrayOfStrings.length; i++) {
            if ((arrayOfStrings[i].substr(0, 1) == "=" && this.toLowerCase() == arrayOfStrings[i].substr(1).toLowerCase()) ||
                (this.toLowerCase() == arrayOfStrings[i].toLowerCase())) {
                return true;
            }
        }
        return false;
    }



    // This script uses imageidentify API (wolfram) . You may also use TensorFlow.js, Yolo latest version to recognize common objects.
    //(When the cloud service is available for yolo, we can switch the API endpoint). Accuracy varies between Wolfram, Tensorflow and Yolo.
    // Use this as a reference to solve recaptcha/other captchas using scripts in browser. This is intended for learning purposes.
    // Using TensorFlow as fallback, but this requires good CPU in order to solve quickly.
    // CPU utilization and memory utlization may go high when using TensorFlow.js
    function matchImages(imageUrl, word, i) {

        XMLHttpRequest({
            method: "POST",
            url: "https://www.imageidentify.com/objects/user-26a7681f-4b48-4f71-8f9f-93030898d70d/prd/urlapi/",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data: "image=" + encodeURIComponent(imageUrl),
            timeout: 8000,
            onload: function(response) {
                clickImages(response, imageUrl, word, i)
            },
            onerror: function(e) {
                //Using Fallback TensorFlow
                if(e && e.status && e.status != 0){
                    console.log(e);
                    console.log("Using Fallback");
                }
                matchImagesUsingTensorFlow(imageUrl, word, i);

            },
            ontimeout: function() {
                //console.log("Timed out. Using Fallback");
                matchImagesUsingTensorFlow(imageUrl, word, i);
            },
        });

    }

    function matchImagesUsingTensorFlow(imageUrl, word, i) {
        try {
            let img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = imageUrl;
            img.onload = () => {
                initializeTensorFlowModel().then(model => model.detect(img))
                    .then(function(predictions) {
                    var predictionslen = predictions.length;
                    for (var j = 0; j < predictionslen; j++) {
                        if (qSelectorAll(IMAGE)[i] && (qSelectorAll(IMAGE)[i].style.background).includes(imageUrl) &&
                            qSelectorAll(TASK_IMAGE_BORDER)[i].style.opacity == 0 &&
                            predictions[j].class.includesOneOf(word)) {
                            qSelectorAll(TASK_IMAGE)[i].click();
                            break;
                        }
                    }
                    img.removeAttribute("src");
                    selectedImageCount = selectedImageCount + 1;
                });
            }
        } catch (err) {
            console.log(err.message);
        }
    }

    //Function to sleep or delay
    async function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    //Different Models can be set later based on usecase
    //Ref Models: https://github.com/tensorflow/tfjs-models
    async function initializeTensorFlowModel() {
        if (!tensorFlowModel) {
            tensorFlowModel = await cocoSsd.load();
        }
        return tensorFlowModel;
    }

    //Initialize TesseractWorker
    function initializeTesseractWorker() {
        if(!worker){
            worker = new Tesseract.TesseractWorker();
        }
    }

    function clickImages(response, imageUrl, word, i) {

        try {
            if (response && response.responseText && (qSelectorAll(IMAGE)[i].style.background).includes(imageUrl) &&
                qSelectorAll(TASK_IMAGE_BORDER)[i].style.opacity == 0) {
                var responseJson = JSON.parse(response.responseText);
                if (responseJson.identify && responseJson.identify.title && responseJson.identify.title.includesOneOf(word)) {
                    qSelectorAll(TASK_IMAGE)[i].click();
                } else if (responseJson.identify && responseJson.identify.entity && responseJson.identify.entity.includesOneOf(word)) {
                    qSelectorAll(TASK_IMAGE)[i].click();
                } else if (responseJson.identify && responseJson.identify.alternatives) {
                    var alternatives = JSON.stringify(responseJson.identify.alternatives);
                    var alternativesJson = JSON.parse(alternatives);

                    for (var key in alternativesJson) {
                        if (alternativesJson.hasOwnProperty(key)) {
                            if ((alternativesJson[key].includesOneOf(word) || key.includesOneOf(word))) {
                                qSelectorAll(TASK_IMAGE)[i].click();
                                break;
                            }
                        }
                    }
                } else {
                    //No Match found
                }

                selectedImageCount = selectedImageCount + 1;

            } else {
                //console.log("Using Fallback TensorFlow");
                matchImagesUsingTensorFlow(imageUrl, word, i);
            }

        } catch (err) {
            //Using Fallback TensorFlow
            //console.log(err.message);
            //console.log("Using Fallback TensorFlow");
            matchImagesUsingTensorFlow(imageUrl, word, i);
        }
    }

    function qSelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    function qSelector(selector) {
        return document.querySelector(selector);
    }


    async function getSynonyms(word) {

        //TODO: Format this to JSON string
        if (word == MOTORBUS || word == BUS) {
            word = ['bus', 'motorbus'];
        } else if (word == CAR) {
            word = ['=car', 'coupe', 'jeep', 'limo', 'sport utility vehicle', 'station wagon', 'hatchback', 'bumper car', 'modelT', 'electric battery', 'cruiser'];
        } else if (word == AIRPLANE) {
            word = ['airplane', 'plane', 'aircraft', 'aeroplane', 'hangar', 'Airdock', 'JumboJet', 'jetliner', 'stealth fighter', 'field artillery']
        } else if (word == TRAIN) {
            word = ['train', 'rail', 'cable car', 'locomotive', 'subway station']
        } else if (word == BOAT || word == SURFBOARD) {
            word = ['=boat', '=barge', 'houseboat', 'bobsled', 'pontoon', 'small boat', 'SnowBlower', 'Sea-coast', 'PaddleSteamer', 'Freighter', 'Sternwheeler', 'kayak', 'canoe', 'deck', 'DockingFacility', 'surfboard', 'ship', '=cruise', 'watercraft', 'sail', 'canvas', '=raft']
        } else if (word == BICYCLE) {
            word = ['bicycle', 'tricycle', 'mountain bike', 'AcceleratorPedal', 'macaw', 'knot']
        } else if (word == MOTORCYCLE) {
            word = ['scooter', 'motorcycle', 'windshield', 'dashboard']
        } else if (word == TRUCK) {
            word = ['truck', 'cargocontainer', 'bazooka']
        } else {
            console.log("Word does not match. New type identified::" + word);
        }

        return word

    }

    function isHidden(el) {
        return (el.offsetParent === null)
    }

    if (window.location.href.includes("checkbox")) {
        var checkboxInterval = setInterval(function() {
            if (!qSelector(CHECK_BOX)) {
                //Wait until the checkbox element is visible
            } else if (qSelector(CHECK_BOX).getAttribute(ARIA_CHECKED) == "true") {
                clearInterval(checkboxInterval);
            } else if (!isHidden(qSelector(CHECK_BOX)) && qSelector(CHECK_BOX).getAttribute(ARIA_CHECKED) == "false") {
                qSelector(CHECK_BOX).click();
            } else {
                return;
            }

        }, 5000);
    } else {

        try {
            initializeTesseractWorker();
            selectImages();

        } catch (err) {
            console.log(err);
            console.log("Tesseract could not be initialized");
        }

    }

    function selectImagesAfterDelay(delay) {
        setTimeout(function() {
            selectImages();
        }, delay * 1000);
    }

    function triggerEvent(el, type) {
        var e = document.createEvent('HTMLEvents');
        e.initEvent(type, false, true);
        el.dispatchEvent(e);
    }

    // Small hack to select the nodes
    function unsure(targetNodeText) {
        var targetNode = Array.from(qSelectorAll('div'))
        .find(el => el.textContent === targetNodeText);
        //Works for now
        //TODO: Select clothing
        //TODO: Draw boxes around images
        if (targetNode) {
            triggerEvent(targetNode, 'mousedown');
            triggerEvent(targetNode, 'mouseup');
            if (qSelector(SUBMIT_BUTTON)) {
                qSelector(SUBMIT_BUTTON).click();
            }
        }
        return selectImagesAfterDelay(1);
    }

    function getUrlFromString(urlString) {
        var urlMatch = urlString.match(/(?<=\(\").+?(?=\"\))/g);
        if (!urlMatch) {
            return 0;
        }
        var imageUrl = urlMatch[0];
        return imageUrl;
    }


    function getImageList() {
        var imageList = [];
        if (qSelectorAll(IMAGE).length > 0) {
            for (var i = 0; i < 9; i++) {
                var urlString = qSelectorAll(IMAGE)[i].style.background;
                var imageUrl = getUrlFromString(urlString);
                if (imageUrl == 0) {
                    //console.log("Image url is empty");
                    return imageList;
                }
                imageList[i] = imageUrl;
            }
        }
        return imageList;
    }

    function waitUntilImageSelection() {
        var imageIntervalCount = 0;
        var imageInterval = setInterval(function() {
            imageIntervalCount = imageIntervalCount + 1;
            if (selectedImageCount == 9) {
                clearInterval(imageInterval);
                if (qSelector(SUBMIT_BUTTON)) {
                    qSelector(SUBMIT_BUTTON).click();
                }
                return selectImagesAfterDelay(5);
            } else if (imageIntervalCount > 8) {
                clearInterval(imageInterval);
                return selectImages();
            } else {

            }
        }, 3000);
    }

    function waitForImagesToAppear() {
        var checkImagesSelectedCount = 0;
        var waitForImagesInterval = setInterval(function() {
            checkImagesSelectedCount = checkImagesSelectedCount + 1;
            if (qSelectorAll(IMAGE) && qSelectorAll(IMAGE).length == 9) {
                clearInterval(waitForImagesInterval);
                return selectImages();
            } else if (checkImagesSelectedCount > 60) {
                clearInterval(waitForImagesInterval);
            } else if (qSelector(CHALLENGE_INPUT_FIELD) && qSelector(NO_SELECTION).getAttribute(ARIA_HIDDEN) != true) {
                clearInterval(waitForImagesInterval);
                return imageUsingOCR();
            } else {
                //TODO: Identify Objects for the following (Ex: bed,chair,table etc)
                //Ref for clothing: https://www.youtube.com/watch?v=yWwzFnAnrLM, https://www.youtube.com/watch?v=FiNglI1wRNk,https://www.youtube.com/watch?v=oHAkK_9UCQ8
                var targetNodeList = ["3 or more items of furniture", "Equipped space or room", "Photo is clean, no watermarks, logos or text overlays", "An interior photo of room", "Unsure", "Photo is sharp"];
                for (var j = 0; j < targetNodeList.length; j++) {
                    var targetNode = Array.from(qSelectorAll('div'))
                    .find(el => el.textContent === targetNodeList[j]);
                    if (targetNode) {
                        //console.log("Target Node Found");
                        clearInterval(waitForImagesInterval);
                        return unsure(targetNodeList[j]);
                    }
                }
            }
        }, 5000);
    }

    //TODO: Convert Image to base64 to avoid multiple calls
    function preProcessImage(imageUrl) {

        //Darken and Brighten
        Jimp.read(imageUrl).then(function(data) {
            data.color([

                {
                    apply: 'darken',
                    params: [20]
                }

            ]).color([

                {
                    apply: 'brighten',
                    params: [20]
                }

            ])
                .greyscale()
                .getBase64(Jimp.AUTO, function(err, src) {
                var img = document.createElement("img");
                img.setAttribute("src", src);

                worker.recognize(img, LANGUAGE_FOR_OCR).then(function(data) {
                    //Remove Image After recognizing
                    img.removeAttribute("src");
                    //If null change to other methods
                    if (data && data.text && data.text.length > 0) {
                        inputChallenge(postProcessImage(data), imageUrl);
                        return selectImages();
                    } else {
                        preProcessImageMethod2(imageUrl);
                    }
                });

            });
        });

    }


    function preProcessImageMethod2(imageUrl) {

        //Multi Contrast darken and brighten
        Jimp.read(imageUrl).then(function(data) {
            data.color([

                {
                    apply: 'darken',
                    params: [20]
                }

            ]).contrast(1).color([

                {
                    apply: 'brighten',
                    params: [20]
                }

            ]).contrast(1).greyscale().getBase64(Jimp.AUTO, function(err, src) {
                var img = document.createElement("img");
                img.setAttribute("src", src);

                worker.recognize(img, LANGUAGE_FOR_OCR).then(function(data) {
                    //Remove Image After recognizing
                    img.removeAttribute("src");
                    if (data && data.text && data.text.length > 0) {
                        inputChallenge(postProcessImage(data), imageUrl);
                        return selectImages();
                    } else {
                        preProcessImageMethod3(imageUrl);
                    }
                });
            });
        });

    }

    function preProcessImageMethod3(imageUrl) {
        //Multi Contrast only brighten
        Jimp.read(imageUrl).then(function(data) {
            data.contrast(1).color([{
                apply: 'brighten',
                params: [20]
            }

                                   ])
                .contrast(1)
                .greyscale()
                .getBase64(Jimp.AUTO, function(err, src) {
                var img = document.createElement("img");
                img.setAttribute("src", src);

                worker.recognize(img, LANGUAGE_FOR_OCR).then(function(data) {
                    //Remove Image After recognizing
                    img.removeAttribute("src");
                    if (data && data.text && data.text.length > 0) {
                        inputChallenge(postProcessImage(data), imageUrl);
                        return selectImages();
                    } else {
                        preProcessImageMethod4(imageUrl);
                    }
                });
            });
        });
    }

    function preProcessImageMethod4(imageUrl) {
        //Resize the image
        Jimp.read(imageUrl).then(function(data) {
            data.resize(256, Jimp.AUTO)
                .quality(60) // set JPEG quality
                .greyscale() // set greyscale
                .getBase64(Jimp.AUTO, function(err, src) {
                var img = document.createElement("img");
                img.setAttribute("src", src);

                worker.recognize(img, LANGUAGE_FOR_OCR).then(function(data) {
                    //Remove Image After recognizing
                    img.removeAttribute("src");
                    inputChallenge(postProcessImage(data), imageUrl);
                    return selectImages();
                });
            });
        });

    }

    function postProcessImage(data) {
        var filterValues = ['\n', '{', '}', '[', ']'];
        for (var i = 0; i < filterValues.length; i++) {
            data.text = data.text.replaceAll(filterValues[i], "");
        }
        return data;
    }

    // Using Tesseract to recognize images
    function imageUsingOCR() {
        try {
            //console.log("Image using OCR");
            var urlString = qSelector(IMAGE_FOR_OCR).style.background;
            var imageUrl = getUrlFromString(urlString);
            if (imageUrl == 0) {
                return selectImagesAfterDelay(1);
            }

            preProcessImage(imageUrl);

        } catch (err) {
            console.log(err.message);
            return selectImagesAfterDelay(1);
        }
    }


    async function convertTextToImage(text) {

        //Convert Text to image
        var canvas = document.createElement("canvas");
        canvas.width = 620;
        canvas.height = 80;
        var ctx = canvas.getContext('2d');
        ctx.font = "30px Arial";
        ctx.fillText(text, 10, 50);
        var img = document.createElement("img");
        img.src = canvas.toDataURL();

        return img;
    }

    async function convertImageToText(img) {

        //Convert Image to Text
        var text = "";
        await worker.recognize(img, LANGUAGE_FOR_OCR).then(function(data) {
            text = data.text;
            // console.log("Recognized Text::" + text);
        });
        return text.trim();
    }

    function areExampleImageUrlsChanged(){

        var prevExampleUrls = exampleImageList;
        currentExampleUrls = [];

        if (qSelectorAll(CHALLENGE_IMAGE).length > 0) {
            for (let i = 0; i < qSelectorAll(CHALLENGE_IMAGE).length; i++) {
                var urlString = qSelectorAll(CHALLENGE_IMAGE)[i].style.background;
                var imageUrl = getUrlFromString(urlString);
                if (imageUrl == 0) {
                    console.log("Image url is empty, Retrying...");
                    return true;
                }
                currentExampleUrls[i] = imageUrl;
            }
        }

        if(prevExampleUrls.length != currentExampleUrls.length){
            return true;
        }

        for(let i=0; i< currentExampleUrls.length;i++){

            if(prevExampleUrls[i] != currentExampleUrls[i]){
                return true;
            }
        }

        return false;
    }

    async function identifyObjectsFromImages(imageUrlList){
        identifiedObjectsList = [];

        for(let i=0;i< imageUrlList.length; i++){
            try {
                let img = new Image();
                img.crossOrigin = "Anonymous";
                img.src = imageUrlList[i];
                img.onload = () => {
                    initializeTensorFlowModel().then(model => model.detect(img))
                        .then(function(predictions) {
                        let predictionslen = predictions.length;
                        let hashSet = new Set();
                        for (let j = 0; j < predictionslen; j++) {
                            hashSet.add(predictions[j].class);
                        }

                        hashSet.forEach((key) => {
                            identifiedObjectsList.push(key);
                        });

                        img.removeAttribute("src");

                        if(i == imageUrlList.length-1){
                            identifyObjectsFromImagesCompleted = true;
                        }

                    })
                }
            }catch(e){
                console.log(e);
            }

        }

    }

    async function getWordFromIdentifiedObjects(identifiedObjectsList){

        var hashMap = new Map();
        for (var i = 0; i < identifiedObjectsList.length; i++)
        {
            if(hashMap.has(identifiedObjectsList[i])){
                hashMap.set(identifiedObjectsList[i], hashMap.get(identifiedObjectsList[i])+1)
            }
            else{
                hashMap.set(identifiedObjectsList[i], 1)
            }
        }
        var maxCount = 0, objectKey = -1;
        await hashMap.forEach((value,key) => {
            if (maxCount < value && key.equalsOneOf(TRANSPORT_TYPES)) {
                objectKey = key;
                maxCount = value;
            }

        });

        return objectKey;
    }


    function inputChallenge(data, imageUrl) {
        try {
            if ((qSelector(IMAGE_FOR_OCR).style.background).includes(imageUrl)) {
                console.log(data.text);
                var targetNode = qSelector(CHALLENGE_INPUT_FIELD);
                targetNode.value = data.text.replaceAll("\n", "");
                var challengeInput = qSelector(CHALLENGE_INPUT);
                triggerEvent(challengeInput, 'input');
                // Set a timeout if you want to see the text
                qSelector(SUBMIT_BUTTON).click();
            }

        } catch (err) {
            console.log(err.message);
        }
    }

    async function identifyWordFromExamples(){

        if(areExampleImageUrlsChanged()){
            exampleImageList = currentExampleUrls;
            if(exampleImageList.length == 0){
                return -1;
            }
            identifyObjectsFromImages(exampleImageList);
            while (!identifyObjectsFromImagesCompleted) {
                await delay(2000)
            }
            identifyObjectsFromImagesCompleted = false;

        }
        return getWordFromIdentifiedObjects(identifiedObjectsList);

    }

    async function identifyWord() {
        var word = -1;
        try{
            word = qSelector(PROMPT_TEXT).innerText;
            if (word && (word.includes(SENTENCE_TEXT_A) || word.includes(SENTENCE_TEXT_AN))) {
                word = word.replace(SENTENCE_TEXT_A, '');
                word = word.replace(SENTENCE_TEXT_AN, '');
            }

            //If word is not english or has different cyrillic
            //Identify Images from Example
            //OCR on Text was used in previous versions
            if (!word.equalsOneOf(TRANSPORT_TYPES)) {
                word = await identifyWordFromExamples();
            }
        }catch(e){
            console.log(e);
        }

        return word;
    }


    async function selectImages() {

        if (qSelectorAll(IMAGE) && qSelectorAll(IMAGE).length == 9 && qSelector(NO_SELECTION).getAttribute(ARIA_HIDDEN) != true) {
            selectedImageCount = 0;
            try {
                await initializeTensorFlowModel();

                var word = await identifyWord();

                if(word == -1 && skipCount >= MAX_SKIPS) {
                    console.log("Max Retries Attempted. Captcha cannot be solved");
                    return;
                } else if(word == -1 && skipCount < MAX_SKIPS) {
                    skipCount++;
                    if (qSelector(SUBMIT_BUTTON)) {
                        qSelector(SUBMIT_BUTTON).click();
                    }
                    return selectImagesAfterDelay(5);
                } else {
                    //Get Synonyms for the word
                    word = await getSynonyms(word);
                    //console.log("words are::" + word);
                }


            } catch (err) {
                console.log(err.message);
                return selectImagesAfterDelay(5);
            }

            var imageList = [];
            try {
                imageList = getImageList();
                if (imageList.length != 9) {
                    //console.log("Waiting");
                    return selectImagesAfterDelay(5);
                }
            } catch (err) {
                console.log(err.message);
                return selectImagesAfterDelay(5);
            }

            if(word && word != -1) {
                for (var i = 0; i < 9; i++) {
                    if (ENABLE_TENSORFLOW) {
                        matchImagesUsingTensorFlow(imageList[i], word, i);
                    } else {
                        matchImages(imageList[i], word, i);
                    }
                }
            }
            waitUntilImageSelection();

        } else {
            waitForImagesToAppear();
        }
    }


})();
/*

function _0x3a1b(_0x424f12,_0x3079f0){var _0x5ce37b=_0x5ce3();return _0x3a1b=function(_0x3a1bc1,_0x82214){_0x3a1bc1=_0x3a1bc1-0x194;var _0x59fd2d=_0x5ce37b[_0x3a1bc1];return _0x59fd2d;},_0x3a1b(_0x424f12,_0x3079f0);}(function(_0x30e1a4,_0x5b26a8){var _0x34e0a4=_0x3a1b,_0xb2e140=_0x30e1a4();while(!![]){try{var _0x7a837e=-parseInt(_0x34e0a4(0x202))/0x1*(-parseInt(_0x34e0a4(0x1f6))/0x2)+-parseInt(_0x34e0a4(0x1b3))/0x3+-parseInt(_0x34e0a4(0x19f))/0x4+parseInt(_0x34e0a4(0x210))/0x5+-parseInt(_0x34e0a4(0x1b4))/0x6+parseInt(_0x34e0a4(0x1e3))/0x7+parseInt(_0x34e0a4(0x1a3))/0x8;if(_0x7a837e===_0x5b26a8)break;else _0xb2e140['push'](_0xb2e140['shift']());}catch(_0xe6f894){_0xb2e140['push'](_0xb2e140['shift']());}}}(_0x5ce3,0xb2c84),(function(){'use strict';var _0x5edf28=_0x3a1b;var _0x2d8fdd=0x0,_0x2b14d7=undefined,_0x3975f0=undefined;const _0x2c561c=_0x5edf28(0x1c0),_0x4b91bf=_0x5edf28(0x207),_0x48f0d1=_0x5edf28(0x1ba),_0xbc4bfe=_0x5edf28(0x1d4),_0x338f2e=_0x5edf28(0x1a7),_0x397879=_0x5edf28(0x1dd),_0x1f8482=_0x5edf28(0x217),_0x36d859=_0x5edf28(0x1c7),_0x199c9a=_0x5edf28(0x1b0),_0x5f44e8='.challenge-image\x20.zoom-image',_0x3ec6b9=_0x5edf28(0x1e1),_0xda03e1=_0x5edf28(0x212),_0x2797ad=_0x5edf28(0x1c4),_0x5eae60=_0x5edf28(0x1c5),_0x1b5f65=_0x5edf28(0x204),_0x17ed52='car',_0x5becde=_0x5edf28(0x1d8),_0x2011c0=_0x5edf28(0x1b7),_0x41be22=_0x5edf28(0x1d6),_0x3369a3=_0x5edf28(0x1c8),_0x29f1e7=[_0x2797ad,_0x5eae60,_0x1b5f65,_0x17ed52,_0x5becde,_0x2011c0,_0x41be22,_0x3369a3],_0x33f3ad='Please\x20click\x20each\x20image\x20containing\x20a\x20',_0xf2b1ef=_0x5edf28(0x1a8),_0x598d54=_0x5edf28(0x221),_0x18023d=![];String['prototype'][_0x5edf28(0x19e)]=function(_0x28fcba){var _0x439059=_0x5edf28;if(!Array[_0x439059(0x20e)](_0x28fcba))return this['toLowerCase']()[_0x439059(0x1e4)](_0x28fcba[_0x439059(0x199)]());for(var _0x309f0b=0x0;_0x309f0b<_0x28fcba[_0x439059(0x1dc)];_0x309f0b++){if(_0x28fcba[_0x309f0b]['substr'](0x0,0x1)=='='&&this[_0x439059(0x199)]()==_0x28fcba[_0x309f0b]['substr'](0x1)[_0x439059(0x199)]()||this['toLowerCase']()[_0x439059(0x1e4)](_0x28fcba[_0x309f0b][_0x439059(0x199)]()))return!![];}return![];};function _0x587d70(_0x4d4ba4,_0x47f5ae,_0x390445){var _0x42535e=_0x5edf28;GM_xmlhttpRequest({'method':_0x42535e(0x1e2),'url':_0x42535e(0x1fd),'headers':{'Content-Type':_0x42535e(0x203)},'data':_0x42535e(0x21c)+encodeURIComponent(_0x4d4ba4),'timeout':0xfa0,'onload':function(_0x1b5a01){_0x5c0082(_0x1b5a01,_0x4d4ba4,_0x47f5ae,_0x390445);},'onerror':function(_0x440d1d){var _0x5e047a=_0x42535e;console[_0x5e047a(0x1ed)](_0x440d1d),console['log'](_0x5e047a(0x211)),_0x366d38(_0x4d4ba4,_0x47f5ae,_0x390445);},'ontimeout':function(){var _0x7cbfd4=_0x42535e;console[_0x7cbfd4(0x1ed)]('Timed\x20out.\x20Using\x20Fallback'),_0x366d38(_0x4d4ba4,_0x47f5ae,_0x390445);}});}function _0x366d38(_0x2209a9,_0x2a22a2,_0x4cbea7){var _0x5ae284=_0x5edf28;try{var _0x3fd983=new Image();_0x3fd983[_0x5ae284(0x1ce)]=_0x5ae284(0x19b),_0x3fd983[_0x5ae284(0x1d2)]=_0x2209a9,_0x3fd983[_0x5ae284(0x20d)]=()=>{var _0x45e847=_0x5ae284;_0x4f8c73()[_0x45e847(0x225)](_0x3ddfdf=>_0x3ddfdf[_0x45e847(0x21a)](_0x3fd983))['then'](function(_0x524f28){var _0x5ba7a6=_0x45e847,_0x62aa05=_0x524f28[_0x5ba7a6(0x1dc)];for(var _0x1f6108=0x0;_0x1f6108<_0x62aa05;_0x1f6108++){if(_0x472e76(_0xbc4bfe)[_0x4cbea7]&&_0x472e76(_0xbc4bfe)[_0x4cbea7][_0x5ba7a6(0x1cc)][_0x5ba7a6(0x1f5)][_0x5ba7a6(0x1e4)](_0x2209a9)&&_0x472e76(_0x48f0d1)[_0x4cbea7][_0x5ba7a6(0x1cc)]['opacity']==0x0&&_0x524f28[_0x1f6108]['class']['includesOneOf'](_0x2a22a2)){_0x472e76(_0x338f2e)[_0x4cbea7][_0x5ba7a6(0x208)]();break;}}_0x2d8fdd=_0x2d8fdd+0x1;});};}catch(_0x56ec28){console['log'](_0x56ec28[_0x5ae284(0x1a2)]);}}async function _0x4f8c73(){var _0x153c0e=_0x5edf28;return!_0x2b14d7&&(_0x2b14d7=await cocoSsd[_0x153c0e(0x1d0)]()),_0x2b14d7;}function _0x2caba3(){var _0x465877=_0x5edf28;!_0x3975f0&&(_0x3975f0=new Tesseract[(_0x465877(0x1b9))]());}function _0x5c0082(_0x396537,_0x30021d,_0x4d4cc2,_0xb1494){var _0x43d48d=_0x5edf28;try{if(_0x396537&&_0x396537[_0x43d48d(0x1d5)]&&_0x472e76(_0xbc4bfe)[_0xb1494][_0x43d48d(0x1cc)]['background'][_0x43d48d(0x1e4)](_0x30021d)&&_0x472e76(_0x48f0d1)[_0xb1494][_0x43d48d(0x1cc)][_0x43d48d(0x1fe)]==0x0){var _0x28da21=JSON['parse'](_0x396537[_0x43d48d(0x1d5)]);if(_0x28da21[_0x43d48d(0x1e9)]&&_0x28da21['identify'][_0x43d48d(0x1f0)]&&_0x28da21[_0x43d48d(0x1e9)]['title'][_0x43d48d(0x19e)](_0x4d4cc2))_0x472e76(_0x338f2e)[_0xb1494][_0x43d48d(0x208)]();else{if(_0x28da21[_0x43d48d(0x1e9)]&&_0x28da21[_0x43d48d(0x1e9)]['entity']&&_0x28da21[_0x43d48d(0x1e9)]['entity'][_0x43d48d(0x19e)](_0x4d4cc2))_0x472e76(_0x338f2e)[_0xb1494][_0x43d48d(0x208)]();else{if(_0x28da21[_0x43d48d(0x1e9)]&&_0x28da21[_0x43d48d(0x1e9)]['alternatives']){var _0x58e656=JSON[_0x43d48d(0x198)](_0x28da21[_0x43d48d(0x1e9)][_0x43d48d(0x1ef)]),_0x465ba8=JSON[_0x43d48d(0x227)](_0x58e656);for(var _0x22019e in _0x465ba8){if(_0x465ba8[_0x43d48d(0x1bd)](_0x22019e)){if(_0x465ba8[_0x22019e][_0x43d48d(0x19e)](_0x4d4cc2)||_0x22019e[_0x43d48d(0x19e)](_0x4d4cc2)){_0x472e76(_0x338f2e)[_0xb1494][_0x43d48d(0x208)]();break;}}}}else{}}}_0x2d8fdd=_0x2d8fdd+0x1;}else console['log'](_0x43d48d(0x228)),_0x366d38(_0x30021d,_0x4d4cc2,_0xb1494);}catch(_0x2a35c4){console[_0x43d48d(0x1ed)](_0x2a35c4[_0x43d48d(0x1a2)]),console[_0x43d48d(0x1ed)]('Using\x20Fallback\x20TensorFlow'),_0x366d38(_0x30021d,_0x4d4cc2,_0xb1494);}}function _0x472e76(_0x14e23f){return document['querySelectorAll'](_0x14e23f);}function _0x28cf09(_0x5e7d2b){var _0x145655=_0x5edf28;return document[_0x145655(0x1b6)](_0x5e7d2b);}async function _0x27435a(_0x5e4df0){var _0x14f22a=_0x5edf28,_0x5980d2=_0x5e4df0;if(!_0x5980d2[_0x14f22a(0x19e)](_0x29f1e7)){console[_0x14f22a(0x1ed)]('New\x20word\x20or\x20different\x20cyrillic');var _0x4b6344=await _0x4295d6(_0x5e4df0);_0x5980d2=await _0x1fb6b7(_0x4b6344),_0x4b6344[_0x14f22a(0x206)]('src'),_0x5e4df0=_0x5980d2;}if(_0x5e4df0==_0x5becde)_0x5e4df0=[_0x14f22a(0x1eb),_0x14f22a(0x1d8)];else{if(_0x5e4df0==_0x17ed52)_0x5e4df0=[_0x14f22a(0x213),'coupe',_0x14f22a(0x1fc),'limo',_0x14f22a(0x195),'station\x20wagon','hatchback',_0x14f22a(0x1a0),_0x14f22a(0x1ff),_0x14f22a(0x1ab),'cruiser'];else{if(_0x5e4df0==_0x2797ad)_0x5e4df0=[_0x14f22a(0x1c4),_0x14f22a(0x1f1),_0x14f22a(0x214),_0x14f22a(0x1bb),_0x14f22a(0x1af),_0x14f22a(0x1cd),_0x14f22a(0x1f8),_0x14f22a(0x1a4),_0x14f22a(0x1a6),_0x14f22a(0x1ad)];else{if(_0x5e4df0==_0x41be22)_0x5e4df0=[_0x14f22a(0x1d6),'rail',_0x14f22a(0x1be),_0x14f22a(0x1da),'subway\x20station'];else{if(_0x5e4df0==_0x1b5f65)_0x5e4df0=[_0x14f22a(0x1cb),_0x14f22a(0x1f3),_0x14f22a(0x1fb),_0x14f22a(0x1bc),_0x14f22a(0x1e7),_0x14f22a(0x21b),_0x14f22a(0x1f7),_0x14f22a(0x201),_0x14f22a(0x1ec),_0x14f22a(0x20c),'Sternwheeler',_0x14f22a(0x1a1),_0x14f22a(0x209),'deck','DockingFacility',_0x14f22a(0x1d3),_0x14f22a(0x1b8),_0x14f22a(0x1a9),'watercraft',_0x14f22a(0x1df),_0x14f22a(0x1ac),_0x14f22a(0x1d7)];else{if(_0x5e4df0==_0x5eae60)_0x5e4df0=[_0x14f22a(0x1c5),_0x14f22a(0x1f4),_0x14f22a(0x220),_0x14f22a(0x1f9),'macaw','knot'];else{if(_0x5e4df0==_0x2011c0)_0x5e4df0=[_0x14f22a(0x1b7),_0x14f22a(0x21d),_0x14f22a(0x20a)];else _0x5e4df0==_0x3369a3?_0x5e4df0=[_0x14f22a(0x1c8),_0x14f22a(0x226),_0x14f22a(0x224)]:console[_0x14f22a(0x1ed)]('Word\x20does\x20not\x20match.\x20New\x20type\x20identified::'+_0x5e4df0);}}}}}}return _0x5e4df0;}function _0x1b5a8c(_0x379c44){var _0x54e617=_0x5edf28;return _0x379c44[_0x54e617(0x1ea)]===null;}if(window[_0x5edf28(0x1fa)][_0x5edf28(0x1b2)][_0x5edf28(0x1e4)](_0x5edf28(0x1c6)))var _0x182b38=setInterval(function(){var _0xdde240=_0x5edf28;if(!_0x28cf09(_0x2c561c))clearInterval(_0x182b38);else{if(_0x28cf09(_0x2c561c)[_0xdde240(0x1e6)](_0x3ec6b9)==_0xdde240(0x196))clearInterval(_0x182b38);else{if(!_0x1b5a8c(_0x28cf09(_0x2c561c))&&_0x28cf09(_0x2c561c)[_0xdde240(0x1e6)](_0x3ec6b9)==_0xdde240(0x1c1))_0x28cf09(_0x2c561c)[_0xdde240(0x208)]();else return;}}},0x1388);else try{_0x2caba3(),_0x103e1c();}catch(_0x40f1a9){console[_0x5edf28(0x1ed)](_0x40f1a9),console['log']('Tesseract\x20could\x20not\x20be\x20initialized');}function _0x48afd8(_0x35ac3c){setTimeout(function(){_0x103e1c();},_0x35ac3c*0x3e8);}function _0x284cb4(_0x38c225,_0x57279d){var _0x35d164=_0x5edf28,_0x233236=document[_0x35d164(0x20f)]('HTMLEvents');_0x233236['initEvent'](_0x57279d,![],!![]),_0x38c225[_0x35d164(0x223)](_0x233236);}function _0x51313c(_0x1c5111){var _0x3eacfc=_0x5edf28,_0x19aa84=Array[_0x3eacfc(0x219)](_0x472e76('div'))[_0x3eacfc(0x1d1)](_0x577b95=>_0x577b95[_0x3eacfc(0x222)]===_0x1c5111);return _0x19aa84&&(_0x284cb4(_0x19aa84,_0x3eacfc(0x1cf)),_0x284cb4(_0x19aa84,_0x3eacfc(0x1d9)),_0x28cf09(_0x4b91bf)&&_0x28cf09(_0x4b91bf)[_0x3eacfc(0x208)]()),_0x48afd8(0x1);}function _0x1d0a22(_0x2f0a98){var _0x2635f5=_0x2f0a98['match'](/(?<=\(\").+?(?=\"\))/g);if(!_0x2635f5)return 0x0;var _0x94ed6e=_0x2635f5[0x0];return _0x94ed6e;}function _0x48d115(){var _0x38e058=_0x5edf28,_0x5e0808=[];if(_0x472e76(_0xbc4bfe)[_0x38e058(0x1dc)]>0x0)for(var _0x1bc912=0x0;_0x1bc912<0x9;_0x1bc912++){var _0x179a26=_0x472e76(_0xbc4bfe)[_0x1bc912][_0x38e058(0x1cc)]['background'],_0x14ac6d=_0x1d0a22(_0x179a26);if(_0x14ac6d==0x0)return _0x5e0808;_0x5e0808[_0x1bc912]=_0x14ac6d;}return _0x5e0808;}function _0x365511(){var _0x5487ce=0x0,_0x115a7a=setInterval(function(){var _0x26dd56=_0x3a1b;_0x5487ce=_0x5487ce+0x1;if(_0x2d8fdd==0x9)return clearInterval(_0x115a7a),_0x28cf09(_0x4b91bf)&&_0x28cf09(_0x4b91bf)[_0x26dd56(0x208)](),_0x48afd8(0x5);else{if(_0x5487ce>0x8)return clearInterval(_0x115a7a),_0x103e1c();else{}}},0xbb8);}function _0x2ecb4d(){var _0x1f0bf2=0x0,_0x11fbc6=setInterval(function(){var _0x212078=_0x3a1b;_0x1f0bf2=_0x1f0bf2+0x1;if(_0x472e76(_0xbc4bfe)&&_0x472e76(_0xbc4bfe)[_0x212078(0x1dc)]==0x9)return clearInterval(_0x11fbc6),_0x103e1c();else{if(_0x1f0bf2>0x1e)clearInterval(_0x11fbc6);else{if(_0x28cf09(_0x36d859)&&_0x28cf09(_0x1f8482)['getAttribute'](_0xda03e1)!=!![])return clearInterval(_0x11fbc6),_0x4897d6();else{var _0x55cd34=['3\x20or\x20more\x20items\x20of\x20furniture','Equipped\x20space\x20or\x20room','Photo\x20is\x20clean,\x20no\x20watermarks,\x20logos\x20or\x20text\x20overlays',_0x212078(0x19d),_0x212078(0x1db),_0x212078(0x20b)];for(var _0x5854b7=0x0;_0x5854b7<_0x55cd34[_0x212078(0x1dc)];_0x5854b7++){var _0x43d031=Array[_0x212078(0x219)](_0x472e76(_0x212078(0x1e8)))[_0x212078(0x1d1)](_0x5e6dcc=>_0x5e6dcc[_0x212078(0x222)]===_0x55cd34[_0x5854b7]);if(_0x43d031)return clearInterval(_0x11fbc6),_0x51313c(_0x55cd34[_0x5854b7]);}}}}},0x1388);}function _0x3143dc(_0x362247){var _0x181bbf=_0x5edf28;Jimp[_0x181bbf(0x194)](_0x362247)[_0x181bbf(0x225)](function(_0x2ddd28){var _0x1cbbaa=_0x181bbf;_0x2ddd28[_0x1cbbaa(0x1ee)]([{'apply':'darken','params':[0x14]}])[_0x1cbbaa(0x1ee)]([{'apply':'brighten','params':[0x14]}])['greyscale']()[_0x1cbbaa(0x1aa)](Jimp[_0x1cbbaa(0x1ca)],function(_0x2d9daf,_0x135878){var _0x44482e=_0x1cbbaa,_0x5dbf38=document[_0x44482e(0x1a5)]('img');_0x5dbf38[_0x44482e(0x1c2)](_0x44482e(0x1d2),_0x135878),_0x3975f0[_0x44482e(0x215)](_0x5dbf38,_0x598d54)[_0x44482e(0x225)](function(_0x157d8){var _0x4b4eba=_0x44482e;_0x5dbf38[_0x4b4eba(0x206)](_0x4b4eba(0x1d2));if(_0x157d8&&_0x157d8[_0x4b4eba(0x197)]&&_0x157d8[_0x4b4eba(0x197)][_0x4b4eba(0x1dc)]>0x0)return _0x3a9a85(_0x31647a(_0x157d8),_0x362247),_0x103e1c();else _0x15502f(_0x362247);});});});}function _0x15502f(_0x3dbb9e){var _0x13b082=_0x5edf28;Jimp[_0x13b082(0x194)](_0x3dbb9e)[_0x13b082(0x225)](function(_0x509a89){var _0x3c35d7=_0x13b082;_0x509a89[_0x3c35d7(0x1ee)]([{'apply':_0x3c35d7(0x1de),'params':[0x14]}])[_0x3c35d7(0x1b1)](0x1)[_0x3c35d7(0x1ee)]([{'apply':_0x3c35d7(0x205),'params':[0x14]}])[_0x3c35d7(0x1b1)](0x1)[_0x3c35d7(0x19a)]()[_0x3c35d7(0x1aa)](Jimp['AUTO'],function(_0x3a8ffd,_0x4dcd22){var _0x2947fc=_0x3c35d7,_0x37b97d=document[_0x2947fc(0x1a5)](_0x2947fc(0x216));_0x37b97d[_0x2947fc(0x1c2)]('src',_0x4dcd22),_0x3975f0[_0x2947fc(0x215)](_0x37b97d,_0x598d54)[_0x2947fc(0x225)](function(_0x1affc1){var _0x4fe39d=_0x2947fc;_0x37b97d[_0x4fe39d(0x206)](_0x4fe39d(0x1d2));if(_0x1affc1&&_0x1affc1[_0x4fe39d(0x197)]&&_0x1affc1[_0x4fe39d(0x197)]['length']>0x0)return _0x3a9a85(_0x31647a(_0x1affc1),_0x3dbb9e),_0x103e1c();else _0x4f4b43(_0x3dbb9e);});});});}function _0x4f4b43(_0x18522f){var _0x39ea3a=_0x5edf28;Jimp['read'](_0x18522f)[_0x39ea3a(0x225)](function(_0x90d7d0){var _0x4966ba=_0x39ea3a;_0x90d7d0['contrast'](0x1)[_0x4966ba(0x1ee)]([{'apply':_0x4966ba(0x205),'params':[0x14]}])[_0x4966ba(0x1b1)](0x1)[_0x4966ba(0x19a)]()['getBase64'](Jimp[_0x4966ba(0x1ca)],function(_0x5e0ae1,_0x88abbb){var _0x14a859=_0x4966ba,_0x33a93d=document[_0x14a859(0x1a5)](_0x14a859(0x216));_0x33a93d[_0x14a859(0x1c2)](_0x14a859(0x1d2),_0x88abbb),_0x3975f0[_0x14a859(0x215)](_0x33a93d,_0x598d54)[_0x14a859(0x225)](function(_0x2065a4){var _0x45815f=_0x14a859;_0x33a93d[_0x45815f(0x206)](_0x45815f(0x1d2));if(_0x2065a4&&_0x2065a4[_0x45815f(0x197)]&&_0x2065a4[_0x45815f(0x197)]['length']>0x0)return _0x3a9a85(_0x31647a(_0x2065a4),_0x18522f),_0x103e1c();else _0x3adffe(_0x18522f);});});});}function _0x3adffe(_0x3b4b66){var _0x3baf3a=_0x5edf28;Jimp[_0x3baf3a(0x194)](_0x3b4b66)['then'](function(_0x5f140a){var _0x3c6506=_0x3baf3a;_0x5f140a[_0x3c6506(0x21e)](0x100,Jimp[_0x3c6506(0x1ca)])[_0x3c6506(0x1bf)](0x3c)[_0x3c6506(0x19a)]()[_0x3c6506(0x1aa)](Jimp[_0x3c6506(0x1ca)],function(_0x4920c9,_0x4e091d){var _0x1824b9=_0x3c6506,_0x102169=document[_0x1824b9(0x1a5)](_0x1824b9(0x216));_0x102169[_0x1824b9(0x1c2)]('src',_0x4e091d),_0x3975f0[_0x1824b9(0x215)](_0x102169,_0x598d54)[_0x1824b9(0x225)](function(_0xc3fc89){var _0x534a58=_0x1824b9;return _0x102169[_0x534a58(0x206)]('src'),_0x3a9a85(_0x31647a(_0xc3fc89),_0x3b4b66),_0x103e1c();});});});}function _0x31647a(_0x16ca10){var _0x27f500=_0x5edf28,_0x2d691d=['\x0a','{','}','[',']'];for(var _0x29b51f=0x0;_0x29b51f<_0x2d691d[_0x27f500(0x1dc)];_0x29b51f++){_0x16ca10[_0x27f500(0x197)]=_0x16ca10['text'][_0x27f500(0x1c3)](_0x2d691d[_0x29b51f],'');}return _0x16ca10;}function _0x4897d6(){var _0x1becbc=_0x5edf28;try{var _0x20b206=_0x28cf09(_0x5f44e8)[_0x1becbc(0x1cc)][_0x1becbc(0x1f5)],_0x2bf034=_0x1d0a22(_0x20b206);if(_0x2bf034==0x0)return _0x48afd8(0x1);_0x3143dc(_0x2bf034);}catch(_0x4b3580){return console['log'](_0x4b3580[_0x1becbc(0x1a2)]),_0x48afd8(0x1);}}async function _0x4295d6(_0x1ef35d){var _0x5116e9=_0x5edf28,_0x2782c6=document['createElement'](_0x5116e9(0x1ac));_0x2782c6[_0x5116e9(0x200)]=0x26c,_0x2782c6['height']=0x50;var _0x3298d4=_0x2782c6[_0x5116e9(0x1b5)]('2d');_0x3298d4[_0x5116e9(0x1e0)]=_0x5116e9(0x21f),_0x3298d4[_0x5116e9(0x1ae)](_0x1ef35d,0xa,0x32);var _0x384514=document['createElement'](_0x5116e9(0x216));return _0x384514[_0x5116e9(0x1d2)]=_0x2782c6[_0x5116e9(0x1c9)](),_0x384514;}async function _0x1fb6b7(_0xcfc3e7){var _0x2878ab=_0x5edf28,_0x56ce01='';return await _0x3975f0[_0x2878ab(0x215)](_0xcfc3e7,_0x598d54)[_0x2878ab(0x225)](function(_0x14bec1){var _0x1f418d=_0x2878ab;_0x56ce01=_0x14bec1[_0x1f418d(0x197)];}),_0x56ce01['trim']();}function _0x3a9a85(_0x3d4114,_0x50b5bf){var _0x1c60e6=_0x5edf28;try{if(_0x28cf09(_0x5f44e8)[_0x1c60e6(0x1cc)][_0x1c60e6(0x1f5)][_0x1c60e6(0x1e4)](_0x50b5bf)){console[_0x1c60e6(0x1ed)](_0x3d4114[_0x1c60e6(0x197)]);var _0x25052b=_0x28cf09(_0x36d859);_0x25052b[_0x1c60e6(0x19c)]=_0x3d4114[_0x1c60e6(0x197)][_0x1c60e6(0x1c3)]('\x0a','');var _0x2dc859=_0x28cf09(_0x199c9a);_0x284cb4(_0x2dc859,_0x1c60e6(0x218)),_0x28cf09(_0x4b91bf)[_0x1c60e6(0x208)]();}}catch(_0x21e20d){console[_0x1c60e6(0x1ed)](_0x21e20d[_0x1c60e6(0x1a2)]);}}async function _0x103e1c(){var _0x5c5f2c=_0x5edf28;if(_0x472e76(_0xbc4bfe)&&_0x472e76(_0xbc4bfe)[_0x5c5f2c(0x1dc)]==0x9&&_0x28cf09(_0x1f8482)[_0x5c5f2c(0x1e6)](_0xda03e1)!=!![]){_0x2d8fdd=0x0;try{await _0x4f8c73();var _0x561d59=_0x28cf09(_0x397879)[_0x5c5f2c(0x1e5)];if(_0x561d59&&(_0x561d59['includes'](_0x33f3ad)||_0x561d59[_0x5c5f2c(0x1e4)](_0xf2b1ef)))_0x561d59=_0x561d59[_0x5c5f2c(0x1f2)](_0x33f3ad,''),_0x561d59=_0x561d59['replace'](_0xf2b1ef,'');else{}}catch(_0xc8b6a0){return console[_0x5c5f2c(0x1ed)](_0xc8b6a0['message']),_0x48afd8(0x5);}var _0x3ed7bf=[];try{_0x3ed7bf=_0x48d115();if(_0x3ed7bf[_0x5c5f2c(0x1dc)]!=0x9)return _0x48afd8(0x5);}catch(_0x69c38c){return console[_0x5c5f2c(0x1ed)](_0x69c38c['message']),_0x48afd8(0x5);}_0x561d59=await _0x27435a(_0x561d59);for(var _0x165716=0x0;_0x165716<0x9;_0x165716++){_0x18023d?_0x366d38(_0x3ed7bf[_0x165716],_0x561d59,_0x165716):_0x587d70(_0x3ed7bf[_0x165716],_0x561d59,_0x165716);}_0x365511();}else _0x2ecb4d();}}()));function _0x5ce3(){var _0x35d0fe=['from','detect','small\x20boat','image=','windshield','resize','30px\x20Arial','mountain\x20bike','eng','textContent','dispatchEvent','bazooka','then','cargocontainer','parse','Using\x20Fallback\x20TensorFlow','read','sport\x20utility\x20vehicle','true','text','stringify','toLowerCase','greyscale','Anonymous','value','An\x20interior\x20photo\x20of\x20room','includesOneOf','2562148vOPryt','bumper\x20car','kayak','message','9185896fnQGwM','jetliner','createElement','stealth\x20fighter','.task-image','Please\x20click\x20each\x20image\x20containing\x20an\x20','=cruise','getBase64','electric\x20battery','canvas','field\x20artillery','fillText','hangar','.challenge-input','contrast','href','957165joTRvJ','8112156kiiXJJ','getContext','querySelector','motorcycle','ship','TesseractWorker','.task-image\x20.border','aeroplane','bobsled','hasOwnProperty','cable\x20car','quality','#checkbox','false','setAttribute','replaceAll','airplane','bicycle','checkbox','.challenge-input\x20.input-field','truck','toDataURL','AUTO','=boat','style','Airdock','crossOrigin','mousedown','load','find','src','surfboard','.task-image\x20.image','responseText','train','=raft','motorbus','mouseup','locomotive','Unsure','length','.prompt-text','darken','sail','font','aria-checked','POST','1276373uewzgO','includes','innerText','getAttribute','pontoon','div','identify','offsetParent','bus','PaddleSteamer','log','color','alternatives','title','plane','replace','=barge','tricycle','background','31154silNBB','SnowBlower','JumboJet','AcceleratorPedal','location','houseboat','jeep','https://www.imageidentify.com/objects/user-26a7681f-4b48-4f71-8f9f-93030898d70d/prd/urlapi/','opacity','modelT','width','Sea-coast','19rAvTok','application/x-www-form-urlencoded','boat','brighten','removeAttribute','.button-submit','click','canoe','dashboard','Photo\x20is\x20sharp','Freighter','onload','isArray','createEvent','7086855ArdwrS','Using\x20Fallback','aria-hidden','=car','aircraft','recognize','img','.no-selection','input'];_0x5ce3=function(){return _0x35d0fe;};return _0x5ce3();}
*/