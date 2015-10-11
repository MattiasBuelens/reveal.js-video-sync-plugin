interface TextDecodeOptions {
    stream?: boolean;
}

interface TextDecoder<T> {
    decode(buffer?:T, options?:TextDecodeOptions):string;
}

type DirectionSetting = "" | "rl" | "lr";
type LineAlignSetting = "start" | "middle" | "end";
type PositionAlignSetting = "start" | "middle" | "end" | "auto";
type AlignSetting = "start" | "middle" | "end" | "left" | "right";

declare class VTTCue extends TextTrackCue {
    constructor(startTime:number, endTime:number, text:string);

    region:VTTRegion;
    vertical:DirectionSetting;
    snapToLines:boolean;
    line:number | 'auto';
    lineAlign:LineAlignSetting;
    position:number | 'auto';
    positionAlign:PositionAlignSetting;
    size:number;
    align:AlignSetting;
    text:string;

    getCueAsHTML():DocumentFragment;
}

declare module 'vtt.js' {

    module WebVTT {

        function convertCueToDOMTree(window:Window, cuetext:string):HTMLElement;

        function processCues(window:Window, cues:VTTCue[], overlay:HTMLElement):void;

        class Parser<T> {
            constructor(window:Window, decoder:TextDecoder<T>);

            onregion:(VTTRegion) => void;
            oncue:(VTTCue) => void;
            onparsingerror:(ParsingError) => void;

            parse(data:T):Parser<T>;

            flush():Parser<T>;
        }

        interface ParsingError extends Error {
            code: number;
        }

        class StringDecoder implements TextDecoder<string> {
            constructor();

            decode(buffer?:string):string;
        }

    }

    declare var VTTCue = VTTCue;

}
