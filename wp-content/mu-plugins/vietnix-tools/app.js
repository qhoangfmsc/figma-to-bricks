(function () {
  const cfg = window.VIETNIX_TOOLS || {};
  const $ = (id) => document.getElementById(id);
  const slots = ['desktop', 'tablet', 'mobile'];
  const placeholders = {
    link: 'https://…, /duong-dan, #neo, mailto:… hoặc tel:…',
    alt: 'Mô tả ngắn của ảnh',
    answer: 'Câu trả lời khi mở mục này',
    pane: 'Nội dung của tab này',
    autoplay: 'Số giây, ví dụ 5',
    sync: 'không sửa, chỉ đồng bộ chữ, đừng đổi icon',
    expand: 'Gõ phần chữ thêm khi mở, hoặc dán link Figma bản đầy đủ. Để trống thì hiện nốt chữ đã có trong khung.',
  };
  const defaults = { link: 'chưa có địa chỉ', autoplay: 'không tự chuyển', loop: 'dừng ở slide cuối', confirm: 'giữ nguyên khối', sync: 'làm các mục giống nhau', answer: 'chưa có câu trả lời', pane: 'chưa có nội dung', alt: 'ảnh chỉ để trang trí', act: 'Bấm để hiện hết chữ', expand: '', keep: 'Dựng thành một khối tĩnh' };
  let readFrames = null;
  let timer = null;
  let clock = null;
  let active = null;

  const formatDuration = (ms) => {
    const s = Math.max(0, Math.round(Number(ms) / 1000));
    if (s < 60) return `${s} giây`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return rem ? `${m} phút ${rem} giây` : `${m} phút`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h} giờ ${min} phút` : `${h} giờ`;
  };

  const frames = () => Object.fromEntries(slots.map((id) => [id, $(`vn-${id}`).value.trim()]));
  const setStep = (name) => {
    const order = ['links', 'confirm', 'result'];
    document.querySelectorAll('.vietnix-steps li').forEach((li) => {
      const at = order.indexOf(li.dataset.step);
      const cur = order.indexOf(name);
      li.classList.toggle('is-current', li.dataset.step === name);
      li.classList.toggle('is-done', at < cur);
    });
  };
  const showLog = (lines) => {
    $('vn-log').hidden = !lines.length;
    $('vn-log-body').textContent = lines.join('\n');
  };

  function showError(id, job) {
    const box = $(id);
    const text = job?.error || '';
    const problems = job?.problems || [];
    if (!text && !problems.length) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    box.replaceChildren();
    const head = document.createElement('p');
    head.textContent = text || 'Có lỗi.';
    box.appendChild(head);
    if (problems.length) {
      const list = document.createElement('ul');
      for (const item of problems) {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      }
      box.appendChild(list);
    }
    if (job.stack) {
      const pre = document.createElement('pre');
      pre.textContent = job.stack;
      box.appendChild(pre);
    }
  }

  function paintClock() {
    if (!active?.startedAt) return;
    if (active.phase !== 'reading' && active.phase !== 'building') return;
    const elapsed = (active.endedAt || Date.now()) - active.startedAt;
    const ran = formatDuration(elapsed);
    if (active.phase === 'reading') $('vn-plan-time').textContent = ran;
    if (active.phase === 'building') $('vn-build-time').textContent = ran;
  }

  async function call(path, body) {
    const res = await fetch(cfg.api + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.token },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) {
      const msg = data.error || (data.errors || []).join(' ') || ('Lỗi ' + res.status);
      const err = new Error(msg);
      err.problems = data.problems || data.errors || [];
      throw err;
    }
    return data;
  }

  function watch(id, onDone) {
    clearInterval(timer);
    clearInterval(clock);
    clock = setInterval(paintClock, 1000);
    const stop = () => { clearInterval(timer); clearInterval(clock); };
    timer = setInterval(async () => {
      try {
        const job = await call('/jobs/' + id);
        active = job;
        showLog(job.log || []);
        paintClock();
        if (job.phase === 'reading' || job.phase === 'building') return;
        stop();
        onDone(job);
      } catch (e) {
        stop();
        onDone({ phase: 'error', error: e.message, stack: e.stack || '', problems: e.problems || [], log: [] });
      }
    }, 1500);
  }

  function control(f, showTitle) {
    const label = document.createElement('label');
    if (showTitle) {
      const span = document.createElement('span');
      span.textContent = f.title || f.field;
      label.appendChild(span);
    }
    let input;
    if (f.control === 'textarea') input = document.createElement('textarea');
    else if (f.control === 'select') {
      input = document.createElement('select');
      for (const value of (f.options?.length ? f.options : ['có', 'không'])) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        input.appendChild(opt);
      }
    } else input = document.createElement('input');
    if (input.tagName !== 'SELECT') input.placeholder = f.placeholder || placeholders[f.group] || '';
    input.value = f.value != null && f.value !== '' ? f.value : (defaults[f.group] ?? '');
    input.dataset.key = f.key;
    label.appendChild(input);
    if (f.linkOption) {
      const url = document.createElement('input');
      url.dataset.actUrl = f.key;
      url.placeholder = 'Địa chỉ trang: https://…, /duong-dan hoặc #neo. Không phải link Figma.';
      url.hidden = input.value !== f.linkOption;
      input.dataset.actLink = f.linkOption;
      input.addEventListener('change', () => { url.hidden = input.value !== f.linkOption; });
      label.appendChild(url);
    }
    return label;
  }

  function partBlock(part) {
    const wrap = document.createElement('section');
    wrap.className = 'vietnix-part';
    const head = document.createElement('header');
    const name = document.createElement('strong');
    name.textContent = part.fields.length === 1 ? (part.fields[0].title || part.name) : part.name;
    head.append(name);
    if (part.figma) {
      const link = document.createElement('a');
      link.href = part.figma;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Figma';
      head.appendChild(link);
    }
    wrap.appendChild(head);
    for (const f of part.fields) wrap.appendChild(control(f, part.fields.length > 1));
    return wrap;
  }

  function renderConfirm(read) {
    const body = $('vn-confirm-body');
    body.replaceChildren();
    const head = document.createElement('div');
    head.className = 'vietnix-template';
    const kicker = document.createElement('span');
    kicker.textContent = 'Template';
    const title = document.createElement('strong');
    title.textContent = `${read.name || read.title} · ${read.width || '?'}px`;
    head.append(kicker, title);
    body.appendChild(head);
    const merged = (read.variants || []).map((v) => `${v.key} ${v.width || ''}px`).join(', ');
    if (merged) {
      const line = document.createElement('p');
      line.className = 'vietnix-summary';
      line.textContent = `Gộp ${merged}`;
      body.appendChild(line);
    }
    const parts = read.parts || [];
    if (!parts.length) {
      const none = document.createElement('p');
      none.textContent = 'Không có component cần điền.';
      body.appendChild(none);
    }
    for (const part of parts) body.appendChild(partBlock(part));
    $('vn-build').disabled = false;
    $('vn-confirm-msg').textContent = 'Giá trị trong ô là giá trị sẽ dùng. Sửa nếu cần, rồi bấm Tạo template.';
    $('vn-plan-time').textContent = '';
    setStep('confirm');
  }

  function renderResult(result) {
    const body = $('vn-result-body');
    body.replaceChildren();
    const title = document.createElement('p');
    title.textContent = result.title;
    body.appendChild(title);
    if (result.builderUrl) {
      const open = document.createElement('a');
      open.href = result.builderUrl;
      open.target = '_blank';
      open.rel = 'noopener';
      open.textContent = 'Mở template trong Bricks';
      body.appendChild(open);
    }
    const list = document.createElement('p');
    const templates = document.createElement('a');
    templates.href = cfg.templates;
    templates.textContent = 'Danh sách template';
    list.appendChild(templates);
    body.appendChild(list);
    const scores = document.createElement('p');
    scores.textContent = (result.frames || []).map((f) => `${f.key}: ${f.verdict || 'chưa đo'}${f.look != null ? ' · look ' + f.look : ''}`).join(' · ');
    body.appendChild(scores);
    const own = document.createElement('p');
    own.textContent = 'Template đã nằm trong Bricks. Bạn tự gắn nó vào trang.';
    body.appendChild(own);
    $('vn-build-time').textContent = '';
    setStep('result');
  }

  function throwOnScreen(where, job) {
    const fail = { error: job.error || 'Có lỗi.', problems: job.problems || [], stack: job.stack || '' };
    showError('vn-result-error', fail);
    showError(where, fail);
    $('vn-plan-time').textContent = '';
    $('vn-build-time').textContent = '';
    if (where === 'vn-link-error') $('vn-link-msg').textContent = 'Đọc không xong.';
    else $('vn-confirm-msg').textContent = 'Tạo không xong.';
    setStep('result');
  }

  $('vn-read').addEventListener('click', async () => {
    $('vn-link-msg').textContent = '';
    showError('vn-link-error', {});
    showError('vn-result-error', {});
    $('vn-build').disabled = true;
    if (!cfg.token) {
      throwOnScreen('vn-link-error', { error: 'Chưa có pipeline. Chạy node process/vietnix/server.mjs rồi tải lại trang.' });
      return;
    }
    try {
      const started = await call('/read', { frames: frames() });
      readFrames = frames();
      active = { phase: 'reading', startedAt: Date.now(), estimate: null };
      setStep('links');
      $('vn-link-msg').textContent = 'Đang đọc Figma…';
      watch(started.id, (job) => {
        showLog(job.log || []);
        if (job.phase === 'confirm') {
          $('vn-link-msg').textContent = 'Đã đọc xong.';
          renderConfirm(job.read);
        } else throwOnScreen('vn-link-error', job);
      });
    } catch (e) {
      throwOnScreen('vn-link-error', { error: e.message, problems: e.problems, stack: e.stack });
    }
  });

  slots.forEach((id) => $(`vn-${id}`).addEventListener('input', () => {
    if (!readFrames) return;
    const stale = JSON.stringify(frames()) !== JSON.stringify(readFrames);
    $('vn-build').disabled = stale;
    if (stale) $('vn-confirm-msg').textContent = 'Link đã đổi. Bấm Đọc Figma lại.';
  }));

  $('vn-build').addEventListener('click', async () => {
    const answers = {};
    document.querySelectorAll('#vn-confirm-body [data-key]').forEach((el) => {
      let value = el.value.trim();
      if (el.dataset.actLink && value === el.dataset.actLink) {
        value = (el.parentElement.querySelector('[data-act-url]')?.value || '').trim();
      }
      answers[el.dataset.key] = value;
    });
    showError('vn-confirm-error', {});
    showError('vn-result-error', {});
    $('vn-confirm-msg').textContent = 'Đang tạo template…';
    $('vn-build').disabled = true;
    try {
      const started = await call('/build', { frames: readFrames, answers });
      active = { phase: 'building', startedAt: Date.now(), estimate: null };
      setStep('result');
      watch(started.id, (job) => {
        showLog(job.log || []);
        if (job.phase === 'done') {
          $('vn-confirm-msg').textContent = 'Đã tạo.';
          renderResult(job.result);
        } else {
          $('vn-build').disabled = false;
          throwOnScreen('vn-confirm-error', job);
        }
      });
    } catch (e) {
      $('vn-build').disabled = false;
      throwOnScreen('vn-confirm-error', { error: e.message, problems: e.problems, stack: e.stack });
    }
  });

  window.addEventListener('error', (event) => {
  throwOnScreen('vn-result-error', { error: event.message || 'Lỗi trên trang.', stack: event.error?.stack || '' });
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  throwOnScreen('vn-result-error', { error: reason?.message || String(reason), stack: reason?.stack || '' });
});

  if (cfg.token) {
    fetch(cfg.api + '/health').then((res) => {
      if (!res.ok) showError('vn-link-error', { error: 'Pipeline không trả lời. Chạy node process/vietnix/server.mjs.' });
    }).catch(() => {
      showError('vn-link-error', { error: 'Pipeline không trả lời. Chạy node process/vietnix/server.mjs.' });
    });
  }
})();
