/* globals Reveal */

/// <reference path="../typings/reveal/reveal.d.ts" />

'use strict';

export interface Indices {
    h: number;
    v: number;
    f?: number;
}

export function normalizeSlide(indices: Indices): Indices {
    indices.h = indices.h || 0;
    indices.v = indices.v || 0;
    indices.f = (typeof indices.f === 'number' && !isNaN(indices.f)) ? indices.f : -1;
    return indices;
}

export function slidesEqual(left: Indices, right: Indices): boolean {
    if (!left || !right) {
        return !left && !right;
    }
    return left.h === right.h && left.v === right.v && left.f === right.f;
}

export function parseSlide(hash: string): Indices {
    // Attempt to parse the hash as either an index or name
    let bits = hash.split('/'),
        h: number, v: number, f: number;
    if (isNaN(parseInt(bits[0], 10))) {
        // Named slide
        let name = bits[0],
            element: HTMLElement;
        // Ensure the named link is a valid HTML ID attribute
        if (/^[a-zA-Z][\w:.-]*$/.test(name)) {
            // Find the slide with the specified ID
            element = document.getElementById(name);
        }
        if (!element) {
            // Unknown slide
            return null;
        }
        // Find the position of the named slide
        let indices = Reveal.getIndices(element);
        h = indices.h;
        v = indices.v;
        f = parseInt(bits[1], 10);
    } else {
        // Index components
        h = parseInt(bits[0], 10);
        v = parseInt(bits[1], 10);
        f = parseInt(bits[2], 10);
    }

    return normalizeSlide({h: h, v: v, f: f});
}

export function jumpToSlide(slide: Indices): void {
    Reveal.slide(slide.h, slide.v, slide.f);
}
