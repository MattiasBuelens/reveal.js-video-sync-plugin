var gulp = require('gulp');
var path = require('path');
var assign = require('lodash.assign');

var browserify = require('browserify');
var watchify = require('watchify');
var tsify = require('tsify');
var tslint = require('gulp-tslint');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');

var sass = require('gulp-sass');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
var csswring = require('csswring');

var browserSync = require('browser-sync').create();

var del = require('del');
var header = require('gulp-header');
var rename = require('gulp-rename');
var gutil = require('gulp-util');
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

// Banner
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

// Main entry point
var entry = 'video-sync',
    tsEntry = paths.src + entry + '.ts',
    jsEntry = entry + '.js';

// Browserify
var bOptions = assign({}, watchify.args, {
    entries: [tsEntry],
    standalone: 'RevealVideoSync',
    debug: true
});
var b = browserify(bOptions);
b.plugin(tsify, require('./tsconfig.json'));
b.on('log', gutil.log);

function relativePath(from, to) {
    return path.relative(from, to).split(path.sep).join('/');
}

function js() {
    return b
        .bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify error'))
        .pipe(source(jsEntry, paths.src))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(header(banner, {pkg: pkg}));
}

const jsDev = gulp.series([tslintDev, function jsDev() {
    var bundle = function () {
        return js()
            .pipe(sourcemaps.write({
                sourceRoot: relativePath(paths.dist, '.')
            }))
            .pipe(gulp.dest(paths.dist))
            .pipe(browserSync.stream({match: ['**/*.js']}));
    };
    b.on('update', bundle);
    return bundle();
}]);

const jsProd = gulp.series([tslintProd, function jsProd() {
    var bundle = function () {
        return js()
            .pipe(uglify())
            .pipe(rename({suffix: '.min'}))
            .pipe(sourcemaps.write('.', {
                sourceRoot: relativePath(paths.dist, '.')
            }))
            .pipe(gulp.dest(paths.dist));
    };
    b.on('update', bundle);
    return bundle();
}]);

function lint(files, formatter) {
    return gulp.src(files || paths.ts)
        .pipe(tslint({
            configuration: './tslint.json',
            formatter
        }));
}

function tslintDev() {
    var doLint = function (files) {
        return lint(files, 'verbose')
            .pipe(tslint.report({emitError: false}));
    };
    b.on('update', doLint);
    return doLint();
}

function tslintProd() {
    var doLint = function (files) {
        return lint(files, undefined)
            .pipe(tslint.report({emitError: true}));
    };
    b.on('update', doLint);
    return doLint();
}

function css() {
    return gulp.src(paths.scss)
        .pipe(sourcemaps.init())
        .pipe(sass())
        .pipe(postcss([
            autoprefixer
        ]))
        .pipe(header(banner, {pkg: pkg}));
}

function cssDev() {
    return css()
        .pipe(sourcemaps.write({
            sourceRoot: relativePath(paths.dist, paths.src)
        }))
        .pipe(gulp.dest(paths.dist))
        .pipe(browserSync.stream({match: ['**/*.css']}));
}

function cssProd() {
    return css()
        .pipe(postcss([
            csswring
        ]))
        .pipe(rename({suffix: '.min'}))
        .pipe(sourcemaps.write('.', {
            sourceRoot: relativePath(paths.dist, paths.src)
        }))
        .pipe(gulp.dest(paths.dist))
        .pipe(browserSync.stream({match: ['**/*.css']}));
}

function watch() {
    b = watchify(b);
}

const watchDev = gulp.series([watch, function watchDev() {
    gulp.watch(paths.scss, cssDev);
}]);

const watchProd = gulp.series([watch, function watchProd() {
    gulp.watch(paths.scss, cssProd);
}]);

function browsersync() {
    browserSync.init({
        open: false,
        server: {
            baseDir: '.'
        }
    });
    gulp.watch(['*.html'], browserSync.reload);
}

function clean() {
    return del([
        paths.dist
    ]);
}

const buildDev = gulp.parallel([jsDev, cssDev]);
const buildProd = gulp.parallel([jsProd, cssProd]);
const build = gulp.series([buildProd]);

const serveDev = gulp.parallel([watchDev, buildDev, browsersync]);
const serveProd = gulp.parallel([watchProd, buildProd, browsersync]);
const serve = gulp.series([serveDev]);

module.exports = {
    buildDev,
    buildProd,
    build,
    serveDev,
    serveProd,
    serve,
    tslintDev,
    tslintProd,
    clean,
    default: build
};
