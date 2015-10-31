'use strict';

import { Disposable } from './common';
import { Video } from './video';
import * as RevealUtils from './reveal-utils';

type RevealIndices = RevealUtils.Indices;
type SlideMap = { [h: number] : { [v: number] : { [f: number] : TextTrackCue[] } } };

export class Synchronizer implements Disposable {

    private video: Video;
    private track: TextTrack;

    private activeCue: TextTrackCue;
    private activeSlide: RevealIndices;

    private slideMap: SlideMap;

    private cueChangeListener: () => void = () => this.onCueChange();
    private slideChangeListener: () => void = () => this.onSlideChange();

    constructor(video: Video, track: TextTrack) {
        this.video = video;
        this.track = track;
        this.initialize();
    }

    private static getCueSlide(cue: TextTrackCue): RevealIndices {
        return cue && RevealUtils.parseSlide(cue.text);
    }

    public dispose(): void {
        this.activeSlide = null;
        this.activeCue = null;
        this.slideMap = null;

        // Unbind listeners
        this.track.removeEventListener('cuechange', this.cueChangeListener);
        this.video.removeEventListener('timeupdate', this.cueChangeListener);
        Reveal.removeEventListener('slidechanged', this.slideChangeListener);
        Reveal.removeEventListener('fragmentshown', this.slideChangeListener);
        Reveal.removeEventListener('fragmenthidden', this.slideChangeListener);

        this.video.dispose();
        this.video = null;
    }

    private initialize(): void {
        this.activeSlide = null;
        this.activeCue = null;
        this.loadSlideMap();

        // Seek to initial slide
        this.onSlideChange();

        // Bind listeners
        if ('oncuechange' in this.track) {
            this.track.addEventListener('cuechange', this.cueChangeListener);
        } else {
            // Polyfill missing support for cuechange event with timeupdate
            this.video.addEventListener('timeupdate', this.cueChangeListener);
        }
        Reveal.addEventListener('slidechanged', this.slideChangeListener);
        Reveal.addEventListener('fragmentshown', this.slideChangeListener);
        Reveal.addEventListener('fragmenthidden', this.slideChangeListener);
    }

    private onCueChange(): void {
        // Update active cue
        let newActiveCue = this.track.activeCues.length ? this.track.activeCues[0] : null;
        if (newActiveCue === this.activeCue) {
            return;
        }
        this.activeCue = newActiveCue;
        // Update active slide
        let newActiveSlide = Synchronizer.getCueSlide(this.activeCue);
        if (!newActiveSlide || RevealUtils.slidesEqual(newActiveSlide, this.activeSlide)) {
            return;
        }
        this.activeSlide = newActiveSlide;
        // Jump to slide
        RevealUtils.jumpToSlide(this.activeSlide);
    }

    private onSlideChange(): void {
        let slide = RevealUtils.normalizeSlide(Reveal.getIndices());
        if (RevealUtils.slidesEqual(slide, this.activeSlide)) {
            // Already active slide
            return;
        }
        // Find cue closest in time with this slide
        let cue = this.findClosestSlideCue(slide, this.video.getCurrentTime());
        if (!cue) {
            return;
        }
        // Seek to start of closest cue
        this.video.setCurrentTime(cue.startTime + 0.001); // avoid overlap with previous
    }

    private loadSlideMap(): void {
        let slideMap: SlideMap = this.slideMap = {},
            cues = <TextTrackCue[]><any>this.track.cues;
        for (let cue of cues) {
            let slide = Synchronizer.getCueSlide(cue);
            if (slide) {
                let h = slideMap[slide.h] || (slideMap[slide.h] = {}),
                    v = h[slide.v] || (h[slide.v] = {}),
                    f = v[slide.f] || (v[slide.f] = []);
                f.push(cue);
            }
        }
    }

    private findClosestSlideCue(slide: RevealIndices, time: number): TextTrackCue {
        let slideMap: SlideMap = this.slideMap;
        if (!slideMap) {
            // Not loaded
            return null;
        }
        let h = slideMap[slide.h],
            v = h && h[slide.v],
            f = v && v[slide.f];
        if (!f) {
            // Not found
            return null;
        }
        let closestCue: TextTrackCue,
            closestDistance = Infinity;
        for (let cue of f) {
            let distance = Math.min(Math.abs(cue.startTime - time), Math.abs(cue.endTime - time));
            if (cue.startTime <= time && time < cue.endTime) {
                // Time inside cue interval
                return cue;
            } else if (distance < closestDistance) {
                closestCue = cue;
                closestDistance = distance;
            }
        }
        return closestCue;
    }

}
