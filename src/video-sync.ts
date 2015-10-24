/* globals Reveal */

/// <reference path="../typings/reveal/reveal.d.ts" />

declare var require:(name:string) => any;

interface Disposable {
    dispose() : void;
}

interface Video extends Disposable {
    getCurrentTime() : number;
    setCurrentTime(time:number) : void;

    addEventListener(type:string, handler:() => void) : void;
    removeEventListener(type:string, handler:() => void) : void;

    loadSlides(slidesVttUrl:string, callback:(error:Error, track?:TextTrack) => void) : void;
}

class HTML5Video implements Video {
    private video:HTMLVideoElement;

    private videoMetadataListener:EventListener;
    private trackLoadListener:EventListener;
    private trackElement:HTMLTrackElement;

    constructor(video:HTMLVideoElement) {
        this.video = video;
    }

    getCurrentTime() {
        return this.video.currentTime;
    }

    setCurrentTime(time:number) {
        this.video.currentTime = time;
    }

    addEventListener(type:string, handler:() => void) {
        this.video.addEventListener(type, handler, false);
    }

    removeEventListener(type:string, handler:() => void) {
        this.video.removeEventListener(type, handler, false);
    }

    loadSlides(slidesUrl:string, callback:(error:Error, track?:TextTrack) => void) {
        this.unloadSlides();

        if (!slidesUrl) {
            callback(new Error('missing slides URL'));
            return;
        }

        this.createSlidesTrack(slidesUrl, (error, trackElement) => {
            if (error) {
                callback(error);
                return;
            }
            this.waitForTrackLoad((error) => {
                if (error) {
                    callback(error);
                    return;
                }
                var track = trackElement.track;
                track.mode = 'hidden';
                callback(null, track);
            });
        });
    }

    dispose() {
        this.unloadSlides();
        this.video = null;
    }

    private waitForMetadata(callback:(error:Error) => void) {
        if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            return callback(null);
        } else {
            var listener = () => {
                this.video.removeEventListener('loadedmetadata', listener);
                if (this.videoMetadataListener === listener) {
                    this.videoMetadataListener = null;
                    callback(null);
                }
            };
            this.video.addEventListener('loadedmetadata', listener);
            this.videoMetadataListener = listener;
        }
    }

    private waitForTrackLoad(callback:(error:Error) => void) {
        if (!this.trackElement) {
            return callback(new Error('missing track element'));
        }
        if (this.trackElement.readyState === HTMLTrackElement.LOADED) {
            return callback(null);
        } else {
            var listener = () => {
                this.trackElement.removeEventListener('load', listener);
                if (this.trackLoadListener === listener) {
                    this.trackLoadListener = null;
                    callback(null);
                }
            };
            this.trackElement.addEventListener('load', listener);
            this.trackLoadListener = listener;
        }
    }

    private createSlidesTrack(slidesUrl:string, callback:(error:Error, trackElement?:HTMLTrackElement) => void) {
        this.waitForMetadata((error) => {
            if (error) {
                callback(error);
                return;
            }
            var trackElement = document.createElement('track');
            trackElement.kind = 'metadata';
            trackElement.src = slidesUrl;
            trackElement['default'] = true;
            this.video.appendChild(trackElement);
            this.trackElement = trackElement;
            callback(null, trackElement);
        });
    }

    private unloadSlides() {
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
    }

}

interface RevealIndices {
    h: number,
    v: number,
    f?: number
}

module RevealUtils {

    export function normalizeSlide(indices:RevealIndices):RevealIndices {
        indices.h = indices.h || 0;
        indices.v = indices.v || 0;
        indices.f = (typeof indices.f === 'number' && !isNaN(indices.f)) ? indices.f : -1;
        return indices;
    }

    export function slidesEqual(left:RevealIndices, right:RevealIndices):boolean {
        if (!left || !right) {
            return !left && !right;
        }
        return left.h === right.h && left.v === right.v && left.f === right.f;
    }

    export function parseSlide(hash:string):RevealIndices {
        // Attempt to parse the hash as either an index or name
        var bits = hash.split('/'),
            h:number, v:number, f:number;
        if (isNaN(parseInt(bits[0], 10))) {
            // Named slide
            var name = bits[0],
                element:HTMLElement;
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

    export function jumpToSlide(slide:RevealIndices) {
        Reveal.slide(slide.h, slide.v, slide.f);
    }

}

type SlideMap = { [h: number] : { [v: number] : { [f: number] : TextTrackCue[] } } };

class Synchronizer implements Disposable {

    private video:Video;
    private track:TextTrack;

    private activeCue:TextTrackCue;
    private activeSlide:RevealIndices;

    private slideMap:SlideMap;

    private cueChangeListener = () => {
        this.onCueChange();
    };

    private slideChangeListener = () => {
        this.onSlideChange();
    };

    constructor(video:Video, track:TextTrack) {
        this.video = video;
        this.track = track;
        this.initialize();
    }

    private initialize() {
        this.activeSlide = null;
        this.activeCue = null;
        this.loadSlideMap();

        // Seek to initial slide
        this.onSlideChange();

        // Bind listeners
        if ('oncuechange' in this.track) {
            this.track.addEventListener('cuechange', this.cueChangeListener);
        } else {
            // Polyfill missing support for cuechange event with timeupdate
            this.video.addEventListener('timeupdate', this.cueChangeListener);
        }
        Reveal.addEventListener('slidechanged', this.slideChangeListener);
        Reveal.addEventListener('fragmentshown', this.slideChangeListener);
        Reveal.addEventListener('fragmenthidden', this.slideChangeListener);
    }

    dispose() {
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
    }

    private onCueChange() {
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
    }

    private onSlideChange() {
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
    }

    private loadSlideMap() {
        var slideMap:SlideMap = this.slideMap = {};
        for (var i = 0; i < this.track.cues.length; i++) {
            var cue = this.track.cues[i],
                slide = Synchronizer.getCueSlide(cue);
            if (slide) {
                var h = slideMap[slide.h] || (slideMap[slide.h] = {}),
                    v = h[slide.v] || (h[slide.v] = {}),
                    f = v[slide.f] || (v[slide.f] = []);
                f.push(cue);
            }
        }
    }

    private findClosestSlideCue(slide:RevealIndices, time:number):TextTrackCue {
        var slideMap:SlideMap = this.slideMap;
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
        var closestCue:TextTrackCue,
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

    private static getCueSlide(cue:TextTrackCue):RevealIndices {
        return cue && RevealUtils.parseSlide(cue.text);
    }

}

module RevealVideoSync {

    var containerClass:string = 'reveal-video-sync',
        container:HTMLElement,
        videoElement:HTMLVideoElement,
        video:Video;

    function loadVideo(videoUrl:string) {
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
        if (!videoElement) {
            videoElement = container.getElementsByTagName('video')[0];
            if (!videoElement) {
                videoElement = document.createElement('video');
                videoElement.controls = true;
                container.appendChild(videoElement);
            }
        }
        // Video interface
        if (!video) {
            video = new HTML5Video(videoElement);
        }
        videoElement.src = videoUrl;
        return video;
    }

    export function load(videoUrl:string, slidesVttUrl:string, callback?:(error:Error, synchronizer?:Synchronizer) => void):void {
        var video = loadVideo(videoUrl);
        return video.loadSlides(slidesVttUrl, (error, track) => {
            if (error) {
                if (callback) callback(error);
                return;
            }
            var synchronizer = new Synchronizer(video, track);
            if (callback) callback(null, synchronizer);
        });
    }

}

export = RevealVideoSync;
