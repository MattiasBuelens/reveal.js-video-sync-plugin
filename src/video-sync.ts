import { Video } from './video';
import { HTML5Video } from './video-html5';
import { VideoJSVideo } from './video-videojs';
import { Synchronizer } from './synchronizer';

var containerClass:string = 'reveal-video-sync',
    container:HTMLElement,
    videoElement:HTMLVideoElement,
    video:Video;

function createContainer() {
    if (!container) {
        container = <HTMLElement> document.getElementsByClassName(containerClass)[0];
        if (!container) {
            container = document.createElement('aside');
            container.className = containerClass;
            document.querySelector('.reveal').appendChild(container);
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

function isAttached(node:Node) {
    while (node && node !== document) {
        node = node.parentNode;
    }
    return (node === document);
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

export function loadHTML5(slidesVttUrl:string, source?:string, videoElement?:HTMLVideoElement, callback?:Callback):void {
    var container = createContainer(),
        video:Video;
    if (!videoElement) {
        videoElement = createVideoElement();
    }
    if (!isAttached(videoElement)) {
        container.appendChild(videoElement);
    }
    videoElement.className += " reveal-video-sync-player";
    video = new HTML5Video(videoElement);
    if (source) {
        video.setSource(source);
    }
    loadSlides(video, slidesVttUrl, callback);
}

export function loadVideoJS(slidesVttUrl:string, source?:string, player?:VideoJSPlayer, callback?:Callback):void {
    var container = createContainer(),
        video:Video;
    if (!videojs) {
        if (callback) callback(new Error('video.js not loaded'));
        return;
    }
    if (!player) {
        var videoElement = createVideoElement();
        videoElement.className += " video-js reveal-video-sync-player";
        player = videojs(videoElement);
    }
    if (!isAttached(player.el())) {
        container.appendChild(player.el());
    }
    player.ready(() => {
        player.controls(true);

        var video:Video = new VideoJSVideo(player);
        if (source) {
            video.setSource(source);
        }
        loadSlides(video, slidesVttUrl, callback);
    })
}
