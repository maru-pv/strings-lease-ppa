/**
 * calc.js - 太陽光リース vs PPA 共通計算ロジック
 * ※ このファイルはDOM操作を一切行わない純粋な計算モジュールです
 * ※ index.html / customer.html の両方から読み込まれます
 * version: v2026.06.10-1
 */

/* ===================================================
   定数・マスターデータ
=================================================== */

const DAY_CONSUME_RATE = 0.30; // 日中消費割合（オール電化世帯基準・固定）

const UTIL_DATA = {
  chugoku:     { name:'中国電力 / 従量電灯A（エリア標準）',              unit:36.32, fuel:1.21, ren:4.18, priority:1 },
  chugoku_ev:  { name:'中国電力 / 電化Styleコース（オール電化・昼間）',  unit:44.40, fuel:1.21, ren:4.18, priority:1 },
  kyushu:      { name:'九州電力 / 従量電灯B（エリア標準）',              unit:31.14, fuel:1.41, ren:4.18, priority:2 },
  kyushu_ev:   { name:'九州電力 / 電化でナイト・セレクト（オール電化）', unit:29.50, fuel:1.41, ren:4.18, priority:2 },
  kansai:      { name:'関西電力 / 従量電灯A（エリア標準）',              unit:32.65, fuel:2.10, ren:4.18, priority:3 },
  kansai_ev:   { name:'関西電力 / はぴeタイムR（オール電化）',           unit:31.96, fuel:2.10, ren:4.18, priority:3 },
  shikoku:     { name:'四国電力 / 従量電灯A（エリア標準）',              unit:37.29, fuel:2.23, ren:4.18, priority:4 },
  shikoku_ev:  { name:'四国電力 / タイム（オール電化）',                 unit:34.50, fuel:2.23, ren:4.18, priority:4 },
  tepco:       { name:'東京電力EP / 従量電灯B',                         unit:40.49, fuel:1.80, ren:4.18, priority:5 },
  tepco_ev:    { name:'東京電力EP / スマートライフS（オール電化）',      unit:34.62, fuel:1.80, ren:4.18, priority:5 },
  tohoku:      { name:'東北電力 / 従量電灯B',                           unit:38.65, fuel:0.90, ren:4.18, priority:6 },
  chubu:       { name:'中部電力 / 従量電灯B',                           unit:36.00, fuel:1.20, ren:4.18, priority:7 },
  hokuriku:    { name:'北陸電力 / 従量電灯B',                           unit:44.47, fuel:1.10, ren:4.18, priority:8 },
  hokkaido:    { name:'北海道電力 / 従量電灯B',                         unit:44.26, fuel:2.47, ren:4.18, priority:9 },
  okinawa:     { name:'沖縄電力 / 従量電灯',                            unit:39.37, fuel:4.28, ren:4.18, priority:10 },
  manual:      { name:'新電力・手動入力',                                unit:0,     fuel:0,    ren:4.18, priority:99 }
};

const PPA_PLANS = {
  // 建て得（LIXIL）: 自家消費0円型
  smile: { name:'建て得スマイル', provider:'lixil', type:'zero',    init:495000, term:15, sc:30, pf3:7.15, minCap:4.5, capLbl:'4.5kW以上', pconCost:400000 },
  life:  { name:'建て得ライフ',   provider:'lixil', type:'zero',    init:330000, term:15, sc:30, pf3:7.15, minCap:4.5, capLbl:'4.5kW以上', pconCost:400000 },
  value: { name:'建て得バリュー', provider:'lixil', type:'zero',    init:0,      term:15, sc:30, pf3:7.15, minCap:9.0, capLbl:'9kW以上',   pconCost:400000 },
  // 大阪ガス スマイルーフ: 従量課金型
  osakagas: {
    name:'大阪ガス スマイルーフ', provider:'osakagas', type:'metered',
    init:0, term:15, pf3:7.15, minCap:1.06, capLbl:'1.06kW以上',
    selfUnitPrice:24, pconCost:200000,
    area:'大阪ガス都市ガス供給エリア限定',
    note:'自家消費分を24円/kWhで購入。売電収入は大阪ガス側（15年間）。15年後無償譲渡。'
  },
  // シェアでんき: 従量課金型
  sharedenki: {
    name:'シェアでんき', provider:'sharedenki', type:'metered',
    init:0, term:15, pf3:7.15, minCap:5.625, capLbl:'5.625kW以上',
    selfUnitPrice:25, pconCost:0,
    area:'全国（一部除く）',
    note:'自家消費分を25円/kWhで購入。売電収入はシェアリングエネルギー側。パワコン交換は事業者負担。15年後無償譲渡。'
  },
  // マドそら（YKKAP × 東京ガス IGNITURE）: 月額固定型
  madsolar: {
    name:'マドそら（IGNITUREソーラー）', provider:'madsolar', type:'monthly',
    init:0, term:10, pf3:7.15, minCap:4.0, capLbl:'要確認',
    monthlyFee:null, pconCost:200000,
    area:'全国（北海道・北陸・沖縄・離島など一部除く）',
    note:'月額サービス料を支払い、自家消費0円・売電収入は東京ガス側（10年間）。'
  }
};

const LEASE_PLANS = {
  '6':  { cap:6,  monthly:12000, term:10 },
  '8':  { cap:8,  monthly:16000, term:10 },
  '12': { cap:12, monthly:24000, term:10 }
};

// FIT売電単価デフォルト
const DEFAULT_LF1 = 24;   // 1〜4年目
const DEFAULT_LF2 = 8.3;  // 5年目〜リース期間終了
const DEFAULT_LF3 = 7.15; // リース終了後

/* ===================================================
   ユーティリティ
=================================================== */

/**
 * 数値を「+XX万円」形式にフォーマット
 */
function fmtMan(n, d = 1) {
  const man = n / 10000;
  return (man >= 0 ? '+' : '') + man.toFixed(d) + '万円';
}

/**
 * 数値を「XX万円」形式にフォーマット（符号なし）
 */
function fmtManAbs(n, d = 1) {
  return Math.abs(n / 10000).toFixed(d) + '万円';
}

/* ===================================================
   コア計算関数
=================================================== */

/**
 * 自家消費率を自動計算
 * @param {number} monthlyKwh - 月間電力使用量（kWh）
 * @param {number} capKw - パネル容量（kW）
 * @returns {number} 自家消費率（0〜0.85）
 */
function calcAutoSC(monthlyKwh, capKw) {
  const monthlyGen = capKw * 1000 / 12;
  const dayConsume = monthlyKwh * DAY_CONSUME_RATE;
  return Math.min(dayConsume / monthlyGen, 0.85);
}

/**
 * 電力会社キーから実効単価を計算
 * @param {string} utilKey - UTIL_DATAのキー
 * @param {number|null} manualUnit - 手動入力単価（manual選択時）
 * @returns {number} 実効単価（円/kWh）
 */
function getEffUnitByKey(utilKey, manualUnit = null) {
  const d = UTIL_DATA[utilKey];
  if (!d) return 0;
  if (utilKey === 'manual') return (manualUnit || 0) + d.ren;
  return d.unit + d.fuel + d.ren;
}

/**
 * 月間電気代からkWhを逆算（簡易）
 * @param {number} monthlyBill - 月間電気代（円）
 * @param {number} effUnit - 実効単価（円/kWh）
 * @returns {number} 月間kWh
 */
function billToKwh(monthlyBill, effUnit) {
  if (!effUnit) return 600;
  return Math.round(monthlyBill / effUnit);
}

/**
 * メイン計算関数（DOM非依存）
 *
 * @param {Object} params - 計算パラメータ
 * @param {number}  params.effUnit      - 実効単価（円/kWh）
 * @param {number}  params.monthlyKwh   - 月間電力使用量（kWh）
 * @param {string}  params.leaseKey     - リースプランキー ('6'|'8'|'12'|'custom')
 * @param {number}  [params.leaseCapCustom] - カスタム容量（leaseKey='custom'時）
 * @param {string}  params.ppaKey       - PPAプランキー
 * @param {number}  params.ppaCap       - PPA容量（kW）
 * @param {string}  params.ecoMode      - エコモード ('none'|'solar'|'ohisama')
 * @param {number}  params.ecoKwh       - エコキュート年間使用量（kWh）
 * @param {boolean} params.ppaEcoOption - 建て得ECOオプション有無
 * @param {number}  [params.madsolarFee]- マドそら月額（円）
 * @param {number}  [params.incRate]    - 電気代上昇率（%、デフォルト2）
 * @param {number}  [params.lf1]        - FIT単価1〜4年目
 * @param {number}  [params.lf2]        - FIT単価5年目〜期間終了
 * @param {number}  [params.lf3]        - FIT単価期間終了後
 *
 * @returns {Object} 計算結果
 */
function calcMain(params) {
  const {
    effUnit,
    monthlyKwh,
    leaseKey,
    leaseCapCustom,
    ppaKey,
    ppaCap: ppaCapRaw,
    ecoMode      = 'none',
    ecoKwh       = 1200,
    ppaEcoOption = false,
    madsolarFee  = 0,
    incRate      = 2,
    lf1 = DEFAULT_LF1,
    lf2 = DEFAULT_LF2,
    lf3 = DEFAULT_LF3,
  } = params;

  // プラン取得
  const lp = leaseKey === 'custom'
    ? { cap: leaseCapCustom || 6, monthly: (leaseCapCustom || 6) * 2000, term: 10 }
    : LEASE_PLANS[leaseKey] || LEASE_PLANS['6'];

  const p = PPA_PLANS[ppaKey] || PPA_PLANS['smile'];
  const ppaType = p.type || 'zero';
  const ppaCap = Math.max(p.minCap || 4.5, ppaCapRaw || lp.cap);

  // エコ設定
  const ECO_SHIFT_RATES = { none: 0.00, solar: 0.40, ohisama: 0.70 };
  const ecoOnCheck = ecoMode !== 'none';
  const shiftR = ECO_SHIFT_RATES[ecoMode] || 0;
  const shiftedKwh = ecoKwh * shiftR;

  // 建て得ECOオプションコスト
  const pEcoCost = (ppaEcoOption && ecoOnCheck) ? 198000 : 0;
  const pinit = p.init + pEcoCost;
  const pterm = p.term;
  const pf3_val = p.pf3 || lf3;

  // 定数
  const DR   = 0.005;
  const AGEN = lp.cap * 1000;
  const pAGEN = ppaCap * 1000;
  const YRS  = 30;
  const incR = incRate / 100;

  // 自家消費率
  const lscR = calcAutoSC(monthlyKwh, lp.cap);
  const pscR = calcAutoSC(monthlyKwh, ppaCap);

  // ベースライン（太陽光なし）
  const monthlyBillBase = monthlyKwh * effUnit;

  // 累積変数
  let lCum = 0, pCum = -pinit;
  let lCumEco = 0; // ECO込みリース累積（PDF用）
  let lBep = null, cross = null;
  const la = [], pa = [], labs = [];
  const annualLease = [], annualPPA = [];
  let lSvT=0, lSlT=0, lCT=0, lPT=0;
  let pSvT=0, pSlT=0, pLT=0, pPT=0;

  for (let y = 1; y <= YRS; y++) {
    const pm  = Math.pow(1 + incR, y - 1);
    const eu  = effUnit * pm;
    const gen  = AGEN  * Math.pow(1 - DR, y - 1);
    const pGen = pAGEN * Math.pow(1 - DR, y - 1);

    // リース：ECOシフト計算
    const lsu_check = y <= 4 ? lf1 : y <= lp.term ? lf2 : lf3;
    const ecoShiftEffective = ecoOnCheck && (lsu_check < eu);
    const _shiftRatio = (gen > 0 && ecoShiftEffective)
      ? Math.min(shiftedKwh / gen, 1 - lscR) : 0;
    const lscREco = lscR + _shiftRatio;

    const lSv  = gen * lscREco * eu;
    const lsu  = y <= 4 ? lf1 : y <= lp.term ? lf2 : lf3;
    const lSl  = gen * (1 - lscREco) * lsu;
    const lC   = y <= lp.term ? lp.monthly * 12 : 0;
    const lP   = (y === 15 || y === 30) ? 200000 : 0;
    const lAnnual = lSv + lSl - lC - lP;
    lSvT += lSv; lSlT += lSl; lCT += lC; lPT += lP;
    lCum += lAnnual;

    // ECO込み累積（メイン表示用）
    lCumEco = lCum;

    annualLease.push(Math.round(lAnnual));

    // PPA：ECOシフト計算
    const ppaEcoOn = ppaEcoOption && ecoOnCheck;
    const _pShiftRatio = (ppaEcoOn && pGen > 0)
      ? Math.min(shiftedKwh / pGen, 1 - pscR) : 0;
    const pscREco = pscR + _pShiftRatio;

    const pPconCost = p.pconCost ?? 400000;
    const pP = ((y === 15 || y === 30) && pPconCost > 0) ? pPconCost : 0;

    let pSv, pSl, pLoss, pAnnual;
    if (ppaType === 'metered') {
      const selfUnitPrice = p.selfUnitPrice || 24;
      pSv    = pGen * pscREco * (eu - selfUnitPrice);
      pSl    = y > pterm ? pGen * (1 - pscREco) * pf3_val : 0;
      pLoss  = y <= pterm ? pGen * (1 - pscREco) * (y <= 4 ? 24 : 8.3) : 0;
      pAnnual = pSv + pSl - pP;
    } else if (ppaType === 'monthly') {
      const mFee = madsolarFee || 0;
      pSv    = pGen * pscREco * eu;
      pSl    = y > pterm ? pGen * (1 - pscREco) * pf3_val : 0;
      const pMonthly = y <= pterm ? mFee * 12 : 0;
      pLoss  = y <= pterm ? pGen * (1 - pscREco) * (y <= 4 ? 24 : 8.3) : 0;
      pAnnual = pSv + pSl - pMonthly - pP;
    } else {
      // zero型（建て得）
      pSv    = pGen * pscREco * eu;
      pSl    = y > pterm ? pGen * (1 - pscREco) * pf3_val : 0;
      pLoss  = y <= pterm ? pGen * (1 - pscREco) * (y <= 4 ? 24 : 8.3) : 0;
      pAnnual = pSv + pSl - pP;
    }
    pSvT += pSv; pSlT += pSl; pLT += pLoss; pPT += pP;
    pCum += pAnnual;

    annualPPA.push(Math.round(pAnnual));

    if (lBep === null && lCum > 0) lBep = y;
    if (cross === null && lCum > pCum) cross = y;
    la.push(Math.round(lCum));
    pa.push(Math.round(pCum));
    labs.push(y + '年');
  }

  const diff = lCumEco - pCum;

  return {
    // 累積メリット
    lCum30:     Math.round(lCumEco),   // リース30年累積（ECO込み）
    pCum30:     Math.round(pCum),      // PPA30年累積
    diff30:     Math.round(diff),      // 差額（正=リース有利）
    // 損益分岐
    leaseBep:   lBep,                  // リース単体の回収年
    crossYear:  cross,                 // リースがPPAを上回る年
    // グラフ用配列
    leaseArr:   la,
    ppaArr:     pa,
    labels:     labs,
    // 年次データ
    annualLease,
    annualPPA,
    // 内訳合計
    lSvTotal:   Math.round(lSvT),
    lSlTotal:   Math.round(lSlT),
    lCostTotal: Math.round(lCT),
    lPconTotal: Math.round(lPT),
    pSvTotal:   Math.round(pSvT),
    pSlTotal:   Math.round(pSlT),
    pLossTotal: Math.round(pLT),
    pPconTotal: Math.round(pPT),
    pInitCost:  pinit,
    // プラン情報（表示用）
    leasePlan:  lp,
    ppaPlan:    p,
    ppaCap,
    lscR:       Math.round(lscR * 100),
    pscR:       Math.round(pscR * 100),
  };
}
