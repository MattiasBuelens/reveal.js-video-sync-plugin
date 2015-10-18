/// <reference path="./promise-core.d.ts" />

interface Promise<R> {

    done<U>(onFulfilled:(value:R) => U|Promise<U>, onRejected?:(error:any) => U|Promise<U>):Promise<U>;

}

declare module 'promise/lib/done' {

    import 'promise/lib/core';

    export = PromiseStatic;

}
