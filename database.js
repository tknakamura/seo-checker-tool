const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.historyFile = path.join(this.dataDir, 'check_history.json');
        this.statsFile = path.join(this.dataDir, 'statistics.json');
        this.initializeDatabase();
    }

    initializeDatabase() {
        // データディレクトリが存在しない場合は作成
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        // 履歴ファイルが存在しない場合は空の配列で初期化
        if (!fs.existsSync(this.historyFile)) {
            fs.writeFileSync(this.historyFile, JSON.stringify([]));
        }

        // 統計ファイルが存在しない場合は初期化
        if (!fs.existsSync(this.statsFile)) {
            const initialStats = {
                totalChecks: 0,
                successfulChecks: 0,
                failedChecks: 0,
                averageScore: 0,
                averageAioScore: 0,
                averagePerformanceScore: 0,
                checksByDate: {},
                scoreDistribution: {
                    excellent: 0,
                    good: 0,
                    fair: 0,
                    poor: 0
                },
                commonIssues: {},
                topPerformingUrls: [],
                recentChecks: []
            };
            fs.writeFileSync(this.statsFile, JSON.stringify(initialStats, null, 2));
        }
    }

    // チェック履歴を保存
    saveCheckHistory(checkData) {
        try {
            const history = this.getCheckHistory();
            const newEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                url: checkData.url,
                type: checkData.type || 'single',
                success: checkData.success,
                scores: {
                    seo: checkData.scores?.seo || 0,
                    aio: checkData.scores?.aio || 0,
                    performance: checkData.scores?.performance || 0,
                    combined: checkData.scores?.combined || 0
                },
                issues: checkData.issues || [],
                recommendations: checkData.recommendations || [],
                error: checkData.error || null
            };

            history.unshift(newEntry); // 最新のものを先頭に追加

            // 最新の1000件のみ保持
            if (history.length > 1000) {
                history.splice(1000);
            }

            fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
            this.updateStatistics(newEntry);
            return newEntry;
        } catch (error) {
            console.error('履歴保存エラー:', error);
            throw error;
        }
    }

    // チェック履歴を取得
    getCheckHistory(limit = 100) {
        try {
            const history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
            return history.slice(0, limit);
        } catch (error) {
            console.error('履歴取得エラー:', error);
            return [];
        }
    }

    // 統計情報を更新
    updateStatistics(checkEntry) {
        try {
            const stats = this.getStatistics();
            
            // 基本統計の更新
            stats.totalChecks++;
            if (checkEntry.success) {
                stats.successfulChecks++;
            } else {
                stats.failedChecks++;
            }

            // スコアの更新
            if (checkEntry.success) {
                const scores = checkEntry.scores;
                stats.averageScore = this.calculateAverageScore(stats.averageScore, stats.successfulChecks, scores.seo);
                stats.averageAioScore = this.calculateAverageScore(stats.averageAioScore, stats.successfulChecks, scores.aio);
                stats.averagePerformanceScore = this.calculateAverageScore(stats.averagePerformanceScore, stats.successfulChecks, scores.performance);
            }

            // 日付別統計の更新
            const date = new Date(checkEntry.timestamp).toISOString().split('T')[0];
            if (!stats.checksByDate[date]) {
                stats.checksByDate[date] = {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    averageScore: 0
                };
            }
            stats.checksByDate[date].total++;
            if (checkEntry.success) {
                stats.checksByDate[date].successful++;
            } else {
                stats.checksByDate[date].failed++;
            }

            // スコア分布の更新
            if (checkEntry.success) {
                const combinedScore = checkEntry.scores.combined;
                if (combinedScore >= 90) stats.scoreDistribution.excellent++;
                else if (combinedScore >= 70) stats.scoreDistribution.good++;
                else if (combinedScore >= 50) stats.scoreDistribution.fair++;
                else stats.scoreDistribution.poor++;
            }

            // 共通問題の更新
            if (checkEntry.issues && checkEntry.issues.length > 0) {
                checkEntry.issues.forEach(issue => {
                    if (!stats.commonIssues[issue]) {
                        stats.commonIssues[issue] = 0;
                    }
                    stats.commonIssues[issue]++;
                });
            }

            // 最近のチェックの更新
            stats.recentChecks.unshift({
                id: checkEntry.id,
                url: checkEntry.url,
                timestamp: checkEntry.timestamp,
                success: checkEntry.success,
                combinedScore: checkEntry.scores.combined
            });
            if (stats.recentChecks.length > 50) {
                stats.recentChecks.splice(50);
            }

            // トップパフォーマンスURLの更新
            if (checkEntry.success && checkEntry.scores.combined >= 80) {
                const existingIndex = stats.topPerformingUrls.findIndex(item => item.url === checkEntry.url);
                const urlData = {
                    url: checkEntry.url,
                    score: checkEntry.scores.combined,
                    timestamp: checkEntry.timestamp
                };
                
                if (existingIndex >= 0) {
                    stats.topPerformingUrls[existingIndex] = urlData;
                } else {
                    stats.topPerformingUrls.push(urlData);
                }
                
                // スコア順でソートして上位10件のみ保持
                stats.topPerformingUrls.sort((a, b) => b.score - a.score);
                if (stats.topPerformingUrls.length > 10) {
                    stats.topPerformingUrls.splice(10);
                }
            }

            fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
        } catch (error) {
            console.error('統計更新エラー:', error);
        }
    }

    // 統計情報を取得
    getStatistics() {
        try {
            return JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
        } catch (error) {
            console.error('統計取得エラー:', error);
            return {
                totalChecks: 0,
                successfulChecks: 0,
                failedChecks: 0,
                averageScore: 0,
                averageAioScore: 0,
                averagePerformanceScore: 0,
                checksByDate: {},
                scoreDistribution: {
                    excellent: 0,
                    good: 0,
                    fair: 0,
                    poor: 0
                },
                commonIssues: {},
                topPerformingUrls: [],
                recentChecks: []
            };
        }
    }

    // 平均スコアの計算
    calculateAverageScore(currentAverage, count, newScore) {
        return ((currentAverage * (count - 1)) + newScore) / count;
    }

    // 日付範囲での履歴取得
    getCheckHistoryByDateRange(startDate, endDate) {
        try {
            const history = this.getCheckHistory(1000);
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            return history.filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return entryDate >= start && entryDate <= end;
            });
        } catch (error) {
            console.error('日付範囲履歴取得エラー:', error);
            return [];
        }
    }

    // URL別の履歴取得
    getCheckHistoryByUrl(url) {
        try {
            const history = this.getCheckHistory(1000);
            return history.filter(entry => entry.url === url);
        } catch (error) {
            console.error('URL別履歴取得エラー:', error);
            return [];
        }
    }

    // ダッシュボード用の集計データ取得
    getDashboardData() {
        try {
            const stats = this.getStatistics();
            const recentHistory = this.getCheckHistory(20);
            
            // 過去7日間のデータ
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentWeekHistory = this.getCheckHistoryByDateRange(
                sevenDaysAgo.toISOString().split('T')[0],
                new Date().toISOString().split('T')[0]
            );

            // 過去30日間のデータ
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentMonthHistory = this.getCheckHistoryByDateRange(
                thirtyDaysAgo.toISOString().split('T')[0],
                new Date().toISOString().split('T')[0]
            );

            return {
                overview: {
                    totalChecks: stats.totalChecks,
                    successfulChecks: stats.successfulChecks,
                    failedChecks: stats.failedChecks,
                    successRate: stats.totalChecks > 0 ? (stats.successfulChecks / stats.totalChecks * 100).toFixed(1) : 0,
                    averageScore: Math.round(stats.averageScore),
                    averageAioScore: Math.round(stats.averageAioScore),
                    averagePerformanceScore: Math.round(stats.averagePerformanceScore)
                },
                scoreDistribution: stats.scoreDistribution,
                recentChecks: recentHistory,
                weeklyTrend: this.calculateWeeklyTrend(recentWeekHistory),
                monthlyTrend: this.calculateMonthlyTrend(recentMonthHistory),
                commonIssues: this.getTopCommonIssues(stats.commonIssues, 10),
                topPerformingUrls: stats.topPerformingUrls,
                performanceMetrics: this.calculatePerformanceMetrics(recentHistory)
            };
        } catch (error) {
            console.error('ダッシュボードデータ取得エラー:', error);
            return null;
        }
    }

    // 週間トレンドの計算
    calculateWeeklyTrend(history) {
        const trend = {};
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = days[date.getDay()];
            
            const dayHistory = history.filter(entry => 
                entry.timestamp.startsWith(dateStr)
            );
            
            trend[dayName] = {
                date: dateStr,
                total: dayHistory.length,
                successful: dayHistory.filter(entry => entry.success).length,
                averageScore: dayHistory.length > 0 ? 
                    Math.round(dayHistory.reduce((sum, entry) => sum + (entry.scores.combined || 0), 0) / dayHistory.length) : 0
            };
        }
        
        return trend;
    }

    // 月間トレンドの計算
    calculateMonthlyTrend(history) {
        const trend = {};
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayHistory = history.filter(entry => 
                entry.timestamp.startsWith(dateStr)
            );
            
            trend[dateStr] = {
                total: dayHistory.length,
                successful: dayHistory.filter(entry => entry.success).length,
                averageScore: dayHistory.length > 0 ? 
                    Math.round(dayHistory.reduce((sum, entry) => sum + (entry.scores.combined || 0), 0) / dayHistory.length) : 0
            };
        }
        
        return trend;
    }

    // トップ共通問題の取得
    getTopCommonIssues(commonIssues, limit) {
        return Object.entries(commonIssues)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([issue, count]) => ({ issue, count }));
    }

    // パフォーマンスメトリクスの計算
    calculatePerformanceMetrics(history) {
        const successfulChecks = history.filter(entry => entry.success);
        
        if (successfulChecks.length === 0) {
            return {
                averageLoadTime: 0,
                averageResponseTime: 0,
                performanceScoreDistribution: {
                    excellent: 0,
                    good: 0,
                    fair: 0,
                    poor: 0
                }
            };
        }

        const performanceScores = successfulChecks
            .map(entry => entry.scores.performance)
            .filter(score => score > 0);

        const performanceScoreDistribution = {
            excellent: performanceScores.filter(score => score >= 90).length,
            good: performanceScores.filter(score => score >= 70 && score < 90).length,
            fair: performanceScores.filter(score => score >= 50 && score < 70).length,
            poor: performanceScores.filter(score => score < 50).length
        };

        return {
            averagePerformanceScore: performanceScores.length > 0 ? 
                Math.round(performanceScores.reduce((sum, score) => sum + score, 0) / performanceScores.length) : 0,
            performanceScoreDistribution
        };
    }
}

module.exports = Database;
