/* globals Reveal */

/// <reference path="../typings/reveal/reveal.d.ts" />
/// <reference path="./promise.d.ts" />

declare var require;

import Promise = require('promise');

class CancellationError implements Error {
    name = "cancel";
    message = "cancelled";

    constructor() {
        Error.call(this);
    }
}

class CancellablePromise<R> extends Promise<R> {
    private _parent:CancellablePromise<R>;

    private _cancelPromise:Promise<any>;
    private _cancelFunction:() => void;

    private _isDone:boolean;
    private _isCancelled:boolean;

    constructor(original, parent?:CancellablePromise<any>) {
        this._parent = parent;
        var originalPromise = new Promise(original);
        var cancelPromise = new Promise((resolve, reject) => {
            if (!this._isDone) {
                this._cancelFunction = reject.bind(new Error("cancelled"));
                if (this._isCancelled) {
                    this._cancelFunction();
                }
            }
        });
        // Cancel self when parent is cancelled
        if (this._parent) {
            cancelPromise = Promise.race([
                cancelPromise,
                this._parent._cancelPromise
            ]);
        }
        this._cancelPromise = cancelPromise;
        // Clean up on success
        var onSuccess = () => {
            this._isDone = true;
            this._cancelFunction = null;
        };
        originalPromise.then(onSuccess, onSuccess);
        // Clean up on cancel
        var onCancel = () => {
            this._isCancelled = true;
            this._cancelFunction = null;
        };
        this._cancelPromise.catch(onCancel);
        // Race between success and cancel
        super((resolve, reject) => {
            originalPromise.then(resolve, reject);
            cancelPromise.then(null, reject);
        });
    }

    isCancelled() {
        return !this._isDone && (this._isCancelled || (this._parent && this._parent.isCancelled()));
    }

    private doCancel() {
        if (this._isDone) {
            return false;
        }
        if (this._parent && this._parent.doCancel()) {
            // Cancelled parent
            return true;
        } else if (this._cancelFunction) {
            // Cancelled self
            this._cancelFunction();
        } else {
            // Will cancel self
            this._isCancelled = true;
        }
        return true;
    }

    cancel() {
        this.doCancel();
        return this;
    }

    then<U>(onFulfilled, onRejected?):CancellablePromise<U> {
        return this.toCancellable(super.then((value) => {
            return this.toCancellable(Promise.resolve(value).then(onFulfilled));
        }, (reason) => {
            return this.toCancellable(Promise.reject(reason).then(null, onRejected));
        }));
    }

    done(onFulfilled, onRejected?):CancellablePromise<R> {
        return <CancellablePromise<R>> super.done(onFulfilled, onRejected);
    }

    catch(onRejected?):CancellablePromise<R> {
        return <CancellablePromise<R>> super.catch(onRejected);
    }

    finally(handler):CancellablePromise<R> {
        return <CancellablePromise<R>> super.finally(handler);
    }

    nodeify(func):CancellablePromise<R> {
        return <CancellablePromise<R>> super.nodeify(func);
    }

    static resolve<R>(value:R|Promise<R>):CancellablePromise<R> {
        return CancellablePromise.toCancellable(Promise.resolve(value));
    }

    static reject<R>(reason:any):CancellablePromise<R> {
        return CancellablePromise.toCancellable(Promise.reject(reason));
    }

    private toCancellable<U>(promise:Promise<U>):CancellablePromise<U> {
        return CancellablePromise.toCancellable(promise, this);
    }

    private static toCancellable<U>(promise:Promise<U>, parent?:CancellablePromise<any>):CancellablePromise<U> {
        return new CancellablePromise<U>((resolve, reject) => {
            promise.then(resolve, reject);
        }, parent);
    }

}

function waitForEvent(target:EventTarget, type:string):CancellablePromise<Event> {
    var listener;
    return new CancellablePromise<Event>((resolve, reject) => {
        listener = (event) => resolve(event);
        target.addEventListener(type, listener);
    })
        .finally(() => {
            target.removeEventListener(type, listener);
        });
}

interface Video {
    getCurrentTime() : number;
    setCurrentTime(time:number) : void;

    addEventListener(type:string, handler:() => void) : void;
    removeEventListener(type:string, handler:() => void) : void;

    loadSlides(slidesVttUrl:string) : Promise<TextTrack>;
}

class HTML5Video implements Video {
    private video:HTMLVideoElement;

    private slidesTrackPromise:CancellablePromise<HTMLTrackElement>;

    constructor(video) {
        this.video = video;
    }

    getCurrentTime() {
        return this.video.currentTime;
    }

    setCurrentTime(time) {
        this.video.currentTime = time;
    }

    addEventListener(type, handler) {
        this.video.addEventListener(type, handler, false);
    }

    removeEventListener(type, handler) {
        this.video.removeEventListener(type, handler, false);
    }

    loadSlides(slidesUrl:string):Promise<TextTrack> {
        this.removeSlidesTrack();

        if (!slidesUrl) {
            return Promise.resolve<TextTrack>(null);
        }

        return this.createSlidesTrack(slidesUrl)
            .then((trackElement) => {
                // Wait for load
                return waitForEvent(trackElement, 'load')
                    .then(() => trackElement);
            })
            .then((trackElement) => {
                var track = trackElement.track;
                track.mode = 'hidden';
                return track;
            });
    }


    private waitForMetadata():CancellablePromise<any> {
        if (this.video.readyState > 0) {
            return CancellablePromise.resolve(null);
        } else {
            return waitForEvent(this.video, 'loadedmetadata');
        }
    }

    private createSlidesTrack(slidesUrl:string):CancellablePromise<HTMLTrackElement> {
        if (!slidesUrl) {
            return CancellablePromise.resolve<HTMLTrackElement>(null);
        }

        this.slidesTrackPromise = this.waitForMetadata()
            .then(() => {
                var trackElement = document.createElement('track');
                trackElement.kind = 'metadata';
                trackElement.src = slidesUrl;
                trackElement['default'] = true;
                this.video.appendChild(trackElement);
                return trackElement;
            });

        return this.slidesTrackPromise;
    }

    private removeSlidesTrack() {
        if (this.slidesTrackPromise) {
            this.slidesTrackPromise.cancel().then((trackElement) => {
                this.video.removeChild(trackElement);
            });
        }
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

    export function jumpToSlide(slide:RevealIndices) {
        Reveal.slide(slide.h, slide.v, slide.f);
    }

}

class Synchronizer {

    private video:Video;
    private track:TextTrack;

    private activeCue:TextTrackCue;
    private activeSlide:RevealIndices;

    private slideMap:{ [h: number] : { [v: number] : { [f: number] : TextTrackCue[] } } };

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
        var slideMap = this.slideMap = {};
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
        var slideMap = this.slideMap;
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

    private static getCueSlide(cue:TextTrackCue):RevealIndices {
        return cue && RevealUtils.parseSlide(cue.text);
    }

}

module RevealVideoSync {

    var containerClass:string = 'reveal-video-sync',
        container:HTMLElement,
        videoElement:HTMLVideoElement,
        video:Video;

    function loadVideo(videoUrl) {
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

    export function load(videoUrl:string, slidesVttUrl:string):Promise<Synchronizer> {
        var video = loadVideo(videoUrl);
        return video.loadSlides(slidesVttUrl)
            .then((track) => {
                return new Synchronizer(video, track);
            });
    }

}

export = RevealVideoSync;
