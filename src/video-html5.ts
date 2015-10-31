'use strict';

import { Video } from './video';

export class HTML5Video implements Video {
    private video: HTMLVideoElement;

    private videoMetadataListener: EventListener;
    private trackLoadListener: EventListener;
    private trackElement: HTMLTrackElement;

    constructor(video: HTMLVideoElement) {
        this.video = video;
    }

    public getCurrentTime(): number {
        return this.video.currentTime;
    }

    public setCurrentTime(time: number): void {
        this.video.currentTime = time;
    }

    public addEventListener(type: string, handler: () => void): void {
        this.video.addEventListener(type, handler, false);
    }

    public removeEventListener(type: string, handler: () => void): void {
        this.video.removeEventListener(type, handler, false);
    }

    public onReady(handler: () => void): void {
        setTimeout(handler, 0);
    }

    public dispose(): void {
        this.unloadSlides();
        this.video = null;
    }

    public loadSlides(slidesUrl: string, callback: (error: Error, track?: TextTrack) => void): void {
        this.unloadSlides();

        if (!slidesUrl) {
            callback(new Error('missing slides URL'));
            return;
        }

        this.createSlidesTrack(slidesUrl, (error1: Error, trackElement?: HTMLTrackElement) => {
            if (error1) {
                callback(error1);
                return;
            }
            this.waitForTrackLoad((error2: Error) => {
                if (error2) {
                    callback(error2);
                    return;
                }
                let track = trackElement.track;
                track.mode = 'hidden';
                callback(null, track);
            });
        });
    }

    private waitForMetadata(callback: (error: Error) => void): void {
        if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            return callback(null);
        } else {
            let listener = () => {
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

    private waitForTrackLoad(callback: (error: Error) => void): void {
        if (!this.trackElement) {
            return callback(new Error('missing track element'));
        }
        if (this.trackElement.readyState === HTMLTrackElement.LOADED) {
            return callback(null);
        } else {
            let listener = () => {
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

    private createSlidesTrack(slidesUrl: string, callback: (error: Error, trackElement?: HTMLTrackElement) => void): void {
        this.waitForMetadata((error: Error) => {
            if (error) {
                callback(error);
                return;
            }
            let trackElement = document.createElement('track');
            trackElement.kind = 'metadata';
            trackElement.src = slidesUrl;
            trackElement['default'] = true;
            this.video.appendChild(trackElement);
            this.trackElement = trackElement;
            callback(null, trackElement);
        });
    }

    private unloadSlides(): void {
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
