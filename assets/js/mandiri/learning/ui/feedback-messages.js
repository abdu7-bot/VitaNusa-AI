export const LEARNING_FEEDBACK_MESSAGES = Object.freeze({
  correct: 'Jawaban tepat. Mari lanjutkan.',
  try_again: 'Belum tepat. Coba periksa kembali langkahnya.',
  review_example: 'Mari lihat kembali contoh sebelum mencoba lagi.',
  invalid_answer: 'Jawaban belum dapat diperiksa. Periksa isian lalu coba lagi.',
});

export function getLearningFeedbackMessage(code) {
  return LEARNING_FEEDBACK_MESSAGES[code] || LEARNING_FEEDBACK_MESSAGES.invalid_answer;
}
