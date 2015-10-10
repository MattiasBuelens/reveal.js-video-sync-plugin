var gulp = require('gulp');
var path = require('path');

var browserify = require('browserify');
var tsify = require('tsify');
var hintify = require('hintify');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');

var sass = require('gulp-sass');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
var csswring = require('csswring');

var del = require('del');
var header = require('gulp-header');
var rename = require('gulp-rename');
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');

var paths = {
    src: './src/',
    dist: './dist/',
    ts: './src/**.ts',
    js: ['./dist/**.js', '!./dist/**.min.js'],
    scss: './src/**.scss',
    css: ['./dist/**.css', '!./dist/**.min.css']
};

var pkg = require('./package.json');
var banner = (
    '/*!\n' +
    ' * reveal.js video sync <%= pkg.version %>\n' +
    ' *\n' +
    ' * <%= pkg.description %>\n' +
    ' * <%= pkg.homepage %>\n' +
    ' * License: <%= pkg.license %>\n' +
    ' *\n' +
    ' * Copyright (C) <%= pkg.author.name %> (<%= pkg.author.web %>)\n' +
    ' */\n\n'
);

var entry = 'video-sync',
    tsEntry = paths.src + entry + '.ts',
    jsEntry = entry + '.js';

gulp.task('clean', function () {
    return del([
        paths.dist,
        paths.src + '**.js',
        paths.src + '**.js.map',
        paths.src + '**.d.ts'
    ]);
});

gulp.task('js', function () {
    var bundler = browserify(tsEntry, {
        standalone: 'RevealVideoSync',
        debug: true
    }).plugin(tsify, {
        target: 'es5',
        sourceMap: true
    }).transform(hintify);

    return bundler
        .bundle(function (err) {
            if (err) {
                console.error(err.toString());
            }
        })
        .pipe(source(jsEntry, paths.src))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(header(banner, {pkg: pkg}))
        .pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: path.relative(paths.dist, '.')}))
        .pipe(gulp.dest(paths.dist));
});

gulp.task('js-min', ['js'], function () {
    return gulp.src(paths.js)
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(rename({suffix: '.min'}))
        .pipe(uglify())
        .pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: '.'}))
        .pipe(gulp.dest(paths.dist));
});

gulp.task('css', function () {
    return gulp.src(paths.scss)
        .pipe(sourcemaps.init())
        .pipe(sass())
        .pipe(postcss([
            autoprefixer
        ]))
        .pipe(header(banner, {pkg: pkg}))
        .pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: path.relative(paths.dist, paths.src)}))
        .pipe(gulp.dest(paths.dist));
});

gulp.task('css-min', ['css'], function () {
    return gulp.src(paths.css)
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(rename({suffix: '.min'}))
        .pipe(postcss([
            csswring
        ]))
        .pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: '.'}))
        .pipe(gulp.dest(paths.dist));
});

gulp.task('default', ['js-min', 'css-min']);
