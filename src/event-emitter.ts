export default class EventEmitter implements EventTarget {

    private listeners:{ [type: string] : EventListener[] };

    constructor() {
        this.listeners = {};
    }

    private getListeners(type:string) {
        return this.listeners[type] || (this.listeners[type] = []);
    }

    addEventListener(type:string, listener:EventListener, useCapture?:boolean) {
        var listeners = this.listeners[type] || (this.listeners[type] = []);
        listeners.push(listener);
    }

    removeEventListener(type:string, listener:EventListener, useCapture?:boolean) {
        var listeners = this.listeners[type];
        if (listeners) {
            for (var i = 0; i < listeners.length; i++) {
                if (listeners[i] === listener) {
                    listeners.splice(i, 1);
                    break;
                }
            }
            if (listeners.length === 0) {
                this.listeners[type] = null;
            }
        }
    }

    dispatchEvent(evt:Event) {
        if (!evt.target) {
            evt.target = this;
        }
        var listeners = this.listeners[evt.type];
        if (listeners) {
            for (var i = 0; i < listeners.length; i++) {
                listeners[i].call(this, evt);
            }
        }
        return !evt.defaultPrevented;
    }

}
