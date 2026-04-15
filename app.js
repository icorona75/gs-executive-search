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
    var filtered = getFilteredJobs();
    var filteredRegions = [...new Set(filtered.map(j => j.region).filter(Boolean))];
    var allRegions = [...new Set(jobs.map(j => j.region).filter(Boolean))];
    const avgSalary = computeAvgSalary(filtered);
    var isFiltered = filtered.length !== jobs.length;
    const kpis = [
      { label: 'Job Openings', value: filtered.length, detail: isFiltered ? filtered.length + ' of ' + jobs.length + ' match filters' : 'Matched to profile' },
      { label: 'Target Companies', value: companies.length, detail: 'Across all regions' },
      { label: 'Recruiters', value: recruiters.length, detail: 'Executive search firms' },
      { label: 'Regions Covered', value: filteredRegions.length, detail: isFiltered ? filteredRegions.length + ' of ' + allRegions.length + ' regions' : 'Global coverage' },
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

  function computeAvgSalary(jobList) {
    let total = 0, count = 0;
    (jobList || jobs).forEach(j => {
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
    const chartColors = ['#0e5c61', '#1a5fa0', '#c49a2a', '#2d7a1e', '#b45309', '#6b32a8', '#a12c5b', '#437a22', '#5591c7', '#d49526'];

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
        datasets: [{ data: sortedInd.map(i => i[1]), backgroundColor: sortedInd.map(function(_, idx) { return idx === 0 ? '#c49a2a' : '#0e5c61'; }), borderRadius: 4, maxBarThickness: 32 }]
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
          { label: 'Max ($K)', data: compMaxs, backgroundColor: '#c49a2a', borderRadius: 3, maxBarThickness: 28 }
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
  function formatSalaryShort(j) {
    var raw = j.salary_range || j.salary || '';
    // Extract dollar amounts — handles both $400,000 and $1M/$1.5M shorthand
    var matches = raw.match(/\$[\d,]+(?:\.\d+)?\s*[MmBbKk]?/g);
    if (!matches || matches.length === 0) return '';
    var parseAmt = function(m) {
      var clean = m.replace(/[$,\s]/g, '');
      var mult = 1;
      if (/[Mm]$/i.test(clean)) { mult = 1000000; clean = clean.replace(/[Mm]$/, ''); }
      else if (/[Bb]$/i.test(clean)) { mult = 1000000000; clean = clean.replace(/[Bb]$/, ''); }
      else if (/[Kk]$/i.test(clean)) { mult = 1000; clean = clean.replace(/[Kk]$/, ''); }
      return parseFloat(clean) * mult;
    };
    var nums = matches.map(parseAmt).filter(function(n) { return !isNaN(n) && n > 0; });
    if (nums.length === 0) return '';
    var fmt = function(n) {
      if (n >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
      return '$' + n;
    };
    if (nums.length >= 2) return fmt(nums[0]) + '–' + fmt(nums[1]);
    return fmt(nums[0]) + '+';
  }

  function renderTopJobs() {
    const top = jobsByPriority.slice(0, 3);
    document.getElementById('topJobs').innerHTML = top.map((j) => {
      var scoreLabel = j._priority_score >= 80 ? 'Exceptional' : j._priority_score >= 65 ? 'Very Strong' : j._priority_score >= 50 ? 'Strong' : 'Good';
      var scoreColor = j._priority_score >= 80 ? '#9a7b2a' : j._priority_score >= 65 ? '#0e5c61' : j._priority_score >= 50 ? '#1a5fa0' : '#6b6963';
      var origIdx = jobs.indexOf(j);
      var salaryShort = formatSalaryShort(j);
      return `
      <div class="result-card" data-job-idx="${origIdx}">
        <div class="result-header">
          <div style="flex:1;min-width:0;">
            <div class="result-title">${isNewJob(j) ? '<span class="new-badge">NEW</span>' : ''}${esc(j.title)}</div>
            <div class="result-company">${esc(j.company)}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0;">
            <span class="badge" style="background:${scoreColor}; color:#fff; font-size:11px; padding:2px 8px; border-radius:12px;">${scoreLabel} (${j._priority_score})</span>
            ${salaryShort ? `<span class="badge badge-salary">${esc(salaryShort)}</span>` : ''}
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

  // ── Job Status (Shortlist / Discard) ──
  var JOB_STATUS_KEY = 'gs_job_status'; // localStorage key
  var jobStatusFilter = 'all'; // 'all' | 'shortlisted' | 'discarded'

  // ── Job Pill Filter & Unread Tracking ──
  var jobPillFilter = 'all';
  var VIEWED_JOBS_KEY = 'gs_viewed_jobs';

  function getViewedJobs() {
    try {
      var s = localStorage.getItem(VIEWED_JOBS_KEY);
      if (s) return JSON.parse(s);
      return [];
    } catch (e) { return []; }
  }

  function markJobViewed(jobId) {
    var viewed = getViewedJobs();
    if (viewed.indexOf(jobId) === -1) {
      viewed.push(jobId);
      try {
        localStorage.setItem(VIEWED_JOBS_KEY, JSON.stringify(viewed));
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

  function isJobNew(job) {
    var d = job.date_added || job.add_date || '';
    if (!d) return isNewJob(job); // fallback to old logic
    var added = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(added.getTime())) return isNewJob(job);
    var now = new Date();
    return (now - added) < 7 * 86400000; // 7 days
  }

  function getJobStatuses() {
    try { return JSON.parse(localStorage.getItem(JOB_STATUS_KEY)) || {}; } catch(e) { return {}; }
  }
  function saveJobStatuses(statuses) {
    try { localStorage.setItem(JOB_STATUS_KEY, JSON.stringify(statuses)); } catch(e) {}
  }
  function getJobKey(j) {
    // Unique key: title + company (case-insensitive)
    return ((j.title || '') + '||' + (j.company || '')).toLowerCase().trim();
  }
  function getJobStatus(j) {
    return getJobStatuses()[getJobKey(j)] || 'none'; // 'none' | 'shortlisted' | 'discarded'
  }
  function setJobStatus(j, status) {
    var statuses = getJobStatuses();
    var key = getJobKey(j);
    if (status === 'none') { delete statuses[key]; } else { statuses[key] = status; }
    saveJobStatuses(statuses);
  }

  function updateStatusCounts() {
    // Temporarily bypass status filter to get all jobs matching other filters
    var savedFilter = jobStatusFilter;
    jobStatusFilter = '_bypass_'; // special value that skips status filtering
    var allJobs = getFilteredJobs('_bypass_');
    jobStatusFilter = savedFilter;

    var shortlisted = 0, discarded = 0, newCount = 0;
    allJobs.forEach(function(j) {
      var s = getJobStatus(j);
      if (s === 'shortlisted') shortlisted++;
      if (s === 'discarded') discarded++;
      if (isNewJob(j)) newCount++;
    });
    var all = allJobs.length - discarded;
    var elAll = document.getElementById('countAll');
    var elNew = document.getElementById('countNew');
    var elShort = document.getElementById('countShortlisted');
    var elDisc = document.getElementById('countDiscarded');
    if (elAll) elAll.textContent = all;
    if (elNew) elNew.textContent = newCount;
    if (elShort) elShort.textContent = shortlisted;
    if (elDisc) elDisc.textContent = discarded;
  }

  // Status bar event delegation
  var jobStatusBarEl = document.getElementById('jobStatusBar');
  if (jobStatusBarEl) {
    jobStatusBarEl.addEventListener('click', function(e) {
      var btn = e.target.closest('.job-status-btn');
      if (!btn) return;
      var status = btn.getAttribute('data-status');
      jobStatusFilter = status;
      document.querySelectorAll('.job-status-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      jobPage = 1;
      renderJobs();
    });
  }

  // ── Jobs Section ──
  let jobPage = 1;
  const JOBS_PER_PAGE = 20;

  function populateJobFilters() {
    const regions = [...new Set(jobs.map(j => j.region).filter(Boolean))].sort();
    const fRegion = document.getElementById('filterRegion');
    regions.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; fRegion.appendChild(o); });

    // Derive rough industry from company names or use source field
    const industries = ['Private Equity', 'Development Finance', 'Infrastructure', 'Insurance', 'Climate/Impact', 'Fund-of-Funds', 'Sovereign Wealth', 'Pension Fund', 'Foundation', 'Endowment', 'Corporate Venture Capital', 'Emerging Markets', 'Family Office', 'Investment Consulting', 'Alternatives', 'Due Diligence', 'Investor Relations', 'Fund Solutions', 'Critical Minerals'];
    const fInd = document.getElementById('filterIndustry');
    industries.forEach(i => { const o = document.createElement('option'); o.value = i; o.textContent = i; fInd.appendChild(o); });
  }

  // Industry keyword map used for fuzzy matching jobs to industry tags
  var INDUSTRY_KEY_MAP = {
    'climate / clean energy': 'climate|clean energy|energy transition|renewab',
    'climate/impact': 'climate|impact|esg|sustainab',
    'impact / esg investing': 'impact|esg|sustainab|social impact',
    'fund-of-funds': 'fund.of.fund|fof|fund invest',
    'pension fund': 'pension|retirement|superannuation|calpers|calstrs',
    'foundation': 'foundation|philanthrop|endowment fund',
    'endowment': 'endowment|university invest|nyu|harvard|yale|stanford',
    'corporate venture capital': 'corporate venture|cvc|corporate invest|venture capital.*corp',
    'emerging markets investment': 'emerging market|frontier|developing|latam|latin america|africa|asia.pacific|idb|ifc|dfc|dfi',
    'emerging markets': 'emerging market|frontier|developing|latam|latin america|africa|asia.pacific|idb|ifc|dfc|dfi|development finance',
    'family office': 'family office|family invest|single.family|multi.family|uhnw|high.net.worth',
    'investment consulting': 'investment consult|ocio|outsourced cio|advisory|cambridge associate|mercer|consultant',
    'alternatives': 'alternative|hedge fund|real asset|private market|private capital|real estate fund',
    'due diligence': 'due diligence|compliance|risk|integrity|investigation',
    'investor relations': 'investor relation|\\bir\\b|capital raising|fundrais',
    'fund solutions': 'fund solution|fund service|fund admin|custody|transfer agent|fund account',
    'critical minerals': 'critical mineral|mining|metals|battery|lithium|cobalt|rare earth|nickel|copper|graphite|manganese|mineral',
    'mining': 'mining|metals|mineral|lithium|cobalt|rare earth|nickel|copper',
    'development finance institution': 'development finance|dfi|idb|ifc|ebrd|adb|afdb|aiib|dfc|world bank|multilateral',
    'infrastructure': 'infrastructure|infra|transport|energy|utility|toll|port|airport',
    'private equity': 'private equity|pe |buyout|leveraged|growth equity|mezzanine',
    'sovereign wealth fund': 'sovereign wealth|swf|government invest|state invest',
    'insurance': 'insurance|insur|underwriting|reinsur'
  };

  function jobMatchesIndustry(j, ind) {
    // First check the job's own industry field
    var jobInd = (j.industry || '').toLowerCase();
    var indLower = ind.toLowerCase();
    if (jobInd && (jobInd === indLower || jobInd.includes(indLower) || indLower.includes(jobInd))) return true;
    // Fuzzy match against job text
    var text = ((j.title || '') + ' ' + (j.company || '') + ' ' + (j.goldie_fit || '') + ' ' + (j.suggested_recruiter || '') + ' ' + (j.requirements || '') + ' ' + (j.notes || '')).toLowerCase();
    var pattern = INDUSTRY_KEY_MAP[indLower] || indLower.split('/')[0].trim();
    try { return new RegExp(pattern).test(text); } catch(e) { return text.includes(indLower); }
  }

  function jobMatchesRegion(j, activeRegions) {
    var jobRegion = (j.region || '').toLowerCase();
    return activeRegions.some(function(r) {
      var rLow = r.toLowerCase();
      return jobRegion === rLow || jobRegion.includes(rLow) || rLow.includes(jobRegion);
    });
  }

  function jobMatchesTitleLevel(j, activeTitles) {
    var jobTitle = (j.title || '').toLowerCase();
    return activeTitles.some(function(t) {
      var tLow = t.toLowerCase();
      // Extract core keyword from format like "Managing Director (MD)"
      var match = tLow.match(/^([^(]+)/);
      var core = match ? match[1].trim() : tLow;
      // Also check abbreviation in parentheses
      var abbrMatch = tLow.match(/\(([^)]+)\)/);
      var abbr = abbrMatch ? abbrMatch[1].trim() : '';
      if (jobTitle.includes(core)) return true;
      if (abbr && new RegExp('\\b' + abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(jobTitle)) return true;
      // Special cases
      if (core.includes('head of') && (jobTitle.includes('head of') || jobTitle.includes('global head'))) return true;
      if (core.includes('chief') && jobTitle.includes('chief')) return true;
      if (core.includes('c-suite') && /\bchief\b|\bcio\b|\bceo\b|\bcfo\b|\bcoo\b|\bcto\b/.test(jobTitle)) return true;
      if (core.includes('director') && core.includes('dfi') && jobTitle.includes('director')) return true;
      return false;
    });
  }

  function getFilteredJobs(statusOverride) {
    const region = document.getElementById('filterRegion').value;
    const industry = document.getElementById('filterIndustry').value;
    const search = document.getElementById('filterJobSearch').value.toLowerCase();
    var statusView = statusOverride || jobStatusFilter;

    // Get active search parameter tags
    var activeIndustries = getParamData('industries');
    var activeRegions = getParamData('regions');
    var activeTitles = getParamData('titleLevels');

    return jobs.filter(j => {
      // 0a. Pill filter
      if (jobPillFilter === 'new' && !isJobNew(j)) return false;
      if (jobPillFilter === 'unread' && !isJobUnread(j)) return false;
      if (jobPillFilter === 'active' && j.status === 'networking_target') return false;
      if (jobPillFilter === 'networking' && j.status !== 'networking_target') return false;
      if (jobPillFilter === 'saved') {
        var savedNames = getSavedJobIds();
        if (savedNames.indexOf(j.title) === -1) return false;
      }

      // 0. Status filter
      if (statusView !== '_bypass_') {
        var jStatus = getJobStatus(j);
        if (statusView === 'new' && !isNewJob(j)) return false;
        if (statusView === 'shortlisted' && jStatus !== 'shortlisted') return false;
        if (statusView === 'discarded' && jStatus !== 'discarded') return false;
        if (statusView === 'all' && jStatus === 'discarded') return false; // hide discarded from "All"
      }

      // 1. Dropdown filters (user selects specific region/industry on Job Openings page)
      if (region && j.region !== region) return false;
      if (industry) {
        if (!jobMatchesIndustry(j, industry)) return false;
      }
      if (search) {
        const text = ((j.title || '') + ' ' + (j.company || '') + ' ' + (j.location || '')).toLowerCase();
        if (!text.includes(search)) return false;
      }

      // 2. Search parameter tag filters (from Profile > Search Parameters)
      // Job must match at least one active industry tag
      if (activeIndustries.length > 0) {
        var matchesAnyIndustry = activeIndustries.some(function(ind) {
          return jobMatchesIndustry(j, ind);
        });
        if (!matchesAnyIndustry) return false;
      }

      // Job must match at least one active region tag
      if (activeRegions.length > 0) {
        if (!jobMatchesRegion(j, activeRegions)) return false;
      }

      // Job must match at least one active title level tag
      if (activeTitles.length > 0) {
        if (!jobMatchesTitleLevel(j, activeTitles)) return false;
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
      case 'newest':
        sorted.sort(function(a, b) {
          var aNew = isNewJob(a) ? 1 : 0;
          var bNew = isNewJob(b) ? 1 : 0;
          if (bNew !== aNew) return bNew - aNew;
          // Among new jobs, sort by add_date desc; among old, by priority
          var aDate = a.add_date ? new Date(a.add_date) : new Date(0);
          var bDate = b.add_date ? new Date(b.add_date) : new Date(0);
          return bDate - aDate || (b._priority_score || 0) - (a._priority_score || 0);
        });
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

  function isNewJob(j) {
    var now = new Date();
    var sevenDays = 7 * 24 * 60 * 60 * 1000;
    // Primary: check add_date field (set by cron when job is added)
    if (j.add_date) {
      return (now - new Date(j.add_date)) < sevenDays;
    }
    // Fallback: check notes for YYYY-MM-DD pattern
    var notes = j.notes || '';
    var dateMatch = notes.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return (now - new Date(dateMatch[1])) < sevenDays;
    }
    // Fallback: check date_posted for YYYY-MM-DD
    var posted = j.date_posted || '';
    if (/^\d{4}-\d{2}-\d{2}/.test(posted)) {
      var postDate = new Date(posted);
      if (!isNaN(postDate.getTime())) return (now - postDate) < sevenDays;
    }
    return false;
  }

  function renderJobs() {
    var filtered = sortJobs(getFilteredJobs());
    document.getElementById('jobCount').textContent = filtered.length;
    updatePillCounts();
    const start = (jobPage - 1) * JOBS_PER_PAGE;
    const paged = filtered.slice(start, start + JOBS_PER_PAGE);

    document.getElementById('jobsList').innerHTML = paged.map(j => {
      const idx = jobs.indexOf(j);
      var jStatus = getJobStatus(j);
      var cardClass = 'result-card';
      if (isJobNew(j)) cardClass += ' result-card-new';
      if (jStatus === 'shortlisted') cardClass += ' card-shortlisted';
      if (jStatus === 'discarded') cardClass += ' card-discarded';

      // Build action buttons based on current status
      var actionBtns = '';
      if (jStatus === 'discarded') {
        // Show restore button
        actionBtns = '<div class="job-actions">' +
          '<button class="job-action-btn btn-restore" data-action="restore" data-job-idx="' + idx + '" title="Restore">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 019-9 9 9 0 016.36 2.64L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9 9 0 01-6.36-2.64L3 16"/><path d="M3 21v-5h5"/></svg>' +
          '</button>' +
        '</div>';
      } else {
        // Show shortlist + discard buttons
        actionBtns = '<div class="job-actions">' +
          '<button class="job-action-btn btn-shortlist' + (jStatus === 'shortlisted' ? ' active' : '') + '" data-action="shortlist" data-job-idx="' + idx + '" title="' + (jStatus === 'shortlisted' ? 'Remove from shortlist' : 'Shortlist') + '">' +
            '<span class="shortlist-star">' + (jStatus === 'shortlisted' ? '★' : '☆') + '</span>' +
          '</button>' +
          '<button class="job-action-btn btn-discard" data-action="discard" data-job-idx="' + idx + '" title="Discard">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>';
      }

      var priorityLevel = j._priority_score >= 80 ? 'exceptional' : j._priority_score >= 65 ? 'very-strong' : j._priority_score >= 50 ? 'strong' : 'good';
      return `
      <div class="${cardClass}" data-job-idx="${idx}" data-priority="${priorityLevel}">
        <div class="result-header">
          <div style="flex:1;min-width:0;">
            <div class="result-title">${isJobUnread(j) ? '<span class="unread-dot"></span>' : ''}${isNewJob(j) || isJobNew(j) ? '<span class="new-badge">NEW</span> ' : ''}${esc(j.title)}${jStatus === 'shortlisted' ? '<span class="shortlist-badge">★ Shortlisted</span>' : ''}</div>
            <div class="result-company">${esc(j.company)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${(j.salary_range || j.salary) ? `<span class="badge badge-salary">${esc(formatSalaryBadge(j))}</span>` : '<span class="badge">Salary TBD</span>'}
            ${actionBtns}
          </div>
        </div>
        <div class="result-tags">
          ${j.industry ? `<span class="tag tag-industry">${esc(j.industry.split('/')[0].split(',')[0].trim())}</span>` : ''}
          ${j.status === 'networking_target' ? '<span class="tag tag-networking">Networking Target</span>' : '<span class="tag tag-active">Active</span>'}
          ${j.region ? `<span class="tag tag-region">${esc(j.region)}</span>` : ''}
        </div>
        <div class="result-meta">
          <span class="result-meta-item">📍 ${esc(j.location || 'Global')}</span>
          <span class="result-meta-item">${esc(j.region || '')}</span>
          ${j.date_posted ? `<span class="result-meta-item">Posted: ${esc(j.date_posted)}</span>` : ''}
          ${j.suggested_recruiter ? `<span class="result-meta-item">🔍 ${esc(truncate(j.suggested_recruiter, 50))}</span>` : ''}
          ${j._hiring_managers && j._hiring_managers.length > 0 ? `<span class="result-meta-item" style="color:var(--color-primary);">👤 ${esc(j._hiring_managers[0].contact ? j._hiring_managers[0].contact.name : j._hiring_managers[0].firm)}</span>` : ''}
        </div>
        <div class="result-fit">${esc(j.goldie_fit || '')}</div>
      </div>`;
    }).join('') + renderPagination(filtered.length, jobPage, JOBS_PER_PAGE, 'job');
    bindJobClicks();
    bindPagination('job', filtered.length, () => { renderJobs(); });
    updateStatusCounts();
  }

  function openJobDetail(idx) {
    const j = jobs[idx];
    if (!j) return;
    markJobViewed(j.id);
    updatePillCounts();
    renderJobs();
    document.getElementById('jobDetailTitle').textContent = j.title;

    const recruiterMatch = findMatchingRecruiter(j);

    document.getElementById('jobDetailBody').innerHTML = `
      <div class="job-detail-grid">
        <div class="job-detail-section">
          <div class="job-detail-label">Company</div>
          <div class="job-detail-value">${esc(j.company)}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Location</div>
          <div class="job-detail-value">${esc(j.location || 'Not specified')} · ${esc(j.region || '')}</div>
        </div>
        <div class="job-detail-section">
          <div class="job-detail-label">Compensation</div>
          <div class="job-detail-value">${esc(j.salary_range || 'Contact recruiter for details')}</div>
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
          <button class="btn btn-sm ${getJobStatus(j) === 'shortlisted' ? 'btn-primary' : 'btn-outline'} detail-shortlist-btn" data-detail-idx="${idx}">${getJobStatus(j) === 'shortlisted' ? '★ Shortlisted' : '☆ Shortlist'}</button>
          <button class="btn btn-sm btn-tailor" onclick="window._tailorCV(${idx})">Tailor CV</button>
        </div>
      </div>
    `;
    document.getElementById('jobDetailModal').classList.add('show');

    // Bind shortlist button in detail modal
    var detailBtn = document.querySelector('.detail-shortlist-btn');
    if (detailBtn) {
      detailBtn.addEventListener('click', function() {
        var dIdx = parseInt(this.getAttribute('data-detail-idx'), 10);
        var dJob = jobs[dIdx];
        if (!dJob) return;
        var cur = getJobStatus(dJob);
        setJobStatus(dJob, cur === 'shortlisted' ? 'none' : 'shortlisted');
        renderJobs();
        // Update button text
        var newStatus = getJobStatus(dJob);
        this.textContent = newStatus === 'shortlisted' ? '\u2605 Shortlisted' : '\u2606 Shortlist';
        this.className = 'btn btn-sm ' + (newStatus === 'shortlisted' ? 'btn-primary' : 'btn-outline') + ' detail-shortlist-btn';
      });
    }
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
    // Legacy — kept as no-op since we now use event delegation below
  }

  // Event delegation for result card clicks (covers both Jobs list and Top Priority)
  document.addEventListener('click', function(e) {
    if (e.target.closest('.job-action-btn') || e.target.closest('.btn-tailor')) return;
    var card = e.target.closest('.result-card[data-job-idx]');
    if (card) {
      openJobDetail(parseInt(card.dataset.jobIdx));
    }
  });

  // Event delegation for job action buttons (shortlist/discard/restore)
  document.getElementById('jobsList').addEventListener('click', function(e) {
    var btn = e.target.closest('.job-action-btn');
    if (!btn) return;
    e.stopPropagation();
    var action = btn.getAttribute('data-action');
    var idx = parseInt(btn.getAttribute('data-job-idx'), 10);
    var job = jobs[idx];
    if (!job) return;

    var card = btn.closest('.result-card');

    if (action === 'shortlist') {
      var current = getJobStatus(job);
      if (current === 'shortlisted') {
        setJobStatus(job, 'none');
      } else {
        setJobStatus(job, 'shortlisted');
      }
      renderJobs();
    } else if (action === 'discard') {
      setJobStatus(job, 'discarded');
      if (card && jobStatusFilter !== 'discarded') {
        card.classList.add('card-exit');
        card.addEventListener('animationend', function() { renderJobs(); }, { once: true });
      } else {
        renderJobs();
      }
    } else if (action === 'restore') {
      setJobStatus(job, 'none');
      renderJobs();
    }
  });

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
        <div class="timeline-role" title="${esc(t.role)}">${esc(t.role)}</div>
        <div class="timeline-company" title="${esc(t.company)}">${esc(t.company)}</div>
        <div class="timeline-period">${esc(t.period)}</div>
        ${t.year_start ? '<div class="timeline-year">' + esc(String(t.year_start)) + '</div>' : ''}
      </div>
    `).join('');

    // Horizontal scroll: hide hint when scrolled to end, toggle fade
    var tlEl = document.getElementById('careerTimeline');
    var tlWrap = document.getElementById('timelineWrapper');
    var tlHint = document.getElementById('timelineScrollHint');
    if (tlEl && tlWrap) {
      var checkScroll = function() {
        var atEnd = tlEl.scrollLeft + tlEl.clientWidth >= tlEl.scrollWidth - 8;
        if (atEnd) {
          tlWrap.classList.add('scrolled-end');
          if (tlHint) tlHint.style.display = 'none';
        } else {
          tlWrap.classList.remove('scrolled-end');
          if (tlHint) tlHint.style.display = '';
        }
      };
      tlEl.addEventListener('scroll', checkScroll);
      setTimeout(checkScroll, 100);
    }

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

    renderSearchParams();
  }

  // ── Interactive Search Parameters ──
  var PARAM_DEFAULTS = {
    titleLevels: [
      'Managing Director (MD)', 'Senior Managing Director (SMD)', 'Partner',
      'Chief Investment Officer (CIO)', 'Chief Executive Officer (CEO)',
      'Executive Vice President (EVP)', 'Senior Vice President (SVP)',
      'Head of / Global Head', 'Chief (C-suite)',
      'Director (DFI/multilateral only)'
    ],
    industries: [
      'Private Equity', 'Fund-of-Funds', 'Development Finance Institution',
      'Infrastructure', 'Climate / Clean Energy', 'Impact / ESG Investing',
      'Sovereign Wealth Fund', 'Insurance', 'Critical Minerals', 'Mining',
      'Pension Fund', 'Foundation', 'Corporate Venture Capital',
      'Emerging Markets Investment', 'Family Office', 'Investment Consulting',
      'Alternatives', 'Endowment', 'Due Diligence', 'Investor Relations',
      'Fund Solutions'
    ],
    regions: [
      'North America', 'Latin America & Caribbean', 'Europe',
      'Asia-Pacific', 'Africa', 'Middle East', 'Americas / Global'
    ],
    sources: [
      'LinkedIn Jobs', 'Indeed', 'eFinancialCareers', 'ImpactPool',
      'IFC Careers (World Bank Group)', 'EBRD Careers',
      'IDB / IDB Invest Careers', 'ADB Careers', 'AfDB Careers',
      'AIIB Careers', 'Company Career Pages', 'Executive Recruiter Boards'
    ],
    expertise: (candidate.expertise || []).slice()
  };

  function getParamData(key) {
    try {
      var saved = localStorage.getItem('gs_param_' + key);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return PARAM_DEFAULTS[key].slice();
  }

  function saveParamData(key, arr) {
    try { localStorage.setItem('gs_param_' + key, JSON.stringify(arr)); } catch(e) {}
  }

  function renderParamCard(containerId, key, cssClass) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var items = getParamData(key);
    var html = '';
    items.forEach(function(item, idx) {
      html += '<span class="param-tag ' + cssClass + '" data-key="' + esc(key) + '" data-idx="' + idx + '">' +
        esc(item) +
        '<button class="param-tag-remove" title="Remove" data-key="' + esc(key) + '" data-idx="' + idx + '">&times;</button>' +
        '</span>';
    });
    html += '<button class="param-add-btn" data-key="' + esc(key) + '" title="Add new">+ Add</button>';
    el.innerHTML = html;
  }

  function renderSearchParams() {
    renderParamCard('titleLevelTags', 'titleLevels', 'param-tag-title');
    renderParamCard('industryTags', 'industries', 'param-tag-industry');
    renderParamCard('regionTags', 'regions', 'param-tag-region');
    renderParamCard('sourceTags', 'sources', 'param-tag-source');
    renderParamCard('matchingExpertiseTags', 'expertise', 'param-tag-expertise');
  }

  // Central function to refresh all views when search parameters change
  function refreshAllViews() {
    jobPage = 1; // Reset to first page since filter changed
    renderJobs();
    renderKPIs();
    renderCharts();
    // Show a brief confirmation toast
    showParamChangeToast();
  }

  function showParamChangeToast() {
    var existing = document.getElementById('paramChangeToast');
    if (existing) existing.remove();
    var filtered = getFilteredJobs();
    var toast = document.createElement('div');
    toast.id = 'paramChangeToast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--color-primary);color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.3s;';
    toast.textContent = 'Filters updated — ' + filtered.length + ' job' + (filtered.length !== 1 ? 's' : '') + ' match';
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 2500);
  }

  function handleParamRemove(key, idx) {
    var items = getParamData(key);
    if (idx >= 0 && idx < items.length) {
      items.splice(idx, 1);
      saveParamData(key, items);
      renderSearchParams();
      // Immediately re-filter jobs and update all views
      refreshAllViews();
    }
  }

  function handleParamAdd(key) {
    // Show inline input
    var label = {titleLevels:'title level',industries:'industry',regions:'region',sources:'source',expertise:'expertise tag'}[key] || 'item';
    var value = prompt('Enter new ' + label + ':');
    if (value && value.trim()) {
      var items = getParamData(key);
      var trimmed = value.trim();
      // Prevent duplicates (case-insensitive)
      var isDup = items.some(function(i) { return i.toLowerCase() === trimmed.toLowerCase(); });
      if (!isDup) {
        items.push(trimmed);
        saveParamData(key, items);
        renderSearchParams();
        // Immediately re-filter jobs and update all views
        refreshAllViews();
      }
    }
  }

  // Event delegation for param tag interactions
  document.addEventListener('click', function(e) {
    // Remove button
    if (e.target.classList.contains('param-tag-remove')) {
      e.stopPropagation();
      var key = e.target.getAttribute('data-key');
      var idx = parseInt(e.target.getAttribute('data-idx'), 10);
      handleParamRemove(key, idx);
      return;
    }
    // Add button
    if (e.target.classList.contains('param-add-btn')) {
      e.stopPropagation();
      var key = e.target.getAttribute('data-key');
      handleParamAdd(key);
      return;
    }
  });

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
      'Interactive search parameters',
      'Live tag-based job filtering',
      'Horizontal career timeline',
      'Free access'
    ];

    const platformsToCompare = [
      { name: 'GS Search', highlight: true, scores: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] },
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
            0, // interactive search parameters
            n.includes('LinkedIn') ? 1 : 0, // live filtering (LinkedIn has basic filters)
            0, // horizontal career timeline
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
  ['filterCompRegion', 'filterCompIndustry', 'filterCompSearch'].forEach(id => {
    document.getElementById(id).addEventListener(id.includes('Search') ? 'input' : 'change', debounce(() => { companyPage = 1; renderCompanies(); }, 200));
  });
  ['filterRecIndustry', 'filterRecType', 'filterRecSearch'].forEach(id => {
    document.getElementById(id).addEventListener(id.includes('Search') ? 'input' : 'change', debounce(() => { recruiterPage = 1; renderRecruiters(); }, 200));
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

  // ── Utilities ──
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function truncate(str, len) { return (str || '').length > len ? str.substring(0, len) + '...' : str || ''; }
  function stripTags(str) { return (str || '').replace(/<[^>]*>/g, ''); }

  // Safe element binding — prevents null crashes from taking down the app
  function safeOn(id, event, handler) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener(event, handler); }
    else { console.warn('safeOn: element #' + id + ' not found'); }
    return el;
  }

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
      if (_store) {
        var stored = _store.getItem(UPDATES_KEY);
        if (stored) return JSON.parse(stored);
      }
      return _updatesMemory || INITIAL_UPDATES;
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

  // ── Application Tools (CV Generator, Cover Letter, Outreach) ──
  function initApplicationTools() {
    // Helper: populate a <select> with active jobs
    function populateJobSelect(selectEl) {
      if (!selectEl) return;
      selectEl.innerHTML = '<option value="">\u2014 Choose a job opening \u2014</option>';
      jobs.forEach(function(j, idx) {
        var opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = esc(j.title) + ' \u2014 ' + esc(j.company);
        selectEl.appendChild(opt);
      });
    }

    // Helper: open/close a modal
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
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push('PROFESSIONAL SUMMARY');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      var summary = 'Senior global investment executive with ' + (c.experience_years || 25) + '+ years of leadership in ';
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
      if (focusAreas) { summary += 'Specialized focus on ' + focusAreas + '. '; }
      summary += 'Wharton MBA. Fluent in English, Spanish, and Hebrew.';
      lines.push(summary);
      lines.push('');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push('TARGET POSITION');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push(job.title + ' \u2014 ' + job.company);
      if (job.region) lines.push('Region: ' + job.region);
      if (job.industry) lines.push('Industry: ' + job.industry);
      lines.push('');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push('PROFESSIONAL EXPERIENCE');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      tl.forEach(function(t) {
        lines.push('');
        lines.push(t.role.toUpperCase());
        lines.push(t.company + ' | ' + t.period);
        var bullets = getExperienceBullets(t, job);
        bullets.forEach(function(b) { lines.push('  \u2022 ' + b); });
      });
      lines.push('');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push('EDUCATION');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      (c.education || []).forEach(function(e) {
        lines.push(e.degree + ' \u2014 ' + e.school + ' (' + e.years + ')');
      });
      lines.push('');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push('CORE COMPETENCIES');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push((c.expertise || []).join(' \u00b7 '));
      lines.push('');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push('LANGUAGES');
      lines.push('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
      lines.push((c.languages || []).join(', '));
      lines.push('');
      lines.push('\u2014 Tailored for: ' + job.title + ' at ' + job.company + ' \u2014');
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

      var p1 = openingStyle + job.title + ' position at ' + job.company + '. ';
      p1 += 'With over ' + (c.experience_years || 25) + ' years of senior leadership in global investment management, ';
      p1 += 'including my current role as ' + c.title + ' at the ' + c.company + ', ';
      p1 += 'I am confident in my ability to deliver immediate and measurable impact in this role.';

      var p2 = '';
      if (/critical mineral|mining|metals|battery/.test(jobIndustry + ' ' + jobTitle)) {
        p2 = 'My career has been defined by deploying capital into strategic sectors including critical minerals \u2014 lithium, cobalt, rare earths, and battery metals \u2014 through fund-of-funds structures at the U.S. DFC. I have led investment teams focused on securing supply chains essential to energy transition and national security, working closely with mining operators, sovereign partners, and institutional co-investors across multiple continents.';
      } else if (/infrastructure|climate|energy/.test(jobIndustry + ' ' + jobTitle)) {
        p2 = 'Throughout my career, I have led substantial infrastructure and climate finance programs across emerging markets. At the DFC, I directed fund investments into renewable energy, climate adaptation infrastructure, and sustainable development projects spanning Latin America, Africa, and Asia. My expertise in blended finance structures has enabled the mobilization of private capital at scale alongside development funding.';
      } else if (/private equity|\bpe\b|fund.of.fund|venture|alternative/.test(jobIndustry + ' ' + jobTitle)) {
        p2 = 'I bring deep expertise in private equity fund-of-funds strategy, having managed multi-billion dollar portfolios at both the U.S. DFC and IDB Invest. My investment philosophy combines rigorous due diligence with strategic portfolio construction across emerging and frontier markets. I have originated, structured, and overseen PE fund commitments that delivered strong risk-adjusted returns while advancing development outcomes.';
      } else if (/development finance|dfi|multilateral/.test(jobIndustry + ' ' + jobTitle + ' ' + companyLower)) {
        p2 = 'My career in development finance institutions \u2014 spanning the U.S. DFC and IDB Invest \u2014 has given me a comprehensive understanding of multilateral investment operations, policy frameworks, and stakeholder engagement at the highest levels. I currently manage teams of Managing Directors across global fund strategies, overseeing investment programs that span 70+ countries and multiple asset classes.';
      } else if (/pension|endowment|foundation|sovereign|insurance/.test(jobIndustry + ' ' + jobTitle + ' ' + companyLower)) {
        p2 = 'My extensive experience managing institutional capital across diverse asset classes \u2014 from fund-of-funds and private equity to infrastructure and climate finance \u2014 positions me to contribute meaningfully to your investment strategy. I have built deep relationships with sovereign wealth funds, pension systems, family offices, and multilateral institutions throughout my career at the DFC and IDB Invest.';
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
        lines.push('Subject: ' + job.title + ' Opportunity at ' + job.company + ' \u2014 Goldie Shturman');
        lines.push('');
        lines.push('Dear ' + recipientFirst + ',');
        lines.push('');
        lines.push('I am reaching out regarding the ' + job.title + ' position at ' + job.company + '. With over ' + (c.experience_years || 25) + ' years of senior leadership in global investment management \u2014 including my current role as ' + c.title + ' at the ' + c.company + ' \u2014 I believe my profile aligns strongly with this opportunity.');
        lines.push('');
        lines.push('Key highlights of my background:');
        lines.push('\u2022 Currently leading the Office of Investment Funds at the U.S. DFC, overseeing Managing Directors across global fund strategies');
        lines.push('\u2022 Former Managing Director at DFC, covering Latin American PE fund investments');
        lines.push('\u2022 Senior Investment Officer at IDB Invest with deep multilateral networks');
        lines.push('\u2022 Wharton MBA, fluent in English, Spanish, and Hebrew');
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
        lines.push('Hi ' + recipientFirst + ',');
        lines.push('');
        lines.push('I hope you\'re doing well. I\'m reaching out because I noticed the ' + job.title + ' position at ' + job.company + ', and I believe my background may be a strong fit.');
        lines.push('');
        lines.push('I\'m currently ' + c.title + ' at the ' + c.company + ', leading global fund-of-funds strategies across PE, infrastructure, and climate finance. Previously, I was MD at DFC and Senior Investment Officer at IDB Invest.');
        lines.push('');
        lines.push('Would you happen to know anyone at ' + job.company + ' or in the hiring process whom you could introduce me to? Any guidance or connection would be enormously appreciated.');
        lines.push('');
        lines.push('Thank you so much \u2014 happy to share more details about my background anytime.');
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
          navigator.clipboard.writeText(text).then(function() { flashButton(btn, 'Copied!'); });
        } else {
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
      } catch (e) { flashButton(btn, 'Copy failed'); }
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

  // ── Initialize ──
  function init() {
    renderLastUpdated();
    renderKPIs();
    renderCharts();
    renderTopJobs();
    populateJobFilters();
    document.getElementById('sortJobs').value = 'salary-desc';
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

    // Auto-check for fresh data on every page load (silent background refresh)
    silentDataRefresh();
  }

  // Silent background data refresh — runs on every page open (web or PWA)
  // Ensures both platforms always show the latest data from GitHub Pages
  function silentDataRefresh() {
    var bustUrl = 'data.js?_cb=' + Date.now();
    fetch(bustUrl, { cache: 'no-store' })
      .then(function(response) {
        if (!response.ok) return;
        return response.text();
      })
      .then(function(scriptText) {
        if (!scriptText) return;
        var freshData = null;
        try {
          var fn = new Function('var window = {}; ' + scriptText + ' return window.APP_DATA;');
          freshData = fn();
        } catch(e) { return; }

        if (!freshData || !freshData.jobs) return;

        // Only re-render if data actually changed
        var currentTs = data.last_updated || '';
        var freshTs = freshData.last_updated || '';
        if (currentTs === freshTs) return;

        // Apply fresh data silently
        Object.keys(freshData).forEach(function(key) {
          data[key] = freshData[key];
        });

        // Re-render everything
        try {
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
          renderPipeline();
          renderUpdates();
        } catch(e) {
          console.warn('Silent refresh re-render error:', e);
        }
        console.log('Data silently refreshed from server (' + freshTs + ')');
      })
      .catch(function() {
        // Silently fail — user will see cached data which is fine
      });
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
      title.textContent = 'Checking for updates...';
      text.textContent = 'Fetching the latest data from the server.';

      // Tell the service worker to clear cached data.js
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'REFRESH_DATA' });
      }

      // Actually fetch fresh data.js from GitHub Pages (cache-busted)
      const bustUrl = 'data.js?_cb=' + Date.now();
      bar.style.width = '30%';
      title.textContent = 'Fetching latest data...';
      text.textContent = 'Downloading the most recent job listings and updates.';

      fetch(bustUrl, { cache: 'no-store' })
        .then(function(response) {
          if (!response.ok) throw new Error('Network response was not ok');
          return response.text();
        })
        .then(function(scriptText) {
          bar.style.width = '60%';
          title.textContent = 'Processing data...';
          text.textContent = 'Parsing updated job listings, companies, and recruiters.';

          // Parse fresh data — execute in a sandboxed way
          var freshData = null;
          try {
            var fn = new Function('var window = {}; ' + scriptText + ' return window.APP_DATA;');
            freshData = fn();
          } catch(e) {
            console.error('Failed to parse fresh data:', e);
          }

          if (freshData && freshData.jobs) {
            bar.style.width = '85%';
            title.textContent = 'Updating dashboard...';
            text.textContent = 'Applying changes to all sections.';

            // Detect what changed
            var oldCount = data.jobs ? data.jobs.length : 0;
            var newCount = freshData.jobs.length;
            var oldTimestamp = data.last_updated || '';
            var newTimestamp = freshData.last_updated || '';

            // Replace the global data object
            Object.keys(freshData).forEach(function(key) {
              data[key] = freshData[key];
            });

            setTimeout(function() {
              bar.style.width = '100%';

              if (newTimestamp !== oldTimestamp || newCount !== oldCount) {
                title.textContent = 'Updated!';
                var changes = [];
                if (newCount > oldCount) changes.push((newCount - oldCount) + ' new job(s) found');
                if (newCount < oldCount) changes.push((oldCount - newCount) + ' expired job(s) removed');
                if (changes.length === 0 && newTimestamp !== oldTimestamp) changes.push('Data refreshed');
                text.textContent = changes.join(', ') + '. Dashboard is now up to date.';
              } else {
                title.textContent = 'Already up to date';
                text.textContent = 'No new changes since last update. The platform refreshes daily at 7:00 AM ET.';
              }

              // Re-render all sections with fresh data
              try {
                renderLastUpdated();
                if (typeof renderDashboard === 'function') renderDashboard();
                if (typeof renderJobs === 'function') renderJobs();
                if (typeof renderCompanies === 'function') renderCompanies();
                if (typeof renderRecruiters === 'function') renderRecruiters();
                if (typeof renderUpdates === 'function') renderUpdates();
                if (typeof renderCompensation === 'function') renderCompensation();
              } catch(e) {
                console.warn('Re-render partial error:', e);
              }

              setTimeout(function() {
                overlay.classList.remove('show');
              }, 2000);
            }, 500);
          } else {
            throw new Error('Invalid data format');
          }
        })
        .catch(function(err) {
          console.error('Refresh failed:', err);
          bar.style.width = '100%';
          title.textContent = 'Update failed';
          text.textContent = 'Could not fetch the latest data. Please check your connection and try again.';
          setTimeout(function() {
            overlay.classList.remove('show');
          }, 2500);
        });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', startRefresh);
    if (refreshBtnDash) refreshBtnDash.addEventListener('click', startRefresh);
  }

  // ── CV Builder, Upload, Parse, Store, Tailor & Download ──
  (function initCV() {
    try {
    var CV_TEXT_KEY = 'gs_cv_text';
    var CV_META_KEY = 'gs_cv_meta';
    var DB_NAME = 'gs_cv_store';
    var DB_STORE = 'files';

    // IndexedDB helpers
    function openDB(cb) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) { e.target.result.createObjectStore(DB_STORE); };
      req.onsuccess = function(e) { cb(null, e.target.result); };
      req.onerror = function(e) { cb(e); };
    }
    function saveBlobToDB(blob, cb) {
      openDB(function(err, db) {
        if (err) return cb && cb(err);
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(blob, 'cv_file');
        tx.oncomplete = function() { cb && cb(null); };
        tx.onerror = function(e) { cb && cb(e); };
      });
    }
    function loadBlobFromDB(cb) {
      openDB(function(err, db) {
        if (err) return cb(err);
        var tx = db.transaction(DB_STORE, 'readonly');
        var req = tx.objectStore(DB_STORE).get('cv_file');
        req.onsuccess = function() { cb(null, req.result); };
        req.onerror = function(e) { cb(e); };
      });
    }
    function deleteBlobFromDB(cb) {
      openDB(function(err, db) {
        if (err) return cb && cb(err);
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete('cv_file');
        tx.oncomplete = function() { cb && cb(null); };
      });
    }

    // Parse PDF using pdf.js
    function parsePDF(arrayBuffer, cb) {
      if (typeof pdfjsLib === 'undefined') return cb('PDF.js not loaded');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(function(pdf) {
        var pages = [];
        var pending = pdf.numPages;
        for (var i = 1; i <= pdf.numPages; i++) {
          (function(pageNum) {
            pdf.getPage(pageNum).then(function(page) {
              page.getTextContent().then(function(content) {
                pages[pageNum - 1] = content.items.map(function(item) { return item.str; }).join(' ');
                pending--;
                if (pending === 0) cb(null, pages.join('\n\n'));
              });
            });
          })(i);
        }
      }).catch(function(err) { cb(err); });
    }

    // Parse DOCX using mammoth
    function parseDOCX(arrayBuffer, cb) {
      if (typeof mammoth === 'undefined') return cb('Mammoth.js not loaded');
      mammoth.extractRawText({ arrayBuffer: arrayBuffer }).then(function(result) {
        cb(null, result.value);
      }).catch(function(err) { cb(err); });
    }

    // Process uploaded file
    function processFile(file) {
      var ext = file.name.split('.').pop().toLowerCase();
      if (['pdf', 'docx', 'doc'].indexOf(ext) === -1) {
        showToast('Please upload a PDF or Word document.', 'warning');
        return;
      }
      var reader = new FileReader();
      reader.onload = function(e) {
        var buf = e.target.result;
        // Store raw file in IndexedDB
        saveBlobToDB(new Blob([buf], { type: file.type }));
        // Parse text
        var parseCb = function(err, text) {
          if (err) {
            console.error('CV parse error:', err);
            showToast('Could not parse the document. Try pasting text instead.', 'warning');
            return;
          }
          saveCVText(text, file.name, ext);
          showToast('CV uploaded and parsed successfully.', 'success');
        };
        if (ext === 'pdf') parsePDF(buf, parseCb);
        else parseDOCX(buf, parseCb);
      };
      reader.readAsArrayBuffer(file);
    }

    function saveCVText(text, fileName, fileType) {
      localStorage.setItem(CV_TEXT_KEY, text);
      localStorage.setItem(CV_META_KEY, JSON.stringify({
        fileName: fileName || 'pasted-cv.txt',
        fileType: fileType || 'txt',
        uploadedAt: new Date().toISOString()
      }));
      renderCVState();
    }

    function getCVText() {
      return localStorage.getItem(CV_TEXT_KEY) || '';
    }
    function getCVMeta() {
      try { return JSON.parse(localStorage.getItem(CV_META_KEY)) || null; } catch(e) { return null; }
    }
    function removeCVData() {
      localStorage.removeItem(CV_TEXT_KEY);
      localStorage.removeItem(CV_META_KEY);
      deleteBlobFromDB();
      renderCVState();
      showToast('CV removed.', 'info');
    }

    // Render upload vs preview state
    function renderCVState() {
      var uploadArea = document.getElementById('cvUploadArea');
      var preview = document.getElementById('cvPreview');
      var text = getCVText();
      var meta = getCVMeta();
      if (text && meta) {
        uploadArea.style.display = 'none';
        preview.style.display = 'block';
        document.getElementById('cvFileName').textContent = meta.fileName;
        var previewBody = document.getElementById('cvPreviewBody');
        previewBody.textContent = text;
        previewBody.classList.remove('expanded');
        document.getElementById('cvExpandBtn').textContent = 'Show full CV';
      } else {
        uploadArea.style.display = 'block';
        preview.style.display = 'none';
      }
    }

    // Drag & drop
    var dropZone = document.getElementById('cvDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
      dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
      });
      dropZone.addEventListener('click', function(e) {
        if (e.target.closest('.cv-upload-actions')) return;
        document.getElementById('cvFileInput').click();
      });
    }

    // File input
    var fileInput = document.getElementById('cvFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function() {
        if (this.files.length) processFile(this.files[0]);
        this.value = '';
      });
    }

    // Paste button
    var pasteBtn = document.getElementById('cvPasteBtn');
    var pasteModal = document.getElementById('cvPasteModal');
    var pasteClose = document.getElementById('cvPasteClose');
    var pasteCancel = document.getElementById('cvPasteCancel');
    var pasteSave = document.getElementById('cvPasteSave');
    if (pasteBtn) pasteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      pasteModal.style.display = 'block';
    });
    if (pasteClose) pasteClose.addEventListener('click', function() { pasteModal.style.display = 'none'; });
    if (pasteCancel) pasteCancel.addEventListener('click', function() { pasteModal.style.display = 'none'; });
    if (pasteSave) pasteSave.addEventListener('click', function() {
      var text = document.getElementById('cvPasteArea').value.trim();
      if (!text) { showToast('Please paste your CV content first.', 'warning'); return; }
      saveCVText(text, 'pasted-cv.txt', 'txt');
      pasteModal.style.display = 'none';
      showToast('CV saved from pasted text.', 'success');
    });

    // Preview controls
    var replaceBtn = document.getElementById('cvReplaceBtn');
    if (replaceBtn) replaceBtn.addEventListener('click', function() {
      document.getElementById('cvUploadArea').style.display = 'block';
      document.getElementById('cvPreview').style.display = 'none';
    });
    var removeBtn = document.getElementById('cvRemoveBtn');
    if (removeBtn) removeBtn.addEventListener('click', removeCVData);
    var expandBtn = document.getElementById('cvExpandBtn');
    if (expandBtn) expandBtn.addEventListener('click', function() {
      var body = document.getElementById('cvPreviewBody');
      var isExpanded = body.classList.toggle('expanded');
      this.textContent = isExpanded ? 'Collapse CV' : 'Show full CV';
    });

    // Initialize state on load
    renderCVState();

    // ── Mode Tabs ──
    var modeTabs = document.querySelectorAll('.cv-mode-tab');
    modeTabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        modeTabs.forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        var mode = this.getAttribute('data-mode');
        document.getElementById('cvBuilderPanel').style.display = mode === 'builder' ? '' : 'none';
        document.getElementById('cvUploadPanel').style.display = mode === 'upload' ? '' : 'none';
      });
    });

    // ── CV Builder ──
    var BUILDER_KEY = 'gs_cv_builder';
    var builderSections = [];

    function getBuilderData() {
      try { return JSON.parse(localStorage.getItem(BUILDER_KEY)) || null; } catch(e) { return null; }
    }
    function saveBuilderData() {
      localStorage.setItem(BUILDER_KEY, JSON.stringify({
        sections: builderSections,
        updatedAt: new Date().toISOString()
      }));
    }

    function renderBuilder() {
      var container = document.getElementById('cvBuilderSections');
      if (!builderSections.length) {
        container.innerHTML = '<div class="cv-builder-empty"><p>No CV sections yet. Click <strong>Auto-Populate from Profile</strong> to get started, or add sections manually.</p></div>';
        updateMasterStatus();
        return;
      }
      container.innerHTML = builderSections.map(function(s, i) {
        var bulletsHtml = '';
        if (s.bullets && s.bullets.length) {
          bulletsHtml = '<div class="cv-builder-bullets">' +
            s.bullets.map(function(b, bi) {
              return '<div class="cv-builder-bullet-row">' +
                '<input type="text" value="' + escAttr(b) + '" data-sec="' + i + '" data-bullet="' + bi + '" class="cv-bullet-input">' +
                '<button class="cv-builder-bullet-del" data-sec="' + i + '" data-bullet="' + bi + '">&times;</button>' +
              '</div>';
            }).join('') +
            '<button class="cv-add-bullet-btn" data-sec="' + i + '">+ Add bullet</button>' +
          '</div>';
        } else {
          bulletsHtml = '<button class="cv-add-bullet-btn" data-sec="' + i + '" style="margin-top:var(--space-2)">+ Add bullet points</button>';
        }
        return '<div class="cv-builder-card" data-idx="' + i + '">' +
          '<div class="cv-builder-card-header">' +
            '<div class="cv-builder-card-title"><input type="text" value="' + escAttr(s.title) + '" data-sec="' + i + '" class="cv-title-input"></div>' +
            '<div class="cv-builder-card-actions">' +
              (i > 0 ? '<button title="Move up" data-move="up" data-sec="' + i + '">&#x25B2;</button>' : '') +
              (i < builderSections.length - 1 ? '<button title="Move down" data-move="down" data-sec="' + i + '">&#x25BC;</button>' : '') +
              '<button class="cv-del-btn" title="Delete section" data-delete="' + i + '">&#x1F5D1;</button>' +
            '</div>' +
          '</div>' +
          '<div class="cv-builder-card-body">' +
            '<textarea class="cv-builder-textarea" data-sec="' + i + '" placeholder="Enter content for this section...">' + escAttr(s.content || '') + '</textarea>' +
            bulletsHtml +
          '</div>' +
        '</div>';
      }).join('');
      bindBuilderEvents();
      updateMasterStatus();
      if (typeof updateWordMeter === 'function') updateWordMeter();
    }

    function escAttr(s) { return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function bindBuilderEvents() {
      // Title inputs
      document.querySelectorAll('.cv-title-input').forEach(function(inp) {
        inp.addEventListener('input', function() {
          builderSections[parseInt(this.dataset.sec)].title = this.value;
          debounceAutoSave();
          debounceRunSuggestions();
        });
      });
      // Content textareas
      document.querySelectorAll('.cv-builder-textarea').forEach(function(ta) {
        ta.addEventListener('input', function() {
          builderSections[parseInt(this.dataset.sec)].content = this.value;
          debounceAutoSave();
          debounceRunSuggestions();
        });
      });
      // Bullet inputs
      document.querySelectorAll('.cv-bullet-input').forEach(function(inp) {
        inp.addEventListener('input', function() {
          var sec = parseInt(this.dataset.sec);
          var bi = parseInt(this.dataset.bullet);
          builderSections[sec].bullets[bi] = this.value;
          debounceAutoSave();
          debounceRunSuggestions();
        });
        inp.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var sec = parseInt(this.dataset.sec);
            var bi = parseInt(this.dataset.bullet);
            builderSections[sec].bullets.splice(bi + 1, 0, '');
            renderBuilder();
            // Focus new bullet
            var newInput = document.querySelector('.cv-bullet-input[data-sec="' + sec + '"][data-bullet="' + (bi + 1) + '"]');
            if (newInput) newInput.focus();
          }
        });
      });
      // Delete bullet
      document.querySelectorAll('.cv-builder-bullet-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var sec = parseInt(this.dataset.sec);
          var bi = parseInt(this.dataset.bullet);
          builderSections[sec].bullets.splice(bi, 1);
          renderBuilder();
          saveBuilderData();
        });
      });
      // Add bullet
      document.querySelectorAll('.cv-add-bullet-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var sec = parseInt(this.dataset.sec);
          if (!builderSections[sec].bullets) builderSections[sec].bullets = [];
          builderSections[sec].bullets.push('');
          renderBuilder();
          var inputs = document.querySelectorAll('.cv-bullet-input[data-sec="' + sec + '"]');
          if (inputs.length) inputs[inputs.length - 1].focus();
        });
      });
      // Move up/down
      document.querySelectorAll('[data-move]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(this.dataset.sec);
          var dir = this.dataset.move;
          var swapIdx = dir === 'up' ? idx - 1 : idx + 1;
          var tmp = builderSections[idx];
          builderSections[idx] = builderSections[swapIdx];
          builderSections[swapIdx] = tmp;
          renderBuilder();
          saveBuilderData();
        });
      });
      // Delete section
      document.querySelectorAll('[data-delete]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var idx = parseInt(this.dataset.delete);
          if (confirm('Remove "' + builderSections[idx].title + '" section?')) {
            builderSections.splice(idx, 1);
            renderBuilder();
            saveBuilderData();
          }
        });
      });
    }

    var autoSaveTimer = null;
    function debounceAutoSave() {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(function() { saveBuilderData(); if (typeof updateWordMeter === 'function') updateWordMeter(); }, 800);
    }

    var suggestTimer = null;
    function debounceRunSuggestions() {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(runSuggestions, 1200);
    }

    // ── Auto-Populate from Profile ──
    document.getElementById('cvAutoPopulate').addEventListener('click', function() {
      var c = candidate;
      if (!c || !c.name) { showToast('No profile data found.', 'warning'); return; }

      builderSections = [];

      // Header
      builderSections.push({
        title: 'CONTACT',
        content: c.name + '\n' + (c.title || '') + ' | ' + (c.company || '') + '\n' + (c.location || '') + '\n' + (c.email || '') + (c.linkedin ? ' | LinkedIn: ' + c.linkedin : ''),
        bullets: []
      });

      // Executive Summary
      var expertiseStr = (c.expertise || []).slice(0, 6).join(', ');
      builderSections.push({
        title: 'EXECUTIVE SUMMARY',
        content: 'Senior finance executive with ' + (c.experience_years || '25+') + ' years of progressive experience in global investment management, development finance, and emerging markets. Deep expertise in ' + expertiseStr + '. Multilingual professional (English, Spanish, Hebrew) with proven track record of managing multi-billion dollar investment portfolios across Latin America, Africa, and Asia.',
        bullets: []
      });

      // Experience
      if (c.career_timeline && c.career_timeline.length) {
        var expBullets = c.career_timeline.map(function(ct) {
          return ct.role + ' — ' + ct.company + ' (' + ct.period + ')';
        });
        builderSections.push({
          title: 'PROFESSIONAL EXPERIENCE',
          content: '',
          bullets: expBullets
        });
      }

      // Core Competencies
      if (c.expertise && c.expertise.length) {
        builderSections.push({
          title: 'CORE COMPETENCIES',
          content: '',
          bullets: c.expertise.slice()
        });
      }

      // Education
      if (c.education && c.education.length) {
        var eduBullets = c.education.map(function(e) {
          return e.degree + ' — ' + e.school + ' (' + e.years + ')';
        });
        builderSections.push({
          title: 'EDUCATION',
          content: '',
          bullets: eduBullets
        });
      }

      // Languages
      if (c.languages && c.languages.length) {
        builderSections.push({
          title: 'LANGUAGES',
          content: c.languages.join(', '),
          bullets: []
        });
      }

      saveBuilderData();
      renderBuilder();
      showToast('CV auto-populated from profile data. Edit each section to add detail.', 'success');
      runSuggestions();
    });

    // Add Section
    document.getElementById('cvAddSection').addEventListener('click', function() {
      var title = prompt('Section name (e.g., CERTIFICATIONS, BOARD MEMBERSHIPS):');
      if (!title) return;
      builderSections.push({ title: title.toUpperCase(), content: '', bullets: [] });
      saveBuilderData();
      renderBuilder();
    });

    // Save Master CV
    document.getElementById('cvSaveBuilder').addEventListener('click', function() {
      if (!builderSections.length) { showToast('Add some content first.', 'warning'); return; }
      // Build master text from builder
      var masterText = builderSections.map(function(s) {
        var text = s.title + '\n';
        if (s.content) text += s.content + '\n';
        if (s.bullets && s.bullets.length) {
          s.bullets.forEach(function(b) { if (b.trim()) text += '\u2022 ' + b + '\n'; });
        }
        return text;
      }).join('\n');
      saveCVText(masterText, 'master-cv-builder.txt', 'builder');
      saveBuilderData();
      showToast('Master CV saved. You can now tailor it for any job.', 'success');
    });

    // Load to Builder from uploaded CV
    var loadToBuilderBtn = document.getElementById('cvLoadToBuilder');
    if (loadToBuilderBtn) loadToBuilderBtn.addEventListener('click', function() {
      var text = getCVText();
      if (!text) return;
      builderSections = parseCV(text);
      saveBuilderData();
      // Switch to builder tab
      modeTabs.forEach(function(t) { t.classList.remove('active'); });
      document.querySelector('[data-mode="builder"]').classList.add('active');
      document.getElementById('cvBuilderPanel').style.display = '';
      document.getElementById('cvUploadPanel').style.display = 'none';
      renderBuilder();
      showToast('CV loaded into builder. Edit each section as needed.', 'success');
      runSuggestions();
    });

    // ── Page Length Selector ──
    var CV_PAGES_KEY = 'gs_cv_pages';
    var cvTargetPages = parseInt(localStorage.getItem(CV_PAGES_KEY)) || 2;

    var PAGE_CONFIGS = {
      1: { minWords: 250, maxWords: 450, label: 'Target: 1-page CV (~250\u2013450 words). Best for focused applications or career changers.', color: 'compact' },
      2: { minWords: 500, maxWords: 800, label: 'Target: 2-page CV (~500\u2013800 words). Best for senior executives with 10\u201325 years of experience.', color: 'standard' },
      3: { minWords: 800, maxWords: 1200, label: 'Target: 3-page CV (~800\u20131200 words). Best for C-suite with 25+ years, board roles, and publications.', color: 'extended' }
    };

    function initPageSelector() {
      document.querySelectorAll('.cv-page-btn').forEach(function(btn) {
        if (parseInt(btn.dataset.pages) === cvTargetPages) btn.classList.add('active');
        else btn.classList.remove('active');
        btn.addEventListener('click', function() {
          document.querySelectorAll('.cv-page-btn').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          cvTargetPages = parseInt(this.dataset.pages);
          localStorage.setItem(CV_PAGES_KEY, cvTargetPages);
          updateWordMeter();
          debounceRunSuggestions();
        });
      });
    }
    initPageSelector();

    function updateWordMeter() {
      var allText = builderSections.map(function(s) {
        return (s.content || '') + ' ' + (s.bullets || []).join(' ');
      }).join(' ');
      var wordCount = allText.split(/\s+/).filter(function(w) { return w.length > 0; }).length;
      var config = PAGE_CONFIGS[cvTargetPages];

      // Update guide text
      document.getElementById('cvPageGuideText').textContent = config.label;

      // Update word count
      document.getElementById('cvWordCount').textContent = wordCount + ' words';

      // Update meter bar
      var bar = document.getElementById('cvWordBar');
      var pct = Math.min(100, Math.round((wordCount / config.maxWords) * 100));
      bar.style.width = pct + '%';
      bar.className = 'cv-word-bar';
      if (wordCount < config.minWords * 0.6) bar.classList.add('under');
      else if (wordCount >= config.minWords && wordCount <= config.maxWords) bar.classList.add('good');
      else if (wordCount > config.maxWords) bar.classList.add('over');
      else bar.classList.add('under'); // approaching but not yet in range
    }

    // Load saved builder data on startup
    var savedBuilder = getBuilderData();
    if (savedBuilder && savedBuilder.sections && savedBuilder.sections.length) {
      builderSections = savedBuilder.sections;
      renderBuilder();
    } else {
      renderBuilder();
    }
    updateWordMeter();

    // ── Real-Time Suggestion Engine ──
    function runSuggestions() {
      var panel = document.getElementById('cvSuggestionPanel');
      var list = document.getElementById('cvSuggestionList');
      if (!builderSections.length) { panel.style.display = 'none'; return; }

      var suggestions = [];
      var allText = builderSections.map(function(s) { return s.content + ' ' + (s.bullets || []).join(' '); }).join(' ').toLowerCase();

      // 1. Keyword gap analysis against top industries
      var topIndustryKW = ['private equity', 'infrastructure', 'emerging markets', 'fund-of-funds', 'development finance', 'climate', 'esg', 'impact investing', 'capital mobilization', 'blended finance', 'critical minerals', 'sovereign wealth', 'pension', 'institutional investors', 'due diligence', 'portfolio management', 'deal sourcing', 'fundraising'];
      var missing = topIndustryKW.filter(function(kw) { return allText.indexOf(kw) === -1; });
      if (missing.length > 0) {
        suggestions.push({
          icon: '\uD83D\uDD0D',
          text: '<strong>Keyword gaps:</strong> Your CV doesn\'t mention: <strong>' + missing.slice(0, 5).join('</strong>, <strong>') + '</strong>. These are high-demand terms in your target industries.'
        });
      }

      // 2. Action verb check
      var weakVerbs = ['responsible for', 'helped', 'assisted', 'worked on', 'involved in', 'participated'];
      var foundWeak = weakVerbs.filter(function(v) { return allText.indexOf(v) >= 0; });
      if (foundWeak.length) {
        var replacements = { 'responsible for': 'Led / Directed / Managed', 'helped': 'Spearheaded / Facilitated', 'assisted': 'Collaborated / Co-led', 'worked on': 'Executed / Delivered', 'involved in': 'Drove / Orchestrated', 'participated': 'Contributed / Championed' };
        suggestions.push({
          icon: '\u270D\uFE0F',
          text: '<strong>Weak action verbs found:</strong> "' + foundWeak.join('", "') + '". Replace with: ' + foundWeak.map(function(v) { return '<strong>' + (replacements[v] || 'stronger verb') + '</strong>'; }).join(', ')
        });
      }

      // 3. Quantification check
      var hasNumbers = /\$[\d]|\d+[%+]|\d{2,}/.test(allText);
      if (!hasNumbers) {
        suggestions.push({
          icon: '\uD83D\uDCCA',
          text: '<strong>Add metrics:</strong> Include quantifiable achievements (e.g., "Managed $2.4B portfolio", "Deployed capital across 15+ funds", "Generated 22% IRR"). Numbers make a CV stand out.'
        });
      }

      // 4. Missing sections
      var sectionTitles = builderSections.map(function(s) { return s.title.toLowerCase(); });
      if (sectionTitles.indexOf('executive summary') === -1 && sectionTitles.indexOf('summary') === -1 && sectionTitles.indexOf('profile') === -1) {
        suggestions.push({ icon: '\u2139\uFE0F', text: '<strong>Missing Executive Summary:</strong> Add a summary section — it\'s the first thing recruiters read.' });
      }
      if (sectionTitles.indexOf('core competencies') === -1 && sectionTitles.indexOf('skills') === -1) {
        suggestions.push({ icon: '\u2139\uFE0F', text: '<strong>Missing Skills/Competencies:</strong> Add a competencies section to match ATS keyword scanning.' });
      }

      // 5. Length check (based on target page count)
      var wordCount = allText.split(/\s+/).filter(Boolean).length;
      var pgCfg = PAGE_CONFIGS[cvTargetPages] || PAGE_CONFIGS[2];
      if (wordCount < pgCfg.minWords * 0.6) {
        suggestions.push({ icon: '\uD83D\uDCDD', text: '<strong>Content is thin (' + wordCount + ' words):</strong> For a ' + cvTargetPages + '-page CV, aim for ' + pgCfg.minWords + '\u2013' + pgCfg.maxWords + ' words. Add more detail to your experience bullets.' });
      } else if (wordCount > pgCfg.maxWords * 1.15) {
        suggestions.push({ icon: '\u2702\uFE0F', text: '<strong>Content is long (' + wordCount + ' words):</strong> For a ' + cvTargetPages + '-page CV, aim for ' + pgCfg.minWords + '\u2013' + pgCfg.maxWords + ' words. Trim or switch to a ' + Math.min(3, cvTargetPages + 1) + '-page format.' });
      }

      if (suggestions.length === 0) {
        suggestions.push({ icon: '\u2705', text: '<strong>Looking great!</strong> Your CV covers key sections, includes relevant keywords, and has good detail. Save it as your Master CV.' });
      }

      list.innerHTML = suggestions.map(function(s) {
        return '<div class="cv-suggestion-item"><span class="tip-icon">' + s.icon + '</span><span>' + s.text + '</span></div>';
      }).join('');
      panel.style.display = 'block';
    }

    var suggCloseBtn = document.getElementById('cvSuggestionClose');
    if (suggCloseBtn) suggCloseBtn.addEventListener('click', function() {
      document.getElementById('cvSuggestionPanel').style.display = 'none';
    });

    // ── Master CV Status & Downloads ──
    function updateMasterStatus() {
      var statusEl = document.getElementById('cvMasterStatus');
      var meta = getCVMeta();
      if (meta && getCVText()) {
        statusEl.style.display = 'flex';
        var date = new Date(meta.uploadedAt);
        document.getElementById('cvMasterDate').textContent = ' — Last saved: ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      } else {
        statusEl.style.display = 'none';
      }
    }
    updateMasterStatus();

    // Master CV PDF download
    document.getElementById('cvDownloadMasterPdf').addEventListener('click', function() {
      var text = getCVText();
      if (!text) return;
      var sections = builderSections.length ? builderSections : parseCV(text);
      window._lastTailored = { sections: sections, jobTitle: 'Master CV', company: candidate.name || 'Goldie Shturman' };
      downloadPDF(window._lastTailored, 'Goldie_Shturman_Master_CV');
    });
    // Master CV DOCX download
    document.getElementById('cvDownloadMasterDocx').addEventListener('click', function() {
      var text = getCVText();
      if (!text) return;
      var sections = builderSections.length ? builderSections : parseCV(text);
      window._lastTailored = { sections: sections, jobTitle: 'Master CV', company: candidate.name || 'Goldie Shturman' };
      downloadDOCX(window._lastTailored, 'Goldie_Shturman_Master_CV');
    });

    // ── CV Tailoring Engine ──
    // Exposes window._tailorCV(jobIndex) for the job detail modal
    window._tailorCV = function(jobIdx) {
      var j = jobs[jobIdx];
      if (!j) return;
      var cvText = getCVText();
      if (!cvText) {
        showToast('Please upload your CV first (Profile & Timeline tab).', 'warning');
        return;
      }

      var modal = document.getElementById('tailorCvModal');
      var loading = document.getElementById('tailorCvLoading');
      var content = document.getElementById('tailorCvContent');
      var actions = document.getElementById('tailorCvActions');
      document.getElementById('tailorCvTitle').textContent = 'Tailored CV — ' + j.title;
      loading.style.display = 'flex';
      content.style.display = 'none';
      actions.style.display = 'none';
      modal.classList.add('show');

      // Run tailoring in a timeout to allow the modal to render first
      setTimeout(function() {
        var tailored = generateTailoredCV(cvText, j);
        content.innerHTML = tailored.html;
        content.style.display = 'block';
        actions.style.display = 'flex';
        loading.style.display = 'none';

        // Store data for download
        window._lastTailored = tailored;
      }, 400);
    };

    function extractKeywords(text) {
      var words = text.toLowerCase().replace(/[^a-z0-9\s\-\/]/g, ' ').split(/\s+/);
      var stopwords = 'the a an and or but in on at to for of is are was were be been being have has had do does did will would shall should may might can could this that these those it its with from by as not no'.split(' ');
      var freq = {};
      words.forEach(function(w) {
        if (w.length < 3 || stopwords.indexOf(w) >= 0) return;
        freq[w] = (freq[w] || 0) + 1;
      });
      return Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
    }

    function generateTailoredCV(cvText, job) {
      // Extract keywords from job description
      var jobDesc = [job.title, job.company, job.requirements || '', job.goldie_fit || '', job.industry || '', job.notes || ''].join(' ');
      var jobKeywords = extractKeywords(jobDesc).slice(0, 40);

      // Parse CV into sections
      var sections = parseCV(cvText);

      // Rewrite sections with full optimization
      var tailoredSections = optimizeSections(sections, job, jobKeywords);

      // Build HTML preview
      var html = '<div class="tailor-cv-output">';
      tailoredSections.forEach(function(s) {
        html += '<div class="tailor-cv-section">';
        html += '<h4>' + esc(s.title) + '</h4>';
        if (s.bullets && s.bullets.length) {
          html += '<ul>';
          s.bullets.forEach(function(b) {
            html += '<li>' + highlightMatches(esc(b), jobKeywords) + '</li>';
          });
          html += '</ul>';
        } else {
          html += '<p>' + highlightMatches(esc(s.content), jobKeywords) + '</p>';
        }
        html += '</div>';
      });
      html += '</div>';

      return { html: html, sections: tailoredSections, jobTitle: job.title, company: job.company };
    }

    function parseCV(text) {
      // Try to identify sections by common headers
      var headerPatterns = [
        /^(SUMMARY|PROFESSIONAL SUMMARY|EXECUTIVE SUMMARY|PROFILE|OBJECTIVE|ABOUT)[:\s]*$/im,
        /^(EXPERIENCE|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|CAREER HISTORY)[:\s]*$/im,
        /^(EDUCATION|ACADEMIC|QUALIFICATIONS|ACADEMIC QUALIFICATIONS)[:\s]*$/im,
        /^(SKILLS|CORE COMPETENCIES|KEY SKILLS|TECHNICAL SKILLS|COMPETENCIES)[:\s]*$/im,
        /^(CERTIFICATIONS?|LICENSES?|ACCREDITATIONS?|PROFESSIONAL DEVELOPMENT)[:\s]*$/im,
        /^(LANGUAGES?)[:\s]*$/im,
        /^(PUBLICATIONS?|PRESENTATIONS?|SPEAKING)[:\s]*$/im,
        /^(AWARDS?|HONORS?|ACHIEVEMENTS?|RECOGNITION)[:\s]*$/im,
        /^(BOARD|BOARDS?|VOLUNTEER|COMMUNITY|AFFILIATIONS?|MEMBERSHIPS?)[:\s]*$/im
      ];

      var lines = text.split(/\n/);
      var sections = [];
      var currentSection = { title: 'Header', lines: [] };

      lines.forEach(function(line) {
        var trimmed = line.trim();
        if (!trimmed) { currentSection.lines.push(''); return; }
        var isHeader = false;
        headerPatterns.forEach(function(pat) {
          if (pat.test(trimmed)) {
            isHeader = true;
            if (currentSection.lines.length > 0 || currentSection.title !== 'Header') {
              sections.push(currentSection);
            }
            currentSection = { title: trimmed.replace(/[:\s]+$/, ''), lines: [] };
          }
        });
        // Also detect headers by ALL CAPS short lines
        if (!isHeader && trimmed.length < 50 && trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed)) {
          if (currentSection.lines.length > 0) {
            sections.push(currentSection);
          }
          currentSection = { title: trimmed.replace(/[:\s]+$/, ''), lines: [] };
        } else if (!isHeader) {
          currentSection.lines.push(trimmed);
        }
      });
      if (currentSection.lines.length > 0) sections.push(currentSection);

      // Convert to structured format
      return sections.map(function(s) {
        var content = s.lines.filter(function(l) { return l.length > 0; });
        var bullets = content.filter(function(l) { return /^[•\-\*\u2022\u25CF\u25CB\u2023]/.test(l) || /^\d+[\.\)]/.test(l); });
        var prose = content.filter(function(l) { return bullets.indexOf(l) === -1; });
        return {
          title: s.title,
          content: prose.join(' '),
          bullets: bullets.map(function(b) { return b.replace(/^[•\-\*\u2022\u25CF\u25CB\u2023\d+\.\)]\s*/, ''); })
        };
      });
    }

    function optimizeSections(sections, job, jobKeywords) {
      var result = [];
      var hasHeader = false;
      var hasSummary = false;

      sections.forEach(function(s) {
        var titleLower = s.title.toLowerCase();

        // Skip empty sections
        if (!s.content && (!s.bullets || !s.bullets.length)) return;

        // Detect section type and optimize
        if (titleLower === 'header' || (!hasSummary && !hasHeader && sections.indexOf(s) === 0)) {
          hasHeader = true;
          result.push({ title: s.title, content: s.content, bullets: s.bullets });
        }
        else if (/summary|profile|objective|about/i.test(titleLower)) {
          hasSummary = true;
          // Rewrite summary to target the job
          var newSummary = rewriteSummary(s.content, job, jobKeywords);
          result.push({ title: 'EXECUTIVE SUMMARY', content: newSummary, bullets: [] });
        }
        else if (/experience|employment|career|work/i.test(titleLower)) {
          // Reorder bullets by relevance to job
          var scoredBullets = (s.bullets || []).map(function(b) {
            var score = 0;
            jobKeywords.forEach(function(kw) {
              if (b.toLowerCase().indexOf(kw) >= 0) score += 2;
            });
            return { text: b, score: score };
          }).sort(function(a, b) { return b.score - a.score; });
          result.push({
            title: s.title,
            content: s.content,
            bullets: scoredBullets.map(function(b) { return b.text; })
          });
        }
        else if (/skills|competenc|technical/i.test(titleLower)) {
          // Prioritize skills that match job keywords
          var allSkills = (s.bullets.length ? s.bullets : s.content.split(/[,;]/).map(function(x) { return x.trim(); })).filter(Boolean);
          var scored = allSkills.map(function(sk) {
            var score = 0;
            jobKeywords.forEach(function(kw) {
              if (sk.toLowerCase().indexOf(kw) >= 0) score += 3;
            });
            return { text: sk, score: score };
          }).sort(function(a, b) { return b.score - a.score; });
          result.push({
            title: 'CORE COMPETENCIES',
            content: '',
            bullets: scored.map(function(s) { return s.text; })
          });
        }
        else {
          // Keep other sections as-is
          result.push(s);
        }
      });

      // If no summary was found, inject one at the top (after header)
      if (!hasSummary) {
        var insertIdx = hasHeader ? 1 : 0;
        var allContent = sections.map(function(s) { return s.content + ' ' + (s.bullets || []).join(' '); }).join(' ');
        result.splice(insertIdx, 0, {
          title: 'EXECUTIVE SUMMARY',
          content: rewriteSummary(allContent, job, jobKeywords),
          bullets: []
        });
      }

      return result;
    }

    function rewriteSummary(originalSummary, job, jobKeywords) {
      // Build a job-targeted summary
      var industry = (job.industry || '').toLowerCase();
      var company = job.company || '';
      var title = job.title || '';

      // Skip placeholder/empty industries
      if (!industry || industry === 'tbd' || industry === 'n/a' || industry === 'other') {
        industry = '';
      }

      // Start with relevant parts of original summary
      var sentences = originalSummary.split(/(?<=[.!?])\s+/).filter(function(s) { return s.length > 10; });

      // Score sentences by keyword match
      var scored = sentences.map(function(sent) {
        var score = 0;
        jobKeywords.forEach(function(kw) {
          if (sent.toLowerCase().indexOf(kw) >= 0) score += 2;
        });
        return { text: sent, score: score };
      }).sort(function(a, b) { return b.score - a.score; });

      // Take top 3-4 relevant sentences
      var topSentences = scored.slice(0, 4).map(function(s) { return s.text; });

      if (topSentences.length === 0) return originalSummary;

      // Build a clean opening line
      var opening = '';
      if (industry && title) {
        opening = 'Senior executive with deep expertise in ' + industry + ', targeting the ' + title + ' role. ';
      } else if (industry) {
        opening = 'Senior executive with deep expertise in ' + industry + '. ';
      } else if (title) {
        opening = 'Senior executive targeting the ' + title + ' role. ';
      }

      return opening + topSentences.join(' ');
    }

    function highlightMatches(text, keywords) {
      var top5 = keywords.slice(0, 8);
      top5.forEach(function(kw) {
        var re = new RegExp('\\b(' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi');
        text = text.replace(re, '<strong style="color:var(--color-primary)">$1</strong>');
      });
      return text;
    }

    // ── Reusable Download Functions ──
    function downloadPDF(data, filePrefix) {
      try {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ unit: 'pt', format: 'a4' });
        var margin = 50;
        var y = margin;
        var pageWidth = doc.internal.pageSize.getWidth();
        var maxWidth = pageWidth - margin * 2;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(data.jobTitle || 'CV', margin, y);
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(data.company || '', margin, y);
        y += 25;
        doc.setTextColor(0);

        data.sections.forEach(function(s) {
          if (y > 750) { doc.addPage(); y = margin; }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(14, 92, 97);
          doc.text(s.title.toUpperCase(), margin, y);
          y += 4;
          doc.setDrawColor(14, 92, 97);
          doc.setLineWidth(0.5);
          doc.line(margin, y, margin + maxWidth, y);
          y += 14;
          doc.setTextColor(0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          if (s.content) {
            var cleanContent = stripTags(s.content);
            var lines = doc.splitTextToSize(cleanContent, maxWidth);
            lines.forEach(function(line) {
              if (y > 780) { doc.addPage(); y = margin; }
              doc.text(line, margin, y);
              y += 14;
            });
            y += 4;
          }
          if (s.bullets && s.bullets.length) {
            s.bullets.forEach(function(b) {
              var cleanB = stripTags(b);
              if (!cleanB.trim()) return;
              if (y > 780) { doc.addPage(); y = margin; }
              doc.text('\u2022', margin, y);
              var bLines = doc.splitTextToSize(cleanB, maxWidth - 15);
              bLines.forEach(function(bl) {
                if (y > 780) { doc.addPage(); y = margin; }
                doc.text(bl, margin + 15, y);
                y += 13;
              });
            });
            y += 4;
          }
          y += 8;
        });
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Generated by GS Executive Search | ' + new Date().toLocaleDateString(), margin, doc.internal.pageSize.getHeight() - 20);
        doc.save((filePrefix || 'Goldie_Shturman_CV') + '.pdf');
        showToast('PDF downloaded.', 'success');
      } catch(e) {
        console.error('PDF generation error:', e);
        showToast('PDF generation failed.', 'warning');
      }
    }

    function downloadDOCX(data, filePrefix) {
      try {
        var D = window.docx;
        var children = [];
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: data.jobTitle || 'CV', bold: true, size: 28, color: '0E5C61' })],
          spacing: { after: 100 }
        }));
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: data.company || '', italics: true, size: 20, color: '666666' })],
          spacing: { after: 300 }
        }));
        data.sections.forEach(function(s) {
          children.push(new D.Paragraph({
            children: [new D.TextRun({ text: s.title.toUpperCase(), bold: true, size: 22, color: '0E5C61' })],
            spacing: { before: 200, after: 80 },
            border: { bottom: { color: '0E5C61', space: 4, size: 6, style: D.BorderStyle.SINGLE } }
          }));
          if (s.content) {
            children.push(new D.Paragraph({
              children: [new D.TextRun({ text: stripTags(s.content), size: 20 })],
              spacing: { after: 100 }
            }));
          }
          if (s.bullets && s.bullets.length) {
            s.bullets.forEach(function(b) {
              var cleanB = stripTags(b);
              if (!cleanB.trim()) return;
              children.push(new D.Paragraph({
                children: [new D.TextRun({ text: cleanB, size: 20 })],
                bullet: { level: 0 },
                spacing: { after: 40 }
              }));
            });
          }
        });

        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: 'Generated by GS Executive Search | ' + new Date().toLocaleDateString(), size: 16, color: '999999' })],
          spacing: { before: 400 }
        }));
        var docxDoc = new D.Document({ sections: [{ properties: {}, children: children }] });
        D.Packer.toBlob(docxDoc).then(function(blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = (filePrefix || 'Goldie_Shturman_CV') + '.docx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('DOCX downloaded.', 'success');
        });
      } catch(e) {
        console.error('DOCX generation error:', e);
        showToast('DOCX generation failed.', 'warning');
      }
    }

    // Tailored CV modal download buttons
    document.getElementById('tailorDownloadPdf').addEventListener('click', function() {
      var data = window._lastTailored;
      if (!data) return;
      downloadPDF(data, 'Goldie_Shturman_CV_' + (data.company || '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30));
    });
    document.getElementById('tailorDownloadDocx').addEventListener('click', function() {
      var data = window._lastTailored;
      if (!data) return;
      downloadDOCX(data, 'Goldie_Shturman_CV_' + (data.company || '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30));
    });
    document.getElementById('tailorCopyBtn').addEventListener('click', function() {
      var data = window._lastTailored;
      if (!data) return;
      var plainText = data.sections.map(function(s) {
        var text = s.title.toUpperCase() + '\n';
        if (s.content) text += stripTags(s.content) + '\n';
        if (s.bullets && s.bullets.length) {
          s.bullets.forEach(function(b) { text += '  \u2022 ' + stripTags(b) + '\n'; });
        }
        return text;
      }).join('\n');
      navigator.clipboard.writeText(plainText).then(function() {
        showToast('Tailored CV copied to clipboard.', 'success');
      });
    });

    // Close tailor modal
    document.getElementById('tailorCvClose').addEventListener('click', function() {
      document.getElementById('tailorCvModal').classList.remove('show');
    });
    document.getElementById('tailorCvModal').addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('show');
    });

    // ── Tailor Modal Tabs (CV / Cover Letter) ──
    document.querySelectorAll('.tailor-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tailor-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        var mode = this.dataset.tailorTab;
        document.getElementById('tailorCvPanel').style.display = mode === 'cv' ? '' : 'none';
        document.getElementById('tailorCoverPanel').style.display = mode === 'cover' ? '' : 'none';
        // Auto-generate cover letter on first switch
        if (mode === 'cover' && !window._lastCoverLetter && window._lastTailorJob) {
          generateCoverLetter(window._lastTailorJob);
        }
      });
    });

    // ── Cover Letter Generation Engine ──
    function generateCoverLetter(job) {
      var loading = document.getElementById('tailorCoverLoading');
      var content = document.getElementById('tailorCoverContent');
      var actions = document.getElementById('tailorCoverActions');
      loading.style.display = 'flex';
      content.style.display = 'none';
      actions.style.display = 'none';

      setTimeout(function() {
        var c = candidate;
        var today = new Date();
        var dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Extract key info
        var companyName = (job.company || '').replace(/\s*\(.*?\)\s*/g, '').trim();
        var jobTitle = job.title || '';
        var industry = (job.industry || '').toLowerCase();
        var requirements = job.requirements || '';
        var goldieFit = job.goldie_fit || '';
        var location = job.location || '';

        // Extract 3-5 key requirements as talking points
        var reqKeywords = extractKeywords(requirements + ' ' + jobTitle).slice(0, 6);

        // Build paragraphs
        var openingLine = 'I am writing to express my strong interest in the ' + jobTitle + ' position at ' + companyName + '.';

        // Paragraph 1: Hook + current role
        var para1 = openingLine + ' As ' + (c.title || 'a senior finance executive') + ' at ' + (c.company || 'a leading development finance institution') + ', I bring ' + (c.experience_years || '25+') + ' years of progressive experience in global investment management, development finance, and emerging markets that directly aligns with this opportunity.';

        // Paragraph 2: Relevant experience mapped to job requirements
        var relevantExp = [];
        if (/fund|portfolio|invest/i.test(requirements)) {
          relevantExp.push('managing multi-billion dollar fund-of-funds portfolios across private equity, infrastructure, and venture capital');
        }
        if (/emerging|developing|latin|africa|asia/i.test(requirements + ' ' + industry)) {
          relevantExp.push('deploying capital across emerging markets in Latin America, Africa, and Asia through both direct investments and fund structures');
        }
        if (/climate|esg|impact|sustain/i.test(requirements + ' ' + industry)) {
          relevantExp.push('integrating ESG frameworks and climate finance considerations into investment decision-making');
        }
        if (/mineral|mining|critical/i.test(requirements + ' ' + industry)) {
          relevantExp.push('deep expertise in critical minerals financing and mining sector investment');
        }
        if (/dfi|development|multilateral|ifc|idb|world bank/i.test(requirements + ' ' + industry)) {
          relevantExp.push('extensive experience working with DFIs and multilateral institutions including IDB Invest and the U.S. DFC');
        }
        if (/fundrais|capital raise|lp|investor relation/i.test(requirements)) {
          relevantExp.push('raising institutional capital and managing LP relationships with sovereign wealth funds, pension funds, and endowments');
        }
        if (/due diligence|deal sourc|origination/i.test(requirements)) {
          relevantExp.push('leading end-to-end deal origination, due diligence, and portfolio management processes');
        }
        if (relevantExp.length === 0) {
          relevantExp.push('managing complex investment portfolios and leading cross-functional teams in global financial institutions');
        }

        var para2 = 'Throughout my career, I have developed deep expertise in ' + relevantExp.slice(0, 3).join('; ') + '. At DFC, I currently oversee the Office of Investment Funds, managing strategic investment decisions across multiple geographies and asset classes.';

        // Paragraph 3: Why this company/role specifically (using goldie_fit)
        var para3 = '';
        if (goldieFit) {
          // Extract the most compelling sentence from goldie_fit
          var fitSentences = goldieFit.split(/(?<=[.!?])\s+/).filter(function(s) { return s.length > 30; });
          var bestFit = fitSentences.length > 0 ? fitSentences[0] : '';
          if (bestFit) {
            // Rewrite from first-person perspective
            para3 = 'I am particularly drawn to ' + companyName + ' because of its strategic positioning in the ' + industry + ' space. ' + 'My background uniquely positions me to contribute immediately \u2014 my experience at IDB Invest across Latin America, combined with my current leadership at DFC, has given me a comprehensive understanding of both the institutional investor landscape and the operational demands of the role.';
          }
        }
        if (!para3) {
          para3 = 'I am particularly drawn to this role at ' + companyName + ' because it represents a natural convergence of my expertise in ' + (c.expertise || []).slice(0, 3).join(', ') + '. I am confident that my track record and network would enable me to make an immediate and meaningful impact.';
        }

        // Paragraph 4: Education + languages + closing
        var eduLine = '';
        if (c.education && c.education.length) {
          eduLine = 'My ' + c.education[0].degree + ' from ' + c.education[0].school + ' provides a strong analytical foundation, ';
        }
        var langLine = '';
        if (c.languages && c.languages.length > 1) {
          langLine = 'and my fluency in ' + c.languages.join(', ') + ' enables me to operate effectively across diverse markets. ';
        }
        var para4 = eduLine + langLine + 'I would welcome the opportunity to discuss how my experience and vision can contribute to ' + companyName + '\u2019s continued growth and success.';

        // Build HTML
        var html = '<div class="cl-date">' + dateStr + '</div>';
        html += '<div class="cl-address">';
        html += 'Hiring Committee<br>' + esc(companyName);
        if (location) html += '<br>' + esc(location);
        html += '</div>';
        html += '<div class="cl-greeting">Dear Hiring Committee,</div>';
        html += '<div class="cl-body">';
        html += '<p>' + esc(para1) + '</p>';
        html += '<p>' + esc(para2) + '</p>';
        html += '<p>' + esc(para3) + '</p>';
        html += '<p>' + esc(para4) + '</p>';
        html += '</div>';
        html += '<div class="cl-closing">Sincerely,</div>';
        html += '<div class="cl-signature">' + esc(c.name || 'Goldie Shturman') + '<br>';
        html += '<span style="font-weight:400;color:var(--color-text-muted);font-size:var(--text-xs);">' + esc(c.email || '') + '</span></div>';

        content.innerHTML = html;
        content.style.display = 'block';
        actions.style.display = 'flex';
        loading.style.display = 'none';

        // Store for download
        window._lastCoverLetter = {
          date: dateStr,
          company: companyName,
          jobTitle: jobTitle,
          location: location,
          paragraphs: [para1, para2, para3, para4],
          candidateName: c.name || 'Goldie Shturman',
          candidateEmail: c.email || ''
        };
      }, 500);
    }

    // Store the job reference when tailoring
    var _origTailorCV = window._tailorCV;
    window._tailorCV = function(jobIdx) {
      window._lastTailorJob = jobs[jobIdx];
      window._lastCoverLetter = null; // Reset so it regenerates
      // Reset tabs to CV
      document.querySelectorAll('.tailor-tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelector('[data-tailor-tab="cv"]').classList.add('active');
      document.getElementById('tailorCvPanel').style.display = '';
      document.getElementById('tailorCoverPanel').style.display = 'none';
      _origTailorCV(jobIdx);
    };

    // ── Cover Letter Downloads ──
    document.getElementById('coverDownloadPdf').addEventListener('click', function() {
      var cl = window._lastCoverLetter;
      if (!cl) return;
      downloadCoverLetterPDF(cl);
    });

    document.getElementById('coverDownloadDocx').addEventListener('click', function() {
      var cl = window._lastCoverLetter;
      if (!cl) return;
      downloadCoverLetterDOCX(cl);
    });

    document.getElementById('coverCopyBtn').addEventListener('click', function() {
      var cl = window._lastCoverLetter;
      if (!cl) return;
      var text = cl.date + '\n\nHiring Committee\n' + cl.company + (cl.location ? '\n' + cl.location : '') + '\n\nDear Hiring Committee,\n\n';
      text += cl.paragraphs.join('\n\n');
      text += '\n\nSincerely,\n' + cl.candidateName;
      navigator.clipboard.writeText(text).then(function() {
        showToast('Cover letter copied to clipboard.', 'success');
      });
    });

    // Download Both (CV + Cover Letter as separate files)
    document.getElementById('downloadBothBtn').addEventListener('click', function() {
      var cvData = window._lastTailored;
      var cl = window._lastCoverLetter;
      if (!cvData) { showToast('No tailored CV available.', 'warning'); return; }
      if (!cl) {
        if (window._lastTailorJob) generateCoverLetter(window._lastTailorJob);
        showToast('Generating cover letter first...', 'info');
        return;
      }
      var prefix = 'Goldie_Shturman_' + cl.company.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
      downloadPDF(cvData, prefix + '_CV');
      setTimeout(function() { downloadCoverLetterPDF(cl); }, 500);
      showToast('Downloading CV and Cover Letter.', 'success');
    });

    function downloadCoverLetterPDF(cl) {
      try {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ unit: 'pt', format: 'a4' });
        var margin = 60;
        var y = margin;
        var pageWidth = doc.internal.pageSize.getWidth();
        var maxWidth = pageWidth - margin * 2;

        // Date
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(cl.date, margin, y);
        y += 30;

        // Address
        doc.setTextColor(0);
        doc.text('Hiring Committee', margin, y); y += 14;
        doc.text(cl.company, margin, y); y += 14;
        if (cl.location) { doc.text(cl.location, margin, y); y += 14; }
        y += 16;

        // Greeting
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Dear Hiring Committee,', margin, y);
        y += 22;

        // Body paragraphs
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        cl.paragraphs.forEach(function(p) {
          var lines = doc.splitTextToSize(p, maxWidth);
          lines.forEach(function(line) {
            if (y > 760) { doc.addPage(); y = margin; }
            doc.text(line, margin, y);
            y += 14;
          });
          y += 8;
        });

        // Closing
        y += 10;
        doc.text('Sincerely,', margin, y);
        y += 22;
        doc.setFont('helvetica', 'bold');
        doc.text(cl.candidateName, margin, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100);
        if (cl.candidateEmail) doc.text(cl.candidateEmail, margin, y);

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Generated by GS Executive Search | ' + new Date().toLocaleDateString(), margin, doc.internal.pageSize.getHeight() - 20);

        var prefix = 'Goldie_Shturman_Cover_Letter_' + cl.company.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
        doc.save(prefix + '.pdf');
        showToast('Cover letter PDF downloaded.', 'success');
      } catch(e) {
        console.error('Cover letter PDF error:', e);
        showToast('PDF generation failed.', 'warning');
      }
    }

    function downloadCoverLetterDOCX(cl) {
      try {
        var D = window.docx;
        var children = [];

        // Date
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: cl.date, size: 20, color: '666666' })],
          spacing: { after: 200 }
        }));

        // Address
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: 'Hiring Committee', size: 20 })],
          spacing: { after: 40 }
        }));
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: cl.company, size: 20 })],
          spacing: { after: cl.location ? 40 : 200 }
        }));
        if (cl.location) {
          children.push(new D.Paragraph({
            children: [new D.TextRun({ text: cl.location, size: 20 })],
            spacing: { after: 200 }
          }));
        }

        // Greeting
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: 'Dear Hiring Committee,', bold: true, size: 20 })],
          spacing: { after: 150 }
        }));

        // Body
        cl.paragraphs.forEach(function(p) {
          children.push(new D.Paragraph({
            children: [new D.TextRun({ text: p, size: 20 })],
            spacing: { after: 120 }
          }));
        });

        // Closing
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: 'Sincerely,', size: 20 })],
          spacing: { before: 200, after: 100 }
        }));
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: cl.candidateName, bold: true, size: 20 })],
          spacing: { after: 40 }
        }));
        if (cl.candidateEmail) {
          children.push(new D.Paragraph({
            children: [new D.TextRun({ text: cl.candidateEmail, size: 18, color: '666666' })]
          }));
        }

        // Footer
        children.push(new D.Paragraph({
          children: [new D.TextRun({ text: 'Generated by GS Executive Search | ' + new Date().toLocaleDateString(), size: 16, color: '999999' })],
          spacing: { before: 400 }
        }));

        var docxDoc = new D.Document({ sections: [{ properties: {}, children: children }] });
        D.Packer.toBlob(docxDoc).then(function(blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'Goldie_Shturman_Cover_Letter_' + cl.company.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25) + '.docx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('Cover letter DOCX downloaded.', 'success');
        });
      } catch(e) {
        console.error('Cover letter DOCX error:', e);
        showToast('DOCX generation failed.', 'warning');
      }
    }

  } catch(cvErr) {
      console.error('CV Builder init error (non-fatal):', cvErr);
    }
  })();

  // ── Network / Contact Book ──
  (function initNetwork() {
    try {
    // Safe element getter for this module — logs warning instead of crashing
    function el(id) {
      var e = document.getElementById(id);
      if (!e) console.warn('Network: missing #' + id);
      return e;
    }
    var CONTACTS_KEY = 'gs_contacts';

    function getContacts() {
      try { return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || []; } catch(e) { return []; }
    }
    function saveContacts(contacts) {
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    }

    var editingIdx = -1; // -1 = new contact

    function renderContacts() {
      var contacts = getContacts();
      var statusFilter = document.getElementById('filterContactStatus').value;
      var tagFilter = document.getElementById('filterContactTag').value;
      var sourceFilter = document.getElementById('filterContactSource').value;
      var search = (document.getElementById('filterContactSearch').value || '').toLowerCase();

      var filtered = contacts.filter(function(c) {
        if (statusFilter && c.status !== statusFilter) return false;
        if (tagFilter && c.tag !== tagFilter) return false;
        if (sourceFilter === 'linkedin' && c.source !== 'linkedin') return false;
        if (sourceFilter === 'conference' && c.source !== 'conference') return false;
        if (sourceFilter === 'manual' && (c.source === 'linkedin' || c.source === 'conference' || c.source === 'import')) return false;
        if (sourceFilter === 'matched' && !c.linkedCompany) return false;
        if (search) {
          var text = [c.name, c.company, c.title, c.email, c.notes, c.context].join(' ').toLowerCase();
          if (text.indexOf(search) === -1) return false;
        }
        return true;
      });

      // Stats
      var stats = { total: contacts.length, new: 0, 'reached-out': 0, 'in-conversation': 0, active: 0 };
      contacts.forEach(function(c) { if (stats[c.status] !== undefined) stats[c.status]++; });
      document.getElementById('networkStats').innerHTML =
        '<span>Total: <span class="network-stat">' + stats.total + '</span></span>' +
        '<span>New: <span class="network-stat">' + stats['new'] + '</span></span>' +
        '<span>Reached Out: <span class="network-stat">' + stats['reached-out'] + '</span></span>' +
        '<span>In Conversation: <span class="network-stat">' + stats['in-conversation'] + '</span></span>' +
        '<span>Active: <span class="network-stat">' + stats.active + '</span></span>';

      if (filtered.length === 0) {
        document.getElementById('contactsList').innerHTML = '<div class="network-empty"><p>No contacts yet.</p><p>Click <strong>Add Contact</strong> or <strong>Scan Business Card</strong> to start building your network.</p></div>';
        return;
      }

      var statusLabels = { 'new': 'New', 'reached-out': 'Reached Out', 'in-conversation': 'In Conversation', 'active': 'Active' };
      var tagLabels = { recruiter: 'Recruiter', 'hiring-manager': 'Hiring Manager', 'fund-manager': 'Fund Manager', 'board-member': 'Board', conference: 'Conference', dfi: 'DFI', investor: 'Investor/LP', other: 'Other' };

      document.getElementById('contactsList').innerHTML = filtered.map(function(c, i) {
        var realIdx = contacts.indexOf(c);
        return '<div class="contact-card" data-status="' + esc(c.status || 'new') + '" data-contact-idx="' + realIdx + '">' +
          '<div class="contact-header">' +
            '<div>' +
              '<div class="contact-name">' + esc(c.name) + '</div>' +
              '<div class="contact-title-co">' + esc(c.title || '') + (c.company ? ' \u2014 ' + esc(c.company) : '') + '</div>' +
            '</div>' +
            '<div class="contact-actions">' +
              '<button class="contact-action-btn" data-edit="' + realIdx + '" title="Edit">\u270E</button>' +
              '<button class="contact-action-btn btn-del" data-del="' + realIdx + '" title="Delete">\u2715</button>' +
            '</div>' +
          '</div>' +
          '<div class="contact-meta">' +
            (c.email ? '<span>\u2709 ' + esc(c.email) + '</span>' : '') +
            (c.phone ? '<span>\u260E ' + esc(c.phone) + '</span>' : '') +
            (c.location ? '<span>\uD83D\uDCCD ' + esc(c.location) + '</span>' : '') +
            (c.context ? '<span>\uD83E\uDD1D ' + esc(c.context) + '</span>' : '') +
          '</div>' +
          '<div class="contact-tags">' +
            '<span class="contact-tag tag-status">' + (statusLabels[c.status] || 'New') + '</span>' +
            '<span class="contact-tag">' + (tagLabels[c.tag] || c.tag || '') + '</span>' +
            (c.source === 'linkedin' ? '<span class="contact-tag" style="background:#E8F4F8;color:#0077B5">in LinkedIn</span>' : '') +
            (c.linkedCompany ? '<span class="contact-tag tag-linked">\uD83C\uDFE2 ' + esc(c.linkedCompany) + '</span>' : '') +
            (c.linkedJob ? '<span class="contact-tag tag-linked">\uD83D\uDCBC Job linked</span>' : '') +
          '</div>' +
          (c.notes ? '<div class="contact-notes-preview">' + esc(c.notes) + '</div>' : '') +
        '</div>';
      }).join('');

      // Bind edit/delete
      document.querySelectorAll('[data-edit]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          openContactModal(parseInt(this.dataset.edit));
        });
      });
      document.querySelectorAll('[data-del]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var idx = parseInt(this.dataset.del);
          var contacts = getContacts();
          if (confirm('Delete contact "' + contacts[idx].name + '"?')) {
            contacts.splice(idx, 1);
            saveContacts(contacts);
            renderContacts();
            showToast('Contact deleted.', 'info');
          }
        });
      });
    }

    // Populate company/job dropdowns
    function populateContactDropdowns() {
      var compSelect = document.getElementById('contactLinkCompany');
      var jobSelect = document.getElementById('contactLinkJob');
      compSelect.innerHTML = '<option value="">None</option>';
      jobSelect.innerHTML = '<option value="">None</option>';
      companies.forEach(function(c) {
        var o = document.createElement('option');
        o.value = c.name;
        o.textContent = c.name;
        compSelect.appendChild(o);
      });
      jobs.forEach(function(j) {
        var o = document.createElement('option');
        o.value = j.title + ' | ' + j.company;
        o.textContent = j.title.substring(0, 40) + ' \u2014 ' + j.company.substring(0, 25);
        jobSelect.appendChild(o);
      });
    }

    function openContactModal(idx) {
      editingIdx = (idx !== undefined && idx >= 0) ? idx : -1;
      document.getElementById('contactModalTitle').textContent = editingIdx >= 0 ? 'Edit Contact' : 'Add Contact';
      populateContactDropdowns();

      // Clear or fill form
      var fields = ['contactName','contactTitle','contactCompany','contactEmail','contactPhone','contactLinkedin','contactLocation','contactContext','contactNotes'];
      if (editingIdx >= 0) {
        var c = getContacts()[editingIdx];
        document.getElementById('contactName').value = c.name || '';
        document.getElementById('contactTitle').value = c.title || '';
        document.getElementById('contactCompany').value = c.company || '';
        document.getElementById('contactEmail').value = c.email || '';
        document.getElementById('contactPhone').value = c.phone || '';
        document.getElementById('contactLinkedin').value = c.linkedin || '';
        document.getElementById('contactLocation').value = c.location || '';
        document.getElementById('contactContext').value = c.context || '';
        document.getElementById('contactNotes').value = c.notes || '';
        document.getElementById('contactIndustry').value = c.industry || '';
        document.getElementById('contactTag').value = c.tag || 'conference';
        document.getElementById('contactStatus').value = c.status || 'new';
        document.getElementById('contactLinkCompany').value = c.linkedCompany || '';
        document.getElementById('contactLinkJob').value = c.linkedJob || '';
      } else {
        fields.forEach(function(id) { document.getElementById(id).value = ''; });
        document.getElementById('contactIndustry').value = '';
        document.getElementById('contactTag').value = 'conference';
        document.getElementById('contactStatus').value = 'new';
        document.getElementById('contactLinkCompany').value = '';
        document.getElementById('contactLinkJob').value = '';
      }
      // Reset card upload
      document.getElementById('cardPreview').style.display = 'none';
      document.getElementById('ocrStatus').style.display = 'none';
      document.getElementById('contactModal').classList.add('show');
    }

    function saveContact() {
      var name = document.getElementById('contactName').value.trim();
      if (!name) { showToast('Name is required.', 'warning'); return; }

      var contact = {
        name: name,
        title: document.getElementById('contactTitle').value.trim(),
        company: document.getElementById('contactCompany').value.trim(),
        email: document.getElementById('contactEmail').value.trim(),
        phone: document.getElementById('contactPhone').value.trim(),
        linkedin: document.getElementById('contactLinkedin').value.trim(),
        location: document.getElementById('contactLocation').value.trim(),
        industry: document.getElementById('contactIndustry').value,
        tag: document.getElementById('contactTag').value,
        status: document.getElementById('contactStatus').value,
        context: document.getElementById('contactContext').value.trim(),
        notes: document.getElementById('contactNotes').value.trim(),
        linkedCompany: document.getElementById('contactLinkCompany').value,
        linkedJob: document.getElementById('contactLinkJob').value,
        addedDate: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString()
      };

      var contacts = getContacts();
      if (editingIdx >= 0) {
        contact.addedDate = contacts[editingIdx].addedDate || contact.addedDate;
        contacts[editingIdx] = contact;
        showToast('Contact updated.', 'success');
      } else {
        contacts.push(contact);
        showToast('Contact added.', 'success');
      }
      saveContacts(contacts);
      document.getElementById('contactModal').classList.remove('show');
      renderContacts();
    }

    // Business Card OCR
    function processCardImage(file) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var preview = document.getElementById('cardPreview');
        preview.innerHTML = '<img src="' + e.target.result + '" class="card-preview-img">';
        preview.style.display = 'block';

        var ocrStatus = document.getElementById('ocrStatus');
        ocrStatus.textContent = 'Reading business card...';
        ocrStatus.style.display = 'block';

        // Use Tesseract.js for OCR
        if (typeof Tesseract !== 'undefined') {
          Tesseract.recognize(e.target.result, 'eng+heb+spa+por', { logger: function() {} })
            .then(function(result) {
              var text = result.data.text;
              parseBusinessCard(text);
              ocrStatus.textContent = '\u2705 Card read successfully. Review and edit the fields below.';
            })
            .catch(function() {
              ocrStatus.textContent = 'Could not read the card. Please fill in manually.';
            });
        } else {
          // Tesseract not loaded — try loading it
          ocrStatus.textContent = 'Loading OCR engine...';
          var script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
          script.onload = function() {
            Tesseract.recognize(e.target.result, 'eng+heb+spa+por', { logger: function() {} })
              .then(function(result) {
                parseBusinessCard(result.data.text);
                ocrStatus.textContent = '\u2705 Card read successfully. Review and edit the fields below.';
              })
              .catch(function() {
                ocrStatus.textContent = 'Could not read the card. Please fill in manually.';
              });
          };
          script.onerror = function() {
            ocrStatus.textContent = 'OCR engine failed to load. Please fill in manually.';
          };
          document.head.appendChild(script);
        }
      };
      reader.readAsDataURL(file);
    }

    function parseBusinessCard(text) {
      var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 1; });

      // Try to extract email
      var emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) document.getElementById('contactEmail').value = emailMatch[0];

      // Phone
      var phoneMatch = text.match(/[+]?[\d\s\-().]{7,}/);
      if (phoneMatch) document.getElementById('contactPhone').value = phoneMatch[0].trim();

      // LinkedIn
      var linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9\-]+/i);
      if (linkedinMatch) document.getElementById('contactLinkedin').value = 'https://' + linkedinMatch[0];

      // Name is usually the first or second line (largest text)
      if (lines.length > 0 && !lines[0].match(/@|http|www|\d{5,}/)) {
        document.getElementById('contactName').value = lines[0];
      }
      // Title is often the second line
      if (lines.length > 1 && !lines[1].match(/@|http|www|\d{5,}/)) {
        var titleLine = lines[1];
        // Check if it looks like a title
        if (/director|manager|partner|vp|president|head|chief|officer|analyst|associate|counsel/i.test(titleLine)) {
          document.getElementById('contactTitle').value = titleLine;
        } else {
          document.getElementById('contactCompany').value = titleLine;
        }
      }
      // Company might be on line 3
      if (lines.length > 2 && !document.getElementById('contactCompany').value) {
        var compLine = lines.find(function(l) { return !l.match(/@|http|www|\+|\d{5,}/) && l.length > 3 && l !== document.getElementById('contactName').value && l !== document.getElementById('contactTitle').value; });
        if (compLine) document.getElementById('contactCompany').value = compLine;
      }
    }

    // ── LinkedIn CSV Smart Merge Import ──
    var LI_META_KEY = 'gs_linkedin_import_meta';

    function getLiMeta() {
      try { return JSON.parse(localStorage.getItem(LI_META_KEY)) || {}; } catch(e) { return {}; }
    }
    function saveLiMeta(meta) { localStorage.setItem(LI_META_KEY, JSON.stringify(meta)); }

    function renderLinkedinInfo() {
      var meta = getLiMeta();
      var el = document.getElementById('linkedinImportInfo');
      if (!meta.lastImport) { el.style.display = 'none'; return; }
      var d = new Date(meta.lastImport);
      var dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      el.style.display = 'flex';
      el.innerHTML = '<span class="li-icon">in</span> ' +
        'Last LinkedIn sync: <span class="li-date">' + dateStr + '</span> &middot; ' +
        '<span class="li-count">' + (meta.totalImported || 0) + '</span> contacts imported &middot; ' +
        '<span class="li-count">' + (meta.matchedCompanies || 0) + '</span> matched to database';
    }

    function parseCSVRow(row) {
      var fields = [];
      var inQuote = false;
      var field = '';
      for (var ch = 0; ch < row.length; ch++) {
        var c = row[ch];
        if (c === '"') { inQuote = !inQuote; }
        else if (c === ',' && !inQuote) { fields.push(field.trim()); field = ''; }
        else { field += c; }
      }
      fields.push(field.trim());
      return fields;
    }

    function matchCompanyInDB(companyName) {
      if (!companyName) return null;
      var cl = companyName.toLowerCase();
      for (var i = 0; i < companies.length; i++) {
        var cn = companies[i].name.toLowerCase();
        if (cl === cn || cl.includes(cn) || cn.includes(cl)) return companies[i].name;
      }
      return null;
    }

    function companyHasOpenJob(companyName) {
      if (!companyName) return false;
      var cl = companyName.toLowerCase();
      for (var i = 0; i < jobs.length; i++) {
        if (jobs[i].company.toLowerCase() === cl) return true;
      }
      return false;
    }

    function showImportSummary(stats) {
      var html = '<div class="import-summary">' +
        '<div class="import-summary-stat"><span class="label">Total in CSV</span><span class="value">' + stats.totalInCSV + '</span></div>' +
        '<div class="import-summary-stat"><span class="label">New contacts added</span><span class="value highlight">' + stats.added + '</span></div>' +
        '<div class="import-summary-stat"><span class="label">Existing updated (title/company)</span><span class="value">' + stats.updated + '</span></div>' +
        '<div class="import-summary-stat"><span class="label">Unchanged (skipped)</span><span class="value">' + stats.skipped + '</span></div>' +
        '<div class="import-summary-stat"><span class="label">Matched to GS companies</span><span class="value gold">' + stats.matched + '</span></div>' +
        '<div class="import-summary-stat"><span class="label">With open jobs</span><span class="value gold">' + stats.withJobs + '</span></div>' +
      '</div>';
      if (stats.updatedNames.length > 0) {
        html += '<div class="import-updated-list"><strong style="font-size:11px;color:var(--color-text)">Updated contacts:</strong>';
        stats.updatedNames.forEach(function(u) {
          html += '<div class="import-updated-item"><span class="upd-name">' + esc(u.name) + '</span> &mdash; ' + esc(u.change) + '</div>';
        });
        html += '</div>';
      }
      html += '<div class="import-summary-note">Your edits (notes, tags, status, phone, context) are always preserved. Only title and company are updated from LinkedIn if they changed. Re-import anytime to add new connections.</div>';
      document.getElementById('importSummaryBody').innerHTML = html;
      document.getElementById('importSummaryModal').classList.add('show');
    }

    safeOn('importLinkedinBtn', 'click', function() {
      var fi = el('linkedinFileInput'); if(fi) fi.click();
    });

    safeOn('linkedinFileInput', 'change', function() {
      if (!this.files.length) return;
      var file = this.files[0];
      this.value = '';
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = e.target.result;
        var lines = text.split('\n');
        if (lines.length < 2) { showToast('Empty or invalid CSV file.', 'warning'); return; }

        // Parse header
        var header = lines[0].split(',').map(function(h) { return h.trim().replace(/"/g, '').toLowerCase(); });
        var fnIdx = header.indexOf('first name');
        var lnIdx = header.indexOf('last name');
        var emailIdx = header.indexOf('email address');
        var compIdx = header.indexOf('company');
        var posIdx = header.indexOf('position');
        var urlIdx = header.indexOf('url');
        var connIdx = header.indexOf('connected on');

        if (fnIdx === -1 && lnIdx === -1) {
          fnIdx = header.findIndex(function(h) { return h.includes('first'); });
          lnIdx = header.findIndex(function(h) { return h.includes('last'); });
        }

        var contacts = getContacts();
        // Build lookup by name (lowercase) and by LinkedIn URL for matching
        var byName = {};
        var byLinkedin = {};
        contacts.forEach(function(c, idx) {
          byName[c.name.toLowerCase()] = idx;
          if (c.linkedin) byLinkedin[c.linkedin.toLowerCase().replace(/\/$/, '')] = idx;
        });

        var stats = { totalInCSV: 0, added: 0, updated: 0, skipped: 0, matched: 0, withJobs: 0, updatedNames: [] };

        for (var i = 1; i < lines.length; i++) {
          var row = lines[i];
          if (!row.trim()) continue;

          var fields = parseCSVRow(row);
          var firstName = (fnIdx >= 0 ? fields[fnIdx] : '').replace(/"/g, '').trim();
          var lastName = (lnIdx >= 0 ? fields[lnIdx] : '').replace(/"/g, '').trim();
          var fullName = (firstName + ' ' + lastName).trim();
          if (!fullName || fullName.length < 2) continue;

          stats.totalInCSV++;

          var company = (compIdx >= 0 ? fields[compIdx] : '').replace(/"/g, '').trim();
          var position = (posIdx >= 0 ? fields[posIdx] : '').replace(/"/g, '').trim();
          var email = (emailIdx >= 0 ? fields[emailIdx] : '').replace(/"/g, '').trim();
          var linkedinUrl = (urlIdx >= 0 ? fields[urlIdx] : '').replace(/"/g, '').trim();

          var dbMatch = matchCompanyInDB(company);
          var hasJob = companyHasOpenJob(company);
          if (dbMatch || hasJob) stats.matched++;
          if (hasJob) stats.withJobs++;

          // Smart merge: find existing contact by LinkedIn URL or name
          var existIdx = -1;
          if (linkedinUrl) {
            var liKey = linkedinUrl.toLowerCase().replace(/\/$/, '');
            if (byLinkedin[liKey] !== undefined) existIdx = byLinkedin[liKey];
          }
          if (existIdx === -1 && byName[fullName.toLowerCase()] !== undefined) {
            existIdx = byName[fullName.toLowerCase()];
          }

          if (existIdx >= 0) {
            // Existing contact — smart merge: update title/company if changed, preserve everything else
            var existing = contacts[existIdx];
            var changes = [];
            if (position && position !== existing.title) {
              changes.push('title: ' + (existing.title || '(empty)') + ' \u2192 ' + position);
              existing.title = position;
            }
            if (company && company !== existing.company) {
              changes.push('company: ' + (existing.company || '(empty)') + ' \u2192 ' + company);
              existing.company = company;
            }
            // Fill in empty fields (never overwrite user edits)
            if (!existing.email && email) existing.email = email;
            if (!existing.linkedin && linkedinUrl) existing.linkedin = linkedinUrl;
            // Re-check company matching in case company changed
            if (dbMatch && !existing.linkedCompany) existing.linkedCompany = dbMatch;
            if (dbMatch || hasJob) {
              var jobNote = hasJob ? '\u2B50 Company has open jobs' : '';
              var dbNote = dbMatch ? '\u2B50 Company in GS Search database' : '';
              if (existing.notes && existing.notes.indexOf('\u2B50') === -1) {
                existing.notes = (dbNote + ' ' + jobNote + ' | ' + existing.notes).trim();
              }
            }
            if (changes.length > 0) {
              existing.lastUpdated = new Date().toISOString();
              stats.updated++;
              stats.updatedNames.push({ name: fullName, change: changes.join(', ') });
            } else {
              stats.skipped++;
            }
          } else {
            // New contact
            var newContact = {
              name: fullName,
              title: position,
              company: company,
              email: email,
              phone: '',
              linkedin: linkedinUrl,
              location: '',
              industry: '',
              tag: hasJob ? 'hiring-manager' : (dbMatch ? 'fund-manager' : 'other'),
              status: 'new',
              context: 'Imported from LinkedIn',
              notes: (dbMatch ? '\u2B50 Company in GS Search database ' : '') + (hasJob ? '\u2B50 Company has open jobs' : ''),
              linkedCompany: dbMatch || '',
              linkedJob: '',
              addedDate: new Date().toISOString().split('T')[0],
              lastUpdated: new Date().toISOString(),
              source: 'linkedin'
            };
            contacts.push(newContact);
            byName[fullName.toLowerCase()] = contacts.length - 1;
            if (linkedinUrl) byLinkedin[linkedinUrl.toLowerCase().replace(/\/$/, '')] = contacts.length - 1;
            stats.added++;
          }
        }

        saveContacts(contacts);
        // Save import metadata
        var liContacts = contacts.filter(function(c) { return c.source === 'linkedin'; }).length;
        saveLiMeta({ lastImport: new Date().toISOString(), totalImported: liContacts, matchedCompanies: stats.matched });
        renderContacts();
        renderLinkedinInfo();
        showImportSummary(stats);
      };
      reader.readAsText(file);
    });

    // Export contacts as CSV
    safeOn('exportContactsBtn', 'click', function() {
      var contacts = getContacts();
      if (!contacts.length) { showToast('No contacts to export.', 'warning'); return; }
      var headers = ['Name','Title','Company','Email','Phone','LinkedIn','Location','Industry','Tag','Status','Context','Notes','Linked Company','Added Date','Source'];
      var rows = contacts.map(function(c) {
        return [c.name, c.title, c.company, c.email, c.phone, c.linkedin, c.location, c.industry, c.tag, c.status, c.context, c.notes, c.linkedCompany, c.addedDate, c.source || 'manual'].map(function(v) {
          return '"' + (v || '').replace(/"/g, '""') + '"';
        }).join(',');
      });
      var csv = headers.join(',') + '\n' + rows.join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'gs_contacts_' + new Date().toISOString().split('T')[0] + '.csv';
      a.click(); URL.revokeObjectURL(url);
      showToast('Exported ' + contacts.length + ' contacts.', 'success');
    });

    // Import summary modal close
    safeOn('importSummaryClose', 'click', function() { var m = el('importSummaryModal'); if(m) m.classList.remove('show'); });
    safeOn('importSummaryDone', 'click', function() { var m = el('importSummaryModal'); if(m) m.classList.remove('show'); });
    safeOn('importSummaryModal', 'click', function(e) { if (e.target === this) this.classList.remove('show'); });

    // ── Universal CSV / Conference List Importer ──
    var pendingImportData = null; // { headers: [], rows: [[]], mapping: {} }

    // Smart column detection — maps our fields to common column name variations
    var FIELD_PATTERNS = {
      name:     [/^full\s*name$/i, /^name$/i, /^contact\s*name$/i, /^attendee\s*name$/i, /^participant$/i, /^delegate$/i, /^speaker$/i, /^\u05E9\u05DD\s*\u05DE\u05DC\u05D0$/i, /^\u05E9\u05DD$/i, /^\u05E9\u05DD\s*\u05D4\u05DE\u05E9\u05EA\u05EA\u05E3$/i, /^\u05E0\u05D5\u05DB\u05D7$/i],
      firstName:[/^first\s*name$/i, /^first$/i, /^given\s*name$/i, /^fname$/i, /^prenom$/i, /^nombre$/i, /^\u05E9\u05DD\s*\u05E4\u05E8\u05D8\u05D9$/i, /^\u05E9\u05DD\s*\u05E8\u05D0\u05E9\u05D5\u05DF$/i],
      lastName: [/^last\s*name$/i, /^last$/i, /^sur\s*name$/i, /^family\s*name$/i, /^lname$/i, /^apellido$/i, /^\u05E9\u05DD\s*\u05DE\u05E9\u05E4\u05D7\u05D4$/i],
      title:    [/^title$/i, /^job\s*title$/i, /^position$/i, /^role$/i, /^designation$/i, /^cargo$/i, /^job\s*role$/i, /^function$/i, /^\u05EA\u05E4\u05E7\u05D9\u05D3$/i, /^\u05EA\u05D5\u05D0\u05E8$/i, /^\u05DE\u05E9\u05E8\u05D4$/i],
      company:  [/^company$/i, /^organization$/i, /^organisation$/i, /^org$/i, /^firm$/i, /^employer$/i, /^institution$/i, /^affiliation$/i, /^entity$/i, /^empresa$/i, /^compan/i, /^\u05D7\u05D1\u05E8\u05D4$/i, /^\u05D0\u05E8\u05D2\u05D5\u05DF$/i, /^\u05DE\u05D5\u05E1\u05D3$/i, /^\u05D0\u05E8\u05D2\u05D5\u05DF/i],
      email:    [/^e-?mail$/i, /^email\s*address$/i, /^mail$/i, /^correo$/i, /^e-?mail\s*1$/i, /^primary\s*email$/i, /^work\s*email$/i, /^\u05D3\u05D5\u05D0\u05F4\u05DC$/i, /^\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC$/i, /^\u05DB\u05EA\u05D5\u05D1\u05EA\s*\u05D3\u05D5\u05D0\u05F4\u05DC$/i],
      phone:    [/^phone$/i, /^telephone$/i, /^mobile$/i, /^cell$/i, /^tel$/i, /^phone\s*number$/i, /^contact\s*number$/i, /^celular$/i, /^whatsapp$/i, /^work\s*phone$/i, /^direct$/i, /^\u05D8\u05DC\u05E4\u05D5\u05DF$/i, /^\u05E0\u05D9\u05D9\u05D3$/i, /^\u05E0\u05D9\u05D9\u05D3\u05D9$/i, /^\u05E4\u05DC\u05D0\u05E4\u05D5\u05DF$/i, /^\u05E1\u05DC\u05D5\u05DC\u05E8\u05D9$/i],
      linkedin: [/^linkedin$/i, /^linkedin\s*url$/i, /^linkedin\s*profile$/i, /^url$/i, /^profile\s*url$/i, /^web$/i, /^website$/i, /^\u05DC\u05D9\u05E0\u05E7\u05D3\u05D0\u05D9\u05DF$/i, /^\u05D0\u05EA\u05E8$/i],
      location: [/^location$/i, /^city$/i, /^country$/i, /^region$/i, /^office$/i, /^based\s*in$/i, /^ciudad$/i, /^pais$/i, /^sede$/i, /^\u05DE\u05D9\u05E7\u05D5\u05DD$/i, /^\u05E2\u05D9\u05E8$/i, /^\u05DE\u05D3\u05D9\u05E0\u05D4$/i, /^\u05D0\u05E8\u05E5$/i],
      industry: [/^industry$/i, /^sector$/i, /^area$/i, /^field$/i, /^practice$/i, /^industria$/i, /^\u05EA\u05E2\u05E9\u05D9\u05D9\u05D4$/i, /^\u05E2\u05E0\u05E3$/i, /^\u05DE\u05D2\u05D6\u05E8$/i, /^\u05EA\u05D7\u05D5\u05DD$/i]
    };

    function autoDetectColumns(headers) {
      var mapping = {};
      var usedCols = new Set();
      // First pass: exact-ish matches
      Object.keys(FIELD_PATTERNS).forEach(function(field) {
        if (mapping[field] !== undefined) return;
        for (var hi = 0; hi < headers.length; hi++) {
          if (usedCols.has(hi)) continue;
          var h = headers[hi].trim();
          var patterns = FIELD_PATTERNS[field];
          for (var pi = 0; pi < patterns.length; pi++) {
            if (patterns[pi].test(h)) {
              mapping[field] = hi;
              usedCols.add(hi);
              return;
            }
          }
        }
      });
      return mapping;
    }

    function renderColumnMapping(headers, sampleRows, mapping) {
      var fields = [
        { key: 'name', label: 'Full Name' },
        { key: 'firstName', label: 'First Name' },
        { key: 'lastName', label: 'Last Name' },
        { key: 'title', label: 'Title / Role' },
        { key: 'company', label: 'Company' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'linkedin', label: 'LinkedIn / URL' },
        { key: 'location', label: 'Location' },
        { key: 'industry', label: 'Industry' }
      ];

      var gridHtml = '';
      fields.forEach(function(f) {
        var opts = '<option value="-1">— Skip —</option>';
        for (var i = 0; i < headers.length; i++) {
          var sel = (mapping[f.key] === i) ? ' selected' : '';
          opts += '<option value="' + i + '"' + sel + '>' + esc(headers[i]) + '</option>';
        }
        gridHtml += '<div class="colmap-field">' +
          '<label>' + f.label + '</label>' +
          '<select data-field="' + f.key + '"' + (mapping[f.key] !== undefined ? ' class="mapped"' : '') + '>' + opts + '</select>' +
        '</div>';
      });
      document.getElementById('colmapGrid').innerHTML = gridHtml;

      // Update mapped class on change
      document.querySelectorAll('#colmapGrid select').forEach(function(sel) {
        sel.addEventListener('change', function() {
          this.classList.toggle('mapped', this.value !== '-1');
        });
      });

      // Sample data table
      if (sampleRows.length > 0) {
        var thtml = '<table><thead><tr>';
        headers.forEach(function(h) { thtml += '<th>' + esc(h) + '</th>'; });
        thtml += '</tr></thead><tbody>';
        sampleRows.slice(0, 5).forEach(function(row) {
          thtml += '<tr>';
          for (var i = 0; i < headers.length; i++) {
            thtml += '<td>' + esc(row[i] || '') + '</td>';
          }
          thtml += '</tr>';
        });
        thtml += '</tbody></table>';
        document.getElementById('colmapSample').innerHTML = thtml;
      }
    }

    function getColumnMapping() {
      var mapping = {};
      document.querySelectorAll('#colmapGrid select').forEach(function(sel) {
        var field = sel.dataset.field;
        var val = parseInt(sel.value);
        if (val >= 0) mapping[field] = val;
      });
      return mapping;
    }

    function executeConferenceImport() {
      if (!pendingImportData) return;
      var rows = pendingImportData.rows;
      var mapping = getColumnMapping();
      var eventName = document.getElementById('colmapEventName').value.trim();

      var contacts = getContacts();
      var byName = {};
      var byLinkedin = {};
      contacts.forEach(function(c, idx) {
        byName[c.name.toLowerCase()] = idx;
        if (c.linkedin) byLinkedin[c.linkedin.toLowerCase().replace(/\/$/, '')] = idx;
      });

      var stats = { totalInCSV: 0, added: 0, updated: 0, skipped: 0, matched: 0, withJobs: 0, updatedNames: [] };

      rows.forEach(function(fields) {
        // Build full name
        var fullName = '';
        if (mapping.name !== undefined) {
          fullName = (fields[mapping.name] || '').replace(/"/g, '').trim();
        } else if (mapping.firstName !== undefined || mapping.lastName !== undefined) {
          var fn = mapping.firstName !== undefined ? (fields[mapping.firstName] || '').replace(/"/g, '').trim() : '';
          var ln = mapping.lastName !== undefined ? (fields[mapping.lastName] || '').replace(/"/g, '').trim() : '';
          fullName = (fn + ' ' + ln).trim();
        }
        if (!fullName || fullName.length < 2) return;
        stats.totalInCSV++;

        var company = mapping.company !== undefined ? (fields[mapping.company] || '').replace(/"/g, '').trim() : '';
        var position = mapping.title !== undefined ? (fields[mapping.title] || '').replace(/"/g, '').trim() : '';
        var email = mapping.email !== undefined ? (fields[mapping.email] || '').replace(/"/g, '').trim() : '';
        var phone = mapping.phone !== undefined ? (fields[mapping.phone] || '').replace(/"/g, '').trim() : '';
        var linkedinUrl = mapping.linkedin !== undefined ? (fields[mapping.linkedin] || '').replace(/"/g, '').trim() : '';
        var location = mapping.location !== undefined ? (fields[mapping.location] || '').replace(/"/g, '').trim() : '';
        var industry = mapping.industry !== undefined ? (fields[mapping.industry] || '').replace(/"/g, '').trim() : '';

        var dbMatch = matchCompanyInDB(company);
        var hasJob = companyHasOpenJob(company);
        if (dbMatch || hasJob) stats.matched++;
        if (hasJob) stats.withJobs++;

        // Smart merge
        var existIdx = -1;
        if (linkedinUrl) {
          var liKey = linkedinUrl.toLowerCase().replace(/\/$/, '');
          if (byLinkedin[liKey] !== undefined) existIdx = byLinkedin[liKey];
        }
        if (existIdx === -1 && byName[fullName.toLowerCase()] !== undefined) {
          existIdx = byName[fullName.toLowerCase()];
        }

        if (existIdx >= 0) {
          var existing = contacts[existIdx];
          var changes = [];
          if (position && position !== existing.title) {
            changes.push('title: ' + (existing.title || '(empty)') + ' \u2192 ' + position);
            existing.title = position;
          }
          if (company && company !== existing.company) {
            changes.push('company: ' + (existing.company || '(empty)') + ' \u2192 ' + company);
            existing.company = company;
          }
          if (!existing.email && email) existing.email = email;
          if (!existing.phone && phone) existing.phone = phone;
          if (!existing.linkedin && linkedinUrl) existing.linkedin = linkedinUrl;
          if (!existing.location && location) existing.location = location;
          if (dbMatch && !existing.linkedCompany) existing.linkedCompany = dbMatch;
          // Add event to context if not already there
          if (eventName && (!existing.context || existing.context.indexOf(eventName) === -1)) {
            existing.context = existing.context ? existing.context + ', ' + eventName : eventName;
          }
          if (changes.length > 0) {
            existing.lastUpdated = new Date().toISOString();
            stats.updated++;
            stats.updatedNames.push({ name: fullName, change: changes.join(', ') });
          } else {
            stats.skipped++;
          }
        } else {
          var newContact = {
            name: fullName,
            title: position,
            company: company,
            email: email,
            phone: phone,
            linkedin: linkedinUrl,
            location: location,
            industry: industry,
            tag: hasJob ? 'hiring-manager' : (dbMatch ? 'fund-manager' : 'conference'),
            status: 'new',
            context: eventName || 'Imported from list',
            notes: (dbMatch ? '\u2B50 Company in GS Search database ' : '') + (hasJob ? '\u2B50 Company has open jobs' : ''),
            linkedCompany: dbMatch || '',
            linkedJob: '',
            addedDate: new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString(),
            source: eventName ? 'conference' : 'import'
          };
          contacts.push(newContact);
          byName[fullName.toLowerCase()] = contacts.length - 1;
          if (linkedinUrl) byLinkedin[linkedinUrl.toLowerCase().replace(/\/$/, '')] = contacts.length - 1;
          stats.added++;
        }
      });

      saveContacts(contacts);
      renderContacts();
      document.getElementById('columnMapModal').classList.remove('show');
      showImportSummary(stats);
      pendingImportData = null;
    }

    // File trigger
    safeOn('importConferenceBtn', 'click', function() {
      var fi = el('conferenceFileInput'); if(fi) fi.click();
    });

    safeOn('conferenceFileInput', 'change', function() {
      if (!this.files.length) return;
      var file = this.files[0];
      this.value = '';
      var reader = new FileReader();
      reader.onload = function(e) {
        var text = e.target.result;
        // Detect delimiter: tab or comma
        var firstLine = text.split('\n')[0];
        var delimiter = (firstLine.split('\t').length > firstLine.split(',').length) ? '\t' : ',';

        var lines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
        if (lines.length < 2) { showToast('File is empty or has no data rows.', 'warning'); return; }

        // Parse header and rows
        var headers, allRows;
        if (delimiter === '\t') {
          headers = lines[0].split('\t').map(function(h) { return h.trim().replace(/"/g, ''); });
          allRows = lines.slice(1).map(function(line) {
            return line.split('\t').map(function(f) { return f.trim().replace(/"/g, ''); });
          });
        } else {
          headers = parseCSVRow(lines[0]).map(function(h) { return h.replace(/"/g, ''); });
          allRows = lines.slice(1).map(function(line) {
            return parseCSVRow(line).map(function(f) { return f.replace(/"/g, ''); });
          });
        }

        // Auto-detect columns
        var mapping = autoDetectColumns(headers);

        // Store for later
        pendingImportData = { headers: headers, rows: allRows, mapping: mapping };

        // Show column mapping modal
        document.getElementById('colmapEventName').value = '';
        document.getElementById('colmapRowCount').textContent = allRows.length + ' contacts found in file';
        renderColumnMapping(headers, allRows, mapping);
        document.getElementById('columnMapModal').classList.add('show');
      };
      reader.readAsText(file);
    });

    // Column map modal buttons (all safe-bound)
    safeOn('colmapImport', 'click', executeConferenceImport);
    safeOn('colmapCancel', 'click', function() { var m = el('columnMapModal'); if(m) m.classList.remove('show'); pendingImportData = null; });
    safeOn('columnMapClose', 'click', function() { var m = el('columnMapModal'); if(m) m.classList.remove('show'); pendingImportData = null; });
    safeOn('columnMapModal', 'click', function(e) { if (e.target === this) { this.classList.remove('show'); pendingImportData = null; } });

    // Event listeners (all safe-bound)
    safeOn('addContactBtn', 'click', function() { openContactModal(-1); });
    safeOn('scanCardBtn', 'click', function() { openContactModal(-1); var fi = el('cardFileInput'); if(fi) fi.click(); });
    safeOn('saveContactBtn', 'click', saveContact);
    safeOn('cancelContactBtn', 'click', function() { var m = el('contactModal'); if(m) m.classList.remove('show'); });
    safeOn('contactModalClose', 'click', function() { var m = el('contactModal'); if(m) m.classList.remove('show'); });
    safeOn('contactModal', 'click', function(e) { if (e.target === this) this.classList.remove('show'); });

    // Card upload
    var cardZone = el('cardUploadZone');
    var cardInput = el('cardFileInput');
    if (cardZone && cardInput) {
      cardZone.addEventListener('click', function() { cardInput.click(); });
      cardZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over'); });
      cardZone.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
      cardZone.addEventListener('drop', function(e) { e.preventDefault(); this.classList.remove('drag-over'); if (e.dataTransfer.files.length) processCardImage(e.dataTransfer.files[0]); });
      cardInput.addEventListener('change', function() { if (this.files.length) processCardImage(this.files[0]); this.value = ''; });
    }

    // Filters
    ['filterContactStatus', 'filterContactTag', 'filterContactSource'].forEach(function(id) {
      safeOn(id, 'change', renderContacts);
    });
    safeOn('filterContactSearch', 'input', debounce(renderContacts, 200));

    // Click on contact card to edit
    safeOn('contactsList', 'click', function(e) {
      var card = e.target.closest('.contact-card');
      if (card && !e.target.closest('.contact-action-btn')) {
        openContactModal(parseInt(card.dataset.contactIdx));
      }
    });

    // Init
    renderContacts();
    renderLinkedinInfo();
    } catch(networkErr) {
      console.error('Network/Contact Book init error (non-fatal):', networkErr);
    }
  })();

  try { init(); } catch(initErr) { console.error('App init error:', initErr); }
})();
