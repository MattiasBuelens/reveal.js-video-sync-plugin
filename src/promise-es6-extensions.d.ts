/// <reference path="./promise-core.d.ts" />

interface Promise<R> {

    catch<U>(onRejected?:(error:any) => U|Promise<U>):Promise<U>;

}

interface PromiseStatic {

    resolve<R>(value:R|Promise<R>):Promise<R>;

    reject<R>(reason:any):Promise<R>;

    all<R>(values:(R|Promise<R>)[]):Promise<R[]>;

    race<R>(values:(R|Promise<R>)[]):Promise<R>;

}

declare module 'promise/lib/es6-extensions' {

    import 'promise/lib/core';

    export = PromiseStatic;

}
