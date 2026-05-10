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

const STORAGE_KEY = "mechanicalStudyHistory";
const LEGACY_STORAGE_KEY = "mechanicalStudyHistoryV1";
const QUESTIONS_CSV = "questions.csv";
const WEAK_TOPIC_RATE_LIMIT = 70;
const REVIEW_STATUSES = ["迷った", "間違えた"];
const STATUS_PRIORITY = {
  "間違えた": 2,
  "迷った": 1,
  "わかった": 0
};

let questions = [];
let currentQuiz = [];
let currentIndex = 0;
let quizStartTime = 0;
let timerId = null;
let quizAnswers = [];
let reviewMode = false;
let statsState = createDefaultStatsState();

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
const statusArea = document.getElementById("statusArea");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const historyImportInput = document.getElementById("historyImportInput");
let importMode = "merge";

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
  document.getElementById("reviewStatusBtn").addEventListener("click", startStatusReview);
  document.getElementById("showStatsBtn").addEventListener("click", showStats);
  document.getElementById("homeFromResultBtn").addEventListener("click", showHome);
  document.getElementById("reviewFromResultBtn").addEventListener("click", startMistakeReview);
  document.getElementById("homeFromStatsBtn").addEventListener("click", showHome);
  document.getElementById("resetHistoryBtn").addEventListener("click", resetHistory);
  document.querySelectorAll("[data-stats-tab]").forEach((button) => {
    button.addEventListener("click", () => switchStatsTab(button.dataset.statsTab));
  });
  document.getElementById("showMoreWeaknessBtn").addEventListener("click", () => showMoreStatsItems("weakness"));
  document.getElementById("showMoreRecentBtn").addEventListener("click", () => showMoreStatsItems("recent"));
  document.getElementById("showMoreQuestionsBtn").addEventListener("click", () => showMoreStatsItems("question"));
  document.getElementById("showMoreInsufficientBtn").addEventListener("click", () => showMoreStatsItems("insufficient"));
  document.getElementById("reviewVisibleWeaknessBtn").addEventListener("click", startVisibleWeaknessReview);
  document.getElementById("exportHistoryBtn").addEventListener("click", exportHistory);
  document.getElementById("importMergeBtn").addEventListener("click", () => chooseImportFile("merge"));
  document.getElementById("importReplaceBtn").addEventListener("click", () => chooseImportFile("replace"));
  historyImportInput.addEventListener("change", importHistoryFromFile);
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

function startStatusReview() {
  reviewMode = true;
  const studyHistory = getStudyHistory();
  // 復習モードでは「間違えた」を先に、同じ状態なら古い回答から出します。
  const pool = Object.values(studyHistory)
    .filter((item) => REVIEW_STATUSES.includes(item.status))
    .map((item) => ({
      record: item,
      question: questions.find((q) => q.id === item.id)
    }))
    .filter((item) => item.question)
    .sort((a, b) => {
      const priorityDiff = STATUS_PRIORITY[b.record.status] - STATUS_PRIORITY[a.record.status];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return new Date(a.record.lastAnsweredAt || 0) - new Date(b.record.lastAnsweredAt || 0);
    })
    .map((item) => item.question);

  if (pool.length === 0) {
    showMessage("復習対象の問題はありません。");
    showHome();
    return;
  }

  startQuiz(pool.slice(0, Math.min(getSelectedCount(), pool.length)));
}

function startVisibleWeaknessReview() {
  const visibleTopics = statsState.weaknessRows.slice(0, statsState.visibleCounts.weakness);
  const topicKeys = new Set(visibleTopics.map((item) => getTopicKey(item.field, item.topic)));
  const pool = questions.filter((question) => topicKeys.has(getTopicKey(question.field, question.topic)));

  if (pool.length === 0) {
    showMessage("表示中の弱点トピックに対応する問題が見つかりませんでした。");
    return;
  }

  reviewMode = true;
  startQuiz(selectNormalQuizQuestions(pool, getSelectedCount()));
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
  statusArea.className = "status-area hidden";
  statusArea.innerHTML = "";
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

  quizAnswers.push({ question, selectedNumber, isCorrect, status: "" });

  feedbackArea.className = `feedback ${isCorrect ? "correct" : "wrong"}`;
  feedbackArea.innerHTML = `
    <strong>${isCorrect ? "正解です" : "不正解です"}</strong>
    <div>正解：${question.answer}. ${question.choices[question.answer - 1]}</div>
    <div>${question.explanation}</div>
  `;
  renderStatusButtons(question, isCorrect, selectedNumber);
}

function renderStatusButtons(question, isCorrect, selectedNumber) {
  statusArea.className = "status-area";
  statusArea.innerHTML = `
    <p class="status-title">この問題の手応えを記録してください</p>
    <div class="status-buttons" role="group" aria-label="学習状態を記録">
      <button type="button" data-status="わかった">わかった</button>
      <button type="button" data-status="迷った">迷った</button>
      <button type="button" data-status="間違えた">間違えた</button>
    </div>
  `;

  statusArea.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const status = button.dataset.status;
      const latestAnswer = quizAnswers[quizAnswers.length - 1];
      if (latestAnswer && latestAnswer.question.id === question.id) {
        // 同じ回答で押し直した場合は、回数を増やさず最後の状態だけ直します。
        if (latestAnswer.status) {
          updateLatestAnswerStatus(question.id, status);
        } else {
          saveAnswer(question, isCorrect, selectedNumber, status);
        }
        latestAnswer.status = status;
      }
      statusArea.querySelectorAll("[data-status]").forEach((item) => {
        item.classList.toggle("selected-status", item === button);
      });
      nextQuestionBtn.textContent = currentIndex === currentQuiz.length - 1 ? "結果を見る" : "次の問題へ";
      nextQuestionBtn.classList.remove("hidden");
    });
  });
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
  const topicSummaries = buildTopicSummaries(history);
  statsState = buildStatsState(history, topicSummaries);

  document.getElementById("summaryOverallRate").textContent = formatRate(history.totalCorrect, history.totalAnswers);
  document.getElementById("summaryTotalAnswers").textContent = history.totalAnswers;
  document.getElementById("summaryWeakTopicCount").textContent = statsState.weaknessRows.filter((stat) => getRate(stat) < WEAK_TOPIC_RATE_LIMIT).length;
  document.getElementById("summaryRecentMistakeCount").textContent = statsState.recentRows.length;
  switchStatsTab(statsState.activeTab);

  hideMessage();
  showScreen("stats");
}

function createDefaultStatsState() {
  return {
    activeTab: "weakness",
    visibleCounts: {
      weakness: 5,
      recent: 5,
      question: 5,
      insufficient: 10
    },
    weaknessRows: [],
    recentRows: [],
    fieldRows: [],
    questionRows: [],
    insufficientRows: []
  };
}

function buildStatsState(history, topicSummaries) {
  const state = createDefaultStatsState();
  state.activeTab = "weakness";
  state.weaknessRows = [...topicSummaries]
    .filter((stat) => stat.total >= 3)
    .sort(sortByLowRateThenCount);
  state.insufficientRows = [...topicSummaries]
    .filter((stat) => stat.total > 0 && stat.total < 3)
    .sort((a, b) => a.total - b.total || a.field.localeCompare(b.field, "ja") || a.topic.localeCompare(b.topic, "ja"));
  state.fieldRows = Object.entries(history.byField || {})
    .map(([field, stat]) => ({ field, total: stat.total || 0, correct: stat.correct || 0 }))
    .sort(sortByLowRateThenCount);
  state.questionRows = buildQuestionMistakeRows(history);
  state.recentRows = buildRecentMistakeRows(history);
  return state;
}

function switchStatsTab(tabName) {
  statsState.activeTab = tabName;
  document.querySelectorAll("[data-stats-tab]").forEach((button) => {
    const isActive = button.dataset.statsTab === tabName;
    button.classList.toggle("active-tab", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.classList.toggle("active-tab-panel", panel.dataset.tabPanel === tabName);
  });
  renderActiveStatsTab();
}

function showMoreStatsItems(kind) {
  const step = kind === "insufficient" ? 10 : 5;
  statsState.visibleCounts[kind] += step;
  renderActiveStatsTab();
}

function renderActiveStatsTab() {
  if (statsState.activeTab === "weakness") {
    renderWeaknessTab();
  } else if (statsState.activeTab === "recent") {
    renderRecentMistakesTab();
  } else if (statsState.activeTab === "field") {
    renderFieldStatsTab();
  } else if (statsState.activeTab === "question") {
    renderQuestionMistakesTab();
  } else if (statsState.activeTab === "insufficient") {
    renderInsufficientTopicsTab();
  }
}

function renderWeaknessTab() {
  const rows = statsState.weaknessRows;
  const visibleRows = rows.slice(0, statsState.visibleCounts.weakness);
  const weaknessRanking = document.getElementById("weaknessRanking");
  const reviewButton = document.getElementById("reviewVisibleWeaknessBtn");

  reviewButton.classList.toggle("hidden", visibleRows.length === 0);
  if (visibleRows.length === 0) {
    weaknessRanking.innerHTML = `<p class="muted">回答数が3回以上のトピックがまだありません。</p>`;
    updateMoreButton("showMoreWeaknessBtn", 0, 0);
    return;
  }

  weaknessRanking.innerHTML = visibleRows.map((stat, index) => {
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
  updateMoreButton("showMoreWeaknessBtn", visibleRows.length, rows.length);
}

function renderRecentMistakesTab() {
  const rows = statsState.recentRows;
  const visibleRows = rows.slice(0, statsState.visibleCounts.recent);
  const recentMistakes = document.getElementById("recentMistakes");

  if (visibleRows.length === 0) {
    recentMistakes.innerHTML = `<p class="muted">まだ最近間違えた問題はありません。</p>`;
    updateMoreButton("showMoreRecentBtn", 0, 0);
    return;
  }

  recentMistakes.innerHTML = visibleRows.map((record) => `
    <div class="mistake-item">
      <p><strong>${formatDateTime(record.answeredAt)}</strong></p>
      <p class="muted">${escapeHtml(record.field)} / ${escapeHtml(record.topic)}</p>
      <p>${escapeHtml(record.question)}</p>
    </div>
  `).join("");
  updateMoreButton("showMoreRecentBtn", visibleRows.length, rows.length);
}

function renderFieldStatsTab() {
  const fieldStats = document.getElementById("fieldStats");
  if (statsState.fieldRows.length === 0) {
    fieldStats.innerHTML = `<p class="muted">まだ学習履歴がありません。</p>`;
    return;
  }

  fieldStats.innerHTML = statsState.fieldRows.map((stat) => {
    const rate = getRate(stat);
    const status = stat.total < 3 ? "判定不足" : `${rate}%`;
    return `
      <div class="compact-stat-row ${stat.total < 3 ? "needs-more" : ""}">
        <div>
          <strong>${escapeHtml(stat.field)}</strong>
          <span>回答 ${stat.total}回</span>
        </div>
        <div class="compact-rate">${status}</div>
        <div class="bar" aria-hidden="true"><span style="width: ${rate}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderQuestionMistakesTab() {
  const rows = statsState.questionRows;
  const visibleRows = rows.slice(0, statsState.visibleCounts.question);
  const frequentMistakes = document.getElementById("frequentMistakes");

  if (visibleRows.length === 0) {
    frequentMistakes.innerHTML = `<p class="muted">まだ間違えた問題はありません。</p>`;
    updateMoreButton("showMoreQuestionsBtn", 0, 0);
    return;
  }

  frequentMistakes.innerHTML = visibleRows.map((stat) => `
    <details class="mistake-item mistake-details">
      <summary>
        <span>
          <strong>${escapeHtml(stat.id)}</strong>
          <small>${escapeHtml(stat.field)} / ${escapeHtml(stat.topic)}</small>
          <small class="question-preview">${escapeHtml(truncateText(stat.question, 42))}</small>
        </span>
        <span class="mistake-counts">間違い ${stat.wrongCount}回 ・ 正解 ${stat.correctCount}回</span>
      </summary>
      <p>${escapeHtml(stat.question)}</p>
    </details>
  `).join("");
  updateMoreButton("showMoreQuestionsBtn", visibleRows.length, rows.length);
}

function renderInsufficientTopicsTab() {
  const rows = statsState.insufficientRows;
  const visibleRows = rows.slice(0, statsState.visibleCounts.insufficient);
  const insufficientTopics = document.getElementById("insufficientTopics");

  if (visibleRows.length === 0) {
    insufficientTopics.innerHTML = `<p class="muted">判定不足のトピックはありません。</p>`;
    updateMoreButton("showMoreInsufficientBtn", 0, 0);
    return;
  }

  insufficientTopics.innerHTML = visibleRows.map((stat) => `
    <div class="compact-stat-row needs-more">
      <div>
        <strong>${escapeHtml(stat.topic)}</strong>
        <span>${escapeHtml(stat.field)}</span>
      </div>
      <div class="compact-rate">回答 ${stat.total}回</div>
    </div>
  `).join("");
  updateMoreButton("showMoreInsufficientBtn", visibleRows.length, rows.length);
}

function updateMoreButton(buttonId, visibleCount, totalCount) {
  const button = document.getElementById(buttonId);
  button.classList.toggle("hidden", visibleCount >= totalCount);
}

function buildQuestionMistakeRows(history) {
  return Object.entries(history.byQuestion || {})
    .filter(([, stat]) => stat.wrongCount > 0)
    .sort((a, b) => b[1].wrongCount - a[1].wrongCount)
    .map(([id, stat]) => {
      const question = questions.find((q) => q.id === id);
      const title = question ? question.question : stat.question || `問題ID：${id}`;
      const field = stat.field || question?.field || "分野不明";
      const topic = stat.topic || question?.topic || "トピック不明";
      return {
        id,
        field,
        topic,
        question: title,
        wrongCount: stat.wrongCount || 0,
        correctCount: stat.correctCount || 0
      };
    });
}

function buildRecentMistakeRows(history) {
  return [...(history.records || [])]
    .filter((record) => record && record.isCorrect === false)
    .sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt))
    .map((record) => {
      const question = questions.find((q) => q.id === record.questionId);
      const field = record.field || question?.field || "分野不明";
      const topic = record.topic || question?.topic || "トピック不明";
      const questionText = record.question || question?.question || `問題ID：${record.questionId}`;
      return {
        answeredAt: record.answeredAt,
        field,
        topic,
        question: questionText
      };
    });
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

function saveAnswer(question, isCorrect, selectedNumber, status) {
  const studyHistory = getStudyHistory();
  const now = new Date().toISOString();

  if (!studyHistory[question.id]) {
    studyHistory[question.id] = {
      id: question.id,
      field: question.field,
      topic: question.topic,
      status: "",
      correctCount: 0,
      incorrectCount: 0,
      lastAnsweredAt: "",
      lastSelectedStatus: "",
      history: []
    };
  }

  const questionStat = studyHistory[question.id];
  // questions.csvを変更しないため、履歴側にも表示に必要な最小情報だけ持たせます。
  questionStat.field = question.field;
  questionStat.topic = question.topic;
  questionStat.id = question.id;
  questionStat.status = status;
  questionStat.lastSelectedStatus = status;
  questionStat.lastAnsweredAt = now;
  if (isCorrect) {
    questionStat.correctCount += 1;
  } else {
    questionStat.incorrectCount += 1;
  }
  questionStat.history.push({
    answeredAt: now,
    isCorrect,
    status,
    selectedNumber
  });

  saveStudyHistory(studyHistory);
}

function updateLatestAnswerStatus(questionId, status) {
  const studyHistory = getStudyHistory();
  const questionStat = studyHistory[questionId];
  if (!questionStat) {
    return;
  }

  const latestRecord = questionStat.history[questionStat.history.length - 1];
  if (latestRecord) {
    latestRecord.status = status;
  }
  questionStat.status = status;
  questionStat.lastSelectedStatus = status;
  saveStudyHistory(studyHistory);
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

  const studyHistory = getStudyHistory();
  Object.values(studyHistory).forEach((item) => {
    const question = questions.find((q) => q.id === item.id);
    const field = item.field || question?.field || "分野不明";
    const topic = item.topic || question?.topic || "トピック不明";
    const correctCount = Number(item.correctCount || 0);
    const incorrectCount = Number(item.incorrectCount || item.wrongCount || 0);
    const totalCount = correctCount + incorrectCount;

    defaultHistory.byQuestion[item.id] = {
      field,
      topic,
      question: question?.question || item.question || `問題ID：${item.id}`,
      wrongCount: incorrectCount,
      correctCount,
      totalCount,
      lastAnsweredAt: item.lastAnsweredAt || "",
      status: item.status || item.lastSelectedStatus || ""
    };

    (item.history || []).forEach((record) => {
      const isCorrect = Boolean(record.isCorrect);
      const answeredAt = record.answeredAt || item.lastAnsweredAt || "";
      defaultHistory.totalAnswers += 1;
      if (isCorrect) {
        defaultHistory.totalCorrect += 1;
      }
      addAggregate(defaultHistory.byField, field, isCorrect);
      addTopicAggregate(defaultHistory.byTopic, { field, topic }, isCorrect);
      defaultHistory.records.push({
        questionId: item.id,
        isCorrect,
        answeredAt,
        field,
        topic,
        question: question?.question || item.question || `問題ID：${item.id}`,
        status: record.status || item.status || ""
      });
    });
  });

  return defaultHistory;
}

function getStudyHistory() {
  try {
    const storedHistory = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (storedHistory) {
      return normalizeStudyHistory(storedHistory);
    }
  } catch {
    return {};
  }

  const legacyHistory = migrateLegacyHistory();
  if (Object.keys(legacyHistory).length > 0) {
    saveStudyHistory(legacyHistory);
  }
  return legacyHistory;
}

function saveStudyHistory(studyHistory) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStudyHistory(studyHistory)));
}

function normalizeStudyHistory(rawHistory) {
  const source = rawHistory && rawHistory.byQuestion ? migrateLegacyObject(rawHistory) : rawHistory;
  const normalized = {};

  Object.entries(source || {}).forEach(([id, item]) => {
    if (!id || !item) {
      return;
    }

    const history = Array.isArray(item.history)
      ? item.history
          .filter((record) => record && record.answeredAt)
          .map((record) => ({
            answeredAt: record.answeredAt,
            isCorrect: Boolean(record.isCorrect),
            status: normalizeStatus(record.status || item.status || item.lastSelectedStatus),
            selectedNumber: record.selectedNumber || null
          }))
      : [];
    const latestRecord = getLatestRecord(history);
    const status = normalizeStatus(item.status || item.lastSelectedStatus || latestRecord?.status);
    // JSONを手で直した場合にも壊れにくいよう、数値は安全に補正します。
    const correctCount = Number.isFinite(Number(item.correctCount)) ? Number(item.correctCount) : history.filter((record) => record.isCorrect).length;
    const incorrectCount = Number.isFinite(Number(item.incorrectCount)) ? Number(item.incorrectCount) : Number(item.wrongCount || history.filter((record) => !record.isCorrect).length);

    normalized[id] = {
      id: item.id || id,
      field: item.field || "",
      topic: item.topic || "",
      status,
      correctCount,
      incorrectCount,
      lastAnsweredAt: item.lastAnsweredAt || latestRecord?.answeredAt || "",
      lastSelectedStatus: normalizeStatus(item.lastSelectedStatus || status),
      history
    };
  });

  return normalized;
}

function normalizeStatus(status) {
  return ["わかった", "迷った", "間違えた"].includes(status) ? status : "";
}

function getLatestRecord(history) {
  return [...(history || [])].sort((a, b) => new Date(b.answeredAt || 0) - new Date(a.answeredAt || 0))[0];
}

function migrateLegacyHistory() {
  try {
    return migrateLegacyObject(JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)));
  } catch {
    return {};
  }
}

function migrateLegacyObject(legacyHistory) {
  const migrated = {};
  if (!legacyHistory || !legacyHistory.byQuestion) {
    return migrated;
  }

  Object.entries(legacyHistory.byQuestion).forEach(([id, item]) => {
    migrated[id] = {
      id,
      field: item.field || "",
      topic: item.topic || "",
      status: item.wrongCount > 0 ? "間違えた" : "わかった",
      correctCount: item.correctCount || 0,
      incorrectCount: item.wrongCount || 0,
      lastAnsweredAt: item.lastAnsweredAt || "",
      lastSelectedStatus: item.wrongCount > 0 ? "間違えた" : "わかった",
      history: []
    };
  });

  (legacyHistory.records || []).forEach((record) => {
    const id = record.questionId;
    if (!id) {
      return;
    }
    if (!migrated[id]) {
      migrated[id] = {
        id,
        field: record.field || "",
        topic: record.topic || "",
        status: "",
        correctCount: 0,
        incorrectCount: 0,
        lastAnsweredAt: "",
        lastSelectedStatus: "",
        history: []
      };
    }
    migrated[id].history.push({
      answeredAt: record.answeredAt,
      isCorrect: Boolean(record.isCorrect),
      status: record.isCorrect ? "わかった" : "間違えた",
      selectedNumber: null
    });
  });

  return normalizeStudyHistory(migrated);
}

function resetHistory() {
  const ok = confirm("学習履歴をすべて削除します。よろしいですか？");
  if (!ok) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  showStats();
  showMessage("学習履歴をリセットしました。");
}

function hasMistakes() {
  const history = getHistory();
  return Object.values(history.byQuestion).some((item) => item.wrongCount > 0);
}

function exportHistory() {
  const studyHistory = getStudyHistory();
  const today = new Date();
  const yyyymmdd = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("");
  const blob = new Blob([JSON.stringify(studyHistory, null, 2)], { type: "application/json" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `study-history-${yyyymmdd}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  showMessage("学習履歴をJSONファイルとしてエクスポートしました。");
}

function chooseImportFile(mode) {
  importMode = mode;
  historyImportInput.value = "";
  historyImportInput.click();
}

function importHistoryFromFile(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const message = importMode === "replace"
    ? "現在の履歴をすべて削除して、選択したJSONの内容で全上書き復元します。よろしいですか？"
    : "選択したJSONの履歴を現在の履歴に統合します。よろしいですか？";
  if (!confirm(message)) {
    historyImportInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedHistory = normalizeStudyHistory(JSON.parse(reader.result));
      const currentHistory = importMode === "replace" ? {} : getStudyHistory();
      const mergedHistory = importMode === "replace"
        ? importedHistory
        : mergeStudyHistories(currentHistory, importedHistory);
      saveStudyHistory(mergedHistory);
      showStats();
      showMessage(`インポートが完了しました。${Object.keys(importedHistory).length}件の問題履歴を読み込みました。`);
    } catch {
      showMessage("JSONファイルを読み込めませんでした。エクスポートした履歴ファイルか確認してください。");
    } finally {
      historyImportInput.value = "";
    }
  };
  reader.readAsText(file);
}

function mergeStudyHistories(currentHistory, importedHistory) {
  const merged = normalizeStudyHistory(currentHistory);

  Object.entries(normalizeStudyHistory(importedHistory)).forEach(([id, importedItem]) => {
    if (!merged[id]) {
      merged[id] = importedItem;
      return;
    }

    const currentItem = merged[id];
    const currentLast = new Date(currentItem.lastAnsweredAt || 0).getTime();
    const importedLast = new Date(importedItem.lastAnsweredAt || 0).getTime();
    // 統合では履歴と回数は足し合わせ、現在の状態だけ新しい回答日のものを採用します。
    const history = [...(currentItem.history || []), ...(importedItem.history || [])]
      .sort((a, b) => new Date(a.answeredAt || 0) - new Date(b.answeredAt || 0));

    merged[id] = {
      id,
      field: importedItem.field || currentItem.field,
      topic: importedItem.topic || currentItem.topic,
      status: importedLast >= currentLast ? importedItem.status : currentItem.status,
      correctCount: (currentItem.correctCount || 0) + (importedItem.correctCount || 0),
      incorrectCount: (currentItem.incorrectCount || 0) + (importedItem.incorrectCount || 0),
      lastAnsweredAt: importedLast >= currentLast ? importedItem.lastAnsweredAt : currentItem.lastAnsweredAt,
      lastSelectedStatus: importedLast >= currentLast ? importedItem.lastSelectedStatus : currentItem.lastSelectedStatus,
      history
    };
  });

  return normalizeStudyHistory(merged);
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
  return b.total - a.total
    || (b.wrong || 0) - (a.wrong || 0)
    || String(a.field || "").localeCompare(String(b.field || ""), "ja")
    || String(a.topic || "").localeCompare(String(b.topic || ""), "ja");
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

function truncateText(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
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
