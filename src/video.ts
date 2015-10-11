interface Video extends EventTarget {
    currentTime : number;
    addEventListener(type:'timeupdate', listener:EventListener, useCapture?:boolean):void;
    removeEventListener(type:'timeupdate', listener:EventListener, useCapture?:boolean):void;
}

interface Track {

}

interface TrackVideo {

}