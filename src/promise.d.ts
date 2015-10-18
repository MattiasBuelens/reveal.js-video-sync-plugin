/// <reference path="./promise-core.d.ts" />
/// <reference path="./promise-done.d.ts" />
/// <reference path="./promise-finally.d.ts" />
/// <reference path="./promise-es6-extensions.d.ts" />
/// <reference path="./promise-node-extensions.d.ts" />

declare module 'promise' {

    import 'promise/lib/core';
    import 'promise/lib/done';
    import 'promise/lib/finally';
    import 'promise/lib/es6-extensions';
    import 'promise/lib/node-extensions';

    export = PromiseStatic;

}
