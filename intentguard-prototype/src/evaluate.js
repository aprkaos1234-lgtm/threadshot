'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/*
 * Blind evaluation (spec §19-§22).
 *
 * Hard rules enforced here:
 *   - The evaluator sees ONLY the requirement text and the proposed status.
 *     No system name, no id prefix, no confidence, no history, no source date.
 *   - Source labels are never restored until every item is judged (§20).
 *   - Progress is saved after every single answer, and the run is resumable,
 *     because a 200-item evaluation in one sitting produces garbage (§21).
 */

const VERDICTS = [
  ['1', 'CORRECT_ACTIVE',      '현재 실제로 유효한(ACTIVE) 요구사항이 맞다'],
  ['2', 'CORRECT_NON_ACTIVE',  '실제 요구사항이지만 현재 ACTIVE 는 아니다'],
  ['3', 'NOT_A_REAL_REQUIREMENT', '실제 요구사항이 아니다 / 시스템이 만들어냈다'],
  ['4', 'WRONG_STATUS',        '요구사항은 존재하지만 상태 판정이 틀렸다'],
  ['5', 'AMBIGUOUS_IN_REALITY', '전체 맥락을 봐도 최종 상태를 판단하기 어렵다'],
];

const SESSION_SIZE = 60; // spec §21 recommends 50-80 per sitting

/*
 * readline's `question` callback drops input that arrived before the question
 * was asked. With a pipe (scripted runs, CI) every line lands at once, so the
 * second question never resolves and the process exits silently having saved
 * nothing. Queueing the lines ourselves works for both a terminal and a pipe.
 */
function makeLineReader(input, output) {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const queued = [];
  const waiting = [];
  let closed = false;
  rl.on('line', (line) => {
    if (waiting.length) waiting.shift()(line);
    else queued.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift()(null);
  });
  return {
    ask(prompt) {
      output.write(prompt);
      if (queued.length) return Promise.resolve(queued.shift());
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiting.push(resolve));
    },
    close() { rl.close(); },
  };
}

function loadProgress(file) {
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { /* restart */ }
  }
  return { verdicts: {}, notes: {}, manual_missing: null, completed: false };
}

function saveProgress(file, progress) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(progress, null, 2));
}

function banner(s) {
  return '\n' + '='.repeat(72) + '\n' + s + '\n' + '='.repeat(72) + '\n';
}

async function runEvaluation(dataDir, log) {
  const blindFile = path.join(dataDir, 'blind_items.json');
  if (!fs.existsSync(blindFile)) {
    throw new Error('blind_items.json 이 없습니다. 먼저 `npm run merge` 를 실행하세요.');
  }
  const blind = JSON.parse(fs.readFileSync(blindFile, 'utf8'));
  const items = blind.items;
  const progressFile = path.join(dataDir, 'evaluation_progress.json');
  const progress = loadProgress(progressFile);

  const io = makeLineReader(process.stdin, process.stdout);
  // EOF (a pipe running out) is treated as "stop here and save", never as a
  // verdict — a truncated script must not silently record wrong judgements.
  const ask = async (q) => {
    const line = await io.ask(q);
    return line === null ? null : line.trim();
  };
  try {
    const pending = items.filter((it) => !progress.verdicts[it.merged_id]);
    const done = items.length - pending.length;

    console.log(banner('BLIND EVALUATION'));
    console.log('전체 ' + items.length + '개 항목 중 ' + done + '개 완료, ' + pending.length + '개 남음.');
    console.log('');
    console.log('각 항목에 대해 아래 중 하나를 선택하세요:');
    for (const [key, name, desc] of VERDICTS) console.log('  ' + key + ') ' + name + ' — ' + desc);
    console.log('  s) 이 항목 건너뛰기   q) 저장하고 종료');
    console.log('');
    console.log('※ 어떤 항목이 어느 시스템에서 나왔는지는 평가가 끝날 때까지 표시되지 않습니다.');

    if (!pending.length && !progress.completed) {
      console.log('\n모든 항목 판정 완료.');
    }

    // Split into sittings so nobody is asked to judge 200 items at once (§21).
    const sitting = pending.slice(0, SESSION_SIZE);
    if (pending.length > SESSION_SIZE) {
      console.log('\n이번 세션에서는 ' + SESSION_SIZE + '개만 진행합니다 (평가 피로 방지, 명세 §21).');
      console.log('나머지 ' + (pending.length - SESSION_SIZE) + '개는 이 명령을 다시 실행하면 이어서 합니다.');
    }

    let quit = false;
    for (let i = 0; i < sitting.length && !quit; i++) {
      const it = sitting[i];
      console.log('\n' + '-'.repeat(72));
      console.log('[' + (done + i + 1) + '/' + items.length + ']');
      console.log('');
      console.log('  요구사항 : ' + it.requirement);
      console.log('  제안 상태 : ' + it.proposed_status);
      console.log('');
      let answer = '';
      while (true) {
        const raw = await ask('  판정 (1-5 / s / q) > ');
        if (raw === null) { console.log('\n(입력이 끝났습니다 — 여기까지 저장합니다.)'); quit = true; break; }
        answer = raw.toLowerCase();
        if (answer === 'q') { quit = true; break; }
        if (answer === 's') break;
        if (VERDICTS.some(([k]) => k === answer)) break;
        console.log('  1-5, s, q 중에서 입력하세요.');
      }
      if (quit) break;
      if (answer === 's') continue;

      const verdict = VERDICTS.find(([k]) => k === answer)[1];
      const note = (await ask('  메모 (선택, Enter 로 건너뜀) > ')) || '';
      progress.verdicts[it.merged_id] = verdict;
      if (note) progress.notes[it.merged_id] = note;
      saveProgress(progressFile, progress); // save after EVERY answer
    }

    const remaining = items.filter((it) => !progress.verdicts[it.merged_id]).length;
    if (remaining > 0) {
      saveProgress(progressFile, progress);
      console.log(banner('저장했습니다. ' + remaining + '개 남았습니다.'));
      console.log('이어서 하려면 같은 명령을 다시 실행하세요: npm run evaluate');
      console.log('\n※ 아직 source 라벨을 복원하지 않았습니다 (명세 §20).');
      return { complete: false, progress };
    }

    // ---- All items judged. Now, and only now, §22's question. ----
    console.log(banner('MANUAL MISSING REQUIREMENTS (명세 §22)'));
    console.log('이 실험에서 가장 중요한 산출물입니다.');
    console.log('');
    console.log('위 목록에는 없었지만, 현재 제품에 반드시 있어야 한다고');
    console.log('당신이 알고 있는 중요한 요구사항이 있습니까?');
    console.log('');
    console.log('한 줄에 하나씩 입력하고, 다 쓰면 빈 줄에서 Enter 를 누르세요.');
    console.log('기억나는 만큼만 쓰면 됩니다. 없으면 그냥 Enter.');
    console.log('');

    const missing = progress.manual_missing ? progress.manual_missing.slice() : [];
    if (missing.length) {
      console.log('(이전에 입력한 ' + missing.length + '개가 있습니다. 계속 추가할 수 있습니다.)');
      for (const m of missing) console.log('  - ' + m);
      console.log('');
    }
    while (true) {
      const line = await ask('  누락된 요구사항 > ');
      if (!line) break; // empty line or EOF ends the list
      missing.push(line);
      progress.manual_missing = missing;
      saveProgress(progressFile, progress);
    }

    progress.manual_missing = missing;
    progress.completed = true;
    progress.completed_at = new Date().toISOString();
    saveProgress(progressFile, progress);

    console.log(banner('평가 완료'));
    console.log('판정 ' + Object.keys(progress.verdicts).length + '개, ' +
      'MANUAL_MISSING ' + missing.length + '개.');
    if (!missing.length) {
      console.log('');
      console.log('MANUAL_MISSING 이 0개입니다. 이것은 자동으로 성공을 의미하지 않습니다 (명세 §23).');
      console.log('RESULT.md 에 두 가지 해석이 모두 기록됩니다:');
      console.log('  A. 두 시스템 모두 충분히 잘 복구했다');
      console.log('  B. 애초에 당신이 Product Contract 를 거의 다 기억하고 있어서,');
      console.log('     IntentGuard 가 풀려는 "잊힌 요구사항" 문제가 이 프로젝트에서는 약했다');
    }
    console.log('');
    console.log('이제 `npm run result` 로 source 를 복원하고 RESULT.md 를 생성하세요.');
    return { complete: true, progress };
  } finally {
    io.close();
  }
}

/** Spec §22: for each remembered requirement, which systems found it? */
async function attributeMissing(llm, missingList, merged, log) {
  if (!missingList || !missingList.length) return [];
  const { topK } = require('./similar');
  const results = [];
  for (const missing of missingList) {
    const cands = topK([{ requirement: missing }], merged, (x) => x.requirement, 5, 0.05)[0].candidates;
    let matched = null;
    if (cands.length && llm) {
      const { data } = await llm.structured({
        stage: 'semantic_judge',
        system: require('./merge').JUDGE_SYSTEM || '두 요구사항이 같은지 판정합니다.',
        user: '기준 요구사항: ' + missing + '\n\n후보:\n' +
          cands.map((c, i) => (i + 1) + ') [' + c.item.id + '] ' + c.item.requirement).join('\n') +
          '\n\n각 후보가 기준 요구사항과 같은 요구사항인지 판정하세요.',
        schema: {
          type: 'object', additionalProperties: false, required: ['judgements'],
          properties: {
            judgements: {
              type: 'array',
              items: {
                type: 'object', additionalProperties: false,
                required: ['candidate_id', 'verdict'],
                properties: {
                  candidate_id: { type: 'string' },
                  verdict: { type: 'string', enum: ['SAME_REQUIREMENT', 'RELATED_BUT_DIFFERENT', 'DIFFERENT', 'UNCERTAIN'] },
                },
              },
            },
          },
        },
        maxTokens: 4000,
      });
      const same = ((data && data.judgements) || []).find((j) => j.verdict === 'SAME_REQUIREMENT');
      if (same) matched = merged.find((m) => m.id === same.candidate_id) || null;
    }
    results.push({
      requirement: missing,
      matched_merged_id: matched ? matched.id : null,
      found_by: matched ? matched._sources : [],
      found_by_none: !matched,
    });
  }
  return results;
}

module.exports = { runEvaluation, attributeMissing, VERDICTS, SESSION_SIZE };
