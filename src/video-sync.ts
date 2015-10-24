import { Video } from './video';
import { HTML5Video } from './video-html5';
import { Synchronizer } from './synchronizer';

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
