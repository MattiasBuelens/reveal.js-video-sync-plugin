interface Promise<R> {

    then<U>(onFulfilled:(value:R) => U|Promise<U>, onRejected?:(error:any) => U|Promise<U>):Promise<U>;

}

interface PromiseStatic {

    new<R>(callback:(resolve:(value:R|Promise<R>) => void, reject:(error:any) => void) => void) : Promise<R>;

}

declare module 'promise/lib/core' {

    export = PromiseStatic;

}
