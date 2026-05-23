/**
 * 面料用量快速计算系统 - 曲线模型计算页面
 */

// 全局状态
let currentCategory = null;
let categoryDetail = null;
let lastCalcResult = null;
let pieceTemplateLoaded = false;  // 裁片模板是否已加载
let isCurvedMode = true;  // 曲线计算模式始终为 true

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

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    loadCategories().then(() => {
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

// 加载裁片模板（曲线模式：始终显示肩宽、袖肥、袖口宽列，无形状列）
function loadPieceTemplate() {
    const tbody = document.getElementById('pieces-tbody');
    if (!categoryDetail.pieces || categoryDetail.pieces.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-row">自定义品类，请手动添加裁片</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = categoryDetail.pieces.map((piece, idx) => `
        <tr data-piece-id="${piece.id}">
            <td><input type="text" class="inline-input" value="${piece.name}" data-field="name"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="" placeholder="测量值" data-field="length" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="" placeholder="测量值" data-field="width" step="0.5" min="0"></td>
            <td class="curved-extra-col">
                ${piece.id === 'front_body'
                    ? '<input type="number" class="inline-input inline-input-sm curved-shoulder" value="" placeholder="肩宽" data-field="shoulder_width" step="0.5" min="0">'
                    : piece.id === 'back_body'
                        ? '<input type="number" class="inline-input inline-input-sm curved-shoulder-readonly" value="" placeholder="同前片" data-field="shoulder_width" step="0.5" min="0" readonly style="background:#f5f5f5;color:#999;">'
                        : '<span class="form-hint" style="font-size:11px;">—</span>'
                }
            </td>
            <td class="curved-extra-col">
                ${piece.id === 'sleeve'
                    ? '<input type="number" class="inline-input inline-input-sm" value="" placeholder="袖肥" data-field="bicep_width" step="0.5" min="0">'
                    : '<span class="form-hint" style="font-size:11px;">—</span>'
                }
            </td>
            <td class="curved-extra-col">
                ${piece.id === 'sleeve'
                    ? '<input type="number" class="inline-input inline-input-sm" value="" placeholder="袖口宽" data-field="cuff_width" step="0.5" min="0">'
                    : '<span class="form-hint" style="font-size:11px;">—</span>'
                }
            </td>
            <td>
                <input type="number" class="inline-input inline-input-sm" value="${getDefaultCount(piece.id)}" data-field="count" min="1" step="1">
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

    // 绑定前片肩宽联动到后片
    bindShoulderWidthSync();
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

// 添加裁片（曲线模式：始终显示肩宽、袖肥、袖口宽列，无形状列）
function addPiece() {
    const tbody = document.getElementById('pieces-tbody');
    const row = document.createElement('tr');
    row.dataset.pieceId = '';
    row.innerHTML = `
        <td><input type="text" class="inline-input" placeholder="裁片名称" data-field="name"></td>
        <td><input type="number" class="inline-input inline-input-sm" placeholder="0" data-field="length" step="0.5" min="0"></td>
        <td><input type="number" class="inline-input inline-input-sm" placeholder="0" data-field="width" step="0.5" min="0"></td>
        <td class="curved-extra-col">
            <input type="number" class="inline-input inline-input-sm" value="" placeholder="肩宽" data-field="shoulder_width" step="0.5" min="0">
        </td>
        <td class="curved-extra-col">
            <input type="number" class="inline-input inline-input-sm" value="" placeholder="袖肥" data-field="bicep_width" step="0.5" min="0">
        </td>
        <td class="curved-extra-col">
            <input type="number" class="inline-input inline-input-sm" value="" placeholder="袖口宽" data-field="cuff_width" step="0.5" min="0">
        </td>
        <td><input type="number" class="inline-input inline-input-sm" value="1" data-field="count" min="1" step="1"></td>
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

// 收集裁片数据（曲线模式：始终收集肩宽、袖肥、袖口宽，始终包含 piece id）
function collectPieces() {
    const rows = document.querySelectorAll('#pieces-tbody tr');
    const pieces = [];
    rows.forEach(row => {
        const name = row.querySelector('[data-field="name"]')?.value || '';
        const length = parseFloat(row.querySelector('[data-field="length"]')?.value) || 0;
        const width = parseFloat(row.querySelector('[data-field="width"]')?.value) || 0;
        if (length <= 0 || width <= 0) return; // 跳过空行

        const piece = {
            id: row.dataset.pieceId || '',
            name: name,
            length: length,
            width: width,
            count: parseInt(row.querySelector('[data-field="count"]')?.value) || 1,
            material: row.querySelector('[data-field="material"]')?.value || 'main',
            seam_allowance: parseFloat(row.querySelector('[data-field="seam_allowance"]')?.value) || 1.5,
        };

        // 始终收集曲线参数
        const shoulderWidth = parseFloat(row.querySelector('[data-field="shoulder_width"]')?.value) || 0;
        const bicepWidth = parseFloat(row.querySelector('[data-field="bicep_width"]')?.value) || 0;
        const cuffWidth = parseFloat(row.querySelector('[data-field="cuff_width"]')?.value) || 0;
        if (shoulderWidth > 0) piece.shoulder_width = shoulderWidth;
        if (bicepWidth > 0) piece.bicep_width = bicepWidth;
        if (cuffWidth > 0) piece.cuff_width = cuffWidth;

        pieces.push(piece);
    });
    return pieces;
}

// 计算（始终调用曲线计算 API）
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

    // 始终使用曲线计算 API
    const apiUrl = '/api/calculate-curved';

    showLoading(true);
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const resp = await fetch(apiUrl, {
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

// 材料名称映射
const MATERIAL_NAMES = {
    main: '主面料', lining: '里布', interlining: '衬布',
    filling_fabric_single: '胆料(单层)', filling_fabric_double: '胆料(双层)',
    rib: '罗纹', other: '其他',
};

// 品类名称映射
const CATEGORY_NAMES = {
    coat: '大衣', down_jacket: '羽绒服', jacket: '夹克',
    windbreaker: '风衣', cotton_padded: '棉服', pants: '裤子',
    skirt: '裙子', shirt: '衬衫', tshirt: 'T恤', custom: '自定义',
};

// 渲染结果（曲线模式：始终显示计算方法列及差异）
function renderResult(data) {
    // 0. 渲染基本信息（紧凑布局）
    const infoGrid = document.getElementById('result-info-grid');
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

    // 1. 材料分类汇总（卡片展示）
    const matCards = document.getElementById('result-material-cards');
    const matBreakdown = data.material_breakdown || {};
    matCards.innerHTML = Object.entries(matBreakdown).map(([key, val]) => `
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

    // 2. 警告
    const warningsEl = document.getElementById('result-warnings');
    if (data.warnings && data.warnings.length > 0) {
        warningsEl.style.display = 'block';
        warningsEl.innerHTML = data.warnings.map(w => `<div class="warning-item">⚠️ ${w}</div>`).join('');
    } else {
        warningsEl.style.display = 'none';
    }

    // 3. 裁片明细
    const piecesTbody = document.getElementById('result-pieces-tbody');
    piecesTbody.innerHTML = data.pieces_detail.map(p => {
        // 计算方法列（始终显示曲线模式）
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
            methodCell = `<span style="color:#999;font-size:12px;">矩形</span>`;
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
            <td>${MATERIAL_NAMES[p.material] || p.material}</td>
        </tr>
        `;
    }).join('');

    // 4. 裁片图片
    renderPieceImages(data.piece_images || []);

    // 5. 排料图
    renderNestingImages(data.nesting_images || []);
}

// 渲染裁片图片
function renderPieceImages(images) {
    const section = document.getElementById('piece-images-section');
    const grid = document.getElementById('piece-images-grid');
    if (!images || images.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    grid.innerHTML = images.map(img => {
        const imgSrc = img.file_path ? `/uploads/${img.file_path}` : img.image_base64;
        return `
        <div class="piece-image-card">
            <img src="${imgSrc}" alt="${img.name}" onclick="previewImage(this.src, '${img.name}')" />
            <div class="piece-image-footer">
                <span class="piece-name">${img.name}</span>
                <button class="btn-download" onclick="downloadImage('${imgSrc}', '${img.name}')">⬇ 下载</button>
            </div>
        </div>
        `;
    }).join('');
}

// 渲染排料图
function renderNestingImages(images) {
    const section = document.getElementById('nesting-images-section');
    const grid = document.getElementById('nesting-images-grid');
    if (!images || images.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    grid.innerHTML = images.map(img => {
        const imgSrc = img.file_path ? `/uploads/${img.file_path}` : img.image_base64;
        return `
        <div class="nesting-image-card">
            <div class="nesting-image-header">
                <span class="material-name">${img.material_name}</span>
                <button class="btn-download" onclick="downloadImage('${imgSrc}', '${img.material_name}_排料图')">⬇ 下载</button>
            </div>
            <img src="${imgSrc}" alt="${img.material_name}排料图" onclick="previewImage(this.src, '${img.material_name}排料图')" />
        </div>
        `;
    }).join('');
}

// 图片预览
function previewImage(src, title) {
    const overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.innerHTML = `<img src="${src}" alt="${title}" />`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

// 下载图片
function downloadImage(base64Data, filename) {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 导出结果
function exportResult() {
    if (!lastCalcResult) return;
    const text = generateResultText(lastCalcResult);
    downloadText(text, `曲线用量计算_${new Date().toISOString().slice(0,10)}.txt`);
}

function generateResultText(data) {
    let text = '=== 面料用量计算结果（曲线模型） ===\n\n';
    text += `品类: ${data.params.category}\n`;
    text += `计算方法: 曲线模型\n`;
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
        text += `${p.name}: ${p.original_length}×${p.original_width}cm × ${p.count} = ${p.area_with_shrinkage_cm2}cm²`;
        if (p.difference_cm2 !== undefined && p.difference_cm2 !== 0) {
            const diff = p.difference_cm2;
            text += diff > 0 ? ` (省${diff}cm²)` : ` (增${Math.abs(diff)}cm²)`;
        }
        text += '\n';
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
// 历史记录回显（曲线模式）
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

    // 2. 填充面料参数
    if (data.fabric_width) document.getElementById('fabric-width').value = data.fabric_width;
    if (data.fabric_weight_gsm) document.getElementById('fabric-weight').value = data.fabric_weight_gsm;
    if (data.fabric_type) document.getElementById('fabric-type').value = data.fabric_type;
    if (data.shrinkage_rate !== undefined) document.getElementById('shrinkage-rate').value = data.shrinkage_rate;
    if (data.wastage_rate !== undefined) document.getElementById('wastage-rate').value = data.wastage_rate;
    if (data.quantity) document.getElementById('quantity').value = data.quantity;

    // 3. 直接渲染 Step 3 裁片表格
    const tbody = document.getElementById('pieces-tbody');
    const pieces = data.pieces || [];
    tbody.innerHTML = pieces.map(piece => {
        const isFront = piece.name && piece.name.includes('前片');
        const isBack = piece.name && piece.name.includes('后片');
        const isSleeve = piece.name && piece.name.includes('袖');
        const pieceId = piece.id || '';

        return `
        <tr data-piece-id="${pieceId}">
            <td><input type="text" class="inline-input" value="${piece.name || ''}" data-field="name"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.length || ''}" data-field="length" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.width || ''}" data-field="width" step="0.5" min="0"></td>
            <td class="curved-extra-col">
                ${isFront
                    ? `<input type="number" class="inline-input inline-input-sm curved-shoulder" value="${piece.shoulder_width || ''}" placeholder="肩宽" data-field="shoulder_width" step="0.5" min="0">`
                    : isBack
                        ? `<input type="number" class="inline-input inline-input-sm curved-shoulder-readonly" value="${piece.shoulder_width || ''}" placeholder="同前片" data-field="shoulder_width" step="0.5" min="0" readonly style="background:#f5f5f5;color:#999;">`
                        : '<span class="form-hint" style="font-size:11px;">—</span>'
                }
            </td>
            <td class="curved-extra-col">
                ${isSleeve
                    ? `<input type="number" class="inline-input inline-input-sm" value="${piece.bicep_width || ''}" placeholder="袖肥" data-field="bicep_width" step="0.5" min="0">`
                    : '<span class="form-hint" style="font-size:11px;">—</span>'
                }
            </td>
            <td class="curved-extra-col">
                ${isSleeve
                    ? `<input type="number" class="inline-input inline-input-sm" value="${piece.cuff_width || ''}" placeholder="袖口宽" data-field="cuff_width" step="0.5" min="0">`
                    : '<span class="form-hint" style="font-size:11px;">—</span>'
                }
            </td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.count || 1}" data-field="count" min="1" step="1"></td>
            <td>
                <select class="inline-input" data-field="material">
                    ${MATERIAL_OPTIONS.map(o => `<option value="${o.value}" ${o.value === (piece.material || 'main') ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.seam_allowance || 1.5}" data-field="seam_allowance" step="0.5" min="0"></td>
            <td>
                <button class="btn-delete" onclick="removePiece(this)" title="删除">✕</button>
            </td>
        </tr>`;
    }).join('');

    // 绑定肩宽联动
    bindShoulderWidthSync();

    // 4. 直接切换到 Step 3
    document.querySelectorAll('.step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (sNum === 3) s.classList.add('active');
        else if (sNum < 3) s.classList.add('completed');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-3').classList.add('active');
}

// 前片肩宽联动到后片
function bindShoulderWidthSync() {
    const frontShoulder = document.querySelector('.curved-shoulder');
    const backShoulder = document.querySelector('.curved-shoulder-readonly');
    if (frontShoulder && backShoulder) {
        frontShoulder.addEventListener('input', function() {
            backShoulder.value = this.value;
        });
    }
}
