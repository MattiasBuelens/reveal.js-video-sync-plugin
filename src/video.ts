import { Disposable } from './common';

export interface Video extends Disposable {
    getCurrentTime() : number;
    setCurrentTime(time:number) : void;

    getSource() : string;
    setSource(source:string) : void;

    addEventListener(type:string, handler:() => void) : void;
    removeEventListener(type:string, handler:() => void) : void;

    loadSlides(slidesVttUrl:string, callback:(error:Error, track?:TextTrack) => void) : void;
}
