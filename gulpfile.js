var gulp = require('gulp');
var traceur = require('gulp-traceur');
var autoprefixer = require('gulp-autoprefixer'),
	jshint = require('gulp-jshint'),
	uglify = require('gulp-uglify'),
	rename = require('gulp-rename'),
	clean = require('gulp-clean'),
	concat = require('gulp-concat'),
	notify = require('gulp-notify'),
	cache = require('gulp-cache'),
	livereload = require('gulp-livereload');

//everyday task
gulp.task('dev', function () {
	gulp.src('src/*.js')
		.pipe(concat())
		.pipe(traceur())
		.pipe(gulp.dest('.'));
});

//deployment task
gulp.task('default', function () {
	gulp.start('dev')

	gulp.src('src/*.js')
		.pipe(concat())
		.pipe(traceur())
		.pipe(gulp.dest('.'));

		//min version
		.pipe(rename({suffix:'.min'}));
		.pipe(closure({}));
});