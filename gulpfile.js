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

gulp.task('js:dev', ['tslint:dev'], function () {
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
});

gulp.task('js:prod', ['tslint:prod'], function () {
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
});

function lint(files) {
    return gulp.src(files || paths.ts)
        .pipe(tslint({
            configuration: require('./tslint.json')
        }));
}

gulp.task('tslint:dev', function () {
    var doLint = function (files) {
        return lint(files)
            .pipe(tslint.report('verbose', { emitError: false }));
    };
    b.on('update', doLint);
    return doLint();
});

gulp.task('tslint:prod', function () {
    var doLint = function (files) {
        return lint(files)
            .pipe(tslint.report(null, { emitError: true }));
    };
    b.on('update', doLint);
    return doLint();
});

function css() {
    return gulp.src(paths.scss)
        .pipe(sourcemaps.init())
        .pipe(sass())
        .pipe(postcss([
            autoprefixer
        ]))
        .pipe(header(banner, {pkg: pkg}));
}

gulp.task('css:dev', function () {
    return css()
        .pipe(sourcemaps.write({
            sourceRoot: relativePath(paths.dist, paths.src)
        }))
        .pipe(gulp.dest(paths.dist))
        .pipe(browserSync.stream({match: ['**/*.css']}));
});

gulp.task('css:prod', function () {
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
});

gulp.task('watch', function () {
    b = watchify(b);
});

gulp.task('watch:dev', ['watch'], function () {
    gulp.watch(paths.scss, ['css:dev']);
});

gulp.task('watch:prod', ['watch'], function () {
    gulp.watch(paths.scss, ['css:prod']);
});

gulp.task('browsersync', function () {
    browserSync.init({
        open: false,
        server: {
            baseDir: '.'
        }
    });
    gulp.watch(['*.html'], browserSync.reload);
});

gulp.task('clean', function () {
    return del([
        paths.dist
    ]);
});

gulp.task('default', ['build']);
gulp.task('build', ['build:prod']);
gulp.task('serve', ['serve:dev']);

gulp.task('build:dev', ['js:dev', 'css:dev']);
gulp.task('build:prod', ['js:prod', 'css:prod']);

gulp.task('serve:dev', ['watch:dev', 'build:dev', 'browsersync']);
gulp.task('serve:prod', ['watch:prod', 'build:prod', 'browsersync']);
