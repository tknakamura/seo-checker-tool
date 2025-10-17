/**
 * 全角文字数カウント機能のテストケース
 * 日本語SEO基準での文字数カウントが正しく動作することを検証
 */

const SEOChecker = require('./index.js');
const DetailedAnalyzer = require('./detailed-analyzer.js');

// テスト用のSEOCheckerインスタンス
const seoChecker = new SEOChecker();
const detailedAnalyzer = new DetailedAnalyzer();

// テストケースの定義
const testCases = [
  {
    name: '全角文字のみ（ひらがな）',
    text: 'こんにちはこんにちは',
    expected: 10, // 10全角文字
    description: 'ひらがな10文字'
  },
  {
    name: '全角文字のみ（カタカナ）',
    text: 'サンプルテストケース',
    expected: 10, // 10全角文字
    description: 'カタカナ10文字'
  },
  {
    name: '全角文字のみ（漢字）',
    text: '日本語文字数計算',
    expected: 8, // 8全角文字
    description: '漢字8文字'
  },
  {
    name: '半角文字のみ',
    text: 'Hello World Test',
    expected: 8, // 16半角文字 = 8全角文字相当
    description: '半角英字とスペース16文字（全角8文字相当）'
  },
  {
    name: '全角・半角混在（1）',
    text: 'SEO対策の基本',
    expected: 7.5, // SEO(1.5) + 対策の基本(6) = 7.5全角文字
    description: 'SEO（3半角）+ 日本語（6全角）= 7.5全角文字'
  },
  {
    name: '全角・半角混在（2）',
    text: 'HTML5とCSS3でWebサイト作成',
    expected: 19.5, // HTML5(2.5) + と(1) + CSS3(2) + で(1) + Webサイト作成(13) = 19.5
    description: 'HTML5 + 日本語 + CSS3 + 日本語の混在'
  },
  {
    name: 'タイトル用例文（適正）',
    text: 'メルカリSEO対策完全ガイド｜初心者向け',
    expected: 20, // メルカリ(4) + SEO(1.5) + 対策完全ガイド(7) + ｜(1) + 初心者向け(5) + (1) = 19.5 ≒ 20
    description: 'タイトルタグの適正例（15-30全角文字内）'
  },
  {
    name: 'メタディスクリプション用例文（適正）',
    text: 'メルカリでのSEO対策を初心者向けに詳しく解説します。検索エンジン最適化のコツから実践的な方法まで、具体例を交えて分かりやすく説明。',
    expected: 66, // 適正範囲内（60-80全角文字）
    description: 'メタディスクリプションの適正例（60-80全角文字内）'
  },
  {
    name: '空文字列',
    text: '',
    expected: 0,
    description: '空文字列のテスト'
  },
  {
    name: 'null値',
    text: null,
    expected: 0,
    description: 'null値のテスト'
  }
];

// テスト実行関数
function runTests() {
  console.log('=== 全角文字数カウント機能テスト開始 ===\n');
  
  let passCount = 0;
  let totalCount = testCases.length;
  
  testCases.forEach((testCase, index) => {
    console.log(`テスト ${index + 1}: ${testCase.name}`);
    console.log(`入力: "${testCase.text}"`);
    console.log(`期待値: ${testCase.expected}全角文字`);
    
    try {
      // SEOCheckerのメソッドを使用してテスト
      const result = seoChecker.calculateFullWidthLength(testCase.text);
      
      console.log(`実際の結果: ${result}全角文字`);
      
      // 浮動小数点の比較（0.1の誤差を許容）
      const isPass = Math.abs(result - testCase.expected) < 0.1;
      
      if (isPass) {
        console.log('✅ PASS');
        passCount++;
      } else {
        console.log('❌ FAIL');
      }
      
      console.log(`説明: ${testCase.description}`);
      console.log('---');
      
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
      console.log('---');
    }
  });
  
  console.log(`\n=== テスト結果サマリー ===`);
  console.log(`通過: ${passCount}/${totalCount}`);
  console.log(`成功率: ${((passCount / totalCount) * 100).toFixed(1)}%`);
  
  if (passCount === totalCount) {
    console.log('🎉 すべてのテストが通過しました！');
  } else {
    console.log('⚠️ 一部のテストが失敗しました。');
  }
}

// タイトルタグとメタディスクリプションの実際の動作テスト
function runIntegrationTests() {
  console.log('\n=== 統合テスト（実際のSEOチェック） ===\n');
  
  const testHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>メルカリSEO対策完全ガイド｜初心者向け</title>
  <meta name="description" content="メルカリでのSEO対策を初心者向けに詳しく解説します。検索エンジン最適化のコツから実践的な方法まで、具体例を交えて分かりやすく説明。">
</head>
<body>
  <h1>メルカリSEO対策</h1>
  <p>メルカリでSEO対策を行う方法を説明します。</p>
</body>
</html>
  `;
  
  console.log('テストHTML使用:');
  console.log('タイトル: "メルカリSEO対策完全ガイド｜初心者向け"');
  console.log('メタディスクリプション: "メルカリでのSEO対策を初心者向けに詳しく解説します。検索エンジン最適化のコツから実践的な方法まで、具体例を交えて分かりやすく説明。"');
  
  try {
    // 実際のSEOチェックを実行
    seoChecker.checkSEO(null, testHTML, false).then(results => {
      console.log('\n--- SEOチェック結果 ---');
      console.log(`タイトルタグ結果:`);
      console.log(`  現在のタイトル: "${results.checks.titleTag.current}"`);
      console.log(`  全角文字数: ${results.checks.titleTag.length}`);
      console.log(`  問題: ${results.checks.titleTag.issues}`);
      console.log(`  スコア: ${results.checks.titleTag.score}/100`);
      
      console.log(`\nメタディスクリプション結果:`);
      console.log(`  現在の説明: "${results.checks.metaDescription.current}"`);
      console.log(`  全角文字数: ${results.checks.metaDescription.length}`);
      console.log(`  問題: ${results.checks.metaDescription.issues}`);
      console.log(`  スコア: ${results.checks.metaDescription.score}/100`);
      
      console.log(`\n総合SEOスコア: ${results.overallScore}/100`);
      
      // 期待される結果の検証
      const titleExpected = seoChecker.calculateFullWidthLength('メルカリSEO対策完全ガイド｜初心者向け');
      const descExpected = seoChecker.calculateFullWidthLength('メルカリでのSEO対策を初心者向けに詳しく解説します。検索エンジン最適化のコツから実践的な方法まで、具体例を交えて分かりやすく説明。');
      
      console.log('\n--- 期待値との比較 ---');
      console.log(`タイトル全角文字数 - 期待値: ${titleExpected}, 実測値: ${results.checks.titleTag.length}`);
      console.log(`説明全角文字数 - 期待値: ${descExpected}, 実測値: ${results.checks.metaDescription.length}`);
      
      const titleMatch = Math.abs(titleExpected - results.checks.titleTag.length) < 0.1;
      const descMatch = Math.abs(descExpected - results.checks.metaDescription.length) < 0.1;
      
      console.log(`タイトル文字数チェック: ${titleMatch ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`説明文字数チェック: ${descMatch ? '✅ PASS' : '❌ FAIL'}`);
      
      if (titleMatch && descMatch) {
        console.log('\n🎉 統合テストが成功しました！');
      } else {
        console.log('\n⚠️ 統合テストで問題が発見されました。');
      }
      
    }).catch(error => {
      console.log(`❌ 統合テストエラー: ${error.message}`);
    });
    
  } catch (error) {
    console.log(`❌ 統合テスト準備エラー: ${error.message}`);
  }
}

// DetailedAnalyzerのテスト
function runDetailedAnalyzerTests() {
  console.log('\n=== DetailedAnalyzer テスト ===\n');
  
  // 共通のテストケースでDetailedAnalyzerもテスト
  testCases.slice(0, 5).forEach((testCase, index) => {
    console.log(`DetailedAnalyzer テスト ${index + 1}: ${testCase.name}`);
    
    try {
      const result = detailedAnalyzer.calculateFullWidthLength(testCase.text);
      const seoResult = seoChecker.calculateFullWidthLength(testCase.text);
      
      console.log(`DetailedAnalyzer結果: ${result}`);
      console.log(`SEOChecker結果: ${seoResult}`);
      
      const match = Math.abs(result - seoResult) < 0.1;
      console.log(`一致チェック: ${match ? '✅ PASS' : '❌ FAIL'}`);
      console.log('---');
      
    } catch (error) {
      console.log(`❌ エラー: ${error.message}`);
      console.log('---');
    }
  });
}

// メイン実行部分
if (require.main === module) {
  runTests();
  runDetailedAnalyzerTests();
  setTimeout(() => {
    runIntegrationTests();
  }, 1000);
}

module.exports = {
  runTests,
  runIntegrationTests,
  runDetailedAnalyzerTests,
  testCases
};
