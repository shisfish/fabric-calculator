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
        const timeout = setTimeout(() => controller.abort(), 60000); // 60秒超时

        // 统一使用精确排料引擎 (calc-engine)
        const resp = await fetch('/api/calc/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                measurements: {
                    category: data.category,
                    fabricWidth: data.fabric_width,
                    seamAllowance: 1.0,
                    pieces: data.pieces.map(p => ({
                        name: p.name,
                        width: p.width,
                        height: p.length,
                        quantity: p.count,
                        onFold: false
                    }))
                },
                fabricWidth: data.fabric_width,
                seamAllowance: 1.0
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const result = await resp.json();

        if (result.success) {
            lastCalcResult = result;
            renderCalcEngineResult(result, data);
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

// 渲染精确排料引擎结果 (CAD风格)
function renderCalcEngineResult(result, inputData) {
    const pattern = result.pattern || {};
    const seam = result.seam || {};
    const nesting = result.nesting || {};
    const stats = nesting.statistics || {};

    // 计算利用率
    const utilization = stats.utilization || (stats.usedArea && stats.totalArea ? (stats.usedArea / stats.totalArea * 100) : 0);

    // 1. 基本信息（保持不变）
    const infoGrid = document.getElementById('result-info-grid');
    infoGrid.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">服装品类</span>
            <strong style="font-size:14px;">${CATEGORY_NAMES[inputData.category] || inputData.category}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料门幅</span>
            <strong style="font-size:14px;">${inputData.fabric_width} cm</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">订单数量</span>
            <strong style="font-size:14px;">${inputData.quantity} 件</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">利用率</span>
            <strong style="font-size:14px;color:#1976d2;">${utilization.toFixed(1)}%</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">用料长度</span>
            <strong style="font-size:14px;">${(stats.fabricLength || 0).toFixed(2)} cm</strong>
        </div>
        ${inputData.fabric_weight_gsm ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料克重</span>
            <strong style="font-size:14px;">${inputData.fabric_weight_gsm} g/m²</strong>
        </div>
        ` : ''}
    `;

    // 2. 材料分类汇总
    const matCards = document.getElementById('result-material-cards');
    if (pattern.pieces && pattern.pieces.length > 0) {
        const totalArea = pattern.pieces.reduce((sum, p) => sum + (p.area * p.quantity), 0);
        const totalLengthM = (stats.fabricLength || 0) / 100;
        const weightKg = inputData.fabric_weight_gsm ? (totalArea / 10000 * inputData.fabric_weight_gsm / 1000) : 0;

        matCards.style.display = 'block';
        matCards.innerHTML = `
            <div class="card" style="border-left:4px solid #3b82f6;margin:0;">
                <div style="font-size:16px;font-weight:600;margin-bottom:10px;">主面料</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                    <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                        <div style="font-size:12px;color:var(--text-secondary);">总面积</div>
                        <div style="font-size:15px;font-weight:600;">${(totalArea / 10000).toFixed(4)} m²</div>
                    </div>
                    <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                        <div style="font-size:12px;color:var(--text-secondary);">用料长度</div>
                        <div style="font-size:15px;font-weight:600;">${totalLengthM.toFixed(3)} m</div>
                    </div>
                    ${weightKg > 0 ? `
                    <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                        <div style="font-size:12px;color:var(--text-secondary);">重量</div>
                        <div style="font-size:15px;font-weight:600;">${weightKg.toFixed(3)} kg</div>
                    </div>
                    ` : ''}
                    <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                        <div style="font-size:12px;color:var(--text-secondary);">门幅利用率</div>
                        <div style="font-size:15px;font-weight:600;">${utilization.toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        matCards.style.display = 'none';
    }

    // 3. 裁片明细表格
    const piecesTbody = document.getElementById('result-pieces-tbody');
    if (pattern.pieces && pattern.pieces.length > 0) {
        piecesTbody.innerHTML = pattern.pieces.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.width} × ${p.height}</td>
                <td>${p.width + 2} × ${p.height + 2}</td>
                <td>${p.quantity}</td>
                <td>${p.area}</td>
                <td>${p.area}</td>
                <td>主面料</td>
            </tr>
        `).join('');
    }

    // 4. 🎨 裁片预览 (完全复制cad.js的renderPiecePreviews)
    const patternForCAD = {
        pieces: (pattern.pieces || []).map(p => ({
            name: p.name,
            pathOps: p.pathOps || [],
            cutCount: 1,
            onFold: p.onFold || false,
            area: p.area
        }))
    };
    renderCalcPiecePreviews(patternForCAD);

    // 5. 🧵 缝份预览 (完全复制cad.js的renderSeamAllowancePreviews)
    const seamForCAD = {
        pieces: (seam.pieces || []).map(p => ({
            name: p.name,
            pathOps: p.pathOps || [],
            seamAllowancePathOps: p.seamAllowancePathOps || [],
            cutCount: p.cutCount || 1,
            onFold: p.onFold || false,
            area: p.area
        }))
    };
    renderCalcSeamAllowancePreviews(seamForCAD);

    // 6. 📐 排料图 (完全复制cad.js的renderNestingWithReact)
    const nestingViewer = document.getElementById('calc-nesting-viewer');
    const nestingStatsDiv = document.getElementById('calc-nesting-stats');

    if (nesting.svg && (nesting.pieces || nesting.nestPositions) && ((nesting.pieces || []).length > 0 || (nesting.nestPositions || []).length > 0)) {
        const fabricWidth = inputData.fabric_width || 145;

        // 构建和CAD一样的数据结构
        const resultForCAD = {
            pieces: (nesting.pieces || []).map(p => ({
                name: p.name,
                pathOps: p.pathOps || [],
                cutCount: p.cutCount || 1,
                onFold: p.onFold || false,
                area: p.area
            })),
            positions: (nesting.nestPositions || []).map(pos => ({
                name: pos.pieceName,
                x: pos.x,
                y: pos.y,
                rotation: pos.rotation || 0,
                width: pos.width,
                height: pos.height
            })),
            utilization_rate: nesting.fabricInfo?.utilization || 0,
            bounds: {
                width: fabricWidth,
                height: stats.fabricLength || nesting.fabricInfo?.height || 135
            },
            totalArea: fabricWidth * (stats.fabricLength || nesting.fabricInfo?.height || 135),
            usedArea: fabricWidth * (stats.fabricLength || nesting.fabricInfo?.height || 135) * (nesting.fabricInfo?.utilization || 0) / 100,
            nesting_svg: nesting.svg
        };

        // 调用和cad.js完全一样的渲染函数
        renderCalcNestingWithReact(resultForCAD, fabricWidth);

        // 渐变色统计卡片
        const utilization = nesting.fabricInfo?.utilization || 0;
        const fabricLength = stats.fabricLength || nesting.fabricInfo?.height || 135;
        nestingStatsDiv.innerHTML = `
            <div class="stat-card utilization">
                <div class="stat-label">利用率</div>
                <div class="stat-value">${utilization.toFixed(1)}%</div>
            </div>
            <div class="stat-card pieces">
                <div class="stat-label">裁片数量</div>
                <div class="stat-value">${(nesting.nestPositions || []).length}</div>
            </div>
            <div class="stat-card length">
                <div class="stat-label">用料长度</div>
                <div class="stat-value">${fabricLength.toFixed(0)}cm</div>
            </div>
            <div class="stat-card waste">
                <div class="stat-label">浪费面积</div>
                <div class="stat-value">${((fabricWidth * fabricLength) * (1 - utilization/100)).toFixed(0)}cm²</div>
            </div>
        `;
        nestingStatsDiv.style.display = 'grid';
    } else {
        nestingViewer.innerHTML = '<div style="text-align:center;padding:80px;color:#999;">暂无排料数据</div>';
        nestingStatsDiv.style.display = 'none';
    }
}

// ============================================================
// 以下函数完全复制自 cad.js（原模原样）
// ============================================================

// 裁片预览（完全复制cad.js的renderPiecePreviews）
function renderCalcPiecePreviews(result) {
    const container = document.getElementById('piece-previews-container');
    if (!container) return;

    let pieces = result.pieces || [];

    const seenNames = new Set();
    pieces = pieces.filter(piece => {
        if (seenNames.has(piece.name)) {
            return false;
        }
        seenNames.add(piece.name);
        return true;
    });

    console.log(`[精确计算] 裁片预览: ${pieces.length}个裁片`, pieces.map(p => p.name));

    if (pieces.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);grid-column:1/-1;text-align:center;">暂无裁片数据</p>';
        return;
    }

    container.innerHTML = pieces.map((piece, index) => {
        const pathOps = piece.pathOps || [];
        if (pathOps.length === 0) {
            return `
                <div class="card" style="padding:12px;text-align:center;">
                    <div style="font-size:14px;font-weight:600;margin-bottom:8px;">${piece.name}</div>
                    <div style="color:var(--text-secondary);font-size:12px;">缺少路径数据</div>
                </div>
            `;
        }

        const canvasId = `calc-piece-canvas-${index}`;

        return `
            <div class="card" style="padding:16px;text-align:center;">
                <div style="font-size:15px;font-weight:700;margin-bottom:10px;color:#1e293b;">${piece.name}${piece.cutCount > 1 ? ' ×' + piece.cutCount : ''}</div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;min-height:380px;display:flex;align-items:center;justify-content:center;">
                    <canvas id="${canvasId}" width="320" height="400" style="max-width:100%;height:auto;"></canvas>
                </div>
                <div id="${canvasId}-info" style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.5;"></div>
            </div>
        `;
    }).join('');

    setTimeout(() => {
        pieces.forEach((piece, index) => {
            const pathOps = piece.pathOps || [];
            if (pathOps.length === 0) return;

            const canvas = document.getElementById(`calc-piece-canvas-${index}`);
            if (!canvas) return;

            convertCalcPieceSVGToCanvas(canvas, pathOps, piece.name, piece);
        });
    }, 100);
}

// Canvas渲染（完全复制cad.js的convertSVGToCanvas）
function convertCalcPieceSVGToCanvas(canvas, pathOps, pieceName, pieceData) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const op of pathOps) {
        if (op.to) {
            minX = Math.min(minX, op.to.x);
            minY = Math.min(minY, op.to.y);
            maxX = Math.max(maxX, op.to.x);
            maxY = Math.max(maxY, op.to.y);
        }
        if (op.cp1) {
            minX = Math.min(minX, op.cp1.x);
            minY = Math.min(minY, op.cp1.y);
            maxX = Math.max(maxX, op.cp1.x);
            maxY = Math.max(maxY, op.cp1.y);
        }
        if (op.cp2) {
            minX = Math.min(minX, op.cp2.x);
            minY = Math.min(minY, op.cp2.y);
            maxX = Math.max(maxX, op.cp2.x);
            maxY = Math.max(maxY, op.cp2.y);
        }
    }

    const padding = 40;
    const srcWidth = maxX - minX || 100;
    const srcHeight = maxY - minY || 100;
    const scale = Math.min((canvas.width - padding * 2) / srcWidth, (canvas.height - padding * 2 - 60) / srcHeight);
    const offsetX = (canvas.width - srcWidth * scale) / 2 - minX * scale;
    const offsetY = (canvas.height - srcHeight * scale) / 2 - minY * scale + 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#e3f2fd';
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 1.5 / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    const keyPoints = [];

    for (const op of pathOps) {
        switch (op.type) {
            case 'move':
                ctx.moveTo(op.to.x, op.to.y);
                keyPoints.push({ x: op.to.x, y: op.to.y, type: 'start' });
                break;
            case 'line':
                ctx.lineTo(op.to.x, op.to.y);
                keyPoints.push({ x: op.to.x, y: op.to.y, type: 'vertex' });
                break;
            case 'quad':
                ctx.quadraticCurveTo(op.cp1.x, op.cp1.y, op.to.x, op.to.y);
                keyPoints.push({ x: op.to.x, y: op.to.y, type: 'curve-end' });
                break;
            case 'curve':
                ctx.bezierCurveTo(op.cp1.x, op.cp1.y, op.cp2.x, op.cp2.y, op.to.x, op.to.y);
                keyPoints.push({ x: op.to.x, y: op.to.y, type: 'curve-end' });
                break;
            case 'close':
                ctx.closePath();
                break;
        }
    }

    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    keyPoints.forEach((pt, i) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5 / scale, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const infoText = `尺寸: ${srcWidth.toFixed(1)} × ${srcHeight.toFixed(1)} cm`;

    const textMetrics = ctx.measureText(infoText);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(
        canvas.width / 2 - textMetrics.width / 2 - 6,
        canvas.height - 18,
        textMetrics.width + 12,
        16
    );

    ctx.fillStyle = '#dc2626';
    ctx.fillText(infoText, canvas.width / 2, canvas.height - 6);

    if (pieceData && pieceData.area !== undefined) {
        const infoDiv = document.getElementById(`${canvas.id}-info`);
        if (infoDiv) {
            infoDiv.innerHTML = `
                <div><strong>宽度:</strong> ${srcWidth.toFixed(1)} cm</div>
                <div><strong>高度:</strong> ${srcHeight.toFixed(1)} cm</div>
                <div><strong>面积:</strong> ${(pieceData.area || 0).toFixed(1)} cm²</div>
                ${pieceData.onFold ? '<div style="color:#059669;">● 对折裁片</div>' : ''}
            `;
        }
    }
}

// 缝份预览（完全复制cad.js的renderSeamAllowancePreviews）
function renderCalcSeamAllowancePreviews(result) {
    const container = document.getElementById('seam-allowance-container');
    if (!container) return;

    let pieces = result.pieces || [];

    const seenNames = new Set();
    pieces = pieces.filter(piece => {
        if (seenNames.has(piece.name)) {
            return false;
        }
        seenNames.add(piece.name);
        return true;
    });

    console.log(`[精确计算] 缝份预览: ${pieces.length}个裁片`, pieces.map(p => p.name));

    if (pieces.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);grid-column:1/-1;text-align:center;">暂无缝份数据</p>';
        return;
    }

    container.innerHTML = pieces.map((piece, index) => {
        const pathOps = piece.pathOps || [];
        const seamAllowanceOps = piece.seamAllowancePathOps || [];

        if (pathOps.length === 0) {
            return `
                <div class="card" style="padding:16px;text-align:center;">
                    <div style="font-size:15px;font-weight:700;margin-bottom:10px;color:#1e293b;">${piece.name}</div>
                    <div style="color:var(--text-secondary);font-size:12px;">缺少路径数据</div>
                </div>
            `;
        }

        const canvasId = `calc-seam-canvas-${index}`;

        return `
            <div class="card" style="padding:16px;text-align:center;">
                <div style="font-size:15px;font-weight:700;margin-bottom:10px;color:#1e293b;">
                    ${piece.name} - 缝份预览
                </div>
                <div style="background:#fefce8;border:2px solid #fbbf24;border-radius:8px;padding:10px;min-height:400px;display:flex;align-items:center;justify-content:center;">
                    <canvas id="${canvasId}" width="340" height="440" style="max-width:100%;height:auto;"></canvas>
                </div>
                <div id="${canvasId}-info" style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.6;"></div>
            </div>
        `;
    }).join('');

    setTimeout(() => {
        pieces.forEach((piece, index) => {
            const pathOps = piece.pathOps || [];
            const seamAllowanceOps = piece.seamAllowancePathOps || [];

            if (pathOps.length === 0) return;

            const canvas = document.getElementById(`calc-seam-canvas-${index}`);
            if (!canvas) return;

            renderCalcSeamAllowanceCanvas(canvas, pathOps, seamAllowanceOps, piece.name, piece);
        });
    }, 150);
}

// 缝份Canvas渲染（完全复制cad.js的renderSeamAllowanceCanvas）
function renderCalcSeamAllowanceCanvas(canvas, outlineOps, seamOps, pieceName, pieceData) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const allOps = [...outlineOps, ...seamOps];

    for (const op of allOps) {
        if (op.to) {
            minX = Math.min(minX, op.to.x);
            minY = Math.min(minY, op.to.y);
            maxX = Math.max(maxX, op.to.x);
            maxY = Math.max(maxY, op.to.y);
        }
        if (op.cp1) {
            minX = Math.min(minX, op.cp1.x);
            minY = Math.min(minY, op.cp1.y);
            maxX = Math.max(maxX, op.cp1.x);
            maxY = Math.max(maxY, op.cp1.y);
        }
        if (op.cp2) {
            minX = Math.min(minX, op.cp2.x);
            minY = Math.min(minY, op.cp2.y);
            maxX = Math.max(maxX, op.cp2.x);
            maxY = Math.max(maxY, op.cp2.y);
        }
    }

    const padding = 50;
    const srcWidth = maxX - minX || 100;
    const srcHeight = maxY - minY || 100;
    const scale = Math.min((canvas.width - padding * 2) / srcWidth, (canvas.height - padding * 2 - 80) / srcHeight);
    const offsetX = (canvas.width - srcWidth * scale) / 2 - minX * scale;
    const offsetY = (canvas.height - srcHeight * scale) / 2 - minY * scale + 30;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (seamOps.length > 0) {
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5 / scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        for (const op of seamOps) {
            switch (op.type) {
                case 'move':
                    ctx.moveTo(op.to.x, op.to.y);
                    break;
                case 'line':
                    ctx.lineTo(op.to.x, op.to.y);
                    break;
                case 'curve':
                    ctx.bezierCurveTo(op.cp1.x, op.cp1.y, op.cp2.x, op.cp2.y, op.to.x, op.to.y);
                    break;
                case 'quad':
                    ctx.quadraticCurveTo(op.cp1.x, op.cp1.y, op.to.x, op.to.y);
                    break;
                case 'close':
                    ctx.closePath();
                    break;
            }
        }
        ctx.fill();
        ctx.stroke();
    }

    ctx.fillStyle = '#dbeafe';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.0 / scale;

    ctx.beginPath();
    for (const op of outlineOps) {
        switch (op.type) {
            case 'move':
                ctx.moveTo(op.to.x, op.to.y);
                break;
            case 'line':
                ctx.lineTo(op.to.x, op.to.y);
                break;
            case 'curve':
                ctx.bezierCurveTo(op.cp1.x, op.cp1.y, op.cp2.x, op.cp2.y, op.to.x, op.to.y);
                break;
            case 'quad':
                ctx.quadraticCurveTo(op.cp1.x, op.cp1.y, op.to.x, op.to.y);
                break;
            case 'close':
                ctx.closePath();
                break;
        }
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    for (const op of outlineOps) {
        if (op.to) {
            ctx.beginPath();
            ctx.arc(op.to.x, op.to.y, 1.5 / scale, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const infoText = `轮廓: ${srcWidth.toFixed(1)} × ${srcHeight.toFixed(1)} cm | 缝份: ${pieceData?.seamDistance || pieceData?.seamAllowance || 0} cm`;

    const infoMetrics = ctx.measureText(infoText);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(
        canvas.width / 2 - infoMetrics.width / 2 - 8,
        canvas.height - 26,
        infoMetrics.width + 16,
        24
    );

    ctx.fillStyle = '#dc2626';
    ctx.fillText(infoText, canvas.width / 2, canvas.height - 8);

    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';

    let legendX = 10;
    const legendY = 18;

    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(legendX, legendY - 8, 12, 12);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY - 8, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('裁片轮廓', legendX + 16, legendY);

    legendX += 80;
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(legendX, legendY - 8, 12, 12);
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(legendX, legendY - 8, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('缝份区域', legendX + 16, legendY);

    if (pieceData) {
        const infoDiv = document.getElementById(`${canvas.id}-info`);
        if (infoDiv) {
            const seamDist = pieceData.seamDistance || pieceData.seamAllowance || 0;
            infoDiv.innerHTML = `
                <div><strong>轮廓尺寸:</strong> ${srcWidth.toFixed(1)} × ${srcHeight.toFixed(1)} cm</div>
                <div><strong>缝份宽度:</strong> <span style="color:#dc2626;font-weight:600;">${seamDist} cm</span></div>
                <div><strong>含缝份总尺寸:</strong> ${(srcWidth + seamDist * 2).toFixed(1)} × ${(srcHeight + seamDist * 2).toFixed(1)} cm</div>
                <div style="margin-top:4px;padding-top:4px;border-top:1px solid #e5e7eb;">
                    <span style="display:inline-block;width:10px;height:10px;background:#dbeafe;border:1px solid #2563eb;margin-right:4px;vertical-align:middle;"></span>
                    <span style="font-size:10px;">净样（缝合线）</span>
                    &nbsp;&nbsp;
                    <span style="display:inline-block;width:10px;height:10px;background:#fef3c7;border:1px solid #f59e0b;margin-right:4px;vertical-align:middle;"></span>
                    <span style="font-size:10px;">毛样（裁剪线）</span>
                </div>
            `;
        }
    }
}

// 排料图渲染（完全复制cad.js的renderNestingWithReact）
function renderCalcNestingWithReact(result, fabricWidth) {
    if (typeof window.renderNestingResult !== 'function') {
        console.warn('React组件未加载，使用SVG回退');
        const container = document.getElementById('calc-nesting-viewer');

        if (result.nesting_svg) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">`
                + `<div style="max-width:100%;overflow:auto;border:1px solid #e0e0e0;border-radius:4px;padding:10px;background:#fafafa;">`
                + result.nesting_svg
                + `</div>`
                + `<a href="javascript:void(0)" onclick="downloadCalcNestingSVG()" `
                + `style="font-size:13px;color:#3b82f6;text-decoration:none;">下载排料结果</a>`
                + `</div>`;
            window._calcNestingSVG = result.nesting_svg;
        } else {
            container.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">暂无排料图</p>';
        }
        return;
    }

    const pieces = (result.pieces || []).map(p => {
        const pathOps = (p.onFold && p.expandedPathOps) ? p.expandedPathOps : p.pathOps;
        if (!pathOps || pathOps.length === 0) {
            console.warn(`裁片 ${p.name} 缺少pathOps数据，将无法正确渲染`);
        }
        return {
            name: p.name,
            points: [],
            pathOps: pathOps || [],
            cutCount: p.cutCount || 1,
            onFold: p.onFold || false,
            area: p.area
        };
    });

    const nestingResult = {
        pieces: result.pieces || [],
        positions: result.positions || [],
        utilization: result.utilization_rate || result.utilization || 0,
        bounds: {
            width: fabricWidth,
            height: result.bounds?.height || 135
        },
        totalArea: result.totalArea || 0,
        usedArea: result.usedArea || 0
    };

    window.renderNestingResult(pieces, nestingResult, fabricWidth);

    const svgContainer = document.getElementById('calc-nesting-viewer');
    if (svgContainer && result.nesting_svg) {
        const existingImg = svgContainer.querySelector('.nesting-download');
        if (!existingImg) {
            const downloadDiv = document.createElement('div');
            downloadDiv.className = 'nesting-download';
            downloadDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px;';
            downloadDiv.innerHTML = `<a href="javascript:void(0)" onclick="downloadCalcNestingSVG()" 
                style="font-size:13px;color:#3b82f6;text-decoration:none;">下载排料结果</a>`;
            svgContainer.appendChild(downloadDiv);
        }
        window._calcNestingSVG = result.nesting_svg;
    }
}

// 下载排料图
function downloadCalcNestingSVG() {
    const container = document.getElementById('calc-nesting-container') || document.getElementById('calc-nesting-viewer');
    if (!container) {
        alert('暂无排料图数据');
        return;
    }

    const svgElement = container.querySelector('svg');
    if (!svgElement) {
        alert('暂无排料图数据');
        return;
    }

    const clonedSvg = svgElement.cloneNode(true);
    clonedSvg.setAttribute('transform', '');
    clonedSvg.style.transform = '';

    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `精确排料结果_${new Date().toISOString().slice(0,10)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

// 导出结果
function exportResult() {
    if (!lastCalcResult) return;
    const text = generateResultText(lastCalcResult);
    downloadText(text, `用量计算_${new Date().toISOString().slice(0,10)}.txt`);
}

function generateResultText(data) {
    const pattern = data.pattern || {};
    const nesting = data.nesting || {};
    const stats = nesting.statistics || {};

    const utilization = stats.utilization || (stats.usedArea && stats.totalArea ? (stats.usedArea / stats.totalArea * 100) : 0);

    let text = '=== 面料用量计算结果 (精确排料) ===\n\n';
    text += `品类: ${data.metadata?.engine || 'calc-engine'}\n`;
    text += `面料门幅: ${data.metadata?.fabricWidth || 'N/A'}cm\n`;
    text += `缝份: ${data.metadata?.seamAllowance || 1.0}cm\n\n`;

    text += '--- 排料统计 ---\n';
    text += `利用率: ${utilization.toFixed(1)}%\n`;
    text += `用料长度: ${(stats.fabricLength || 0).toFixed(2)} cm\n`;
    text += `裁片数量: ${stats.totalPieces || 0}\n`;
    text += `总面积: ${(stats.usedArea || 0).toFixed(1)} cm²\n`;
    text += `浪费面积: ${(stats.wasteArea || 0).toFixed(1)} cm²\n\n`;

    if (pattern.pieces && pattern.pieces.length > 0) {
        text += '--- 裁片明细 ---\n';
        pattern.pieces.forEach(p => {
            text += `${p.name}: ${p.width}×${p.height}cm × ${p.quantity}${p.onFold ? ' (对折)' : ''} = ${p.area}cm²\n`;
        });
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

function goToQuotation() {
    if (lastCalcResult) {
        sessionStorage.setItem('consumptionData', JSON.stringify(lastCalcResult));
    }
    window.location.href = '/quotation';
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

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

    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === category);
    });

    if (data.fabric_width) document.getElementById('fabric-width').value = data.fabric_width;
    if (data.fabric_weight_gsm) document.getElementById('fabric-weight').value = data.fabric_weight_gsm;
    if (data.fabric_type) document.getElementById('fabric-type').value = data.fabric_type;
    if (data.shrinkage_rate !== undefined) document.getElementById('shrinkage-rate').value = data.shrinkage_rate;
    if (data.wastage_rate !== undefined) document.getElementById('wastage-rate').value = data.wastage_rate;
    if (data.quantity) document.getElementById('quantity').value = data.quantity;

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

    document.querySelectorAll('.step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (sNum === 3) s.classList.add('active');
        else if (sNum < 3) s.classList.add('completed');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-3').classList.add('active');
}
