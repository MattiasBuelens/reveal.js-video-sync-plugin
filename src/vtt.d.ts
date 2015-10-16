interface TextDecodeOptions {
    stream?: boolean;
}

interface TextDecoderOf<T> {
    decode(input?:T, options?:TextDecodeOptions): string;
}

interface TextDecoder extends TextDecoderOf<ArrayBufferView> {
    decode(input?:ArrayBufferView, options?:TextDecodeOptions): string;
}

declare module 'vtt.js' {

    export class VTTCue {
        constructor(startTime:number, endTime:number, text:string);

        region:VTTRegion;
        vertical:string;
        snapToLines:boolean;
        line:number|string;
        lineAlign:string;
        position:number|string;
        positionAlign:string;
        size:number;
        align:string;
        text:string;

        getCueAsHTML():DocumentFragment;

        toJSON():{[key:string]:any};

        static create(options:{[key:string]:any}):VTTCue;

        static fromJSON(json:string):VTTCue;
    }

    export class VTTRegion {
        constructor();

        width:number;
        lines:number;
        regionAnchorX:number;
        regionAnchorY:number;
        viewportAnchorX:number;
        viewportAnchorY:number;
        scroll:string;

        static create(options:{[key:string]:any}):VTTCue;

        static fromJSON(json:string):VTTCue;
    }

    export module WebVTT {

        function convertCueToDOMTree(window:Window, cuetext:string):HTMLElement;

        function processCues(window:Window, cues:VTTCue[], overlay:HTMLElement):void;

        class Parser<T> {
            constructor(window:Window, decoder:TextDecoderOf<T>);

            onregion:(VTTRegion) => void;
            oncue:(VTTCue) => void;
            onparsingerror:(ParsingError) => void;

            parse(data:T):Parser<T>;

            flush():Parser<T>;
        }

        const enum ParsingErrorCode {
            BadSignature = 0,
            BadTimeStamp = 1
        }

        interface ParsingError extends Error {
            code: ParsingErrorCode;
        }

        class StringDecoder implements TextDecoderOf<string> {
            constructor();

            decode(input?:string, options?:TextDecodeOptions):string;
        }

    }

}
