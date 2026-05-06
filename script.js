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
const QUESTIONS_CSV = "questions.csv";

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
  fetch(getQuestionsCsvUrl(), { cache: "no-store" })
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
  request.open("GET", getQuestionsCsvUrl(), true);
  if (window.location.protocol !== "file:") {
    request.setRequestHeader("Cache-Control", "no-cache");
  }
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

function getQuestionsCsvUrl() {
  if (window.location.protocol === "file:") {
    return QUESTIONS_CSV;
  }
  return `${QUESTIONS_CSV}?v=${Date.now()}`;
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

  startQuiz(selectNormalQuizQuestions(pool, count));
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

function selectNormalQuizQuestions(pool, count) {
  const history = getHistory();
  const targetCount = Math.min(count, pool.length);

  return [...pool]
    .map((question) => ({
      question,
      answeredCount: history.byQuestion[question.id]?.totalCount || 0,
      randomOrder: Math.random()
    }))
    .sort((a, b) => a.answeredCount - b.answeredCount || a.randomOrder - b.randomOrder)
    .slice(0, targetCount)
    .map((item) => item.question);
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
  const topicSummaries = buildTopicSummaries(history);

  document.getElementById("totalAnswers").textContent = total;
  document.getElementById("totalCorrect").textContent = correct;
  document.getElementById("overallRate").textContent = formatRate(correct, total);
  document.getElementById("weaknessRanking").innerHTML = renderWeaknessRanking(topicSummaries);
  document.getElementById("insufficientTopics").innerHTML = renderInsufficientTopics(topicSummaries);
  document.getElementById("fieldStats").innerHTML = renderStatsRows(history.byField, { lowRateFirst: true });
  document.getElementById("topicStats").innerHTML = renderTopicStats(topicSummaries);
  renderFrequentMistakes(history);
  renderRecentMistakes(history);

  hideMessage();
  showScreen("stats");
}

function renderStatsRows(statsObject, options = {}) {
  const rows = Object.entries(statsObject).sort((a, b) => {
    const rateA = getRate(a[1]);
    const rateB = getRate(b[1]);
    if (options.lowRateFirst && rateA !== rateB) {
      return rateA - rateB;
    }
    return b[1].total - a[1].total;
  });
  if (rows.length === 0) {
    return `<p class="muted">まだ学習履歴がありません。</p>`;
  }

  return rows.map(([name, stat]) => {
    const rate = getRate(stat);
    return `
      <div class="stat-row">
        <div class="stat-row-header">
          <span>${escapeHtml(name)}</span>
          <span>${stat.correct}/${stat.total} ${rate}%</span>
        </div>
        <div class="bar" aria-hidden="true"><span style="width: ${rate}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderTopicStats(topicSummaries) {
  const rows = [...topicSummaries].sort(sortByLowRateThenCount);
  if (rows.length === 0) {
    return `<p class="muted">まだ学習履歴がありません。</p>`;
  }

  return rows.map((stat) => {
    const rate = getRate(stat);
    const status = stat.total < 3 ? "判定不足" : `${rate}%`;
    return `
      <div class="stat-row ${stat.total < 3 ? "needs-more" : ""}">
        <div class="stat-row-header">
          <span>${escapeHtml(stat.topic)}</span>
          <span>${status}</span>
        </div>
        <p class="stat-row-meta">${escapeHtml(stat.field)} ・ 回答 ${stat.total}回 ・ 間違い ${stat.wrong}回</p>
        <div class="bar" aria-hidden="true"><span style="width: ${rate}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderWeaknessRanking(topicSummaries) {
  const rows = topicSummaries
    .filter((stat) => stat.total >= 3)
    .sort(sortByLowRateThenCount);

  if (rows.length === 0) {
    return `<p class="muted">回答数が3回以上のトピックがまだありません。</p>`;
  }

  return rows.map((stat, index) => {
    const rate = getRate(stat);
    return `
      <div class="ranking-item">
        <div class="rank-badge">${index + 1}</div>
        <div class="ranking-body">
          <div class="ranking-title">${escapeHtml(stat.field)} / ${escapeHtml(stat.topic)}</div>
          <div class="ranking-metrics">
            <span>正答率 ${rate}%</span>
            <span>回答 ${stat.total}回</span>
            <span>間違い ${stat.wrong}回</span>
          </div>
          <div class="bar" aria-hidden="true"><span style="width: ${rate}%"></span></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderInsufficientTopics(topicSummaries) {
  const rows = topicSummaries
    .filter((stat) => stat.total > 0 && stat.total < 3)
    .sort((a, b) => a.total - b.total || a.field.localeCompare(b.field, "ja") || a.topic.localeCompare(b.topic, "ja"));

  if (rows.length === 0) {
    return `<p class="muted">判定不足のトピックはありません。</p>`;
  }

  return rows.map((stat) => `
    <div class="mistake-item">
      <p><strong>${escapeHtml(stat.topic)}</strong></p>
      <p class="muted">${escapeHtml(stat.field)}：回答数${stat.total}回のため判定不足</p>
    </div>
  `).join("");
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
    const title = question ? question.question : stat.question || `問題ID：${id}`;
    const field = stat.field || question?.field || "分野不明";
    const topic = stat.topic || question?.topic || "トピック不明";
    return `
      <div class="mistake-item">
        <p><strong>${escapeHtml(id)}</strong></p>
        <p class="muted">${escapeHtml(field)} / ${escapeHtml(topic)}</p>
        <p>${escapeHtml(title)}</p>
        <p>間違い ${stat.wrongCount}回 ・ 正解 ${stat.correctCount}回</p>
      </div>
    `;
  }).join("");
}

function renderRecentMistakes(history) {
  const recentMistakes = document.getElementById("recentMistakes");
  const rows = [...(history.records || [])]
    .filter((record) => record && record.isCorrect === false)
    .sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt))
    .slice(0, 5);

  if (rows.length === 0) {
    recentMistakes.innerHTML = `<p class="muted">まだ最近間違えた問題はありません。</p>`;
    return;
  }

  recentMistakes.innerHTML = rows.map((record) => {
    const question = questions.find((q) => q.id === record.questionId);
    const field = record.field || question?.field || "分野不明";
    const topic = record.topic || question?.topic || "トピック不明";
    const questionText = record.question || question?.question || `問題ID：${record.questionId}`;
    return `
      <div class="mistake-item">
        <p><strong>${formatDateTime(record.answeredAt)}</strong></p>
        <p class="muted">${escapeHtml(field)} / ${escapeHtml(topic)}</p>
        <p>${escapeHtml(questionText)}</p>
      </div>
    `;
  }).join("");
}

function buildTopicSummaries(history) {
  const summaries = {};
  const records = history.records || [];

  records.forEach((record) => {
    const question = questions.find((q) => q.id === record.questionId);
    const field = record.field || question?.field;
    const topic = record.topic || question?.topic;
    if (!field || !topic) {
      return;
    }
    const key = getTopicKey(field, topic);
    if (!summaries[key]) {
      summaries[key] = { field, topic, total: 0, correct: 0, wrong: 0 };
    }
    summaries[key].total += 1;
    if (record.isCorrect) {
      summaries[key].correct += 1;
    } else {
      summaries[key].wrong += 1;
    }
  });

  if (Object.keys(summaries).length === 0) {
    Object.entries(history.byTopic || {}).forEach(([key, stat]) => {
      const keyParts = key.split("||");
      const topic = stat.topic || keyParts[keyParts.length - 1];
      const field = stat.field || (keyParts.length > 1 ? keyParts[0] : findFieldByTopic(topic));
      summaries[getTopicKey(field, topic)] = {
        field,
        topic,
        total: stat.total || 0,
        correct: stat.correct || 0,
        wrong: Math.max((stat.total || 0) - (stat.correct || 0), 0)
      };
    });
  }

  return Object.values(summaries);
}

function saveAnswer(question, isCorrect) {
  const history = getHistory();
  const now = new Date().toISOString();

  history.totalAnswers += 1;
  if (isCorrect) {
    history.totalCorrect += 1;
  }

  addAggregate(history.byField, question.field, isCorrect);
  addTopicAggregate(history.byTopic, question, isCorrect);

  if (!history.byQuestion[question.id]) {
    history.byQuestion[question.id] = {
      field: question.field,
      topic: question.topic,
      question: question.question,
      wrongCount: 0,
      correctCount: 0,
      totalCount: 0,
      lastAnsweredAt: ""
    };
  }

  const questionStat = history.byQuestion[question.id];
  questionStat.field = question.field;
  questionStat.topic = question.topic;
  questionStat.question = question.question;
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
    topic: question.topic,
    question: question.question
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

function addTopicAggregate(target, question, isCorrect) {
  const key = getTopicKey(question.field, question.topic);
  if (!target[key]) {
    target[key] = {
      field: question.field,
      topic: question.topic,
      total: 0,
      correct: 0
    };
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
    const storedHistory = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!storedHistory) {
      return defaultHistory;
    }
    return {
      ...defaultHistory,
      ...storedHistory,
      records: storedHistory.records || [],
      byQuestion: storedHistory.byQuestion || {},
      byField: storedHistory.byField || {},
      byTopic: storedHistory.byTopic || {}
    };
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

function getRate(stat) {
  if (!stat || stat.total === 0) {
    return 0;
  }
  return Math.round((stat.correct / stat.total) * 100);
}

function sortByLowRateThenCount(a, b) {
  const rateDiff = getRate(a) - getRate(b);
  if (rateDiff !== 0) {
    return rateDiff;
  }
  return b.total - a.total || b.wrong - a.wrong || a.field.localeCompare(b.field, "ja") || a.topic.localeCompare(b.topic, "ja");
}

function getTopicKey(field, topic) {
  return `${field}||${topic}`;
}

function findFieldByTopic(topic) {
  const question = questions.find((item) => item.topic === topic);
  return question ? question.field : "分野不明";
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "日時不明";
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
