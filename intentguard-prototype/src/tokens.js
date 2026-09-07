'use strict';
/*
 * Cheap offline token estimate. Korean text tokenizes far denser than English,
 * so a flat chars/4 rule would understate a Korean transcript by ~2x and make
 * the STEP 6 cost estimate useless. CJK is counted separately.
 * This is an ESTIMATE and is labelled as such everywhere it is reported.
 */
const CJK = /[ᄀ-ᇿ㄰-㆏가-힯぀-ヿ一-鿿]/;

function estimateTokens(text) {
  if (!text) return 0;
  let cjk = 0;
  for (const ch of text) if (CJK.test(ch)) cjk++;
  const rest = text.length - cjk;
  return Math.ceil(cjk / 1.4 + rest / 4);
}

module.exports = { estimateTokens };
