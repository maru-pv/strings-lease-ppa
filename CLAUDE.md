# strings-lease-ppa（太陽光 SBIリース vs PPA 比較シミュレーター）

利用者（丸さん）はエンジニアではない。回答は日本語・結論先・専門用語は噛み砕く。Git操作は一言説明を添える。

## 絶対に守ること
1. calc.js の計算ロジック・計算定義・データ構造は変えない。表示は calc.js の結果をそのまま使う
2. navi.html（営業用）と customer.html（お客様用）の計算結果が一致する状態を保つ
3. 既存の入力項目、6ステップの流れ、問い合わせフォーム、Supabase・GAS 連携を壊さない
4. 「利用料」ではなく「契約期間中の売電損失」など実態に合った表現。売電：リースは1〜30年目、PPAは16〜30年目（1〜15年目はPPA事業者）
5. flow.html の発電・消費カーブは体験用の概算。calc.js の数値と混同させない。売電単価15円は仮の値（FLOW_CONFIG）
6. getElementById の参照先 id は必ず HTML に残す（画面を組み替えても id は維持）

## デザイン
- 見た目は theme-dark.css（色はすべて --lk-xxxxxx 変数・小文字）＋ theme-switch.js（暗め／クリーン切替、既定クリーン）
- 配色（暗め）：背景 #07090c／パネル #0b0e12・#11161c／発電 #FFB547／売電 #5BC0F8／買電 #FF7A66／白 #E9EDF1
- フォント：Zen Kaku Gothic New（日本語）＋ Manrope（数字・英字）
- 角丸：ボタン10px、カード12〜16px。色やサイズを変えたいときは先に相談
- flow.html はデザイン案（design-mock/Flow_v2.dc.html）からビルドスクリプトで生成している

## 公開
- main に取り込むと Cloudflare Pages が自動で本番公開（https://strings-lease-ppa.pages.dev）
- ブランチの確認用URL：https://<ブランチ名>.strings-lease-ppa.pages.dev
- 作業はブランチ→PR→確認用URLで確認→丸さんが Merge を押す。main へ直接入れない
- design-mock/・archive/ は _redirects で公開から隠している

## 検証（段階ごとに必ず）
- main と作業ブランチを両方ローカルで動かし、お客様用・営業用の試算結果の全数値が一致すること
- 各ページの読み込みエラーなし、getElementById の参照先欠けなし

## UI刷新の進み具合（2026-09-28時点）
- 済：試算結果STEP4（お客様用・営業用）、体験ページ flow.html、ホーム index、営業用ナビ3画面（PR #3）
- 色の差し替えのみ（画面構成は旧のまま）：お客様用STEP1〜3・5・6、ログイン、管理画面、提案パターン・ラボ
- 次の順番：②お客様用STEP1〜3・5・6 → ③ログイン → ④管理画面・提案ラボ
- 営業用ナビ内「仕組みを体感」ボタンは新しい flow を開く（旧 solar-sim は未使用）
