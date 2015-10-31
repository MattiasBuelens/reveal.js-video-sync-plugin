/* globals videojs */

/// <reference path="./videojs.d.ts" />

'use strict';

import { Video } from './video';

export class VideoJSVideo implements Video {
    private static cueLoadTimeout: number = 100;

    private player: VideoJSPlayer;

    private slidesTrack: TextTrack;
    private cueLoadTimer: number;

    constructor(player: VideoJSPlayer) {
        this.player = player;
    }

    public getCurrentTime(): number {
        return this.player.currentTime();
    }

    public setCurrentTime(time: number): void {
        this.player.currentTime(time);
    }

    public addEventListener(type: string, handler: () => void): void {
        this.player.on(type, handler);
    }

    public removeEventListener(type: string, handler: () => void): void {
        this.player.off(type, handler);
    }

    public onReady(handler: () => void): void {
        this.player.ready(handler);
    }

    public dispose(): void {
        this.unloadSlides();
        this.player = null;
    }

    public loadSlides(slidesUrl: string, callback: (error: Error, track?: TextTrack) => void): void {
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

    private waitForTrackLoad(callback: () => void): void {
        // VideoJS does not provide a 'load' event for text tracks
        // so just poll the cues list until it has a stable number of cues
        let self = this,
            lastCueLength = 0,
            checkCueLoad = () => {
                clearTimeout(self.cueLoadTimer);
                let newCueLength = self.slidesTrack.cues && self.slidesTrack.cues.length;
                if (newCueLength > 0 && lastCueLength === newCueLength) {
                    callback();
                } else {
                    lastCueLength = newCueLength;
                    this.cueLoadTimer = setTimeout(checkCueLoad, VideoJSVideo.cueLoadTimeout);
                }
            };
        checkCueLoad();
    }

    private unloadSlides(): void {
        clearTimeout(this.cueLoadTimer);
        if (this.slidesTrack) {
            this.player.removeRemoteTextTrack(this.slidesTrack);
            this.slidesTrack = null;
        }
    }

}
