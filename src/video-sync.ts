import { Video } from './video';
import { HTML5Video } from './video-html5';
import { VideoJSVideo } from './video-videojs';
import { Synchronizer } from './synchronizer';
import * as DOMUtils from './dom-utils';

var containerClass:string = 'reveal-video-sync',
    container:HTMLElement,
    videoElement:HTMLVideoElement,
    videoClass:string = 'reveal-video-sync-player';

function createContainer() {
    var reveal:Node;
    if (!container) {
        container = <HTMLElement> document.getElementsByClassName(containerClass)[0];
        if (!container) {
            container = document.createElement('aside');
            container.className = containerClass;
            reveal = document.querySelector('.reveal');
            if (reveal.nextSibling) {
                reveal.parentNode.insertBefore(container, reveal.nextSibling)
            } else {
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

type Callback = (error:Error, synchronizer?:Synchronizer) => void;

function loadSlides(video:Video, slidesVttUrl:string, callback?:Callback) {
    return video.loadSlides(slidesVttUrl, (error, track) => {
        if (error) {
            if (callback) callback(error);
            return;
        }
        var synchronizer = new Synchronizer(video, track);
        if (callback) callback(null, synchronizer);
    });
}

export function element():HTMLVideoElement {
    return createVideoElement();
}

export function html5(videoElement:HTMLVideoElement, slidesVttUrl:string, callback?:Callback):void {
    var container = createContainer(),
        video:Video;
    if (!DOMUtils.isAttached(videoElement)) {
        container.appendChild(videoElement);
    }
    DOMUtils.addClass(videoElement, videoClass);
    video = new HTML5Video(videoElement);
    video.onReady(() => {
        loadSlides(video, slidesVttUrl, callback);
    });
}

export function videojs(player:VideoJSPlayer, slidesVttUrl:string, callback?:Callback):void {
    var video:Video;
    if (!videojs) {
        if (callback) callback(new Error('video.js not loaded'));
        return;
    }
    player.addClass(videoClass);
    player.addClass('video-js');
    video = new VideoJSVideo(player);
    video.onReady(() => {
        loadSlides(video, slidesVttUrl, callback);
    });
}
