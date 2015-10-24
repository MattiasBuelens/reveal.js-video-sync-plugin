/* globals videojs */

/// <reference path="./videojs.d.ts" />

import { Video } from './video';

export class VideoJSVideo implements Video {
    private player:VideoJSPlayer;

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

    loadSlides(slidesUrl:string, callback:(error:Error, track?:TextTrack) => void) {
        this.unloadSlides();

        if (!slidesUrl) {
            callback(new Error('missing slides URL'));
            return;
        }
    }

    dispose() {
        this.unloadSlides();
        this.player = null;
    }

    private unloadSlides() {

    }

}
