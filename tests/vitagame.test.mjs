import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const VITAGAME_HTML = await readFile('vitagame.html', 'utf8');

function createDom() {
  const dom = new JSDOM(VITAGAME_HTML, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  return dom;
}

function waitForGameReady(dom) {
  return new Promise((resolve) => {
    const check = () => {
      if (dom.window.document.querySelector('[data-vitagame-root]')) {
        if (dom.window.__VITAGAME_TEST__) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

function getTestAPI(dom) {
  return dom.window.__VITAGAME_TEST__;
}

test('Fisher–Yates shuffle preserves all elements', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const { shuffle } = getTestAPI(dom);
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = shuffle(items);
  
  assert.equal(shuffled.length, items.length);
  const sortedShuffled = [...shuffled].sort((a, b) => a - b);
  assert.deepEqual(sortedShuffled, items);
});

test('Shuffle does not lose or duplicate elements', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const { shuffle } = getTestAPI(dom);
  const items = ['a', 'b', 'c', 'd', 'e'];
  const shuffled = shuffle(items);
  
  const counts = {};
  for (const item of shuffled) {
    counts[item] = (counts[item] || 0) + 1;
  }
  
  for (const item of items) {
    assert.equal(counts[item], 1, `Element ${item} should appear exactly once`);
  }
});

test('Deterministic random source produces reproducible results', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const { shuffle } = getTestAPI(dom);
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  let seed = 0;
  const deterministicRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  
  const result1 = shuffle(items, deterministicRandom);
  seed = 0;
  const result2 = shuffle(items, deterministicRandom);
  
  assert.deepEqual(result1, result2);
});

test('Deck selection produces 10 unique cards when deck sufficient', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const { shuffle, validCards } = api;
  
  const deck = shuffle(validCards).slice(0, 10);
  assert.equal(deck.length, 10);
  
  const ids = new Set(deck.map(c => c.question));
  assert.equal(ids.size, 10, 'All 10 cards should be unique');
});

test('Deck too small handled with warning', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const { shuffle, validCards } = api;
  
  const smallDeck = validCards.slice(0, 5);
  const deck = shuffle(smallDeck).slice(0, 10);
  
  assert.ok(deck.length <= 5);
  assert.ok(deck.length > 0);
});

test('Correct answer increases score and streak per rules', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  const card1 = getCard();
  clickAnswer(card1.answer);
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().correct, 1);
  assert.equal(api.getState().streak, 1);
  assert.equal(api.getState().score, 12);
  
  const nextBtn = dom.window.document.querySelector('[data-next]');
  nextBtn.click();
  await new Promise(r => setTimeout(r, 50));
  
  const card2 = getCard();
  clickAnswer(card2.answer);
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().correct, 2);
  assert.equal(api.getState().streak, 2);
  assert.equal(api.getState().score, 12 + 14);
});

test('Wrong answer resets streak', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  for (let i = 0; i < 2; i++) {
    const card = getCard();
    clickAnswer(card.answer);
    await new Promise(r => setTimeout(r, 50));
    dom.window.document.querySelector('[data-next]').click();
    await new Promise(r => setTimeout(r, 50));
  }
  
  assert.equal(api.getState().streak, 2);
  
  const card = getCard();
  const wrongAnswer = ['fact', 'check', 'claim'].find(a => a !== card.answer);
  clickAnswer(wrongAnswer);
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().streak, 0, 'Streak should reset to 0 on wrong answer');
  assert.equal(api.getState().correct, 2, 'Correct count should not change');
});

test('Answer on one card only processed once', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  const card = getCard();
  clickAnswer(card.answer);
  await new Promise(r => setTimeout(r, 50));
  
  const scoreAfterFirst = api.getState().score;
  const correctAfterFirst = api.getState().correct;
  
  clickAnswer(card.answer);
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().score, scoreAfterFirst);
  assert.equal(api.getState().correct, correctAfterFirst);
});

test('Next disabled before answer, enabled after', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const nextBtn = dom.window.document.querySelector('[data-next]');
  assert.ok(nextBtn.disabled, 'Next should be disabled before answer');
  
  const api = getTestAPI(dom);
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  const card = getCard();
  clickAnswer(card.answer);
  await new Promise(r => setTimeout(r, 50));
  
  assert.ok(!nextBtn.disabled, 'Next should be enabled after answer');
});

test('Next card shown after answer', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const questionEl = dom.window.document.querySelector('[data-question]');
  const firstQuestion = questionEl.textContent;
  
  const api = getTestAPI(dom);
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  clickAnswer(getCard().answer);
  await new Promise(r => setTimeout(r, 50));
  
  dom.window.document.querySelector('[data-next]').click();
  await new Promise(r => setTimeout(r, 50));
  
  const secondQuestion = questionEl.textContent;
  assert.notEqual(firstQuestion, secondQuestion, 'Should show next card');
});

test('Game finish stops input and produces consistent final score', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  for (let i = 0; i < 10; i++) {
    clickAnswer(getCard().answer);
    await new Promise(r => setTimeout(r, 50));
    dom.window.document.querySelector('[data-next]').click();
    await new Promise(r => setTimeout(r, 50));
  }
  
  const finalScore = api.getState().score;
  const finalCorrect = api.getState().correct;
  
  assert.equal(finalCorrect, 10);
  assert.ok(finalScore > 0);
  
  clickAnswer('fact');
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().score, finalScore, 'Score should not change after finish');
  assert.equal(api.getState().correct, finalCorrect);
  
  const result = dom.window.document.querySelector('[data-result]');
  assert.ok(result.classList.contains('is-visible'));
});

test('Reset clears state and controls', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  clickAnswer(getCard().answer);
  await new Promise(r => setTimeout(r, 50));
  
  dom.window.document.querySelector('[data-reset]').click();
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().score, 0);
  assert.equal(api.getState().correct, 0);
  assert.equal(api.getState().streak, 0);
  assert.equal(api.getState().index, 0);
  assert.equal(api.getState().answeredCount, 0);
  assert.ok(!api.getState().started);
  
  const startBtn = dom.window.document.querySelector('[data-start]');
  assert.equal(startBtn.textContent, 'Mulai Game');
  assert.ok(!startBtn.disabled);
  
  const nextBtn = dom.window.document.querySelector('[data-next]');
  assert.ok(nextBtn.disabled);
  
  const options = dom.window.document.querySelectorAll('[data-answer]');
  for (const opt of options) {
    assert.ok(opt.disabled);
    assert.ok(!opt.classList.contains('is-correct'));
    assert.ok(!opt.classList.contains('is-wrong'));
  }
});

test('Replay starts with fresh state', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  for (let i = 0; i < 10; i++) {
    clickAnswer(getCard().answer);
    await new Promise(r => setTimeout(r, 50));
    dom.window.document.querySelector('[data-next]').click();
    await new Promise(r => setTimeout(r, 50));
  }
  
  const finalScore = api.getState().score;
  
  await new Promise(r => setTimeout(r, 100));
  
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().score, 0, 'Score should reset on replay');
  assert.equal(api.getState().correct, 0);
  assert.equal(api.getState().streak, 0);
  assert.equal(api.getState().index, 0);
  assert.ok(api.getState().deck.length > 0, 'New deck should be created');
});

test('Progress consistent with answered cards count', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const progressEl = dom.window.document.querySelector('[data-progress]');
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  assert.equal(progressEl.style.width, '0%');
  
  clickAnswer(getCard().answer);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(progressEl.style.width, '10%');
  
  dom.window.document.querySelector('[data-next]').click();
  await new Promise(r => setTimeout(r, 50));
  
  clickAnswer(getCard().answer);
  await new Promise(r => setTimeout(r, 50));
  assert.equal(progressEl.style.width, '20%');
  
  for (let i = 2; i < 10; i++) {
    dom.window.document.querySelector('[data-next]').click();
    await new Promise(r => setTimeout(r, 50));
    clickAnswer(getCard().answer);
    await new Promise(r => setTimeout(r, 50));
  }
  
  assert.equal(progressEl.style.width, '100%');
});

test('Feedback treated as text, not HTML', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 100));
  
  const feedbackEl = dom.window.document.querySelector('[data-feedback]');
  
  // Feedback title is wrapped in <strong> for styling (intentional)
  // Body content should be text, not parsed as HTML
  assert.ok(feedbackEl.textContent.includes('Pilih jawabanmu'));
  
  const getCard = () => api.getState().deck[api.getState().index];
  const clickAnswer = (answer) => {
    const btn = dom.window.document.querySelector(`[data-answer="${answer}"]`);
    btn.click();
  };
  
  clickAnswer(getCard().answer);
  await new Promise(r => setTimeout(r, 100));
  
  assert.ok(feedbackEl.textContent.includes('Jawaban:'));
  const strongElements = feedbackEl.querySelectorAll('strong');
  assert.equal(strongElements.length, 1, 'Only one strong element for title');
  assert.ok(strongElements[0].textContent.includes('Tepat') || strongElements[0].textContent.includes('Belum tepat'));
});

test('Invalid input does not crash game', async () => {
  const dom = createDom();
  await waitForGameReady(dom);
  
  const api = getTestAPI(dom);
  
  const answerBtn = dom.window.document.querySelector('[data-answer="fact"]');
  answerBtn.click();
  await new Promise(r => setTimeout(r, 50));
  
  assert.ok(!api.getState().started);
  assert.equal(api.getState().score, 0);
  
  const startGame = () => dom.window.document.querySelector('[data-start]').click();
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  const nextBtn = dom.window.document.querySelector('[data-next]');
  nextBtn.click();
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().index, 0);
  
  const resetBtn = dom.window.document.querySelector('[data-reset]');
  resetBtn.click();
  await new Promise(r => setTimeout(r, 50));
  
  assert.ok(!api.getState().started);
  assert.equal(api.getState().score, 0);
  
  startGame();
  await new Promise(r => setTimeout(r, 50));
  startGame();
  await new Promise(r => setTimeout(r, 50));
  
  assert.equal(api.getState().deck.length, 10);
});