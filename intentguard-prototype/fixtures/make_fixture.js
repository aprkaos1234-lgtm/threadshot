'use strict';
/*
 * Synthetic Claude Code transcript generator.
 *
 * PURPOSE: regression-test the parser and the Stage 1 filter. Nothing more.
 *
 * ⚠️ This data is FABRICATED. It must never be used to judge whether
 * IntentGuard beats the baseline. A synthetic transcript contains exactly the
 * temporal patterns its author put there, so measuring recovery on it is
 * circular. It exists only so that `src/filter.js` can be changed in STEP 4
 * without silently breaking parsing.
 *
 * It deliberately includes schema variation that a real multi-month history
 * would contain:
 *   - an OLD-format session with no `origin` / `promptSource` fields
 *   - a session resume that replays earlier uuids (duplicate detection)
 *   - sidechain (sub-agent) records
 *   - tool results that inherit the human turn's promptId
 *   - injected <system-reminder>, slash-command expansion, wake envelopes
 *   - pasted code, stack traces, low-information replies
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outHome = process.argv[2] || path.join(__dirname, 'claude-home');
const CWD = '/home/user/demo-app';
const projDir = path.join(outHome, 'projects', CWD.replace(/[^A-Za-z0-9]/g, '-'));
fs.mkdirSync(projDir, { recursive: true });

let clock = Date.parse('2026-03-02T09:00:00Z');
function tick(minutes) { clock += minutes * 60000; return new Date(clock).toISOString(); }
const uuid = () => crypto.randomUUID();

function makeSession(sessionId, version, opts) {
  const lines = [];
  let parent = null;
  const push = (o) => { lines.push(JSON.stringify(o)); return o.uuid; };

  const base = (extra) => Object.assign({
    parentUuid: parent, isSidechain: false, userType: 'external',
    cwd: CWD, sessionId, version, gitBranch: 'main',
    entrypoint: opts.entrypoint || 'cli',
  }, extra);

  function human(text, gapMin) {
    const u = uuid();
    const promptId = uuid();
    const rec = base({
      type: 'user', uuid: u, timestamp: tick(gapMin === undefined ? 30 : gapMin),
      promptId, message: { role: 'user', content: text },
    });
    // Old Claude Code builds did not write origin/promptSource/permissionMode.
    if (!opts.legacy) {
      rec.origin = { kind: 'human' };
      rec.promptSource = 'cli';
      rec.permissionMode = 'default';
    }
    parent = push(rec);
    return { uuid: u, promptId };
  }

  function attachment(type, payload) {
    parent = push(base({ type: 'attachment', uuid: uuid(), timestamp: tick(0), attachment: Object.assign({ type }, payload) }));
  }

  function assistantToolUse() {
    const u = uuid();
    parent = push(base({
      type: 'assistant', uuid: u, timestamp: tick(0), requestId: 'req_' + uuid().slice(0, 8),
      message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_' + uuid().slice(0, 12), name: 'Bash', input: { command: 'ls' } }] },
    }));
    return u;
  }

  function toolResult(assistantUuid, promptId, content) {
    parent = push(base({
      type: 'user', uuid: uuid(), timestamp: tick(0), promptId,
      sourceToolAssistantUUID: assistantUuid,
      toolUseResult: { stdout: content, stderr: '', interrupted: false },
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_x', content }] },
    }));
  }

  function sidechainHuman(text) {
    parent = push(base({
      type: 'user', uuid: uuid(), timestamp: tick(0), isSidechain: true,
      message: { role: 'user', content: text },
    }));
  }

  function turn(text, gapMin) {
    const { promptId } = human(text, gapMin);
    const a = assistantToolUse();
    toolResult(a, promptId, 'total 4\ndrwxr-xr-x 2 root root 4096 Mar  2 09:00 .');
  }

  return { lines, human, attachment, assistantToolUse, toolResult, sidechainHuman, turn,
    write: (name) => fs.writeFileSync(path.join(projDir, name), lines.join('\n') + '\n') };
}

// ---------------------------------------------------------------------------
// Session 1 — March. Initial requirements. LEGACY format (no origin field).
// ---------------------------------------------------------------------------
const s1id = uuid();
const s1 = makeSession(s1id, '1.0.88', { legacy: true });
s1.attachment('environment', { snapshot: { os: 'darwin' } });
s1.turn('구글 트렌드에서 한국 인기 검색어를 가져와서 쇼핑 상품형 키워드만 골라주는 웹앱을 만들어줘', 0);
s1.turn('무료 사용자는 월 3회만 분석할 수 있게 제한해', 45);
s1.turn('결과 카드에 쿠팡 검색 링크를 같이 넣어줘', 20);
s1.human('ㅇㅇ', 3);
s1.turn('로그인은 일단 이메일만 지원하자', 60);
s1.turn('그리고 분석 결과를 공유할 수 있는 링크 생성 기능도 추가해줘', 30);
s1.human('계속', 2);
s1.human(`Traceback (most recent call last):
  File "server/trends.py", line 42, in fetch
    resp = requests.get(url, timeout=5)
  File "/usr/lib/python3/requests/api.py", line 73, in get
    return request("get", url, **kwargs)
requests.exceptions.ConnectionError: HTTPSConnectionPool(host='trends.google.com', port=443): Max retries exceeded`, 15);
s1.turn('타임아웃 늘리고 재시도 3번 하게 해줘', 5);
s1.write(s1id + '.jsonl');

// ---------------------------------------------------------------------------
// Session 2 — April. Temporary change + a rejection. Modern format.
// ---------------------------------------------------------------------------
clock = Date.parse('2026-04-11T10:00:00Z');
const s2id = uuid();
const s2 = makeSession(s2id, '2.0.31', {});
s2.attachment('date', { date: '2026-04-11' });
s2.attachment('skill_listing', { content: '- docx\n- pdf', names: ['docx', 'pdf'], skillCount: 2, isInitial: true });
s2.turn('테스트하는 동안에는 월 3회 제한 풀어줘. 계속 걸려서 확인이 안 돼', 0);
s2.human('<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>', 5);
s2.turn('아까 만든 공유 링크 기능은 빼자. 스팸 신고가 들어올 것 같아', 40);
s2.human('ㅇㅋ', 2);
s2.sidechainHuman('Search the codebase for share link generation and report every call site.');
s2.turn(`이거 왜 안 되지?
export async function GET() {
  const res = await fetch(TRENDS_URL, { next: { revalidate: 0 } });
  const xml = await res.text();
  const items = parseRss(xml);
  return Response.json({ items });
}
`, 25);
s2.human('음', 1);
s2.turn('상단에 마지막 업데이트 시간 표시해줘', 30);
s2.write(s2id + '.jsonl');

// ---------------------------------------------------------------------------
// Session 3 — May. Reactivation + supersede. Includes a resume that replays
// the first two records of session 2 (duplicate uuid handling).
// ---------------------------------------------------------------------------
clock = Date.parse('2026-05-20T08:30:00Z');
const s3id = uuid();
const s3 = makeSession(s3id, '2.1.263', { entrypoint: 'remote_mobile' });
// replay: identical uuids from session 2's first two lines
s3.lines.push(s2.lines[1]);
s3.lines.push(s2.lines[2]);
s3.turn('출시 준비하자. 무료 사용자 제한 다시 월 3회로 되돌려줘', 0);
s3.turn('아니 3회 말고 5회로 하자. 초반엔 좀 넉넉하게 주는 게 나을 것 같아', 15);
s3.human('네', 2);
s3.turn('한국시간 오전 6시를 하루 갱신 기준으로 써줘', 50);
s3.turn('앱 켜둔 상태면 10분마다 날짜 경계 확인해서 자동 갱신하게', 20);
s3.human('팀 기능도 나중에 만들까?', 35);
s3.human('아직은 됐어', 3);
s3.human(`<system-reminder>
The user opened the file /home/user/demo-app/page.js
</system-reminder>
쿠팡이 자동 요청 막으면 "쿠팡 최종확인"으로 표시해줘`, 10);
s3.human('.', 1);
s3.turn('이메일 로그인 말고 카카오 로그인으로 바꾸자', 40);
s3.write(s3id + '.jsonl');

console.log('fixture written to ' + projDir);
console.log('sessions: 3, cwd: ' + CWD);
