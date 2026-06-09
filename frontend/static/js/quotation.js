/**
 * 面料用量快速计算系统 - 报价管理页面
 */

let consumptionData = null;
let lastQuotationResult = null;

document.addEventListener('DOMContentLoaded', () => {
    const stored = sessionStorage.getItem('consumptionData');
    if (stored) {
        try {
            consumptionData = normalizeConsumptionData(JSON.parse(stored));
            renderConsumptionInfo(consumptionData);
        } catch (e) {
            console.error('解析用量数据失败:', e);
            renderConsumptionInfo(null);
        }
    } else {
        renderConsumptionInfo(null);
    }
});

function normalizeConsumptionData(raw) {
    const record = raw?.full_result ? raw : {};
    const full = record.full_result || raw || {};
    const inputData = record.input_data || {};
    const params = {
        ...(record.params || {}),
        ...(inputData || {}),
        ...(full.params || {}),
    };
    const fabrics = params.fabrics || inputData.fabrics || full.fabrics || [];
    const breakdown = normalizeMaterialBreakdown(full);
    const materials = [];

    if (fabrics.length) {
        const breakdownEntries = Object.entries(breakdown);
        fabrics.forEach((fabric, index) => {
            const id = String(fabric.id || fabric.material || `fabric_${index + 1}`);
            const calculated = breakdown[id]
                || breakdownEntries.find(([, item]) => item.name === fabric.name || item.material_name === fabric.name)?.[1]
                || breakdownEntries[index]?.[1]
                || {};
            materials.push({
                material_type: id,
                name: fabric.name || calculated.name || id,
                length_m: numberOrZero(
                    calculated.length_m ??
                    calculated.per_piece_length_m ??
                    calculated.production_length_m
                ),
                weight_g: numberOrZero(calculated.weight_g),
                weight_kg: numberOrZero(calculated.weight_kg),
                pricing_unit: isWeightMaterial(id) ? 'g' : 'm',
            });
        });
    } else {
        Object.entries(breakdown).forEach(([id, material]) => {
            materials.push({
                material_type: id,
                name: material.name || material.material_name || id,
                length_m: numberOrZero(
                    material.length_m ??
                    material.per_piece_length_m ??
                    material.production_length_m
                ),
                weight_g: numberOrZero(material.weight_g),
                weight_kg: numberOrZero(material.weight_kg),
                pricing_unit: isWeightMaterial(id) ? 'g' : 'm',
            });
        });
    }

    return {
        ...full,
        params: {
            ...params,
            category: params.category || record.category || raw.category || 'custom',
            quantity: positiveNumber(params.quantity || record.result?.quantity || raw.quantity, 100),
            fabrics,
        },
        material_breakdown: Object.fromEntries(materials.map(material => [
            material.material_type,
            {
                name: material.name,
                length_m: material.length_m,
                weight_g: material.weight_g,
                weight_kg: material.weight_kg,
            },
        ])),
        quotation_materials: materials,
    };
}

function normalizeMaterialBreakdown(full) {
    if (full.material_breakdown && Object.keys(full.material_breakdown).length) {
        return full.material_breakdown;
    }
    if (full.material_totals && Object.keys(full.material_totals).length) {
        return full.material_totals;
    }
    if (Array.isArray(full.nesting_groups)) {
        return Object.fromEntries(full.nesting_groups.map((group, index) => {
            const id = group.material || `fabric_${index + 1}`;
            return [id, {
                ...group,
                name: group.material_name || group.name || id,
                length_m: group.per_piece_length_m ?? group.production_length_m ?? group.length_m,
            }];
        }));
    }
    return {};
}

function renderConsumptionInfo(data) {
    const container = document.getElementById('quotation-consumption-info');
    if (!data) {
        container.innerHTML = '<p class="empty-hint">暂无用量数据，请先完成用量计算</p>';
        updatePricingTable(null);
        return;
    }

    const materials = data.quotation_materials || [];
    const quantityInput = document.getElementById('quotation-quantity');
    if (quantityInput) quantityInput.value = data.params.quantity;
    container.innerHTML = `
        <div class="info-row"><span class="info-label">品类</span><span class="info-value">${escapeHtml(getCategoryName(data.params?.category))}</span></div>
        <div class="info-row"><span class="info-label">面料种类</span><span class="info-value">${materials.length} 种</span></div>
        <div class="info-row"><span class="info-label">报价数量</span><span class="info-value">${data.params.quantity} 件</span></div>
        ${materials.map(material => `
            <div class="info-row">
                <span class="info-label">${escapeHtml(material.name)}</span>
                <span class="info-value">${formatMaterialUsage(material)}</span>
            </div>
        `).join('')}
    `;
    updatePricingTable(data);
}

function updatePricingTable(data) {
    const tbody = document.getElementById('pricing-tbody');
    const materials = data?.quotation_materials || [];
    tbody.innerHTML = materials.length
        ? materials.map(material => createPricingRow(material)).join('')
        : '<tr><td colspan="4" class="empty-row">请先从计算结果或历史记录进入报价管理</td></tr>';
}

function createPricingRow(material) {
    const isWeight = material.pricing_unit === 'g';
    const priceField = isWeight ? 'unit_price_per_g' : 'unit_price_per_m';
    const unitLabel = isWeight ? '元/克' : '元/米';
    return `
        <tr data-material-type="${escapeAttr(material.material_type)}">
            <td>
                <input type="text" class="inline-input pricing-material-name" value="${escapeAttr(material.name)}" data-type="${escapeAttr(material.material_type)}" data-field="name" readonly>
            </td>
            <td class="pricing-usage">
                <strong>${formatMaterialUsage(material)}</strong>
                <input type="hidden" data-field="length_m" value="${material.length_m}">
                <input type="hidden" data-field="weight_g" value="${material.weight_g}">
            </td>
            <td>
                <input type="number" class="inline-input" placeholder="0.00" data-type="${escapeAttr(material.material_type)}" data-field="${priceField}" step="0.01" min="0">
                <span class="pricing-unit">${unitLabel}</span>
            </td>
            <td><input type="text" class="inline-input" placeholder="供应商名称" data-type="${escapeAttr(material.material_type)}" data-field="supplier"></td>
        </tr>
    `;
}

function collectPricingData() {
    const materials = [];
    document.querySelectorAll('#pricing-tbody tr').forEach(row => {
        const type = row.querySelector('[data-field="name"]')?.dataset.type || 'custom';
        const name = row.querySelector('[data-field="name"]')?.value || '';
        const unitPricePerM = parseFloat(row.querySelector('[data-field="unit_price_per_m"]')?.value) || 0;
        const unitPricePerG = parseFloat(row.querySelector('[data-field="unit_price_per_g"]')?.value) || 0;
        const lengthM = parseFloat(row.querySelector('[data-field="length_m"]')?.value) || 0;
        const weightG = parseFloat(row.querySelector('[data-field="weight_g"]')?.value) || 0;
        const supplier = row.querySelector('[data-field="supplier"]')?.value || '';

        if (name) {
            materials.push({
                material_type: type,
                name: name,
                unit_price_per_m: unitPricePerM,
                unit_price_per_g: unitPricePerG,
                length_m: lengthM,
                weight_g: weightG,
                supplier: supplier,
            });
        }
    });
    return materials;
}

async function calculateQuotation() {
    if (!consumptionData) {
        alert('暂无用量数据，请先完成用量计算');
        return;
    }
    if (!consumptionData.quotation_materials?.length) {
        alert('当前计算结果没有可报价的面料数据');
        return;
    }

    const pricingData = {
        materials: collectPricingData(),
        labor_cost_per_piece: readNumber('labor-cost', 0),
        accessories_cost_per_piece: readNumber('accessories-cost', 0),
        packaging_cost_per_piece: readNumber('packaging-cost', 0),
        other_cost_per_piece: readNumber('other-cost', 0),
        profit_margin_percent: readNumber('profit-margin', 15),
        tax_rate_percent: readNumber('tax-rate', 13),
        quantity: positiveNumber(document.getElementById('quotation-quantity')?.value, 100),
    };

    showLoading(true);
    try {
        const resp = await fetch('/api/quotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consumption_data: consumptionData,
                pricing_data: pricingData,
            }),
        });
        const result = await resp.json();
        if (result.success) {
            lastQuotationResult = result.data;
            renderQuotationResult(result.data);
        } else {
            alert('计算失败: ' + result.message);
        }
    } catch (e) {
        alert('请求失败: ' + e.message);
    } finally {
        showLoading(false);
    }
}

function formatMaterialUsage(material) {
    if (material.pricing_unit === 'g') {
        return `${formatNumber(material.weight_g)} 克/件`;
    }
    return `${formatNumber(material.length_m, 3)} 米/件`;
}

function formatNumber(value, digits = 2) {
    return numberOrZero(value).toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    });
}

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function readNumber(elementId, fallback) {
    const value = document.getElementById(elementId)?.value;
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function isWeightMaterial(materialType) {
    return materialType === 'down_filling' || materialType === 'cotton_filling';
}

function getCategoryName(category) {
    return window.DictManager?.getCategoryName
        ? DictManager.getCategoryName(category, category)
        : (category || '-');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function renderQuotationResult(data) {
    const resultCard = document.getElementById('quotation-result-card');
    const resultContent = document.getElementById('quotation-result-content');
    resultCard.style.display = 'block';

    resultContent.innerHTML = `
        <div class="quotation-result">
            <div class="quotation-price-label">含税单价</div>
            <div class="quotation-price">¥${data.price_with_tax}</div>
            <div class="quotation-total">总金额: ¥${data.total_amount.toLocaleString()} (${data.quantity}件)</div>
        </div>

        <div class="quotation-detail-grid">
            <div class="quotation-detail-item">
                <div class="detail-label">单件材料成本</div>
                <div class="detail-value">¥${data.per_piece_material_cost}</div>
            </div>
            <div class="quotation-detail-item">
                <div class="detail-label">加工费</div>
                <div class="detail-value">¥${data.labor_cost_per_piece}</div>
            </div>
            <div class="quotation-detail-item">
                <div class="detail-label">辅料费</div>
                <div class="detail-value">¥${data.accessories_cost_per_piece}</div>
            </div>
            <div class="quotation-detail-item">
                <div class="detail-label">包装费</div>
                <div class="detail-value">¥${data.packaging_cost_per_piece}</div>
            </div>
            <div class="quotation-detail-item">
                <div class="detail-label">单件总成本</div>
                <div class="detail-value">¥${data.per_piece_total_cost}</div>
            </div>
            <div class="quotation-detail-item">
                <div class="detail-label">利润 (${data.profit_margin_percent}%)</div>
                <div class="detail-value">¥${data.profit_per_piece}</div>
            </div>
            <div class="quotation-detail-item">
                <div class="detail-label">税前单价</div>
                <div class="detail-value">¥${data.price_before_tax}</div>
            </div>
            <div class="quotation-detail-item">
                <div class="detail-label">税额 (${data.tax_rate_percent}%)</div>
                <div class="detail-value">¥${data.tax_per_piece}</div>
            </div>
        </div>

        <div style="margin-top:16px;">
            <h4 style="font-size:14px;margin-bottom:8px;">材料成本明细</h4>
            ${data.material_costs.map(mc => `
                <div class="quick-detail-row">
                    <span>
                        ${escapeHtml(mc.name)} ${mc.supplier ? '(' + escapeHtml(mc.supplier) + ')' : ''}
                        <small class="material-cost-formula">
                            ${mc.weight_g > 0 ? `${formatNumber(mc.weight_g)}克/件` : `${formatNumber(mc.length_m, 3)}米/件`}
                            × ${escapeHtml(mc.unit_price_desc)}
                        </small>
                    </span>
                    <span class="material-cost-values">
                        <strong>¥${mc.per_piece_cost}/件</strong>
                        <small>订单合计 ¥${mc.total_cost}</small>
                    </span>
                </div>
            `).join('')}
            <div class="quick-detail-row" style="border-top:1px solid #e2e8f0;margin-top:4px;padding-top:8px;">
                <span><strong>材料成本合计</strong></span>
                <strong>¥${data.total_material_cost}</strong>
            </div>
        </div>
    `;

    // 成本构成图
    renderCostBreakdown(data);
}

function renderCostBreakdown(data) {
    const breakdownCard = document.getElementById('quotation-cost-breakdown');
    const chartContainer = document.getElementById('cost-breakdown-chart');
    breakdownCard.style.display = 'block';

    const items = [
        { label: '材料成本', value: data.per_piece_material_cost, color: '#2563eb' },
        { label: '加工费', value: data.labor_cost_per_piece, color: '#16a34a' },
        { label: '辅料费', value: data.accessories_cost_per_piece, color: '#d97706' },
        { label: '包装费', value: data.packaging_cost_per_piece, color: '#8b5cf6' },
        { label: '利润', value: data.profit_per_piece, color: '#dc2626' },
        { label: '税额', value: data.tax_per_piece, color: '#64748b' },
    ];

    const total = data.price_with_tax;

    chartContainer.innerHTML = items.map(item => {
        const percent = total > 0 ? (item.value / total * 100) : 0;
        return `
            <div class="cost-bar-item">
                <div class="cost-bar-label">
                    <span>${item.label}</span>
                    <span>¥${item.value} (${percent.toFixed(1)}%)</span>
                </div>
                <div class="cost-bar">
                    <div class="cost-bar-fill" style="width:${percent}%;background:${item.color};">
                        ${percent > 8 ? percent.toFixed(1) + '%' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function exportQuotation() {
    if (!lastQuotationResult || !consumptionData) return;
    const text = generateQuotationText(lastQuotationResult, consumptionData);
    downloadText(text, `报价单_${new Date().toISOString().slice(0,10)}.txt`);
}

function generateQuotationText(data, consData) {
    let text = '========================================\n';
    text += '           报 价 单\n';
    text += '========================================\n';
    text += `日期: ${new Date().toLocaleDateString()}\n`;
    text += `数量: ${data.quantity} 件\n\n`;

    text += '--- 材料成本 ---\n';
    data.material_costs.forEach(mc => {
        text += `${mc.name}: ¥${mc.total_cost}`;
        if (mc.supplier) text += ` (${mc.supplier})`;
        text += '\n';
    });
    text += `材料成本合计: ¥${data.total_material_cost}\n`;
    text += `单件材料成本: ¥${data.per_piece_material_cost}\n\n`;

    text += '--- 其他费用 (单件) ---\n';
    text += `加工费: ¥${data.labor_cost_per_piece}\n`;
    text += `辅料费: ¥${data.accessories_cost_per_piece}\n`;
    text += `包装费: ¥${data.packaging_cost_per_piece}\n`;
    text += `其他费用: ¥${data.other_cost_per_piece}\n`;
    text += `单件总成本: ¥${data.per_piece_total_cost}\n\n`;

    text += '--- 报价 ---\n';
    text += `利润率: ${data.profit_margin_percent}%\n`;
    text += `利润: ¥${data.profit_per_piece}/件\n`;
    text += `税前单价: ¥${data.price_before_tax}\n`;
    text += `税率: ${data.tax_rate_percent}%\n`;
    text += `税额: ¥${data.tax_per_piece}/件\n`;
    text += `含税单价: ¥${data.price_with_tax}\n`;
    text += `总金额: ¥${data.total_amount.toLocaleString()}\n`;
    text += '========================================\n';

    return text;
}

function printQuotation() {
    window.print();
}

function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}
