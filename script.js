const FIELDS = [
  "全分野",
  "材料力学",
  "機械力学",
  "熱工学",
  "流体工学",
  "機械要素",
  "機械製図",
  "工業材料",
  "工作法",
  "制御・メカトロ",
  "環境・安全"
];

const STORAGE_KEY = "mechanicalStudyHistoryV1";

let questions = [];
let currentQuiz = [];
let currentIndex = 0;
let quizStartTime = 0;
let timerId = null;
let quizAnswers = [];
let reviewMode = false;

const screens = {
  home: document.getElementById("homeScreen"),
  quiz: document.getElementById("quizScreen"),
  result: document.getElementById("resultScreen"),
  stats: document.getElementById("statsScreen")
};

const messageArea = document.getElementById("messageArea");
const fieldSelect = document.getElementById("fieldSelect");
const choicesArea = document.getElementById("choicesArea");
const feedbackArea = document.getElementById("feedbackArea");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  setupFields();
  bindEvents();
  loadQuestions();
}

function setupFields() {
  fieldSelect.innerHTML = FIELDS.map((field) => `<option value="${field}">${field}</option>`).join("");
}

function bindEvents() {
  document.getElementById("startQuizBtn").addEventListener("click", startNormalQuiz);
  document.getElementById("reviewMistakesBtn").addEventListener("click", startMistakeReview);
  document.getElementById("showStatsBtn").addEventListener("click", showStats);
  document.getElementById("homeFromResultBtn").addEventListener("click", showHome);
  document.getElementById("reviewFromResultBtn").addEventListener("click", startMistakeReview);
  document.getElementById("homeFromStatsBtn").addEventListener("click", showHome);
  document.getElementById("resetHistoryBtn").addEventListener("click", resetHistory);
  nextQuestionBtn.addEventListener("click", goNextQuestion);
}

function loadQuestions() {
  fetch("questions.csv")
    .then((response) => {
      if (!response.ok) {
        throw new Error("CSVファイルを取得できませんでした。");
      }
      return response.text();
    })
    .then((csvText) => {
      questions = parseCsv(csvText);
      if (questions.length === 0) {
        showMessage("questions.csvに問題がありません。ヘッダー行と問題データを確認してください。");
      } else {
        hideMessage();
      }
    })
    .catch(() => {
      loadQuestionsWithXhr();
    });
}

function loadQuestionsWithXhr() {
  // ブラウザで直接開いた場合にfetchが使えない環境があるため、XMLHttpRequestも試します。
  const request = new XMLHttpRequest();
  request.open("GET", "questions.csv", true);
  request.onload = () => {
    if (request.status === 0 || (request.status >= 200 && request.status < 300)) {
      questions = parseCsv(request.responseText);
      if (questions.length === 0) {
        showMessage("questions.csvに問題がありません。ヘッダー行と問題データを確認してください。");
      } else {
        hideMessage();
      }
      return;
    }
    showCsvError();
  };
  request.onerror = showCsvError;
  request.send();
}

function showCsvError() {
  showMessage("questions.csvを読み込めませんでした。index.htmlとquestions.csvを同じフォルダに置いてください。ブラウザで直接開いて失敗する場合は、GitHub Pages上で確認してください。");
}

function parseCsv(csvText) {
  const lines = csvText.replace(/\r/g, "").split("\n").filter((line) => line.trim() !== "");
  const header = lines.shift();
  if (!header) {
    return [];
  }

  // このCSVはExcel編集を優先し、半角カンマを本文に使わない前提でシンプルに分割します。
  return lines.map((line) => {
    const cols = line.split(",");
    return {
      id: cols[0],
      field: cols[1],
      topic: cols[2],
      level: cols[3],
      question: cols[4],
      choices: [cols[5], cols[6], cols[7], cols[8]],
      answer: Number(cols[9]),
      explanation: cols[10]
    };
  }).filter((item) => item.id && item.field && item.question && item.answer >= 1 && item.answer <= 4);
}

function startNormalQuiz() {
  reviewMode = false;
  const selectedField = fieldSelect.value;
  const count = getSelectedCount();
  const pool = selectedField === "全分野"
    ? questions
    : questions.filter((q) => q.field === selectedField);

  if (questions.length === 0) {
    showMessage("問題データが読み込まれていません。questions.csvを確認してください。");
    return;
  }

  if (pool.length === 0) {
    showMessage(`${selectedField}の問題がquestions.csvに登録されていません。`);
    return;
  }

  startQuiz(shuffle(pool).slice(0, Math.min(count, pool.length)));
}

function startMistakeReview() {
  reviewMode = true;
  const history = getHistory();
  const mistakeIds = Object.keys(history.byQuestion).filter((id) => history.byQuestion[id].wrongCount > 0);
  const pool = mistakeIds
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean)
    .sort((a, b) => history.byQuestion[b.id].wrongCount - history.byQuestion[a.id].wrongCount);

  if (pool.length === 0) {
    showMessage("まだ弱点復習に使える間違い問題がありません。まずは通常のクイズを解いてみてください。");
    showHome();
    return;
  }

  startQuiz(pool.slice(0, Math.min(getSelectedCount(), pool.length)));
}

function startQuiz(selectedQuestions) {
  hideMessage();
  currentQuiz = selectedQuestions;
  currentIndex = 0;
  quizAnswers = [];
  quizStartTime = Date.now();
  startTimer();
  showScreen("quiz");
  renderQuestion();
}

function renderQuestion() {
  const question = currentQuiz[currentIndex];
  document.getElementById("progressText").textContent = `${currentIndex + 1} / ${currentQuiz.length}`;
  document.getElementById("fieldBadge").textContent = question.field;
  document.getElementById("topicBadge").textContent = question.topic;
  document.getElementById("levelBadge").textContent = question.level;
  document.getElementById("questionText").textContent = question.question;

  feedbackArea.className = "feedback hidden";
  feedbackArea.innerHTML = "";
  nextQuestionBtn.classList.add("hidden");

  choicesArea.innerHTML = "";
  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-btn";
    button.textContent = `${index + 1}. ${choice}`;
    button.addEventListener("click", () => answerQuestion(index + 1));
    choicesArea.appendChild(button);
  });
}

function answerQuestion(selectedNumber) {
  const question = currentQuiz[currentIndex];
  const isCorrect = selectedNumber === question.answer;
  const buttons = [...choicesArea.querySelectorAll("button")];

  buttons.forEach((button, index) => {
    const choiceNumber = index + 1;
    button.disabled = true;
    if (choiceNumber === question.answer) {
      button.classList.add("correct");
    }
    if (choiceNumber === selectedNumber && !isCorrect) {
      button.classList.add("wrong");
    }
  });

  quizAnswers.push({ question, selectedNumber, isCorrect });
  saveAnswer(question, isCorrect);

  feedbackArea.className = `feedback ${isCorrect ? "correct" : "wrong"}`;
  feedbackArea.innerHTML = `
    <strong>${isCorrect ? "正解です" : "不正解です"}</strong>
    <div>正解：${question.answer}. ${question.choices[question.answer - 1]}</div>
    <div>${question.explanation}</div>
  `;
  nextQuestionBtn.textContent = currentIndex === currentQuiz.length - 1 ? "結果を見る" : "次の問題へ";
  nextQuestionBtn.classList.remove("hidden");
}

function goNextQuestion() {
  currentIndex += 1;
  if (currentIndex >= currentQuiz.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

function showResult() {
  stopTimer();
  const total = quizAnswers.length;
  const correct = quizAnswers.filter((item) => item.isCorrect).length;
  const elapsedSeconds = Math.floor((Date.now() - quizStartTime) / 1000);
  const wrongAnswers = quizAnswers.filter((item) => !item.isCorrect);

  document.getElementById("resultScore").textContent = `${correct} / ${total}`;
  document.getElementById("resultRate").textContent = formatRate(correct, total);
  document.getElementById("resultTime").textContent = formatTime(elapsedSeconds);
  renderWrongList(wrongAnswers);
  document.getElementById("reviewFromResultBtn").disabled = !hasMistakes();

  showScreen("result");
}

function renderWrongList(wrongAnswers) {
  const wrongList = document.getElementById("wrongList");
  if (wrongAnswers.length === 0) {
    wrongList.innerHTML = `<p class="muted">今回間違えた問題はありません。</p>`;
    return;
  }

  wrongList.innerHTML = wrongAnswers.map(({ question }) => `
    <div class="mistake-item">
      <p><strong>${question.field} / ${question.topic}</strong></p>
      <p>${question.question}</p>
      <p class="muted">正解：${question.answer}. ${question.choices[question.answer - 1]}</p>
    </div>
  `).join("");
}

function showStats() {
  const history = getHistory();
  const total = history.totalAnswers;
  const correct = history.totalCorrect;

  document.getElementById("totalAnswers").textContent = total;
  document.getElementById("totalCorrect").textContent = correct;
  document.getElementById("overallRate").textContent = formatRate(correct, total);
  document.getElementById("fieldStats").innerHTML = renderStatsRows(history.byField);
  document.getElementById("topicStats").innerHTML = renderStatsRows(history.byTopic);
  renderFrequentMistakes(history);

  hideMessage();
  showScreen("stats");
}

function renderStatsRows(statsObject) {
  const rows = Object.entries(statsObject).sort((a, b) => b[1].total - a[1].total);
  if (rows.length === 0) {
    return `<p class="muted">まだ学習履歴がありません。</p>`;
  }

  return rows.map(([name, stat]) => {
    const rate = stat.total === 0 ? 0 : Math.round((stat.correct / stat.total) * 100);
    return `
      <div class="stat-row">
        <div class="stat-row-header">
          <span>${name}</span>
          <span>${stat.correct}/${stat.total} ${rate}%</span>
        </div>
        <div class="bar" aria-hidden="true"><span style="width: ${rate}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderFrequentMistakes(history) {
  const frequentMistakes = document.getElementById("frequentMistakes");
  const rows = Object.entries(history.byQuestion)
    .filter(([, stat]) => stat.wrongCount > 0)
    .sort((a, b) => b[1].wrongCount - a[1].wrongCount)
    .slice(0, 10);

  if (rows.length === 0) {
    frequentMistakes.innerHTML = `<p class="muted">まだ間違えた問題はありません。</p>`;
    return;
  }

  frequentMistakes.innerHTML = rows.map(([id, stat]) => {
    const question = questions.find((q) => q.id === id);
    const title = question ? question.question : `問題ID：${id}`;
    return `
      <div class="mistake-item">
        <p><strong>${title}</strong></p>
        <p class="muted">${stat.field} / ${stat.topic}</p>
        <p>間違い ${stat.wrongCount}回 ・ 正解 ${stat.correctCount}回</p>
      </div>
    `;
  }).join("");
}

function saveAnswer(question, isCorrect) {
  const history = getHistory();
  const now = new Date().toISOString();

  history.totalAnswers += 1;
  if (isCorrect) {
    history.totalCorrect += 1;
  }

  addAggregate(history.byField, question.field, isCorrect);
  addAggregate(history.byTopic, question.topic, isCorrect);

  if (!history.byQuestion[question.id]) {
    history.byQuestion[question.id] = {
      field: question.field,
      topic: question.topic,
      wrongCount: 0,
      correctCount: 0,
      totalCount: 0,
      lastAnsweredAt: ""
    };
  }

  const questionStat = history.byQuestion[question.id];
  questionStat.totalCount += 1;
  questionStat.lastAnsweredAt = now;
  if (isCorrect) {
    questionStat.correctCount += 1;
  } else {
    questionStat.wrongCount += 1;
  }

  history.records.push({
    questionId: question.id,
    isCorrect,
    answeredAt: now,
    field: question.field,
    topic: question.topic
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function addAggregate(target, key, isCorrect) {
  if (!target[key]) {
    target[key] = { total: 0, correct: 0 };
  }
  target[key].total += 1;
  if (isCorrect) {
    target[key].correct += 1;
  }
}

function getHistory() {
  const defaultHistory = {
    records: [],
    byQuestion: {},
    byField: {},
    byTopic: {},
    totalAnswers: 0,
    totalCorrect: 0
  };

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultHistory;
  } catch {
    return defaultHistory;
  }
}

function resetHistory() {
  const ok = confirm("学習履歴をすべて削除します。よろしいですか？");
  if (!ok) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  showStats();
  showMessage("学習履歴をリセットしました。");
}

function hasMistakes() {
  const history = getHistory();
  return Object.values(history.byQuestion).some((item) => item.wrongCount > 0);
}

function getSelectedCount() {
  return Number(document.querySelector("input[name='questionCount']:checked").value);
}

function shuffle(items) {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function startTimer() {
  stopTimer();
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimer() {
  const elapsedSeconds = Math.floor((Date.now() - quizStartTime) / 1000);
  document.getElementById("timerText").textContent = formatTime(elapsedSeconds);
}

function formatTime(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const restSeconds = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${restSeconds}`;
}

function formatRate(correct, total) {
  if (total === 0) {
    return "0%";
  }
  return `${Math.round((correct / total) * 100)}%`;
}

function showScreen(screenName) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active-screen"));
  screens[screenName].classList.add("active-screen");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  stopTimer();
  showScreen("home");
}

function showMessage(text) {
  messageArea.textContent = text;
  messageArea.classList.remove("hidden");
}

function hideMessage() {
  messageArea.classList.add("hidden");
  messageArea.textContent = "";
}
