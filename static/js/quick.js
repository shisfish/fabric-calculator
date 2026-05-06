/**
 * 面料用量快速计算系统 - 快速估算页面
 */

document.addEventListener('DOMContentLoaded', () => {
    // 品类切换时更新提示
    document.getElementById('q-category').addEventListener('change', updateTips);
});

function updateTips() {
    const cat = document.getElementById('q-category').value;
    const tipsCard = document.getElementById('quick-tips-card');
    // 可以根据品类动态调整提示
}

async function quickEstimate() {
    const data = {
        category: document.getElementById('q-category').value,
        garment_length: parseFloat(document.getElementById('q-length').value) || 0,
        chest: parseFloat(document.getElementById('q-chest').value) || 0,
        shoulder: parseFloat(document.getElementById('q-shoulder').value) || 0,
        sleeve_length: parseFloat(document.getElementById('q-sleeve').value) || 0,
        has_hood: document.getElementById('q-hood').checked,
        has_lining: document.getElementById('q-lining').checked,
        style_complexity: document.querySelector('input[name="complexity"]:checked')?.value || 'medium',
        fabric_width: parseFloat(document.getElementById('q-fabric-width').value) || 145,
        fabric_weight_gsm: parseFloat(document.getElementById('q-fabric-weight').value) || 0,
        quantity: parseInt(document.getElementById('q-quantity').value) || 1,
    };

    // 验证
    if (data.garment_length <= 0) {
        alert('请输入衣长');
        return;
    }
    if (data.chest <= 0) {
        alert('请输入胸围');
        return;
    }

    showLoading(true);
    try {
        const resp = await fetch('/api/quick-estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await resp.json();
        if (result.success) {
            renderQuickResult(result.data);
        } else {
            alert('估算失败: ' + result.message);
        }
    } catch (e) {
        alert('请求失败: ' + e.message);
    } finally {
        showLoading(false);
    }
}

function renderQuickResult(data) {
    // 概览
    const summaryCard = document.getElementById('quick-result-card');
    const summary = document.getElementById('quick-result-summary');
    summaryCard.style.display = 'block';

    summary.innerHTML = `
        <div class="result-summary">
            <div class="main-label">单件主面料用量</div>
            <div class="main-value">${data.main_fabric.per_piece_length_m} 米</div>
            <div class="sub-values">
                <div class="sub-item">
                    <div class="sub-label">总用料长度</div>
                    <div class="sub-value">${data.main_fabric.total_length_m} 米</div>
                </div>
                <div class="sub-item">
                    <div class="sub-label">面料利用率</div>
                    <div class="sub-value">${data.utilization_rate}%</div>
                </div>
                <div class="sub-item">
                    <div class="sub-label">损耗率</div>
                    <div class="sub-value">${data.wastage_rate}%</div>
                </div>
                <div class="sub-item">
                    <div class="sub-label">缩水率</div>
                    <div class="sub-value">${data.shrinkage_rate}%</div>
                </div>
            </div>
        </div>
    `;

    // 明细
    const detailCard = document.getElementById('quick-detail-card');
    const detailContent = document.getElementById('quick-detail-content');
    detailCard.style.display = 'block';

    let detailHTML = `
        <div class="quick-detail-section">
            <h4>🧵 主面料</h4>
            <div class="quick-detail-row">
                <span>单件用量</span>
                <strong>${data.main_fabric.per_piece_length_m} 米</strong>
            </div>
            <div class="quick-detail-row">
                <span>总用量 (${data.params.quantity}件)</span>
                <strong>${data.main_fabric.total_length_m} 米</strong>
            </div>
            ${data.main_fabric.total_weight_kg > 0 ? `
            <div class="quick-detail-row">
                <span>面料总重</span>
                <strong>${data.main_fabric.total_weight_kg} kg</strong>
            </div>
            ` : ''}
        </div>
    `;

    if (data.lining) {
        detailHTML += `
            <div class="quick-detail-section">
                <h4>🪡 里布</h4>
                <div class="quick-detail-row">
                    <span>单件用量</span>
                    <strong>${data.lining.per_piece_length_m} 米</strong>
                </div>
                <div class="quick-detail-row">
                    <span>总用量 (${data.params.quantity}件)</span>
                    <strong>${data.lining.total_length_m} 米</strong>
                </div>
            </div>
        `;
    }

    if (data.filling_fabric) {
        detailHTML += `
            <div class="quick-detail-section">
                <h4>🧶 胆料（双层）</h4>
                <div class="quick-detail-row">
                    <span>单件用量</span>
                    <strong>${data.filling_fabric.per_piece_length_m} 米</strong>
                </div>
                <div class="quick-detail-row">
                    <span>总用量 (${data.params.quantity}件)</span>
                    <strong>${data.filling_fabric.total_length_m} 米</strong>
                </div>
            </div>
        `;
    }

    if (data.warnings && data.warnings.length > 0) {
        detailHTML += `<div class="warnings">`;
        data.warnings.forEach(w => {
            detailHTML += `<div class="warning-item">⚠️ ${w}</div>`;
        });
        detailHTML += `</div>`;
    }

    detailContent.innerHTML = detailHTML;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}
