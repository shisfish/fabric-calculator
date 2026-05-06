/**
 * 面料用量快速计算系统 - 精确计算页面
 */

// 全局状态
let currentCategory = null;
let categoryDetail = null;
let lastCalcResult = null;
let pieceTemplateLoaded = false;  // 裁片模板是否已加载

// 品类图标映射
const CATEGORY_ICONS = {
    coat: "🧥",
    down_jacket: "🧥",
    jacket: "🧥",
    windbreaker: "🧥",
    cotton_padded: "🧥",
    pants: "👖",
    skirt: "👗",
    shirt: "👔",
    tshirt: "👕",
    custom: "✏️",
};

// 材料类型选项
const MATERIAL_OPTIONS = [
    { value: "main", label: "主面料" },
    { value: "lining", label: "里布" },
    { value: "interlining", label: "衬布" },
    { value: "filling_fabric_single", label: "胆料(单层)" },
    { value: "filling_fabric_double", label: "胆料(双层)" },
    { value: "rib", label: "罗纹" },
    { value: "other", label: "其他" },
];

// 形状选项
const SHAPE_OPTIONS = [
    { value: "rectangle", label: "矩形" },
    { value: "trapezoid", label: "梯形" },
    { value: "triangle", label: "三角形" },
    { value: "circle", label: "圆形" },
];

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    loadCategories().then(() => {
        // 品类列表加载完成后，检查是否是编辑模式
        const editId = new URLSearchParams(window.location.search).get('edit');
        if (editId) {
            loadEditRecord(editId);
        }
    });
});

// 加载品类列表
async function loadCategories() {
    try {
        const resp = await fetch('/api/categories');
        const data = await resp.json();
        if (data.success) {
            renderCategories(data.data);
        }
    } catch (e) {
        console.error('加载品类失败:', e);
    }
}

// 渲染品类网格
function renderCategories(categories) {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="selectCategory('${cat.id}')" data-id="${cat.id}">
            <div class="cat-icon">${CATEGORY_ICONS[cat.id] || '👕'}</div>
            <div class="cat-name">${cat.name}</div>
            <div class="cat-desc">${cat.description}</div>
            <div class="cat-tags">
                ${cat.has_lining ? '<span class="badge">含里布</span>' : ''}
                ${cat.has_filling ? '<span class="badge">含填充</span>' : ''}
                <span class="badge">${cat.piece_count}个裁片</span>
            </div>
        </div>
    `).join('');
}

// 选择品类
async function selectCategory(catId) {
    currentCategory = catId;
    pieceTemplateLoaded = false;  // 切换品类时重置，允许重新加载模板

    // 更新UI
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === catId);
    });

    // 加载品类详情
    try {
        const resp = await fetch(`/api/categories/${catId}`);
        const data = await resp.json();
        if (data.success) {
            categoryDetail = data.data;
            // 更新默认参数
            document.getElementById('wastage-rate').value = categoryDetail.default_wastage;
            document.getElementById('shrinkage-rate').value = categoryDetail.default_shrinkage;
        }
    } catch (e) {
        console.error('加载品类详情失败:', e);
    }

    // 自动跳到下一步
    setTimeout(() => goStep(2), 300);
}

// 步骤切换
function goStep(step, skipValidation) {
    // 验证
    if (!skipValidation && step > 1 && !currentCategory) {
        alert('请先选择服装品类');
        return;
    }

    // 更新步骤指示器
    document.querySelectorAll('.step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (sNum === step) s.classList.add('active');
        else if (sNum < step) s.classList.add('completed');
    });

    // 切换面板
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${step}`).classList.add('active');

    // 步骤3时加载裁片模板（仅首次）
    if (step === 3 && categoryDetail && !pieceTemplateLoaded) {
        loadPieceTemplate();
        pieceTemplateLoaded = true;
    }
}

// 加载裁片模板
function loadPieceTemplate() {
    const tbody = document.getElementById('pieces-tbody');
    if (!categoryDetail.pieces || categoryDetail.pieces.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-row">自定义品类，请手动添加裁片</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = categoryDetail.pieces.map((piece, idx) => `
        <tr data-piece-id="${piece.id}">
            <td><input type="text" class="inline-input" value="${piece.name}" data-field="name"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="" placeholder="测量值" data-field="length" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="" placeholder="测量值" data-field="width" step="0.5" min="0"></td>
            <td>
                <input type="number" class="inline-input inline-input-sm" value="${getDefaultCount(piece.id)}" data-field="count" min="1" step="1">
            </td>
            <td>
                <select class="inline-input" data-field="shape">
                    ${SHAPE_OPTIONS.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="inline-input" data-field="material">
                    ${getDefaultMaterial(piece.id, MATERIAL_OPTIONS)}
                </select>
            </td>
            <td><input type="number" class="inline-input inline-input-sm" value="1.5" data-field="seam_allowance" step="0.5" min="0"></td>
            <td>
                <button class="btn-delete" onclick="removePiece(this)" title="删除">✕</button>
            </td>
        </tr>
    `).join('');

}

// 获取默认数量
function getDefaultCount(pieceId) {
    const countMap = {
        'front_body': 2, 'back_body': 1, 'sleeve': 2,
        'collar': 2, 'hood': 2, 'pocket': 4, 'belt': 1,
        'cuff': 2, 'lining': 2, 'interlining': 2,
        'front_panel': 2, 'back_panel': 2, 'waistband': 1,
        'pocket_bag': 4, 'fly': 1, 'belt_loop': 6,
        'yoke': 2, 'collar_rib': 1, 'bottom_rib': 1,
        'shell_fabric': 2, 'filling_fabric_single': 2,
        'filling_fabric_double': 4, 'down_filling': 1,
        'cotton_filling': 1, 'other': 1,
    };
    return countMap[pieceId] || 1;
}

// 获取默认材料类型
function getDefaultMaterial(pieceId, options) {
    const materialMap = {
        'lining': 'lining', 'interlining': 'interlining',
        'filling_fabric_single': 'filling_fabric_single',
        'filling_fabric_double': 'filling_fabric_double',
        'down_filling': 'other', 'cotton_filling': 'other',
        'cuff': 'rib', 'bottom_rib': 'rib', 'collar_rib': 'rib',
    };
    const defaultMat = materialMap[pieceId] || 'main';
    return options.map(o =>
        `<option value="${o.value}" ${o.value === defaultMat ? 'selected' : ''}>${o.label}</option>`
    ).join('');
}

// 添加裁片
function addPiece() {
    const tbody = document.getElementById('pieces-tbody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="inline-input" placeholder="裁片名称" data-field="name"></td>
        <td><input type="number" class="inline-input inline-input-sm" placeholder="0" data-field="length" step="0.5" min="0"></td>
        <td><input type="number" class="inline-input inline-input-sm" placeholder="0" data-field="width" step="0.5" min="0"></td>
        <td><input type="number" class="inline-input inline-input-sm" value="1" data-field="count" min="1" step="1"></td>
        <td>
            <select class="inline-input" data-field="shape">
                ${SHAPE_OPTIONS.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
            </select>
        </td>
        <td>
            <select class="inline-input" data-field="material">
                ${MATERIAL_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" class="inline-input inline-input-sm" value="1.5" data-field="seam_allowance" step="0.5" min="0"></td>
        <td>
            <button class="btn-delete" onclick="removePiece(this)" title="删除">✕</button>
        </td>
    `;
    tbody.appendChild(row);
}

// 删除裁片
function removePiece(btn) {
    btn.closest('tr').remove();
}

// 重置裁片
function resetPieces() {
    pieceTemplateLoaded = false;
    if (categoryDetail) {
        loadPieceTemplate();
        pieceTemplateLoaded = true;
    }
}

// 收集裁片数据
function collectPieces() {
    const rows = document.querySelectorAll('#pieces-tbody tr');
    const pieces = [];
    rows.forEach(row => {
        const name = row.querySelector('[data-field="name"]')?.value || '';
        const length = parseFloat(row.querySelector('[data-field="length"]')?.value) || 0;
        const width = parseFloat(row.querySelector('[data-field="width"]')?.value) || 0;
        if (length <= 0 || width <= 0) return; // 跳过空行

        pieces.push({
            name: name,
            length: length,
            width: width,
            count: parseInt(row.querySelector('[data-field="count"]')?.value) || 1,
            shape: row.querySelector('[data-field="shape"]')?.value || 'rectangle',
            material: row.querySelector('[data-field="material"]')?.value || 'main',
            seam_allowance: parseFloat(row.querySelector('[data-field="seam_allowance"]')?.value) || 1.5,
        });
    });
    return pieces;
}

// 计算
async function calculate() {
    const pieces = collectPieces();
    if (pieces.length === 0) {
        alert('请至少填写一个裁片的尺寸数据（长度和宽度都必须大于0）');
        return;
    }

    // 校验面料参数
    const fabricWidth = parseFloat(document.getElementById('fabric-width').value);
    const quantity = parseInt(document.getElementById('quantity').value);
    const shrinkage = parseFloat(document.getElementById('shrinkage-rate').value);
    const wastage = parseFloat(document.getElementById('wastage-rate').value);

    if (!fabricWidth || fabricWidth < 60 || fabricWidth > 300) {
        alert('面料门幅应在 60-300 cm 之间');
        return;
    }
    if (!quantity || quantity < 1) {
        alert('订单数量至少为 1');
        return;
    }
    if (isNaN(shrinkage) || shrinkage < 0 || shrinkage > 50) {
        alert('缩水率应在 0-50% 之间');
        return;
    }
    if (isNaN(wastage) || wastage < 0 || wastage > 50) {
        alert('损耗率应在 0-50% 之间');
        return;
    }

    // 校验裁片数据
    for (const p of pieces) {
        if (!p.name || p.name.trim() === '') {
            alert('请填写裁片名称');
            return;
        }
        if (p.length <= 0 || p.width <= 0) {
            alert(`裁片"${p.name}"的长度和宽度必须大于0`);
            return;
        }
        if (p.length > 500 || p.width > 500) {
            alert(`裁片"${p.name}"的尺寸异常（长度或宽度超过500cm），请检查`);
            return;
        }
        if (!p.count || p.count < 1) {
            alert(`裁片"${p.name}"的数量至少为1`);
            return;
        }
    }

    const data = {
        category: currentCategory,
        fabric_width: parseFloat(document.getElementById('fabric-width').value) || 145,
        fabric_type: document.getElementById('fabric-type').value,
        fabric_weight_gsm: parseFloat(document.getElementById('fabric-weight').value) || 0,
        shrinkage_rate: parseFloat(document.getElementById('shrinkage-rate').value) || 3,
        wastage_rate: parseFloat(document.getElementById('wastage-rate').value) || 8,
        quantity: parseInt(document.getElementById('quantity').value) || 1,
        pieces: pieces,
    };

    showLoading(true);
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const resp = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const result = await resp.json();
        if (result.success) {
            lastCalcResult = result.data;
            renderResult(result.data);
            goStep(4);
        } else {
            alert('计算失败: ' + result.message);
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            alert('请求超时，请检查服务器日志或刷新页面重试');
        } else {
            alert('请求失败: ' + e.message);
        }
    } finally {
        showLoading(false);
    }
}

// 渲染结果
function renderResult(data) {
    // 1. 材料分类汇总（表格）
    const matTbody = document.getElementById('result-material-tbody');
    const matBreakdown = data.material_breakdown || {};
    matTbody.innerHTML = Object.entries(matBreakdown).map(([key, val]) => `
        <tr>
            <td>${val.name}</td>
            <td>${val.area_m2}</td>
            <td>${val.length_m}</td>
            <td>${val.weight_kg > 0 ? val.weight_kg : '-'}</td>
        </tr>
    `).join('');

    // 2. 警告
    const warningsEl = document.getElementById('result-warnings');
    if (data.warnings && data.warnings.length > 0) {
        warningsEl.style.display = 'block';
        warningsEl.innerHTML = data.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('');
    } else {
        warningsEl.style.display = 'none';
    }

    // 4. 裁片明细
    const piecesTbody = document.getElementById('result-pieces-tbody');
    piecesTbody.innerHTML = data.pieces_detail.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.original_length} × ${p.original_width}</td>
            <td>${p.effective_length} × ${p.effective_width}</td>
            <td>${p.count}</td>
            <td>${p.area_cm2}</td>
            <td>${p.area_with_shrinkage_cm2}</td>
            <td>${getMaterialName(p.material)}</td>
        </tr>
    `).join('');
}

function getMaterialName(type) {
    const names = {
        main: '主面料', lining: '里布', interlining: '衬布',
        filling_fabric_single: '胆料(单层)', filling_fabric_double: '胆料(双层)',
        rib: '罗纹', other: '其他',
    };
    return names[type] || type;
}

// 导出结果
function exportResult() {
    if (!lastCalcResult) return;
    const text = generateResultText(lastCalcResult);
    downloadText(text, `用量计算_${new Date().toISOString().slice(0,10)}.txt`);
}

function generateResultText(data) {
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
    return text;
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

// 跳转到报价
function goToQuotation() {
    if (lastCalcResult) {
        sessionStorage.setItem('consumptionData', JSON.stringify(lastCalcResult));
    }
    window.location.href = '/quotation';
}

// Loading
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// ============================================================
// 历史记录回显
// ============================================================

// ============================================================
// 历史记录回显（通过 URL 参数 ?edit=ID）
// ============================================================

async function loadEditRecord(recordId) {
    try {
        const resp = await fetch(`/api/history/${recordId}`);
        const result = await resp.json();
        if (!result.success || !result.data || !result.data.input_data) {
            alert('无法加载历史记录数据');
            return;
        }
        const data = result.data.input_data;
        fillEditData(data);
    } catch (e) {
        console.error('加载历史记录失败:', e);
        alert('加载历史记录失败');
    }
}

function fillEditData(data) {
    const category = data.category || 'custom';
    currentCategory = category;
    pieceTemplateLoaded = true;

    // 1. 品类选中状态
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === category);
    });

    // 2. 填充 Step 2 面料参数
    if (data.fabric_width) document.getElementById('fabric-width').value = data.fabric_width;
    if (data.fabric_weight_gsm) document.getElementById('fabric-weight').value = data.fabric_weight_gsm;
    if (data.fabric_type) document.getElementById('fabric-type').value = data.fabric_type;
    if (data.shrinkage_rate !== undefined) document.getElementById('shrinkage-rate').value = data.shrinkage_rate;
    if (data.wastage_rate !== undefined) document.getElementById('wastage-rate').value = data.wastage_rate;
    if (data.quantity) document.getElementById('quantity').value = data.quantity;

    // 3. 直接渲染 Step 3 裁片表格（用历史数据，不依赖品类模板）
    const tbody = document.getElementById('pieces-tbody');
    const pieces = data.pieces || [];
    tbody.innerHTML = pieces.map(piece => `
        <tr>
            <td><input type="text" class="inline-input" value="${piece.name || ''}" data-field="name"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.length || ''}" data-field="length" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.width || ''}" data-field="width" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.count || 1}" data-field="count" min="1" step="1"></td>
            <td>
                <select class="inline-input" data-field="shape">
                    ${SHAPE_OPTIONS.map(s => `<option value="${s.value}" ${s.value === (piece.shape || 'rectangle') ? 'selected' : ''}>${s.label}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="inline-input" data-field="material">
                    ${MATERIAL_OPTIONS.map(o => `<option value="${o.value}" ${o.value === (piece.material || 'main') ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.seam_allowance || 1.5}" data-field="seam_allowance" step="0.5" min="0"></td>
            <td>
                <button class="btn-delete" onclick="removePiece(this)" title="删除">✕</button>
            </td>
        </tr>
    `).join('');

    // 4. 直接切换到 Step 3 面板
    document.querySelectorAll('.step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (sNum === 3) s.classList.add('active');
        else if (sNum < 3) s.classList.add('completed');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-3').classList.add('active');
}
