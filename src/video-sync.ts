/// <reference path="../typings/reveal/reveal.d.ts" />

/* globals Reveal */

module RevealVideoSync {

    var containerClass:string = 'reveal-video-sync',
        container:HTMLElement,
        video:HTMLVideoElement;

    function initialize() {
        // Video container
        if (!container) {
            container = <HTMLElement> document.getElementsByClassName(containerClass)[0];
            if (!container) {
                container = document.createElement('aside');
                container.className = containerClass;
                document.querySelector('.reveal').appendChild(container);
            }
        }
        // Video element
        if (!video) {
            video = <HTMLVideoElement> container.querySelector('video');
            if (!video) {
                video = document.createElement('video');
                video.controls = true;
                container.appendChild(video);
            }
        }
    }

    var trackElement:HTMLTrackElement,
        track:TextTrack,
        trackMetadataListener:() => void;

    function setTrack(vttUrl:string) {
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

    interface Indices {
        h: number,
        v: number,
        f?: number
    }

    function normalizeSlide(indices:Indices):Indices {
        indices.h = indices.h || 0;
        indices.v = indices.v || 0;
        indices.f = (typeof indices.f === 'number' && !isNaN(indices.f)) ? indices.f : -1;
        return indices;
    }

    function slidesEqual(left:Indices, right:Indices):boolean {
        if (!left || !right) {
            return !left && !right;
        }
        return left.h === right.h && left.v === right.v && left.f === right.f;
    }

    function parseSlide(hash:string):Indices {
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

    function getCueSlide(cue:TextTrackCue) {
        return parseSlide(cue.text);
    }

    function getActiveCueSlide():Indices {
        var cues = trackElement.track.activeCues;
        return cues.length && getCueSlide(cues[0]);
    }

    function jumpToSlide(slide:Indices) {
        Reveal.slide(slide.h, slide.v, slide.f);
    }

    var slideMap:{ [h: number] : { [v: number] : { [f: number] : TextTrackCue[] } } };

    function loadSlideMap(track:TextTrack) {
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

    function findClosestSlideCue(slide:Indices, time:number):TextTrackCue {
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

    var activeCueSlide:Indices;

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

    var activeCue:TextTrackCue;

    function timeUpdated() {
        if (!track) {
            return;
        }
        var newActiveCue = track.activeCues.length ? track.activeCues[0] : null;
        if (newActiveCue !== activeCue) {
            activeCue = newActiveCue;
            cueChanged();
        }
    }

    function trackLoaded() {
        activeCueSlide = null;
        activeCue = null;
        loadSlideMap(track);

        // Seek to initial slide
        slideChanged();

        // Bind listeners
        if ('oncuechange' in track) {
            track.addEventListener('cuechange', cueChanged);
        } else {
            // Polyfill missing support for cuechange event with timeupdate
            video.addEventListener('timeupdate', timeUpdated);
        }
        Reveal.addEventListener('slidechanged', slideChanged);
        Reveal.addEventListener('fragmentshown', slideChanged);
        Reveal.addEventListener('fragmenthidden', slideChanged);
    }

    function trackUnloaded() {
        activeCueSlide = null;
        activeCue = null;
        slideMap = null;

        // Unbind listeners
        track.removeEventListener('cuechange', cueChanged);
        video.removeEventListener('timeupdate', timeUpdated);
        Reveal.removeEventListener('slidechanged', slideChanged);
        Reveal.removeEventListener('fragmentshown', slideChanged);
        Reveal.removeEventListener('fragmenthidden', slideChanged);
    }

    export function load(videoUrl:string, slidesUrl:string) {
        initialize();

        video.src = videoUrl;
        setTrack(slidesUrl);
    }
}
