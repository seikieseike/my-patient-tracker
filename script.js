const inputText = document.getElementById("inputText");
const summaryLength = document.getElementById("summaryLength");
const summarizeButton = document.getElementById("summarizeButton");
const result = document.getElementById("result");
const historyList = document.getElementById("historyList");

const historyRecords = [];

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHistory() {
  if (historyRecords.length === 0) {
    historyList.innerHTML = '<p class="empty-history">目前還沒有紀錄。</p>';
    return;
  }

  historyList.innerHTML = historyRecords
    .map(
      (record, index) => `
        <article class="history-item">
          <div class="history-item-header">
            <h3>紀錄</h3>
            <button class="delete-history-btn" data-index="${index}">刪除</button>
          </div>
          <p><strong>原文：</strong>${escapeHtml(record.originalText)}</p>
          <p><strong>摘要：</strong>${escapeHtml(record.summary)}</p>
        </article>
      `
    )
    .join("");
}

historyList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (!target.classList.contains("delete-history-btn")) return;

  const index = Number(target.dataset.index);
  if (Number.isNaN(index)) return;

  historyRecords.splice(index, 1);
  renderHistory();
});

summarizeButton.addEventListener("click", async () => {
  const text = inputText.value.trim();

  if (!text) {
    result.textContent = "請先輸入文字。";
    return;
  }

  summarizeButton.disabled = true;
  summarizeButton.textContent = "摘要中...";
  result.textContent = "正在整理重點...";

  try {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        length: summaryLength.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      result.textContent = data.error || "發生錯誤，請稍後再試。";
      return;
    }

    result.textContent = data.summary;
    historyRecords.unshift({
      originalText: text,
      summary: data.summary
    });
    renderHistory();
  } catch (error) {
    result.textContent = "無法連線到伺服器，請確認程式有啟動。";
  } finally {
    summarizeButton.disabled = false;
    summarizeButton.textContent = "摘要";
  }
});
