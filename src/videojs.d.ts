/// <reference path="../typings/videojs/videojs.d.ts" />

interface VideoJSPlayer {
    currentSrc(): string;
    el(): HTMLElement;
    controls(): boolean;
    controls(controls:boolean): void;
}
