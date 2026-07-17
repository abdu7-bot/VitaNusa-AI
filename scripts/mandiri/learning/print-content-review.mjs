import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_LEARNING_CATALOG_PATH,
  verifyLearningPackages,
} from './verify-learning-packages.mjs';

function line(label, value) {
  return `${label}: ${value}`;
}

function answerText(correctAnswer) {
  return typeof correctAnswer === 'string' || typeof correctAnswer === 'number'
    ? String(correctAnswer)
    : JSON.stringify(correctAnswer);
}

export async function createContentReviewText({
  catalogPath = DEFAULT_LEARNING_CATALOG_PATH,
} = {}) {
  const verification = await verifyLearningPackages({ catalogPath, quiet: true });
  const output = [];

  for (const item of verification.packages) {
    const { graph, manifest } = item;
    output.push(`# ${manifest.title}`);
    output.push(line('Package', manifest.packageId));
    output.push(line('Checksum status', 'valid'));
    output.push(line('Checksum', item.contentSha256));
    output.push(line('Review status', manifest.reviewStatus));
    output.push(line('Safety findings', item.safetyFindings.length));

    for (const program of graph.programs) {
      output.push(line('Program', `${program.title} (${program.programId})`));
    }
    for (const course of graph.courses) {
      output.push(line('Course', `${course.title} (${course.courseId})`));
    }
    for (const module of graph.modules) {
      output.push(line('Module', `${module.title} (${module.moduleId})`));
    }
    for (const lesson of graph.lessons) {
      output.push(line('Lesson', `${lesson.title} (${lesson.lessonId})`));
      output.push(line('Learning objective', lesson.learningObjective));
    }
    for (const activity of graph.activities) {
      output.push(line('Activity', `${activity.prompt} (${activity.type})`));
    }
    for (const exercise of graph.exercises) {
      output.push(line('Exercise', `${exercise.prompt} (${exercise.exerciseId})`));
      output.push(line('Correct answer', answerText(exercise.correctAnswer)));
      output.push(line('Explanation', exercise.explanation));
    }
    for (const quiz of graph.quizzes) {
      output.push(line('Quiz threshold', `${quiz.passingThresholdBasisPoints} basis points`));
    }
  }

  return `${output.join('\n')}\n`;
}

function isMainModule() {
  return process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  const catalogPath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_LEARNING_CATALOG_PATH;
  createContentReviewText({ catalogPath })
    .then((text) => process.stdout.write(text))
    .catch((error) => {
      console.error(`ERROR: ${error?.message ?? 'ringkasan review tidak dapat dibuat'}`);
      process.exitCode = 1;
    });
}
