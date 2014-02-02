var gulp = require('gulp');
var traceur = require('gulp-traceur');
var watch = require('gulp-watch');
var exec = require('gulp-exec');
var gutil = require('gulp-util');
var autoprefixer = require('gulp-autoprefixer'),
	jshint = require('gulp-jshint'),
	uglify = require('gulp-uglify'),
	rename = require('gulp-rename'),
	clean = require('gulp-clean'),
	concat = require('gulp-concat'),
	notify = require('gulp-notify'),
	cache = require('gulp-cache'),
	livereload = require('gulp-livereload');

global.path = require('path');

//var exec = require('child_process').exec


var path = {
	all: 'src/*.js',
	src: ['src/util.js',
			'src/Component.js',
			'src/Area.js',
			'src/Picker.js'
	],
	dest: 'dist/',
	dev: 'dev/slidy.js'
};


//dev task, launches traceur
//very harsh and difficult to maintain
gulp.task('dev', function () {
	//console.log('traceur --out ' + path.dev + ' ' + path.src.join(' ') + ' --sourcemap')
	gulp.src(path.all)
		//.pipe(concat('slidy.js'))
		//.pipe(traceur({
		//	sourceMap: true
		//}))

		//wrong multifile pipe
		.pipe(exec('traceur --out <%= options.dest %> <%= options.src %> --sourcemap',
			{
				src: path.src.join(' '),
				dest: path.dev
			}))
		.on('error', gutil.beep);

		//.pipe(gulp.dest('dist'));

		//TODO: `*.js` doesn’t work
		/*exec('traceur --sourcemap --out ' + path.dest + ' \"src/*.js\"',
			function (error, stdout, stderr) {
				console.log('stdout: ' + stdout);
				console.log('stderr: ' + stderr);
				if (error !== null) {
					console.log('exec error: ' + error);
				}
			}
		);*/
});

//minify task
gulp.task('min', function(){
	//gulp.src('.')
	//.pipe(rename({suffix:'.min'}));
	//.pipe(closure({}));
});

//development task

gulp.task('watch', function () {
	gulp.watch(['gulpfile.js', path.src], function(){
		var c = 0;
		runDev();

		function runDev(){
			gulp.run('dev');
			/*c++;
			if (c < 4){
				setTimeout(runDev, 2000)
			} else {
				gutil.beep();
				gutil.beep();
				gutil.beep();
				gutil.beep();
				c = 0;
			}*/
		}
	})
});



gulp.task('default', ['dev', 'watch']);