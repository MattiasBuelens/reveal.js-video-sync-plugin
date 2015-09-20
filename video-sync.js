/*!
 * reveal.js video sync
 *
 * Synchronize video playback with reveal.js slide changes.
 * Can be used for conference talk recordings or online classrooms.
 *
 * By Mattias Buelens (http://github.com/MattiasBuelens)
 */

var RevealVideoSync = (function () {
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
        if (trackMetadataListener) {
            video.removeEventListener('loadedmetadata', trackMetadataListener);
        }
        if (trackElement) {
            video.removeChild(trackElement);
        }
        // Create new track
        trackElement = document.createElement('track');
        trackElement.kind = 'metadata';
        trackElement.src = vttUrl;
        trackElement.default = true;
        trackElement.addEventListener('load', function () {
            track = trackElement.track;
            track.mode = 'hidden';
            track.addEventListener('cuechange', cueChanged);
        });
        video.appendChild(trackElement);
    }

    function jumpToSlide(hash) {
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
                return false;
            }
            // Find the position of the named slide
            var indices = Reveal.getIndices(element);
            h = indices.h;
            v = indices.v;
            f = parseInt(bits[1], 10) || 0;
        }
        else {
            // Index components
            h = parseInt(bits[0], 10) || 0;
            v = parseInt(bits[1], 10) || 0;
            f = parseInt(bits[2], 10) || 0;
        }

        // Jump to slide
        Reveal.slide(h, v, f);
        return true;
    }

    function cueChanged() {
        var cues = trackElement.track.activeCues;
        if (cues.length) {
            jumpToSlide(cues[0].text);
        }
    }

    function loadVideo(videoUrl, slidesUrl) {
        initialize();

        video.src = videoUrl;
        setTrack(slidesUrl);
    }

    return {
        load: loadVideo
    };
})();