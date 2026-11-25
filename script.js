activeModalRegionId = regionId;
  const r = REGIONS.find(item => item.id === regionId) || REGIONS[0];
  document.getElementById('modalRegionInfo').textContent = `${r.icon} Vùng miền bình chọn: ${r.fullName}`;
  nameError.style.display = 'none';
  phoneError.style.display = 'none';
  voteModal.classList.add('open');
  voteModal.setAttribute('aria-hidden', 'false');
  voterNameInput.focus();
}

function closeVoteModal() {
  voteModal.classList.remove('open');
  voteModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('btnCloseModal').addEventListener('click', closeVoteModal);
voteModal.addEventListener('click', (e) => {
  if (e.target === voteModal) closeVoteModal();
});

voterPhoneInput.addEventListener('input', () => {
  voterPhoneInput.value = voterPhoneInput.value.replace(/\D/g, '').slice(0, 10);
});

voteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fullName = voterNameInput.value.trim();
  const phone = voterPhoneInput.value.trim();

  let valid = true;
  if (fullName.length < 2) {
    nameError.style.display = 'block';
    valid = false;
  } else {
    nameError.style.display = 'none';
  }

  if (!/^0\d{9}$/.test(phone)) {
    phoneError.textContent = 'Vui lòng nhập số điện thoại hợp lệ (10 chữ số, bắt đầu bằng số 0).';
    phoneError.style.display = 'block';
    valid = false;
  } else {
    phoneError.style.display = 'none';
  }

  if (!valid) return;

  const existed = state.voters.find(v => v.phone === phone);
  if (existed) {
    const prevRegion = REGIONS.find(r => r.id === existed.regionId);
    phoneError.textContent = `Số điện thoại này đã bình chọn cho "${prevRegion ? prevRegion.fullName : 'vùng miền'}" rồi nhé!`;
    phoneError.style.display = 'block';
    return;
  }

  const now = new Date();
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} • ${now.getDate()}/${now.getMonth() + 1}`;
  const newVote = {
    name: fullName,
    phone: phone,
    regionId: activeModalRegionId,
    time: timeLabel,
    createdAt: Date.now()
  };

  btnSubmitVote.disabled = true;
  btnSubmitVote.textContent = '⏳ Đang gửi bình chọn...';

  if (getCleanDbUrl()) {
    try {
      await pushVoteToCloud(newVote);
      await syncFromCloud();
    } catch (err) {
      state.votes[activeModalRegionId] = (state.votes[activeModalRegionId] || 0) + 1;
      state.voters.unshift(newVote);
      saveLocalState();
      renderAll();
    }
  } else {
    state.votes[activeModalRegionId] = (state.votes[activeModalRegionId] || 0) + 1;
    state.voters.unshift(newVote);
    saveLocalState();
    renderAll();
  }

  const chosenRegion = REGIONS.find(r => r.id === activeModalRegionId);
  await sendVoteToTelegram(newVote, chosenRegion ? chosenRegion.fullName : activeModalRegionId);

  btnSubmitVote.disabled = false;
  btnSubmitVote.textContent = '💛 Xác nhận bình chọn & Viết lời nhắn';

  closeVoteModal();
  showToast(`🎉 Cảm ơn ${fullName}! Bạn đã trao yêu thương tới ${chosenRegion.fullName}.`);

  document.getElementById('pcRegion').value = activeModalRegionId;
  const shortName = fullName.split(' ').slice(-2).join(' ').slice(0, 13);
  document.getElementById('pcSenderName').value = shortName;
  updatePostcardPreview();

  voterNameInput.value = '';
  voterPhoneInput.value = '';
  document.getElementById('tao-postcard').scrollIntoView({ behavior: 'smooth' });
});

// =========================================================
// TRÌNH TẠO POSTCARD & XUẤT ẢNH .PNG
// =========================================================
const pcRegion = document.getElementById('pcRegion');
const pcSenderName = document.getElementById('pcSenderName');
const pcKidName = document.getElementById('pcKidName');
const pcMessage = document.getElementById('pcMessage');
const postcardPreview = document.getElementById('postcardPreview');

function updatePostcardPreview() {
  const r = REGIONS.find(item => item.id === pcRegion.value) || REGIONS[0];
  const sender = pcSenderName.value.trim();
  const kid = pcKidName.value.trim();
  const msg = pcMessage.value.trim();

  document.getElementById('senderCount').textContent = `${pcSenderName.value.length}/13`;
  document.getElementById('kidCount').textContent = `${pcKidName.value.length}/13`;
  document.getElementById('msgCount').textContent = `${pcMessage.value.length}/110`;

  postcardPreview.className = `postcard-card ${r.bgClass}`;
  document.getElementById('previewRegionLabel').textContent = `${r.icon} ${r.fullName}`;
  document.getElementById('previewTo').textContent = `Gửi các em nhỏ ${r.fullName} 💛`;
  document.getElementById('previewQuote').textContent =
    msg || 'Chúc các em luôn mạnh khỏe, chăm ngoan, học giỏi và cao lớn mỗi ngày cùng sữa KUN nhé!';

  const prefix = selectedGender === 'Nam' ? 'Anh/Chú' : 'Chị/Cô';
  if (sender && kid) {
    document.getElementById('previewSender').textContent = `${prefix} ${sender} & bé ${kid}`;
  } else if (sender) {
    document.getElementById('previewSender').textContent = `${prefix} ${sender}`;
  } else if (kid) {
    document.getElementById('previewSender').textContent = `Bé ${kid}`;
  } else {
    document.getElementById('previewSender').textContent = 'Người bạn đồng hành';
  }
}

[pcRegion, pcSenderName, pcKidName, pcMessage].forEach(el => {
  el.addEventListener('input', updatePostcardPreview);
  el.addEventListener('change', updatePostcardPreview);
});

document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedGender = btn.dataset.gender;
    updatePostcardPreview();
  });
});

let suggestIdx = 0;
document.getElementById('btnSuggestMsg').addEventListener('click', () => {
  pcMessage.value = SUGGESTED_MESSAGES[suggestIdx % SUGGESTED_MESSAGES.length];
  suggestIdx++;
  updatePostcardPreview();
});

document.getElementById('btnCopyHashtag').addEventListener('click', () => {
  navigator.clipboard?.writeText('#SuaKUNChoBan #CungEmCaoLon');
  showToast('📋 Đã sao chép hashtag #SuaKUNChoBan #CungEmCaoLon!');
});

document.getElementById('btnDownloadPostcard').addEventListener('click', () => {
  const r = REGIONS.find(item => item.id === pcRegion.value) || REGIONS[0];
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 750;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 1000, 750);
  grad.addColorStop(0, r.gradient[0]);
  grad.addColorStop(1, r.gradient[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1000, 750);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 18;
  ctx.strokeRect(24, 24, 952, 702);

  ctx.fillStyle = '#FFD100';
  roundRect(ctx, 64, 60, 290, 56, 28, true);
  ctx.fillStyle = '#003D82';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('SỮA KUN CHO BẠN', 92, 97);

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, 620, 60, 316, 56, 28, true);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${r.icon} ${r.fullName}`, 648, 96);

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, 64, 165, 872, 410, 32, true);

  ctx.fillStyle = '#FF6B00';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`GỬI CÁC EM NHỎ ${r.fullName.toUpperCase()} 💛`, 104, 225);

  ctx.fillStyle = '#003D82';
  ctx.font = 'bold 34px sans-serif';
  const quoteText = document.getElementById('previewQuote').textContent;
  wrapText(ctx, quoteText, 104, 295, 790, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Lời nhắn từ:', 68, 632);

  ctx.fillStyle = '#FFD100';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(document.getElementById('previewSender').textContent, 68, 678);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('#SuaKUNChoBan', 710, 676);

  const link = document.createElement('a');
  link.download = `postcard-sua-kun-${r.id}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('📥 Đã lưu ảnh Postcard Sữa KUN về máy của bạn!');
});

function roundRect(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

renderAll();
updatePostcardPreview();
if (getCleanDbUrl()) {
  syncFromCloud();
  setInterval(syncFromCloud, 6000);
}
