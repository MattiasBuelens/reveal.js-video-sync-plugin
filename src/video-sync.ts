'use strict';

import { Video } from './video';
import { HTML5Video } from './video-html5';
import { VideoJSVideo } from './video-videojs';
import { Synchronizer } from './synchronizer';
import * as DOMUtils from './dom-utils';

let containerClass: string = 'reveal-video-sync',
    container: HTMLElement,
    videoElement: HTMLVideoElement,
    videoClass: string = 'reveal-video-sync-player';

function createContainer(): HTMLElement {
    let reveal: Node;
    if (!container) {
        container = <HTMLElement> document.getElementsByClassName(containerClass)[0];
        if (!container) {
            container = document.createElement('aside');
            container.className = containerClass;
            reveal = document.querySelector('.reveal');
            if (reveal.nextSibling) {
                reveal.parentNode.insertBefore(container, reveal.nextSibling);
            } else {
                reveal.parentNode.appendChild(container);
            }
        }
    }
    return container;
}

function createVideoElement(): HTMLVideoElement {
    createContainer();
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

type Callback = (error: Error, synchronizer?: Synchronizer) => void;

function loadSlides(video: Video, slidesVttUrl: string, callback?: Callback): void {
    return video.loadSlides(slidesVttUrl, (error: Error, track: TextTrack) => {
        if (error) {
            if (callback) {
                callback(error);
            }
            return;
        }
        let synchronizer = new Synchronizer(video, track);
        if (callback) {
            callback(null, synchronizer);
        }
    });
}

export function element(): HTMLVideoElement {
    return createVideoElement();
}

export function html5(element: HTMLVideoElement, slidesVttUrl: string, callback?: Callback): void {
    let video: Video;
    if (!DOMUtils.isAttached(element)) {
        createContainer().appendChild(element);
    }
    DOMUtils.addClass(element, videoClass);
    video = new HTML5Video(element);
    video.onReady(() => {
        loadSlides(video, slidesVttUrl, callback);
    });
}

export function videojs(player: VideoJSPlayer, slidesVttUrl: string, callback?: Callback): void {
    let video: Video;
    if (!videojs) {
        if (callback) {
            callback(new Error('video.js not loaded'));
        }
        return;
    }
    player.addClass(videoClass);
    player.addClass('video-js');
    video = new VideoJSVideo(player);
    video.onReady(() => {
        loadSlides(video, slidesVttUrl, callback);
    });
}
