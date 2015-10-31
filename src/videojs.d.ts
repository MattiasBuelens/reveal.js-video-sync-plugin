/// <reference path="../typings/videojs/videojs.d.ts" />

interface VideoJSComponent {
    el(): HTMLElement;
    addClass(classToAdd: string): void;
}

interface VideoJSTextTrackOptions {
    kind?: string;
    label?: string;
    language?: string;
    src?: string;
    srclang?: string;
    default?: boolean;
    mode?: string;
}

interface VideoJSRemoteTextTrack {
    track: TextTrack;
}

interface VideoJSPlayer extends VideoJSComponent {
    currentSrc(): string;

    remoteTextTracks(): TextTrackList;
    addTextTrack(kind: string, label?: string, language?: string): TextTrack;
    addRemoteTextTrack(options: VideoJSTextTrackOptions): VideoJSRemoteTextTrack;
    removeRemoteTextTrack(track: TextTrack): void;
}
