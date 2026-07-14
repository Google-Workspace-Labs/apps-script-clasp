/* global getConfig, logSystem_, nt */

/**
 * Kingshot Coupon - 외부 신호 (Slack 알림 전송 + 배치 트리거 예약)
 *
 * 알림 채널: Slack 단일.
 *   - GAS 공유 IP 가 Discord Cloudflare 에 지속 차단됨이 실측 확인되어 Discord 제거.
 *   - Slack 인프라(AWS) 는 같은 IP 평판 영향 거의 없어 안정적.
 *
 * 주요 함수:
 * - notify_(embed, target, category)  : 카테고리 게이트 통과 시 Slack 전송
 * - notifySlack_(embed, target)       : Slack attachment 전송 + 429 백오프
 * - embedToSlackAttachment_(embed)    : 내부 embed 포맷 → Slack legacy attachment 변환
 * - NOTIFY_COLORS                     : 임베드 색상 팔레트 (decimal)
 * - buildBatchEmbed_                  : 배치 완료 임베드 빌더 (Code.js 에서 사용)
 * - requestBatch_                     : 배치 debounce 트리거 예약
 * - removeTriggers_                   : 특정 핸들러의 누적 트리거 정리
 *
 * 내부 embed 포맷 (channel-agnostic):
 *   { title, description, color, fields[], footer, timestamp, thumbnail }
 *   → 향후 다른 채널 추가 시 별도 컨버터만 작성하면 됨
 *
 * ⚠️ 함수명은 _ 로 끝나므로 google.script.run 으로는 호출 불가 (서버 전용).
 */

// ============================================================
// 색상 팔레트 (decimal — Slack 변환기가 hex 로 변환)
// ============================================================

const NOTIFY_COLORS = {
  green: 3066993,
  orange: 15105570,
  red: 15158332,
  gray: 9807270,
};

// ============================================================
// Dispatcher
// ============================================================

/**
 * 통합 알림 dispatcher.
 * @param {Object} embed    내부 embed 포맷
 * @param {string} target   진단 로그용 식별자 (예: 'batch', 'webhook', 'user-register')
 * @param {string} [category] 'batch'|'schedule'|'user'|'coupon'|'settings'|'sync'|'report'
 *   카테고리가 명시되고 해당 토글이 OFF 면 전송 skip.
 *   omit 하면 카테고리 게이트 통과(채널 검증용 메시지 등).
 */
function notify_(embed, target, category) {
  if (category) {
    const config = getConfig();
    if (config.notify && config.notify[category] === false) {
      return;
    }
  }
  try {
    notifySlack_(embed, target);
  } catch (e) {
    logSystem_('ERROR', 'notify', `slack send exception: ${e.message}`, target || '');
  }
}

// ============================================================
// 배치 완료 임베드 빌더 (Code.js 에서 사용)
// ============================================================

/**
 * 배치 완료 임베드 빌더.
 *
 * 제목 (한눈에 진행/완료 구분):
 *   - meta.continuing (다음 회차 예약됨) → "배치 진행 중"
 *   - 그 외 (최종) → "배치 완료 (최종)"
 *
 * 본문 첫 줄 = 상태 요약 (가장 눈에 띄는 자리):
 *   - 진행 중 → "⏳ 아직 진행 중 — 남은 ~N건"
 *   - 최종 + 남은 0 → "✅ 최종 완료 — 전부 처리됨"
 *   - 최종 + 남은 N → "⚠️ 최종 완료 — 남은 N건 (수동 확인)"  ← RL 재시도 소진 등
 *   - (warn>0 이면 경고 줄 추가)
 *
 * 색상:
 *   - 경고 (warn>0) → 빨강 / 실패 (fail>0) → 주황
 *   - 진행 중 (정상) → 회색(중립, "아직 안 끝남")  ← 최종 완료(초록)와 시각적으로 구분
 *   - 최종 완료 (정상) → 초록
 *
 * footer = 소요시간 + 시간초과/재시도 상세(언제 다음 회차인지):
 *   - "⏱️ 시간초과 → 1분 뒤 자동 이어실행" · "🔁 자동 재시도 N/3 — 3분 뒤" · "🚫 …영구 차단" · "✅ …회복"
 */
function buildBatchEmbed_(stats, meta) {
  const remaining = meta.remaining || 0;
  const continuing = !!meta.continuing;

  const color =
    stats.warn > 0
      ? NOTIFY_COLORS.red
      : stats.fail > 0
        ? NOTIFY_COLORS.orange
        : continuing
          ? NOTIFY_COLORS.gray // 진행 중(정상) = 중립
          : NOTIFY_COLORS.green; // 최종 완료(정상) = 초록

  const footerParts = [nt('bm_footer', { elapsed: meta.elapsedSec, avg: meta.avg })];
  if (meta.stoppedByTime) {
    footerParts.push(nt('bm_timeout'));
  }
  if (meta.retryStatus) {
    footerParts.push(meta.retryStatus);
  }

  // 상태 요약 줄(본문 최상단) — "진행 중 vs 최종 완료 + 남은 건수"
  const descParts = [
    continuing ? nt('bm_status_running', { remaining }) : nt('bm_status_done', { remaining }),
  ];
  if (stats.warn > 0) {
    descParts.push(nt('bm_warn', { warn: stats.warn }));
  }

  return {
    title: nt(continuing ? 'bm_title_running' : 'bm_title_done'),
    description: descParts.join('\n'),
    color,
    fields: [
      { name: nt('bm_f_success'), value: `${stats.success}`, inline: true },
      { name: nt('bm_f_already'), value: `${stats.already}`, inline: true },
      { name: nt('bm_f_disabled'), value: `${stats.disabled}`, inline: true },
      { name: nt('bm_f_fail'), value: `${stats.fail}`, inline: true },
      { name: nt('bm_f_skip'), value: `${stats.skip}`, inline: true },
      {
        name: nt('bm_f_target'),
        value: nt('bm_target_val', { users: meta.userCount, coupons: meta.couponCount }),
        inline: true,
      },
    ],
    footer: { text: footerParts.join(' · ') },
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// Slack 전송
// ============================================================

/**
 * 내부 embed → Slack legacy attachment 변환.
 *
 * 디자인 결정:
 *   - 본문 가독성 위해 legacy attachment 사용 (Block Kit 와 혼용 시 invalid_attachments 거부)
 *   - 닉네임은 description 안에 *굵게* + 🧑 이모지 prefix 로 시각 강조
 *   - 아바타는 image_url (하단 인라인 큰 이미지)
 *     ※ thumb_url 은 Akamai CDN URL 을 Slack image proxy 가 fetch 못함
 *
 * legacy 필드 매핑:
 *   - color           → 사이드바
 *   - title           → 제목 (굵게)
 *   - text            → 본문 (mrkdwn_in 으로 `**bold**` 자동 변환)
 *   - image_url       → 하단 인라인 이미지
 *   - fields[]        → 2-col 격자 (name/value/inline)
 *   - footer + ts     → 하단 미니 footer + 시각
 *
 * Markdown:
 *   - `**bold**` → `*bold*` (Slack 단일 별표) 자동 변환
 *   - `` `code` `` → 양쪽 동일
 */
function embedToSlackAttachment_(embed) {
  const attachment = { mrkdwn_in: ['text', 'pretext', 'fields'] };

  const toSlackMd = (s) => {
    if (s === null || s === undefined) {
      return '';
    }
    return String(s).replace(/\*\*([^*\n]+?)\*\*/g, '*$1*');
  };

  if (typeof embed.color === 'number') {
    attachment.color = '#' + (embed.color & 0xffffff).toString(16).padStart(6, '0');
  }
  if (embed.title) {
    attachment.title = String(embed.title).slice(0, 150);
  }
  if (embed.description) {
    attachment.text = toSlackMd(embed.description).slice(0, 2900);
  }
  if (embed.thumbnail && embed.thumbnail.url) {
    attachment.image_url = embed.thumbnail.url;
  }
  if (Array.isArray(embed.fields) && embed.fields.length > 0) {
    attachment.fields = embed.fields.slice(0, 10).map((f) => ({
      title: toSlackMd(f.name || ''),
      value: toSlackMd(f.value || ''),
      short: !!f.inline,
    }));
  }
  if (embed.footer && embed.footer.text) {
    attachment.footer = toSlackMd(embed.footer.text).slice(0, 300);
  }
  if (embed.timestamp) {
    const t = new Date(embed.timestamp).getTime();
    if (!isNaN(t)) {
      attachment.ts = Math.floor(t / 1000);
    }
  }

  // Fallback (모바일 푸시 등)
  const parts = [];
  if (embed.title) {
    parts.push(String(embed.title));
  }
  if (embed.description) {
    parts.push(
      String(embed.description).replace(/\*\*/g, '').replace(/`/g, '').replace(/\n/g, ' '),
    );
  }
  attachment.fallback = parts.join(' — ').slice(0, 300);

  return attachment;
}

/**
 * Slack attachment 전송. 429 처리:
 *   1) Cloudflare 차단(cf-ray 있음) → 0회 재시도
 *   2) 긴 retry-after (>20초) → 0회 재시도
 *   3) 짧은 throttle → 최대 5회 재시도 (retry-after 존중, 10초 캡)
 */
function notifySlack_(embed, target) {
  const config = getConfig();
  const url = config.slackWebhookUrl;
  if (!url || !config.slackEnabled) {
    return;
  }
  const tgt = target || '';
  const payload = JSON.stringify({ attachments: [embedToSlackAttachment_(embed)] });
  const MAX_ATTEMPTS = 5;
  const MAX_WAIT_MS = 10000;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload,
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      logSystem_(code >= 400 ? 'WARN' : 'INFO', 'slack', `attempt ${attempt}: HTTP ${code}`, tgt);
      if (code !== 429) {
        if (code >= 400) {
          const body = String(res.getContentText() || '').slice(0, 400);
          logSystem_('WARN', 'slack', `HTTP ${code} body: ${body}`, tgt);
        }
        return;
      }
      const headers = res.getAllHeaders ? res.getAllHeaders() : res.getHeaders();
      const h = (k) => headers[k] || headers[k.toLowerCase()] || headers[k.toUpperCase()] || '?';
      const retryAfterHdr = h('Retry-After');
      const cfRay = h('cf-ray');
      logSystem_(
        'WARN',
        'slack',
        `429 headers → retry-after=${retryAfterHdr} | cf-ray=${cfRay}`,
        tgt,
      );

      if (cfRay !== '?') {
        logSystem_(
          'ERROR',
          'slack',
          `Cloudflare block detected (cf-ray=${cfRay}) — skip retry, mark missed`,
          tgt,
        );
        return;
      }

      let waitMs = 1500;
      try {
        const j = JSON.parse(res.getContentText());
        if (j && j.retry_after) {
          waitMs = Math.ceil(Number(j.retry_after) * 1000) + 200;
        }
      } catch (e) {
        waitMs = 1500;
      }
      const headerSec = parseInt(retryAfterHdr, 10);
      if (!isNaN(headerSec) && headerSec > 0) {
        waitMs = headerSec * 1000 + 200;
      }

      if (waitMs > MAX_WAIT_MS * 2) {
        logSystem_(
          'ERROR',
          'slack',
          `retry-after=${waitMs}ms > ${MAX_WAIT_MS * 2}ms — skip retry, mark missed`,
          tgt,
        );
        return;
      }
      Utilities.sleep(Math.min(waitMs, MAX_WAIT_MS));
    } catch (err) {
      logSystem_('ERROR', 'slack', `network: ${err.message}`, tgt);
      return;
    }
  }
  logSystem_('ERROR', 'slack', `429 retry failed after all ${MAX_ATTEMPTS} attempts`, tgt);
}

// ============================================================
// 배치 트리거 예약 (debounce)
// ============================================================

const BATCH_DEBOUNCE_DEFAULT_MS = 30 * 1000;

/**
 * 배치 실행을 debounce 로 예약한다.
 * 기존 예약 트리거를 지우고 delayMs(기본 30초) 뒤 1회성 트리거를 만들어,
 * 연달아 등록해도 버스트가 끝난 뒤 배치가 한 번만 돌게 한다.
 *
 * 같은 핸들러의 트리거가 이미 있으면 항상 가장 짧은(=가장 최근에 만든) 게 이김.
 * → 유저 등록(180s)이 예약돼있는 상태에서 쿠폰 등록(30s)이 오면 30s 로 단축됨. 의도된 동작.
 *
 * @param {number} [delayMs] 예약 지연 (기본 30000). 0 이하/숫자아님은 기본값으로.
 */
function requestBatch_(delayMs) {
  removeTriggers_('runCouponBatch');
  const ms =
    typeof delayMs === 'number' && delayMs > 0 ? Math.floor(delayMs) : BATCH_DEBOUNCE_DEFAULT_MS;
  ScriptApp.newTrigger('runCouponBatch').timeBased().after(ms).create();
}

/** 특정 핸들러의 트리거 제거(중복 누적 방지) */
function removeTriggers_(handlerName) {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  }
}
