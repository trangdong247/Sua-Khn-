// ===== CẤU HÌNH GỬI MÃ VỀ ZALO SAU 60 GIÂY =====
const ZALO_60S_CONFIG = {
  // Điền URL webhook/API trung gian nếu có hệ thống gửi tin nhắn Zalo OA/ZNS
  WEBHOOK_URL: "",
  // Tự động mở liên kết Zalo chứa mã xác nhận khi đếm ngược 60 giây kết thúc
  AUTO_OPEN_ZALO_AT_60S: true,
  ENABLED: true
};

let generatedOtp = "";
let countdownSeconds = 60;
let countdownTimer = null;
let otpReadyForInput = false;
let lastCompletedReceipt = null;
let latestZaloOtpMessage = "";

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

function buildZaloOtpMessage({ fullName, phone, region, otp, time }) {
  return [
    "[SỮA KUN CHO BẠN] Mã xác nhận phiếu (sau 60s)",
    `Họ và tên: ${fullName}`,
    `Số điện thoại: ${phone}`,
    `Vùng miền: ${region}`,
    `Mã xác nhận: ${otp}`,
    `Thời điểm cấp mã: ${time}`
  ].join("\n");
}

function buildZaloCompletedMessage({ code, fullName, phone, region, otp, nowStr }) {
  return [
    "[SỮA KUN CHO BẠN] Phiếu đã hoàn tất",
    `Mã phiếu: ${code}`,
    `Họ và tên: ${fullName}`,
    `Số điện thoại: ${phone}`,
    `Vùng miền: ${region}`,
    `Mã xác nhận đã dùng: ${otp}`,
    `Thời gian hoàn tất: ${nowStr}`
  ].join("\n");
}

function triggerZaloShareUrl(messageText) {
  const url = `https://zalo.me/share?text=${encodeURIComponent(messageText)}`;
  const win = window.open(url, "_blank", "noopener");
  const linkEl = document.getElementById("zaloOtpLink");
  if (linkEl) {
    linkEl.href = url;
    linkEl.classList.remove("hidden");
  }
  return win;
}

async function dispatchOtpToZaloAfter60s(payload) {
  const messageText = buildZaloOtpMessage(payload);
  latestZaloOtpMessage = messageText;

  if (!ZALO_60S_CONFIG.ENABLED) return;

  if (ZALO_60S_CONFIG.WEBHOOK_URL) {
    try {
      await fetch(ZALO_60S_CONFIG.WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "otp_after_60s",
          channel: "zalo",
          text: messageText,
          data: payload
        })
      });
    } catch (err) {
      console.error("Lỗi gửi webhook Zalo:", err);
    }
  }

  if (ZALO_60S_CONFIG.AUTO_OPEN_ZALO_AT_60S) {
    triggerZaloShareUrl(messageText);
  }
}

function handleSendOtp(event) {
  event.preventDefault();
  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phoneNumber").value.trim().replace(/\s+/g, "");
  const region = document.getElementById("ticketRegion").value;
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
  start60sWaitBeforeZaloOtp(fullName, phone, region);
}

function start60sWaitBeforeZaloOtp(fullNameVal, phoneVal, regionVal) {
  clearInterval(countdownTimer);
  generatedOtp = "";
  otpReadyForInput = false;
  countdownSeconds = 60;

  const fullName = fullNameVal || document.getElementById("fullName").value.trim();
  const phone = phoneVal || document.getElementById("phoneNumber").value.trim().replace(/\s+/g, "");
  const region = regionVal || document.getElementById("ticketRegion").value;

  const statusEl = document.getElementById("otpWaitStatus");
  const codeEl = document.getElementById("demoOtpCode");
  const otpInput = document.getElementById("otpInput");
  const verifyBtn = document.getElementById("verifyBtn");
  const resendBtn = document.getElementById("resendBtn");
  const zaloLink = document.getElementById("zaloOtpLink");

  if (statusEl) {
    statusEl.textContent = "Đang chờ đủ 60 giây để mã xác nhận được gửi về Zalo...";
  }
  if (codeEl) codeEl.textContent = "Chờ 60s...";
  if (otpInput) {
    otpInput.value = "";
    otpInput.disabled = true;
  }
  if (verifyBtn) verifyBtn.disabled = true;
  if (resendBtn) resendBtn.disabled = true;
  if (zaloLink) zaloLink.classList.add("hidden");
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
          "Đã đủ 60 giây! Mã xác nhận đã được gửi về Zalo — hãy nhập mã bên dưới để hoàn tất phiếu.";
      }
      if (codeEl) codeEl.textContent = generatedOtp;
      if (otpInput) {
        otpInput.disabled = false;
        otpInput.focus();
      }
      if (verifyBtn) verifyBtn.disabled = false;
      if (resendBtn) resendBtn.disabled = false;

      await dispatchOtpToZaloAfter60s({
        fullName,
        phone,
        region,
        otp: generatedOtp,
        time: timeStr
      });
    }
  }, 1000);
}

function autoFillOtp() {
  if (otpReadyForInput && generatedOtp) {
    document.getElementById("otpInput").value = generatedOtp;
    document.getElementById("step2Error").textContent = "";
  }
}

function resendOtpAfter60s() {
  start60sWaitBeforeZaloOtp();
}

function openZaloOtpAgain() {
  if (latestZaloOtpMessage) {
    triggerZaloShareUrl(latestZaloOtpMessage);
  }
}

async function handleVerifyOtp() {
  const userOtp = document.getElementById("otpInput").value.trim();
  const errorEl = document.getElementById("step2Error");

  if (!otpReadyForInput || !generatedOtp) {
    errorEl.textContent = "Vui lòng đợi đủ 60 giây để hệ thống gửi mã xác nhận về Zalo.";
    return;
  }

  if (userOtp !== generatedOtp) {
    errorEl.textContent = "Mã xác nhận không chính xác. Vui lòng nhập đúng mã 6 chữ số đã gửi về Zalo.";
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
  document.getElementById("receiptTime").textContent = nowStr;

  setActiveStep(3);

  if (ZALO_60S_CONFIG.ENABLED && ZALO_60S_CONFIG.WEBHOOK_URL) {
    try {
      await fetch(ZALO_60S_CONFIG.WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "ticket_completed",
          channel: "zalo",
          text: buildZaloCompletedMessage(lastCompletedReceipt),
          data: lastCompletedReceipt
        })
      });
    } catch (err) {
      console.error("Lỗi gửi phiếu hoàn tất tới Zalo Webhook:", err);
    }
  }
}

function sendCompletedTicketToZalo() {
  if (!lastCompletedReceipt) return;
  triggerZaloShareUrl(buildZaloCompletedMessage(lastCompletedReceipt));
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
  ctx.fillText(`Mã phiếu: ${lastCompletedReceipt.code}`, 56, 124);

  ctx.fillStyle = "#14243b";
  ctx.font = "700 20px Nunito, sans-serif";
  ctx.fillText(`Họ và tên: ${lastCompletedReceipt.fullName}`, 56, 180);
  ctx.fillText(`Số điện thoại: ${lastCompletedReceipt.phone}`, 56, 222);
  ctx.fillText(`Vùng miền đồng hành: ${lastCompletedReceipt.region}`, 56, 264);
  ctx.fillText(`Thời gian xác nhận: ${lastCompletedReceipt.nowStr}`, 56, 306);
  ctx.fillText("Ghi nhận: +01 Hộp sữa KUN 100% Sữa Tươi", 56, 348);

  ctx.fillStyle = "#52647c";
  ctx.font = "600 16px Nunito, sans-serif";
  ctx.fillText("Dự án Sữa KUN Cho Bạn - Cùng Em Cao Lớn (#SuaKUNChoBan)", 56, 412);

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

// ===== MODAL & VẼ POSTCARD CANVAS =====
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
  ctx.fillText("#SuaKUNChoBan  •  #suakunchoem", 270, 586);
  ctx.font = "700 14px Nunito, sans-serif";
  ctx.fillText("1 lượt chia sẻ = 1 hộp KUN 100% Sữa Tươi trao đi", 270, 610);
}

function downloadPostcard() {
  const canvas = document.getElementById("postcardCanvas");
  const link = document.createElement("a");
  link.download = `postcard-sua-kun-${currentRegion.toLowerCase().replace(/\s+/g, "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// Khởi tạo preview lần đầu khi tải trang
window.addEventListener("DOMContentLoaded", () => {
  updatePostcardPreview();
});
