/* globals videojs */

/// <reference path="./videojs.d.ts" />

import { Video } from './video';

export class VideoJSVideo implements Video {
    private player:VideoJSPlayer;

    private slidesTrack:TextTrack;
    private cueLoadTimer:number;
    private static cueLoadTimeout = 100;

    constructor(player:VideoJSPlayer) {
        this.player = player;
    }

    getCurrentTime() {
        return this.player.currentTime();
    }

    setCurrentTime(time:number) {
        this.player.currentTime(time);
    }

    getSource() {
        return this.player.currentSrc();
    }

    setSource(source:string) {
        this.player.src(source);
    }

    addEventListener(type:string, handler:() => void) {
        this.player.on(type, handler);
    }

    removeEventListener(type:string, handler:() => void) {
        this.player.off(type, handler);
    }

    onReady(handler:() => void) {
        this.player.ready(handler);
    }

    waitForTrackLoad(callback:() => void) {
        // VideoJS does not provide a 'load' event for text tracks
        // so just poll the cues list until it has a stable number of cues
        var self = this,
            lastCueLength = 0,
            checkCueLoad = () => {
                clearTimeout(self.cueLoadTimer);
                var newCueLength = self.slidesTrack.cues && self.slidesTrack.cues.length;
                if (newCueLength > 0 && lastCueLength === newCueLength) {
                    callback();
                } else {
                    lastCueLength = newCueLength;
                    this.cueLoadTimer = setTimeout(checkCueLoad, VideoJSVideo.cueLoadTimeout);
                }
            };
        checkCueLoad();
    }

    loadSlides(slidesUrl:string, callback:(error:Error, track?:TextTrack) => void) {
        this.unloadSlides();

        if (!slidesUrl) {
            callback(new Error('missing slides URL'));
            return;
        }

        this.slidesTrack = this.player.addRemoteTextTrack({
            kind: 'metadata',
            mode: 'showing',
            'default': true,
            src: slidesUrl
        }).track;

        this.waitForTrackLoad(() => {
            callback(null, this.slidesTrack);
        });
    }

    dispose() {
        this.unloadSlides();
        this.player = null;
    }

    private unloadSlides() {
        clearTimeout(this.cueLoadTimer);
        if (this.slidesTrack) {
            this.player.removeRemoteTextTrack(this.slidesTrack);
            this.slidesTrack = null;
        }
    }

}
