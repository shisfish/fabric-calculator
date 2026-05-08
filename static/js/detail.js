/**
 * 面料用量快速计算系统 - 详情页面
 */

// 当前记录数据（用于导出和报价）
let currentRecord = null;
let currentRecordType = 'precise';

document.addEventListener('DOMContentLoaded', () => {
    loadDetail();
});

async function loadDetail() {
    try {
        const resp = await fetch(`/api/history/${RECORD_ID}`);
        const data = await resp.json();

        if (!data.success) {
            showError(data.message || '记录不存在');
            return;
        }

        renderDetail(data.data);
    } catch (e) {
        showError('加载失败: ' + e.message);
    }
}

function showError(msg) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('error-msg').textContent = msg;
}

function renderDetail(record) {
    currentRecord = record;
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('detail-content').style.display = 'block';

    const topActions = document.getElementById('top-actions');
    topActions.style.display = 'flex';

    const isPrecise = record.type === 'precise';
    const isCurved = record.type === 'curved';
    currentRecordType = record.type || 'precise';
    const typeLabel = isCurved ? '曲线计算' : (isPrecise ? '精确计算' : '快速估算');
    const categoryName = DictManager.getCategoryName(record.category, record.category);

    document.getElementById('detail-title').textContent = `${typeLabel} - ${categoryName}`;
    document.getElementById('detail-subtitle').textContent = `记录时间: ${record.timestamp}`;

    if ((isPrecise || isCurved) && record.input_data) {
        document.getElementById('btn-edit').style.display = '';
    }
    document.getElementById('btn-export').style.display = '';
    document.getElementById('btn-quotation').style.display = '';

    renderInfoCardCompact(record, isPrecise || isCurved, categoryName);

    if (isCurved || isPrecise) {
        renderPreciseResult(record);
    } else {
        renderQuickResult(record);
    }
}

function renderInfoCardCompact(record, isPrecise, categoryName) {
    const grid = document.getElementById('info-grid');
    const params = record.params || {};

    let html = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">记录ID</span>
            <strong style="font-size:14px;">${record.id}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">计算类型</span>
            <strong style="font-size:14px;">${isPrecise ? (record.type === 'curved' ? '曲线计算' : '精确计算') : '快速估算'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">服装品类</span>
            <strong style="font-size:14px;">${categoryName}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">记录时间</span>
            <strong style="font-size:14px;">${record.timestamp}</strong>
        </div>
    `;

    if (params.fabric_width) {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料门幅</span>
            <strong style="font-size:14px;">${params.fabric_width} cm</strong>
        </div>`;
    }
    if (params.quantity) {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">订单数量</span>
            <strong style="font-size:14px;">${params.quantity} 件</strong>
        </div>`;
    }
    if (params.fabric_weight_gsm) {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料克重</span>
            <strong style="font-size:14px;">${params.fabric_weight_gsm} g/m²</strong>
        </div>`;
    }
    if (params.shrinkage_rate !== undefined) {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">缩水率</span>
            <strong style="font-size:14px;">${params.shrinkage_rate}%</strong>
        </div>`;
    }
    if (params.wastage_rate !== undefined) {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">损耗率</span>
            <strong style="font-size:14px;">${params.wastage_rate}%</strong>
        </div>`;
    }
    if (params.garment_length) {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">衣长</span>
            <strong style="font-size:14px;">${params.garment_length} cm</strong>
        </div>`;
    }
    if (params.chest) {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">胸围</span>
            <strong style="font-size:14px;">${params.chest} cm</strong>
        </div>`;
    }

    grid.innerHTML = html;
}

function editRecord() {
    const type = currentRecordType;
    const targetPage = type === 'curved' ? '/curves' : '/';
    window.location.href = `${targetPage}?edit=${RECORD_ID}`;
}

function exportDetailResult() {
    if (!currentRecord || !currentRecord.full_result) {
        alert('暂无结果可导出');
        return;
    }
    const data = currentRecord.full_result;
    let text = '=== 面料用量计算结果 ===\n\n';
    text += `品类: ${data.params.category}\n`;
    text += `面料门幅: ${data.params.fabric_width}cm\n`;
    text += `面料克重: ${data.params.fabric_weight_gsm} g/m²\n`;
    text += `缩水率: ${data.params.shrinkage_rate}%\n`;
    text += `损耗率: ${data.params.wastage_rate}%\n`;
    text += `订单数量: ${data.params.quantity}件\n`;
    text += `面料利用率: ${data.utilization_rate}%\n\n`;
    text += '--- 计算结果 ---\n';
    text += `单件用料长度: ${data.per_piece_length_m} 米\n`;
    text += `总用料长度: ${data.total_length_m} 米\n`;
    text += `总面积: ${data.total_area_m2} m²\n`;
    if (data.fabric_weight_kg > 0) {
        text += `面料总重: ${data.fabric_weight_kg} kg\n`;
    }
    text += '\n--- 裁片明细 ---\n';
    data.pieces_detail.forEach(p => {
        text += `${p.name}: ${p.original_length}×${p.original_width}cm × ${p.count} = ${p.area_with_shrinkage_cm2}cm²\n`;
    });
    text += '\n--- 材料汇总 ---\n';
    Object.entries(data.material_breakdown || {}).forEach(([key, val]) => {
        text += `${val.name}: ${val.length_m}米`;
        if (val.weight_kg > 0) text += ` / ${val.weight_kg}kg`;
        text += '\n';
    });
    if (data.warnings && data.warnings.length > 0) {
        text += '\n--- 注意事项 ---\n';
        data.warnings.forEach(w => text += `⚠️ ${w}\n`);
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `用量计算_${currentRecord.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function goToQuotationFromDetail() {
    if (currentRecord && currentRecord.full_result) {
        sessionStorage.setItem('consumptionData', JSON.stringify(currentRecord.full_result));
    }
    window.location.href = '/quotation';
}

function renderPreciseResult(record) {
    const area = document.getElementById('precise-result-area');
    area.style.display = 'block';

    const fullResult = record.full_result;
    if (!fullResult) {
        area.innerHTML = `<div class="warnings"><div class="warning-item">⚠️ 无法重新计算完整结果: ${record.calc_error || '未知错误'}</div></div>`;
        return;
    }

    const matCards = document.getElementById('result-material-cards');
    const matBreakdown = fullResult.material_breakdown || {};
    matCards.innerHTML = Object.entries(matBreakdown).map(([key, val]) => `
        <div class="card" style="border-left:4px solid #3b82f6;">
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

    const warningsEl = document.getElementById('result-warnings');
    if (fullResult.warnings && fullResult.warnings.length > 0) {
        warningsEl.style.display = 'block';
        warningsEl.innerHTML = fullResult.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('');
    } else {
        warningsEl.style.display = 'none';
    }

    const piecesTbody = document.getElementById('result-pieces-tbody');
    const pieces = fullResult.pieces_detail || [];

    const hasShoulder = pieces.some(p => p.shoulder_width);
    const hasBicep = pieces.some(p => p.bicep_width);
    const hasCuff = pieces.some(p => p.cuff_width);
    document.getElementById('th-shoulder').style.display = hasShoulder ? '' : 'none';
    document.getElementById('th-bicep').style.display = hasBicep ? '' : 'none';
    document.getElementById('th-cuff').style.display = hasCuff ? '' : 'none';

    piecesTbody.innerHTML = pieces.map(p => {
        let methodCell = '';
        if (p.calc_method === 'curved') {
            methodCell = `<span class="badge" style="background:#e8f5e9;color:#2e7d32;">曲线</span>`;
            if (p.difference_cm2 !== undefined) {
                const diff = p.difference_cm2;
                const pct = p.difference_percent;
                if (diff > 0) {
                    methodCell += `<br><span style="font-size:11px;color:#2e7d32;">省${diff}cm² (${pct}%)</span>`;
                } else if (diff < 0) {
                    methodCell += `<br><span style="font-size:11px;color:#e65100;">增${Math.abs(diff)}cm² (${Math.abs(pct)}%)</span>`;
                }
            }
        } else {
            methodCell = `<span style="color:#999;font-size:12px;">${p.calc_method || '矩形'}</span>`;
        }

        return `
        <tr>
            <td>${p.name}</td>
            <td>${p.original_length} × ${p.original_width}</td>
            <td>${p.effective_length} × ${p.effective_width}</td>
            <td>${p.count}</td>
            <td>${methodCell}</td>
            <td>${p.area_cm2}</td>
            <td>${p.area_with_shrinkage_cm2}</td>
            <td>${DictManager.getMaterialName(p.material, p.material)}</td>
            <td style="${hasShoulder ? '' : 'display:none'}">${p.shoulder_width || '-'}</td>
            <td style="${hasBicep ? '' : 'display:none'}">${p.bicep_width || '-'}</td>
            <td style="${hasCuff ? '' : 'display:none'}">${p.cuff_width || '-'}</td>
        </tr>`;
    }).join('');
}

function renderQuickResult(record) {
    const area = document.getElementById('quick-result-area');
    area.style.display = 'block';

    const fullResult = record.full_result;
    if (!fullResult) {
        area.innerHTML = `<div class="warnings"><div class="warning-item">⚠️ 无法重新计算完整结果: ${record.calc_error || '未知错误'}</div></div>`;
        return;
    }

    const mainFabric = fullResult.main_fabric || fullResult.main_fabric || {};
    const lining = fullResult.lining || {};

    const resultHtml = `
        <div class="two-column">
            <div class="column">
                <div class="card">
                    <h3>📊 估算结果概览</h3>
                    <div class="result-summary">
                        <div class="main-label">单件主面料用量</div>
                        <div class="main-value">${mainFabric.per_piece_length_m} 米</div>
                        <div class="sub-values">
                            <div class="sub-item">
                                <div class="sub-label">总用料长度</div>
                                <div class="sub-value">${mainFabric.total_length_m} 米</div>
                            </div>
                            <div class="sub-item">
                                <div class="sub-label">面料利用率</div>
                                <div class="sub-value">${fullResult.utilization_rate}%</div>
                            </div>
                            <div class="sub-item">
                                <div class="sub-label">损耗率</div>
                                <div class="sub-value">${fullResult.wastage_rate}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="column">
                <div class="card">
                    <h3>📐 材料用量明细</h3>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border-color);">
                            <span>主面料</span>
                            <strong>${mainFabric.per_piece_length_m} 米/件</strong>
                        </div>
                        ${lining.per_piece_length_m ? `
                        <div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border-color);">
                            <span>里布</span>
                            <strong>${lining.per_piece_length_m} 米/件</strong>
                        </div>
                        ` : ''}
                        <div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border-color);">
                            <span>缩水率</span>
                            <strong>${fullResult.shrinkage_rate}%</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    area.innerHTML = resultHtml;
}
