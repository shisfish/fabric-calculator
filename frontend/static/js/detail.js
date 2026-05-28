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
    const isPolygon = record.type === 'polygon';
    const isCad = record.type === 'cad';
    currentRecordType = record.type || 'precise';
    
    let typeLabel = '快速估算';
    if (isCurved) typeLabel = '曲线计算';
    else if (isPrecise) typeLabel = '精确计算';
    else if (isPolygon) typeLabel = '多边形排料';
    else if (isCad) typeLabel = 'CAD排料';
    
    const categoryName = DictManager.getCategoryName(record.category, record.category);

    document.getElementById('detail-title').textContent = `${typeLabel} - ${categoryName}`;
    document.getElementById('detail-subtitle').textContent = `记录时间: ${record.timestamp}`;

    if ((isPrecise || isCurved || isPolygon || isCad) && record.input_data) {
        document.getElementById('btn-edit').style.display = '';
    }
    document.getElementById('btn-export').style.display = '';
    document.getElementById('btn-quotation').style.display = '';

    renderInfoCardCompact(record, isPrecise || isCurved || isPolygon || isCad, categoryName);

    if (isCurved || isPrecise) {
        renderPreciseResult(record);
    } else if (isPolygon) {
        renderPolygonResult(record);
    } else if (isCad) {
        renderCadResult(record);
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
    if (params.wastage_rate !== undefined || data.calculated_wastage_rate !== undefined) {
        const wastageValue = data.calculated_wastage_rate !== undefined ? data.calculated_wastage_rate : params.wastage_rate;
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">计算损耗率</span>
            <strong style="font-size:14px;">${typeof wastageValue === 'number' ? wastageValue.toFixed(1) + '%' : wastageValue + '%'}</strong>
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
    let targetPage = '/';
    
    if (type === 'curved') {
        targetPage = '/curves';
    } else if (type === 'polygon') {
        targetPage = '/polygon-nesting';
    } else if (type === 'cad') {
        targetPage = '/cad';
    }
    
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
    if (data.calculated_wastage_rate !== undefined) {
        text += `计算损耗率: ${data.calculated_wastage_rate}%\n`;
    } else if (data.params.wastage_rate !== undefined) {
        text += `损耗率: ${data.params.wastage_rate}%\n`;
    }
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

    // ✅ 【新增】渲染精确计算的图片（裁片图、缝份图、排料图）
    renderCalcImages(record);
}

function renderCalcImages(record) {
    const imagesSection = document.getElementById('calc-images-section');
    const pieceImagesEl = document.getElementById('calc-piece-images');
    const seamImagesEl = document.getElementById('calc-seam-images');
    const nestingImagesEl = document.getElementById('calc-nesting-images');

    // 获取图片数据（优先从record获取，如果没有则尝试full_result）
    const piece_images = record.piece_images || [];
    const seam_images = record.seam_images || [];
    const nesting_images = record.nesting_images || [];

    // 检查是否有任何图片
    const hasImages = piece_images.length > 0 || seam_images.length > 0 || nesting_images.length > 0;

    if (!hasImages) {
        imagesSection.style.display = 'none';
        return;
    }

    imagesSection.style.display = 'block';

    // 渲染裁片图
    if (piece_images.length > 0) {
        pieceImagesEl.style.display = 'flex';
        pieceImagesEl.innerHTML = `
            <h4 style="font-size:15px;font-weight:600;margin-bottom:12px;color:#1976d2;">✂️ 裁片图</h4>
            ${piece_images.map(img => `
                <div class="card" style="padding:16px;">
                    <div style="font-size:14px;font-weight:600;margin-bottom:8px;">${img.name || '裁片图'}</div>
                    <img src="${img.file_path}" alt="${img.name || '裁片图'}" 
                         style="max-width:100%;border:1px solid var(--border-color);border-radius:4px;cursor:pointer;"
                         onclick="window.open('${img.file_path}', '_blank')">
                </div>
            `).join('')}
        `;
    } else {
        pieceImagesEl.style.display = 'none';
    }

    // 渲染缝份图
    if (seam_images.length > 0) {
        seamImagesEl.style.display = 'flex';
        seamImagesEl.innerHTML = `
            <h4 style="font-size:15px;font-weight:600;margin-bottom:12px;color:#388e3c;">🧵 缝份图</h4>
            ${seam_images.map(img => `
                <div class="card" style="padding:16px;">
                    <div style="font-size:14px;font-weight:600;margin-bottom:8px;">${img.name || '缝份图'}</div>
                    <img src="${img.file_path}" alt="${img.name || '缝份图'}" 
                         style="max-width:100%;border:1px solid var(--border-color);border-radius:4px;cursor:pointer;"
                         onclick="window.open('${img.file_path}', '_blank')">
                </div>
            `).join('')}
        `;
    } else {
        seamImagesEl.style.display = 'none';
    }

    // 渲染排料图
    if (nesting_images.length > 0) {
        nestingImagesEl.style.display = 'flex';
        nestingImagesEl.innerHTML = `
            <h4 style="font-size:15px;font-weight:600;margin-bottom:12px;color:#d32f2f;">📐 排料图</h4>
            ${nesting_images.map(img => `
                <div class="card" style="padding:16px;">
                    <div style="font-size:14px;font-weight:600;margin-bottom:8px;">${img.material_name || '排料图'}</div>
                    <img src="${img.file_path}" alt="${img.material_name || '排料图'}" 
                         style="max-width:100%;border:1px solid var(--border-color);border-radius:4px;cursor:pointer;"
                         onclick="window.open('${img.file_path}', '_blank')">
                </div>
            `).join('')}
        `;
    } else {
        nestingImagesEl.style.display = 'none';
    }
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
                            ${fullResult.calculated_wastage_rate !== undefined ? `
                            <div class="sub-item">
                                <div class="sub-label">计算损耗率</div>
                                <div class="sub-value">${fullResult.calculated_wastage_rate}%</div>
                            </div>
                            ` : (fullResult.wastage_rate !== undefined ? `
                            <div class="sub-item">
                                <div class="sub-label">损耗率</div>
                                <div class="sub-value">${fullResult.wastage_rate}%</div>
                            </div>
                            ` : '')}
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

function renderPolygonResult(record) {
    const area = document.getElementById('polygon-result-area');
    area.style.display = 'block';

    const fullResult = record.full_result;
    if (!fullResult) {
        area.innerHTML = `<div class="warnings"><div class="warning-item">⚠️ 无法重新计算完整结果: ${record.calc_error || '未知错误'}</div></div>`;
        return;
    }

    // 材料分类汇总
    const matCards = document.getElementById('polygon-material-cards');
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

    // 警告信息
    const warningsEl = document.getElementById('polygon-warnings');
    if (fullResult.warnings && fullResult.warnings.length > 0) {
        warningsEl.style.display = 'block';
        warningsEl.innerHTML = fullResult.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('');
    } else {
        warningsEl.style.display = 'none';
    }

    // 排料图
    const nestingImagesEl = document.getElementById('polygon-nesting-images');
    const nestingImages = fullResult.nesting_images || [];
    if (nestingImages.length > 0) {
        nestingImagesEl.innerHTML = nestingImages.map(img => `
            <div class="card" style="padding:16px;">
                <div style="font-size:14px;font-weight:600;margin-bottom:8px;">${img.material_name} 排料图</div>
                <img src="${img.file_path}" alt="${img.material_name}排料图" style="max-width:100%;border:1px solid var(--border-color);border-radius:4px;">
            </div>
        `).join('');
    } else {
        nestingImagesEl.innerHTML = '<p style="color:var(--text-secondary);">暂无排料图</p>';
    }

    // 裁片明细
    const piecesTbody = document.getElementById('polygon-pieces-tbody');
    const pieces = fullResult.pieces_detail || [];
    const materialNames = {
        'main': '主面料',
        'lining': '里布',
        'interlining': '衬布',
    };

    piecesTbody.innerHTML = pieces.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.original_length} × ${p.original_width}</td>
            <td>${p.effective_length} × ${p.effective_width}</td>
            <td>${p.count}</td>
            <td>${p.area_cm2}</td>
            <td>${p.area_with_shrinkage_cm2}</td>
            <td>${DictManager.getMaterialName(p.material, p.material)}</td>
        </tr>
    `).join('');
}

function renderCadResult(record) {
    const area = document.getElementById('cad-result-area');
    area.style.display = 'block';

    const fullResult = record.full_result;
    if (!fullResult) {
        area.innerHTML = `<div class="warnings"><div class="warning-item">⚠️ 无法重新计算完整结果: ${record.calc_error || '未知错误'}</div></div>`;
        return;
    }

    const params = fullResult.params || {};
    const measurements = params.measurements || {};
    const options = params.options || {};

    const measurementsGrid = document.getElementById('cad-measurements-grid');
    const measurementLabels = {
        chest: '胸围',
        waist: '腰围',
        hips: '臀围',
        neck: '领围',
        shoulderToShoulder: '肩宽',
        shoulderSlope: '肩斜(°)',
        biceps: '大臂围',
        wrist: '手腕围',
        hpsToWaistFront: '前颈点-腰',
        hpsToWaistBack: '后颈点-腰',
        waistToHips: '腰-臀',
    };
    
    measurementsGrid.innerHTML = Object.entries(measurementLabels).map(([key, label]) => {
        const value = measurements[key];
        if (value === undefined || value === null) return '';
        return `
            <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                <div style="font-size:12px;color:var(--text-secondary);">${label}</div>
                <div style="font-size:14px;font-weight:600;">${value} cm</div>
            </div>
        `;
    }).join('');

    const optionsGrid = document.getElementById('cad-options-grid');
    const optionLabels = {
        chestEase: '胸围松量',
        waistEase: '腰围松量',
        bicepsEase: '袖肥松量',
        collarEase: '领围松量',
    };
    
    optionsGrid.innerHTML = Object.entries(optionLabels).map(([key, label]) => {
        const value = options[key];
        if (value === undefined || value === null) return '';
        return `
            <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                <div style="font-size:12px;color:var(--text-secondary);">${label}</div>
                <div style="font-size:14px;font-weight:600;">${value}%</div>
            </div>
        `;
    }).join('');

    const matCards = document.getElementById('cad-material-cards');
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
                    <div style="font-size:12px;color:var(--text-secondary);">利用率</div>
                    <div style="font-size:15px;font-weight:600;">${(val.width_utilization * 100).toFixed(1)}%</div>
                </div>
            </div>
        </div>
    `).join('');

    const nestingSvg = document.getElementById('cad-nesting-svg');
    if (fullResult.nesting_svg) {
        nestingSvg.innerHTML = fullResult.nesting_svg;
    } else {
        nestingSvg.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">暂无排料图</p>';
    }

    const piecesTbody = document.getElementById('cad-pieces-tbody');
    const pieces = fullResult.pieces_detail || [];
    piecesTbody.innerHTML = pieces.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.original_length} × ${p.original_width}</td>
            <td>${p.count}</td>
            <td>${p.area_cm2}</td>
            <td>${p.area_with_shrinkage_cm2}</td>
            <td>${p.on_fold ? '是' : '否'}</td>
        </tr>
    `).join('');
}
