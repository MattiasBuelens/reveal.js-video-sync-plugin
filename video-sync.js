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
                container.appendChild(video);
            }
        }
    }

    function syncVideo(videoUrl) {
        initialize();

        video.src = videoUrl;
        video.controls = true;
    }

    // TODO DEBUG
    initialize();
    syncVideo('http://www.webestools.com/page/media/videoTag/BigBuckBunny.webm');

    return {
        syncVideo: syncVideo
    };
})();