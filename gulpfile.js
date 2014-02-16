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
var es6transpiler = require('gulp-es6-transpiler');
var closureCompiler = require('gulp-closure-compiler');
var typescript = require('gulp-typescript');

global.path = require('path');

//var exec = require('child_process').exec


var path = {
	all: 'src/*.js',
	src: [	'src/util.js',
			'src/Component.js',
			'src/Draggable.js',
			'src/Slidy.js',
			//'src/Area.js',
			//'src/Picker.js'
	],
	dest: 'dist',
	destFile: 'dist/slidy.js'
};



//dev task, launches traceur
//very harsh and difficult to maintain
gulp.task('dev', function () {
	gulp.src(path.src)
		//.pipe(concat('slidy.js'))
		/*.pipe(uglify({
			mangle: false,
			preserceComments: true,
			compress: false,
			outSourceMap: true
		}))*/
		//.pipe(traceur({
		//	sourceMap: true
		//}))
		/*.pipe(closureCompiler({
			formatting: "PRETTY_PRINT",
			language_in: "ECMASCRIPT5",
			create_source_map: "slidy.map"
		}))*/
		//.pipe(typescript())

		//wrong multifile pipe
		.pipe(exec('traceur --out <%= options.dest %> <%= options.src %> --sourcemap',
			{
				src: path.src.join(' '),
				dest: path.destFile
			}))
		//.pipe(gulp.dest(path.dest))
		.on('error', gutil.beep);


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