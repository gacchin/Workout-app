// 記録はブラウザの localStorage に保存する
const STORAGE_KEY = "workout-records";
const EXERCISE_STORAGE_KEY = "workout-exercises";

const exerciseForm = document.getElementById("exercise-form");
const newExerciseInput = document.getElementById("new-exercise");
const registeredExerciseList = document.getElementById("registered-exercises");
const form = document.getElementById("record-form");
const dateInput = document.getElementById("date");
const exerciseInput = document.getElementById("exercise");
const weightInput = document.getElementById("weight");
const repsInput = document.getElementById("reps");
const memoInput = document.getElementById("memo");
const exerciseList = document.getElementById("exercise-list");
const graphExercise = document.getElementById("graph-exercise");
const graphWeight = document.getElementById("graph-weight");
const graphEmpty = document.getElementById("graph-empty");
const historyList = document.getElementById("history");
const historyEmpty = document.getElementById("history-empty");

let records = loadRecords();
let registeredExercises = loadExercises();
let chart = null;

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function loadExercises() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXERCISE_STORAGE_KEY)) || [];
    return Array.isArray(saved)
      ? uniqueSorted(saved.filter((name) => typeof name === "string").map((name) => name.trim()).filter(Boolean))
      : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveExercises() {
  localStorage.setItem(EXERCISE_STORAGE_KEY, JSON.stringify(registeredExercises));
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function uniqueSorted(values, compare) {
  return [...new Set(values)].sort(compare);
}

// ---- 種目登録 ----
exerciseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = newExerciseInput.value.trim();
  if (!name || registeredExercises.includes(name)) return;

  registeredExercises.push(name);
  registeredExercises = uniqueSorted(registeredExercises);
  saveExercises();
  newExerciseInput.value = "";
  renderExerciseList();
  renderRegisteredExercises();
});

function renderRegisteredExercises() {
  registeredExerciseList.innerHTML = "";
  for (const name of registeredExercises) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = name;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "削除";
    del.addEventListener("click", () => {
      registeredExercises = registeredExercises.filter((exercise) => exercise !== name);
      saveExercises();
      renderExerciseList();
      renderRegisteredExercises();
    });

    li.append(label, del);
    registeredExerciseList.appendChild(li);
  }
}

// ---- 入力 ----
form.addEventListener("submit", (e) => {
  e.preventDefault();
  records.push({
    id: Date.now(),
    date: dateInput.value,
    exercise: exerciseInput.value.trim(),
    weight: Number(weightInput.value),
    reps: Number(repsInput.value),
    memo: memoInput.value.trim(),
  });
  saveRecords();

  // 同じ種目・重量で続けて入力しやすいよう、Rep数とメモだけクリアする
  repsInput.value = "";
  memoInput.value = "";
  repsInput.focus();

  render(exerciseInput.value.trim(), Number(weightInput.value));
});

// ---- 種目の候補 ----
function renderExerciseList() {
  const exercises = uniqueSorted([...registeredExercises, ...records.map((r) => r.exercise)]);
  exerciseList.innerHTML = "";
  for (const name of exercises) {
    const option = document.createElement("option");
    option.value = name;
    exerciseList.appendChild(option);
  }
}

// ---- グラフ ----
function renderGraphSelectors(preferExercise, preferWeight) {
  const exercises = uniqueSorted(records.map((r) => r.exercise));
  const currentExercise = preferExercise ?? graphExercise.value;

  graphExercise.innerHTML = "";
  for (const name of exercises) {
    graphExercise.add(new Option(name, name));
  }
  if (exercises.includes(currentExercise)) {
    graphExercise.value = currentExercise;
  }

  renderWeightSelector(preferWeight);
}

function renderWeightSelector(preferWeight) {
  const weights = uniqueSorted(
    records.filter((r) => r.exercise === graphExercise.value).map((r) => r.weight),
    (a, b) => a - b
  );
  const currentWeight = preferWeight ?? Number(graphWeight.value);

  graphWeight.innerHTML = "";
  for (const w of weights) {
    graphWeight.add(new Option(`${w} kg`, w));
  }
  if (weights.includes(currentWeight)) {
    graphWeight.value = currentWeight;
  }
}

function renderChart() {
  const exercise = graphExercise.value;
  const weight = Number(graphWeight.value);
  const matched = records.filter((r) => r.exercise === exercise && r.weight === weight);

  // 同じ日に複数セットある場合は、その日の最大Rep数を表示する
  const maxRepsByDate = {};
  for (const r of matched) {
    maxRepsByDate[r.date] = Math.max(maxRepsByDate[r.date] ?? 0, r.reps);
  }
  const dates = Object.keys(maxRepsByDate).sort();
  const reps = dates.map((d) => maxRepsByDate[d]);

  graphEmpty.hidden = dates.length > 0;

  if (chart) chart.destroy();
  if (dates.length === 0) return;

  chart = new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: `${exercise} ${weight}kg の Rep数`,
          data: reps,
          borderColor: "#e4572e",
          backgroundColor: "#e4572e",
          tension: 0.2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Rep数" } },
        x: { title: { display: true, text: "日付" } },
      },
    },
  });
}

graphExercise.addEventListener("change", () => {
  renderWeightSelector();
  renderChart();
});
graphWeight.addEventListener("change", renderChart);

// ---- 履歴 ----
function renderHistory() {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  historyList.innerHTML = "";
  historyEmpty.hidden = sorted.length > 0;

  for (const r of sorted) {
    const li = document.createElement("li");

    const info = document.createElement("div");
    const main = document.createElement("div");
    main.className = "history-main";
    main.textContent = `${r.exercise}  ${r.weight}kg × ${r.reps}回`;
    const sub = document.createElement("div");
    sub.className = "history-sub";
    sub.textContent = r.memo ? `${r.date}\n${r.memo}` : r.date;
    info.append(main, sub);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "削除";
    del.addEventListener("click", () => {
      if (!confirm("この記録を削除しますか？")) return;
      records = records.filter((x) => x.id !== r.id);
      saveRecords();
      render();
    });

    li.append(info, del);
    historyList.appendChild(li);
  }
}

// ---- 全体の再描画 ----
function render(preferExercise, preferWeight) {
  renderExerciseList();
  renderRegisteredExercises();
  renderGraphSelectors(preferExercise, preferWeight);
  renderChart();
  renderHistory();
}

dateInput.value = today();
render();
