const EXAMPLES = [
  `今天早上 8 點半，我在台北市忠孝東路四段直行，前方突然有車緊急煞車，我來不及反應，追撞到對方後車廂。雙方車輛都有損壞，我的車頭保險桿嚴重凹陷，對方車輛後保桿受損。事故已報警，警察有到場處理，雙方也有互留資料。我有投保乙式車體險和第三人責任險，對方也有保險。`,
  `昨天下午在百貨公司地下停車場停車，下車後發現有人刮到我的右側車門，留下一條明顯的刮痕和凹陷。對方已經離開，沒有留下任何聯絡方式。停車場說有監視器但畫面不清楚。我有投保甲式車體險，不確定停車場的賠償責任怎麼算。`,
  `昨晚 11 點，我在路口等紅燈直行後，被一輛闖紅燈的機車從右側撞上，我的右前車門凹陷。機車騎士當場跌倒，說左腳有點痛但可以站立，我有立即叫救護車。警察來有做筆錄，闖紅燈事實清楚。我有投保第三人責任險，機車騎士有傷勢，想了解後續可能的賠償責任。`
];

const textarea = document.getElementById('description');
const analyzeBtn = document.getElementById('analyzeBtn');
const btnText = document.getElementById('btnText');
const btnLoading = document.getElementById('btnLoading');
const resultSection = document.getElementById('resultSection');
const resultEl = document.getElementById('result');

function fillExample(index) {
  textarea.value = EXAMPLES[index];
  textarea.focus();
}

function setLoading(loading) {
  analyzeBtn.disabled = loading;
  btnText.classList.toggle('hidden', loading);
  btnLoading.classList.toggle('hidden', !loading);
}

// Convert basic markdown to HTML for display
function markdownToHtml(text) {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup]|<li|<hr)(.+)$/gm, (m) => m.trim() ? m : '')
    .trim();
}

async function analyze() {
  const description = textarea.value.trim();

  if (description.length < 10) {
    textarea.focus();
    textarea.style.borderColor = '#ef4444';
    setTimeout(() => { textarea.style.borderColor = ''; }, 2000);
    return;
  }

  setLoading(true);
  resultSection.classList.remove('hidden');
  resultEl.innerHTML = '<span class="cursor"></span>';

  let fullText = '';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });

    if (!response.ok) {
      const err = await response.json();
      if (response.status === 429) {
        resultEl.innerHTML = `
          <div style="text-align:center; padding: 2rem;">
            <div style="font-size:2.5rem; margin-bottom:1rem;">⏳</div>
            <p style="font-size:1.1rem; font-weight:bold; color:#b45309;">使用次數已達上限</p>
            <p style="color:#92400e; margin-top:0.5rem;">每小時最多可查詢 10 次，請稍後再試。</p>
          </div>`;
        setLoading(false);
        return;
      }
      throw new Error(err.error || '伺服器錯誤');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            fullText += parsed.text;
            resultEl.innerHTML = markdownToHtml(fullText) + '<span class="cursor"></span>';
            resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } catch (e) {
          if (e.message !== 'Unexpected end of JSON input') throw e;
        }
      }
    }

    // Final render without cursor
    resultEl.innerHTML = markdownToHtml(fullText);

  } catch (err) {
    resultEl.innerHTML = `<p style="color:#ef4444">❌ ${err.message}</p>`;
  } finally {
    setLoading(false);
  }
}

function copyResult() {
  const text = resultEl.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = '✅ 已複製';
    setTimeout(() => { btn.textContent = '📋 複製結果'; }, 2000);
  });
}

// Character counter
const charCount = document.getElementById('charCount');
textarea.addEventListener('input', () => {
  const len = textarea.value.length;
  charCount.textContent = len;
  charCount.style.color = len < 10 ? '#ef4444' : len > 1000 ? '#ef4444' : '#6b7280';
});

// Allow Ctrl+Enter to submit
textarea.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') analyze();
});
