// =========================================================
// 1. CẤU HÌNH TELEGRAM BOT & TÙY CHỌN ĐỒNG BỘ FIREBASE
// =========================================================
const CONFIG = {
  telegramBotToken: "DIEN_TOKEN_BOT_CUA_BAN_VAO_DAY".trim(), // Ví dụ: "7123456789:AAH..."
  telegramChatId: "6713370589",
  // Nếu muốn đồng bộ dữ liệu chung giữa nhiều người dùng, điền URL Firebase Realtime Database:
  // Ví dụ: "https://sua-kun-247-default-rtdb.asia-southeast1.firebasedatabase.app"
  firebaseDbUrl: ""
};

const STORAGE_KEY = "sua_kun_cho_ban_state_v1";

const DEFAULT_REGIONS = [
  { id: "biendao", name: "Biển Đảo", label: "🏝️ Biển Đảo & Hải Đảo", count: 35200, goal: 50000 },
  { id: "taybac", name: "Tây Bắc", label: "⛰️ Vùng Cao Tây Bắc", count: 41800, goal: 50000 },
  { id: "taynguyen", name: "Tây Nguyên", label: "🌲 Đại Ngàn Tây Nguyên", count: 26950, goal: 40000 },
  { id: "mientrung", name: "Miền Trung", label: "🌊 Miền Trung Khó Khăn", count: 24500, goal: 40000 }
];

const DEFAULT_RECENT = [
  {
    fullname: "Trần Minh Anh",
    region: "Biển Đảo",
    message: "Gửi thật nhiều yêu thương và hộp sữa mát lành đến các bạn nhỏ hải đảo!",
    time: "Vừa xong"
  },
  {
    fullname: "Lê Hoàng Nam",
    region: "Tây Bắc",
    message: "Chúc các em vùng cao luôn khỏe mạnh, đến trường thật vui mỗi ngày.",
    time: "5 phút trước"
  }
];

// =========================================================
// 2. QUẢN LÝ STATE & LƯU TRỮ
// =========================================================
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        regions: structuredClone(DEFAULT_REGIONS),
        recent: structuredClone(DEFAULT_RECENT),
        totalVotes: 0
      };
    }
    const parsed = JSON.parse(raw);
    return {
      regions: Array.isArray(parsed.regions) && parsed.regions.length ? parsed.regions : structuredClone(DEFAULT_REGIONS),
      recent: Array.isArray(parsed.recent) ? parsed.recent : structuredClone(DEFAULT_RECENT),
      totalVotes: Number(parsed.totalVotes) || 0
    };
  } catch (err) {
    console.warn("Không đọc được localStorage, dùng dữ liệu mặc định:", err);
    return {
      regions: structuredClone(DEFAULT_REGIONS),
      recent: structuredClone(DEFAULT_RECENT),
      totalVotes: 0
    };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Không lưu được localStorage:", err);
  }
}

let state = loadState();
let lastSubmittedData = null;

// DOM Elements
const regionListEl = document.getElementById("region-list");
const recentListEl = document.getElementById("recent-list");
const totalMilkEl = document.getElementById("total-milk");
const totalVotesEl = document.getElementById("total-votes");
const resetDemoBtn = document.getElementById("reset-demo-btn");

const form = document.getElementById("kun-form");
const fullnameInput = document.getElementById("fullname");
const phoneInput = document.getElementById("phone");
const regionSelect = document.getElementById("region");
const msgInput = document.getElementById("message");
const agreeShareCheckbox = document.getElementById("agree-share");
const charNum = document.getElementById("char-num");
const statusMsg = document.getElementById("status-msg");
const submitBtn = document.getElementById("submit-btn");

const modal = document.getElementById("postcard-modal");
const closeModal = document.getElementById("close-modal");
const canvas = document.getElementById("postcard-canvas");
const downloadBtn = document.getElementById("download-btn");
const copyCaptionBtn = document.getElementById("copy-caption-btn");
const copyFeedback = document.getElementById("copy-feedback");

// =========================================================
// 3. RENDER GIAO DIỆN TIẾN ĐỘ & LỜI NHẮN GẦN ĐÂY
// =========================================================
function renderRegions() {
  const sorted = [...state.regions].sort((a, b) => (b.count / b.goal) - (a.count / a.goal));

  regionListEl.innerHTML = sorted
    .map((item, idx) => {
      const percent = Math.min((item.count / item.goal) * 100, 100);
      const rankClass = idx === 0 ? "rank-badge top-1" : "rank-badge";
      return `
        <div class="region-item" data-region="${escapeHtml(item.name)}">
          <div class="region-head">
            <span>
              <span class="${rankClass}">#${idx + 1}</span>
              ${escapeHtml(item.label)}
            </span>
            <span class="count">
              <b>${item.count.toLocaleString("vi-VN")}</b> / ${item.goal.toLocaleString("vi-VN")} hộp (${percent.toFixed(1)}%)
            </span>
          </div>
          <div class="bar">
            <div class="fill" style="width: ${percent.toFixed(1)}%"></div>
          </div>
        </div>
      `;
    })
    .join("");

  const totalMilk = state.regions.reduce((sum, r) => sum + r.count, 0);
  totalMilkEl.textContent = totalMilk.toLocaleString("vi-VN");
  totalVotesEl.textContent = state.totalVotes.toLocaleString("vi-VN");
}

function renderRecent() {
  if (!state.recent.length) {
    recentListEl.innerHTML = `<li class="recent-item">Chưa có lời nhắn công khai nào. Hãy là người đầu tiên gửi lời nhắn!</li>`;
    return;
  }

  recentListEl.innerHTML = state.recent
    .slice(0, 8)
    .map(
      (entry) => `
        <li class="recent-item">
          <div class="recent-top">
            <span class="recent-author">${escapeHtml(entry.fullname)}</span>
            <span class="recent-region">${escapeHtml(entry.region)}</span>
          </div>
          <p class="recent-msg">"${escapeHtml(entry.message)}"</p>
          <span class="recent-time">${escapeHtml(entry.time)}</span>
        </li>
      `
    )
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// =========================================================
// 4. GỬI DỮ LIỆU VỀ TELEGRAM & FIREBASE (TÙY CHỌN)
// =========================================================
async function sendToTelegram(data) {
  const token = CONFIG.telegramBotToken;
  if (!token || token === "DIEN_TOKEN_BOT_CUA_BAN_VAO_DAY") {
    throw new Error("Chưa cấu hình telegramBotToken trong script.js");
  }

  const text = [
    "🥛 *CÓ LƯỢT BÌNH CHỌN SỮA KUN MỚI*",
    `👤 *Họ tên:* ${data.fullname}`,
    `📞 *SĐT:* ${data.phone}`,
    `📍 *Vùng miền:* ${data.region}`,
    `💌 *Lời nhắn:* ${data.message}`,
    `⏰ *Thời gian:* ${new Date().toLocaleString("vi-VN")}`
  ].join("\n");

  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CONFIG.telegramChatId,
      text,
      parse_mode: "Markdown"
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Telegram HTTP ${response.status}: ${errText}`);
  }
}

async function syncToFirebase(data) {
  const baseUrl = (CONFIG.firebaseDbUrl || "").replace(/\/+$/, "");
  if (!baseUrl) return;

  await fetch(`${baseUrl}/submissions.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullname: data.fullname,
      phone: data.phone,
      region: data.region,
      message: data.message,
      createdAt: Date.now()
    })
  });
}

// =========================================================
// 5. VẼ THIỆP CHỨNG NHẬN PNG TRÊN CANVAS
// =========================================================
function generatePostcard({ fullname, region, message }) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // Nền xanh KUN
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#0077e6");
  grad.addColorStop(1, "#003b80");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Vòng trang trí nhẹ
  ctx.fillStyle = "rgba(255, 204, 0, 0.14)";
  ctx.beginPath();
  ctx.arc(80, 75, 110, 0, Math.PI * 2);
  ctx.arc(w - 80, h - 75, 130, 0, Math.PI * 2);
  ctx.fill();

  // Thẻ trắng trung tâm
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(40, 40, w - 80, h - 80, 28);
  ctx.fill();

  // Viền vàng
  ctx.strokeStyle = "#ffcc00";
  ctx.lineWidth = 7;
  ctx.stroke();

  // Badge đầu thiệp
  ctx.fillStyle = "#ff6b00";
  ctx.font = "900 24px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CHỨNG NHẬN ĐỒNG HÀNH • SỮA KUN CHO BẠN", w / 2, 102);

  // Tên người tham gia
  ctx.fillStyle = "#0055b8";
  ctx.font = "900 38px Nunito, sans-serif";
  ctx.fillText(fullname.toUpperCase(), w / 2, 162);

  // Vùng miền
  ctx.fillStyle = "#334155";
  ctx.font = "700 22px Nunito, sans-serif";
  ctx.fillText(`Đã gửi lời nhắn & góp sữa đến trẻ em: ${region}`, w / 2, 206);

  // Khung lời nhắn
  ctx.fillStyle = "#f0f7ff";
  ctx.beginPath();
  ctx.roundRect(88, 236, w - 176, 178, 18);
  ctx.fill();

  // Nội dung lời nhắn xuống dòng tự động
  ctx.fillStyle = "#1e293b";
  ctx.font = "italic 700 23px Nunito, sans-serif";
  wrapText(ctx, `"${message}"`, w / 2, 286, w - 220, 34);

  // Hashtag & thương hiệu chân thiệp
  ctx.fillStyle = "#0066cc";
  ctx.font = "900 24px Nunito, sans-serif";
  ctx.fillText("#SuaKUNChoBan  •  LOF International Dairy Products", w / 2, 466);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[i] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

// =========================================================
// 6. SỰ KIỆN FORM, MODAL & NÚT TẢI / SAO CHÉP
// =========================================================
msgInput.addEventListener("input", () => {
  charNum.textContent = String(msgInput.value.length);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullname = fullnameInput.value.trim();
  const phone = phoneInput.value.trim();
  const region = regionSelect.value;
  const message = msgInput.value.trim();
  const allowPublic = agreeShareCheckbox.checked;

  if (!fullname) {
    statusMsg.style.color = "#dc2626";
    statusMsg.textContent = "Vui lòng nhập họ và tên của bạn.";
    fullnameInput.focus();
    return;
  }

  if (!/^[0-9]{9,11}$/.test(phone)) {
    statusMsg.style.color = "#dc2626";
    statusMsg.textContent = "Số điện thoại cần gồm 9 đến 11 chữ số.";
    phoneInput.focus();
    return;
  }

  if (!message) {
    statusMsg.style.color = "#dc2626";
    statusMsg.textContent = "Vui lòng nhập lời nhắn gửi yêu thương.";
    msgInput.focus();
    return;
  }

  submitBtn.disabled = true;
  statusMsg.style.color = "#0066cc";
  statusMsg.textContent = "Đang gửi thông tin và tạo thiệp...";

  const payload = { fullname, phone, region, message };
  lastSubmittedData = payload;

  // Cập nhật số liệu & danh sách lời nhắn gần đây
  const targetRegion = state.regions.find((r) => r.name === region);
  if (targetRegion) {
    targetRegion.count += 1;
  }
  state.totalVotes += 1;

  if (allowPublic) {
    state.recent.unshift({
      fullname,
      region,
      message,
      time: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " hôm nay"
    });
  }

  saveState();
  renderRegions();
  renderRecent();

  try {
    await Promise.all([sendToTelegram(payload), syncToFirebase(payload)]);
    statusMsg.style.color = "#16a34a";
    statusMsg.textContent = "Gửi thành công! Thiệp chứng nhận của bạn đã sẵn sàng.";
  } catch (err) {
    console.error("Lỗi gửi dữ liệu:", err);
    statusMsg.style.color = "#d97706";
    statusMsg.textContent = "Đã tạo thiệp & cập nhật tiến độ (kiểm tra lại Token Telegram nếu chưa thấy tin nhắn).";
  }

  copyFeedback.textContent = "";
  generatePostcard(payload);
  modal.classList.add("active");

  submitBtn.disabled = false;
  form.reset();
  agreeShareCheckbox.checked = true;
  charNum.textContent = "0";
});

resetDemoBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = {
    regions: structuredClone(DEFAULT_REGIONS),
    recent: structuredClone(DEFAULT_RECENT),
    totalVotes: 0
  };
  renderRegions();
  renderRecent();
  statusMsg.style.color = "#0066cc";
  statusMsg.textContent = "Đã khôi phục số liệu mặc định trên trình duyệt.";
});

closeModal.addEventListener("click", () => modal.classList.remove("active"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("active");
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "Thiep-Sua-KUN-Cho-Ban.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

copyCaptionBtn.addEventListener("click", async () => {
  const caption = lastSubmittedData
    ? `Mình vừa gửi lời nhắn & đồng hành cùng Sữa KUN đến trẻ em ${lastSubmittedData.region}: "${lastSubmittedData.message}" #SuaKUNChoBan`
    : `Cùng KUN gửi trao sữa dinh dưỡng đến trẻ em vùng khó khăn! #SuaKUNChoBan`;

  try {
    await navigator.clipboard.writeText(caption);
    copyFeedback.textContent = "Đã sao chép caption + #SuaKUNChoBan!";
  } catch {
    copyFeedback.textContent = caption;
  }
});

// Khởi tạo lần đầu
renderRegions();
renderRecent();
