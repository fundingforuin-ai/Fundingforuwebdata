
// ── Auth ─────────────────────────────────────────────────────
const token = localStorage.getItem('f4u_token');
const userData = JSON.parse(localStorage.getItem('f4u_user') || '{}');
if (!token || !userData.email) { window.location.replace('/login'); }

window.addEventListener('pageshow', function(event) {
  if (event.persisted || performance.getEntriesByType("navigation")[0].type === "back_forward") {
    if (!localStorage.getItem('f4u_token')) window.location.replace('/login');
  }
});

document.getElementById('sbName').textContent = userData.full_name || 'Trader';
document.getElementById('sbEmail').textContent = userData.email || '';
document.getElementById('sbAvatar').textContent = (userData.full_name || 'T')[0].toUpperCase();
document.getElementById('profAvatar').textContent = (userData.full_name || 'T')[0].toUpperCase();
document.getElementById('profName').textContent = userData.full_name || '—';
document.getElementById('profEmail').textContent = userData.email || '—';
document.getElementById('profInputName').value = userData.full_name || '';
document.getElementById('profInputEmail').value = userData.email || '';

// Affiliate code from user id
const affCode = 'F4U' + String(userData.id || '00000').padStart(5,'0');
document.getElementById('affCode').textContent = affCode;
document.getElementById('affLink').textContent = `https://fundings4u.com/register?ref=${affCode}`;

function logout() { localStorage.clear(); window.location.replace('/login'); }

// ── Clock ─────────────────────────────────────────────────────
setInterval(() => { document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }, 1000);
document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});

// ── Section switching ─────────────────────────────────────────
const pageTitles = {overview:'Account Overview',certificates:'Certificates',competition:'Leaderboard',wallet:'Wallet',profile:'Profile',affiliate:'Affiliate',alerts:'Violations & Alerts'};
let currentSection = 'overview';

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobileBackdrop');
  if (sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

function showSection(name) {
  // Close mobile sidebar if open
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobileBackdrop');
  if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }

  document.querySelectorAll('.section-panel').forEach(el => el.classList.remove('active'));
  document.getElementById('section-'+name).classList.add('active');
  document.querySelectorAll('.sb-link').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sb-link')[['overview','certificates','competition','wallet','profile','affiliate','alerts'].indexOf(name)]?.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[name] || name;
  const showLive = name === 'overview';
  document.getElementById('liveBadge').style.display = showLive ? 'flex' : 'none';
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.style.color = '#9b93ae');
  const mobBtn = document.getElementById('mob-'+name);
  if (mobBtn) mobBtn.style.color = '#cebdff';
  currentSection = name;
  document.getElementById('scrollArea').scrollTo(0, 0);
  if (name === 'competition') renderLeaderboard();
  if (name === 'affiliate') loadAffiliateData();
}

async function loadAffiliateData() {
  try {
    const res = await fetch('/api/affiliate/stats', { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return;
    const stats = await res.json();
    
    // Header
    const affCode = 'F4U' + String(userData.id || '00000').padStart(5,'0');
    document.getElementById('affCodeDisplay').textContent = affCode;
    
    // Main Stats
    document.getElementById('affTotalRefs').textContent = stats.totalReferrals;
    document.getElementById('affTotalRev').textContent = fmtD(stats.totalRevenue);
    document.getElementById('affTotalEarned').textContent = fmtD(stats.totalEarned);
    
    // Tier Card
    document.getElementById('tierName').textContent = stats.tier;
    document.getElementById('tierComm').textContent = stats.commissionRate + '%';
    document.getElementById('tierDisc').textContent = stats.discount + '%';
    document.getElementById('tierSuccessShare').textContent = stats.successShare;
    document.getElementById('tierAlloc').textContent = stats.accountsAllocation;
    
    const icons = { 'Scout':'military_tech', 'Hunter':'track_changes', 'Apex':'diamond', 'Legend':'local_fire_department' };
    const colors = { 'Scout':'#cebdff', 'Hunter':'#34d399', 'Apex':'#60a5fa', 'Legend':'#f5c842' };
    document.getElementById('tierIcon').textContent = icons[stats.tier] || 'military_tech';
    document.getElementById('tierIcon').style.color = colors[stats.tier] || '#cebdff';
    
    // Progress
    let progress = 100;
    document.getElementById('nextTierName').textContent = 'Max Rank';
    document.getElementById('tierRevenueStr').textContent = fmtD(stats.totalRevenue);
    document.getElementById('nextTierReqStr').textContent = 'MAX';
    
    if (stats.nextTierReq) {
       progress = Math.min(100, (stats.totalRevenue / stats.nextTierReq) * 100);
       document.getElementById('nextTierReqStr').textContent = fmtD(stats.nextTierReq);
       if (stats.tier === 'Scout') document.getElementById('nextTierName').textContent = 'Hunter';
       if (stats.tier === 'Hunter') document.getElementById('nextTierName').textContent = 'Apex';
       if (stats.tier === 'Apex') document.getElementById('nextTierName').textContent = 'Legend';
    }
    setTimeout(() => { document.getElementById('tierProgressBar').style.width = progress + '%'; }, 300);
    document.getElementById('tierProgressPct').textContent = Math.floor(progress) + '%';
    
    // Success Share
    document.getElementById('fundedTradersCount').textContent = stats.fundedCount;
    const shareMax = stats.tier === 'Scout' ? 1 : (stats.tier === 'Hunter' ? 5 : (stats.tier === 'Apex' ? 20 : 50));
    document.getElementById('successShareBar').style.width = Math.min(100, (stats.fundedCount / shareMax) * 100) + '%';
    
    // Milestones Array
    const milestones = [
      { rev: 1500, label: '$50 Bonus' },
      { rev: 6000, label: '$250 Bonus' },
      { rev: 25000, label: '$1,000 Bonus' },
      { rev: 50000, label: 'iPhone Pro' },
      { rev: 100000, label: 'MacBook Pro' },
      { rev: 250000, label: 'Moto Fund' },
      { rev: 500000, label: 'Car Fund' },
      { rev: 1000000, label: 'VIP Founder' },
    ];
    document.getElementById('milestonesGrid').innerHTML = milestones.map(m => {
      const unlocked = stats.totalRevenue >= m.rev;
      return `<div class="bg-surface-container-lowest border ${unlocked?'border-primary/40 bg-primary/5':'border-outline-variant/10'} rounded-xl p-4 relative overflow-hidden transition-colors">
        ${unlocked ? '<div class="absolute top-0 right-0 w-8 h-8 bg-primary/20 rounded-bl-full"></div>' : ''}
        <div class="text-[10px] font-mono text-on-surface-variant mb-1">${fmtD(m.rev)}</div>
        <div class="text-sm font-bold ${unlocked?'text-primary':'text-on-surface-variant/50'}">${m.label}</div>
        <div class="mt-2 text-[10px] font-semibold flex items-center gap-1 ${unlocked?'text-green-400':'text-on-surface-variant/30'}">
          <span class="material-symbols-outlined" style="font-size:12px">${unlocked?'check_circle':'lock'}</span> ${unlocked?'Unlocked':'Locked'}
        </div>
      </div>`;
    }).join('');

    // Load Leaderboard
    loadAffLeaderboard();
  } catch(e) { console.error('Error loading affiliate stats', e); }
}

async function loadAffLeaderboard() {
  const container = document.getElementById('affLeaderboard');
  try {
    const res = await fetch('/api/affiliate/leaderboard');
    if (!res.ok) return;
    const board = await res.json();
    if (!board.length) {
      container.innerHTML = '<div class="text-center text-xs text-on-surface-variant p-4">No data yet for this month.</div>';
      return;
    }
    
    container.innerHTML = board.map((r, i) => `
      <div class="flex items-center justify-between p-3 border-b border-outline-variant/10 last:border-0 hover:bg-white/[0.02] transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i===0?'bg-[#f5c842]/20 text-[#f5c842]':i===1?'bg-[#c0c0c0]/20 text-[#c0c0c0]':i===2?'bg-[#cd7f32]/20 text-[#cd7f32]':'bg-surface border border-outline-variant/20 text-on-surface-variant'}">${i+1}</div>
          <div class="text-xs font-semibold text-on-surface">${r.name}</div>
        </div>
        <div class="text-xs font-mono font-bold text-primary">${fmtD(r.revenue)}</div>
      </div>
    `).join('');
  } catch(e) { console.error(e); }
}

function copyAffLink() {
  const affCode = 'F4U' + String(userData.id || '00000').padStart(5,'0');
  navigator.clipboard.writeText(`https://fundings4u.com/signup?ref=${affCode}`);
  showToast('Affiliate Link Copied!');
}


// ── Helpers ───────────────────────────────────────────────────
const fmtD = n => n == null ? '—' : (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP = n => n == null ? '—' : n.toFixed(2) + '%';
let equityChartInst = null, allTrades = [];

// ── Trades tab ────────────────────────────────────────────────
function switchTab(tab) {
  ['all','open','closed'].forEach(t => document.getElementById('tab-'+t).classList.toggle('active', t===tab));
  const f = tab==='all' ? allTrades : allTrades.filter(t => tab==='open' ? !t.close_time : !!t.close_time);
  renderTrades(f);
}
function renderTrades(trades) {
  const tbody = document.getElementById('tradesBody');
  const empty = document.getElementById('tradesEmpty');
  document.getElementById('d-tradeCount').textContent = trades.length + ' trades';
  if (!trades.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = trades.slice(0,30).map(t => {
    const pos = (t.profit||0) >= 0;
    const type = (t.type||'').toUpperCase();
    return `<tr class="trade-row transition-colors">
      <td class="px-5 py-3.5 font-medium text-on-surface text-sm">${t.symbol||'—'}</td>
      <td class="px-5 py-3.5 text-sm ${type==='BUY'?'text-primary':'text-tertiary'}">${type||'—'}</td>
      <td class="px-5 py-3.5 font-mono text-xs text-on-surface-variant">${t.volume??'—'}</td>
      <td class="px-5 py-3.5 font-mono text-xs text-on-surface-variant">${t.open_price??'—'}</td>
      <td class="px-5 py-3.5 font-mono text-xs text-on-surface-variant">${t.close_price??'—'}</td>
      <td class="px-5 py-3.5 text-right font-mono text-sm font-semibold ${pos?'text-primary':'text-error'}">${fmtD(t.profit)}</td>
      <td class="px-5 py-3.5 text-[11px] text-on-surface-variant/50 font-mono">${t.open_time ? new Date(t.open_time).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'}</td>
    </tr>`;
  }).join('');
}

// ── Dashboard render ──────────────────────────────────────────
function renderDashboard(d) {
  const {account, metrics:m, trades, history} = d;
  const size = Number(account.account_size||0);
  const equity = m?.equity ?? size;
  const balance = m?.balance ?? size;
  const profit = m?.profit ?? 0;
  const winRate = m?.win_rate ?? 0;
  const totTrades = m?.total_trades ?? 0;

  document.getElementById('d-acctId').textContent = '#F4U-'+String(account.id||'0').padStart(5,'0');
  document.getElementById('d-phase').textContent = ({'2step':'Evaluation Phase 2','instant':'Instant Funded','unlimited':'Unlimited Try'}[account.challenge_type]||'Evaluation');
  document.getElementById('d-size').textContent = '$'+size.toLocaleString('en-US',{minimumFractionDigits:2});
  document.getElementById('profInputId').value = '#F4U-'+String(account.id||'0').padStart(5,'0');
  
  window.realMt5Login = account.mt5_login || '';
  document.getElementById('d-mt5Login').textContent = window.realMt5Login ? '••••••••' : '—';
  if(document.getElementById('mt5LoginIcon')) document.getElementById('mt5LoginIcon').textContent = 'visibility';
  
  window.realMt5Password = account.mt5_password || '';
  document.getElementById('d-mt5Pass').textContent = window.realMt5Password ? '••••••••' : '—';
  document.getElementById('mt5PassIcon').textContent = 'visibility';
  document.getElementById('d-mt5Server').textContent = account.mt5_server || '—';
  
  document.getElementById('profSince').value || (document.getElementById('profSince').textContent = new Date().toLocaleDateString('en-US',{month:'short',year:'numeric'}));

  const returnPct = size > 0 ? ((equity-size)/size*100).toFixed(2) : 0;
  document.getElementById('d-equity').textContent = fmtD(equity);
  document.getElementById('d-returnPct').textContent = (returnPct>=0?'+':'')+returnPct+'% Total Return';
  document.getElementById('d-returnPct').className = 'text-[10px] mt-0.5 '+(returnPct>=0?'text-primary':'text-error');
  document.getElementById('d-lastUpdate').textContent = 'Updated '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  const profitTarget = size*0.1, dailyDDLimit = size*0.04, maxDDLimit = size*0.08;
  document.getElementById('d-profit').textContent = fmtD(profit);
  document.getElementById('d-profitTarget').textContent = ' / '+fmtD(profitTarget);
  document.getElementById('d-profitRemain').textContent = fmtD(Math.max(0,profitTarget-profit));
  setTimeout(()=>document.getElementById('bar-profit').style.width=Math.min(100,Math.max(0,(profit/profitTarget)*100)).toFixed(1)+'%',300);

  const dailyLoss = Math.abs(Math.min(0,profit));
  document.getElementById('d-dailyDD').textContent = '-'+fmtD(dailyLoss);
  document.getElementById('d-dailyDDLimit').textContent = ' / -'+fmtD(dailyDDLimit);
  setTimeout(()=>document.getElementById('bar-daily').style.width=Math.min(100,(dailyLoss/dailyDDLimit)*100).toFixed(1)+'%',450);

  const maxLoss = Math.abs(Math.min(0,balance-size));
  document.getElementById('d-maxDD').textContent = '-'+fmtD(maxLoss);
  document.getElementById('d-maxDDLimit').textContent = ' / -'+fmtD(maxDDLimit);
  setTimeout(()=>document.getElementById('bar-max').style.width=Math.min(100,(maxLoss/maxDDLimit)*100).toFixed(1)+'%',600);

  document.getElementById('d-winRate').textContent = fmtP(winRate);
  document.getElementById('d-netPL').textContent = fmtD(profit);
  document.getElementById('d-netPL').className = 'text-2xl font-semibold font-sora '+(profit>=0?'text-primary':'text-error');
  document.getElementById('d-totalTrades').textContent = totTrades;

  // Chart
  const labels = history.map(h=>new Date(h.recorded_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
  const equities = history.map(h=>h.equity||h.balance||size);
  const balances = history.map(h=>h.balance||size);
  if (equityChartInst) { equityChartInst.destroy(); equityChartInst=null; }
  const chartEl = document.getElementById('equityChart');
  if (history.length > 1) {
    document.getElementById('chartEmpty').classList.add('hidden');
    chartEl.style.display='';
    document.getElementById('chartTimes').innerHTML=`<span>${labels[0]}</span><span>${labels[labels.length-1]}</span>`;
    equityChartInst = new Chart(chartEl, {
      type:'line', data:{labels, datasets:[
        {label:'Equity',data:equities,borderColor:'#cebdff',backgroundColor:'rgba(206,189,255,0.07)',borderWidth:1.5,tension:0.4,fill:true,pointRadius:0,pointHoverRadius:3},
        {label:'Balance',data:balances,borderColor:'rgba(73,68,87,0.8)',borderWidth:1,borderDash:[4,3],tension:0.4,fill:false,pointRadius:0}
      ]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>(ctx.dataset.label||'')+': $'+ctx.parsed.y.toLocaleString()}}},scales:{x:{display:false},y:{grid:{color:'rgba(255,255,255,0.03)',lineWidth:0.5},ticks:{color:'rgba(155,147,174,0.5)',font:{size:10,family:'Geist Mono'},callback:v=>'$'+Number(v).toLocaleString()}}}}
    });
  } else {
    document.getElementById('chartEmpty').classList.remove('hidden');
    chartEl.style.display='none';
  }

  allTrades = trades;
  switchTab('all');
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('dashMain').classList.remove('hidden');
  document.getElementById('noAccountState').classList.add('hidden');
}

function renderNoAccount() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('dashMain').classList.add('hidden');
  document.getElementById('noAccountState').classList.remove('hidden');
}

// ── Leaderboard ───────────────────────────────────────────────
const generateLBData = () => {
  const d = new Date();
  const weekStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - weekStart) / 86400000) + weekStart.getDay() + 1) / 7);
  let seed = d.getFullYear() * 100 + weekNo;
  const rnd = () => { let x = Math.sin(seed++) * 10000; return x - Math.floor(x); };
  
  const names = ['Ahmed M.','Priya K.','Carlos R.','Yuki N.','Omar A.','Jana K.','Rahul S.','Lena W.','Fatima Z.','Miguel C.','Alex B.','Sarah L.','David T.','Wei C.','Hassan R.'];
  const flags = ['🇦🇪','🇮🇳','🇲🇽','🇯🇵','🇸🇦','🇵🇱','🇮🇳','🇩🇪','🇲🇦','🇧🇷','🇺🇸','🇨🇦','🇬🇧','🇨🇳','🇪🇬'];
  const pairs = ['XAUUSD','EURUSD','USDJPY','GBPUSD','GBPJPY','US30','NAS100'];
  
  let data = [];
  let currentProfit = 40000 + rnd() * 15000;
  for(let i=1; i<=10; i++) {
    const pidx = Math.floor(rnd() * names.length);
    data.push({
      rank: i,
      name: names[pidx],
      flag: flags[pidx],
      profit: currentProfit,
      pct: currentProfit / 1000, // Roughly correct based on 100k account size
      winRate: 50 + rnd() * 35,
      pair: pairs[Math.floor(rnd() * pairs.length)],
      trades: Math.floor(10 + rnd() * 50)
    });
    currentProfit -= (currentProfit * (rnd() * 0.15 + 0.05));
  }
  return data;
};
const lbData = generateLBData();

function renderLeaderboard() {
  // Top 3 podium
  const colors = ['rank-1','rank-2','rank-3'];
  const podiumEl = document.getElementById('lbTop3');
  podiumEl.innerHTML = lbData.slice(0,3).map((t,i) => `
    <div class="glass rounded-xl p-5 fade-up" style="animation-delay:${i*.05}s">
      <div class="flex items-center gap-3 mb-3">
        <div class="rank-badge ${colors[i]}">${t.rank}</div>
        <div class="text-base">${t.flag}</div>
        <div class="text-sm font-semibold text-on-surface">${t.name}</div>
      </div>
      <div class="font-sora text-xl font-bold ${i===0?'text-primary text-2xl':'text-on-surface'}">+${fmtD(t.profit).replace('$','$')}</div>
      <div class="text-[11px] ${i===0?'text-primary':'text-on-surface-variant'} mt-0.5">+${t.pct.toFixed(2)}% &nbsp;·&nbsp; ${t.trades} Trades</div>
      <div class="mt-3 h-1 bg-outline-variant/20 rounded-full overflow-hidden">
        <div class="h-full rounded-full ${i===0?'bg-primary':i===1?'bg-on-surface-variant':'bg-tertiary'}" style="width:${(t.profit/lbData[0].profit*100).toFixed(0)}%;opacity:0.7"></div>
      </div>
    </div>
  `).join('');

  // Full table
  renderLBTable(lbData);
}

function renderLBTable(data) {
  const colors = ['rank-1','rank-2','rank-3','rank-n'];
  document.getElementById('lbTable').innerHTML = data.map(t => `
    <tr class="trade-row transition-colors">
      <td class="px-5 py-3.5"><div class="rank-badge ${t.rank<=3?colors[t.rank-1]:'rank-n'}">${t.rank}</div></td>
      <td class="px-5 py-3.5"><div class="flex items-center gap-2"><span>${t.flag}</span><span class="text-sm font-medium text-on-surface">${t.name}</span></div></td>
      <td class="px-5 py-3.5 font-mono text-sm font-semibold text-primary">+${fmtD(t.profit)}</td>
      <td class="px-5 py-3.5 text-xs text-primary">+${t.pct.toFixed(2)}%</td>
      <td class="px-5 py-3.5 text-xs text-on-surface-variant">${t.winRate.toFixed(1)}%</td>
      <td class="px-5 py-3.5 font-mono text-xs text-on-surface-variant">${t.pair}</td>
      <td class="px-5 py-3.5 text-xs text-on-surface-variant text-right">${t.trades}</td>
    </tr>
  `).join('');
}

function switchLBTab(tab) {
  ['profit','winrate'].forEach(t=>document.getElementById('lb-tab-'+t).classList.toggle('active',t===tab));
  const sorted = [...lbData].sort((a,b) => tab==='profit' ? b.profit-a.profit : b.winRate-a.winRate);
  renderLBTable(sorted.map((t,i)=>({...t,rank:i+1})));
}

function filterLB(size) {
  document.querySelectorAll('.lb-filter-btn').forEach(b=>b.style.borderColor='');
  event.target.style.borderColor='rgba(206,189,255,0.5)';
  renderLBTable(lbData); // In production filter by account size
}

// ── Load data ─────────────────────────────────────────────────
let currentAccountId = null;

function switchAccount(id) {
  currentAccountId = id;
  document.getElementById('dashMain').classList.add('hidden');
  document.getElementById('loadingState').classList.remove('hidden');
  loadDashboard();
}

async function loadDashboard() {
  try {
    const url = currentAccountId ? `/api/dashboard?account_id=${currentAccountId}` : '/api/dashboard';
    const res = await fetch(url, {headers:{Authorization:'Bearer '+token}});
    if (res.status===401){localStorage.clear();window.location.href='/login';return;}
    const data = await res.json();
    
    // Populate switcher
    const switcher = document.getElementById('accountSwitcher');
    if (data.allAccounts && data.allAccounts.length > 1) {
      switcher.classList.remove('hidden');
      if (switcher.options.length !== data.allAccounts.length) {
        switcher.innerHTML = data.allAccounts.map(a => `<option value="${a.id}">$${Number(a.account_size).toLocaleString()} - ${a.challenge_type}</option>`).join('');
      }
      switcher.value = data.account ? data.account.id : data.allAccounts[0].id;
    } else {
      switcher.classList.add('hidden');
    }

    if (!data.account) {
      renderNoAccount();
    } else {
      renderDashboard(data);
      loadAlerts();
    }
  } catch(e){console.error(e);}
}

// ── Affiliate copy ────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity='1'; t.style.transform='translateY(0)';
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(20px)'},2000);
}
function copyAffLink() { navigator.clipboard.writeText(document.getElementById('affLink').textContent); showToast('Link copied!'); }
function copyAffCode() { navigator.clipboard.writeText(document.getElementById('affCode').textContent); showToast('Code copied!'); }

function copyMt5Password() {
  if (!window.realMt5Password) return;
  navigator.clipboard.writeText(window.realMt5Password);
  showToast('Password copied!');
}

function toggleMt5Password() {
  if (!window.realMt5Password) return;
  const el = document.getElementById('d-mt5Pass');
  const icon = document.getElementById('mt5PassIcon');
  if (el.textContent === '••••••••') {
    el.textContent = window.realMt5Password;
    icon.textContent = 'visibility_off';
  } else {
    el.textContent = '••••••••';
    icon.textContent = 'visibility';
  }
}

function copyMt5Login() {
  if (!window.realMt5Login) return;
  navigator.clipboard.writeText(window.realMt5Login);
  showToast('Login copied!');
}

function toggleMt5Login() {
  if (!window.realMt5Login) return;
  const el = document.getElementById('d-mt5Login');
  const icon = document.getElementById('mt5LoginIcon');
  if (el.textContent === '••••••••') {
    el.textContent = window.realMt5Login;
    icon.textContent = 'visibility_off';
  } else {
    el.textContent = '••••••••';
    icon.textContent = 'visibility';
  }
}



async function loadAlerts() {
  try {
    const res = await fetch('/api/alerts', {headers:{Authorization:'Bearer '+token}});
    if(res.ok) {
      const alerts = await res.json();
      const list = document.getElementById('alertsList');
      const empty = document.getElementById('noAlertsState');
      if(alerts.length > 0) {
        empty.classList.add('hidden');
        list.classList.remove('hidden');
        list.innerHTML = alerts.map(a => `
          <div class="glass rounded-xl p-6 border border-error/30 bg-error/5 relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-error"></div>
            <div class="flex items-start gap-4">
              <span class="material-symbols-outlined text-error" style="font-size:24px">gavel</span>
              <div>
                <div class="text-sm font-bold text-on-surface mb-1">${a.title}</div>
                <div class="text-sm text-on-surface-variant mb-2">${a.message}</div>
                <div class="text-[10px] text-on-surface-variant/50 font-mono">${new Date(a.created_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        empty.classList.remove('hidden');
        list.classList.add('hidden');
      }
    }
  } catch(e){console.error(e);}
}

loadDashboard();
setInterval(loadDashboard, 50000);

// Init leaderboard on load
renderLeaderboard();

// Set mobile home active
document.getElementById('mob-overview').style.color='#cebdff';
