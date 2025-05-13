const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');

const paths = {
  scss: './styles/styles.scss',
  output: './src/' // à adapter selon ton projet
};

// tâche de build
gulp.task('build-css', () => {
  return gulp.src(paths.scss)
    .pipe(sass().on('error', sass.logError))
    .pipe(cleanCSS())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest(paths.output));
});

// tâche de watch
gulp.task('watch', () => {
  gulp.watch('./styles/**/*.scss', gulp.series('build-css'));
});

// tâche par défaut
gulp.task('default', gulp.series('build-css'));
