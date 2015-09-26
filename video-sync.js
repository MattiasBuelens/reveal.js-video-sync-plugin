/*!
 * reveal.js video sync
 *
 * Synchronize video playback with reveal.js slide changes.
 * Can be used for conference talk recordings or online classrooms.
 *
 * By Mattias Buelens (http://github.com/MattiasBuelens)
 */

var RevealVideoSync = (function (Reveal) {
    'use strict';

    var containerClass = 'reveal-video-sync',
        container,
        video;

    function initialize() {
        // Video container
        if (!container) {
            container = document.getElementsByClassName(containerClass);
            if (container.length) {
                container = container[0];
            } else {
                container = document.createElement('aside');
                container.className = containerClass;
                document.querySelector('.reveal').appendChild(container);
            }
        }
        // Video element
        if (!video) {
            video = container.querySelector('video');
            if (!video) {
                video = document.createElement('video');
                video.controls = true;
                container.appendChild(video);
            }
        }
    }

    var trackElement,
        track,
        trackMetadataListener;

    function setTrack(vttUrl) {
        if (video.readyState <= 0) {
            // Wait for metadata
            trackMetadataListener = function () {
                setTrack(vttUrl);
            };
            video.addEventListener('loadedmetadata', trackMetadataListener);
            return;
        }
        // Clean up
        removeTrack();
        // Create new track
        trackElement = document.createElement('track');
        trackElement.kind = 'metadata';
        trackElement.src = vttUrl;
        trackElement.default = true;
        trackElement.addEventListener('load', function () {
            track = trackElement.track;
            track.mode = 'hidden';
            trackLoaded();
        });
        video.appendChild(trackElement);
    }

    function removeTrack() {
        if (trackMetadataListener) {
            video.removeEventListener('loadedmetadata', trackMetadataListener);
        }
        if (track) {
            trackUnloaded();
            track = null;
        }
        if (trackElement) {
            video.removeChild(trackElement);
            trackElement = null;
        }
    }

    function normalizeSlide(indices) {
        indices.h = indices.h || 0;
        indices.v = indices.v || 0;
        indices.f = (indices.f === undefined || isNaN(indices.f)) ? -1 : indices.f;
        return indices;
    }

    function slidesEqual(left, right) {
        if (!left || !right) {
            return !left && !right;
        }
        return left.h === right.h && left.v === right.v && left.f === right.f;
    }

    function parseSlide(hash) {
        // Attempt to parse the hash as either an index or name
        var bits = hash.split('/'),
            h, v, f;
        if (isNaN(parseInt(bits[0], 10))) {
            // Named slide
            var name = bits[0],
                element;
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

        return normalizeSlide({h: h, v: v, f: f});
    }

    function getCueSlide(cue) {
        return parseSlide(cue.text);
    }

    function getActiveCueSlide() {
        var cues = trackElement.track.activeCues;
        return cues.length && getCueSlide(cues[0]);
    }

    function jumpToSlide(slide) {
        Reveal.slide(slide.h, slide.v, slide.f);
    }

    var slideMap;

    function loadSlideMap(track) {
        slideMap = {};
        for (var i = 0; i < track.cues.length; i++) {
            var cue = track.cues[i],
                slide = getCueSlide(cue);
            if (slide) {
                var h = slideMap[slide.h] || (slideMap[slide.h] = {}),
                    v = h[slide.v] || (h[slide.v] = {}),
                    f = v[slide.f] || (v[slide.f] = []);
                f.push(cue);
            }
        }
    }

    function findClosestSlideCue(slide, time) {
        if (!slideMap) {
            // Not loaded
            return null;
        }
        var h = slideMap[slide.h],
            v = h && h[slide.v],
            f = v && v[slide.f];
        if (!f) {
            // Not found
            return null;
        }
        var closestCue,
            closestDistance = Infinity;
        for (var i = 0; i < f.length; i++) {
            var cue = f[i],
                distance = Math.min(Math.abs(cue.startTime - time), Math.abs(cue.endTime - time));
            if (cue.startTime <= time && time < cue.endTime) {
                // Time inside cue interval
                return cue;
            } else if (distance < closestDistance) {
                closestCue = cue;
                closestDistance = distance;
            }
        }
        return closestCue;
    }

    var activeCueSlide;

    function cueChanged() {
        // Update slide of active cue
        activeCueSlide = getActiveCueSlide();
        if (!activeCueSlide) {
            return;
        }
        // Jump to slide
        jumpToSlide(activeCueSlide);
    }

    function slideChanged() {
        var slide = normalizeSlide(Reveal.getIndices());
        if (slidesEqual(slide, activeCueSlide)) {
            // Already active slide
            return;
        }
        // Find cue closest in time with this slide
        var cue = findClosestSlideCue(slide, video.currentTime);
        if (!cue) {
            return;
        }
        // Seek to start of closest cue
        video.currentTime = cue.startTime + 0.001; // avoid overlap with previous
    }

    function trackLoaded() {
        activeCueSlide = null;
        loadSlideMap(track);

        // Seek to initial slide
        slideChanged();

        // Bind listeners
        track.addEventListener('cuechange', cueChanged);
        Reveal.addEventListener('slidechanged', slideChanged);
        Reveal.addEventListener('fragmentshown', slideChanged);
        Reveal.addEventListener('fragmenthidden', slideChanged);
    }

    function trackUnloaded() {
        activeCueSlide = null;
        slideMap = null;

        // Unbind listeners
        track.removeEventListener('cuechange', cueChanged);
        Reveal.removeEventListener('slidechanged', slideChanged);
        Reveal.removeEventListener('fragmentshown', slideChanged);
        Reveal.removeEventListener('fragmenthidden', slideChanged);
    }

    function loadVideo(videoUrl, slidesUrl) {
        initialize();

        video.src = videoUrl;
        setTrack(slidesUrl);
    }

    return {
        load: loadVideo
    };
})(window.Reveal);
