/**
 * 面料用量快速计算系统 - 报价管理页面
 */

let consumptionData = null;
let lastQuotationResult = null;

document.addEventListener('DOMContentLoaded', () => {
    // 从 sessionStorage 读取用量数据
    const stored = sessionStorage.getItem('consumptionData');
    if (stored) {
        try {
            consumptionData = JSON.parse(stored);
            renderConsumptionInfo(consumptionData);
        } catch (e) {
            console.error('解析用量数据失败:', e);
        }
    }
});

function renderConsumptionInfo(data) {
    const container = document.getElementById('quotation-consumption-info');
    if (!data) {
        container.innerHTML = '<p class="empty-hint">暂无用量数据，请先完成用量计算</p>';
        return;
    }

    const isQuick = data.method === '快速估算（经验公式法）';
    let html = '';

    if (isQuick) {
        html = `
            <div class="info-row"><span class="info-label">计算方式</span><span class="info-value">${data.method}</span></div>
            <div class="info-row"><span class="info-label">品类</span><span class="info-value">${data.category}</span></div>
            <div class="info-row"><span class="info-label">主面料单件用量</span><span class="info-value">${data.main_fabric.per_piece_length_m} 米</span></div>
            ${data.lining ? `<div class="info-row"><span class="info-label">里布单件用量</span><span class="info-value">${data.lining.per_piece_length_m} 米</span></div>` : ''}
            ${data.filling_fabric ? `<div class="info-row"><span class="info-label">胆料单件用量</span><span class="info-value">${data.filling_fabric.per_piece_length_m} 米</span></div>` : ''}
            <div class="info-row"><span class="info-label">订单数量</span><span class="info-value">${data.params.quantity} 件</span></div>
        `;
    } else {
        html = `
            <div class="info-row"><span class="info-label">品类</span><span class="info-value">${data.params.category}</span></div>
            <div class="info-row"><span class="info-label">面料门幅</span><span class="info-value">${data.params.fabric_width} cm</span></div>
            <div class="info-row"><span class="info-label">单件用料长度</span><span class="info-value">${data.per_piece_length_m} 米</span></div>
            <div class="info-row"><span class="info-label">总面积</span><span class="info-value">${data.total_area_m2} m²</span></div>
            <div class="info-row"><span class="info-label">面料利用率</span><span class="info-value">${data.utilization_rate}%</span></div>
            <div class="info-row"><span class="info-label">订单数量</span><span class="info-value">${data.params.quantity} 件</span></div>
        `;
    }

    container.innerHTML = html;

    // 根据用量数据动态更新材料价格表
    updatePricingTable(data);
}

function updatePricingTable(data) {
    const tbody = document.getElementById('pricing-tbody');
    let rows = '';

    if (data.method === '快速估算（经验公式法）') {
        rows += createPricingRow('main', '主面料', '元/米');
        if (data.lining) {
            rows += createPricingRow('lining', '里布', '元/米');
        }
        if (data.filling_fabric) {
            rows += createPricingRow('filling_fabric_double', '胆料（双层）', '元/米');
        }
    } else {
        const matBreakdown = data.material_breakdown || {};
        Object.entries(matBreakdown).forEach(([key, val]) => {
            if (key === 'down_filling' || key === 'cotton_filling') {
                rows += createPricingRow(key, val.name, '元/g', 'unit_price_per_g');
            } else {
                rows += createPricingRow(key, val.name, '元/米');
            }
        });
    }

    if (rows) {
        tbody.innerHTML = rows;
    }
}

function createPricingRow(type, name, unitLabel, priceField = 'unit_price_per_m') {
    return `
        <tr>
            <td><input type="text" class="inline-input" value="${name}" data-type="${type}" data-field="name"></td>
            <td><input type="number" class="inline-input" placeholder="0.00" data-type="${type}" data-field="${priceField}" step="0.01"> ${unitLabel}</td>
            <td><input type="text" class="inline-input" placeholder="供应商名称" data-type="${type}" data-field="supplier"></td>
        </tr>
    `;
}

function addPricingRow() {
    const tbody = document.getElementById('pricing-tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="inline-input" placeholder="材料名称" data-type="custom" data-field="name"></td>
        <td><input type="number" class="inline-input" placeholder="0.00" data-type="custom" data-field="unit_price_per_m" step="0.01"> 元/米</td>
        <td><input type="text" class="inline-input" placeholder="供应商名称" data-type="custom" data-field="supplier"></td>
    `;
    tbody.appendChild(row);
}

function collectPricingData() {
    const materials = [];
    document.querySelectorAll('#pricing-tbody tr').forEach(row => {
        const type = row.querySelector('[data-field="name"]')?.dataset.type || 'custom';
        const name = row.querySelector('[data-field="name"]')?.value || '';
        const unitPricePerM = parseFloat(row.querySelector('[data-field="unit_price_per_m"]')?.value) || 0;
        const unitPricePerG = parseFloat(row.querySelector('[data-field="unit_price_per_g"]')?.value) || 0;
        const supplier = row.querySelector('[data-field="supplier"]')?.value || '';

        if (name && (unitPricePerM > 0 || unitPricePerG > 0)) {
            materials.push({
                material_type: type,
                name: name,
                unit_price_per_m: unitPricePerM,
                unit_price_per_g: unitPricePerG,
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

    const pricingData = {
        materials: collectPricingData(),
        labor_cost_per_piece: parseFloat(document.getElementById('labor-cost').value) || 0,
        accessories_cost_per_piece: parseFloat(document.getElementById('accessories-cost').value) || 0,
        packaging_cost_per_piece: parseFloat(document.getElementById('packaging-cost').value) || 0,
        other_cost_per_piece: parseFloat(document.getElementById('other-cost').value) || 0,
        profit_margin_percent: parseFloat(document.getElementById('profit-margin').value) || 15,
        tax_rate_percent: parseFloat(document.getElementById('tax-rate').value) || 13,
        quantity: consumptionData.params?.quantity || 100,
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
                    <span>${mc.name} ${mc.supplier ? '(' + mc.supplier + ')' : ''}</span>
                    <strong>¥${mc.total_cost}</strong>
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
