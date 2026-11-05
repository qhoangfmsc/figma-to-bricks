(function () {
  const cfg = window.VIETNIX_TOOLS || {};
  const $ = (id) => document.getElementById(id);
  const slots = ['desktop', 'widescreen', 'tablet', 'landscape', 'mobile'];
  const frameName = {
    desktop: 'Máy tính',
    widescreen: 'Màn hình rộng',
    tablet_portrait: 'Máy tính bảng',
    mobile_landscape: 'Điện thoại ngang',
    mobile_portrait: 'Điện thoại dọc',
  };
  const placeholders = {
    link: 'Viết địa chỉ, ví dụ vietnix.vn/bang-gia. Chưa có thì ghi chưa có.',
    alt: 'Một câu ngắn, ví dụ logo Vietnix. Ảnh trang trí thì để nguyên.',
    answer: 'Viết câu trả lời khi mở mục này.',
    pane: 'Đúng rồi thì để nguyên. Muốn đổi thì dán link khung, hoặc viết nội dung.',
    autoplay: 'Ví dụ 5 giây, hoặc đừng tự chạy.',
    count: 'Ví dụ 5 cái.',
    items: 'Để trống là dùng các mục đang có. Hoặc dán link khung chứa đủ mục.',
    sync: 'Giữ nguyên, chỉ giống phần chữ, hoặc đừng đổi icon.',
    expand: 'Viết chữ thêm khi mở, hoặc dán link khung đã mở hết. Để trống thì hiện nốt chữ đang có.',
  };
  const defaults = { link: 'chưa có địa chỉ', autoplay: 'tự chuyển mỗi 3 giây', loop: 'dừng ở slide cuối', count: '', items: '', confirm: 'giữ nguyên khối', sync: 'làm các mục giống nhau', answer: 'chưa có câu trả lời', pane: 'chưa có nội dung', alt: 'ảnh chỉ để trang trí', act: 'Bấm để hiện hết chữ', expand: '', keep: 'Dựng thành một khối tĩnh' };
  let readFrames = null;
  let lastAnswers = {};
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
      url.placeholder = 'Viết địa chỉ trang, ví dụ vietnix.vn/bang-gia.';
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
    const text = document.createElement('div');
    text.className = 'vietnix-part-name';
    if (part.kind) {
      const kind = document.createElement('span');
      kind.className = 'vietnix-kind';
      kind.textContent = part.kind;
      text.appendChild(kind);
    }
    const name = document.createElement('strong');
    name.textContent = part.fields.length === 1 ? (part.fields[0].title || part.name) : part.name;
    text.appendChild(name);
    head.append(text);
    if (part.figma) {
      const link = document.createElement('a');
      link.href = part.figma;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Figma';
      head.appendChild(link);
    }
    wrap.appendChild(head);
    if (part.detail) {
      const seen = document.createElement('p');
      seen.className = 'vietnix-note';
      seen.textContent = part.detail;
      wrap.appendChild(seen);
    }
    if (part.note) {
      const note = document.createElement('p');
      note.className = 'vietnix-note';
      note.textContent = part.note;
      wrap.appendChild(note);
    }
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
    const merged = (read.variants || []).map((v) => `${frameName[v.key] || v.key} ${v.width || ''}px`).join(', ');
    if (merged) {
      const line = document.createElement('p');
      line.className = 'vietnix-summary';
      line.textContent = `Gộp ${merged}`;
      body.appendChild(line);
    }
    const rule = document.createElement('p');
    rule.className = 'vietnix-summary';
    rule.textContent = "Hệ thống nhận diện được";
    body.appendChild(rule);
    const parts = read.parts || [];
    if (!parts.length) {
      const none = document.createElement('p');
      none.textContent = 'Không nhận ra component nào.';
      body.appendChild(none);
    }
    for (const part of parts) body.appendChild(partBlock(part));
    $('vn-build').disabled = false;
    $('vn-confirm-msg').textContent = 'Viết bình thường cũng được. Ô nào để sẵn thì cứ giữ, rồi bấm Tạo template.';
    $('vn-plan-time').textContent = '';
    setStep('confirm');
  }

  function reviewOf(frame) {
    if (frame.review?.notes) return frame.review;
    const name = frameName[frame.key] || frame.key;
    const percent = frame.look == null ? null : Math.round((frame.look / 255) * 1000) / 10;
    return { name, tone: frame.verdict === 'FAIL' ? 'fail' : frame.verdict ? 'pass' : 'none', percent, notes: frame.verdict ? [] : ['Chưa đo được.'] };
  }

  function reviewBlock(frame) {
    const review = reviewOf(frame);
    const box = document.createElement('section');
    box.className = `vietnix-review${review.tone === 'fail' ? ' is-fail' : review.tone === 'pass' ? ' is-pass' : ''}`;
    const title = document.createElement('p');
    title.className = 'vietnix-review-title';
    title.textContent = review.percent == null ? review.name : `${review.name}: lệch ${review.percent}%`;
    box.appendChild(title);
    if (review.notes?.length) {
      const list = document.createElement('ul');
      for (const note of review.notes) {
        const item = document.createElement('li');
        item.textContent = note;
        list.appendChild(item);
      }
      box.appendChild(list);
    }
    return box;
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
    for (const frame of result.frames || []) body.appendChild(reviewBlock(frame));
    const own = document.createElement('p');
    own.textContent = 'Template đã nằm trong Bricks. Bạn tự gắn nó vào trang.';
    body.appendChild(own);
    const feedback = document.createElement('label');
    const caption = document.createElement('span');
    caption.className = 'vietnix-label';
    caption.textContent = 'Góp ý';
    const area = document.createElement('textarea');
    area.id = 'vn-feedback';
    area.rows = 3;
    area.placeholder = 'Viết bình thường. Ví dụ: phần bên trái có họ và tên là một cái form.';
    feedback.appendChild(caption);
    feedback.appendChild(area);
    body.appendChild(feedback);
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'button button-primary';
    again.textContent = 'Làm lại theo góp ý';
    again.addEventListener('click', () => regen(area.value));
    body.appendChild(again);
    $('vn-build-time').textContent = '';
    setStep('result');
  }

  function regen(text) {
    const hint = text.trim();
    showError('vn-result-error', {});
    if (!hint) return;
    if (!readFrames) return;
    const again = document.querySelector('#vn-result-body button');
    if (again) again.disabled = true;
    $('vn-confirm-msg').textContent = 'Đang làm lại theo góp ý.';
    call('/build', { frames: readFrames, answers: lastAnswers, feedback: hint }).then((started) => {
      active = { phase: 'building', startedAt: Date.now(), estimate: null };
      setStep('result');
      watch(started.id, (job) => {
        showLog(job.log || []);
        if (job.phase === 'done' && job.result?.builderUrl) {
          $('vn-confirm-msg').textContent = 'Đã làm lại.';
          renderResult(job.result);
        } else if (job.phase === 'done' || job.phase === 'error') {
          throwOnScreen('vn-result-error', job.error ? job : { error: 'Làm lại không xong.' });
        }
      });
    }, (e) => {
      throwOnScreen('vn-result-error', { error: e.message, problems: e.problems, stack: e.stack });
    });
  }

  function throwOnScreen(where, job) {
    const fail = { error: job.error || 'Có lỗi.', problems: job.problems || [], stack: job.stack || '' };
    showError('vn-link-error', where === 'vn-link-error' ? fail : {});
    showError('vn-confirm-error', where === 'vn-confirm-error' ? fail : {});
    showError('vn-result-error', where === 'vn-result-error' ? fail : {});
    $('vn-plan-time').textContent = '';
    $('vn-build-time').textContent = '';
    if (where === 'vn-link-error') $('vn-link-msg').textContent = 'Đọc không xong.';
    else if (where === 'vn-confirm-error') $('vn-confirm-msg').textContent = 'Tạo không xong.';
    setStep(where === 'vn-link-error' ? 'links' : where === 'vn-result-error' ? 'result' : 'confirm');
  }

  // A new read is a new job. Leaving the previous confirm and result on screen keeps the user on the old step.
  function resetFollowUp() {
    const wait = (id, text) => {
      const body = $(id);
      body.replaceChildren();
      const p = document.createElement('p');
      p.className = 'vietnix-wait';
      p.textContent = text;
      body.appendChild(p);
    };
    wait('vn-confirm-body', 'Đọc Figma xong, các ô cần điền hiện ở đây.');
    wait('vn-result-body', 'Link hiện ở đây khi template đã kiểm tra xong.');
    $('vn-confirm-msg').textContent = '';
    $('vn-build-time').textContent = '';
    $('vn-build').disabled = true;
    showError('vn-confirm-error', {});
    showError('vn-result-error', {});
    showLog([]);
    readFrames = null;
    setStep('links');
  }

  $('vn-read').addEventListener('click', async () => {
    resetFollowUp();
    $('vn-link-msg').textContent = '';
    showError('vn-link-error', {});
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
    lastAnswers = answers;
    $('vn-confirm-msg').textContent = 'Đang tạo template, đẩy lên WordPress và kiểm tra.';
    $('vn-build').disabled = true;
    try {
      const started = await call('/build', { frames: readFrames, answers });
      active = { phase: 'building', startedAt: Date.now(), estimate: null };
      setStep('confirm');
      watch(started.id, (job) => {
        showLog(job.log || []);
        if (job.phase === 'done' && job.result?.builderUrl) {
          $('vn-confirm-msg').textContent = 'Đã xong.';
          setStep('result');
          renderResult(job.result);
        } else if (job.phase === 'done' || job.phase === 'error') {
          $('vn-build').disabled = false;
          throwOnScreen('vn-confirm-error', job.error ? job : { error: 'Kiểm tra vẫn còn chỗ lệch nặng. Chưa hiện link vì template chưa xong.' });
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
