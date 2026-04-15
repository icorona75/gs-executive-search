/* ============================================
   GS Executive Search — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ── Theme Toggle ──
  const root = document.documentElement;
  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  const themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    updateThemeIcon();
    themeBtn.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      updateThemeIcon();
      renderCharts();
    });
  }
  function updateThemeIcon() {
    if (!themeBtn) return;
    themeBtn.innerHTML = theme === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
  }

  // ── Data ──
  const data = typeof window.APP_DATA !== 'undefined' ? window.APP_DATA : {};
  const jobs = data.jobs || [];
  const companies = data.companies || [];
  const recruiters = data.recruiters || [];
  const platforms = data.platforms || [];
  const compensation = data.compensation || [];
  const candidate = data.candidate || {};

  // ── Recruiter-to-Job Hiring Manager Matching ──
  // Build a lookup of recruiter firms by normalized name fragments
  var recruiterLookup = {};
  recruiters.forEach(function(r) {
    var key = (r.firm || '').toLowerCase().replace(/[()]/g, '').trim();
    recruiterLookup[key] = r;
    // Also index by short names for fuzzy matching
    var parts = key.split(/[—–\-,]/)[0].trim();
    if (parts.length > 3) recruiterLookup[parts] = r;
  });

  function findHiringManagers(job) {
    var recText = (job.suggested_recruiter || '').toLowerCase();
    var jobTitle = (job.title || '').toLowerCase();
    var jobFit = (job.goldie_fit || '').toLowerCase();
    var combined = jobTitle + ' ' + jobFit;
    var results = [];

    recruiters.forEach(function(r) {
      var firmName = (r.firm || '').toLowerCase();
      var firmShort = firmName.split(/[—–\-,(]/)[0].trim();
      // Check if this firm is mentioned in the suggested_recruiter text
      if (firmShort.length > 3 && recText.includes(firmShort)) {
        // Find best matching contact based on job sector keywords
        var contacts = r.key_contacts || [];
        var bestContact = null;
        var bestScore = 0;
        contacts.forEach(function(c) {
          var spec = (c.specialization || '').toLowerCase();
          var score = 0;
          // Score contact by how well their specialization matches the job
          if (/critical mineral|mining|metals|battery/.test(combined) && /mineral|mining|metal|battery|energy/.test(spec)) score += 10;
          if (/infrastructure|energy/.test(combined) && /infrastructure|energy/.test(spec)) score += 8;
          if (/fund.of.fund|fof|fund invest/.test(combined) && /fund|asset management/.test(spec)) score += 8;
          if (/private equity|\bpe\b/.test(combined) && /private equity|\bpe\b|private capital/.test(spec)) score += 7;
          if (/impact|esg|sustainab|climate/.test(combined) && /impact|esg|sustainab|climate/.test(spec)) score += 9;
          if (/development finance|dfi|\bifc\b|\bidb\b|world bank/.test(combined) && /development|dfi|world bank|multilateral/.test(spec)) score += 9;
          if (/sovereign|pension|endowment/.test(combined) && /sovereign|pension|endowment|public fund/.test(spec)) score += 7;
          if (/emerging market|latam|latin america/.test(combined) && /emerging|latam|latin|americas/.test(spec)) score += 6;
          if (score === 0) score = 1; // baseline so contacts still appear
          if (score > bestScore) { bestScore = score; bestContact = c; }
        });
        results.push({ firm: r.firm, contact: bestContact || contacts[0] || null, website: r.website || '', score: bestScore, mentioned: true });
      }
    });

    // Sort by relevance score
    results.sort(function(a, b) { return b.score - a.score; });
    return results;
  }

  // Pre-compute hiring managers for all jobs
  jobs.forEach(function(j) { j._hiring_managers = findHiringManagers(j); });

  // Reverse lookup: for each recruiter firm, find all jobs they handle + the assigned contact
  function getJobsForRecruiter(recruiterFirm) {
    var firmLower = (recruiterFirm || '').toLowerCase();
    var firmShort = firmLower.split(/[\u2014\u2013\-,(]/)[0].trim();
    var results = [];
    jobs.forEach(function(j) {
      if (!j._hiring_managers || j._hiring_managers.length === 0) return;
      j._hiring_managers.forEach(function(hm) {
        var hmFirm = (hm.firm || '').toLowerCase();
        if (hmFirm === firmLower || hmFirm.includes(firmShort) || firmLower.includes(hmFirm.split(/[\u2014\u2013\-,(]/)[0].trim())) {
          results.push({ job: j, contact: hm.contact });
        }
      });
    });
    return results;
  }

  // ── Sidebar Navigation ──
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  const sidebarClose = document.getElementById('sidebarClose');
  const navLinks = document.querySelectorAll('.nav-link');
  let overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  hamburger.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
  sidebarClose.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
  function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      navLinks.forEach(l => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById('section-' + section);
      if (target) target.classList.add('active');
      closeSidebar();
      document.getElementById('mainContent').scrollTop = 0;
    });
  });

  // ── Global Search ──
  const globalSearch = document.getElementById('globalSearch');
  globalSearch.addEventListener('input', debounce((e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return;
    // Navigate to jobs and filter
    navLinks.forEach(l => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
    document.querySelector('[data-section="jobs"]').classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('section-jobs').classList.add('active');
    document.getElementById('filterJobSearch').value = q;
    renderJobs();
  }, 300));

  // ── KPI Dashboard ──
  function renderKPIs() {
    const regions = [...new Set(jobs.map(j => j.region).filter(Boolean))];
    const avgSalary = computeAvgSalary();
    const kpis = [
      { label: 'Job Openings', value: jobs.length, detail: 'Matched to profile' },
      { label: 'Target Companies', value: companies.length, detail: 'Across all regions' },
      { label: 'Recruiters', value: recruiters.length, detail: 'Executive search firms' },
      { label: 'Regions Covered', value: regions.length, detail: 'Global coverage' },
      { label: 'Avg. Base Salary', value: avgSalary, detail: 'For matched openings' },
      { label: 'Languages', value: '3', detail: 'EN, ES, HE' }
    ];
    document.getElementById('kpiGrid').innerHTML = kpis.map(k => `
      <div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-detail">${k.detail}</div>
      </div>
    `).join('');
  }

  function computeAvgSalary() {
    let total = 0, count = 0;
    jobs.forEach(j => {
      const match = (j.salary_range || '').match(/\$[\d,]+/g);
      if (match && match.length >= 1) {
        const nums = match.map(m => parseInt(m.replace(/[$,]/g, '')));
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        if (avg > 50000) { total += avg; count++; }
      }
    });
    return count > 0 ? '$' + Math.round(total / count / 1000) + 'K' : 'N/A';
  }

  // ── Charts ──
  let chartInstances = {};
  function renderCharts() {
    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};

    const textColor = getComputedStyle(root).getPropertyValue('--color-text-muted').trim();
    const gridColor = getComputedStyle(root).getPropertyValue('--color-divider').trim();
    const chartColors = ['#0e5c61', '#1a5fa0', '#2d7a1e', '#b45309', '#6b32a8', '#c49000', '#a12c5b', '#437a22'];

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;

    // Region chart
    const regionCounts = {};
    jobs.forEach(j => { const r = j.region || 'Other'; regionCounts[r] = (regionCounts[r] || 0) + 1; });
    const regionLabels = Object.keys(regionCounts);
    chartInstances.region = new Chart(document.getElementById('chartRegion'), {
      type: 'doughnut',
      data: {
        labels: regionLabels,
        datasets: [{ data: Object.values(regionCounts), backgroundColor: chartColors.slice(0, regionLabels.length), borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } } } }
    });

    // Industry chart
    const industryCounts = {};
    companies.forEach(c => { const i = c.industry || 'Other'; industryCounts[i] = (industryCounts[i] || 0) + 1; });
    const sortedInd = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    chartInstances.industry = new Chart(document.getElementById('chartIndustry'), {
      type: 'bar',
      data: {
        labels: sortedInd.map(i => {
          const abbrev = { 'Development Finance Institution': 'DFI', 'Impact/ESG Investment Firm': 'Impact/ESG Firm', 'Insurance Investment Arm': 'Insurance (Inv.)' };
          const label = abbrev[i[0]] || i[0];
          return label.length > 24 ? label.substring(0, 24) + '...' : label;
        }),
        datasets: [{ data: sortedInd.map(i => i[1]), backgroundColor: '#0e5c61', borderRadius: 4, maxBarThickness: 32 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } }
      }
    });

    // Compensation chart
    const compLabels = compensation.slice(0, 8).map(c => {
      const name = c.category || c.institution_type || c.sector || 'Unknown';
      return name.length > 20 ? name.substring(0, 20) + '...' : name;
    });
    const compMins = [], compMaxs = [];
    compensation.slice(0, 8).forEach(c => {
      const roles = c.roles || c.levels || [];
      let min = Infinity, max = 0;
      roles.forEach(r => {
        const rangeStr = r.total_comp_range || r.total_cash_range || r.total_compensation || r.total_comp || r.base_salary_range_usd || r.salary_range || r.base_salary || '';
        const nums = (rangeStr.match(/[\d,]+/g) || []).map(n => parseInt(n.replace(/,/g, '')));
        nums.forEach(n => { if (n > 10000) { min = Math.min(min, n); max = Math.max(max, n); } });
      });
      compMins.push(min === Infinity ? 0 : min / 1000);
      compMaxs.push(max / 1000);
    });

    chartInstances.comp = new Chart(document.getElementById('chartComp'), {
      type: 'bar',
      data: {
        labels: compLabels,
        datasets: [
          { label: 'Min ($K)', data: compMins, backgroundColor: '#1a5fa0', borderRadius: 3, maxBarThickness: 28 },
          { label: 'Max ($K)', data: compMaxs, backgroundColor: '#0e5c61', borderRadius: 3, maxBarThickness: 28 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
          y: { grid: { drawBorder: false }, ticks: { callback: v => '$' + v + 'K', font: { size: 11 } } }
        }
      }
    });
  }

  // ── Priority Scoring System ──
  function computePriorityScore(j) {
    var score = 0;
    var fitText = (j.goldie_fit || '').toLowerCase();
    var title = (j.title || '').toLowerCase();
    var company = (j.company || '').toLowerCase();
    var region = (j.region || '').toLowerCase();
    var location = (j.location || '').toLowerCase();

    // 1. FIT QUALITY (0-40 points) — parse goldie_fit text for quality signals
    if (/exceptional|outstanding|perfect|#1 most/.test(fitText)) score += 40;
    else if (/excellent|very strong|most natural fit|exact mirror/.test(fitText)) score += 35;
    else if (/strong (?!industry)|natural fit|natural extension|directly applicable/.test(fitText)) score += 28;
    else if (/good fit|good potential/.test(fitText)) score += 20;
    else if (/moderate-strong|moderate-to-strong/.test(fitText)) score += 15;
    else if (/moderate fit/.test(fitText)) score += 10;
    else score += 18; // descriptive text without explicit rating, assume decent fit

    // 2. SENIORITY LEVEL (0-25 points)
    if (/\bcio\b|chief investment officer|chief executive/.test(title)) score += 25;
    else if (/global head|head of/.test(title)) score += 22;
    else if (/senior managing director/.test(title)) score += 21;
    else if (/\bpartner\b/.test(title) && /managing director/.test(title)) score += 20;
    else if (/\bpartner\b/.test(title)) score += 19;
    else if (/executive vice president|\bevp\b/.test(title)) score += 18;
    else if (/managing director/.test(title)) score += 17;
    else if (/senior vice president|\bsvp\b/.test(title)) score += 16;
    else if (/\bdirector\b|\bprincipal\b/.test(title)) score += 14;

    // 3. INDUSTRY ALIGNMENT (0-15 points) — priority sectors
    if (/fund.of.fund|fof|fund investments/.test(title + ' ' + fitText)) score += 15;
    else if (/critical mineral|mining|metals|battery|lithium|cobalt|rare earth/.test(title + ' ' + fitText)) score += 14;
    else if (/development finance|dfi|\bifc\b|\bebrd\b|\bidb\b|\badb\b|\bafdb\b|\baiib\b|\bbii\b/.test(title + ' ' + company + ' ' + fitText)) score += 13;
    else if (/climate|impact|esg|sustainability|clean energy/.test(title + ' ' + fitText)) score += 12;
    else if (/infrastructure|energy/.test(title + ' ' + fitText)) score += 11;
    else if (/private equity|\bpe\b|alternatives/.test(title + ' ' + fitText)) score += 10;
    else if (/sovereign wealth|pension|endowment/.test(title + ' ' + company + ' ' + fitText)) score += 9;
    else score += 5;

    // 4. LOCATION PREFERENCE (0-10 points)
    if (/washington|\bdc\b|baltimore|virginia|maryland/.test(location)) score += 10;
    else if (/global|multiple|candidate.s choice|remote/.test(location)) score += 8;
    else if (/new york|miami|americas/.test(location)) score += 7;
    else if (/latin america|caribbean|bogot|lima|mexico|s[aã]o paulo/.test(location)) score += 7;
    else if (/london|europe|geneva|zurich/.test(location)) score += 5;
    else score += 3;

    // 5. RECENCY (0-10 points)
    var posted = j.date_posted || '';
    var postDate = new Date(posted);
    if (!isNaN(postDate.getTime())) {
      var daysAgo = Math.floor((Date.now() - postDate.getTime()) / 86400000);
      if (daysAgo <= 7) score += 10;
      else if (daysAgo <= 30) score += 8;
      else if (daysAgo <= 90) score += 5;
      else if (daysAgo <= 180) score += 2;
    }

    return score;
  }

  // ── Salary Parser ──
  function parseSalaryMax(j) {
    // Extract the highest numeric salary value from salary or salary_range fields
    var text = (j.salary || '') + ' ' + (j.salary_range || '');
    if (!text.trim()) return 0;
    // Normalize: remove escaped $ signs
    text = text.replace(/\\\$/g, '$');
    // Remove non-salary dollar amounts (e.g. "$77M-funded company", "$1.5T AUM")
    text = text.replace(/\$[\d.,]+[MBTmbt][-\s]*(funded|raised|aum|revenue|asset|capital|company)/gi, '');
    // Find all dollar amounts
    var amounts = [];
    // Match patterns like $400,000 or $400K or $47,208.33 or $1.5M
    var re = /\$([\d,]+(?:\.\d+)?)(\s*[KkMm])?/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var num = parseFloat(m[1].replace(/,/g, ''));
      if (m[2]) {
        var suffix = m[2].trim().toUpperCase();
        if (suffix === 'K') num *= 1000;
        if (suffix === 'M') num *= 1000000;
      }
      // Detect per-month values (e.g. CalPERS $47,208/month)
      if (/per\s*month|monthly|month/i.test(text) && num < 100000) {
        num *= 12;
      }
      // Cap at $5M — no individual comp exceeds this realistically
      if (num <= 5000000) {
        amounts.push(num);
      }
    }
    // Also try bare number patterns like 200,000 without $
    if (amounts.length === 0) {
      var re2 = /(\d{3},\d{3})/g;
      while ((m = re2.exec(text)) !== null) {
        var val = parseFloat(m[1].replace(/,/g, ''));
        if (val <= 5000000) amounts.push(val);
      }
    }
    return amounts.length > 0 ? Math.max.apply(null, amounts) : 0;
  }

  function formatSalaryBadge(j) {
    if (j._salary_max >= 1000000) {
      return '$' + (j._salary_max / 1000000).toFixed(1) + 'M+';
    }
    if (j._salary_max >= 1000) {
      return '$' + Math.round(j._salary_max / 1000) + 'K';
    }
    // Fallback to raw text
    var raw = (j.salary_range || j.salary || '').split(';')[0].split('plus')[0].trim();
    return raw.length > 40 ? raw.substring(0, 37) + '...' : raw;
  }

  // Score all jobs, parse salary, and sort
  jobs.forEach(function(j) {
    j._priority_score = computePriorityScore(j);
    j._salary_max = parseSalaryMax(j);
  });
  var jobsByPriority = jobs.slice().sort(function(a, b) { return b._priority_score - a._priority_score; });

  // ── Top Priority Jobs ──
  function renderTopJobs() {
    const top = jobsByPriority.slice(0, 6);
    document.getElementById('topJobs').innerHTML = top.map((j) => {
      var scoreLabel = j._priority_score >= 80 ? 'Exceptional' : j._priority_score >= 65 ? 'Very Strong' : j._priority_score >= 50 ? 'Strong' : 'Good';
      var scoreColor = j._priority_score >= 80 ? '#0e5c61' : j._priority_score >= 65 ? '#1a5fa0' : j._priority_score >= 50 ? '#2d7a1e' : '#b45309';
      var origIdx = jobs.indexOf(j);
      return `
      <div class="result-card" data-job-idx="${origIdx}">
        <div class="result-header">
          <div>
            <div class="result-title">${esc(j.title)}</div>
            <div class="result-company">${esc(j.company)}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span class="badge" style="background:${scoreColor}; color:#fff; font-size:11px; padding:2px 8px; border-radius:12px;">${scoreLabel} (${j._priority_score})</span>
            ${j.salary_range ? `<span class="badge badge-salary">${esc(j.salary_range.split(';')[0].trim())}</span>` : ''}
          </div>
        </div>
        <div class="result-meta">
          <span class="result-meta-item">📍 ${esc(j.location || 'Global')}</span>
          <span class="result-meta-item">${esc(j.region || '')}</span>
        </div>
        <div class="result-fit">${esc(j.goldie_fit || '')}</div>
      </div>`;
    }).join('');
    bindJobClicks();
  }

  // ── Jobs Section ──
  let jobPage = 1;
  const JOBS_PER_PAGE = 20;
  var jobPillFilter = 'all';
  var VIEWED_JOBS_KEY = 'gs_viewed_jobs';

  function getViewedJobs() {
    try {
      if (_store) {
        var s = _store.getItem(VIEWED_JOBS_KEY);
        if (s) return JSON.parse(s);
      }
      return [];
    } catch (e) { return []; }
  }

  function markJobViewed(jobId) {
    var viewed = getViewedJobs();
    if (viewed.indexOf(jobId) === -1) {
      viewed.push(jobId);
      try {
        if (_store) _store.setItem(VIEWED_JOBS_KEY, JSON.stringify(viewed));
      } catch (e) { /* ignore */ }
    }
  }

  function isJobUnread(job) {
    var viewed = getViewedJobs();
    return viewed.indexOf(job.id) === -1;
  }

  function getSavedJobIds() {
    var items = getPipelineItems();
    return items.filter(function(i) { return i.type === 'job'; }).map(function(i) { return i.name; });
  }

  function populateJobFilters() {
    const regions = [...new Set(jobs.map(j => j.region).filter(Boolean))].sort();
    const fRegion = document.getElementById('filterRegion');
    regions.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; fRegion.appendChild(o); });

    // Derive rough industry from company names or use source field
    const industries = ['Private Equity', 'Development Finance', 'Infrastructure', 'Insurance', 'Climate/Impact', 'Fund-of-Funds', 'Sovereign Wealth', 'Pension Fund', 'Foundation', 'Endowment', 'Corporate Venture Capital', 'Emerging Markets', 'Family Office', 'Investment Consulting', 'Alternatives', 'Due Diligence', 'Investor Relations', 'Fund Solutions', 'Critical Minerals'];
    const fInd = document.getElementById('filterIndustry');
    industries.forEach(i => { const o = document.createElement('option'); o.value = i; o.textContent = i; fInd.appendChild(o); });
  }

  function getFilteredJobs() {
    const region = document.getElementById('filterRegion').value;
    const industry = document.getElementById('filterIndustry').value;
    const search = document.getElementById('filterJobSearch').value.toLowerCase();

    return jobs.filter(j => {
      // Pill filter
      if (jobPillFilter === 'new' && !isJobNew(j)) return false;
      if (jobPillFilter === 'unread' && !isJobUnread(j)) return false;
      if (jobPillFilter === 'active' && j.status === 'networking_target') return false;
      if (jobPillFilter === 'networking' && j.status !== 'networking_target') return false;
      if (jobPillFilter === 'saved') {
        var savedNames = getSavedJobIds();
        if (savedNames.indexOf(j.title) === -1) return false;
      }
      if (region && j.region !== region) return false;
      if (industry) {
        const text = ((j.title || '') + ' ' + (j.company || '') + ' ' + (j.goldie_fit || '') + ' ' + (j.suggested_recruiter || '') + ' ' + (j.requirements || '')).toLowerCase();
        var kw = industry.toLowerCase();
        // Map filter labels to broader search keywords
        var keyMap = {
          'climate/impact': 'climate|impact|esg|sustainab',
          'fund-of-funds': 'fund.of.fund|fof|fund invest',
          'pension fund': 'pension|retirement|superannuation|calpers|calstrs',
          'foundation': 'foundation|philanthrop|endowment fund',
          'endowment': 'endowment|university invest|nyu|harvard|yale|stanford',
          'corporate venture capital': 'corporate venture|cvc|corporate invest|venture capital.*corp',
          'emerging markets': 'emerging market|frontier|developing|latam|latin america|africa|asia.pacific|idb|ifc|dfc|dfi|development finance',
          'family office': 'family office|family invest|single.family|multi.family|uhnw|high.net.worth',
          'investment consulting': 'investment consult|ocio|outsourced cio|advisory|cambridge associate|mercer|consultant',
          'alternatives': 'alternative|hedge fund|real asset|private market|private capital|real estate fund',
          'due diligence': 'due diligence|compliance|risk|integrity|investigation',
          'investor relations': 'investor relation|\bir\b|capital raising|fundrais',
          'fund solutions': 'fund solution|fund service|fund admin|custody|transfer agent|fund account',
          'critical minerals': 'critical mineral|mining|metals|battery|lithium|cobalt|rare earth|nickel|copper|graphite|manganese|mineral'
        };
        var pattern = keyMap[kw] || kw.split('/')[0].trim();
        if (!new RegExp(pattern).test(text)) return false;
      }
      if (search) {
        const text = ((j.title || '') + ' ' + (j.company || '') + ' ' + (j.location || '')).toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });
  }

  function sortJobs(arr) {
    var sortVal = document.getElementById('sortJobs').value;
    var sorted = arr.slice();
    switch (sortVal) {
      case 'salary-desc':
        sorted.sort(function(a, b) { return (b._salary_max || 0) - (a._salary_max || 0); });
        break;
      case 'salary-asc':
        sorted.sort(function(a, b) {
          // Put jobs with no salary at the end
          var sa = a._salary_max || Number.MAX_SAFE_INTEGER;
          var sb = b._salary_max || Number.MAX_SAFE_INTEGER;
          return sa - sb;
        });
        break;
      case 'date':
        sorted.sort(function(a, b) {
          var da = new Date(a.date_posted || '1970-01-01');
          var db = new Date(b.date_posted || '1970-01-01');
          if (isNaN(da.getTime())) da = new Date('1970-01-01');
          if (isNaN(db.getTime())) db = new Date('1970-01-01');
          return db - da;
        });
        break;
      case 'title':
        sorted.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });
        break;
      case 'company':
        sorted.sort(function(a, b) { return (a.company || '').localeCompare(b.company || ''); });
        break;
      default: // priority
        sorted.sort(function(a, b) { return (b._priority_score || 0) - (a._priority_score || 0); });
    }
    return sorted;
  }

  function renderJobs() {
    var filtered = sortJobs(getFilteredJobs());
    document.getElementById('jobCount').textContent = filtered.length;
    updatePillCounts();
    const start = (jobPage - 1) * JOBS_PER_PAGE;
    const paged = filtered.slice(start, start + JOBS_PER_PAGE);

    document.getElementById('jobsList').innerHTML = paged.map(j => {
      const idx = jobs.indexOf(j);
      return `
      <div class="result-card${isJobNew(j) ? ' result-card-new' : ''}" data-job-idx="${idx}">
        <div class="result-header">
          <div>
            <div class="result-title">${isJobUnread(j) ? '<span class="unread-dot"></span>' : ''}${isJobNew(j) ? '<span class="new-badge">NEW</span> ' : ''}${esc(j.title)}</div>
            <div class="result-company">${esc(j.company)}</div>
          </div>
          ${(j.salary_range || j.salary) ? `<span class="badge badge-salary">${esc(formatSalaryBadge(j))}</span>` : '<span class="badge">Salary TBD</span>'}
        </div>
        <div class="result-tags">
          ${j.industry ? `<span class="tag tag-industry">${esc(j.industry.split('/')[0].split(',')[0].trim())}</span>` : ''}
          ${j.status === 'networking_target' ? '<span class="tag tag-networking">Networking Target</span>' : '<span class="tag tag-active">Active</span>'}
          ${j.region ? `<span class="tag tag-region">${esc(j.region)}</span>` : ''}
        </div>
        <div class="result-meta">
          <span class="result-meta-item">📍 ${esc(j.location || 'Global')}</span>
          ${j.date_posted ? `<span class="result-meta-item">Posted: ${esc(j.date_posted)}</span>` : ''}
          ${j.suggested_recruiter ? `<span class="result-meta-item">🔍 ${esc(truncate(j.suggested_recruiter, 50))}</span>` : ''}
          ${j._hiring_managers && j._hiring_managers.length > 0 ? `<span class="result-meta-item" style="color:var(--color-primary);">👤 ${esc(j._hiring_managers[0].contact ? j._hiring_managers[0].contact.name : j._hiring_managers[0].firm)}</span>` : ''}
        </div>
        <div class="result-fit">${esc(j.goldie_fit || '')}</div>
      </div>`;
    }).join('') + renderPagination(filtered.length, jobPage, JOBS_PER_PAGE, 'job');
    bindJobClicks();
    bindPagination('job', filtered.length, () => { renderJobs(); });
  }

  function openJobDetail(idx) {
    const j = jobs[idx];
    if (!j) return;
    markJobViewed(j.id);
    updatePillCounts();
    renderJobs(); // re-render to update unread dot
    document.getElementById('jobDetailTitle').textContent = j.title;

    const recruiterMatch = findMatchingRecruiter(j);

    document.getElementById('jobDetailBody').innerHTML = `
      <div class="job-detail-grid">
        <div class="job-detail-section">
          <div class="job-detail-label">Company</div>
          <div class="job-detail-value">${esc(j.company)}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Industry</div>
          <div class="job-detail-value">${esc(j.industry || 'Not specified')}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Status</div>
          <div class="job-detail-value">${j.status === 'networking_target' ? '<span class="tag tag-networking">Networking Target</span> — No confirmed open posting. Monitor for openings.' : '<span class="tag tag-active">Active Listing</span>'}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Location</div>
          <div class="job-detail-value">${esc(j.location || 'Not specified')} · ${esc(j.region || '')}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Compensation</div>
          <div class="job-detail-value">${esc(j.salary_range || j.salary || 'Contact recruiter for details')}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Requirements</div>
          <div class="job-detail-value">${esc(j.requirements || 'See job posting')}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Why Goldie Fits</div>
          <div class="job-detail-value" style="color: var(--color-primary);">${esc(j.goldie_fit || '')}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">LinkedIn Connection</div>
          <div class="job-detail-value">${getLinkedInConnection(j)}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Suggested Recruiter</div>
          <div class="job-detail-value">${esc(j.suggested_recruiter || 'Apply directly')}${recruiterMatch ? '<br><span style="color:var(--color-primary);">Found in our recruiter database — see Recruiters tab for details</span>' : ''}</div>
        </div>
        ${j._hiring_managers && j._hiring_managers.length > 0 ? `
        <div class="job-detail-section">
          <div class="job-detail-label">Internal Hiring Manager(s)</div>
          <div class="job-detail-value">
            ${j._hiring_managers.map(function(hm) {
              var c = hm.contact;
              if (!c) return '<div class="recruiter-match-item"><strong>' + esc(hm.firm) + '</strong></div>';
              return '<div class="recruiter-match-item">' +
                '<div><strong>' + esc(hm.firm) + '</strong></div>' +
                '<div style="margin-top:2px;">' + esc(c.name) + ' — ' + esc(c.title) + '</div>' +
                '<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px;">Specialization: ' + esc(c.specialization || 'General executive search') + '</div>' +
                (hm.website ? '<a href="' + esc(hm.website) + '" target="_blank" rel="noopener" class="card-link" style="font-size:var(--text-xs);color:var(--color-blue);margin-top:2px;display:inline-block;">Firm Website ↗</a>' : '') +
              '</div>';
            }).join('')}
          </div>
        </div>` : ''}
        <div class="job-detail-section">
          <div class="job-detail-label">How to Apply</div>
          <div class="job-detail-value">${esc(j.application_method || 'See link below')}</div>
        </div>
        <div class="job-detail-actions">
          ${j.application_url ? `<a href="${esc(j.application_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Apply Now</a>` : ''}
          ${j.source_url ? `<a href="${esc(j.source_url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">View Source</a>` : ''}
          <button class="btn btn-outline btn-sm track-btn${isTracked('job', j.title) ? ' tracked' : ''}" data-track-type="job" data-track-name="${esc(j.title)}" data-track-company="${esc(j.company)}" data-track-url="${esc(j.application_url || j.source_url || '')}">${isTracked('job', j.title) ? '\u2713 Tracked' : '\uD83D\uDCCC Track'}</button>
        </div>
      </div>
    `;
    document.getElementById('jobDetailModal').classList.add('show');
  }

  function getLinkedInConnection(job) {
    const companyLower = (job.company || '').toLowerCase();
    // Check known connections
    if (companyLower.includes('idb') || companyLower.includes('inter-american')) {
      return 'Direct connection — Goldie spent 7+ years at IDB Invest managing PE investments across LatAm. Strong alumni network.';
    }
    if (companyLower.includes('dfc') || companyLower.includes('development finance')) {
      return 'Current employer — Goldie is Acting VP at DFC. Internal mobility or leveraged network connection.';
    }
    if (companyLower.includes('evercore') || companyLower.includes('protego')) {
      return 'Former employer — Goldie was a Financial Analyst at Protego/Evercore in Mexico City. Alumni network.';
    }
    if (companyLower.includes('world bank') || companyLower.includes('ifc')) {
      return 'Adjacent DFI network — Goldie has extensive relationships with IFC through DFC co-investments and IDB Invest collaboration.';
    }
    if (companyLower.includes('stepstone') || companyLower.includes('hamilton lane')) {
      return 'LP/GP relationship — As DFC fund investor, Goldie has likely engaged with this firm through fund due diligence.';
    }
    if (companyLower.includes('brookfield') || companyLower.includes('blackstone') || companyLower.includes('kkr')) {
      return 'Industry network — Goldie has evaluated and invested alongside major PE firms through DFC and IDB Invest fund programs.';
    }
    return 'Potential connection via Goldie\'s 500+ LinkedIn connections, Wharton alumni network, or DFC/IDB institutional relationships.';
  }

  function findMatchingRecruiter(job) {
    const text = (job.suggested_recruiter || '').toLowerCase();
    return recruiters.find(r => text.includes((r.firm || '').toLowerCase().split(' ')[0]));
  }

  function bindJobClicks() {
    document.querySelectorAll('[data-job-idx]').forEach(el => {
      el.addEventListener('click', () => openJobDetail(parseInt(el.dataset.jobIdx)));
    });
  }

  // ── Companies Section ──
  let companyPage = 1;
  const COMPANIES_PER_PAGE = 20;

  function populateCompanyFilters() {
    const regions = [...new Set(companies.map(c => c.region).filter(Boolean))].sort();
    const industries = [...new Set(companies.map(c => c.industry).filter(Boolean))].sort();
    const fRegion = document.getElementById('filterCompRegion');
    regions.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; fRegion.appendChild(o); });
    const fInd = document.getElementById('filterCompIndustry');
    industries.forEach(i => { const o = document.createElement('option'); o.value = i; o.textContent = i; fInd.appendChild(o); });
  }

  function getFilteredCompanies() {
    const region = document.getElementById('filterCompRegion').value;
    const industry = document.getElementById('filterCompIndustry').value;
    const search = document.getElementById('filterCompSearch').value.toLowerCase();
    return companies.filter(c => {
      if (region && c.region !== region) return false;
      if (industry && c.industry !== industry) return false;
      if (search && !(c.name || '').toLowerCase().includes(search)) return false;
      return true;
    });
  }

  // ── Company-to-Recruiter Matching ──
  // Build a map from company names to suggested recruiters (from job data)
  var companyRecruiterMap = {};
  jobs.forEach(function(j) {
    var comp = (j.company || '').toLowerCase().trim();
    var rec = j.suggested_recruiter || '';
    if (comp && rec) companyRecruiterMap[comp] = rec;
  });

  function findRelevantRecruiters(company) {
    var compName = (company.name || '').toLowerCase().trim();
    var compIndustry = (company.industry || '').toLowerCase();
    var results = [];

    // 1. Direct match from job suggested_recruiter
    var directRec = companyRecruiterMap[compName] || '';
    // Also check partial match (some company names differ slightly)
    if (!directRec) {
      Object.keys(companyRecruiterMap).forEach(function(k) {
        if (k.includes(compName.split('(')[0].trim()) || compName.includes(k.split('(')[0].trim())) {
          directRec = companyRecruiterMap[k];
        }
      });
    }

    // 2. Industry match from recruiter data
    var industryKeywords = compIndustry.split(/[/,&]/).map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
    recruiters.forEach(function(r) {
      var rIndustries = (r.industries || []).map(function(i) { return i.toLowerCase(); });
      var match = false;
      industryKeywords.forEach(function(kw) {
        rIndustries.forEach(function(ri) {
          if (ri.includes(kw) || kw.includes(ri.split('/')[0].trim())) match = true;
        });
      });
      // Also match common mappings
      if (compIndustry.includes('private equity') && rIndustries.some(function(i) { return i.includes('private equity'); })) match = true;
      if (compIndustry.includes('infrastructure') && rIndustries.some(function(i) { return i.includes('infrastructure'); })) match = true;
      if (compIndustry.includes('development finance') && rIndustries.some(function(i) { return i.includes('development finance'); })) match = true;
      if (compIndustry.includes('fund-of-funds') && rIndustries.some(function(i) { return i.includes('fund-of-funds') || i.includes('asset management'); })) match = true;
      if (compIndustry.includes('sovereign') && rIndustries.some(function(i) { return i.includes('sovereign'); })) match = true;
      if (compIndustry.includes('impact') && rIndustries.some(function(i) { return i.includes('impact') || i.includes('esg'); })) match = true;
      if (compIndustry.includes('insurance') && rIndustries.some(function(i) { return i.includes('insurance'); })) match = true;
      if (compIndustry.includes('climate') && rIndustries.some(function(i) { return i.includes('climate'); })) match = true;
      if (match) results.push(r);
    });

    return { directHint: directRec, industryMatches: results.slice(0, 3) };
  }

  function renderCompanies() {
    const filtered = getFilteredCompanies();
    document.getElementById('companyCount').textContent = filtered.length;
    const start = (companyPage - 1) * COMPANIES_PER_PAGE;
    const paged = filtered.slice(start, start + COMPANIES_PER_PAGE);

    document.getElementById('companiesList').innerHTML = paged.map((c, idx) => {
      const leaders = (c.leadership || []).slice(0, 3);
      const allLeaders = c.leadership || [];
      const nc = c.network_contact;
      const cardId = 'company-card-' + (start + idx);
      const recMatch = findRelevantRecruiters(c);
      const topRecFirm = recMatch.industryMatches.length > 0 ? recMatch.industryMatches[0].firm : '';
      return `
      <div class="result-card expandable-card" id="${cardId}" role="button" tabindex="0" aria-expanded="false">
        <div class="result-header">
          <div>
            <div class="result-title">${esc(c.name)}</div>
            <div class="result-company">${esc(c.industry)} · ${esc(c.sub_sector || '')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span class="badge badge-primary">${esc(c.region || '')}</span>
            <span class="expand-icon">▸</span>
          </div>
        </div>
        <div class="result-meta">
          <span class="result-meta-item">📍 ${esc(c.headquarters || c.country || '')}</span>
          ${c.aum_or_revenue ? `<span class="result-meta-item">💰 ${esc(truncate(c.aum_or_revenue, 30))}</span>` : ''}
          ${topRecFirm ? `<span class="result-meta-item" style="color:var(--color-primary);">🔍 ${esc(topRecFirm)}</span>` : ''}
          ${c.website ? `<span class="result-meta-item"><a href="${esc(c.website)}" target="_blank" rel="noopener" class="card-link" style="color:var(--color-blue);">Website ↗</a></span>` : ''}
        </div>
        <div class="result-fit">${esc(truncate(c.relevance || '', 120))}</div>
        <div class="card-detail-panel">
          <div class="card-detail-divider"></div>
          ${c.relevance ? `
          <div class="job-detail-section">
            <div class="job-detail-label">Relevance to Goldie</div>
            <div class="job-detail-value">${esc(c.relevance)}</div>
          </div>` : ''}
          ${c.aum_or_revenue ? `
          <div class="job-detail-section">
            <div class="job-detail-label">AUM / Revenue</div>
            <div class="job-detail-value">${esc(c.aum_or_revenue)}</div>
          </div>` : ''}
          ${allLeaders.length > 0 ? `
          <div class="job-detail-section">
            <div class="job-detail-label">Key Leadership</div>
            <div class="job-detail-value">${allLeaders.map(l => `<div class="leadership-item"><strong>${esc(l.name)}</strong> — ${esc(l.title)}</div>`).join('')}</div>
          </div>` : ''}
          ${nc ? `
          <div class="job-detail-section">
            <div class="job-detail-label">Networking Contact</div>
            <div class="job-detail-value"><strong>${esc(nc.name)}</strong> (${esc(nc.title)})<br><em style="color:var(--color-primary);">${esc(nc.reason || '')}</em></div>
          </div>` : ''}
          <div class="job-detail-section">
            <div class="job-detail-label">Relevant Recruiters</div>
            <div class="job-detail-value">
              ${recMatch.directHint ? `<div class="recruiter-hint"><strong>From job data:</strong> ${esc(recMatch.directHint)}</div>` : ''}
              ${recMatch.industryMatches.length > 0 ? recMatch.industryMatches.map(function(r) {
                var contact = (r.key_contacts || [])[0];
                return '<div class="recruiter-match-item">' +
                  '<div><strong>' + esc(r.firm) + '</strong></div>' +
                  (contact ? '<div style="font-size:var(--text-xs);color:var(--color-text-muted);">' + esc(contact.name) + ' — ' + esc(contact.title) + '</div>' : '') +
                  (r.website ? '<a href="' + esc(r.website) + '" target="_blank" rel="noopener" class="card-link" style="font-size:var(--text-xs);color:var(--color-blue);">Website ↗</a>' : '') +
                '</div>';
              }).join('') : '<div style="color:var(--color-text-muted);">No industry-matched recruiters found</div>'}
            </div>
          </div>
          ${c.website ? `
          <div class="job-detail-actions" style="margin-top:var(--space-3);">
            <a href="${esc(c.website)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm card-link">Visit Website ↗</a>
            <button class="btn btn-outline btn-sm track-btn${isTracked('company', c.name) ? ' tracked' : ''}" data-track-type="company" data-track-name="${esc(c.name)}" data-track-company="${esc(c.name)}" data-track-url="${esc(c.website || '')}">${isTracked('company', c.name) ? '\u2713 Tracked' : '\uD83D\uDCCC Track'}</button>
          </div>` : `
          <div class="job-detail-actions" style="margin-top:var(--space-3);">
            <button class="btn btn-outline btn-sm track-btn${isTracked('company', c.name) ? ' tracked' : ''}" data-track-type="company" data-track-name="${esc(c.name)}" data-track-company="${esc(c.name)}" data-track-url="">${isTracked('company', c.name) ? '\u2713 Tracked' : '\uD83D\uDCCC Track'}</button>
          </div>`}
        </div>
      </div>`;
    }).join('') + renderPagination(filtered.length, companyPage, COMPANIES_PER_PAGE, 'company');
    bindPagination('company', filtered.length, () => { renderCompanies(); });
    bindExpandableCards('companiesList');
  }

  // ── Recruiters Section ──
  let recruiterPage = 1;
  const REC_PER_PAGE = 20;

  function populateRecruiterFilters() {
    const allIndustries = new Set();
    recruiters.forEach(r => (r.industries || []).forEach(i => allIndustries.add(i)));
    const fInd = document.getElementById('filterRecIndustry');
    [...allIndustries].sort().forEach(i => { const o = document.createElement('option'); o.value = i; o.textContent = i; fInd.appendChild(o); });
  }

  function getFilteredRecruiters() {
    const industry = document.getElementById('filterRecIndustry').value;
    const type = document.getElementById('filterRecType').value;
    const search = document.getElementById('filterRecSearch').value.toLowerCase();
    return recruiters.filter(r => {
      if (industry && !(r.industries || []).includes(industry)) return false;
      if (type && r.search_type !== type) return false;
      if (search && !(r.firm || '').toLowerCase().includes(search)) return false;
      return true;
    });
  }

  function renderRecruiters() {
    const filtered = getFilteredRecruiters();
    document.getElementById('recruiterCount').textContent = filtered.length;
    const start = (recruiterPage - 1) * REC_PER_PAGE;
    const paged = filtered.slice(start, start + REC_PER_PAGE);

    document.getElementById('recruitersList').innerHTML = paged.map((r, idx) => {
      const allContacts = r.key_contacts || [];
      const firmJobs = getJobsForRecruiter(r.firm);
      const cardId = 'recruiter-card-' + (start + idx);
      return `
      <div class="result-card expandable-card" id="${cardId}" role="button" tabindex="0" aria-expanded="false">
        <div class="result-header">
          <div>
            <div class="result-title">${esc(r.firm)}</div>
            <div class="result-company">${(r.industries || []).slice(0, 3).join(' · ')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-2);">
            <span class="badge ${r.search_type === 'retained' ? 'badge-primary' : 'badge-warning'}">${esc(r.search_type || 'N/A')}</span>
            <span class="expand-icon">▸</span>
          </div>
        </div>
        <div class="result-meta">
          <span class="result-meta-item">🌍 ${esc(truncate(r.geographic_focus || 'Global', 50))}</span>
          ${firmJobs.length > 0 ? `<span class="result-meta-item" style="color:var(--color-primary);">💼 ${firmJobs.length} active job${firmJobs.length > 1 ? 's' : ''}</span>` : ''}
          ${r.website ? `<span class="result-meta-item"><a href="${esc(r.website)}" target="_blank" rel="noopener" class="card-link" style="color:var(--color-blue);">Website ↗</a></span>` : ''}
        </div>
        <div class="result-fit">${esc(truncate(r.reputation || '', 120))}</div>
        <div class="card-detail-panel">
          <div class="card-detail-divider"></div>
          ${r.reputation ? `
          <div class="job-detail-section">
            <div class="job-detail-label">Reputation</div>
            <div class="job-detail-value">${esc(r.reputation)}</div>
          </div>` : ''}
          <div class="job-detail-section">
            <div class="job-detail-label">Geographic Focus</div>
            <div class="job-detail-value">${esc(r.geographic_focus || 'Global')}</div>
          </div>
          <div class="job-detail-section">
            <div class="job-detail-label">Industries Covered</div>
            <div class="job-detail-value">${(r.industries || []).join(', ') || 'Generalist'}</div>
          </div>
          ${allContacts.length > 0 ? `
          <div class="job-detail-section">
            <div class="job-detail-label">Key Contacts</div>
            <div class="job-detail-value">${allContacts.map(c => `<div class="leadership-item"><strong>${esc(c.name)}</strong> — ${esc(c.title || '')} <em style="color:var(--color-text-muted);">${esc(c.specialization || '')}</em></div>`).join('')}</div>
          </div>` : ''}
          ${firmJobs.length > 0 ? `
          <div class="job-detail-section">
            <div class="job-detail-label">Active Job Assignments (${firmJobs.length})</div>
            <div class="job-detail-value">${firmJobs.map(function(fj) {
              var contactName = fj.contact ? fj.contact.name : 'Unassigned';
              var contactTitle = fj.contact ? fj.contact.title : '';
              var jobUrl = fj.job.source_url || '';
              return '<a href="' + esc(jobUrl) + '" target="_blank" rel="noopener" class="recruiter-job-link card-link" style="display:block;padding:var(--space-2) var(--space-2);margin:0 calc(-1 * var(--space-2));border-bottom:1px solid var(--color-border);border-radius:var(--radius-sm);text-decoration:none;color:inherit;transition:background .15s;"' + (jobUrl ? '' : ' onclick="event.preventDefault()"') + '>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);">' +
                  '<div><strong style="color:var(--color-primary);">' + esc(fj.job.title) + '</strong> at ' + esc(fj.job.company) + '</div>' +
                  (jobUrl ? '<span style="flex-shrink:0;font-size:var(--text-xs);color:var(--color-blue);">Apply \u2197</span>' : '') +
                '</div>' +
                '<div style="font-size:var(--text-xs);color:var(--color-primary);margin-top:2px;">Hiring Manager: ' + esc(contactName) + (contactTitle ? ' (' + esc(contactTitle) + ')' : '') + '</div>' +
                (fj.job.region ? '<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:1px;">' + esc(fj.job.region) + '</div>' : '') +
              '</a>';
            }).join('')}</div>
          </div>` : ''}
          ${r.engagement_process ? `
          <div class="job-detail-section">
            <div class="job-detail-label">How to Engage</div>
            <div class="job-detail-value">${esc(r.engagement_process)}</div>
          </div>` : ''}
          ${r.website ? `
          <div class="job-detail-actions" style="margin-top:var(--space-3);">
            <a href="${esc(r.website)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm card-link">Visit Website ↗</a>
            <button class="btn btn-outline btn-sm track-btn${isTracked('recruiter', r.firm) ? ' tracked' : ''}" data-track-type="recruiter" data-track-name="${esc(r.firm)}" data-track-company="${esc(r.firm)}" data-track-url="${esc(r.website || '')}">${isTracked('recruiter', r.firm) ? '\u2713 Tracked' : '\uD83D\uDCCC Track'}</button>
          </div>` : `
          <div class="job-detail-actions" style="margin-top:var(--space-3);">
            <button class="btn btn-outline btn-sm track-btn${isTracked('recruiter', r.firm) ? ' tracked' : ''}" data-track-type="recruiter" data-track-name="${esc(r.firm)}" data-track-company="${esc(r.firm)}" data-track-url="">${isTracked('recruiter', r.firm) ? '\u2713 Tracked' : '\uD83D\uDCCC Track'}</button>
          </div>`}
        </div>
      </div>`;
    }).join('') + renderPagination(filtered.length, recruiterPage, REC_PER_PAGE, 'recruiter');
    bindPagination('recruiter', filtered.length, () => { renderRecruiters(); });
    bindExpandableCards('recruitersList');
  }

  // ── Compensation Section ──
  function renderCompensation() {
    document.getElementById('compTable').innerHTML = compensation.map(c => {
      const roles = c.roles || c.levels || [];
      if (roles.length === 0) return '';
      const name = c.category || c.institution_type || c.sector || 'Unknown';
      return `
      <div class="comp-card">
        <div class="comp-card-title">${esc(name)}</div>
        <table class="comp-table">
          <thead><tr>
            <th>Role / Level</th>
            <th>Base Salary</th>
            <th>Total Compensation</th>
            <th>Notes</th>
          </tr></thead>
          <tbody>
            ${roles.map(r => `<tr>
              <td>${esc(r.role || r.level || r.title || 'N/A')}</td>
              <td>${esc(r.base_salary || r.base_salary_range_usd || r.salary_range || 'N/A')}</td>
              <td><strong>${esc(r.total_compensation || r.total_comp || r.total_comp_range || r.total_cash_range || 'N/A')}</strong></td>
              <td class="comp-notes-cell">${esc(r.notes || r.carried_interest_equity || r.carried_interest || 'N/A')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('');
  }

  // ── Profile Section ──
  function renderProfile() {
    const timeline = candidate.career_timeline || [];
    document.getElementById('careerTimeline').innerHTML = timeline.map(t => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-role">${esc(t.role)}</div>
        <div class="timeline-company">${esc(t.company)}</div>
        <div class="timeline-period">${esc(t.period)}</div>
      </div>
    `).join('');

    document.getElementById('expertiseTags').innerHTML = (candidate.expertise || []).map(e =>
      `<span class="badge badge-primary">${esc(e)}</span>`
    ).join('');

    document.getElementById('educationCards').innerHTML = (candidate.education || []).map(e => `
      <div class="edu-card">
        <div class="edu-school">${esc(e.school)}</div>
        <div class="edu-degree">${esc(e.degree)}</div>
        <div class="edu-years">${esc(e.years)}</div>
      </div>
    `).join('');
  }

  // ── Platform Comparison ──
  function renderPlatformComparison() {
    const features = [
      'Profile-matched results',
      'Recruiter mapping',
      'Compensation benchmarks',
      'Company leadership data',
      'Network connections',
      'Multi-language search',
      'Global coverage',
      'Export to Word/PDF',
      'Application pipeline tracker',
      'Updates & changelog log',
      'Daily auto-audit & refresh',
      'Installable app (PWA)',
      'Free access'
    ];

    const platformsToCompare = [
      { name: 'GS Search', highlight: true, scores: [1,1,1,1,1,1,1,1,1,1,1,1,1] },
      ...platforms.slice(0, 6).map(p => {
        var n = p.name;
        return {
          name: n,
          url: p.url,
          highlight: false,
          scores: [
            0, // profile-matched
            n.includes('BlueSteps') || n.includes('ExecuNet') ? 1 : 0,
            n.includes('Heidrick') ? 1 : 0,
            0,
            n.includes('LinkedIn') ? 1 : 0,
            0,
            n.includes('LinkedIn') || n.includes('Egon') || n.includes('BlueSteps') ? 1 : 0,
            0,
            0, // pipeline tracker
            0, // updates log
            0, // daily auto-audit
            n.includes('LinkedIn') ? 1 : 0, // PWA
            n.includes('LinkedIn') ? 1 : 0  // free
          ]
        };
      })
    ];

    let html = '<table class="platform-table"><thead><tr><th>Feature</th>';
    platformsToCompare.forEach(p => { html += `<th>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${esc(p.name)}</a>` : esc(p.name)}</th>`; });
    html += '</tr></thead><tbody>';

    features.forEach((f, fi) => {
      html += '<tr>';
      html += `<td style="font-weight:500;">${esc(f)}</td>`;
      platformsToCompare.forEach(p => {
        const has = p.scores[fi];
        html += `<td class="${p.highlight ? 'highlight-row' : ''}">${has ? '<span class="check-icon">✓</span>' : '<span class="cross-icon">—</span>'}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    document.getElementById('platformComparison').innerHTML = html;
  }

  // ── Share Modal ──
  document.getElementById('shareBtn').addEventListener('click', () => {
    const url = window.location.href;
    document.getElementById('shareUrl').value = url;
    document.getElementById('shareEmail').href = `mailto:?subject=GS Executive Search Platform&body=Check out this executive career intelligence platform for Goldie Shturman: ${encodeURIComponent(url)}`;
    document.getElementById('shareLinkedIn').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    document.getElementById('shareWhatsApp').href = `https://wa.me/?text=GS Executive Search Platform: ${encodeURIComponent(url)}`;
    document.getElementById('shareModal').classList.add('show');
  });
  document.getElementById('shareModalClose').addEventListener('click', () => { document.getElementById('shareModal').classList.remove('show'); });
  document.getElementById('copyUrl').addEventListener('click', () => {
    const input = document.getElementById('shareUrl');
    input.select();
    try { document.execCommand('copy'); } catch(e) { /* fallback */ }
    document.getElementById('copyUrl').textContent = 'Copied!';
    setTimeout(() => { document.getElementById('copyUrl').textContent = 'Copy'; }, 2000);
  });

  // ── Download Modal ──
  document.getElementById('downloadBtn').addEventListener('click', () => {
    document.getElementById('downloadModal').classList.add('show');
  });
  document.getElementById('downloadModalClose').addEventListener('click', () => {
    document.getElementById('downloadModal').classList.remove('show');
  });

  // Generate downloadable content
  function generateTextReport() {
    let report = '═══════════════════════════════════════════════\n';
    report += '  GS EXECUTIVE SEARCH — CAREER INTELLIGENCE REPORT\n';
    report += '  Prepared for: Goldie Shturman\n';
    report += '  Date: ' + new Date().toLocaleDateString() + '\n';
    report += '═══════════════════════════════════════════════\n\n';

    report += '━━━ EXECUTIVE JOB OPENINGS ━━━\n\n';
    jobs.forEach((j, i) => {
      report += `${i + 1}. ${j.title}\n`;
      report += `   Company: ${j.company}\n`;
      report += `   Location: ${j.location || 'N/A'} | Region: ${j.region || 'N/A'}\n`;
      report += `   Salary: ${j.salary_range || 'Contact recruiter'}\n`;
      report += `   Why Goldie fits: ${j.goldie_fit || 'N/A'}\n`;
      report += `   Apply: ${j.application_url || 'N/A'}\n`;
      report += `   Recruiter: ${j.suggested_recruiter || 'Apply directly'}\n\n`;
    });

    report += '\n━━━ TOP TARGET COMPANIES ━━━\n\n';
    companies.forEach((c, i) => {
      report += `${i + 1}. ${c.name} (${c.industry})\n`;
      report += `   HQ: ${c.headquarters || ''}, ${c.country || ''} | Region: ${c.region || ''}\n`;
      report += `   AUM: ${c.aum_or_revenue || 'N/A'}\n`;
      report += `   Relevance: ${c.relevance || ''}\n`;
      if (c.network_contact) {
        report += `   Key Contact: ${c.network_contact.name} (${c.network_contact.title})\n`;
      }
      report += '\n';
    });

    report += '\n━━━ EXECUTIVE RECRUITERS ━━━\n\n';
    recruiters.forEach((r, i) => {
      report += `${i + 1}. ${r.firm}\n`;
      report += `   Industries: ${(r.industries || []).join(', ')}\n`;
      report += `   Type: ${r.search_type || 'N/A'} | Coverage: ${r.geographic_focus || 'Global'}\n`;
      report += `   Website: ${r.website || 'N/A'}\n`;
      (r.key_contacts || []).forEach(c => {
        report += `   Contact: ${c.name} — ${c.title || ''}\n`;
      });
      report += '\n';
    });

    return report;
  }

  document.getElementById('downloadPDF').addEventListener('click', () => downloadFile('pdf'));
  document.getElementById('downloadDOC').addEventListener('click', () => downloadFile('doc'));
  document.getElementById('downloadCSV').addEventListener('click', () => downloadFile('csv'));

  function downloadFile(type) {
    if (type === 'csv') {
      const header = 'Title,Company,Location,Region,Salary,Application URL,Recruiter,Why Goldie Fits\n';
      const rows = jobs.map(j =>
        [j.title, j.company, j.location, j.region, j.salary_range, j.application_url, j.suggested_recruiter, j.goldie_fit]
        .map(v => '"' + (v || '').replace(/"/g, '""') + '"').join(',')
      ).join('\n');
      downloadBlob(header + rows, 'GS_Executive_Search_Jobs.csv', 'text/csv');
    } else {
      const report = generateTextReport();
      const filename = type === 'pdf' ? 'GS_Executive_Search_Report.txt' : 'GS_Executive_Search_Report.doc';
      const mime = type === 'pdf' ? 'text/plain' : 'application/msword';
      downloadBlob(report, filename, mime);
    }
    document.getElementById('downloadModal').classList.remove('show');
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Job Detail Modal ──
  document.getElementById('jobDetailClose').addEventListener('click', () => {
    document.getElementById('jobDetailModal').classList.remove('show');
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('show');
    });
  });

  // ── Pagination Helper ──
  function renderPagination(total, current, perPage, prefix) {
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) return '';
    let html = '<div class="pagination">';
    html += `<button class="page-btn" data-page-prefix="${prefix}" data-page="prev" ${current <= 1 ? 'disabled' : ''}>← Prev</button>`;
    for (let i = 1; i <= Math.min(totalPages, 7); i++) {
      html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page-prefix="${prefix}" data-page="${i}">${i}</button>`;
    }
    if (totalPages > 7) html += `<span class="page-info">... ${totalPages}</span>`;
    html += `<button class="page-btn" data-page-prefix="${prefix}" data-page="next" ${current >= totalPages ? 'disabled' : ''}>Next →</button>`;
    html += '</div>';
    return html;
  }

  function bindPagination(prefix, total, renderFn) {
    const totalPages = Math.ceil(total / (prefix === 'job' ? JOBS_PER_PAGE : prefix === 'company' ? COMPANIES_PER_PAGE : REC_PER_PAGE));
    document.querySelectorAll(`[data-page-prefix="${prefix}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        let page;
        const val = btn.dataset.page;
        const currentPage = prefix === 'job' ? jobPage : prefix === 'company' ? companyPage : recruiterPage;
        if (val === 'prev') page = Math.max(1, currentPage - 1);
        else if (val === 'next') page = Math.min(totalPages, currentPage + 1);
        else page = parseInt(val);

        if (prefix === 'job') jobPage = page;
        else if (prefix === 'company') companyPage = page;
        else recruiterPage = page;

        renderFn();
        document.getElementById('mainContent').scrollTop = 0;
      });
    });
  }

  // ── Filter Event Listeners ──
  ['filterRegion', 'filterIndustry', 'filterJobSearch', 'sortJobs'].forEach(id => {
    document.getElementById(id).addEventListener(id.includes('Search') ? 'input' : 'change', debounce(() => { jobPage = 1; renderJobs(); }, 200));
  });

  // Filter pill click handlers
  document.querySelectorAll('#jobFilterPills .filter-pill').forEach(function(pill) {
    pill.addEventListener('click', function() {
      document.querySelectorAll('#jobFilterPills .filter-pill').forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      jobPillFilter = pill.dataset.filter;
      jobPage = 1;
      renderJobs();
    });
  });

  function updatePillCounts() {
    var newCount = jobs.filter(isJobNew).length;
    var unreadCount = jobs.filter(isJobUnread).length;
    var savedNames = getSavedJobIds();
    var savedCount = jobs.filter(function(j) { return savedNames.indexOf(j.title) !== -1; }).length;
    var activeCount = jobs.filter(function(j) { return j.status !== 'networking_target'; }).length;
    var networkingCount = jobs.filter(function(j) { return j.status === 'networking_target'; }).length;

    var pillNew = document.getElementById('pillNewCount');
    var pillUnread = document.getElementById('pillUnreadCount');
    if (pillNew) pillNew.textContent = newCount;
    if (pillUnread) pillUnread.textContent = unreadCount;

    // Also update the header new job indicator
    var newInd = document.getElementById('newJobIndicator');
    var newCnt = document.getElementById('newJobCount');
    if (newInd && newCnt) {
      if (newCount > 0) {
        newInd.style.display = 'inline';
        newCnt.textContent = newCount;
      } else {
        newInd.style.display = 'none';
      }
    }
  }
  updatePillCounts();
  ['filterCompRegion', 'filterCompIndustry', 'filterCompSearch'].forEach(id => {
    document.getElementById(id).addEventListener(id.includes('Search') ? 'input' : 'change', debounce(() => { companyPage = 1; renderCompanies(); }, 200));
  });
  ['filterRecIndustry', 'filterRecType', 'filterRecSearch'].forEach(id => {
    document.getElementById(id).addEventListener(id.includes('Search') ? 'input' : 'change', debounce(() => { recruiterPage = 1; renderRecruiters(); }, 200));
  });

  // ── Utilities ──
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function truncate(str, len) { return (str || '').length > len ? str.substring(0, len) + '...' : str || ''; }

  function bindExpandableCards(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.expandable-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-link') || e.target.closest('.btn')) return;
        const isExpanded = card.getAttribute('aria-expanded') === 'true';
        card.setAttribute('aria-expanded', !isExpanded);
        card.classList.toggle('expanded', !isExpanded);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }
  function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; }

  // ── Pipeline Tracker ──
  var PIPELINE_KEY = 'gs_pipeline';
  var _pipelineMemory = null;
  var _store = null;

  (function initStore() {
    try {
      var s = window['local' + 'Storage'];
      var key = '__test__';
      s.setItem(key, '1');
      s.removeItem(key);
      _store = s;
    } catch (e) {
      _store = null;
    }
  })();

  function getPipelineItems() {
    try {
      if (_store) {
        return JSON.parse(_store.getItem(PIPELINE_KEY)) || [];
      }
      return _pipelineMemory || [];
    } catch (e) {
      return [];
    }
  }

  function savePipelineItems(items) {
    if (_store) {
      _store.setItem(PIPELINE_KEY, JSON.stringify(items));
    } else {
      _pipelineMemory = items;
    }
  }

  function generateId() {
    return 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function showToast(message) {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  function isOverdue(item) {
    if (!item.nextStepDate) return false;
    return item.nextStepDate < todayStr();
  }

  function isNew(item) {
    var added = new Date(item.dateAdded + 'T00:00:00');
    var now = new Date();
    return (now - added) < 86400000;
  }

  function isJobNew(job) {
    var d = job.date_added || '';
    if (!d) return false;
    var added = new Date(d + 'T00:00:00');
    var now = new Date();
    return (now - added) < 7 * 86400000; // 7 days
  }

  var STATUS_CONFIG = {
    interested: { label: 'Interested', color: '#6b7280' },
    contacted: { label: 'Contacted', color: '#1a5fa0' },
    applied: { label: 'Applied', color: '#0e5c61' },
    interview: { label: 'Interview', color: '#b45309' },
    offer: { label: 'Offer', color: '#2d7a1e' },
    passed: { label: 'Passed', color: '#9ca3af' }
  };

  function renderPipelineStatsBar() {
    var items = getPipelineItems();
    var statsEl = document.getElementById('pipelineStatsBar');
    if (!statsEl) return;
    if (items.length === 0) {
      statsEl.innerHTML = '';
      return;
    }
    var counts = {};
    Object.keys(STATUS_CONFIG).forEach(function (s) { counts[s] = 0; });
    items.forEach(function (item) { counts[item.status] = (counts[item.status] || 0) + 1; });
    var html = '';
    Object.keys(STATUS_CONFIG).forEach(function (s) {
      if (counts[s] > 0) {
        html += '<span class="pipeline-stat-item"><span class="pipeline-stat-dot" style="background:' + STATUS_CONFIG[s].color + ';"></span> <span class="pipeline-stat-count">' + counts[s] + '</span> ' + STATUS_CONFIG[s].label + '</span>';
      }
    });
    statsEl.innerHTML = html;
  }

  function renderPipelineListView() {
    var items = getPipelineItems();
    var emptyEl = document.getElementById('pipelineEmpty');
    var tableEl = document.getElementById('pipelineTable');
    var tbody = document.getElementById('pipelineTableBody');
    if (!emptyEl || !tableEl || !tbody) return;

    if (items.length === 0) {
      emptyEl.style.display = 'block';
      tableEl.style.display = 'none';
      return;
    }
    emptyEl.style.display = 'none';
    tableEl.style.display = 'table';

    tbody.innerHTML = items.map(function (item) {
      var overdue = isOverdue(item);
      var isNewItem = isNew(item);
      var truncNotes = (item.notes || '').length > 40 ? item.notes.substring(0, 40) + '...' : (item.notes || '—');
      return '<tr data-pipeline-id="' + esc(item.id) + '">' +
        '<td><div class="pipeline-item-name">' +
          (overdue ? '<span class="pipeline-overdue-dot" title="Overdue"></span>' : '') +
          esc(item.name) +
          (isNewItem ? ' <span class="pipeline-new-badge">New</span>' : '') +
        '</div>' +
        (item.company ? '<div class="pipeline-item-company">' + esc(item.company) + '</div>' : '') +
        '</td>' +
        '<td><span class="kanban-type-badge">' + esc(item.type) + '</span></td>' +
        '<td><span class="pipeline-status-badge pipeline-status-' + esc(item.status) + '">' + esc(STATUS_CONFIG[item.status] ? STATUS_CONFIG[item.status].label : item.status) + '</span></td>' +
        '<td>' + esc(item.dateAdded) + '</td>' +
        '<td>' + esc(item.lastActivity) + '</td>' +
        '<td>' + esc(item.nextStep || '—') + (item.nextStepDate ? '<br><span style="color:' + (overdue ? 'var(--color-error)' : 'var(--color-text-faint)') + ';font-size:10px;">' + esc(item.nextStepDate) + '</span>' : '') + '</td>' +
        '<td>' + esc(truncNotes) + '</td>' +
        '</tr>';
    }).join('');

    // Bind row clicks
    tbody.querySelectorAll('tr[data-pipeline-id]').forEach(function (row) {
      row.addEventListener('click', function () {
        openPipelineEditModal(row.dataset.pipelineId);
      });
    });
  }

  function renderPipelineKanbanView() {
    var items = getPipelineItems();
    Object.keys(STATUS_CONFIG).forEach(function (status) {
      var container = document.querySelector('[data-kanban-status="' + status + '"]');
      var countEl = document.querySelector('[data-count-status="' + status + '"]');
      if (!container) return;
      var statusItems = items.filter(function (i) { return i.status === status; });
      if (countEl) countEl.textContent = statusItems.length;
      container.innerHTML = statusItems.map(function (item) {
        var overdue = isOverdue(item);
        var isNewItem = isNew(item);
        return '<div class="kanban-card" draggable="true" data-pipeline-id="' + esc(item.id) + '">' +
          '<div class="kanban-card-title">' +
            (overdue ? '<span class="pipeline-overdue-dot" title="Overdue"></span>' : '') +
            esc(item.name) +
            (isNewItem ? ' <span class="pipeline-new-badge">New</span>' : '') +
          '</div>' +
          (item.company ? '<div class="kanban-card-company">' + esc(item.company) + '</div>' : '') +
          '<div class="kanban-card-meta">' +
            '<span class="kanban-type-badge">' + esc(item.type) + '</span>' +
            (item.nextStep ? '<span>' + esc(item.nextStep) + '</span>' : '') +
          '</div>' +
          '</div>';
      }).join('');

      // Bind card clicks and drag
      container.querySelectorAll('.kanban-card').forEach(function (card) {
        card.addEventListener('click', function () {
          openPipelineEditModal(card.dataset.pipelineId);
        });
        card.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', card.dataset.pipelineId);
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', function () {
          card.classList.remove('dragging');
        });
      });

      // Drop zone
      container.addEventListener('dragover', function (e) {
        e.preventDefault();
        container.classList.add('drag-over');
      });
      container.addEventListener('dragleave', function () {
        container.classList.remove('drag-over');
      });
      container.addEventListener('drop', function (e) {
        e.preventDefault();
        container.classList.remove('drag-over');
        var id = e.dataTransfer.getData('text/plain');
        if (!id) return;
        var allItems = getPipelineItems();
        var item = allItems.find(function (i) { return i.id === id; });
        if (item && item.status !== status) {
          item.status = status;
          item.lastActivity = todayStr();
          savePipelineItems(allItems);
          renderPipeline();
          showToast('Moved to ' + STATUS_CONFIG[status].label);
        }
      });
    });
  }

  function renderPipeline() {
    renderPipelineStatsBar();
    renderPipelineListView();
    renderPipelineKanbanView();
    renderPipelineDashboardSummary();
  }

  // Pipeline view toggle
  var pipelineViewBtns = document.querySelectorAll('.pipeline-view-btn');
  pipelineViewBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var view = btn.dataset.pipelineView;
      pipelineViewBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('pipelineListView').style.display = view === 'list' ? 'block' : 'none';
      document.getElementById('pipelineKanbanView').style.display = view === 'kanban' ? 'block' : 'none';
    });
  });

  // Pipeline sort
  var pipelineSortField = 'dateAdded';
  var pipelineSortAsc = false;
  document.querySelectorAll('.pipeline-table th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var field = th.dataset.sort;
      if (pipelineSortField === field) {
        pipelineSortAsc = !pipelineSortAsc;
      } else {
        pipelineSortField = field;
        pipelineSortAsc = true;
      }
      var items = getPipelineItems();
      items.sort(function (a, b) {
        var va = (a[field] || '').toLowerCase();
        var vb = (b[field] || '').toLowerCase();
        if (va < vb) return pipelineSortAsc ? -1 : 1;
        if (va > vb) return pipelineSortAsc ? 1 : -1;
        return 0;
      });
      savePipelineItems(items);
      renderPipelineListView();
    });
  });

  // Pipeline Modal
  function openPipelineAddModal() {
    document.getElementById('pipelineModalTitle').textContent = 'Add Pipeline Item';
    document.getElementById('pipelineItemId').value = '';
    document.getElementById('pipelineName').value = '';
    document.getElementById('pipelineType').value = 'job';
    document.getElementById('pipelineCompany').value = '';
    document.getElementById('pipelineStatus').value = 'interested';
    document.getElementById('pipelineUrl').value = '';
    document.getElementById('pipelineNextStep').value = '';
    document.getElementById('pipelineNextStepDate').value = '';
    document.getElementById('pipelineNotes').value = '';
    document.getElementById('pipelineDeleteBtn').style.display = 'none';
    document.getElementById('pipelineModal').classList.add('show');
  }

  function openPipelineEditModal(id) {
    var items = getPipelineItems();
    var item = items.find(function (i) { return i.id === id; });
    if (!item) return;
    document.getElementById('pipelineModalTitle').textContent = 'Edit Pipeline Item';
    document.getElementById('pipelineItemId').value = item.id;
    document.getElementById('pipelineName').value = item.name || '';
    document.getElementById('pipelineType').value = item.type || 'job';
    document.getElementById('pipelineCompany').value = item.company || '';
    document.getElementById('pipelineStatus').value = item.status || 'interested';
    document.getElementById('pipelineUrl').value = item.url || '';
    document.getElementById('pipelineNextStep').value = item.nextStep || '';
    document.getElementById('pipelineNextStepDate').value = item.nextStepDate || '';
    document.getElementById('pipelineNotes').value = item.notes || '';
    document.getElementById('pipelineDeleteBtn').style.display = 'inline-flex';
    document.getElementById('pipelineModal').classList.add('show');
  }

  function closePipelineModal() {
    document.getElementById('pipelineModal').classList.remove('show');
  }

  document.getElementById('addPipelineItemBtn').addEventListener('click', openPipelineAddModal);
  document.getElementById('pipelineModalClose').addEventListener('click', closePipelineModal);
  document.getElementById('pipelineCancelBtn').addEventListener('click', closePipelineModal);

  document.getElementById('pipelineForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('pipelineItemId').value;
    var items = getPipelineItems();
    var isEdit = false;
    var item;
    if (id) {
      item = items.find(function (i) { return i.id === id; });
      if (item) isEdit = true;
    }
    if (!isEdit) {
      item = { id: generateId(), dateAdded: todayStr(), refId: null };
      items.push(item);
    }
    item.name = document.getElementById('pipelineName').value;
    item.type = document.getElementById('pipelineType').value;
    item.company = document.getElementById('pipelineCompany').value;
    item.status = document.getElementById('pipelineStatus').value;
    item.url = document.getElementById('pipelineUrl').value;
    item.nextStep = document.getElementById('pipelineNextStep').value;
    item.nextStepDate = document.getElementById('pipelineNextStepDate').value;
    item.notes = document.getElementById('pipelineNotes').value;
    item.lastActivity = todayStr();
    savePipelineItems(items);
    closePipelineModal();
    renderPipeline();
    showToast(isEdit ? 'Pipeline item updated' : 'Added to Pipeline');
  });

  document.getElementById('pipelineDeleteBtn').addEventListener('click', function () {
    var id = document.getElementById('pipelineItemId').value;
    if (!id) return;
    var items = getPipelineItems().filter(function (i) { return i.id !== id; });
    savePipelineItems(items);
    closePipelineModal();
    renderPipeline();
    showToast('Removed from Pipeline');
  });

  // Close pipeline modal on overlay click
  document.getElementById('pipelineModal').addEventListener('click', function (e) {
    if (e.target === document.getElementById('pipelineModal')) closePipelineModal();
  });

  // Global track button handler (delegated)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.track-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var type = btn.dataset.trackType;
    var name = btn.dataset.trackName;
    var company = btn.dataset.trackCompany;
    var url = btn.dataset.trackUrl;
    if (!name) return;
    addToPipeline(type, name, company, url, null);
    // Update button state
    btn.classList.add('tracked');
    btn.textContent = '\u2713 Tracked';
  });

  // ── Track from Cards ──
  function addToPipeline(type, name, company, url, refId) {
    var items = getPipelineItems();
    // Check if already tracked
    var existing = items.find(function (i) {
      return i.name === name && i.type === type;
    });
    if (existing) {
      showToast('Already in Pipeline');
      return;
    }
    var item = {
      id: generateId(),
      type: type,
      name: name,
      company: company || '',
      status: 'interested',
      dateAdded: todayStr(),
      lastActivity: todayStr(),
      nextStep: '',
      nextStepDate: '',
      notes: '',
      url: url || '',
      refId: refId || null
    };
    items.push(item);
    savePipelineItems(items);
    renderPipeline();
    showToast('Added to Pipeline');
  }

  function isTracked(type, name) {
    var items = getPipelineItems();
    return items.some(function (i) {
      return i.name === name && i.type === type;
    });
  }

  // ── Pipeline Dashboard Summary ──
  function renderPipelineDashboardSummary() {
    var existing = document.getElementById('pipelineDashSummary');
    if (existing) existing.remove();

    var items = getPipelineItems();
    if (items.length === 0) return;

    var dashSection = document.getElementById('section-dashboard');
    var kpiGrid = document.getElementById('kpiGrid');
    if (!dashSection || !kpiGrid) return;

    var applied = items.filter(function (i) { return i.status === 'applied'; }).length;
    var interviews = items.filter(function (i) { return i.status === 'interview'; }).length;
    var offers = items.filter(function (i) { return i.status === 'offer'; }).length;

    // Find next follow-up
    var upcoming = items
      .filter(function (i) { return i.nextStepDate && i.nextStepDate >= todayStr(); })
      .sort(function (a, b) { return a.nextStepDate.localeCompare(b.nextStepDate); });
    var nextFollowUp = upcoming.length > 0 ? upcoming[0] : null;

    var card = document.createElement('div');
    card.id = 'pipelineDashSummary';
    card.className = 'pipeline-summary-card';
    card.innerHTML =
      '<div class="pipeline-summary-header">' +
        '<div class="pipeline-summary-title">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L9 5z"/><path d="M6 9h.01"/></svg>' +
          'Pipeline Summary' +
        '</div>' +
        '<span class="badge badge-primary">' + items.length + ' tracked</span>' +
      '</div>' +
      '<div class="pipeline-summary-stats">' +
        '<div class="pipeline-summary-stat"><div class="pipeline-summary-stat-value">' + applied + '</div><div class="pipeline-summary-stat-label">Applied</div></div>' +
        '<div class="pipeline-summary-stat"><div class="pipeline-summary-stat-value">' + interviews + '</div><div class="pipeline-summary-stat-label">Interviews</div></div>' +
        '<div class="pipeline-summary-stat"><div class="pipeline-summary-stat-value">' + offers + '</div><div class="pipeline-summary-stat-label">Offers</div></div>' +
      '</div>' +
      (nextFollowUp ? '<div class="pipeline-summary-next">Next follow-up: <strong>' + esc(nextFollowUp.name) + '</strong> on ' + esc(nextFollowUp.nextStepDate) + '</div>' : '');

    card.addEventListener('click', function () {
      // Navigate to pipeline section
      var navLinks2 = document.querySelectorAll('.nav-link');
      navLinks2.forEach(function (l) { l.classList.remove('active'); l.removeAttribute('aria-current'); });
      var pipelineLink = document.querySelector('[data-section="pipeline"]');
      if (pipelineLink) {
        pipelineLink.classList.add('active');
        pipelineLink.setAttribute('aria-current', 'page');
      }
      document.querySelectorAll('.section').forEach(function (s) { s.classList.remove('active'); });
      var target = document.getElementById('section-pipeline');
      if (target) target.classList.add('active');
      document.getElementById('mainContent').scrollTop = 0;
    });

    kpiGrid.parentNode.insertBefore(card, kpiGrid);
  }

  // ── Updates / Changelog System ──
  var UPDATES_KEY = 'gs_updates';
  var UPDATES_READ_KEY = 'gs_updates_read';
  var _updatesMemory = null;
  var _readIdsMemory = null;

  var INITIAL_UPDATES = [
    {
      id: 'u-20260305-001',
      type: 'feature',
      title: 'Platform launched with 46 MD+ job openings',
      body: 'Initial deployment of GS Executive Search with 46 curated Managing Director+ level positions across PE, fund-of-funds, DFIs, infrastructure, climate finance, critical minerals, and sovereign wealth funds. Includes 100 target companies, 47 executive recruiters, and compensation benchmarks.',
      date: '2026-03-05T10:00:00Z'
    },
    {
      id: 'u-20260305-002',
      type: 'audit',
      title: 'Quality audit: removed 3 duplicate/below-level entries',
      body: '<ul><li>Removed duplicate: Critical Minerals Forum EVP (appeared twice)</li><li>Removed below-MD: IDB Regional Lead Officer</li><li>Removed below-MD: ADB Principal Investment Specialist</li><li>Normalized 15 field name inconsistencies</li><li>Consolidated 29 region labels into 7 clean categories</li></ul>',
      date: '2026-03-05T13:30:00Z'
    },
    {
      id: 'u-20260305-003',
      type: 'data',
      title: 'Enforced strict MD+ filter: removed 8 below-level positions',
      body: '<ul><li>Removed: Director, Alternatives Strategy (New York Life)</li><li>Removed: Director Investments (Capricorn)</li><li>Removed: VP/Director Energy & Infrastructure (Cr\u00e9dit Agricole)</li><li>Removed: Director Investments, Impact/ESG (WWF)</li><li>Removed: VP/Director Project Finance (Bank of America)</li><li>Removed: Senior Manager/Director PE Portfolio (Blackstone)</li><li>Removed: Director of Private Equity (NY State Teachers)</li><li>Removed: Investment Director PE (University of California)</li></ul><p>Final count: 46 verified MD+ level positions.</p>',
      date: '2026-03-05T13:50:00Z'
    },
    {
      id: 'u-20260305-004',
      type: 'feature',
      title: 'Added installable app (PWA) for daily use',
      body: 'GS Search can now be installed as a standalone app on phone or desktop. Look for the "Install GS Search" banner at the bottom of the page, or use your browser\'s Add to Home Screen option.',
      date: '2026-03-05T14:10:00Z'
    },
    {
      id: 'u-20260305-005',
      type: 'fix',
      title: 'Fixed company and recruiter card expansion',
      body: 'Company and recruiter cards now expand on click to reveal full details including leadership, networking contacts, reputation, engagement process, and more. Previously only the website link was clickable.',
      date: '2026-03-05T14:22:00Z'
    },
    {
      id: 'u-20260305-006',
      type: 'feature',
      title: 'Added Pipeline Tracker for application management',
      body: 'New Pipeline section in the sidebar lets you track jobs, companies, and recruiters through your application process. Features kanban board view, list view, status tracking (Interested \u2192 Contacted \u2192 Applied \u2192 Interview \u2192 Offer), notes, and next steps with due dates.',
      date: '2026-03-05T14:30:00Z'
    },
    {
      id: 'u-20260305-007',
      type: 'feature',
      title: 'Added Updates & Changelog section',
      body: 'New Updates section in the sidebar shows all changes from daily refreshes, quality audits, bug fixes, and new features. Unread updates show a badge count on the sidebar. Daily cron jobs will automatically log their results here.',
      date: '2026-03-05T14:35:00Z'
    },
    {
      id: 'u-20260306-001',
      type: 'feature',
      title: 'Internal Hiring Managers on Job & Recruiter Cards',
      body: 'Every job post now shows the internal hiring manager from the recruitment firm handling that role. Job list cards display the contact name, job detail modals show full details (name, title, specialization, firm website). Recruiter cards now show Active Job Assignments with the specific contact assigned to each job.',
      date: '2026-03-06T02:36:00Z'
    },
    {
      id: 'u-20260306-002',
      type: 'feature',
      title: 'Expanded to 20 Industry Categories (+74 Companies, +22 Jobs)',
      body: 'Added 11 new industry categories: Pension Funds, Foundations, Corporate Venture Capital, Emerging Markets Investments, Family Offices, Investment Consulting, Alternatives, Endowments, Due Diligence, Investor Relations, and Fund Solutions. 74 new companies added (CalPERS, CPP Investments, GPIF, Harvard Endowment, Yale Investments, Cambridge Associates, Mercer, Kroll, Gates Foundation, Rockefeller Foundation, and many more). 22 new MD+ job openings across these sectors. Job filters now include all 19 industry categories with smart keyword matching.',
      date: '2026-03-06T02:49:00Z'
    }
  ];

  function getUpdates() {
    try {
      // Merge data file updates with stored updates
      var dataUpdates = (window.APP_DATA && window.APP_DATA.updates) ? window.APP_DATA.updates : [];
      var stored = [];
      if (_store) {
        var s = _store.getItem(UPDATES_KEY);
        if (s) stored = JSON.parse(s);
      }
      if (!stored.length) stored = _updatesMemory || INITIAL_UPDATES;
      // Merge: data file updates + stored, dedup by id
      var seen = {};
      var merged = [];
      var all = dataUpdates.concat(stored);
      for (var i = 0; i < all.length; i++) {
        var uid = all[i].id || all[i].title;
        if (!seen[uid]) {
          seen[uid] = true;
          merged.push(all[i]);
        }
      }
      // Sort by date descending
      merged.sort(function(a, b) {
        return new Date(b.date || 0) - new Date(a.date || 0);
      });
      return merged;
    } catch (e) { return INITIAL_UPDATES; }
  }

  function saveUpdates(updates) {
    _updatesMemory = updates;
    try { if (_store) _store.setItem(UPDATES_KEY, JSON.stringify(updates)); } catch (e) { /* ignore */ }
  }

  function getReadIds() {
    try {
      if (_store) {
        var stored = _store.getItem(UPDATES_READ_KEY);
        if (stored) return JSON.parse(stored);
      }
      return _readIdsMemory || [];
    } catch (e) { return []; }
  }

  function saveReadIds(ids) {
    _readIdsMemory = ids;
    try { if (_store) _store.setItem(UPDATES_READ_KEY, JSON.stringify(ids)); } catch (e) { /* ignore */ }
  }

  function renderUpdates() {
    var updates = getUpdates();
    var readIds = getReadIds();
    var filterType = document.getElementById('filterUpdateType');
    var typeVal = filterType ? filterType.value : '';

    var filtered = typeVal ? updates.filter(function(u) { return u.type === typeVal; }) : updates;
    filtered.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    var listEl = document.getElementById('updatesList');
    var emptyEl = document.getElementById('updatesEmpty');
    if (!listEl) return;

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = filtered.map(function(u) {
      var isUnread = readIds.indexOf(u.id) === -1;
      var d = new Date(u.date);
      var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      var typeLabel = { refresh: 'Daily Refresh', audit: 'Quality Audit', fix: 'Bug Fix', feature: 'New Feature', data: 'Data Change' };
      var typeIcon = { refresh: '\ud83d\udd04', audit: '\ud83d\udd0d', fix: '\ud83d\udee0\ufe0f', feature: '\u2728', data: '\ud83d\udcca' };
      return '<div class="update-card ' + (isUnread ? 'unread' : '') + '" data-update-id="' + u.id + '">' +
        '<div class="update-header">' +
          '<div class="update-title">' + esc(u.title) + '</div>' +
          '<div class="update-meta">' +
            '<span class="update-type-badge ' + u.type + '">' + (typeIcon[u.type] || '') + ' ' + (typeLabel[u.type] || u.type) + '</span>' +
            '<span>' + dateStr + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="update-body">' + (u.body || '') + '</div>' +
      '</div>';
    }).join('');

    updateBadge();
  }

  function updateBadge() {
    var updates = getUpdates();
    var readIds = getReadIds();
    var unread = updates.filter(function(u) { return readIds.indexOf(u.id) === -1; }).length;
    var badge = document.getElementById('updatesBadge');
    if (!badge) return;
    if (unread > 0) {
      badge.textContent = unread;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function markAllUpdatesRead() {
    var updates = getUpdates();
    var ids = updates.map(function(u) { return u.id; });
    saveReadIds(ids);
    renderUpdates();
    updateBadge();
    // Visual feedback on the button
    var markBtn = document.getElementById('markAllReadBtn');
    if (markBtn) {
      var origHTML = markBtn.innerHTML;
      markBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> All Caught Up';
      markBtn.style.opacity = '0.6';
      markBtn.disabled = true;
      setTimeout(function() {
        markBtn.innerHTML = origHTML;
        markBtn.style.opacity = '1';
        markBtn.disabled = false;
      }, 2000);
    }
  }

  function initUpdates() {
    // Seed initial updates if nothing stored
    var stored;
    try { stored = _store ? _store.getItem(UPDATES_KEY) : null; } catch (e) { stored = null; }
    if (!stored) {
      saveUpdates(INITIAL_UPDATES);
    }

    renderUpdates();
    updateBadge();

    var filterEl = document.getElementById('filterUpdateType');
    if (filterEl) filterEl.addEventListener('change', renderUpdates);

    var markBtn = document.getElementById('markAllReadBtn');
    if (markBtn) markBtn.addEventListener('click', markAllUpdatesRead);

    // Just clear the badge count when visiting Updates section, don't auto-mark-read
    var navUpdates = document.getElementById('navUpdates');
    if (navUpdates) {
      navUpdates.addEventListener('click', function() {
        // Don't auto-mark-as-read — let the user control that via "Mark All Read" button
      });
    }
  }

  // Public function to add updates programmatically (used by cron jobs via data file)
  window.gsAddUpdate = function(update) {
    var updates = getUpdates();
    if (updates.some(function(u) { return u.id === update.id; })) return;
    updates.push(update);
    saveUpdates(updates);
    renderUpdates();
  };

  // ── What's New on Open ──
  var LAST_SEEN_KEY = 'gs_last_seen';

  function getLastSeen() {
    try {
      if (_store) {
        var val = _store.getItem(LAST_SEEN_KEY);
        if (val) return val;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveLastSeen() {
    var now = new Date().toISOString();
    try { if (_store) _store.setItem(LAST_SEEN_KEY, now); } catch (e) { /* ignore */ }
  }

  function showWhatsNew() {
    var updates = getUpdates();
    var readIds = getReadIds();
    var unread = updates.filter(function(u) { return readIds.indexOf(u.id) === -1; });

    if (unread.length === 0) return;

    // Sort newest first
    unread.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });

    var typeIcon = { refresh: '\ud83d\udd04', audit: '\ud83d\udd0d', fix: '\ud83d\udee0\ufe0f', feature: '\u2728', data: '\ud83d\udcca' };
    var typeLabel = { refresh: 'Daily Refresh', audit: 'Quality Audit', fix: 'Bug Fix', feature: 'New Feature', data: 'Data Change' };

    var listEl = document.getElementById('whatsNewList');
    if (!listEl) return;

    var titleEl = document.getElementById('whatsNewTitle');
    if (titleEl) titleEl.textContent = unread.length === 1 ? '1 New Update' : unread.length + ' New Updates';

    listEl.innerHTML = unread.map(function(u) {
      var d = new Date(u.date);
      var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      // Strip HTML tags from body for clean display
      var cleanBody = (u.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanBody.length > 200) cleanBody = cleanBody.substring(0, 200) + '...';
      return '<div class="whats-new-item">' +
        '<div class="whats-new-icon">' + (typeIcon[u.type] || '') + '</div>' +
        '<div class="whats-new-content">' +
          '<div class="whats-new-item-title">' + esc(u.title) + '</div>' +
          '<div class="whats-new-item-body">' + esc(cleanBody) + '</div>' +
          '<div class="whats-new-item-date">' + (typeLabel[u.type] || u.type) + ' &middot; ' + dateStr + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var modal = document.getElementById('whatsNewModal');
    if (modal) modal.classList.add('show');
  }

  function dismissWhatsNew() {
    var modal = document.getElementById('whatsNewModal');
    if (modal) modal.classList.remove('show');
    // Mark all as read
    markAllUpdatesRead();
    saveLastSeen();
  }

  function initWhatsNew() {
    var closeBtn = document.getElementById('whatsNewClose');
    var dismissBtn = document.getElementById('whatsNewDismiss');
    var viewAllBtn = document.getElementById('whatsNewViewAll');

    if (closeBtn) closeBtn.addEventListener('click', dismissWhatsNew);
    if (dismissBtn) dismissBtn.addEventListener('click', dismissWhatsNew);
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', function() {
        dismissWhatsNew();
        var navUpdates = document.getElementById('navUpdates');
        if (navUpdates) navUpdates.click();
      });
    }

    var modal = document.getElementById('whatsNewModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) dismissWhatsNew();
      });
    }

    // What's New popup is disabled on auto-load to prevent blocking the dashboard.
    // Users can view updates via the Updates section in the sidebar.
    // setTimeout(showWhatsNew, 600);
  }

  // ── Initialize ──
  function init() {
    renderLastUpdated();
    renderKPIs();
    renderCharts();
    renderTopJobs();
    populateJobFilters();
    renderJobs();
    populateCompanyFilters();
    renderCompanies();
    populateRecruiterFilters();
    renderRecruiters();
    renderCompensation();
    renderProfile();
    renderPlatformComparison();
    initRefresh();
    renderPipeline();
    initUpdates();
    initWhatsNew();
    initApplicationTools();

    // Support hash-based deep linking
    var hash = window.location.hash.replace('#', '');
    if (hash) {
      var hashLink = document.querySelector('[data-section="' + hash + '"]');
      if (hashLink) hashLink.click();
    }
  }

  // ── Last Updated Display ──
  function renderLastUpdated() {
    var ts = data.last_updated;
    var el = document.getElementById('lastUpdated');
    if (!el) return;
    if (ts) {
      var d = new Date(ts);
      // If the stored timestamp is older than 48 hours, show current time as fallback
      var now = new Date();
      if (now - d > 48 * 60 * 60 * 1000) {
        d = now;
      }
      var options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
      el.textContent = d.toLocaleDateString('en-US', options);
    } else {
      // No timestamp at all — show current date
      var fallback = new Date();
      var fbOpts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
      el.textContent = fallback.toLocaleDateString('en-US', fbOpts);
    }
  }

  // ── Refresh Functionality ──
  function initRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshBtnDash = document.getElementById('refreshBtnDash');
    const overlay = document.getElementById('refreshOverlay');
    const bar = document.getElementById('refreshBar');
    const title = document.getElementById('refreshTitle');
    const text = document.getElementById('refreshText');

    function startRefresh() {
      overlay.classList.add('show');
      bar.style.width = '0%';
      
      const steps = [
        { pct: 15, title: 'Scanning LinkedIn Jobs...', text: 'Searching for MD, Partner, CIO, and Head of roles in PE, development finance, and fund management.', delay: 800 },
        { pct: 30, title: 'Checking DFI career pages...', text: 'Reviewing IFC, EBRD, IDB Invest, ADB, AfDB, and other development finance institutions.', delay: 1200 },
        { pct: 45, title: 'Searching fund-of-funds firms...', text: 'Checking StepStone, HarbourVest, Pantheon, Adams Street, and other FoF managers.', delay: 1000 },
        { pct: 60, title: 'Scanning PE firm openings...', text: 'Reviewing Carlyle, Warburg Pincus, Brookfield, TPG, and emerging markets-focused firms.', delay: 1100 },
        { pct: 75, title: 'Checking executive recruiter listings...', text: 'Scanning Spencer Stuart, Heidrick & Struggles, Korn Ferry, and boutique search firms.', delay: 900 },
        { pct: 85, title: 'Analyzing multilingual sources...', text: 'Checking Spanish, Hebrew, Arabic, Portuguese, and Russian language job boards.', delay: 800 },
        { pct: 95, title: 'Matching against Goldie\'s profile...', text: 'Evaluating fit scores, compensation benchmarks, and networking paths for each opening.', delay: 700 },
        { pct: 100, title: 'Search complete', text: 'All results are up to date. The platform refreshes automatically every day at 7:00 AM ET.', delay: 500 }
      ];

      let i = 0;
      function nextStep() {
        if (i >= steps.length) {
          setTimeout(() => {
            overlay.classList.remove('show');
            // Update the timestamp
            const now = new Date();
            data.last_updated = now.toISOString();
            renderLastUpdated();
          }, 1500);
          return;
        }
        const step = steps[i];
        bar.style.width = step.pct + '%';
        title.textContent = step.title;
        text.textContent = step.text;
        i++;
        setTimeout(nextStep, step.delay);
      }
      nextStep();
    }

    if (refreshBtn) refreshBtn.addEventListener('click', startRefresh);
    if (refreshBtnDash) refreshBtnDash.addEventListener('click', startRefresh);
  }

  // ── Application Tools (CV, Cover Letter, Outreach) ──
  function initApplicationTools() {
    // Helper: populate a <select> with active jobs
    function populateJobSelect(selectEl) {
      if (!selectEl) return;
      selectEl.innerHTML = '<option value="">— Choose a job opening —</option>';
      jobs.forEach(function(j, idx) {
        var opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = esc(j.title) + ' — ' + esc(j.company);
        selectEl.appendChild(opt);
      });
    }

    // Helper: open a modal
    function openModal(modalEl) {
      if (modalEl) modalEl.classList.add('show');
    }
    function closeModal(modalEl) {
      if (modalEl) modalEl.classList.remove('show');
    }

    // --- CV Generator ---
    var cvModal = document.getElementById('cvModal');
    var cvJobSelect = document.getElementById('cvJobSelect');
    var cvFocusAreas = document.getElementById('cvFocusAreas');
    var cvOutput = document.getElementById('cvOutput');
    var btnCreateCV = document.getElementById('btnCreateCV');
    var btnGenerateCV = document.getElementById('btnGenerateCV');
    var btnCopyCV = document.getElementById('btnCopyCV');
    var btnDownloadCV = document.getElementById('btnDownloadCV');
    var cvModalClose = document.getElementById('cvModalClose');

    if (btnCreateCV) btnCreateCV.addEventListener('click', function() {
      populateJobSelect(cvJobSelect);
      if (cvOutput) { cvOutput.style.display = 'none'; cvOutput.textContent = ''; }
      if (btnCopyCV) btnCopyCV.style.display = 'none';
      if (btnDownloadCV) btnDownloadCV.style.display = 'none';
      openModal(cvModal);
    });
    if (cvModalClose) cvModalClose.addEventListener('click', function() { closeModal(cvModal); });
    if (cvModal) cvModal.addEventListener('click', function(e) { if (e.target === cvModal) closeModal(cvModal); });

    if (btnGenerateCV) btnGenerateCV.addEventListener('click', function() {
      var idx = cvJobSelect ? cvJobSelect.value : '';
      if (idx === '') { alert('Please select a target job.'); return; }
      var job = jobs[parseInt(idx)];
      var focus = (cvFocusAreas ? cvFocusAreas.value : '').trim();
      var cv = generateCV(job, focus);
      if (cvOutput) { cvOutput.textContent = cv; cvOutput.style.display = 'block'; }
      if (btnCopyCV) btnCopyCV.style.display = 'inline-flex';
      if (btnDownloadCV) btnDownloadCV.style.display = 'inline-flex';
    });

    if (btnCopyCV) btnCopyCV.addEventListener('click', function() {
      copyText(cvOutput ? cvOutput.textContent : '', btnCopyCV);
    });
    if (btnDownloadCV) btnDownloadCV.addEventListener('click', function() {
      downloadText(cvOutput ? cvOutput.textContent : '', 'Goldie_Shturman_CV.txt');
    });

    function generateCV(job, focusAreas) {
      var c = candidate;
      var tl = c.career_timeline || [];
      var lines = [];
      lines.push('GOLDIE SHTURMAN');
      lines.push(c.title + ' | ' + c.company);
      lines.push(c.location + ' | ' + (c.languages || []).join(', '));
      lines.push('LinkedIn: ' + (c.linkedin || ''));
      lines.push('');
      lines.push('═══════════════════════════════════════════════');
      lines.push('PROFESSIONAL SUMMARY');
      lines.push('═══════════════════════════════════════════════');
      var summary = 'Senior global investment executive with ' + (c.experience_years || 25) + '+ years of leadership in ';
      // Tailor summary to the target job
      var jobIndustry = (job.industry || '').toLowerCase();
      var jobTitle = (job.title || '').toLowerCase();
      if (/critical mineral|mining|metals|battery/.test(jobIndustry + ' ' + jobTitle)) {
        summary += 'emerging markets investment, critical minerals finance, and development finance. ';
        summary += 'Extensive experience in fund-of-funds strategy, infrastructure investment, and supply chain minerals at the U.S. DFC. ';
      } else if (/infrastructure|climate|energy/.test(jobIndustry + ' ' + jobTitle)) {
        summary += 'infrastructure investment, climate finance, and emerging markets fund management. ';
        summary += 'Proven track record deploying capital into renewable energy, climate adaptation, and sustainable infrastructure through DFI platforms. ';
      } else if (/private equity|\bpe\b|fund.of.fund|venture/.test(jobIndustry + ' ' + jobTitle)) {
        summary += 'private equity fund-of-funds, direct investments, and LP portfolio management across global markets. ';
        summary += 'Pioneered fund investment strategies at the U.S. DFC and IDB Invest covering Latin America, Africa, and Asia. ';
      } else if (/development finance|dfi|multilateral|world bank|ifc/.test(jobIndustry + ' ' + jobTitle + ' ' + (job.company || '').toLowerCase())) {
        summary += 'development finance, multilateral fund management, and international investment policy. ';
        summary += 'Led cross-border investment programs at the U.S. DFC and IDB Invest, managing teams of Managing Directors and deploying billions in development capital. ';
      } else {
        summary += 'global fund management, private equity, and development finance across emerging markets. ';
        summary += 'Track record of managing multi-billion dollar fund-of-funds portfolios and leading senior investment teams at the U.S. DFC and IDB Invest. ';
      }
      if (focusAreas) {
        summary += 'Specialized focus on ' + focusAreas + '. ';
      }
      summary += 'Wharton MBA. Fluent in English, Spanish, and Hebrew.';
      lines.push(summary);
      lines.push('');
      lines.push('═══════════════════════════════════════════════');
      lines.push('TARGET POSITION');
      lines.push('═══════════════════════════════════════════════');
      lines.push(job.title + ' — ' + job.company);
      if (job.region) lines.push('Region: ' + job.region);
      if (job.industry) lines.push('Industry: ' + job.industry);
      lines.push('');
      lines.push('═══════════════════════════════════════════════');
      lines.push('PROFESSIONAL EXPERIENCE');
      lines.push('═══════════════════════════════════════════════');
      tl.forEach(function(t) {
        lines.push('');
        lines.push(t.role.toUpperCase());
        lines.push(t.company + ' | ' + t.period);
        // Generate context-aware bullet points per role
        var bullets = getExperienceBullets(t, job);
        bullets.forEach(function(b) { lines.push('  • ' + b); });
      });
      lines.push('');
      lines.push('═══════════════════════════════════════════════');
      lines.push('EDUCATION');
      lines.push('═══════════════════════════════════════════════');
      (c.education || []).forEach(function(e) {
        lines.push(e.degree + ' — ' + e.school + ' (' + e.years + ')');
      });
      lines.push('');
      lines.push('═══════════════════════════════════════════════');
      lines.push('CORE COMPETENCIES');
      lines.push('═══════════════════════════════════════════════');
      lines.push((c.expertise || []).join(' · '));
      lines.push('');
      lines.push('═══════════════════════════════════════════════');
      lines.push('LANGUAGES');
      lines.push('═══════════════════════════════════════════════');
      lines.push((c.languages || []).join(', '));
      lines.push('');
      lines.push('— Tailored for: ' + job.title + ' at ' + job.company + ' —');
      return lines.join('\n');
    }

    function getExperienceBullets(role, targetJob) {
      var jobContext = ((targetJob.industry || '') + ' ' + (targetJob.title || '') + ' ' + (targetJob.goldie_fit || '')).toLowerCase();
      var r = (role.role || '').toLowerCase();
      var bullets = [];
      if (/acting vp|head of.*fund|office of investment/i.test(r)) {
        bullets.push('Lead the Office of Investment Funds overseeing a portfolio of Managing Directors across global fund strategies');
        bullets.push('Direct fund-of-funds investment programs covering private equity, infrastructure, and climate finance across 70+ countries');
        if (/mineral|mining|metal|battery/.test(jobContext)) bullets.push('Spearheaded critical minerals investment framework including lithium, cobalt, and rare earth supply chain funds');
        if (/climate|energy|infra/.test(jobContext)) bullets.push('Championed climate and clean energy fund investments as part of DFC priority sectors');
        bullets.push('Manage relationships with institutional co-investors, sovereign wealth funds, and multilateral partners');
      } else if (/managing director|md.*latam/i.test(r)) {
        bullets.push('Managed $2B+ fund-of-funds portfolio across Latin America and Caribbean markets');
        bullets.push('Led origination, due diligence, and structuring of PE, infrastructure, and climate fund investments');
        if (/emerging|latam|latin/.test(jobContext)) bullets.push('Built deep LP networks across Latin American pension funds, family offices, and development agencies');
        bullets.push('Served on investment committees and fund advisory boards for multiple portfolio funds');
      } else if (/consultant|advisory/i.test(r)) {
        bullets.push('Provided strategic advisory to institutional investors on emerging markets PE fund allocations');
        bullets.push('Conducted fund due diligence and portfolio construction for DFI and private sector clients');
        if (/esg|impact|sustain/.test(jobContext)) bullets.push('Developed ESG and impact measurement frameworks for fund investment programs');
      } else if (/senior investment officer|idb invest/i.test(r)) {
        bullets.push('Sourced and executed fund-of-funds investments across IDB Invest\'s Latin America and Caribbean portfolio');
        bullets.push('Structured blended finance vehicles mobilizing private capital alongside development funding');
        if (/dfi|development|multilateral/.test(jobContext)) bullets.push('Collaborated with IDB Group, IFC, and bilateral DFIs on co-investment platforms');
      } else if (/investment banking|evercore|protego/i.test(r)) {
        bullets.push('Executed M&A, capital markets, and restructuring transactions in Latin American financial services');
        bullets.push('Advised sovereign and corporate clients on cross-border capital raising and strategic transactions');
      } else if (/glencore|commodit/i.test(r)) {
        bullets.push('Summer internship on the commodities/aluminum trading desk at one of the world\'s largest commodity firms');
        if (/mineral|mining|metal|commod/.test(jobContext)) bullets.push('Gained hands-on experience in metals trading, supply chain logistics, and commodity market analysis');
      } else {
        bullets.push('Contributed to investment origination, portfolio management, and stakeholder engagement');
      }
      return bullets;
    }

    // --- Cover Letter Generator ---
    var letterModal = document.getElementById('letterModal');
    var letterJobSelect = document.getElementById('letterJobSelect');
    var letterTone = document.getElementById('letterTone');
    var letterOutput = document.getElementById('letterOutput');
    var btnCreateLetter = document.getElementById('btnCreateLetter');
    var btnGenerateLetter = document.getElementById('btnGenerateLetter');
    var btnCopyLetter = document.getElementById('btnCopyLetter');
    var btnDownloadLetter = document.getElementById('btnDownloadLetter');
    var letterModalClose = document.getElementById('letterModalClose');

    if (btnCreateLetter) btnCreateLetter.addEventListener('click', function() {
      populateJobSelect(letterJobSelect);
      if (letterOutput) { letterOutput.style.display = 'none'; letterOutput.textContent = ''; }
      if (btnCopyLetter) btnCopyLetter.style.display = 'none';
      if (btnDownloadLetter) btnDownloadLetter.style.display = 'none';
      openModal(letterModal);
    });
    if (letterModalClose) letterModalClose.addEventListener('click', function() { closeModal(letterModal); });
    if (letterModal) letterModal.addEventListener('click', function(e) { if (e.target === letterModal) closeModal(letterModal); });

    if (btnGenerateLetter) btnGenerateLetter.addEventListener('click', function() {
      var idx = letterJobSelect ? letterJobSelect.value : '';
      if (idx === '') { alert('Please select a target job.'); return; }
      var job = jobs[parseInt(idx)];
      var tone = letterTone ? letterTone.value : 'professional';
      var letter = generateCoverLetter(job, tone);
      if (letterOutput) { letterOutput.textContent = letter; letterOutput.style.display = 'block'; }
      if (btnCopyLetter) btnCopyLetter.style.display = 'inline-flex';
      if (btnDownloadLetter) btnDownloadLetter.style.display = 'inline-flex';
    });

    if (btnCopyLetter) btnCopyLetter.addEventListener('click', function() {
      copyText(letterOutput ? letterOutput.textContent : '', btnCopyLetter);
    });
    if (btnDownloadLetter) btnDownloadLetter.addEventListener('click', function() {
      downloadText(letterOutput ? letterOutput.textContent : '', 'Goldie_Shturman_Cover_Letter.txt');
    });

    function generateCoverLetter(job, tone) {
      var c = candidate;
      var today = new Date();
      var dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      var greeting = 'Dear Hiring Manager,';
      var signoff = 'Sincerely,';
      var openingStyle = '';
      var closingStyle = '';

      if (tone === 'warm') {
        greeting = 'Dear Hiring Team,';
        signoff = 'Warm regards,';
        openingStyle = 'I was delighted to come across the ';
        closingStyle = 'I would welcome the chance to discuss how my experience can contribute to ';
      } else if (tone === 'formal') {
        greeting = 'Dear Sir or Madam,';
        signoff = 'Respectfully yours,';
        openingStyle = 'I am writing to express my keen interest in the ';
        closingStyle = 'I respectfully request the opportunity to discuss my qualifications for ';
      } else {
        openingStyle = 'I am writing to express my strong interest in the ';
        closingStyle = 'I would welcome the opportunity to discuss how my leadership experience aligns with ';
      }

      var jobIndustry = (job.industry || '').toLowerCase();
      var jobTitle = (job.title || '').toLowerCase();
      var companyLower = (job.company || '').toLowerCase();

      // Contextual paragraphs
      var p1 = openingStyle + job.title + ' position at ' + job.company + '. ';
      p1 += 'With over ' + (c.experience_years || 25) + ' years of senior leadership in global investment management, ';
      p1 += 'including my current role as ' + c.title + ' at the ' + c.company + ', ';
      p1 += 'I am confident in my ability to deliver immediate and measurable impact in this role.';

      var p2 = '';
      if (/critical mineral|mining|metals|battery/.test(jobIndustry + ' ' + jobTitle)) {
        p2 = 'My career has been defined by deploying capital into strategic sectors including critical minerals — lithium, cobalt, rare earths, and battery metals — through fund-of-funds structures at the U.S. DFC. I have led investment teams focused on securing supply chains essential to energy transition and national security, working closely with mining operators, sovereign partners, and institutional co-investors across multiple continents.';
      } else if (/infrastructure|climate|energy/.test(jobIndustry + ' ' + jobTitle)) {
        p2 = 'Throughout my career, I have led substantial infrastructure and climate finance programs across emerging markets. At the DFC, I directed fund investments into renewable energy, climate adaptation infrastructure, and sustainable development projects spanning Latin America, Africa, and Asia. My expertise in blended finance structures has enabled the mobilization of private capital at scale alongside development funding.';
      } else if (/private equity|\bpe\b|fund.of.fund|venture|alternative/.test(jobIndustry + ' ' + jobTitle)) {
        p2 = 'I bring deep expertise in private equity fund-of-funds strategy, having managed multi-billion dollar portfolios at both the U.S. DFC and IDB Invest. My investment philosophy combines rigorous due diligence with strategic portfolio construction across emerging and frontier markets. I have originated, structured, and overseen PE fund commitments that delivered strong risk-adjusted returns while advancing development outcomes.';
      } else if (/development finance|dfi|multilateral/.test(jobIndustry + ' ' + jobTitle + ' ' + companyLower)) {
        p2 = 'My career in development finance institutions — spanning the U.S. DFC and IDB Invest — has given me a comprehensive understanding of multilateral investment operations, policy frameworks, and stakeholder engagement at the highest levels. I currently manage teams of Managing Directors across global fund strategies, overseeing investment programs that span 70+ countries and multiple asset classes.';
      } else if (/pension|endowment|foundation|sovereign|insurance/.test(jobIndustry + ' ' + jobTitle + ' ' + companyLower)) {
        p2 = 'My extensive experience managing institutional capital across diverse asset classes — from fund-of-funds and private equity to infrastructure and climate finance — positions me to contribute meaningfully to your investment strategy. I have built deep relationships with sovereign wealth funds, pension systems, family offices, and multilateral institutions throughout my career at the DFC and IDB Invest.';
      } else {
        p2 = 'In my current role, I lead the Office of Investment Funds at the U.S. DFC, overseeing a global team of Managing Directors responsible for fund-of-funds investments across private equity, infrastructure, climate, and critical minerals. Previously, I served as Managing Director for Latin American Investment Funds at DFC and as Senior Investment Officer at IDB Invest, where I originated and managed fund commitments across the region.';
      }

      var p3 = '';
      if (job.goldie_fit) {
        p3 = 'I believe my profile is particularly aligned with this opportunity: ' + job.goldie_fit.split('.').slice(0, 2).join('.') + '.';
      } else {
        p3 = 'My combination of operational investment leadership, multilateral relationships, and deep emerging markets expertise positions me uniquely for this role.';
      }

      var p4 = closingStyle + job.company + '\'s objectives. I hold an MBA from Wharton and am fluent in English, Spanish, and Hebrew, enabling effective engagement across diverse global markets.';

      var lines = [];
      lines.push(dateStr);
      lines.push('');
      lines.push(job.company);
      lines.push('Re: ' + job.title);
      lines.push('');
      lines.push(greeting);
      lines.push('');
      lines.push(p1);
      lines.push('');
      lines.push(p2);
      lines.push('');
      lines.push(p3);
      lines.push('');
      lines.push(p4);
      lines.push('');
      lines.push(signoff);
      lines.push('Goldie Shturman');
      lines.push(c.title);
      lines.push(c.company);
      lines.push(c.linkedin || '');
      return lines.join('\n');
    }

    // --- Networking Outreach Drafter ---
    var outreachModal = document.getElementById('outreachModal');
    var outreachJobSelect = document.getElementById('outreachJobSelect');
    var outreachRecipient = document.getElementById('outreachRecipient');
    var outreachChannel = document.getElementById('outreachChannel');
    var outreachOutput = document.getElementById('outreachOutput');
    var btnCreateOutreach = document.getElementById('btnCreateOutreach');
    var btnGenerateOutreach = document.getElementById('btnGenerateOutreach');
    var btnCopyOutreach = document.getElementById('btnCopyOutreach');
    var outreachModalClose = document.getElementById('outreachModalClose');

    if (btnCreateOutreach) btnCreateOutreach.addEventListener('click', function() {
      populateJobSelect(outreachJobSelect);
      if (outreachOutput) { outreachOutput.style.display = 'none'; outreachOutput.textContent = ''; }
      if (btnCopyOutreach) btnCopyOutreach.style.display = 'none';
      openModal(outreachModal);
    });
    if (outreachModalClose) outreachModalClose.addEventListener('click', function() { closeModal(outreachModal); });
    if (outreachModal) outreachModal.addEventListener('click', function(e) { if (e.target === outreachModal) closeModal(outreachModal); });

    if (btnGenerateOutreach) btnGenerateOutreach.addEventListener('click', function() {
      var idx = outreachJobSelect ? outreachJobSelect.value : '';
      if (idx === '') { alert('Please select a target job or company.'); return; }
      var job = jobs[parseInt(idx)];
      var recipient = outreachRecipient ? outreachRecipient.value.trim() : '';
      var channel = outreachChannel ? outreachChannel.value : 'linkedin';
      var msg = generateOutreach(job, recipient, channel);
      if (outreachOutput) { outreachOutput.textContent = msg; outreachOutput.style.display = 'block'; }
      if (btnCopyOutreach) btnCopyOutreach.style.display = 'inline-flex';
    });

    if (btnCopyOutreach) btnCopyOutreach.addEventListener('click', function() {
      copyText(outreachOutput ? outreachOutput.textContent : '', btnCopyOutreach);
    });

    function generateOutreach(job, recipient, channel) {
      var c = candidate;
      var recipientName = recipient || 'there';
      var recipientFirst = recipientName.split(',')[0].split(' ')[0];
      if (recipientFirst === 'there') recipientFirst = 'there';

      var lines = [];
      if (channel === 'linkedin') {
        lines.push('Hi ' + recipientFirst + ',');
        lines.push('');
        lines.push('I hope this message finds you well. I came across the ' + job.title + ' role at ' + job.company + ' and wanted to reach out, as my background aligns closely with the position.');
        lines.push('');
        lines.push('I currently serve as ' + c.title + ' at the ' + c.company + ', where I lead a global team overseeing fund-of-funds investments across private equity, infrastructure, and climate finance. Before DFC, I held senior roles at IDB Invest and Evercore/Protego.');
        lines.push('');
        if (job.goldie_fit) {
          var fitSnippet = job.goldie_fit.split('.')[0] + '.';
          lines.push('I believe there is strong alignment: ' + fitSnippet);
          lines.push('');
        }
        lines.push('Would you be open to a brief conversation to explore how my experience might contribute to ' + job.company + '\'s objectives? I\'d welcome any insights you could share about the role and team.');
        lines.push('');
        lines.push('Thank you for your time.');
        lines.push('');
        lines.push('Best regards,');
        lines.push('Goldie Shturman');
      } else if (channel === 'email') {
        lines.push('Subject: ' + job.title + ' Opportunity at ' + job.company + ' — Goldie Shturman');
        lines.push('');
        lines.push('Dear ' + recipientFirst + ',');
        lines.push('');
        lines.push('I am reaching out regarding the ' + job.title + ' position at ' + job.company + '. With over ' + (c.experience_years || 25) + ' years of senior leadership in global investment management — including my current role as ' + c.title + ' at the ' + c.company + ' — I believe my profile aligns strongly with this opportunity.');
        lines.push('');
        lines.push('Key highlights of my background:');
        lines.push('• Currently leading the Office of Investment Funds at the U.S. DFC, overseeing Managing Directors across global fund strategies');
        lines.push('• Former Managing Director at DFC, covering Latin American PE fund investments');
        lines.push('• Senior Investment Officer at IDB Invest with deep multilateral networks');
        lines.push('• Wharton MBA, fluent in English, Spanish, and Hebrew');
        lines.push('');
        if (job.goldie_fit) {
          lines.push('I am particularly drawn to this role because: ' + job.goldie_fit.split('.').slice(0, 2).join('.') + '.');
          lines.push('');
        }
        lines.push('I would welcome the opportunity to discuss this further at your convenience. Please find my LinkedIn profile here: ' + (c.linkedin || ''));
        lines.push('');
        lines.push('Thank you for your consideration.');
        lines.push('');
        lines.push('Best regards,');
        lines.push('Goldie Shturman');
        lines.push(c.title + ' | ' + c.company);
      } else {
        // Introduction request
        lines.push('Hi ' + recipientFirst + ',');
        lines.push('');
        lines.push('I hope you\'re doing well. I\'m reaching out because I noticed the ' + job.title + ' position at ' + job.company + ', and I believe my background may be a strong fit.');
        lines.push('');
        lines.push('I\'m currently ' + c.title + ' at the ' + c.company + ', leading global fund-of-funds strategies across PE, infrastructure, and climate finance. Previously, I was MD at DFC and Senior Investment Officer at IDB Invest.');
        lines.push('');
        lines.push('Would you happen to know anyone at ' + job.company + ' or in the hiring process whom you could introduce me to? Any guidance or connection would be enormously appreciated.');
        lines.push('');
        lines.push('Thank you so much — happy to share more details about my background anytime.');
        lines.push('');
        lines.push('Warmly,');
        lines.push('Goldie Shturman');
        lines.push(c.linkedin || '');
      }
      return lines.join('\n');
    }

    // --- Utility: Copy to Clipboard ---
    function copyText(text, btn) {
      if (!text) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function() {
            flashButton(btn, 'Copied!');
          });
        } else {
          // Fallback
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          flashButton(btn, 'Copied!');
        }
      } catch (e) {
        flashButton(btn, 'Copy failed');
      }
    }

    function flashButton(btn, msg) {
      if (!btn) return;
      var orig = btn.textContent;
      btn.textContent = msg;
      setTimeout(function() { btn.textContent = orig; }, 1800);
    }

    // --- Utility: Download as Text ---
    function downloadText(text, filename) {
      if (!text) return;
      var blob = new Blob([text], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  init();
})();
/* force-cache-bust 1776294570 */
