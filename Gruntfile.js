/* global module:false */
module.exports = function(grunt) {
	var port = grunt.option('port') || 8000;
	var base = grunt.option('base') || '.';

	// Project configuration
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		meta: {
			banner:
				'/*!\n' +
				' * reveal.js video sync <%= pkg.version %> (<%= grunt.template.today("yyyy-mm-dd, HH:MM") %>)\n' +
				' *\n' +
				' * Synchronize video playback with reveal.js slide changes.\n' +
				' * https://github.com/MattiasBuelens/reveal.js-video-sync-plugin\n' +
				' * MIT licensed\n' +
				' *\n' +
				' * Copyright (C) Mattias Buelens (http://github.com/MattiasBuelens)\n' +
				' */'
		},

		uglify: {
			options: {
				banner: '<%= meta.banner %>\n'
			},
			build: {
				src: 'video-sync.js',
				dest: 'dist/video-sync.min.js'
			}
		},

		sass: {
			dist: {
				files: {
					'dist/video-sync.css': 'video-sync.scss'
				}
			}
		},

		autoprefixer: {
			dist: {
				src: 'dist/video-sync.css'
			}
		},

		cssmin: {
			compress: {
				files: {
					'dist/video-sync.min.css': [ 'dist/video-sync.css' ]
				}
			}
		},

		jshint: {
			options: {
				curly: false,
				eqeqeq: true,
				immed: true,
				latedef: true,
				newcap: true,
				noarg: true,
				sub: true,
				undef: true,
				eqnull: true,
				browser: true,
				expr: true,
				globals: {
					head: false,
					module: false,
					console: false,
					unescape: false,
					define: false,
					exports: false
				}
			},
			files: [ 'Gruntfile.js', 'video-sync.js' ]
		},

		connect: {
			server: {
				options: {
					port: port,
					base: base,
					livereload: true,
					open: true
				}
			}
		},

		watch: {
			options: {
				livereload: true
			},
			js: {
				files: [ 'Gruntfile.js', 'video-sync.js' ],
				tasks: 'js'
			},
			css: {
				files: [ 'video-sync.scss' ],
				tasks: 'css'
			},
			html: {
				files: [ 'index.html' ]
			}
		}

	});

	// Dependencies
	grunt.loadNpmTasks( 'grunt-contrib-jshint' );
	grunt.loadNpmTasks( 'grunt-contrib-cssmin' );
	grunt.loadNpmTasks( 'grunt-contrib-uglify' );
	grunt.loadNpmTasks( 'grunt-contrib-watch' );
	grunt.loadNpmTasks( 'grunt-sass' );
	grunt.loadNpmTasks( 'grunt-contrib-connect' );
	grunt.loadNpmTasks( 'grunt-autoprefixer' );

	// Default task
	grunt.registerTask( 'default', [ 'css', 'js' ] );

	// JS
	grunt.registerTask( 'js', [ 'jshint', 'uglify' ] );

	// CSS
	grunt.registerTask( 'css', [ 'sass', 'autoprefixer', 'cssmin' ] );

	// Serve demo presentation locally
	grunt.registerTask( 'serve', [ 'connect', 'watch' ] );

};
