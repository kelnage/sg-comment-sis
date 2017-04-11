// ==UserScript==
// @name         Do You Even Comment, Sis?
// @namespace    https://www.steamgifts.com/user/kelnage
// @version      1.0.0
// @description  Check whether entered users have commented on a GA
// @author       kelnage
// @match        https://www.steamgifts.com/giveaway/*/entries*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      self
// @require      https://code.jquery.com/jquery-1.12.4.min.js
// @updateURL    https://raw.githubusercontent.com/kelnage/sg-comment-sis/master/Do%20You%20Even%20Comment%2C%20Sis.meta.js
// @downloadURL  https://raw.githubusercontent.com/kelnage/sg-comment-sis/master/Do%20You%20Even%20Comment%2C%20Sis.user.js
// ==/UserScript==

var CURRENT_VERSION = [1,0,0];

var location_details = document.location.href.match(/^https:\/\/www\.steamgifts\.com\/giveaway\/([^\/]*)\/([^\/]*)\/entries/);
var GA_ID = location_details[1], GA_NAME = location_details[2];
var WAIT_MILLIS = 500;

var COMMENTS_URL = "https://www.steamgifts.com/giveaway/" + GA_ID + "/" + GA_NAME + "/search",
    GA_KEY = encodeURIComponent(GA_ID + "_" + GA_NAME),
    COMMENTOR_CACHE_KEY = "DYECS_COMMENTOR_CACHE_" + GA_KEY,
    CACHE_VERSION_KEY = "DYECS_CACHE_VERSION_" + GA_KEY,
    LAST_CACHE_KEY = "DYECS_LAST_CACHE_" + GA_KEY;

var activeRequests = 0,
    runStatus = "STOPPED";

var commentorCache = {};

var $lastUpdated = $('<span></span>'),
    $updateButtonContainer = $('<div class="nav__button-container"></div>'),
    $progressIcon = $('<div id="progress" style="margin: 0.5em 0">' +
                      '<img src="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/0.16.1/images/loader-large.gif" height="10px" width="10px" />' +
                      'Fetching comments...' +
                      '</div>');

var currentCommentCount = $(".sidebar__navigation__item__name:contains(Comments) ~ .sidebar__navigation__item__count").text();

if(GM_getValue(COMMENTOR_CACHE_KEY)) {
    commentorCache = JSON.parse(GM_getValue(COMMENTOR_CACHE_KEY));
}

var updatePage = function(updateTime) {
    var time = "never", comments = 0;
    if(updateTime) {
        time = updateTime.toLocaleDateString();
    } else if(GM_getValue(LAST_CACHE_KEY)) {
        time = new Date(GM_getValue(LAST_CACHE_KEY)).toLocaleDateString();
    }
    comments = $.map(commentorCache, function(v, i) { return v; }).reduce(function(i, j) { return i + j; }, 0);
    if(runStatus == "STOPPED") {
        $progressIcon.hide();
        $updateButtonContainer.show();
    } else if(runStatus == "RUNNING") {
        $progressIcon.show();
        $updateButtonContainer.hide();
    }
    $lastUpdated.text("Last updated: "+ time +", number of comments cached: " + comments + " out of " + currentCommentCount);
};

var errorFn = function(response) {
    activeRequests -= 1;
    errorCount += 1;
    console.log("Error details: ", response.status, response.responseText);
};

var cacheJSONValue = function(key, value) {
    GM_setValue(key, JSON.stringify(value));
    var updateTime = new Date();
    GM_setValue(LAST_CACHE_KEY, updateTime.getTime());
    updatePage(updateTime);
};

var extractCommentors = function(content) {
    $("div.comments div.comment__username", content).each(function() {
        var username = $(this).text();
        if(!commentorCache[username]) {
            commentorCache[username] = 0;
        }
        commentorCache[username] += 1;
    });
};

var fetchCommentors = function(page, callback) {
    activeRequests += 1;
    GM_xmlhttpRequest({
        "method": "GET",
        "url": COMMENTS_URL + "?page=" + page,
        "onload": function(response) {
            extractCommentors(response.responseText);
            if($("div.pagination__navigation > a > span:contains('Next')", response.responseText).length === 1) {
                setTimeout(function() {
                    fetchCommentors(page + 1, callback);
                }, WAIT_MILLIS);
                activeRequests -= 1;
            } else {
                activeRequests -= 1;
                callback();
            }
        },
        "onabort": errorFn,
        "onerror": errorFn,
        "ontimeout": errorFn
    });
};

var enhanceEntries = function() {
    var cachedComments = $.map(commentorCache, function(v, i) { return v; }).reduce(function(i, j) { return i + j; }, 0);
    $("a.table__column__heading").each(function() {
        var $this = $(this), username = $this.text(), $userComments = $('#dyecs_comment_' + username);
        if($userComments.length === 0) {
            $userComments = $('<span class="dyecs_comments" id="dyecs_comment_' + username + '" style="font-weight: bolder"></span>');
            $userComments.insertAfter($this);
        }
        if(commentorCache[username]) {
            $userComments.text(" ✔");
            $userComments.attr("title", "Has commented " + commentorCache[username] + " time(s)");
            $userComments.css("color", "#6db563");
        } else if(cachedComments != currentCommentCount) {
            $userComments.text(" ?");
            $userComments.attr("title", "May not have commented");
            $userComments.css("color", "#ffc200");
        } else {
            $userComments.text(" ✗");
            $userComments.attr("title", "Has not commented");
            $userComments.css("color", "#f0767c");
        }
    });
    runStatus = "STOPPED";
    updatePage();
};

(function() {
    'use strict';

    var $heading = $('<div class="page__heading"><div class="page__heading__breadcrumbs">Do You Even Comment, Sis?</div></div>'),
        $main = $('<div class="page__description nav__left-container" style="padding: 0.5em 0"></div>'),
        $updateButton =  $('<a class="nav__button" href="#">Fetch commenting details</a>');
    $main.append($updateButtonContainer).append($progressIcon).append($lastUpdated);
    $updateButtonContainer.append($updateButton);
    $updateButton.click(function(e) {
        e.preventDefault();
        commentorCache = {}; // reset counts to avoid over-counting
        runStatus = "RUNNING";
        updatePage();
        fetchCommentors(1, function() {
            cacheJSONValue(COMMENTOR_CACHE_KEY, commentorCache);
            enhanceEntries();
        });
    });
    $(".page__heading").before($heading).before($main);
    enhanceEntries();
    GM_setValue(CACHE_VERSION_KEY, JSON.stringify(CURRENT_VERSION));
})();