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
        shrinkage_rate: parseFloat(document.getElementById('q-shrinkage-rate').value) || 3,
        wastage_rate: parseFloat(document.getElementById('q-wastage-rate').value) || 8,
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

const CATEGORY_NAMES = {
    coat: "大衣",
    down_jacket: "羽绒服",
    jacket: "夹克",
    windbreaker: "风衣",
    cotton_padded: "棉服",
    pants: "裤子",
    skirt: "裙子",
    shirt: "衬衫",
    tshirt: "T恤",
};

function renderQuickResult(data) {
    // 基本信息
    const infoCard = document.getElementById('quick-result-info-card');
    const infoGrid = document.getElementById('quick-result-info-grid');
    infoCard.style.display = 'block';

    const params = data.params || {};
    infoGrid.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">服装品类</span>
            <strong style="font-size:14px;">${CATEGORY_NAMES[params.category] || params.category || '-'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料门幅</span>
            <strong style="font-size:14px;">${params.fabric_width} cm</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">订单数量</span>
            <strong style="font-size:14px;">${params.quantity} 件</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">缩水率</span>
            <strong style="font-size:14px;">${params.shrinkage_rate}%</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">损耗率</span>
            <strong style="font-size:14px;">${params.wastage_rate}%</strong>
        </div>
        ${params.fabric_weight_gsm ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料克重</span>
            <strong style="font-size:14px;">${params.fabric_weight_gsm} g/m²</strong>
        </div>
        ` : ''}
    `;

    // 材料分类汇总
    const matCards = document.getElementById('quick-result-material-cards');
    const matContent = document.getElementById('quick-material-cards-content');
    matCards.style.display = 'block';

    const matBreakdown = data.material_breakdown || {};
    matContent.innerHTML = Object.entries(matBreakdown).map(([key, val]) => `
        <div class="card" style="border-left:4px solid #3b82f6;margin:0;">
            <div style="font-size:16px;font-weight:600;margin-bottom:10px;">${val.name}</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                    <div style="font-size:12px;color:var(--text-secondary);">面积</div>
                    <div style="font-size:15px;font-weight:600;">${val.area_m2} m²</div>
                </div>
                <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                    <div style="font-size:12px;color:var(--text-secondary);">用料长度</div>
                    <div style="font-size:15px;font-weight:600;">${val.length_m} m</div>
                </div>
                <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;${val.weight_kg > 0 ? '' : 'display:none;'}">
                    <div style="font-size:12px;color:var(--text-secondary);">重量</div>
                    <div style="font-size:15px;font-weight:600;">${val.weight_kg} kg</div>
                </div>
                <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                    <div style="font-size:12px;color:var(--text-secondary);">门幅利用率</div>
                    <div style="font-size:15px;font-weight:600;">${val.width_utilization ? (val.width_utilization * 100).toFixed(1) + '%' : '-'}</div>
                </div>
            </div>
        </div>
    `).join('');

    // 警告信息
    const warningsEl = document.getElementById('quick-result-warnings');
    if (data.warnings && data.warnings.length > 0) {
        warningsEl.style.display = 'block';
        warningsEl.innerHTML = data.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('');
    } else {
        warningsEl.style.display = 'none';
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}
