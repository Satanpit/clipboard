var gulp = require('gulp'),
    uglify = require('gulp-uglifyjs');

gulp.task('build', function () {
    gulp.src('clipboard.js')
        .pipe(uglify('clipboard.min.js', {
            outSourceMap: true
        }))
        .pipe(gulp.dest(''));
});