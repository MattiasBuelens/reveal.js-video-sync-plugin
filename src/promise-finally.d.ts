/// <reference path="./promise-core.d.ts" />

interface Promise<R> {

    finally<U>(handler:() => U|Promise<U>):Promise<R>;

}

declare module 'promise/lib/finally' {

    import 'promise/lib/core';

    export = PromiseStatic;

}
