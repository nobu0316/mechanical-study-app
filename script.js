const FIELDS = [
  "全分野",
  "材料力学",
  "機械力学",
  "熱工学",
  "流体工学",
  "熱・流体",
  "機械要素",
  "機械製図",
  "工業材料",
  "工作法",
  "制御・メカトロ",
  "制御工学",
  "数学・力学基礎",
  "環境・安全"
];

const STORAGE_KEY = "mechanicalStudyHistory";
const LEGACY_STORAGE_KEY = "mechanicalStudyHistoryV1";
const NOTE_CARDS_STORAGE_KEY = "mechanicalStudyNoteCards";
const IMPORTANT_SLIDES_STORAGE_KEY = "mechanicalExamImportantSlides";
const QUESTION_STATS_STORAGE_KEY = "mechanicalExamQuestionStats";
const QUESTIONS_CSV = "questions.csv";
const SLIDES_JSON = "slides.json";
const WEAK_TOPIC_RATE_LIMIT = 70;
const QUICK_REVIEW_QUESTION_LIMIT = 5;
const WEAKNESS_REASONS = [
  { key: "formula", label: "公式忘れ" },
  { key: "understanding", label: "理解不足" },
  { key: "unit", label: "単位・換算" },
  { key: "calculation", label: "計算ミス" },
  { key: "reading", label: "読み違い" },
  { key: "terminology", label: "用語・選択肢迷い" }
];
const WEAKNESS_FIELD_ORDER = [
  "材料力学",
  "機械力学",
  "熱工学",
  "流体工学",
  "制御工学",
  "工作法",
  "工業材料"
];
const FALLBACK_QUESTIONS = [
  {
    id: "C003",
    field: "制御・メカトロ",
    topic: "PID制御",
    level: "基礎",
    question: "I動作を強くしすぎた場合に起こりやすい現象はどれですか。",
    choices: ["定常偏差が必ず増える", "振動やオーバーシュートが起こりやすい", "比例帯が消える", "外乱に反応しなくなる"],
    answer: 2,
    explanation: "I動作は偏差の累積を補正しますが、強すぎると過補正になり振動しやすくなります。"
  },
  {
    id: "T003",
    field: "熱工学",
    topic: "熱力学変化",
    level: "基礎",
    question: "定積変化で0になるものとして適切なものはどれですか。",
    choices: ["境界仕事", "内部エネルギー変化", "温度変化", "圧力変化"],
    answer: 1,
    explanation: "定積変化では体積変化がないため、境界仕事は0になります。"
  },
  {
    id: "F003",
    field: "流体工学",
    topic: "レイノルズ数",
    level: "基礎",
    question: "レイノルズ数が表すものとして適切なものはどれですか。",
    choices: ["圧力と温度の比", "慣性力と粘性力の比", "熱量と仕事の比", "流量と密度の比"],
    answer: 2,
    explanation: "レイノルズ数は慣性力と粘性力の比を表す無次元数です。"
  }
];
const FALLBACK_SLIDES = [
  {
    id: "SLIDE_C001",
    field: "制御・メカトロ",
    topic: "PID制御",
    title: "PID制御：I動作の強い・弱い",
    description: "I動作の強弱とオーバーシュートの関係を確認するスライド",
    image: "slides/pid-i-action.png",
    summary: [
      "I動作は偏差の累積を見て補正する働き",
      "I動作が弱いと定常偏差が残りやすい",
      "I動作が強すぎるとオーバーシュートや振動が起きやすい",
      "試験では、I動作を強くしすぎると振動・ハンチングが起きやすいと覚える"
    ],
    relatedQuestionIds: ["C003", "C007"]
  },
  {
    id: "SLIDE_H001",
    field: "熱工学",
    topic: "熱力学変化",
    title: "定圧・定積・等温・断熱の違い",
    description: "代表的な熱力学変化で一定になる量と熱の出入りを整理するスライド",
    image: "slides/thermal-processes.png",
    summary: [
      "定圧変化は圧力が一定で、体積変化による仕事を考える",
      "定積変化は体積が一定で、境界仕事は0になる",
      "等温変化は温度が一定で、理想気体では内部エネルギー変化が0になる",
      "断熱変化は熱の出入りがなく、温度・圧力・体積が同時に変化する"
    ],
    relatedQuestionIds: ["T003", "T005", "T006"]
  },
  {
    id: "SLIDE_F001",
    field: "流体工学",
    topic: "レイノルズ数",
    title: "レイノルズ数：層流と乱流",
    description: "慣性力と粘性力の比から流れの状態を判断するスライド",
    image: "slides/reynolds-number.png",
    summary: [
      "レイノルズ数は慣性力と粘性力の比を表す無次元数",
      "値が小さいと粘性の影響が強く、層流になりやすい",
      "値が大きいと慣性の影響が強く、乱流になりやすい",
      "代表式 Re = ρVD / μ または Re = VD / ν を押さえる"
    ],
    relatedQuestionIds: ["F003", "F007", "F008"]
  }
];

let questions = [];
let slides = [];
let noteCards = [];
let importantSlideIds = new Set();
let currentSlide = null;
let currentNoteCard = null;
let slideViewMode = "official";
let editingNoteCardId = "";
let questionsLoadedFromFallback = false;
let slidesLoadedFromFallback = false;
let currentQuiz = [];
let currentIndex = 0;
let quizStartTime = 0;
let timerId = null;
let quizAnswers = [];
let reviewMode = false;
let quizMode = "normal";
let statsState = createDefaultStatsState();
let appInitialized = false;
let calculatorState = createCalculatorState();

const screens = {
  home: document.getElementById("homeScreen"),
  quickReviewEmpty: document.getElementById("quickReviewEmptyScreen"),
  weaknessReview: document.getElementById("weaknessReviewScreen"),
  quiz: document.getElementById("quizScreen"),
  result: document.getElementById("resultScreen"),
  slides: document.getElementById("slidesScreen"),
  noteForm: document.getElementById("noteFormScreen"),
  noteDetail: document.getElementById("noteDetailScreen"),
  slideDetail: document.getElementById("slideDetailScreen"),
  stats: document.getElementById("statsScreen")
};

const messageArea = document.getElementById("messageArea");
const fieldSelect = document.getElementById("fieldSelect");
const topicSelect = document.getElementById("topicSelect");
const slideFieldFilter = document.getElementById("slideFieldFilter");
const slideSearchInput = document.getElementById("slideSearchInput");
const slideList = document.getElementById("slideList");
const noteCardImportInput = document.getElementById("noteCardImportInput");
const noteCardForm = document.getElementById("noteCardForm");
const noteFieldSelect = document.getElementById("noteFieldSelect");
const noteStatusSelect = document.getElementById("noteStatusSelect");
const choicesArea = document.getElementById("choicesArea");
const feedbackArea = document.getElementById("feedbackArea");
const statusArea = document.getElementById("statusArea");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const historyImportInput = document.getElementById("historyImportInput");
let importMode = "merge";

window.addEventListener("error", (event) => {
  console.error("JavaScript error:", event.error || event.message);
  showMessage("JavaScriptエラーが発生しました。Consoleのエラー内容を確認してください。");
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  showMessage("データ読み込み中にエラーが発生しました。Consoleのエラー内容を確認してください。");
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function initApp() {
  if (appInitialized) {
    return;
  }
  appInitialized = true;

  try {
    bindEvents();
    setupFields();
    setupNoteFormFields();
    noteCards = loadNoteCards();
    importantSlideIds = loadImportantSlideIds();
    loadQuestions();
    loadSlides();
  } catch (error) {
    console.error(error);
    showMessage("アプリの初期化中にエラーが発生しました。script.jsとindex.htmlのID対応を確認してください。");
  }
}

function setupFields() {
  fieldSelect.innerHTML = FIELDS.map((field) => `<option value="${field}">${field}</option>`).join("");
  setupTopicFilter();
}

function setupNoteFormFields() {
  noteFieldSelect.innerHTML = FIELDS
    .filter((field) => field !== "全分野")
    .map((field) => `<option value="${field}">${field}</option>`)
    .join("");
}

function bindEvents() {
  addEvent("startQuizBtn", "click", startNormalQuiz);
  addEvent("startQuickReviewBtn", "click", startQuickReview);
  addEvent("reviewMistakesBtn", "click", showWeaknessReview);
  addEvent("showSlidesBtn", "click", showSlides);
  addEvent("showStatsBtn", "click", showStats);
  addEvent("showQuestionStatsBtn", "click", showQuestionStatsSummary);
  addEvent("toggleCalculatorBtn", "click", toggleCalculator);
  addEvent("closeCalculatorBtn", "click", closeCalculator);
  addEvent("calculatorKeys", "click", handleCalculatorKey);
  addElementEvent(fieldSelect, "fieldSelect", "change", setupTopicFilter);
  addEvent("homeFromResultBtn", "click", showHome);
  addEvent("homeFromQuickReviewEmptyBtn", "click", showHome);
  addEvent("homeFromWeaknessBtn", "click", showHome);
  addEvent("startImmediateReviewBtn", "click", () => startWeaknessReview("all"));
  addEvent("startFieldReviewBtn", "click", () => startWeaknessReview("field"));
  addEvent("startWrongOnlyReviewBtn", "click", () => startWeaknessReview("wrong"));
  addEvent("startUnsureOnlyReviewBtn", "click", () => startWeaknessReview("unsure"));
  addEvent("weaknessStatusFilter", "change", renderWeaknessQuestionList);
  addEvent("weaknessListFieldFilter", "change", renderWeaknessQuestionList);
  addEvent("homeFromSlidesBtn", "click", showHome);
  addEvent("backToSlidesBtn", "click", showSlides);
  addEvent("backToSlidesBottomBtn", "click", showSlides);
  addEvent("startRelatedQuizBtn", "click", startCurrentSlideQuiz);
  addEvent("toggleSlidePriorityBtn", "click", toggleCurrentSlidePriority);
  addEvent("slideImageButton", "click", openSlideZoom);
  addEvent("closeSlideZoomBtn", "click", closeSlideZoom);
  addEvent("slideZoomOverlay", "click", (event) => {
    if (event.target.id === "slideZoomOverlay") {
      closeSlideZoom();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSlideZoom();
    }
  });
  addElementEvent(slideFieldFilter, "slideFieldFilter", "change", renderSlideList);
  addElementEvent(slideSearchInput, "slideSearchInput", "input", renderSlideList);
  document.querySelectorAll("input[name='slideViewMode']").forEach((input) => {
    input.addEventListener("change", () => {
      slideViewMode = input.value;
      setupSlideFilters();
      renderSlideList();
    });
  });
  addEvent("addNoteCardBtn", "click", () => showNoteForm());
  addEvent("cancelNoteCardBtn", "click", showSlides);
  addEvent("cancelNoteCardBottomBtn", "click", showSlides);
  addEvent("deleteNoteCardBtn", "click", deleteEditingNoteCard);
  addEvent("backToNotesBtn", "click", showNotesList);
  addEvent("backToNotesBottomBtn", "click", showNotesList);
  addEvent("editNoteDetailBtn", "click", () => {
    if (currentNoteCard) {
      showNoteForm(currentNoteCard);
    }
  });
  addEvent("deleteNoteDetailBtn", "click", () => {
    if (currentNoteCard) {
      deleteNoteCard(currentNoteCard.id, false, true);
    }
  });
  addEvent("startNoteRelatedQuizBtn", "click", () => {
    if (currentNoteCard) {
      startQuestionIdQuiz(currentNoteCard.relatedQuestionIds, `${currentNoteCard.title}の関連問題`);
    }
  });
  addEvent("exportNoteCardsBtn", "click", exportNoteCards);
  addEvent("importNoteCardsBtn", "click", () => {
    noteCardImportInput.value = "";
    noteCardImportInput.click();
  });
  addElementEvent(noteCardImportInput, "noteCardImportInput", "change", importNoteCards);
  addElementEvent(noteCardForm, "noteCardForm", "submit", saveNoteCardFromForm);
  addEvent("reviewFromResultBtn", "click", showWeaknessReview);
  addEvent("retryQuickReviewBtn", "click", startQuickReview);
  addEvent("homeFromStatsBtn", "click", showHome);
  addEvent("resetHistoryBtn", "click", resetHistory);
  document.querySelectorAll("[data-stats-tab]").forEach((button) => {
    button.addEventListener("click", () => switchStatsTab(button.dataset.statsTab));
  });
  addEvent("showMoreWeaknessBtn", "click", () => showMoreStatsItems("weakness"));
  addEvent("showMoreRecentBtn", "click", () => showMoreStatsItems("recent"));
  addEvent("showMoreQuestionsBtn", "click", () => showMoreStatsItems("question"));
  addEvent("showMoreInsufficientBtn", "click", () => showMoreStatsItems("insufficient"));
  addEvent("reviewVisibleWeaknessBtn", "click", startVisibleWeaknessReview);
  addEvent("exportHistoryBtn", "click", exportHistory);
  addEvent("importMergeBtn", "click", () => chooseImportFile("merge"));
  addEvent("importReplaceBtn", "click", () => chooseImportFile("replace"));
  addElementEvent(historyImportInput, "historyImportInput", "change", importHistoryFromFile);
  addElementEvent(nextQuestionBtn, "nextQuestionBtn", "click", goNextQuestion);
}

function addEvent(id, eventName, handler) {
  addElementEvent(document.getElementById(id), id, eventName, handler);
}

function addElementEvent(element, label, eventName, handler) {
  if (!element) {
    console.error(`要素が見つからないためイベント登録をスキップしました: ${label}`);
    return;
  }
  element.addEventListener(eventName, handler);
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
        setupTopicFilter();
        hideMessage();
      }
    })
    .catch((error) => {
      console.error("questions.csvのfetch読み込みに失敗しました。XMLHttpRequestに切り替えます。", error);
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
        setupTopicFilter();
        hideMessage();
      }
      return;
    }
    console.error(`questions.csvを読み込めませんでした。status=${request.status}`);
    showCsvError();
  };
  request.onerror = () => {
    console.error("questions.csvのXMLHttpRequest読み込みに失敗しました。");
    showCsvError();
  };
  request.send();
}

function showCsvError() {
  questions = FALLBACK_QUESTIONS;
  questionsLoadedFromFallback = true;
  setupTopicFilter();
  showMessage("questions.csvを読み込めませんでした。ローカルで確認する場合は VS Code の Live Server などを使用してください。現在は画面確認用のサンプル問題で動作しています。");
}

function setupTopicFilter() {
  const selectedField = fieldSelect.value || "全分野";
  const currentValue = topicSelect.value || "全トピック";
  const source = selectedField === "全分野"
    ? questions
    : questions.filter((question) => question.field === selectedField);
  const topics = ["全トピック", ...new Set(source.map((question) => question.topic).filter(Boolean))];

  topicSelect.innerHTML = topics.map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join("");
  topicSelect.value = topics.includes(currentValue) ? currentValue : "全トピック";
}

function getQuestionsCsvUrl() {
  return getDataUrl(QUESTIONS_CSV);
}

function parseCsv(csvText) {
  const lines = csvText.replace(/\r/g, "").split("\n").filter((line) => line.trim() !== "");
  const header = lines.shift();
  if (!header) {
    return [];
  }

  // このCSVはExcel編集を優先し、半角カンマを本文に使わない前提でシンプルに分割します。
  const parsedQuestions = lines.map((line, index) => {
    const cols = line.split(",");
    if (cols.length !== 11) {
      console.error(`questions.csv ${index + 2}行目の列数が不正です。期待値=11 実際=${cols.length}`, line);
    }
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
  });
  const validQuestions = parsedQuestions.filter((item) => item.id && item.field && item.question && item.answer >= 1 && item.answer <= 4);
  if (validQuestions.length !== parsedQuestions.length) {
    console.error(`questions.csvに無効な行があります。有効=${validQuestions.length} 全体=${parsedQuestions.length}`);
  }
  return validQuestions;
}

function loadSlides() {
  fetch(getDataUrl(SLIDES_JSON), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("slides.jsonを取得できませんでした。");
      }
      return response.json();
    })
    .then((json) => {
      slides = normalizeSlides(json);
      slidesLoadedFromFallback = false;
      setupSlideFilters();
      renderSlideList();
    })
    .catch((error) => {
      console.error("slides.jsonの読み込みに失敗しました。フォールバックデータを使用します。", error);
      slides = normalizeSlides(FALLBACK_SLIDES);
      slidesLoadedFromFallback = true;
      setupSlideFilters();
      renderSlideList();
      showMessage("slides.jsonを読み込めませんでした。ローカルで確認する場合は VS Code の Live Server などを使用してください。現在は画面確認用のサンプルスライドで動作しています。");
    });
}

function getDataUrl(fileName) {
  if (window.location.protocol === "file:") {
    return fileName;
  }
  return `${fileName}?v=${Date.now()}`;
}

function normalizeSlides(rawSlides) {
  return (Array.isArray(rawSlides) ? rawSlides : [])
    .map((slide) => ({
      id: String(slide.id || ""),
      field: String(slide.field || "分野不明"),
      topic: String(slide.topic || "トピック不明"),
      title: String(slide.title || "無題のスライド"),
      description: String(slide.description || ""),
      image: String(slide.image || ""),
      priority: slide.priority === "high" ? "high" : "normal",
      summary: Array.isArray(slide.summary) ? slide.summary.map((item) => String(item)) : [],
      relatedQuestionIds: Array.isArray(slide.relatedQuestionIds)
        ? slide.relatedQuestionIds.map((id) => String(id)).filter(Boolean)
        : []
    }))
    .filter((slide) => slide.id);
}

function setupSlideFilters() {
  const source = slideViewMode === "notes" ? noteCards : slides;
  const fields = ["全分野", ...new Set(source.map((item) => item.field).filter(Boolean))];
  const currentValue = slideFieldFilter.value || "全分野";
  slideFieldFilter.innerHTML = fields.map((field) => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join("");
  slideFieldFilter.value = fields.includes(currentValue) ? currentValue : "全分野";
}

function showSlides() {
  stopTimer();
  renderSlideList();
  if (slidesLoadedFromFallback) {
    showMessage("slides.jsonを読み込めませんでした。ローカルで確認する場合は VS Code の Live Server などを使用してください。現在は画面確認用のサンプルスライドで動作しています。");
  } else {
    hideMessage();
  }
  showScreen("slides");
}

function renderSlideList() {
  const selectedField = slideFieldFilter.value || "全分野";
  const keyword = normalizeSearchText(slideSearchInput.value);
  document.getElementById("addNoteCardBtn").classList.toggle("compact-primary-btn", slideViewMode === "official");
  document.getElementById("addNoteCardBtn").classList.toggle("primary-btn", slideViewMode === "notes");
  document.querySelectorAll("input[name='slideViewMode']").forEach((input) => {
    input.checked = input.value === slideViewMode;
  });

  if (slideViewMode === "notes") {
    renderNoteCardList(selectedField, keyword);
    return;
  }

  const visibleSlides = slides.filter((slide) => {
    const matchesField = selectedField === "全分野" || slide.field === selectedField;
    const haystack = normalizeSearchText(`${slide.title} ${slide.field} ${slide.topic} ${slide.description}`);
    return matchesField && haystack.includes(keyword);
  });

  if (visibleSlides.length === 0) {
    slideList.innerHTML = `<p class="muted">条件に合うスライドはありません。</p>`;
    return;
  }

  slideList.innerHTML = visibleSlides.map((slide) => `
    <button class="slide-card${isImportantSlide(slide) ? " priority-high" : ""}" type="button" data-slide-id="${escapeHtml(slide.id)}">
      <span class="slide-card-heading">
        <span class="slide-card-title">${escapeHtml(slide.title)}</span>
        ${isImportantSlide(slide) ? '<span class="priority-label">要注意</span>' : ""}
      </span>
      <span class="slide-card-meta">${escapeHtml(slide.field)} / ${escapeHtml(slide.topic)}</span>
      <span class="slide-card-description">${escapeHtml(slide.description)}</span>
      <span class="slide-card-count">関連問題 ${slide.relatedQuestionIds.length}件</span>
    </button>
  `).join("");

  slideList.querySelectorAll("[data-slide-id]").forEach((button) => {
    button.addEventListener("click", () => showSlideDetail(button.dataset.slideId));
  });
}

function renderNoteCardList(selectedField, keyword) {
  const visibleNotes = noteCards.filter((note) => {
    const matchesField = selectedField === "全分野" || note.field === selectedField;
    const haystack = normalizeSearchText(`${note.title} ${note.field} ${note.topic} ${note.memo} ${note.understandingStatus}`);
    return matchesField && haystack.includes(keyword);
  });

  if (visibleNotes.length === 0) {
    slideList.innerHTML = `
      <div class="empty-state">
        <p class="muted">保存済みの要点カードはまだありません。</p>
        <button class="primary-btn" type="button" data-note-action="add">最初の要点カードを追加</button>
      </div>
    `;
    slideList.querySelector("[data-note-action='add']").addEventListener("click", () => showNoteForm());
    return;
  }

  slideList.innerHTML = visibleNotes.map((note) => `
    <article class="slide-card note-card">
      <div>
        <button class="note-open-btn" type="button" data-note-action="detail" data-note-id="${escapeHtml(note.id)}">${escapeHtml(note.title)}</button>
        <div class="slide-card-meta">${escapeHtml(note.field)} / ${escapeHtml(note.topic || "トピック未設定")}</div>
      </div>
      <p class="note-preview">${escapeHtml(truncateText(note.memo, 90))}</p>
      <div class="note-card-footer">
        <span class="note-status">${escapeHtml(getNoteStatus(note))}</span>
        <span class="slide-card-count">関連問題 ${escapeHtml(note.relatedQuestionIds.join(", ") || "未設定")}</span>
        <span class="slide-card-count">更新 ${escapeHtml(formatDateShort(note.updatedAt))}</span>
      </div>
      <div class="button-row note-card-buttons">
        <button class="compact-primary-btn" type="button" data-note-action="detail" data-note-id="${escapeHtml(note.id)}">詳細</button>
        <button class="compact-primary-btn" type="button" data-note-action="quiz" data-note-id="${escapeHtml(note.id)}" ${note.relatedQuestionIds.length === 0 ? "disabled" : ""}>関連問題を解く</button>
        <button type="button" data-note-action="edit" data-note-id="${escapeHtml(note.id)}">編集</button>
        <button class="danger-btn" type="button" data-note-action="delete" data-note-id="${escapeHtml(note.id)}">削除</button>
      </div>
    </article>
  `).join("");

  slideList.querySelectorAll("[data-note-action]").forEach((button) => {
    button.addEventListener("click", () => handleNoteCardAction(button.dataset.noteAction, button.dataset.noteId));
  });
}

function handleNoteCardAction(action, noteId) {
  const note = noteCards.find((item) => item.id === noteId);
  if (!note) {
    showMessage("要点カードが見つかりませんでした。");
    return;
  }

  if (action === "edit") {
    showNoteForm(note);
    return;
  }

  if (action === "detail") {
    showNoteDetail(noteId);
    return;
  }

  if (action === "delete") {
    deleteNoteCard(noteId);
    return;
  }

  if (action === "quiz") {
    startQuestionIdQuiz(note.relatedQuestionIds, `${note.title}の関連問題`);
  }
}

function showNoteForm(note = null, sourceQuestion = null) {
  editingNoteCardId = note?.id || "";
  const titleValue = note?.title || (sourceQuestion ? `${sourceQuestion.topic ? `【${sourceQuestion.topic}】` : `【${sourceQuestion.id}】`}の要点` : "");
  document.getElementById("noteFormTitle").textContent = note ? "要点カード編集" : "要点カード追加";
  document.getElementById("noteTitleInput").value = titleValue;
  if (note?.field && ![...noteFieldSelect.options].some((option) => option.value === note.field)) {
    noteFieldSelect.add(new Option(note.field, note.field));
  }
  noteFieldSelect.value = note?.field || sourceQuestion?.field || "制御・メカトロ";
  document.getElementById("noteTopicInput").value = note?.topic || sourceQuestion?.topic || "";
  document.getElementById("noteMemoInput").value = note?.memo || "";
  document.getElementById("noteRelatedIdsInput").value = (note?.relatedQuestionIds || (sourceQuestion ? [sourceQuestion.id] : [])).join(", ");
  noteStatusSelect.value = getNoteStatus(note) || (sourceQuestion ? "要復習" : "要復習");
  document.getElementById("deleteNoteCardBtn").classList.toggle("hidden", !note);
  renderNoteSource(sourceQuestion);
  hideMessage();
  showScreen("noteForm");
}

function renderNoteSource(question) {
  const panel = document.getElementById("noteSourcePanel");
  panel.classList.toggle("hidden", !question);
  if (!question) {
    return;
  }
  document.getElementById("noteSourceMeta").textContent = `${question.id} / ${question.field} / ${question.topic}`;
  document.getElementById("noteSourceQuestion").textContent = question.question;
  document.getElementById("noteSourceExplanation").textContent = `解説：${question.explanation}`;
}

function saveNoteCardFromForm(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const title = document.getElementById("noteTitleInput").value.trim();
  const field = noteFieldSelect.value;
  const topic = document.getElementById("noteTopicInput").value.trim();
  const memo = document.getElementById("noteMemoInput").value.trim();
  const relatedQuestionIds = parseQuestionIds(document.getElementById("noteRelatedIdsInput").value);
  const status = noteStatusSelect.value;

  if (!title) {
    showMessage("タイトルを入力してください。");
    return;
  }

  if (editingNoteCardId) {
    noteCards = noteCards.map((note) => note.id === editingNoteCardId
      ? { ...note, title, field, topic, memo, relatedQuestionIds, status, understandingStatus: status, updatedAt: now }
      : note);
  } else {
    noteCards.unshift({
      id: createNoteCardId(),
      title,
      field,
      topic,
      memo,
      relatedQuestionIds,
      status,
      understandingStatus: status,
      createdAt: now,
      updatedAt: now
    });
  }

  saveNoteCards(noteCards);
  slideViewMode = "notes";
  setupSlideFilters();
  showSlides();
  showMessage("要点カードを保存しました。");
}

function deleteEditingNoteCard() {
  if (!editingNoteCardId) {
    return;
  }
  deleteNoteCard(editingNoteCardId, true);
}

function deleteNoteCard(noteId, fromForm = false, fromDetail = false) {
  const note = noteCards.find((item) => item.id === noteId);
  if (!note) {
    return;
  }
  const ok = confirm(`「${note.title}」を削除します。よろしいですか？`);
  if (!ok) {
    return;
  }
  noteCards = noteCards.filter((item) => item.id !== noteId);
  saveNoteCards(noteCards);
  slideViewMode = "notes";
  setupSlideFilters();
  if (fromForm || fromDetail) {
    showSlides();
  } else {
    renderSlideList();
  }
  showMessage("要点カードを削除しました。");
}

function loadNoteCards() {
  try {
    return normalizeNoteCards(JSON.parse(localStorage.getItem(NOTE_CARDS_STORAGE_KEY)));
  } catch {
    return [];
  }
}

function saveNoteCards(cards) {
  localStorage.setItem(NOTE_CARDS_STORAGE_KEY, JSON.stringify(normalizeNoteCards(cards)));
}

function normalizeNoteCards(rawCards) {
  return (Array.isArray(rawCards) ? rawCards : [])
    .map((card) => ({
      id: String(card.id || createNoteCardId()),
      title: String(card.title || "無題の要点カード"),
      field: String(card.field || "分野不明"),
      topic: String(card.topic || ""),
      memo: String(card.memo || card.summary || ""),
      relatedQuestionIds: Array.isArray(card.relatedQuestionIds)
        ? card.relatedQuestionIds.map((id) => String(id)).filter(Boolean)
        : parseQuestionIds(card.relatedQuestionIds || ""),
      status: normalizeNoteStatus(card.status || card.understandingStatus),
      understandingStatus: normalizeNoteStatus(card.status || card.understandingStatus),
      createdAt: String(card.createdAt || new Date().toISOString()),
      updatedAt: String(card.updatedAt || card.createdAt || new Date().toISOString())
    }))
    .filter((card) => card.id && card.title);
}

function exportNoteCards() {
  const blob = new Blob([JSON.stringify(noteCards, null, 2)], { type: "application/json" });
  const today = new Date();
  const yyyymmdd = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `note-cards-${yyyymmdd}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  showMessage("要点カードをJSONファイルとしてエクスポートしました。");
}

function importNoteCards(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedCards = normalizeNoteCards(JSON.parse(reader.result));
      const merged = new Map(noteCards.map((card) => [card.id, card]));
      importedCards.forEach((card) => merged.set(card.id, card));
      noteCards = [...merged.values()].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      saveNoteCards(noteCards);
      slideViewMode = "notes";
      setupSlideFilters();
      renderSlideList();
      showMessage(`要点カードを${importedCards.length}件インポートしました。`);
    } catch {
      showMessage("要点カードのJSONを読み込めませんでした。エクスポートしたファイルか確認してください。");
    } finally {
      noteCardImportInput.value = "";
    }
  };
  reader.readAsText(file);
}

function parseQuestionIds(value) {
  if (Array.isArray(value)) {
    return value.map((id) => String(id).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[\s,、]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function createNoteCardId() {
  return `NOTE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNoteStatus(status) {
  const normalized = {
    "確認中": "要復習",
    "だいたいOK": "理解済み",
    "覚えた": "理解済み"
  }[status] || status;
  return ["未理解", "要復習", "理解済み"].includes(normalized) ? normalized : "要復習";
}

function getNoteStatus(note) {
  if (!note) {
    return "";
  }
  return normalizeNoteStatus(note.status || note.understandingStatus);
}

function showNotesList() {
  slideViewMode = "notes";
  setupSlideFilters();
  showSlides();
}

function showNoteDetail(noteId) {
  currentNoteCard = noteCards.find((note) => note.id === noteId);
  if (!currentNoteCard) {
    showMessage("要点カードが見つかりませんでした。");
    return;
  }

  document.getElementById("noteDetailTitle").textContent = currentNoteCard.title;
  document.getElementById("noteDetailField").textContent = currentNoteCard.field;
  document.getElementById("noteDetailTopic").textContent = currentNoteCard.topic || "トピック未設定";
  document.getElementById("noteDetailStatus").textContent = getNoteStatus(currentNoteCard);
  document.getElementById("noteDetailMemo").textContent = currentNoteCard.memo;
  document.getElementById("noteDetailUpdatedAt").textContent = `更新日：${formatDateTime(currentNoteCard.updatedAt)}`;
  renderRelatedQuestionButtons(
    document.getElementById("noteDetailRelatedQuestionIds"),
    currentNoteCard.relatedQuestionIds,
    `${currentNoteCard.title}の関連問題`
  );
  document.getElementById("startNoteRelatedQuizBtn").disabled = getExistingQuestionsByIds(currentNoteCard.relatedQuestionIds).length === 0;
  hideMessage();
  showScreen("noteDetail");
}

function showSlideDetail(slideId) {
  currentSlide = slides.find((slide) => slide.id === slideId);
  if (!currentSlide) {
    showMessage("スライドが見つかりませんでした。");
    return;
  }

  document.getElementById("slideDetailTitle").textContent = currentSlide.title;
  document.getElementById("slideDetailField").textContent = currentSlide.field;
  document.getElementById("slideDetailTopic").textContent = currentSlide.topic;
  renderSlidePriorityControls(currentSlide);
  renderSlideImage(currentSlide);
  renderSlideSummary(currentSlide);
  renderRelatedQuestionIds(currentSlide);

  document.getElementById("startRelatedQuizBtn").disabled = getExistingQuestionsByIds(currentSlide.relatedQuestionIds).length === 0;
  hideMessage();
  showScreen("slideDetail");
}

function loadImportantSlideIds() {
  try {
    const storedIds = JSON.parse(localStorage.getItem(IMPORTANT_SLIDES_STORAGE_KEY));
    if (!Array.isArray(storedIds)) {
      return new Set();
    }
    return new Set(storedIds.map((id) => String(id)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveImportantSlideIds() {
  localStorage.setItem(IMPORTANT_SLIDES_STORAGE_KEY, JSON.stringify([...importantSlideIds]));
}

function isImportantSlide(slide) {
  return Boolean(slide) && (slide.priority === "high" || importantSlideIds.has(slide.id));
}

function renderSlidePriorityControls(slide) {
  const isFixedPriority = slide.priority === "high";
  const isUserPriority = importantSlideIds.has(slide.id);
  const priorityLabel = document.getElementById("slideDetailPriority");
  const toggleButton = document.getElementById("toggleSlidePriorityBtn");

  priorityLabel.classList.toggle("hidden", !isImportantSlide(slide));
  toggleButton.disabled = isFixedPriority;
  toggleButton.classList.toggle("danger-btn", isUserPriority && !isFixedPriority);

  if (isFixedPriority) {
    toggleButton.textContent = "教材側で要注意設定済み";
  } else if (isUserPriority) {
    toggleButton.textContent = "要注意を解除";
  } else {
    toggleButton.textContent = "要注意にする";
  }
}

function toggleCurrentSlidePriority() {
  if (!currentSlide || currentSlide.priority === "high") {
    return;
  }

  if (importantSlideIds.has(currentSlide.id)) {
    importantSlideIds.delete(currentSlide.id);
  } else {
    importantSlideIds.add(currentSlide.id);
  }

  saveImportantSlideIds();
  renderSlidePriorityControls(currentSlide);
  renderSlideList();
}

function renderSlideImage(slide) {
  const image = document.getElementById("slideDetailImage");
  const imageButton = document.getElementById("slideImageButton");
  const error = document.getElementById("slideImageError");

  image.classList.add("hidden");
  image.removeAttribute("src");
  error.classList.add("hidden");
  error.textContent = "";
  imageButton.disabled = !slide.image;

  if (!slide.image) {
    error.textContent = "このスライドには画像が設定されていません。要点テキストで確認できます。";
    error.classList.remove("hidden");
    return;
  }

  image.alt = slide.title;
  image.onload = () => {
    image.classList.remove("hidden");
    error.classList.add("hidden");
    imageButton.disabled = false;
  };
  image.onerror = () => {
    image.classList.add("hidden");
    imageButton.disabled = true;
    error.textContent = "画像を読み込めませんでした。slidesフォルダ内のファイル名を確認してください。要点テキストはこのまま確認できます。";
    error.classList.remove("hidden");
  };
  image.src = slide.image;
}

function renderSlideSummary(slide) {
  const summaryList = document.getElementById("slideSummaryList");
  if (slide.summary.length === 0) {
    summaryList.innerHTML = `<li>要点テキストはまだ登録されていません。</li>`;
    return;
  }
  summaryList.innerHTML = slide.summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderRelatedQuestionIds(slide) {
  const relatedArea = document.getElementById("relatedQuestionIds");
  renderRelatedQuestionButtons(relatedArea, slide.relatedQuestionIds, `${slide.title}の関連問題`);
}

function startCurrentSlideQuiz() {
  if (!currentSlide) {
    return;
  }
  startQuestionIdQuiz(currentSlide.relatedQuestionIds, `${currentSlide.title}の関連問題`);
}

function startQuestionIdQuiz(questionIds, label) {
  const idSet = new Set(questionIds || []);
  const pool = questions.filter((question) => idSet.has(question.id));
  const missingIds = (questionIds || []).filter((id) => !questions.some((question) => question.id === id));

  if (questions.length === 0) {
    showMessage("問題データが読み込まれていません。questions.csvを確認してください。");
    return;
  }

  if (pool.length === 0) {
    showMessage("関連問題が見つかりません。");
    return;
  }

  reviewMode = true;
  startQuiz(pool);
  if (missingIds.length > 0) {
    showMessage(`一部の関連問題が見つかりませんでした：${missingIds.join(", ")}`);
  }
}

function renderRelatedQuestionButtons(container, questionIds, label) {
  const ids = parseQuestionIds(questionIds);
  if (ids.length === 0) {
    container.innerHTML = `<p class="muted">関連問題IDは未設定です。</p>`;
    return;
  }

  const existingIds = ids.filter((id) => questions.some((question) => question.id === id));
  container.innerHTML = `
    ${ids.map((id) => {
      const exists = existingIds.includes(id);
      return `<button class="related-question-btn ${exists ? "" : "missing-question"}" type="button" data-question-id="${escapeHtml(id)}">${escapeHtml(id)}を解く</button>`;
    }).join("")}
    <button class="related-question-btn primary-btn" type="button" data-question-id="__all">関連問題をまとめて解く</button>
  `;

  container.querySelectorAll("[data-question-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const questionId = button.dataset.questionId;
      const targetIds = questionId === "__all" ? ids : [questionId];
      startQuestionIdQuiz(targetIds, label);
    });
  });
}

function getExistingQuestionsByIds(questionIds) {
  const idSet = new Set(parseQuestionIds(questionIds));
  return questions.filter((question) => idSet.has(question.id));
}

function openSlideZoom() {
  const image = document.getElementById("slideDetailImage");
  if (!currentSlide || !currentSlide.image || image.classList.contains("hidden")) {
    return;
  }

  const zoomImage = document.getElementById("slideZoomImage");
  zoomImage.src = currentSlide.image;
  zoomImage.alt = currentSlide.title;
  document.getElementById("slideZoomOverlay").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeSlideZoom() {
  document.getElementById("slideZoomOverlay").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function startNormalQuiz() {
  reviewMode = false;
  quizMode = "normal";
  const selectedField = fieldSelect.value;
  const selectedTopic = topicSelect.value || "全トピック";
  const count = getSelectedCount();
  const pool = questions.filter((question) => {
    const matchesField = selectedField === "全分野" || question.field === selectedField;
    const matchesTopic = selectedTopic === "全トピック" || question.topic === selectedTopic;
    return matchesField && matchesTopic;
  });

  if (questions.length === 0) {
    showMessage("問題データが読み込まれていません。questions.csvを確認してください。");
    return;
  }

  if (pool.length === 0) {
    const targetLabel = selectedTopic === "全トピック" ? selectedField : `${selectedField} / ${selectedTopic}`;
    showMessage(`${targetLabel}の問題がquestions.csvに登録されていません。`);
    return;
  }

  startQuiz(selectNormalQuizQuestions(pool, count));
}

function startQuickReview() {
  if (questions.length === 0) {
    showMessage("問題データがまだ読み込まれていません。少し待ってからもう一度お試しください。");
    return;
  }

  const selectedQuestions = selectQuickReviewQuestions(getWeaknessReviewItems());
  if (selectedQuestions.length === 0) {
    hideMessage();
    showScreen("quickReviewEmpty");
    return;
  }

  reviewMode = true;
  quizMode = "quickReview";
  startQuiz(selectedQuestions, "quickReview");
}

function selectQuickReviewQuestions(items) {
  const today = getLocalDateKey();
  return items
    .filter((item) => isQuickReviewEligible(item.stat, today))
    .map((item) => ({ ...item, randomOrder: Math.random() }))
    .sort((a, b) => {
      const dueDiff = Number(isRetentionReviewDue(b.stat, today))
        - Number(isRetentionReviewDue(a.stat, today));
      if (dueDiff !== 0) {
        return dueDiff;
      }

      const statusDiff = Number(b.stat.status === "wrong") - Number(a.stat.status === "wrong");
      if (statusDiff !== 0) {
        return statusDiff;
      }

      const countDiff = (b.stat.wrongCount + b.stat.unsureCount)
        - (a.stat.wrongCount + a.stat.unsureCount);
      if (countDiff !== 0) {
        return countDiff;
      }

      // 同じ状態・同じ弱点回数なら、古い復習日を優先しつつ同日内は偏りを防ぎます。
      const dateDiff = getQuickReviewDateBucket(a.stat.lastAnsweredAt)
        - getQuickReviewDateBucket(b.stat.lastAnsweredAt);
      return dateDiff || a.randomOrder - b.randomOrder;
    })
    .slice(0, QUICK_REVIEW_QUESTION_LIMIT)
    .map((item) => item.question);
}

function getQuickReviewDateBucket(value) {
  const timestamp = getQuestionStatTimestamp(value);
  return timestamp === 0 ? 0 : Math.floor(timestamp / 86400000);
}

function showWeaknessReview() {
  const listItems = getWeaknessListItems();
  const reviewItems = listItems.filter((item) => item.question);
  const wrongCount = listItems.filter((item) => item.stat.status === "wrong").length;
  const unsureCount = listItems.filter((item) => item.stat.status === "unsure").length;
  const fields = getWeaknessFields(listItems);
  const reviewFields = getWeaknessFields(reviewItems);
  const fieldSelect = document.getElementById("weaknessFieldSelect");

  document.getElementById("weaknessReviewSummary").innerHTML = `
    <span>間違えた問題 <strong>${wrongCount}問</strong></span>
    <span>迷った問題 <strong>${unsureCount}問</strong></span>
    <span>弱点対象合計 <strong>${listItems.length}問</strong></span>
  `;
  fieldSelect.innerHTML = reviewFields.length > 0
    ? reviewFields.map((field) => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`).join("")
    : `<option value="">対象なし</option>`;
  setupWeaknessListFieldFilter(fields);
  renderWeaknessFieldSummary(listItems);
  renderWeaknessQuestionList();

  document.getElementById("startImmediateReviewBtn").disabled = reviewItems.length === 0;
  document.getElementById("startFieldReviewBtn").disabled = reviewFields.length === 0;
  document.getElementById("startWrongOnlyReviewBtn").disabled = wrongCount === 0;
  document.getElementById("startUnsureOnlyReviewBtn").disabled = unsureCount === 0;
  hideMessage();
  showScreen("weaknessReview");
}

function getWeaknessReviewItems() {
  return getWeaknessListItems().filter((item) => item.question);
}

function getWeaknessListItems() {
  const stats = loadQuestionStats();
  return Object.values(stats)
    .filter((stat) => stat.status === "wrong" || stat.status === "unsure")
    .map((stat) => ({
      stat,
      question: questions.find((question) => question.id === stat.questionId) || null,
      field: getWeaknessItemField(stat)
    }))
    .sort((a, b) => {
      const fieldDiff = getWeaknessFieldRank(a.field) - getWeaknessFieldRank(b.field)
        || a.field.localeCompare(b.field, "ja");
      if (fieldDiff !== 0) {
        return fieldDiff;
      }
      const statusDiff = Number(b.stat.status === "wrong") - Number(a.stat.status === "wrong");
      if (statusDiff !== 0) {
        return statusDiff;
      }
      const dateDiff = getQuestionStatTimestamp(b.stat.lastAnsweredAt) - getQuestionStatTimestamp(a.stat.lastAnsweredAt);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return (b.stat.wrongCount + b.stat.unsureCount) - (a.stat.wrongCount + a.stat.unsureCount);
    });
}

function getQuestionStatTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getWeaknessItemField(stat) {
  const question = questions.find((item) => item.id === stat.questionId);
  return String(question?.field || stat.field || "未分類").trim() || "未分類";
}

function getWeaknessFieldRank(field) {
  const index = WEAKNESS_FIELD_ORDER.indexOf(field);
  if (index >= 0) {
    return index;
  }
  return field === "未分類" ? WEAKNESS_FIELD_ORDER.length + 2 : WEAKNESS_FIELD_ORDER.length + 1;
}

function getWeaknessFields(items) {
  return [...new Set(items.map((item) => item.field))]
    .sort((a, b) => getWeaknessFieldRank(a) - getWeaknessFieldRank(b) || a.localeCompare(b, "ja"));
}

function setupWeaknessListFieldFilter(fields) {
  const filter = document.getElementById("weaknessListFieldFilter");
  const currentValue = filter.value || "all";
  filter.innerHTML = [
    `<option value="all">全分野</option>`,
    ...fields.map((field) => `<option value="${escapeHtml(field)}">${escapeHtml(field)}</option>`)
  ].join("");
  filter.value = [...filter.options].some((option) => option.value === currentValue) ? currentValue : "all";
}

function renderWeaknessFieldSummary(items) {
  const container = document.getElementById("weaknessFieldSummary");
  const fields = getWeaknessFields(items);
  if (fields.length === 0) {
    container.innerHTML = `<p class="muted">現在、復習対象の問題はありません。</p>`;
    return;
  }
  container.innerHTML = fields.map((field) => {
    const fieldItems = items.filter((item) => item.field === field);
    const wrongCount = fieldItems.filter((item) => item.stat.status === "wrong").length;
    const unsureCount = fieldItems.filter((item) => item.stat.status === "unsure").length;
    return `
      <div class="weakness-field-summary-row">
        <strong>${escapeHtml(field)}</strong>
        <span>間違い ${wrongCount}問 / 迷い ${unsureCount}問</span>
      </div>
    `;
  }).join("");
}

function renderWeaknessQuestionList() {
  const container = document.getElementById("weaknessQuestionList");
  const statusFilter = document.getElementById("weaknessStatusFilter").value || "all";
  const fieldFilter = document.getElementById("weaknessListFieldFilter").value || "all";
  const visibleItems = getWeaknessListItems().filter((item) => {
    const matchesStatus = statusFilter === "all" || item.stat.status === statusFilter;
    const matchesField = fieldFilter === "all" || item.field === fieldFilter;
    return matchesStatus && matchesField;
  });

  if (visibleItems.length === 0) {
    container.innerHTML = `<p class="muted">現在、復習対象の問題はありません。</p>`;
    return;
  }

  const groups = getWeaknessFields(visibleItems);
  container.innerHTML = groups.map((field) => `
    <section class="weakness-question-group">
      <h4>${escapeHtml(field)}</h4>
      <div class="weakness-question-group-list">
        ${visibleItems
          .filter((item) => item.field === field)
          .map(renderWeaknessQuestionItem)
          .join("")}
      </div>
    </section>
  `).join("");
}

function renderWeaknessQuestionItem(item) {
  const questionText = item.question
    ? truncateText(item.question.title || item.question.question || item.stat.questionId, 30)
    : item.stat.questionId;
  const today = getLocalDateKey();
  const isWaitingForRetention = item.stat.consecutiveCorrect === 1;
  const isRetentionDue = isRetentionReviewDue(item.stat, today);
  const statusLabel = isWaitingForRetention
    ? isRetentionDue ? "定着確認可能" : "定着確認待ち"
    : item.stat.status === "wrong" ? "間違えた" : "迷った";
  const retentionProgress = isWaitingForRetention
    ? isRetentionDue
      ? `<p class="retention-list-progress">定着確認できます　もう一度正解で弱点卒業</p>`
      : `<p class="retention-list-progress">次回：${escapeHtml(formatLocalDate(item.stat.nextReviewAt))}以降</p>`
    : "";
  return `
    <article class="weakness-question-item ${item.stat.status}">
      <div class="weakness-question-title">
        <strong>${escapeHtml(item.stat.questionId)}</strong>
        <span class="weakness-status-label">${statusLabel}</span>
      </div>
      <p>${escapeHtml(questionText)}</p>
      <div class="weakness-question-counts">
        <span>間違い ${item.stat.wrongCount}回</span>
        <span>迷い ${item.stat.unsureCount}回</span>
        <span>正解 ${item.stat.correctCount}回</span>
      </div>
      ${retentionProgress}
      <time datetime="${escapeHtml(item.stat.lastAnsweredAt)}">最終回答：${escapeHtml(formatDateTime(item.stat.lastAnsweredAt))}</time>
    </article>
  `;
}

function startWeaknessReview(mode) {
  const selectedField = document.getElementById("weaknessFieldSelect").value;
  const pool = getWeaknessReviewItems()
    .filter((item) => {
      if (mode === "wrong") {
        return item.stat.status === "wrong";
      }
      if (mode === "unsure") {
        return item.stat.status === "unsure";
      }
      if (mode === "field") {
        return item.field === selectedField;
      }
      return true;
    })
    .map((item) => item.question);

  if (pool.length === 0) {
    showMessage("選択した条件に該当する復習問題がありません。");
    return;
  }

  reviewMode = true;
  startQuiz(pool);
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

function startQuiz(selectedQuestions, mode = "normal") {
  if (!selectedQuestions || selectedQuestions.length === 0) {
    showMessage("出題できる問題がありません。条件や関連問題IDを確認してください。");
    return;
  }
  quizMode = mode;
  hideMessage();
  if (questionsLoadedFromFallback) {
    showMessage("questions.csvを読み込めなかったため、画面確認用のサンプル問題で出題しています。");
  }
  currentQuiz = selectedQuestions;
  currentIndex = 0;
  quizAnswers = [];
  quizStartTime = Date.now();
  document.getElementById("timerText").classList.toggle("hidden", quizMode === "quickReview");
  if (quizMode === "quickReview") {
    stopTimer();
  } else {
    startTimer();
  }
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
  closeCalculator();
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

function createCalculatorState() {
  return {
    tokens: [],
    current: "",
    justEvaluated: false,
    error: false
  };
}

function toggleCalculator() {
  const panel = document.getElementById("calculatorPanel");
  const shouldOpen = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !shouldOpen);
  document.getElementById("toggleCalculatorBtn").setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) {
    updateCalculatorDisplay();
  }
}

function closeCalculator() {
  const panel = document.getElementById("calculatorPanel");
  if (!panel) {
    return;
  }
  panel.classList.add("hidden");
  document.getElementById("toggleCalculatorBtn").setAttribute("aria-expanded", "false");
}

function handleCalculatorKey(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button.dataset.calculatorValue !== undefined) {
    appendCalculatorValue(button.dataset.calculatorValue);
  } else if (button.dataset.calculatorOperator) {
    appendCalculatorOperator(button.dataset.calculatorOperator);
  } else if (button.dataset.calculatorAction) {
    runCalculatorAction(button.dataset.calculatorAction);
  }
  updateCalculatorDisplay();
}

function appendCalculatorValue(value) {
  if (calculatorState.error || calculatorState.justEvaluated) {
    calculatorState = createCalculatorState();
  }
  if (value === ".") {
    if (calculatorState.current.includes(".")) {
      return;
    }
    calculatorState.current = calculatorState.current || "0";
  }
  if (calculatorState.current === "0" && value !== ".") {
    calculatorState.current = value;
  } else {
    calculatorState.current += value;
  }
}

function appendCalculatorOperator(operator) {
  if (calculatorState.error) {
    return;
  }
  if (calculatorState.justEvaluated) {
    calculatorState.justEvaluated = false;
  }
  if (calculatorState.current !== "") {
    calculatorState.tokens.push(Number(calculatorState.current));
    calculatorState.current = "";
  }
  if (calculatorState.tokens.length === 0) {
    if (operator === "-") {
      calculatorState.current = "-";
    }
    return;
  }
  if (typeof calculatorState.tokens[calculatorState.tokens.length - 1] === "string") {
    calculatorState.tokens[calculatorState.tokens.length - 1] = operator;
  } else {
    calculatorState.tokens.push(operator);
  }
}

function runCalculatorAction(action) {
  if (action === "clear") {
    calculatorState = createCalculatorState();
    return;
  }
  if (action === "backspace") {
    if (calculatorState.error || calculatorState.justEvaluated) {
      calculatorState = createCalculatorState();
    } else {
      calculatorState.current = calculatorState.current.slice(0, -1);
    }
    return;
  }
  if (action === "pi") {
    if (calculatorState.error || calculatorState.justEvaluated) {
      calculatorState = createCalculatorState();
    }
    calculatorState.current = String(Math.PI);
    return;
  }
  if (action === "sqrt" || action === "square") {
    applyCalculatorUnaryAction(action);
    return;
  }
  if (action === "equals") {
    calculateCalculatorResult();
  }
}

function applyCalculatorUnaryAction(action) {
  if (calculatorState.error) {
    return;
  }
  let value;
  if (calculatorState.current !== "") {
    value = Number(calculatorState.current);
  } else if (calculatorState.justEvaluated && calculatorState.tokens.length === 1) {
    value = calculatorState.tokens[0];
  } else {
    return;
  }
  const result = action === "sqrt" ? Math.sqrt(value) : value ** 2;
  if (!Number.isFinite(result)) {
    setCalculatorError();
    return;
  }
  calculatorState.tokens = [];
  calculatorState.current = formatCalculatorNumber(result);
  calculatorState.justEvaluated = false;
}

function calculateCalculatorResult() {
  if (calculatorState.error) {
    return;
  }
  const tokens = [...calculatorState.tokens];
  if (calculatorState.current !== "") {
    tokens.push(Number(calculatorState.current));
  }
  if (tokens.length === 0 || typeof tokens[tokens.length - 1] === "string") {
    setCalculatorError();
    return;
  }
  const result = evaluateCalculatorTokens(tokens);
  if (!Number.isFinite(result)) {
    setCalculatorError();
    return;
  }
  calculatorState.tokens = [result];
  calculatorState.current = "";
  calculatorState.justEvaluated = true;
}

function evaluateCalculatorTokens(tokens) {
  const values = [...tokens];
  for (let index = 1; index < values.length - 1;) {
    const operator = values[index];
    if (operator !== "*" && operator !== "/") {
      index += 2;
      continue;
    }
    const left = values[index - 1];
    const right = values[index + 1];
    if (operator === "/" && right === 0) {
      return NaN;
    }
    values.splice(index - 1, 3, operator === "*" ? left * right : left / right);
    index = 1;
  }
  let result = values[0];
  for (let index = 1; index < values.length; index += 2) {
    result = values[index] === "+" ? result + values[index + 1] : result - values[index + 1];
  }
  return result;
}

function setCalculatorError() {
  calculatorState = createCalculatorState();
  calculatorState.error = true;
}

function formatCalculatorNumber(value) {
  return String(Number(value.toPrecision(12)));
}

function updateCalculatorDisplay() {
  const display = document.getElementById("calculatorDisplay");
  if (calculatorState.error) {
    display.textContent = "エラー";
    return;
  }
  if (calculatorState.justEvaluated && calculatorState.tokens.length === 1) {
    display.textContent = formatCalculatorNumber(calculatorState.tokens[0]);
    return;
  }
  const expression = [...calculatorState.tokens, calculatorState.current]
    .filter((item) => item !== "")
    .map((item) => ({ "*": "×", "/": "÷", "-": "−", "+": "＋" }[item] || item))
    .join(" ");
  display.textContent = expression || "0";
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

  const questionResult = recordQuestionResult(question, isCorrect);
  quizAnswers.push({ question, selectedNumber, isCorrect, status: "", unsureRecorded: false });

  feedbackArea.className = `feedback ${isCorrect ? "correct" : "wrong"}`;
  feedbackArea.innerHTML = `
    <strong>${isCorrect ? "✅ 正解" : "不正解です"}</strong>
    ${renderRetentionFeedback(questionResult)}
    <div>正解：${question.answer}. ${question.choices[question.answer - 1]}</div>
    <div>${question.explanation}</div>
    <div class="feedback-actions">
      <button class="unsure-review-btn" type="button" data-mark-unsure>迷ったので復習</button>
      <button class="note-link-btn" type="button" data-add-note-from-current>この問題の要点カードを追加</button>
      <span class="unsure-review-message hidden" data-unsure-message aria-live="polite"></span>
    </div>
    <div data-weakness-reason-host></div>
  `;
  feedbackArea.querySelector("[data-add-note-from-current]").addEventListener("click", () => showNoteForm(null, question));
  feedbackArea.querySelector("[data-mark-unsure]").addEventListener("click", (event) => {
    const latestAnswer = quizAnswers[quizAnswers.length - 1];
    if (!latestAnswer || latestAnswer.question.id !== question.id || latestAnswer.unsureRecorded) {
      return;
    }

    recordQuestionUnsure(question);
    latestAnswer.unsureRecorded = true;
    feedbackArea.querySelector("[data-retention-feedback]")?.remove();
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "復習対象に登録済み";
    const message = feedbackArea.querySelector("[data-unsure-message]");
    message.textContent = "復習対象に登録しました";
    message.classList.remove("hidden");
    renderWeaknessReasonPrompt(question);
  });
  if (!isCorrect) {
    renderWeaknessReasonPrompt(question);
  }
  renderStatusButtons(question, isCorrect, selectedNumber);
}

function renderWeaknessReasonPrompt(question) {
  const host = feedbackArea.querySelector("[data-weakness-reason-host]");
  if (!host) {
    return;
  }

  host.innerHTML = `
    <section class="weakness-reason-area" aria-label="弱点理由の登録">
      <p class="weakness-reason-title">今回の原因は？</p>
      <div class="weakness-reason-buttons">
        ${WEAKNESS_REASONS.map((reason) => `
          <button type="button" data-weakness-reason="${reason.key}">${reason.label}</button>
        `).join("")}
      </div>
      <button class="weakness-reason-skip" type="button" data-weakness-reason-skip>今回は付けない</button>
      <p class="weakness-reason-message hidden" data-weakness-reason-message aria-live="polite"></p>
    </section>
  `;

  const registration = createWeaknessReasonRegistration(question);
  host.querySelectorAll("[data-weakness-reason]").forEach((button) => {
    button.addEventListener("click", () => {
      const reason = WEAKNESS_REASONS.find((item) => item.key === button.dataset.weaknessReason);
      if (!reason || !registration.select(reason.key)) {
        return;
      }
      completeWeaknessReasonPrompt(host, `弱点理由：${reason.label} を記録しました`);
    });
  });

  host.querySelector("[data-weakness-reason-skip]").addEventListener("click", () => {
    if (!registration.skip()) {
      return;
    }
    completeWeaknessReasonPrompt(host, "今回は弱点理由を付けませんでした");
  });
}

function createWeaknessReasonRegistration(question) {
  let handled = false;
  return {
    select(reasonKey) {
      if (handled || !WEAKNESS_REASONS.some((reason) => reason.key === reasonKey)) {
        return false;
      }
      handled = recordQuestionReason(question, reasonKey);
      return handled;
    },
    skip() {
      if (handled) {
        return false;
      }
      handled = true;
      return true;
    }
  };
}

function completeWeaknessReasonPrompt(host, messageText) {
  host.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });
  host.querySelector(".weakness-reason-buttons")?.classList.add("hidden");
  host.querySelector("[data-weakness-reason-skip]")?.classList.add("hidden");
  const message = host.querySelector("[data-weakness-reason-message]");
  message.textContent = messageText;
  message.classList.remove("hidden");
}

function loadQuestionStats() {
  try {
    return normalizeQuestionStats(JSON.parse(localStorage.getItem(QUESTION_STATS_STORAGE_KEY)));
  } catch {
    return {};
  }
}

function saveQuestionStats(stats) {
  localStorage.setItem(QUESTION_STATS_STORAGE_KEY, JSON.stringify(normalizeQuestionStats(stats)));
}

function normalizeQuestionStats(rawStats) {
  const normalized = {};
  if (!rawStats || typeof rawStats !== "object" || Array.isArray(rawStats)) {
    return normalized;
  }

  Object.entries(rawStats).forEach(([key, item]) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const questionId = String(item.questionId || "").trim();
    if (!questionId) {
      return;
    }
    const status = ["wrong", "unsure", "correct", "mastered"].includes(item.status)
      ? item.status
      : "";
    normalized[questionId] = {
      questionId,
      field: String(item.field || "未分類"),
      status,
      wrongCount: normalizeQuestionStatCount(item.wrongCount),
      unsureCount: normalizeQuestionStatCount(item.unsureCount),
      correctCount: normalizeQuestionStatCount(item.correctCount),
      consecutiveCorrect: normalizeQuestionStatCount(item.consecutiveCorrect),
      lastCorrectAt: normalizeQuestionStatDateTime(item.lastCorrectAt),
      nextReviewAt: normalizeQuestionStatDate(item.nextReviewAt),
      lastAnsweredAt: String(item.lastAnsweredAt || ""),
      reasonCounts: normalizeReasonCounts(item.reasonCounts)
    };

    const stat = normalized[questionId];
    if (stat.consecutiveCorrect === 1 && !stat.nextReviewAt) {
      const inferredFrom = stat.lastCorrectAt || stat.lastAnsweredAt;
      const inferredDate = parseStoredDate(inferredFrom);
      if (inferredDate) {
        stat.lastCorrectAt ||= inferredDate.toISOString();
        stat.nextReviewAt = getNextLocalDateKey(inferredDate);
      }
    }
  });
  return normalized;
}

function normalizeQuestionStatCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

function createDefaultReasonCounts() {
  return Object.fromEntries(WEAKNESS_REASONS.map((reason) => [reason.key, 0]));
}

function normalizeReasonCounts(rawReasonCounts) {
  const normalized = createDefaultReasonCounts();
  if (!rawReasonCounts || typeof rawReasonCounts !== "object" || Array.isArray(rawReasonCounts)) {
    return normalized;
  }
  WEAKNESS_REASONS.forEach((reason) => {
    normalized[reason.key] = normalizeQuestionStatCount(rawReasonCounts[reason.key]);
  });
  return normalized;
}

function normalizeQuestionStatDateTime(value) {
  return parseStoredDate(value) ? String(value) : null;
}

function normalizeQuestionStatDate(value) {
  const date = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function parseStoredDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextLocalDateKey(date = new Date()) {
  const nextDate = new Date(date.getTime());
  nextDate.setDate(nextDate.getDate() + 1);
  return getLocalDateKey(nextDate);
}

function isRetentionReviewDue(stat, today = getLocalDateKey()) {
  return stat?.consecutiveCorrect === 1
    && Boolean(normalizeQuestionStatDate(stat.nextReviewAt))
    && today >= stat.nextReviewAt;
}

function isQuickReviewEligible(stat, today = getLocalDateKey()) {
  if (stat?.status !== "wrong" && stat?.status !== "unsure") {
    return false;
  }
  if (stat.consecutiveCorrect === 0) {
    return true;
  }
  return isRetentionReviewDue(stat, today);
}

function formatLocalDate(value) {
  const date = normalizeQuestionStatDate(value);
  if (!date) {
    return "日付未設定";
  }
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function getOrCreateQuestionStat(stats, question) {
  const questionId = String(question?.id || "").trim();
  if (!stats[questionId]) {
    stats[questionId] = {
      questionId,
      field: String(question?.field || "未分類"),
      status: "",
      wrongCount: 0,
      unsureCount: 0,
      correctCount: 0,
      consecutiveCorrect: 0,
      lastCorrectAt: null,
      nextReviewAt: null,
      lastAnsweredAt: "",
      reasonCounts: createDefaultReasonCounts()
    };
  }
  stats[questionId].field = String(question?.field || stats[questionId].field || "未分類");
  stats[questionId].reasonCounts = normalizeReasonCounts(stats[questionId].reasonCounts);
  return stats[questionId];
}

function recordQuestionReason(question, reasonKey) {
  if (!question?.id || !WEAKNESS_REASONS.some((reason) => reason.key === reasonKey)) {
    return false;
  }
  const stats = loadQuestionStats();
  const stat = getOrCreateQuestionStat(stats, question);
  stat.reasonCounts[reasonKey] += 1;
  saveQuestionStats(stats);
  return true;
}

function recordQuestionResult(question, isCorrect) {
  if (!question?.id) {
    return null;
  }
  const stats = loadQuestionStats();
  const stat = getOrCreateQuestionStat(stats, question);
  const answeredAt = new Date();
  const result = applyQuestionResult(stat, isCorrect, answeredAt);

  stat.lastAnsweredAt = answeredAt.toISOString();
  saveQuestionStats(stats);
  return result;
}

function applyQuestionResult(stat, isCorrect, answeredAt = new Date()) {
  const previousStatus = stat.status;
  const wasWeakness = previousStatus === "wrong" || previousStatus === "unsure";
  const today = getLocalDateKey(answeredAt);
  let retentionState = "";

  if (isCorrect) {
    stat.correctCount += 1;
    if (wasWeakness) {
      if (isRetentionReviewDue(stat, today)) {
        stat.consecutiveCorrect = 2;
        stat.status = "mastered";
        retentionState = "mastered";
      } else if (stat.consecutiveCorrect !== 1 || !normalizeQuestionStatDate(stat.nextReviewAt)) {
        stat.consecutiveCorrect = 1;
        stat.lastCorrectAt = answeredAt.toISOString();
        stat.nextReviewAt = getNextLocalDateKey(answeredAt);
        retentionState = "scheduled";
      } else {
        retentionState = "waiting";
      }
    } else if (!stat.status) {
      stat.status = "correct";
    }
  } else {
    stat.wrongCount += 1;
    stat.consecutiveCorrect = 0;
    stat.lastCorrectAt = null;
    stat.nextReviewAt = null;
    stat.status = "wrong";
  }

  return {
    previousStatus,
    status: stat.status,
    consecutiveCorrect: stat.consecutiveCorrect,
    weaknessCorrect: isCorrect && wasWeakness,
    nextReviewAt: stat.nextReviewAt,
    retentionState
  };
}

function renderRetentionFeedback(result) {
  if (!result?.weaknessCorrect) {
    return "";
  }
  if (result.status === "mastered") {
    return `
      <div class="retention-feedback mastered" data-retention-feedback>
        <strong>この問題は定着しました</strong>
        <span>弱点復習から卒業しました</span>
      </div>
    `;
  }
  return `
    <div class="retention-feedback confirming" data-retention-feedback>
      <strong>${result.retentionState === "waiting" ? "今日は定着確認済みです" : "1回目の定着確認OK"}</strong>
      <span>次回は${escapeHtml(formatLocalDate(result.nextReviewAt))}以降に再確認します</span>
    </div>
  `;
}

function recordQuestionUnsure(question) {
  if (!question?.id) {
    return;
  }
  const stats = loadQuestionStats();
  const stat = getOrCreateQuestionStat(stats, question);
  applyQuestionUnsure(stat);
  stat.lastAnsweredAt = new Date().toISOString();
  saveQuestionStats(stats);
}

function applyQuestionUnsure(stat) {
  stat.unsureCount += 1;
  stat.consecutiveCorrect = 0;
  stat.lastCorrectAt = null;
  stat.nextReviewAt = null;
  if (stat.status !== "wrong") {
    stat.status = "unsure";
  }
}

function showQuestionStatsSummary() {
  const stats = Object.values(loadQuestionStats());
  const wrongCount = stats.filter((stat) => stat.status === "wrong").length;
  const unsureCount = stats.filter((stat) => stat.status === "unsure").length;
  const correctCount = stats.filter((stat) => stat.correctCount > 0).length;
  showMessage(`間違えた問題：${wrongCount}問 / 迷った問題：${unsureCount}問 / 正解記録あり：${correctCount}問`);
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

  const isQuickReview = quizMode === "quickReview";
  document.getElementById("resultTitle").textContent = isQuickReview ? "5分復習 完了" : "結果";
  document.getElementById("standardResultSummary").classList.toggle("hidden", isQuickReview);
  document.getElementById("quickReviewResultSummary").classList.toggle("hidden", !isQuickReview);
  document.getElementById("reviewFromResultBtn").classList.toggle("hidden", isQuickReview);
  document.getElementById("retryQuickReviewBtn").classList.toggle("hidden", !isQuickReview);

  if (isQuickReview) {
    document.getElementById("quickReviewResultTotal").textContent = `${total}問`;
    document.getElementById("quickReviewResultCorrect").textContent = `${correct}問`;
    document.getElementById("quickReviewResultWrong").textContent = `${wrongAnswers.length}問`;
  }

  document.getElementById("resultScore").textContent = `${correct} / ${total}`;
  document.getElementById("resultRate").textContent = formatRate(correct, total);
  document.getElementById("resultTime").textContent = formatTime(elapsedSeconds);
  renderWrongList(wrongAnswers);
  document.getElementById("reviewFromResultBtn").disabled = getWeaknessReviewItems().length === 0;

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
      <button class="note-link-btn" type="button" data-add-note-question-id="${escapeHtml(question.id)}">この問題の要点カードを追加</button>
    </div>
  `).join("");
  wrongList.querySelectorAll("[data-add-note-question-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = questions.find((item) => item.id === button.dataset.addNoteQuestionId);
      if (question) {
        showNoteForm(null, question);
      }
    });
  });
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

function formatDateShort(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "不明";
  }
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function truncateText(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLowerCase();
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
  if (screenName !== "quiz") {
    closeCalculator();
  }
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
