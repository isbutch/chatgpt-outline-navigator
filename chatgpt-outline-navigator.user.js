// ==UserScript==
// @name         ChatGPT Outline Navigator
// @namespace    http://tampermonkey.net/
// @version      2.2.4
// @description  为 ChatGPT 添加可折叠侧边目录，支持 Alt+C 快捷键切换显示
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @compatible   chrome
// @compatible   edge
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  function addStyle(css) {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(css);
      return;
    }

    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // ─── 样式 ────────────────────────────────────────────────────────────────────
  addStyle(`
    /* ── 面板 ── */
    #gpt-toc-panel {
      --toc-panel-right: max(18px, env(safe-area-inset-right));
      --toc-panel-width: clamp(210px, 14vw, 252px);
      position: fixed;
      top: 50%;
      right: var(--toc-panel-right);
      bottom: auto;
      width: var(--toc-panel-width);
      max-width: calc(100vw - var(--toc-panel-right) - var(--toc-panel-right));
      height: min(72vh, 680px);
      max-height: calc(100vh - 108px);
      background: #101010;
      color: #f4f4f4;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 16px;
      box-shadow: 0 16px 42px rgba(0,0,0,0.42);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
      font-size: 13px;
      transform: translateY(-50%) translateX(calc(100% + 28px));
      opacity: 0;
      transition: transform 0.16s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.12s ease;
      overflow: hidden;
    }
    #gpt-toc-panel.open {
      transform: translateY(-50%) translateX(0);
      opacity: 1;
    }

    /* ── 面板头部 ── */
    #gpt-toc-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }
    #gpt-toc-panel-title {
      color: #8d8d8d;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    #gpt-toc-close-btn {
      background: none;
      border: none;
      color: #777;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 2px 0 2px 6px;
      transition: color 0.15s;
    }
    #gpt-toc-close-btn:hover { color: #fff; }

    /* ── 滚动区（隐藏滚动条） ── */
    #gpt-toc-scroll {
      flex: 1;
      overflow-y: scroll;
      padding: 8px 10px 66px;
      scrollbar-width: none;          /* Firefox */
      -ms-overflow-style: none;       /* IE/Edge */
    }
    #gpt-toc-scroll::-webkit-scrollbar {
      display: none;                  /* Chrome/Safari */
    }

    /* ── 会话分组 ── */
    .toc-session {
      margin-bottom: 10px;
      padding: 7px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
    }

    /* 会话标题行（用户提问） */
    .toc-session-header {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      padding: 9px 9px 9px 10px;
      cursor: pointer;
      gap: 6px;
      border-radius: 10px;
      border: 1px solid rgba(125, 180, 255, 0.32);
      border-left: 3px solid rgba(125, 180, 255, 0.85);
      background:
        linear-gradient(135deg, rgba(82, 139, 255, 0.22), rgba(76, 127, 220, 0.08)),
        rgba(255,255,255,0.03);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
    }
    .toc-session-header:hover {
      background:
        linear-gradient(135deg, rgba(82, 139, 255, 0.3), rgba(76, 127, 220, 0.12)),
        rgba(255,255,255,0.04);
      border-color: rgba(145, 194, 255, 0.5);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 5px 14px rgba(0,0,0,0.16);
    }
    .toc-session-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .toc-role-tag {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10.5px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      font-weight: 700;
      user-select: none;
      flex-shrink: 0;
    }
    .toc-role-tag.user {
      color: #cfe2ff;
      background: rgba(95, 154, 252, 0.22);
      border: 1px solid rgba(134, 181, 255, 0.35);
    }
    .toc-role-tag.assistant {
      color: #d7f8e4;
      background: rgba(75, 187, 125, 0.2);
      border: 1px solid rgba(127, 227, 172, 0.34);
    }
    .toc-session-count {
      font-size: 11px;
      color: #a2a2a2;
      margin-left: auto;
      margin-right: 4px;
      white-space: nowrap;
    }
    .toc-session-title {
      color: #f4f4f4;
      font-weight: 600;
      font-size: 13px;
      line-height: 1.35;
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .toc-session-prompt {
      color: #f3f8ff;
      font-size: 13.5px;
      line-height: 1.42;
      text-shadow: 0 1px 0 rgba(0,0,0,0.2);
    }
    .toc-chevron {
      color: #d8d8d8;
      font-size: 12px;
      flex-shrink: 0;
      margin-top: 0;
      margin-left: auto;
      transition: transform 0.2s;
      user-select: none;
    }
    .toc-session.collapsed .toc-chevron {
      transform: rotate(-90deg);
    }

    /* 会话内容区 */
    .toc-session-body {
      position: relative;
      overflow: hidden;
      margin-top: 7px;
      padding: 8px 0 4px 8px;
      border-left: 1px solid rgba(127, 227, 172, 0.18);
    }
    .toc-session.collapsed .toc-session-body {
      display: none;
    }
    .toc-reply-label {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 5px -3px;
      padding: 4px 6px 5px 0;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .toc-reply-label .toc-session-count {
      color: #8faaa0;
      font-size: 10.5px;
    }

    /* ── 标题项 ── */
    .toc-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      cursor: pointer;
      padding: 6px 7px 6px 0;
      color: #d3d3d3;
      line-height: 1.45;
      gap: 6px;
      transition: color 0.15s, background 0.15s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      border-radius: 8px;
    }
    .toc-heading:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .toc-heading.active { color: #fff; background: rgba(255,255,255,0.08); font-weight: 700; }

    .toc-heading-text {
      flex: 1;
      word-break: break-all;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .toc-heading .toc-chevron {
      margin-top: 2px;
    }

    /* 缩进层级 */
    .toc-h1 .toc-heading { padding-left: 7px; font-size: 13px; color: #eee; font-weight: 700; }
    .toc-h2 .toc-heading { padding-left: 16px; font-size: 12.5px; color: #ddd; font-weight: 700; }
    .toc-h3 .toc-heading { padding-left: 27px; font-size: 12px; color: #bdbdbd; }
    .toc-h4 .toc-heading { padding-left: 37px; font-size: 11.5px; color: #9c9c9c; }

    /* h2 折叠子项 */
    .toc-h2-group { }
    .toc-h2-group.collapsed .toc-h2-children {
      display: none;
    }
    .toc-h2-group.collapsed .toc-chevron {
      transform: rotate(-90deg);
    }

    /* 会话间分割线 */
    .toc-session-divider {
      height: 1px;
      background: rgba(255,255,255,0.08);
      margin: 8px 4px 10px;
    }

    /* 空状态 */
    .toc-empty {
      padding: 20px 10px;
      color: #777;
      font-size: 12px;
      font-style: italic;
    }

    /* ── 悬浮 FAB 按钮 ── */
    #gpt-toc-fab {
      --toc-fab-right: 20px;
      position: fixed;
      bottom: 24px;
      right: var(--toc-fab-right);
      z-index: 10000;
      background: #fff;
      color: #111;
      border: none;
      border-radius: 999px;
      padding: 9px 16px;
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 16px rgba(0,0,0,0.35);
      transition: background 0.15s, transform 0.1s;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
    }
    #gpt-toc-fab:hover {
      background: #f0f0f0;
      transform: scale(1.03);
    }
    #gpt-toc-fab:active { transform: scale(0.97); }
    #gpt-toc-fab .fab-icon { font-size: 15px; }
    #gpt-toc-fab .fab-label { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; }
    #gpt-toc-fab .fab-shortcut {
      font-size: 11px;
      color: #888;
      font-weight: 500;
      margin-left: 2px;
    }

    /* 面板打开时 FAB 保留，用于快速收起 */
    #gpt-toc-panel.open ~ #gpt-toc-fab,
    body.toc-open #gpt-toc-fab {
      opacity: 1;
      pointer-events: auto;
    }

    @media (max-width: 720px) {
      #gpt-toc-panel {
        top: 50%;
        --toc-panel-right: 18px;
        right: var(--toc-panel-right);
        bottom: auto;
        --toc-panel-width: calc(100vw - 36px);
        width: var(--toc-panel-width);
        height: min(72vh, 620px);
        max-height: calc(100vh - 112px);
        border-radius: 16px;
      }
      #gpt-toc-fab {
        --toc-fab-right: 14px;
        bottom: 16px;
      }
    }
  `);

  // ─── DOM 构建 ─────────────────────────────────────────────────────────────────

  // 面板
  const panel = document.createElement('div');
  panel.id = 'gpt-toc-panel';
  panel.innerHTML = `
    <div id="gpt-toc-panel-header">
      <span id="gpt-toc-panel-title">目录 · TOC</span>
      <button id="gpt-toc-close-btn" title="关闭 (Alt+C)">✕</button>
    </div>
    <div id="gpt-toc-scroll"></div>
  `;
  document.body.appendChild(panel);

  // FAB 按钮
  const fab = document.createElement('button');
  fab.id = 'gpt-toc-fab';
  fab.innerHTML = `<span class="fab-icon">📄</span><span class="fab-label">TOC</span><span class="fab-shortcut">Alt+C</span>`;
  document.body.appendChild(fab);

  const scrollEl = document.getElementById('gpt-toc-scroll');
  const closeBtn = document.getElementById('gpt-toc-close-btn');
  const headingById = new Map();
  const promptTextCache = new WeakMap();
  let activeHeadingBtn = null;
  let layoutRaf = 0;

  // ─── 开关逻辑 ─────────────────────────────────────────────────────────────────
  function openTOC() {
    updateTOCLayout();
    panel.classList.add('open');
    document.body.classList.add('toc-open');
    lastTOCSignature = null;
    startTOCObserver();
    requestAnimationFrame(refresh);
  }
  function closeTOC() {
    panel.classList.remove('open');
    document.body.classList.remove('toc-open');
    stopTOCObserver();
    stopHighlight();
    clearRouteRefreshTimers();
  }
  function toggleTOC() {
    panel.classList.contains('open') ? closeTOC() : openTOC();
  }

  function scheduleLayoutUpdate() {
    if (layoutRaf) return;
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = 0;
      updateTOCLayout();
    });
  }

  function updateTOCLayout() {
    const docEl = document.documentElement;
    const vw = docEl.clientWidth || window.innerWidth;
    const vh = docEl.clientHeight || window.innerHeight;

    if (vw <= 720) {
      panel.style.setProperty('--toc-panel-right', '18px');
      panel.style.setProperty('--toc-panel-width', 'calc(100vw - 36px)');
      fab.style.setProperty('--toc-fab-right', '14px');
      return;
    }

    const viewportMargin = clampNumber(Math.round(vw * 0.024), 24, 56);
    const desiredWidth = clampNumber(Math.round(vw * 0.14), 210, 252);
    const gap = 16;
    const contentRight = getVisibleContentRight(vw, vh);
    const rightRail = vw - contentRight - viewportMargin;

    let panelRight = viewportMargin;
    let panelWidth = desiredWidth;

    if (rightRail >= desiredWidth + gap) {
      const railRight = Math.round(vw - contentRight - desiredWidth - gap);
      panelRight = clampNumber(railRight, viewportMargin, Math.round(vw * 0.18));
    } else if (vw < 1100) {
      panelWidth = Math.min(desiredWidth, vw - viewportMargin * 2);
    }

    panel.style.setProperty('--toc-panel-right', `${panelRight}px`);
    panel.style.setProperty('--toc-panel-width', `${panelWidth}px`);
    fab.style.setProperty('--toc-fab-right', `${viewportMargin}px`);
  }

  function getVisibleContentRight(vw, vh) {
    const main = document.querySelector('main') || document.body;
    const candidates = main.querySelectorAll(
      'article, [data-message-author-role], .markdown, .prose, pre, [class*="max-w-"]'
    );
    let contentRight = 0;

    candidates.forEach(el => {
      if (panel.contains(el) || fab.contains(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 20) return;
      if (rect.bottom < 0 || rect.top > vh) return;
      if (rect.left < 0 || rect.right > vw) return;
      if (rect.width > vw * 0.9) return;
      contentRight = Math.max(contentRight, rect.right);
    });

    return contentRight || Math.round(vw * 0.72);
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  fab.addEventListener('click', toggleTOC);
  closeBtn.addEventListener('click', closeTOC);
  scrollEl.addEventListener('click', handleTOCClick);
  window.addEventListener('resize', scheduleLayoutUpdate);
  window.addEventListener('orientationchange', scheduleLayoutUpdate);
  window.addEventListener('scroll', scheduleLayoutUpdate, { passive: true });

  // Alt+C 快捷键
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      toggleTOC();
    }
  });

  // ─── 数据收集 ─────────────────────────────────────────────────────────────────

  function getConversationTurns() {
    const turns = [];

    const messages = document.querySelectorAll('[data-message-author-role]');
    let currentPrompt = '';

    messages.forEach(message => {
      const role = message.getAttribute('data-message-author-role');

      if (role === 'user') {
        currentPrompt = extractPromptText(message);
        return;
      }

      if (role !== 'assistant') return;

      const container = message.closest('article') || message;
      const mdBody = container.querySelector('.markdown, .prose') || message.querySelector('.markdown, .prose');
      if (!mdBody) return;

      const headingEls = mdBody.querySelectorAll('h1,h2,h3,h4');
      if (headingEls.length === 0) return;

      const headings = [];
      headingEls.forEach((el, i) => {
        if (!el.id) el.id = `gpt-toc-h-${turns.length}-${i}`;
        headings.push({
          id: el.id,
          level: parseInt(el.tagName[1]),
          text: el.textContent.trim(),
          el,
        });
      });

      const prompt = currentPrompt || `对话 ${turns.length + 1}`;
      turns.push({
        userText: prompt,
        summary: makeConversationSummary(prompt, turns.length),
        headings,
      });
      currentPrompt = '';
    });

    // 兼容旧版 DOM（无 article）
    if (turns.length === 0) {
      const bodies = document.querySelectorAll(
        '[data-message-author-role="assistant"] .markdown, ' +
        '[data-message-author-role="assistant"] .prose, ' +
        '.agent-turn .markdown'
      );
      bodies.forEach((body, bi) => {
        const headingEls = body.querySelectorAll('h1,h2,h3,h4');
        if (!headingEls.length) return;
        const headings = [];
        headingEls.forEach((el, i) => {
          if (!el.id) el.id = `gpt-toc-h-${bi}-${i}`;
          headings.push({ id: el.id, level: parseInt(el.tagName[1]), text: el.textContent.trim(), el });
        });
        turns.push({
          userText: `对话 ${bi + 1}`,
          summary: `对话 ${bi + 1}`,
          headings,
        });
      });
    }

    return turns;
  }

  // ─── 渲染 ─────────────────────────────────────────────────────────────────────

  function buildSessionNode(turn, sessionIdx) {
    const session = document.createElement('div');
    session.className = 'toc-session';

    // 头部（用户提问）
    const header = document.createElement('div');
    header.className = 'toc-session-header';
    header.title = turn.userText || turn.summary;
    header.innerHTML = `
      <div class="toc-session-meta">
        <span class="toc-role-tag user">提问</span>
        <span class="toc-chevron">∨</span>
      </div>
      <span class="toc-session-title toc-session-prompt">${escHtml(turn.summary || turn.userText)}</span>
    `;
    session.appendChild(header);

    // 内容区
    const body = document.createElement('div');
    body.className = 'toc-session-body';

    const replyLabel = document.createElement('div');
    replyLabel.className = 'toc-reply-label';
    replyLabel.innerHTML = `
      <span class="toc-role-tag assistant">回复目录</span>
      <span class="toc-session-count">${turn.headings.length} 个标题</span>
    `;
    body.appendChild(replyLabel);

    // 将标题组织成树：h2 可折叠包裹其 h3/h4 子项
    let i = 0;
    const headings = turn.headings;
    while (i < headings.length) {
      const h = headings[i];

      if (h.level <= 2) {
        // h1 / h2：检查后续是否有 h3/h4 子项
        const children = [];
        let j = i + 1;
        while (j < headings.length && headings[j].level > h.level && headings[j].level >= 3) {
          children.push(headings[j]);
          j++;
        }

        if (h.level === 2 && children.length > 0) {
          // 可折叠的 h2 组
          const group = document.createElement('div');
          group.className = 'toc-h2-group';

          const hBtn = makeHeadingBtn(h, true);
          group.appendChild(hBtn);

          const childrenWrap = document.createElement('div');
          childrenWrap.className = 'toc-h2-children';
          children.forEach(ch => {
            const cb = makeHeadingBtn(ch, false);
            childrenWrap.appendChild(cb);
          });
          group.appendChild(childrenWrap);
          body.appendChild(group);
          i = j;
        } else {
          const btn = makeHeadingBtn(h, false);
          body.appendChild(btn);
          i++;
        }
      } else {
        // 孤立的 h3/h4
        const btn = makeHeadingBtn(h, false);
        body.appendChild(btn);
        i++;
      }
    }

    session.appendChild(body);
    return session;
  }

  function makeHeadingBtn(h, hasChevron) {
    const wrap = document.createElement('div');
    wrap.className = `toc-h${h.level}`;
    wrap.dataset.targetId = h.id;

    const btn = document.createElement('button');
    btn.className = 'toc-heading';
    btn.innerHTML = `
      <span class="toc-heading-text">${escHtml(h.text)}</span>
      ${hasChevron ? '<span class="toc-chevron">∨</span>' : ''}
    `;
    wrap.appendChild(btn);
    return wrap;
  }

  function scrollTo(h) {
    h.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveHeading(h.id);
  }

  function renderTOC(turns) {
    headingById.clear();
    activeHeadingBtn = null;
    scrollEl.innerHTML = '';

    if (!turns.length) {
      scrollEl.innerHTML = '<div class="toc-empty">暂无标题内容<br>AI 回复中使用 ## 标题语法后自动显示</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    turns.forEach((turn, idx) => {
      if (idx > 0) {
        fragment.appendChild(Object.assign(document.createElement('div'), { className: 'toc-session-divider' }));
      }
      turn.headings.forEach(h => headingById.set(h.id, h));
      fragment.appendChild(buildSessionNode(turn, idx));
    });
    scrollEl.appendChild(fragment);
  }

  function handleTOCClick(e) {
    const sessionHeader = e.target.closest('.toc-session-header');
    if (sessionHeader) {
      sessionHeader.closest('.toc-session')?.classList.toggle('collapsed');
      return;
    }

    const headingBtn = e.target.closest('.toc-heading');
    if (!headingBtn) return;

    const h2Group = headingBtn.closest('.toc-h2-group');
    if (h2Group && e.target.closest('.toc-chevron')) {
      h2Group.classList.toggle('collapsed');
      return;
    }

    const targetId = headingBtn.closest('[data-target-id]')?.dataset.targetId;
    const heading = targetId ? headingById.get(targetId) : null;
    if (heading) scrollTo(heading);
  }

  function setActiveHeading(id) {
    if (activeHeadingBtn) activeHeadingBtn.classList.remove('active');
    activeHeadingBtn = scrollEl.querySelector(`[data-target-id="${id}"] .toc-heading`);
    if (activeHeadingBtn) activeHeadingBtn.classList.add('active');
  }

  // ─── 滚动高亮 ─────────────────────────────────────────────────────────────────
  let intersectionObs = null;

  function setupHighlight(turns) {
    stopHighlight();
    const allHeadings = turns.flatMap(t => t.headings);
    if (!allHeadings.length) return;

    intersectionObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveHeading(entry.target.id);
        }
      });
    }, { threshold: 0.4 });

    allHeadings.forEach(h => intersectionObs.observe(h.el));
  }

  function stopHighlight() {
    if (!intersectionObs) return;
    intersectionObs.disconnect();
    intersectionObs = null;
  }

  // ─── 刷新入口 ─────────────────────────────────────────────────────────────────
  let refreshTimer = null;
  let routeRefreshTimers = [];
  let lastTOCSignature = null;
  let lastKnownUrl = location.href;
  function refresh() {
    updateTOCLayout();
    const turns = getConversationTurns();
    const signature = makeTOCSignature(turns);
    if (signature === lastTOCSignature) return;
    lastTOCSignature = signature;
    renderTOC(turns);
    setupHighlight(turns);
  }
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 120);
  }

  // ─── DOM 变化监听 ─────────────────────────────────────────────────────────────
  let tocObserver = null;
  function startTOCObserver() {
    if (tocObserver) return;
    const target = document.querySelector('main') || document.body;
    tocObserver = new MutationObserver(muts => {
      const hasContentChange = muts.some(isRelevantMutation);
      if (hasContentChange) scheduleRefresh();
    });
    tocObserver.observe(target, { childList: true, characterData: true, subtree: true });
  }

  function stopTOCObserver() {
    if (!tocObserver) return;
    tocObserver.disconnect();
    tocObserver = null;
    clearTimeout(refreshTimer);
  }

  function clearRouteRefreshTimers() {
    routeRefreshTimers.forEach(timer => clearTimeout(timer));
    routeRefreshTimers = [];
  }

  function handleRouteChange() {
    if (location.href === lastKnownUrl) return;
    lastKnownUrl = location.href;
    lastTOCSignature = null;
    clearTimeout(refreshTimer);
    clearRouteRefreshTimers();
    stopHighlight();

    if (!panel.classList.contains('open')) {
      stopTOCObserver();
      scrollEl.innerHTML = '';
      return;
    }

    stopTOCObserver();
    scrollEl.innerHTML = '<div class="toc-empty">正在加载当前会话目录...</div>';
    rebindTOCObserver();

    [80, 300, 900, 1800, 3500].forEach(delay => {
      routeRefreshTimers.push(setTimeout(() => {
        rebindTOCObserver();
        refresh();
      }, delay));
    });
  }

  function rebindTOCObserver() {
    stopTOCObserver();
    startTOCObserver();
  }

  const rawPushState = history.pushState;
  history.pushState = function (...args) {
    const ret = rawPushState.apply(this, args);
    handleRouteChange();
    return ret;
  };

  const rawReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const ret = rawReplaceState.apply(this, args);
    handleRouteChange();
    return ret;
  };

  window.addEventListener('popstate', handleRouteChange);
  setInterval(handleRouteChange, 600);

  // ─── 工具函数 ─────────────────────────────────────────────────────────────────
  function extractPromptText(message) {
    if (promptTextCache.has(message)) return promptTextCache.get(message);

    const clone = message.cloneNode(true);
    clone.querySelectorAll('button, svg, [aria-hidden="true"], .sr-only').forEach(el => el.remove());
    const text = clone.textContent.trim().replace(/\s+/g, ' ');
    promptTextCache.set(message, text);
    return text;
  }

  function isRelevantMutation(mutation) {
    const target = mutation.target.nodeType === Node.ELEMENT_NODE
      ? mutation.target
      : mutation.target.parentElement;

    if (!target || panel.contains(target) || fab.contains(target)) return false;

    if (mutation.type === 'characterData') {
      return Boolean(target.closest('[data-message-author-role="assistant"], .markdown, .prose'));
    }

    if (mutation.type !== 'childList') return false;

    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return changedNodes.some(node => {
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      if (!el || panel.contains(el) || fab.contains(el)) return false;
      return Boolean(
        el.matches?.('[data-message-author-role], article, .markdown, .prose, h1, h2, h3, h4') ||
        el.querySelector?.('[data-message-author-role], article, .markdown, .prose, h1, h2, h3, h4')
      );
    });
  }

  function makeConversationSummary(userText, index) {
    const source = (userText || `对话 ${index + 1}`)
      .replace(/\s+/g, ' ')
      .replace(/```[\s\S]*?```/g, '')
      .trim();

    if (!source) return `对话 ${index + 1}`;

    const clean = source
      .replace(/^(请|帮我|帮忙|需要|当前需要|现在需要|如何|怎么)\s*/u, '')
      .replace(/[。！？!?].*$/u, '')
      .trim();

    const text = clean || source;
    return text.length > 28 ? `${text.slice(0, 28)}...` : text;
  }

  function makeTOCSignature(turns) {
    return turns.map(turn => `${turn.summary}:${turn.headings.map(h => `${h.level}-${h.text}`).join('|')}`).join('\n');
  }

  function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
