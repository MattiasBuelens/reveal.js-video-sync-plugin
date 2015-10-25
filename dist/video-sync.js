/*!
 * reveal.js video sync 0.0.2
 *
 * Synchronize video playback with reveal.js slide changes
 * https://github.com/MattiasBuelens/reveal.js-video-sync-plugin
 * License: MIT
 *
 * Copyright (C) Mattias Buelens (http://github.com/MattiasBuelens)
 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.RevealVideoSync = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function isAttached(node) {
    while (node && node !== document) {
        node = node.parentNode;
    }
    return (node === document);
}
exports.isAttached = isAttached;
function hasClass(element, className) {
    return (' ' + element.className.trim() + ' ').indexOf(' ' + className + ' ') !== -1;
}
exports.hasClass = hasClass;
function addClass(element, className) {
    var classes = ' ' + element.className.trim() + ' ';
    if (classes.indexOf(' ' + className + ' ') === -1) {
        classes += ' ' + className;
    }
    element.className = classes.trim();
}
exports.addClass = addClass;
function removeClass(element, className) {
    var classes = ' ' + element.className.trim() + ' ';
    while (classes.indexOf(' ' + className + ' ') !== -1) {
        classes = classes.replace(' ' + className + ' ', ' ');
    }
    element.className = classes.trim();
}
exports.removeClass = removeClass;
},{}],2:[function(require,module,exports){
/* globals Reveal */
/// <reference path="../typings/reveal/reveal.d.ts" />
function normalizeSlide(indices) {
    indices.h = indices.h || 0;
    indices.v = indices.v || 0;
    indices.f = (typeof indices.f === 'number' && !isNaN(indices.f)) ? indices.f : -1;
    return indices;
}
exports.normalizeSlide = normalizeSlide;
function slidesEqual(left, right) {
    if (!left || !right) {
        return !left && !right;
    }
    return left.h === right.h && left.v === right.v && left.f === right.f;
}
exports.slidesEqual = slidesEqual;
function parseSlide(hash) {
    // Attempt to parse the hash as either an index or name
    var bits = hash.split('/'), h, v, f;
    if (isNaN(parseInt(bits[0], 10))) {
        // Named slide
        var name = bits[0], element;
        // Ensure the named link is a valid HTML ID attribute
        if (/^[a-zA-Z][\w:.-]*$/.test(name)) {
            // Find the slide with the specified ID
            element = document.getElementById(name);
        }
        if (!element) {
            // Unknown slide
            return null;
        }
        // Find the position of the named slide
        var indices = Reveal.getIndices(element);
        h = indices.h;
        v = indices.v;
        f = parseInt(bits[1], 10);
    }
    else {
        // Index components
        h = parseInt(bits[0], 10);
        v = parseInt(bits[1], 10);
        f = parseInt(bits[2], 10);
    }
    return normalizeSlide({ h: h, v: v, f: f });
}
exports.parseSlide = parseSlide;
function jumpToSlide(slide) {
    Reveal.slide(slide.h, slide.v, slide.f);
}
exports.jumpToSlide = jumpToSlide;
},{}],3:[function(require,module,exports){
var RevealUtils = require('./reveal-utils');
var Synchronizer = (function () {
    function Synchronizer(video, track) {
        var _this = this;
        this.cueChangeListener = function () {
            _this.onCueChange();
        };
        this.slideChangeListener = function () {
            _this.onSlideChange();
        };
        this.video = video;
        this.track = track;
        this.initialize();
    }
    Synchronizer.prototype.initialize = function () {
        this.activeSlide = null;
        this.activeCue = null;
        this.loadSlideMap();
        // Seek to initial slide
        this.onSlideChange();
        // Bind listeners
        if ('oncuechange' in this.track) {
            this.track.addEventListener('cuechange', this.cueChangeListener);
        }
        else {
            // Polyfill missing support for cuechange event with timeupdate
            this.video.addEventListener('timeupdate', this.cueChangeListener);
        }
        Reveal.addEventListener('slidechanged', this.slideChangeListener);
        Reveal.addEventListener('fragmentshown', this.slideChangeListener);
        Reveal.addEventListener('fragmenthidden', this.slideChangeListener);
    };
    Synchronizer.prototype.dispose = function () {
        this.activeSlide = null;
        this.activeCue = null;
        this.slideMap = null;
        // Unbind listeners
        this.track.removeEventListener('cuechange', this.cueChangeListener);
        this.video.removeEventListener('timeupdate', this.cueChangeListener);
        Reveal.removeEventListener('slidechanged', this.slideChangeListener);
        Reveal.removeEventListener('fragmentshown', this.slideChangeListener);
        Reveal.removeEventListener('fragmenthidden', this.slideChangeListener);
        this.video.dispose();
        this.video = null;
    };
    Synchronizer.prototype.onCueChange = function () {
        // Update active cue
        var newActiveCue = this.track.activeCues.length ? this.track.activeCues[0] : null;
        if (newActiveCue === this.activeCue) {
            return;
        }
        this.activeCue = newActiveCue;
        // Update active slide
        var newActiveSlide = Synchronizer.getCueSlide(this.activeCue);
        if (!newActiveSlide || RevealUtils.slidesEqual(newActiveSlide, this.activeSlide)) {
            return;
        }
        this.activeSlide = newActiveSlide;
        // Jump to slide
        RevealUtils.jumpToSlide(this.activeSlide);
    };
    Synchronizer.prototype.onSlideChange = function () {
        var slide = RevealUtils.normalizeSlide(Reveal.getIndices());
        if (RevealUtils.slidesEqual(slide, this.activeSlide)) {
            // Already active slide
            return;
        }
        // Find cue closest in time with this slide
        var cue = this.findClosestSlideCue(slide, this.video.getCurrentTime());
        if (!cue) {
            return;
        }
        // Seek to start of closest cue
        this.video.setCurrentTime(cue.startTime + 0.001); // avoid overlap with previous
    };
    Synchronizer.prototype.loadSlideMap = function () {
        var slideMap = this.slideMap = {};
        for (var i = 0; i < this.track.cues.length; i++) {
            var cue = this.track.cues[i], slide = Synchronizer.getCueSlide(cue);
            if (slide) {
                var h = slideMap[slide.h] || (slideMap[slide.h] = {}), v = h[slide.v] || (h[slide.v] = {}), f = v[slide.f] || (v[slide.f] = []);
                f.push(cue);
            }
        }
    };
    Synchronizer.prototype.findClosestSlideCue = function (slide, time) {
        var slideMap = this.slideMap;
        if (!slideMap) {
            // Not loaded
            return null;
        }
        var h = slideMap[slide.h], v = h && h[slide.v], f = v && v[slide.f];
        if (!f) {
            // Not found
            return null;
        }
        var closestCue, closestDistance = Infinity;
        for (var i = 0; i < f.length; i++) {
            var cue = f[i], distance = Math.min(Math.abs(cue.startTime - time), Math.abs(cue.endTime - time));
            if (cue.startTime <= time && time < cue.endTime) {
                // Time inside cue interval
                return cue;
            }
            else if (distance < closestDistance) {
                closestCue = cue;
                closestDistance = distance;
            }
        }
        return closestCue;
    };
    Synchronizer.getCueSlide = function (cue) {
        return cue && RevealUtils.parseSlide(cue.text);
    };
    return Synchronizer;
})();
exports.Synchronizer = Synchronizer;
},{"./reveal-utils":2}],4:[function(require,module,exports){
var HTML5Video = (function () {
    function HTML5Video(video) {
        this.video = video;
    }
    HTML5Video.prototype.getCurrentTime = function () {
        return this.video.currentTime;
    };
    HTML5Video.prototype.setCurrentTime = function (time) {
        this.video.currentTime = time;
    };
    HTML5Video.prototype.addEventListener = function (type, handler) {
        this.video.addEventListener(type, handler, false);
    };
    HTML5Video.prototype.removeEventListener = function (type, handler) {
        this.video.removeEventListener(type, handler, false);
    };
    HTML5Video.prototype.onReady = function (handler) {
        setTimeout(handler, 0);
    };
    HTML5Video.prototype.loadSlides = function (slidesUrl, callback) {
        var _this = this;
        this.unloadSlides();
        if (!slidesUrl) {
            callback(new Error('missing slides URL'));
            return;
        }
        this.createSlidesTrack(slidesUrl, function (error, trackElement) {
            if (error) {
                callback(error);
                return;
            }
            _this.waitForTrackLoad(function (error) {
                if (error) {
                    callback(error);
                    return;
                }
                var track = trackElement.track;
                track.mode = 'hidden';
                callback(null, track);
            });
        });
    };
    HTML5Video.prototype.dispose = function () {
        this.unloadSlides();
        this.video = null;
    };
    HTML5Video.prototype.waitForMetadata = function (callback) {
        var _this = this;
        if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            return callback(null);
        }
        else {
            var listener = function () {
                _this.video.removeEventListener('loadedmetadata', listener);
                if (_this.videoMetadataListener === listener) {
                    _this.videoMetadataListener = null;
                    callback(null);
                }
            };
            this.video.addEventListener('loadedmetadata', listener);
            this.videoMetadataListener = listener;
        }
    };
    HTML5Video.prototype.waitForTrackLoad = function (callback) {
        var _this = this;
        if (!this.trackElement) {
            return callback(new Error('missing track element'));
        }
        if (this.trackElement.readyState === HTMLTrackElement.LOADED) {
            return callback(null);
        }
        else {
            var listener = function () {
                _this.trackElement.removeEventListener('load', listener);
                if (_this.trackLoadListener === listener) {
                    _this.trackLoadListener = null;
                    callback(null);
                }
            };
            this.trackElement.addEventListener('load', listener);
            this.trackLoadListener = listener;
        }
    };
    HTML5Video.prototype.createSlidesTrack = function (slidesUrl, callback) {
        var _this = this;
        this.waitForMetadata(function (error) {
            if (error) {
                callback(error);
                return;
            }
            var trackElement = document.createElement('track');
            trackElement.kind = 'metadata';
            trackElement.src = slidesUrl;
            trackElement['default'] = true;
            _this.video.appendChild(trackElement);
            _this.trackElement = trackElement;
            callback(null, trackElement);
        });
    };
    HTML5Video.prototype.unloadSlides = function () {
        if (this.videoMetadataListener) {
            this.video.removeEventListener('loadedmetadata', this.videoMetadataListener);
        }
        if (this.trackElement) {
            if (this.trackLoadListener) {
                this.trackElement.removeEventListener('load', this.trackLoadListener);
            }
            this.video.removeChild(this.trackElement);
        }
        this.videoMetadataListener = null;
        this.trackLoadListener = null;
        this.trackElement = null;
    };
    return HTML5Video;
})();
exports.HTML5Video = HTML5Video;
},{}],5:[function(require,module,exports){
var video_html5_1 = require('./video-html5');
var video_videojs_1 = require('./video-videojs');
var synchronizer_1 = require('./synchronizer');
var DOMUtils = require('./dom-utils');
var containerClass = 'reveal-video-sync', container, videoElement, videoClass = 'reveal-video-sync-player';
function createContainer() {
    var reveal;
    if (!container) {
        container = document.getElementsByClassName(containerClass)[0];
        if (!container) {
            container = document.createElement('aside');
            container.className = containerClass;
            reveal = document.querySelector('.reveal');
            if (reveal.nextSibling) {
                reveal.parentNode.insertBefore(container, reveal.nextSibling);
            }
            else {
                reveal.parentNode.appendChild(container);
            }
        }
    }
    return container;
}
function createVideoElement() {
    var container = createContainer();
    if (!videoElement) {
        videoElement = container.getElementsByTagName('video')[0];
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.controls = true;
            container.appendChild(videoElement);
        }
    }
    return videoElement;
}
function loadSlides(video, slidesVttUrl, callback) {
    return video.loadSlides(slidesVttUrl, function (error, track) {
        if (error) {
            if (callback)
                callback(error);
            return;
        }
        var synchronizer = new synchronizer_1.Synchronizer(video, track);
        if (callback)
            callback(null, synchronizer);
    });
}
function element() {
    return createVideoElement();
}
exports.element = element;
function html5(videoElement, slidesVttUrl, callback) {
    var container = createContainer(), video;
    if (!DOMUtils.isAttached(videoElement)) {
        container.appendChild(videoElement);
    }
    DOMUtils.addClass(videoElement, videoClass);
    video = new video_html5_1.HTML5Video(videoElement);
    video.onReady(function () {
        loadSlides(video, slidesVttUrl, callback);
    });
}
exports.html5 = html5;
function videojs(player, slidesVttUrl, callback) {
    var video;
    if (!videojs) {
        if (callback)
            callback(new Error('video.js not loaded'));
        return;
    }
    player.addClass(videoClass);
    player.addClass('video-js');
    video = new video_videojs_1.VideoJSVideo(player);
    video.onReady(function () {
        loadSlides(video, slidesVttUrl, callback);
    });
}
exports.videojs = videojs;
},{"./dom-utils":1,"./synchronizer":3,"./video-html5":4,"./video-videojs":6}],6:[function(require,module,exports){
/* globals videojs */
var VideoJSVideo = (function () {
    function VideoJSVideo(player) {
        this.player = player;
    }
    VideoJSVideo.prototype.getCurrentTime = function () {
        return this.player.currentTime();
    };
    VideoJSVideo.prototype.setCurrentTime = function (time) {
        this.player.currentTime(time);
    };
    VideoJSVideo.prototype.getSource = function () {
        return this.player.currentSrc();
    };
    VideoJSVideo.prototype.setSource = function (source) {
        this.player.src(source);
    };
    VideoJSVideo.prototype.addEventListener = function (type, handler) {
        this.player.on(type, handler);
    };
    VideoJSVideo.prototype.removeEventListener = function (type, handler) {
        this.player.off(type, handler);
    };
    VideoJSVideo.prototype.onReady = function (handler) {
        this.player.ready(handler);
    };
    VideoJSVideo.prototype.waitForTrackLoad = function (callback) {
        var _this = this;
        // VideoJS does not provide a 'load' event for text tracks
        // so just poll the cues list until it has a stable number of cues
        var self = this, lastCueLength = 0, checkCueLoad = function () {
            clearTimeout(self.cueLoadTimer);
            var newCueLength = self.slidesTrack.cues && self.slidesTrack.cues.length;
            if (newCueLength > 0 && lastCueLength === newCueLength) {
                callback();
            }
            else {
                lastCueLength = newCueLength;
                _this.cueLoadTimer = setTimeout(checkCueLoad, VideoJSVideo.cueLoadTimeout);
            }
        };
        checkCueLoad();
    };
    VideoJSVideo.prototype.loadSlides = function (slidesUrl, callback) {
        var _this = this;
        this.unloadSlides();
        if (!slidesUrl) {
            callback(new Error('missing slides URL'));
            return;
        }
        this.slidesTrack = this.player.addRemoteTextTrack({
            kind: 'metadata',
            mode: 'showing',
            'default': true,
            src: slidesUrl
        }).track;
        this.waitForTrackLoad(function () {
            callback(null, _this.slidesTrack);
        });
    };
    VideoJSVideo.prototype.dispose = function () {
        this.unloadSlides();
        this.player = null;
    };
    VideoJSVideo.prototype.unloadSlides = function () {
        clearTimeout(this.cueLoadTimer);
        if (this.slidesTrack) {
            this.player.removeRemoteTextTrack(this.slidesTrack);
            this.slidesTrack = null;
        }
    };
    VideoJSVideo.cueLoadTimeout = 100;
    return VideoJSVideo;
})();
exports.VideoJSVideo = VideoJSVideo;
},{}]},{},[5])(5)
});


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInZpZGVvLXN5bmMuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwic3JjL2RvbS11dGlscy50cyIsInNyYy9yZXZlYWwtdXRpbHMudHMiLCJzcmMvc3luY2hyb25pemVyLnRzIiwic3JjL3ZpZGVvLWh0bWw1LnRzIiwic3JjL3ZpZGVvLXN5bmMudHMiLCJzcmMvdmlkZW8tdmlkZW9qcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEFDVkE7QUNBQSxvQkFBMkIsSUFBUztJQUNoQyxPQUFPLElBQUksSUFBSSxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDL0IsSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDM0IsQ0FBQztJQUNELE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLENBQUMsQ0FBQztBQUMvQixDQUFDO0FBTGUsa0JBQVUsYUFLekIsQ0FBQTtBQUVELGtCQUF5QixPQUFtQixFQUFFLFNBQWdCO0lBQzFELE1BQU0sQ0FBQyxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3hGLENBQUM7QUFGZSxnQkFBUSxXQUV2QixDQUFBO0FBRUQsa0JBQXlCLE9BQW1CLEVBQUUsU0FBZ0I7SUFDMUQsSUFBSSxPQUFPLEdBQUcsR0FBRyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQ25ELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FB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LElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQzVCLENBQUM7SUFDTCxDQUFDO0lBbkZjLDJCQUFjLEdBQUcsR0FBRyxDQUFDO0lBcUZ4QyxtQkFBQztBQUFELENBMUZBLEFBMEZDLElBQUE7QUExRlksb0JBQVksZUEwRnhCLENBQUEiLCJmaWxlIjoidmlkZW8tc3luYy5qcyIsInNvdXJjZXNDb250ZW50IjpbbnVsbCwiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJleHBvcnQgZnVuY3Rpb24gaXNBdHRhY2hlZChub2RlOk5vZGUpIHtcclxuICAgIHdoaWxlIChub2RlICYmIG5vZGUgIT09IGRvY3VtZW50KSB7XHJcbiAgICAgICAgbm9kZSA9IG5vZGUucGFyZW50Tm9kZTtcclxuICAgIH1cclxuICAgIHJldHVybiAobm9kZSA9PT0gZG9jdW1lbnQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaGFzQ2xhc3MoZWxlbWVudDpIVE1MRWxlbWVudCwgY2xhc3NOYW1lOnN0cmluZykge1xyXG4gICAgcmV0dXJuICgnICcgKyBlbGVtZW50LmNsYXNzTmFtZS50cmltKCkgKyAnICcpLmluZGV4T2YoJyAnICsgY2xhc3NOYW1lICsgJyAnKSAhPT0gLTE7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBhZGRDbGFzcyhlbGVtZW50OkhUTUxFbGVtZW50LCBjbGFzc05hbWU6c3RyaW5nKSB7XHJcbiAgICB2YXIgY2xhc3NlcyA9ICcgJyArIGVsZW1lbnQuY2xhc3NOYW1lLnRyaW0oKSArICcgJztcclxuICAgIGlmIChjbGFzc2VzLmluZGV4T2YoJyAnICsgY2xhc3NOYW1lICsgJyAnKSA9PT0gLTEpIHtcclxuICAgICAgICBjbGFzc2VzICs9ICcgJyArIGNsYXNzTmFtZTtcclxuICAgIH1cclxuICAgIGVsZW1lbnQuY2xhc3NOYW1lID0gY2xhc3Nlcy50cmltKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVDbGFzcyhlbGVtZW50OkhUTUxFbGVtZW50LCBjbGFzc05hbWU6c3RyaW5nKSB7XHJcbiAgICB2YXIgY2xhc3NlcyA9ICcgJyArIGVsZW1lbnQuY2xhc3NOYW1lLnRyaW0oKSArICcgJztcclxuICAgIHdoaWxlIChjbGFzc2VzLmluZGV4T2YoJyAnICsgY2xhc3NOYW1lICsgJyAnKSAhPT0gLTEpIHtcclxuICAgICAgICBjbGFzc2VzID0gY2xhc3Nlcy5yZXBsYWNlKCcgJyArIGNsYXNzTmFtZSArICcgJywgJyAnKTtcclxuICAgIH1cclxuICAgIGVsZW1lbnQuY2xhc3NOYW1lID0gY2xhc3Nlcy50cmltKCk7XHJcbn1cclxuIiwiLyogZ2xvYmFscyBSZXZlYWwgKi9cclxuXHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL3JldmVhbC9yZXZlYWwuZC50c1wiIC8+XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEluZGljZXMge1xyXG4gICAgaDogbnVtYmVyLFxyXG4gICAgdjogbnVtYmVyLFxyXG4gICAgZj86IG51bWJlclxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplU2xpZGUoaW5kaWNlczpJbmRpY2VzKTpJbmRpY2VzIHtcclxuICAgIGluZGljZXMuaCA9IGluZGljZXMuaCB8fCAwO1xyXG4gICAgaW5kaWNlcy52ID0gaW5kaWNlcy52IHx8IDA7XHJcbiAgICBpbmRpY2VzLmYgPSAodHlwZW9mIGluZGljZXMuZiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKGluZGljZXMuZikpID8gaW5kaWNlcy5mIDogLTE7XHJcbiAgICByZXR1cm4gaW5kaWNlcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNsaWRlc0VxdWFsKGxlZnQ6SW5kaWNlcywgcmlnaHQ6SW5kaWNlcyk6Ym9vbGVhbiB7XHJcbiAgICBpZiAoIWxlZnQgfHwgIXJpZ2h0KSB7XHJcbiAgICAgICAgcmV0dXJuICFsZWZ0ICYmICFyaWdodDtcclxuICAgIH1cclxuICAgIHJldHVybiBsZWZ0LmggPT09IHJpZ2h0LmggJiYgbGVmdC52ID09PSByaWdodC52ICYmIGxlZnQuZiA9PT0gcmlnaHQuZjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU2xpZGUoaGFzaDpzdHJpbmcpOkluZGljZXMge1xyXG4gICAgLy8gQXR0ZW1wdCB0byBwYXJzZSB0aGUgaGFzaCBhcyBlaXRoZXIgYW4gaW5kZXggb3IgbmFtZVxyXG4gICAgdmFyIGJpdHMgPSBoYXNoLnNwbGl0KCcvJyksXHJcbiAgICAgICAgaDpudW1iZXIsIHY6bnVtYmVyLCBmOm51bWJlcjtcclxuICAgIGlmIChpc05hTihwYXJzZUludChiaXRzWzBdLCAxMCkpKSB7XHJcbiAgICAgICAgLy8gTmFtZWQgc2xpZGVcclxuICAgICAgICB2YXIgbmFtZSA9IGJpdHNbMF0sXHJcbiAgICAgICAgICAgIGVsZW1lbnQ6SFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgLy8gRW5zdXJlIHRoZSBuYW1lZCBsaW5rIGlzIGEgdmFsaWQgSFRNTCBJRCBhdHRyaWJ1dGVcclxuICAgICAgICBpZiAoL15bYS16QS1aXVtcXHc6Li1dKiQvLnRlc3QobmFtZSkpIHtcclxuICAgICAgICAgICAgLy8gRmluZCB0aGUgc2xpZGUgd2l0aCB0aGUgc3BlY2lmaWVkIElEXHJcbiAgICAgICAgICAgIGVsZW1lbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChuYW1lKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFlbGVtZW50KSB7XHJcbiAgICAgICAgICAgIC8vIFVua25vd24gc2xpZGVcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIEZpbmQgdGhlIHBvc2l0aW9uIG9mIHRoZSBuYW1lZCBzbGlkZVxyXG4gICAgICAgIHZhciBpbmRpY2VzID0gUmV2ZWFsLmdldEluZGljZXMoZWxlbWVudCk7XHJcbiAgICAgICAgaCA9IGluZGljZXMuaDtcclxuICAgICAgICB2ID0gaW5kaWNlcy52O1xyXG4gICAgICAgIGYgPSBwYXJzZUludChiaXRzWzFdLCAxMCk7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICAvLyBJbmRleCBjb21wb25lbnRzXHJcbiAgICAgICAgaCA9IHBhcnNlSW50KGJpdHNbMF0sIDEwKTtcclxuICAgICAgICB2ID0gcGFyc2VJbnQoYml0c1sxXSwgMTApO1xyXG4gICAgICAgIGYgPSBwYXJzZUludChiaXRzWzJdLCAxMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG5vcm1hbGl6ZVNsaWRlKHtoOiBoLCB2OiB2LCBmOiBmfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBqdW1wVG9TbGlkZShzbGlkZTpJbmRpY2VzKSB7XHJcbiAgICBSZXZlYWwuc2xpZGUoc2xpZGUuaCwgc2xpZGUudiwgc2xpZGUuZik7XHJcbn1cclxuIiwiaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4vY29tbW9uJztcclxuaW1wb3J0IHsgVmlkZW8gfSBmcm9tICcuL3ZpZGVvJztcclxuaW1wb3J0ICogYXMgUmV2ZWFsVXRpbHMgZnJvbSAnLi9yZXZlYWwtdXRpbHMnO1xyXG5cclxudHlwZSBSZXZlYWxJbmRpY2VzID0gUmV2ZWFsVXRpbHMuSW5kaWNlcztcclxudHlwZSBTbGlkZU1hcCA9IHsgW2g6IG51bWJlcl0gOiB7IFt2OiBudW1iZXJdIDogeyBbZjogbnVtYmVyXSA6IFRleHRUcmFja0N1ZVtdIH0gfSB9O1xyXG5cclxuZXhwb3J0IGNsYXNzIFN5bmNocm9uaXplciBpbXBsZW1lbnRzIERpc3Bvc2FibGUge1xyXG5cclxuICAgIHByaXZhdGUgdmlkZW86VmlkZW87XHJcbiAgICBwcml2YXRlIHRyYWNrOlRleHRUcmFjaztcclxuXHJcbiAgICBwcml2YXRlIGFjdGl2ZUN1ZTpUZXh0VHJhY2tDdWU7XHJcbiAgICBwcml2YXRlIGFjdGl2ZVNsaWRlOlJldmVhbEluZGljZXM7XHJcblxyXG4gICAgcHJpdmF0ZSBzbGlkZU1hcDpTbGlkZU1hcDtcclxuXHJcbiAgICBwcml2YXRlIGN1ZUNoYW5nZUxpc3RlbmVyID0gKCkgPT4ge1xyXG4gICAgICAgIHRoaXMub25DdWVDaGFuZ2UoKTtcclxuICAgIH07XHJcblxyXG4gICAgcHJpdmF0ZSBzbGlkZUNoYW5nZUxpc3RlbmVyID0gKCkgPT4ge1xyXG4gICAgICAgIHRoaXMub25TbGlkZUNoYW5nZSgpO1xyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcih2aWRlbzpWaWRlbywgdHJhY2s6VGV4dFRyYWNrKSB7XHJcbiAgICAgICAgdGhpcy52aWRlbyA9IHZpZGVvO1xyXG4gICAgICAgIHRoaXMudHJhY2sgPSB0cmFjaztcclxuICAgICAgICB0aGlzLmluaXRpYWxpemUoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGluaXRpYWxpemUoKSB7XHJcbiAgICAgICAgdGhpcy5hY3RpdmVTbGlkZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5hY3RpdmVDdWUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMubG9hZFNsaWRlTWFwKCk7XHJcblxyXG4gICAgICAgIC8vIFNlZWsgdG8gaW5pdGlhbCBzbGlkZVxyXG4gICAgICAgIHRoaXMub25TbGlkZUNoYW5nZSgpO1xyXG5cclxuICAgICAgICAvLyBCaW5kIGxpc3RlbmVyc1xyXG4gICAgICAgIGlmICgnb25jdWVjaGFuZ2UnIGluIHRoaXMudHJhY2spIHtcclxuICAgICAgICAgICAgdGhpcy50cmFjay5hZGRFdmVudExpc3RlbmVyKCdjdWVjaGFuZ2UnLCB0aGlzLmN1ZUNoYW5nZUxpc3RlbmVyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBQb2x5ZmlsbCBtaXNzaW5nIHN1cHBvcnQgZm9yIGN1ZWNoYW5nZSBldmVudCB3aXRoIHRpbWV1cGRhdGVcclxuICAgICAgICAgICAgdGhpcy52aWRlby5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdGhpcy5jdWVDaGFuZ2VMaXN0ZW5lcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFJldmVhbC5hZGRFdmVudExpc3RlbmVyKCdzbGlkZWNoYW5nZWQnLCB0aGlzLnNsaWRlQ2hhbmdlTGlzdGVuZXIpO1xyXG4gICAgICAgIFJldmVhbC5hZGRFdmVudExpc3RlbmVyKCdmcmFnbWVudHNob3duJywgdGhpcy5zbGlkZUNoYW5nZUxpc3RlbmVyKTtcclxuICAgICAgICBSZXZlYWwuYWRkRXZlbnRMaXN0ZW5lcignZnJhZ21lbnRoaWRkZW4nLCB0aGlzLnNsaWRlQ2hhbmdlTGlzdGVuZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIGRpc3Bvc2UoKSB7XHJcbiAgICAgICAgdGhpcy5hY3RpdmVTbGlkZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5hY3RpdmVDdWUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuc2xpZGVNYXAgPSBudWxsO1xyXG5cclxuICAgICAgICAvLyBVbmJpbmQgbGlzdGVuZXJzXHJcbiAgICAgICAgdGhpcy50cmFjay5yZW1vdmVFdmVudExpc3RlbmVyKCdjdWVjaGFuZ2UnLCB0aGlzLmN1ZUNoYW5nZUxpc3RlbmVyKTtcclxuICAgICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB0aGlzLmN1ZUNoYW5nZUxpc3RlbmVyKTtcclxuICAgICAgICBSZXZlYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2xpZGVjaGFuZ2VkJywgdGhpcy5zbGlkZUNoYW5nZUxpc3RlbmVyKTtcclxuICAgICAgICBSZXZlYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnJhZ21lbnRzaG93bicsIHRoaXMuc2xpZGVDaGFuZ2VMaXN0ZW5lcik7XHJcbiAgICAgICAgUmV2ZWFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2ZyYWdtZW50aGlkZGVuJywgdGhpcy5zbGlkZUNoYW5nZUxpc3RlbmVyKTtcclxuXHJcbiAgICAgICAgdGhpcy52aWRlby5kaXNwb3NlKCk7XHJcbiAgICAgICAgdGhpcy52aWRlbyA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBvbkN1ZUNoYW5nZSgpIHtcclxuICAgICAgICAvLyBVcGRhdGUgYWN0aXZlIGN1ZVxyXG4gICAgICAgIHZhciBuZXdBY3RpdmVDdWUgPSB0aGlzLnRyYWNrLmFjdGl2ZUN1ZXMubGVuZ3RoID8gdGhpcy50cmFjay5hY3RpdmVDdWVzWzBdIDogbnVsbDtcclxuICAgICAgICBpZiAobmV3QWN0aXZlQ3VlID09PSB0aGlzLmFjdGl2ZUN1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuYWN0aXZlQ3VlID0gbmV3QWN0aXZlQ3VlO1xyXG4gICAgICAgIC8vIFVwZGF0ZSBhY3RpdmUgc2xpZGVcclxuICAgICAgICB2YXIgbmV3QWN0aXZlU2xpZGUgPSBTeW5jaHJvbml6ZXIuZ2V0Q3VlU2xpZGUodGhpcy5hY3RpdmVDdWUpO1xyXG4gICAgICAgIGlmICghbmV3QWN0aXZlU2xpZGUgfHwgUmV2ZWFsVXRpbHMuc2xpZGVzRXF1YWwobmV3QWN0aXZlU2xpZGUsIHRoaXMuYWN0aXZlU2xpZGUpKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5hY3RpdmVTbGlkZSA9IG5ld0FjdGl2ZVNsaWRlO1xyXG4gICAgICAgIC8vIEp1bXAgdG8gc2xpZGVcclxuICAgICAgICBSZXZlYWxVdGlscy5qdW1wVG9TbGlkZSh0aGlzLmFjdGl2ZVNsaWRlKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIG9uU2xpZGVDaGFuZ2UoKSB7XHJcbiAgICAgICAgdmFyIHNsaWRlID0gUmV2ZWFsVXRpbHMubm9ybWFsaXplU2xpZGUoUmV2ZWFsLmdldEluZGljZXMoKSk7XHJcbiAgICAgICAgaWYgKFJldmVhbFV0aWxzLnNsaWRlc0VxdWFsKHNsaWRlLCB0aGlzLmFjdGl2ZVNsaWRlKSkge1xyXG4gICAgICAgICAgICAvLyBBbHJlYWR5IGFjdGl2ZSBzbGlkZVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIEZpbmQgY3VlIGNsb3Nlc3QgaW4gdGltZSB3aXRoIHRoaXMgc2xpZGVcclxuICAgICAgICB2YXIgY3VlID0gdGhpcy5maW5kQ2xvc2VzdFNsaWRlQ3VlKHNsaWRlLCB0aGlzLnZpZGVvLmdldEN1cnJlbnRUaW1lKCkpO1xyXG4gICAgICAgIGlmICghY3VlKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gU2VlayB0byBzdGFydCBvZiBjbG9zZXN0IGN1ZVxyXG4gICAgICAgIHRoaXMudmlkZW8uc2V0Q3VycmVudFRpbWUoY3VlLnN0YXJ0VGltZSArIDAuMDAxKTsgLy8gYXZvaWQgb3ZlcmxhcCB3aXRoIHByZXZpb3VzXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBsb2FkU2xpZGVNYXAoKSB7XHJcbiAgICAgICAgdmFyIHNsaWRlTWFwOlNsaWRlTWFwID0gdGhpcy5zbGlkZU1hcCA9IHt9O1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy50cmFjay5jdWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBjdWUgPSB0aGlzLnRyYWNrLmN1ZXNbaV0sXHJcbiAgICAgICAgICAgICAgICBzbGlkZSA9IFN5bmNocm9uaXplci5nZXRDdWVTbGlkZShjdWUpO1xyXG4gICAgICAgICAgICBpZiAoc2xpZGUpIHtcclxuICAgICAgICAgICAgICAgIHZhciBoID0gc2xpZGVNYXBbc2xpZGUuaF0gfHwgKHNsaWRlTWFwW3NsaWRlLmhdID0ge30pLFxyXG4gICAgICAgICAgICAgICAgICAgIHYgPSBoW3NsaWRlLnZdIHx8IChoW3NsaWRlLnZdID0ge30pLFxyXG4gICAgICAgICAgICAgICAgICAgIGYgPSB2W3NsaWRlLmZdIHx8ICh2W3NsaWRlLmZdID0gW10pO1xyXG4gICAgICAgICAgICAgICAgZi5wdXNoKGN1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBmaW5kQ2xvc2VzdFNsaWRlQ3VlKHNsaWRlOlJldmVhbEluZGljZXMsIHRpbWU6bnVtYmVyKTpUZXh0VHJhY2tDdWUge1xyXG4gICAgICAgIHZhciBzbGlkZU1hcDpTbGlkZU1hcCA9IHRoaXMuc2xpZGVNYXA7XHJcbiAgICAgICAgaWYgKCFzbGlkZU1hcCkge1xyXG4gICAgICAgICAgICAvLyBOb3QgbG9hZGVkXHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgaCA9IHNsaWRlTWFwW3NsaWRlLmhdLFxyXG4gICAgICAgICAgICB2ID0gaCAmJiBoW3NsaWRlLnZdLFxyXG4gICAgICAgICAgICBmID0gdiAmJiB2W3NsaWRlLmZdO1xyXG4gICAgICAgIGlmICghZikge1xyXG4gICAgICAgICAgICAvLyBOb3QgZm91bmRcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBjbG9zZXN0Q3VlOlRleHRUcmFja0N1ZSxcclxuICAgICAgICAgICAgY2xvc2VzdERpc3RhbmNlID0gSW5maW5pdHk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBjdWUgPSBmW2ldLFxyXG4gICAgICAgICAgICAgICAgZGlzdGFuY2UgPSBNYXRoLm1pbihNYXRoLmFicyhjdWUuc3RhcnRUaW1lIC0gdGltZSksIE1hdGguYWJzKGN1ZS5lbmRUaW1lIC0gdGltZSkpO1xyXG4gICAgICAgICAgICBpZiAoY3VlLnN0YXJ0VGltZSA8PSB0aW1lICYmIHRpbWUgPCBjdWUuZW5kVGltZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gVGltZSBpbnNpZGUgY3VlIGludGVydmFsXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VlO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRpc3RhbmNlIDwgY2xvc2VzdERpc3RhbmNlKSB7XHJcbiAgICAgICAgICAgICAgICBjbG9zZXN0Q3VlID0gY3VlO1xyXG4gICAgICAgICAgICAgICAgY2xvc2VzdERpc3RhbmNlID0gZGlzdGFuY2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGNsb3Nlc3RDdWU7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzdGF0aWMgZ2V0Q3VlU2xpZGUoY3VlOlRleHRUcmFja0N1ZSk6UmV2ZWFsSW5kaWNlcyB7XHJcbiAgICAgICAgcmV0dXJuIGN1ZSAmJiBSZXZlYWxVdGlscy5wYXJzZVNsaWRlKGN1ZS50ZXh0KTtcclxuICAgIH1cclxuXHJcbn1cclxuIiwiaW1wb3J0IHsgVmlkZW8gfSBmcm9tICcuL3ZpZGVvJztcclxuXHJcbmV4cG9ydCBjbGFzcyBIVE1MNVZpZGVvIGltcGxlbWVudHMgVmlkZW8ge1xyXG4gICAgcHJpdmF0ZSB2aWRlbzpIVE1MVmlkZW9FbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgdmlkZW9NZXRhZGF0YUxpc3RlbmVyOkV2ZW50TGlzdGVuZXI7XHJcbiAgICBwcml2YXRlIHRyYWNrTG9hZExpc3RlbmVyOkV2ZW50TGlzdGVuZXI7XHJcbiAgICBwcml2YXRlIHRyYWNrRWxlbWVudDpIVE1MVHJhY2tFbGVtZW50O1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHZpZGVvOkhUTUxWaWRlb0VsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLnZpZGVvID0gdmlkZW87XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0Q3VycmVudFRpbWUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudmlkZW8uY3VycmVudFRpbWU7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Q3VycmVudFRpbWUodGltZTpudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnZpZGVvLmN1cnJlbnRUaW1lID0gdGltZTtcclxuICAgIH1cclxuXHJcbiAgICBhZGRFdmVudExpc3RlbmVyKHR5cGU6c3RyaW5nLCBoYW5kbGVyOigpID0+IHZvaWQpIHtcclxuICAgICAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgaGFuZGxlciwgZmFsc2UpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZTpzdHJpbmcsIGhhbmRsZXI6KCkgPT4gdm9pZCkge1xyXG4gICAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBoYW5kbGVyLCBmYWxzZSk7XHJcbiAgICB9XHJcblxyXG4gICAgb25SZWFkeShoYW5kbGVyOigpID0+IHZvaWQpIHtcclxuICAgICAgICBzZXRUaW1lb3V0KGhhbmRsZXIsIDApO1xyXG4gICAgfVxyXG5cclxuICAgIGxvYWRTbGlkZXMoc2xpZGVzVXJsOnN0cmluZywgY2FsbGJhY2s6KGVycm9yOkVycm9yLCB0cmFjaz86VGV4dFRyYWNrKSA9PiB2b2lkKSB7XHJcbiAgICAgICAgdGhpcy51bmxvYWRTbGlkZXMoKTtcclxuXHJcbiAgICAgICAgaWYgKCFzbGlkZXNVcmwpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdtaXNzaW5nIHNsaWRlcyBVUkwnKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuY3JlYXRlU2xpZGVzVHJhY2soc2xpZGVzVXJsLCAoZXJyb3IsIHRyYWNrRWxlbWVudCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9yKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLndhaXRGb3JUcmFja0xvYWQoKGVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvcik7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdmFyIHRyYWNrID0gdHJhY2tFbGVtZW50LnRyYWNrO1xyXG4gICAgICAgICAgICAgICAgdHJhY2subW9kZSA9ICdoaWRkZW4nO1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdHJhY2spO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBkaXNwb3NlKCkge1xyXG4gICAgICAgIHRoaXMudW5sb2FkU2xpZGVzKCk7XHJcbiAgICAgICAgdGhpcy52aWRlbyA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB3YWl0Rm9yTWV0YWRhdGEoY2FsbGJhY2s6KGVycm9yOkVycm9yKSA9PiB2b2lkKSB7XHJcbiAgICAgICAgaWYgKHRoaXMudmlkZW8ucmVhZHlTdGF0ZSA+PSBIVE1MTWVkaWFFbGVtZW50LkhBVkVfTUVUQURBVEEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKG51bGwpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMudmlkZW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBsaXN0ZW5lcik7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy52aWRlb01ldGFkYXRhTGlzdGVuZXIgPT09IGxpc3RlbmVyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52aWRlb01ldGFkYXRhTGlzdGVuZXIgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnZpZGVvLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgbGlzdGVuZXIpO1xyXG4gICAgICAgICAgICB0aGlzLnZpZGVvTWV0YWRhdGFMaXN0ZW5lciA9IGxpc3RlbmVyO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHdhaXRGb3JUcmFja0xvYWQoY2FsbGJhY2s6KGVycm9yOkVycm9yKSA9PiB2b2lkKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnRyYWNrRWxlbWVudCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKCdtaXNzaW5nIHRyYWNrIGVsZW1lbnQnKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLnRyYWNrRWxlbWVudC5yZWFkeVN0YXRlID09PSBIVE1MVHJhY2tFbGVtZW50LkxPQURFRCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdmFyIGxpc3RlbmVyID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50cmFja0VsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZCcsIGxpc3RlbmVyKTtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnRyYWNrTG9hZExpc3RlbmVyID09PSBsaXN0ZW5lcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudHJhY2tMb2FkTGlzdGVuZXIgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB0aGlzLnRyYWNrRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgbGlzdGVuZXIpO1xyXG4gICAgICAgICAgICB0aGlzLnRyYWNrTG9hZExpc3RlbmVyID0gbGlzdGVuZXI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY3JlYXRlU2xpZGVzVHJhY2soc2xpZGVzVXJsOnN0cmluZywgY2FsbGJhY2s6KGVycm9yOkVycm9yLCB0cmFja0VsZW1lbnQ/OkhUTUxUcmFja0VsZW1lbnQpID0+IHZvaWQpIHtcclxuICAgICAgICB0aGlzLndhaXRGb3JNZXRhZGF0YSgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvcik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdmFyIHRyYWNrRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyYWNrJyk7XHJcbiAgICAgICAgICAgIHRyYWNrRWxlbWVudC5raW5kID0gJ21ldGFkYXRhJztcclxuICAgICAgICAgICAgdHJhY2tFbGVtZW50LnNyYyA9IHNsaWRlc1VybDtcclxuICAgICAgICAgICAgdHJhY2tFbGVtZW50WydkZWZhdWx0J10gPSB0cnVlO1xyXG4gICAgICAgICAgICB0aGlzLnZpZGVvLmFwcGVuZENoaWxkKHRyYWNrRWxlbWVudCk7XHJcbiAgICAgICAgICAgIHRoaXMudHJhY2tFbGVtZW50ID0gdHJhY2tFbGVtZW50O1xyXG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0cmFja0VsZW1lbnQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdW5sb2FkU2xpZGVzKCkge1xyXG4gICAgICAgIGlmICh0aGlzLnZpZGVvTWV0YWRhdGFMaXN0ZW5lcikge1xyXG4gICAgICAgICAgICB0aGlzLnZpZGVvLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy52aWRlb01ldGFkYXRhTGlzdGVuZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy50cmFja0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudHJhY2tMb2FkTGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudHJhY2tFbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWQnLCB0aGlzLnRyYWNrTG9hZExpc3RlbmVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLnZpZGVvLnJlbW92ZUNoaWxkKHRoaXMudHJhY2tFbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy52aWRlb01ldGFkYXRhTGlzdGVuZXIgPSBudWxsO1xyXG4gICAgICAgIHRoaXMudHJhY2tMb2FkTGlzdGVuZXIgPSBudWxsO1xyXG4gICAgICAgIHRoaXMudHJhY2tFbGVtZW50ID0gbnVsbDtcclxuICAgIH1cclxuXHJcbn1cclxuIiwiaW1wb3J0IHsgVmlkZW8gfSBmcm9tICcuL3ZpZGVvJztcclxuaW1wb3J0IHsgSFRNTDVWaWRlbyB9IGZyb20gJy4vdmlkZW8taHRtbDUnO1xyXG5pbXBvcnQgeyBWaWRlb0pTVmlkZW8gfSBmcm9tICcuL3ZpZGVvLXZpZGVvanMnO1xyXG5pbXBvcnQgeyBTeW5jaHJvbml6ZXIgfSBmcm9tICcuL3N5bmNocm9uaXplcic7XHJcbmltcG9ydCAqIGFzIERPTVV0aWxzIGZyb20gJy4vZG9tLXV0aWxzJztcclxuXHJcbnZhciBjb250YWluZXJDbGFzczpzdHJpbmcgPSAncmV2ZWFsLXZpZGVvLXN5bmMnLFxyXG4gICAgY29udGFpbmVyOkhUTUxFbGVtZW50LFxyXG4gICAgdmlkZW9FbGVtZW50OkhUTUxWaWRlb0VsZW1lbnQsXHJcbiAgICB2aWRlb0NsYXNzOnN0cmluZyA9ICdyZXZlYWwtdmlkZW8tc3luYy1wbGF5ZXInO1xyXG5cclxuZnVuY3Rpb24gY3JlYXRlQ29udGFpbmVyKCkge1xyXG4gICAgdmFyIHJldmVhbDpOb2RlO1xyXG4gICAgaWYgKCFjb250YWluZXIpIHtcclxuICAgICAgICBjb250YWluZXIgPSA8SFRNTEVsZW1lbnQ+IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoY29udGFpbmVyQ2xhc3MpWzBdO1xyXG4gICAgICAgIGlmICghY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2FzaWRlJyk7XHJcbiAgICAgICAgICAgIGNvbnRhaW5lci5jbGFzc05hbWUgPSBjb250YWluZXJDbGFzcztcclxuICAgICAgICAgICAgcmV2ZWFsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnJldmVhbCcpO1xyXG4gICAgICAgICAgICBpZiAocmV2ZWFsLm5leHRTaWJsaW5nKSB7XHJcbiAgICAgICAgICAgICAgICByZXZlYWwucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoY29udGFpbmVyLCByZXZlYWwubmV4dFNpYmxpbmcpXHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXZlYWwucGFyZW50Tm9kZS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlVmlkZW9FbGVtZW50KCkge1xyXG4gICAgdmFyIGNvbnRhaW5lciA9IGNyZWF0ZUNvbnRhaW5lcigpO1xyXG4gICAgaWYgKCF2aWRlb0VsZW1lbnQpIHtcclxuICAgICAgICB2aWRlb0VsZW1lbnQgPSBjb250YWluZXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3ZpZGVvJylbMF07XHJcbiAgICAgICAgaWYgKCF2aWRlb0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgdmlkZW9FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndmlkZW8nKTtcclxuICAgICAgICAgICAgdmlkZW9FbGVtZW50LmNvbnRyb2xzID0gdHJ1ZTtcclxuICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHZpZGVvRWxlbWVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHZpZGVvRWxlbWVudDtcclxufVxyXG5cclxudHlwZSBDYWxsYmFjayA9IChlcnJvcjpFcnJvciwgc3luY2hyb25pemVyPzpTeW5jaHJvbml6ZXIpID0+IHZvaWQ7XHJcblxyXG5mdW5jdGlvbiBsb2FkU2xpZGVzKHZpZGVvOlZpZGVvLCBzbGlkZXNWdHRVcmw6c3RyaW5nLCBjYWxsYmFjaz86Q2FsbGJhY2spIHtcclxuICAgIHJldHVybiB2aWRlby5sb2FkU2xpZGVzKHNsaWRlc1Z0dFVybCwgKGVycm9yLCB0cmFjaykgPT4ge1xyXG4gICAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycm9yKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgc3luY2hyb25pemVyID0gbmV3IFN5bmNocm9uaXplcih2aWRlbywgdHJhY2spO1xyXG4gICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sobnVsbCwgc3luY2hyb25pemVyKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudCgpOkhUTUxWaWRlb0VsZW1lbnQge1xyXG4gICAgcmV0dXJuIGNyZWF0ZVZpZGVvRWxlbWVudCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaHRtbDUodmlkZW9FbGVtZW50OkhUTUxWaWRlb0VsZW1lbnQsIHNsaWRlc1Z0dFVybDpzdHJpbmcsIGNhbGxiYWNrPzpDYWxsYmFjayk6dm9pZCB7XHJcbiAgICB2YXIgY29udGFpbmVyID0gY3JlYXRlQ29udGFpbmVyKCksXHJcbiAgICAgICAgdmlkZW86VmlkZW87XHJcbiAgICBpZiAoIURPTVV0aWxzLmlzQXR0YWNoZWQodmlkZW9FbGVtZW50KSkge1xyXG4gICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh2aWRlb0VsZW1lbnQpO1xyXG4gICAgfVxyXG4gICAgRE9NVXRpbHMuYWRkQ2xhc3ModmlkZW9FbGVtZW50LCB2aWRlb0NsYXNzKTtcclxuICAgIHZpZGVvID0gbmV3IEhUTUw1VmlkZW8odmlkZW9FbGVtZW50KTtcclxuICAgIHZpZGVvLm9uUmVhZHkoKCkgPT4ge1xyXG4gICAgICAgIGxvYWRTbGlkZXModmlkZW8sIHNsaWRlc1Z0dFVybCwgY2FsbGJhY2spO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB2aWRlb2pzKHBsYXllcjpWaWRlb0pTUGxheWVyLCBzbGlkZXNWdHRVcmw6c3RyaW5nLCBjYWxsYmFjaz86Q2FsbGJhY2spOnZvaWQge1xyXG4gICAgdmFyIHZpZGVvOlZpZGVvO1xyXG4gICAgaWYgKCF2aWRlb2pzKSB7XHJcbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhuZXcgRXJyb3IoJ3ZpZGVvLmpzIG5vdCBsb2FkZWQnKSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgcGxheWVyLmFkZENsYXNzKHZpZGVvQ2xhc3MpO1xyXG4gICAgcGxheWVyLmFkZENsYXNzKCd2aWRlby1qcycpO1xyXG4gICAgdmlkZW8gPSBuZXcgVmlkZW9KU1ZpZGVvKHBsYXllcik7XHJcbiAgICB2aWRlby5vblJlYWR5KCgpID0+IHtcclxuICAgICAgICBsb2FkU2xpZGVzKHZpZGVvLCBzbGlkZXNWdHRVcmwsIGNhbGxiYWNrKTtcclxuICAgIH0pO1xyXG59XHJcbiIsIi8qIGdsb2JhbHMgdmlkZW9qcyAqL1xyXG5cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vdmlkZW9qcy5kLnRzXCIgLz5cclxuXHJcbmltcG9ydCB7IFZpZGVvIH0gZnJvbSAnLi92aWRlbyc7XHJcblxyXG5leHBvcnQgY2xhc3MgVmlkZW9KU1ZpZGVvIGltcGxlbWVudHMgVmlkZW8ge1xyXG4gICAgcHJpdmF0ZSBwbGF5ZXI6VmlkZW9KU1BsYXllcjtcclxuXHJcbiAgICBwcml2YXRlIHNsaWRlc1RyYWNrOlRleHRUcmFjaztcclxuICAgIHByaXZhdGUgY3VlTG9hZFRpbWVyOm51bWJlcjtcclxuICAgIHByaXZhdGUgc3RhdGljIGN1ZUxvYWRUaW1lb3V0ID0gMTAwO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHBsYXllcjpWaWRlb0pTUGxheWVyKSB7XHJcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgZ2V0Q3VycmVudFRpbWUoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucGxheWVyLmN1cnJlbnRUaW1lKCk7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0Q3VycmVudFRpbWUodGltZTpudW1iZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXllci5jdXJyZW50VGltZSh0aW1lKTtcclxuICAgIH1cclxuXHJcbiAgICBnZXRTb3VyY2UoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucGxheWVyLmN1cnJlbnRTcmMoKTtcclxuICAgIH1cclxuXHJcbiAgICBzZXRTb3VyY2Uoc291cmNlOnN0cmluZykge1xyXG4gICAgICAgIHRoaXMucGxheWVyLnNyYyhzb3VyY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGFkZEV2ZW50TGlzdGVuZXIodHlwZTpzdHJpbmcsIGhhbmRsZXI6KCkgPT4gdm9pZCkge1xyXG4gICAgICAgIHRoaXMucGxheWVyLm9uKHR5cGUsIGhhbmRsZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZTpzdHJpbmcsIGhhbmRsZXI6KCkgPT4gdm9pZCkge1xyXG4gICAgICAgIHRoaXMucGxheWVyLm9mZih0eXBlLCBoYW5kbGVyKTtcclxuICAgIH1cclxuXHJcbiAgICBvblJlYWR5KGhhbmRsZXI6KCkgPT4gdm9pZCkge1xyXG4gICAgICAgIHRoaXMucGxheWVyLnJlYWR5KGhhbmRsZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIHdhaXRGb3JUcmFja0xvYWQoY2FsbGJhY2s6KCkgPT4gdm9pZCkge1xyXG4gICAgICAgIC8vIFZpZGVvSlMgZG9lcyBub3QgcHJvdmlkZSBhICdsb2FkJyBldmVudCBmb3IgdGV4dCB0cmFja3NcclxuICAgICAgICAvLyBzbyBqdXN0IHBvbGwgdGhlIGN1ZXMgbGlzdCB1bnRpbCBpdCBoYXMgYSBzdGFibGUgbnVtYmVyIG9mIGN1ZXNcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMsXHJcbiAgICAgICAgICAgIGxhc3RDdWVMZW5ndGggPSAwLFxyXG4gICAgICAgICAgICBjaGVja0N1ZUxvYWQgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjbGVhclRpbWVvdXQoc2VsZi5jdWVMb2FkVGltZXIpO1xyXG4gICAgICAgICAgICAgICAgdmFyIG5ld0N1ZUxlbmd0aCA9IHNlbGYuc2xpZGVzVHJhY2suY3VlcyAmJiBzZWxmLnNsaWRlc1RyYWNrLmN1ZXMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgaWYgKG5ld0N1ZUxlbmd0aCA+IDAgJiYgbGFzdEN1ZUxlbmd0aCA9PT0gbmV3Q3VlTGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGFzdEN1ZUxlbmd0aCA9IG5ld0N1ZUxlbmd0aDtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1ZUxvYWRUaW1lciA9IHNldFRpbWVvdXQoY2hlY2tDdWVMb2FkLCBWaWRlb0pTVmlkZW8uY3VlTG9hZFRpbWVvdXQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIGNoZWNrQ3VlTG9hZCgpO1xyXG4gICAgfVxyXG5cclxuICAgIGxvYWRTbGlkZXMoc2xpZGVzVXJsOnN0cmluZywgY2FsbGJhY2s6KGVycm9yOkVycm9yLCB0cmFjaz86VGV4dFRyYWNrKSA9PiB2b2lkKSB7XHJcbiAgICAgICAgdGhpcy51bmxvYWRTbGlkZXMoKTtcclxuXHJcbiAgICAgICAgaWYgKCFzbGlkZXNVcmwpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdtaXNzaW5nIHNsaWRlcyBVUkwnKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuc2xpZGVzVHJhY2sgPSB0aGlzLnBsYXllci5hZGRSZW1vdGVUZXh0VHJhY2soe1xyXG4gICAgICAgICAgICBraW5kOiAnbWV0YWRhdGEnLFxyXG4gICAgICAgICAgICBtb2RlOiAnc2hvd2luZycsXHJcbiAgICAgICAgICAgICdkZWZhdWx0JzogdHJ1ZSxcclxuICAgICAgICAgICAgc3JjOiBzbGlkZXNVcmxcclxuICAgICAgICB9KS50cmFjaztcclxuXHJcbiAgICAgICAgdGhpcy53YWl0Rm9yVHJhY2tMb2FkKCgpID0+IHtcclxuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgdGhpcy5zbGlkZXNUcmFjayk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZGlzcG9zZSgpIHtcclxuICAgICAgICB0aGlzLnVubG9hZFNsaWRlcygpO1xyXG4gICAgICAgIHRoaXMucGxheWVyID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHVubG9hZFNsaWRlcygpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5jdWVMb2FkVGltZXIpO1xyXG4gICAgICAgIGlmICh0aGlzLnNsaWRlc1RyYWNrKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGxheWVyLnJlbW92ZVJlbW90ZVRleHRUcmFjayh0aGlzLnNsaWRlc1RyYWNrKTtcclxuICAgICAgICAgICAgdGhpcy5zbGlkZXNUcmFjayA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxufVxyXG4iXSwic291cmNlUm9vdCI6Ii4uIn0=
