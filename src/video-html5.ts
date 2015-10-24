import { Video } from './video';

export class HTML5Video implements Video {
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
