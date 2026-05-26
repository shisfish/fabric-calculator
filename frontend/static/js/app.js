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

    // 4. 🎨 裁片预览 (CAD风格 - Canvas卡片网格)
    const piecePreviewsContainer = document.getElementById('piece-previews-container');
    if (pattern.pieces && pattern.pieces.length > 0) {
        const uniquePieces = [];
        const seenNames = new Set();
        for (const p of pattern.pieces) {
            if (!seenNames.has(p.name)) {
                seenNames.add(p.name);
                uniquePieces.push(p);
            }
        }

        piecePreviewsContainer.innerHTML = uniquePieces.map((piece, index) => {
            const pathOps = piece.pathOps || [];
            const canvasId = `calc-piece-canvas-${index}`;

            return `
                <div class="piece-preview-card">
                    <h4>${piece.name}${piece.onFold ? ' (对折)' : ''}${piece.quantity > 1 ? ' ×' + piece.quantity : ''}</h4>
                    <div class="piece-svg">
                        ${pathOps.length > 0
                            ? `<canvas id="${canvasId}" width="280" height="360" style="max-width:100%;height:auto;"></canvas>`
                            : '<div style="color:#999;padding:20px;">缺少路径数据</div>'
                        }
                    </div>
                    <div class="piece-info">
                        <div><strong>尺寸:</strong> ${piece.width} × ${piece.height} cm</div>
                        <div><strong>数量:</strong> × ${piece.quantity}</div>
                        <div><strong>面积:</strong> ${piece.area} cm²</div>
                    </div>
                </div>
            `;
        }).join('');

        setTimeout(() => {
            uniquePieces.forEach((piece, index) => {
                const pathOps = piece.pathOps || [];
                if (pathOps.length === 0) return;

                const canvas = document.getElementById(`calc-piece-canvas-${index}`);
                if (!canvas) return;

                convertPieceSVGToCanvas(canvas, pathOps, piece.name, piece);
            });
        }, 100);
    } else {
        piecePreviewsContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">暂无裁片数据</div>';
    }

    // 5. 🧵 缝份预览 (CAD风格 - 独立卡片网格)
    const seamAllowanceContainer = document.getElementById('seam-allowance-container');
    if (seam.pieces && seam.pieces.length > 0) {
        const uniqueSeamPieces = [];
        const seenNames = new Set();
        for (const p of seam.pieces) {
            if (!seenNames.has(p.name)) {
                seenNames.add(p.name);
                uniqueSeamPieces.push(p);
            }
        }

        seamAllowanceContainer.innerHTML = uniqueSeamPieces.map((piece, index) => {
            const stitchLineOps = piece.stitchLineOps || [];
            const cuttingLineOps = piece.cuttingLineOps || [];
            const canvasId = `calc-seam-canvas-${index}`;

            return `
                <div class="seam-preview-card">
                    <h4>${piece.name} - 缝份预览</h4>
                    <div style="background:#fefce8;border:2px solid #fbbf24;border-radius:8px;padding:10px;min-height:400px;display:flex;align-items:center;justify-content:center;">
                        ${stitchLineOps.length > 0 && cuttingLineOps.length > 0
                            ? `<canvas id="${canvasId}" width="340" height="440" style="max-width:100%;height:auto;"></canvas>`
                            : '<div style="color:#999;padding:20px;">缺少路径数据</div>'
                        }
                    </div>
                    <div id="${canvasId}-info" class="seam-info"></div>
                </div>
            `;
        }).join('');

        setTimeout(() => {
            uniqueSeamPieces.forEach((piece, index) => {
                const stitchLineOps = piece.stitchLineOps || [];
                const cuttingLineOps = piece.cuttingLineOps || [];
                if (stitchLineOps.length === 0 || cuttingLineOps.length === 0) return;

                const canvas = document.getElementById(`calc-seam-canvas-${index}`);
                if (!canvas) return;

                renderCalcSeamAllowanceCanvas(
                    canvas,
                    stitchLineOps,
                    cuttingLineOps,
                    piece.name,
                    piece
                );
            });
        }, 150);
    } else {
        seamAllowanceContainer.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">暂无缝份数据</div>';
    }

    // 6. 📐 排料图 (CAD风格 - 完整专业布局)
    const nestingViewer = document.getElementById('calc-nesting-viewer');
    const nestingStatsDiv = document.getElementById('calc-nesting-stats');

    if (nesting.svg && nesting.pieces && nesting.pieces.length > 0) {
        const fabricWidth = inputData.fabric_width || 145;
        const fabricLength = stats.fabricLength || 135;
        const usedWidth = fabricWidth;

        nestingViewer.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                <!-- 顶部信息栏 -->
                <div style="display:flex;justify-content:center;align-items:center;gap:16px;padding:12px 0;margin-bottom:16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">
                    <span><strong>门幅:</strong> ${fabricWidth.toFixed(1)} cm</span>
                    <span style="color:#9ca3af;">|</span>
                    <span><strong>使用:</strong> ${usedWidth.toFixed(1)} cm</span>
                    <span style="color:#9ca3af;">|</span>
                    <span><strong>排料长度:</strong> ${fabricLength.toFixed(1)} cm</span>
                    <span style="color:#9ca3af;">|</span>
                    <span><strong>利用率:</strong> <span style="color:${utilization >= 75 ? '#059669' : utilization >= 60 ? '#d97706' : '#dc2626'};font-weight:600;">${utilization.toFixed(1)}%</span></span>
                </div>

                <!-- 图例 -->
                <div style="display:flex;justify-content:center;align-items:center;gap:24px;padding:8px 0;margin-bottom:12px;font-size:11px;color:#6b7280;">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                        <span style="width:20px;height:1px;background:#999;border-style:dashed;"></span>
                        净样(裁剪线)
                    </label>
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                        <span style="width:20px;height:1px;background:#3b82f6;"></span>
                        净样(缝合线)
                    </label>
                </div>

                <!-- 排料图容器 -->
                <div style="border:2px dashed #9ca3af;border-radius:4px;padding:10px;background:#fafafa;overflow-x:auto;">
                    <div style="min-width:${fabricWidth * 2.5}px;position:relative;">
                        ${nesting.svg}
                        
                        <!-- 左侧尺寸标注 -->
                        <div style="position:absolute;left:-50px;top:50%;transform:translateY(-50%);font-size:11px;color:#6b7280;writing-mode:vertical-rl;text-orientation:mixed;">
                            ${fabricWidth.toFixed(1)}cm
                        </div>
                    </div>
                </div>

                <!-- 底部尺寸标注 -->
                <div style="text-align:center;margin-top:12px;font-size:11px;color:#6b7280;">
                    ${fabricLength.toFixed(1)}cm
                </div>

                <!-- 下载链接 -->
                <div style="text-align:center;margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
                    <a href="javascript:void(0)" onclick="downloadCalcNestingSVG()" 
                       style="font-size:13px;color:#3b82f6;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                        ⬇️ 下载排料结果
                    </a>
                </div>
            </div>
        `;

        // 将SVG数据存储到全局变量供下载使用
        window._calcNestingSVG = nesting.svg;

        // 渐变色统计卡片
        nestingStatsDiv.innerHTML = `
            <div class="stat-card utilization">
                <div class="stat-label">利用率</div>
                <div class="stat-value">${utilization.toFixed(1)}%</div>
            </div>
            <div class="stat-card pieces">
                <div class="stat-label">裁片数量</div>
                <div class="stat-value">${stats.totalPieces || 0}</div>
            </div>
            <div class="stat-card length">
                <div class="stat-label">用料长度</div>
                <div class="stat-value">${fabricLength.toFixed(0)}cm</div>
            </div>
            <div class="stat-card waste">
                <div class="stat-label">浪费面积</div>
                <div class="stat-value">${(stats.wasteArea || 0).toFixed(0)}cm²</div>
            </div>
        `;
        nestingStatsDiv.style.display = 'grid';
    } else {
        nestingViewer.innerHTML = '<div style="text-align:center;padding:80px;color:#999;">暂无排料数据</div>';
        nestingStatsDiv.style.display = 'none';
    }
}

// 将裁片路径操作渲染到Canvas（CAD风格）
function convertPieceSVGToCanvas(canvas, pathOps, pieceName, pieceData) {
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

    for (const op of pathOps) {
        switch (op.type) {
            case 'move':
                ctx.moveTo(op.to.x, op.to.y);
                break;
            case 'line':
                ctx.lineTo(op.to.x, op.to.y);
                break;
            case 'quad':
                ctx.quadraticCurveTo(op.cp1.x, op.cp1.y, op.to.x, op.to.y);
                break;
            case 'curve':
                ctx.bezierCurveTo(op.cp1.x, op.cp1.y, op.cp2.x, op.cp2.y, op.to.x, op.to.y);
                break;
            case 'close':
                ctx.closePath();
                break;
        }
    }

    ctx.fill();
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (pieceData && pieceData.onFold) {
        const foldX = pieceData.width;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 0.8 / scale;
        ctx.setLineDash([4 / scale, 2 / scale]);
        ctx.beginPath();
        ctx.moveTo(foldX, -5);
        ctx.lineTo(foldX, srcHeight + 5);
        ctx.stroke();
        ctx.setLineDash([]);
    }

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
}

// 渲染缝份预览到Canvas（CAD风格）
function renderCalcSeamAllowanceCanvas(canvas, stitchLineOps, cuttingLineOps, pieceName, pieceData) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const allOps = [...stitchLineOps, ...cuttingLineOps];

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

    // 绘制缝份区域（黄色填充 + 虚线边框）
    if (cuttingLineOps.length > 0) {
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5 / scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        for (const op of cuttingLineOps) {
            switch (op.type) {
                case 'move':
                    ctx.moveTo(op.to.x, op.to.y);
                    break;
                case 'line':
                    ctx.lineTo(op.to.x, op.to.y);
                    break;
                case 'quad':
                    ctx.quadraticCurveTo(op.cp1.x, op.cp1.y, op.to.x, op.to.y);
                    break;
                case 'curve':
                    ctx.bezierCurveTo(op.cp1.x, op.cp1.y, op.cp2.x, op.cp2.y, op.to.x, op.to.y);
                    break;
                case 'close':
                    ctx.closePath();
                    break;
            }
        }

        ctx.fill();
        ctx.setLineDash([3 / scale, 2 / scale]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 绘制裁片轮廓（蓝色填充 + 实线边框）
    if (stitchLineOps.length > 0) {
        ctx.fillStyle = '#e3f2fd';
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 1.5 / scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        for (const op of stitchLineOps) {
            switch (op.type) {
                case 'move':
                    ctx.moveTo(op.to.x, op.to.y);
                    break;
                case 'line':
                    ctx.lineTo(op.to.x, op.to.y);
                    break;
                case 'quad':
                    ctx.quadraticCurveTo(op.cp1.x, op.cp1.y, op.to.x, op.to.y);
                    break;
                case 'curve':
                    ctx.bezierCurveTo(op.cp1.x, op.cp1.y, op.cp2.x, op.cp2.y, op.to.x, op.to.y);
                    break;
                case 'close':
                    ctx.closePath();
                    break;
            }
        }

        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();

    // 绘制图例
    const legendY = 20;
    ctx.font = '10px system-ui, -apple-system, sans-serif';

    // 裁片轮廓图例
    ctx.fillStyle = '#e3f2fd';
    ctx.fillRect(20, legendY, 12, 12);
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, legendY, 12, 12);
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText('裁片轮廓', 36, legendY + 10);

    // 缝份区域图例
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(100, legendY, 12, 12);
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(100, legendY, 12, 12);
    ctx.fillStyle = '#475569';
    ctx.fillText('缝份区域', 116, legendY + 10);

    // 底部信息
    const seamDist = pieceData.seamDistance || 1.0;
    const origW = pieceData.originalSize?.width || srcWidth;
    const origH = pieceData.originalSize?.height || srcHeight;
    const seamW = pieceData.seamSize?.width || srcWidth;
    const seamH = pieceData.seamSize?.height || srcHeight;

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const infoText = `轮廓: ${origW.toFixed(1)} × ${origH.toFixed(1)} cm | 缝份: ${seamDist.toFixed(1)} cm`;

    const textMetrics = ctx.measureText(infoText);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(
        canvas.width / 2 - textMetrics.width / 2 - 8,
        canvas.height - 28,
        textMetrics.width + 16,
        22
    );

    ctx.fillStyle = '#dc2626';
    ctx.fillText(infoText, canvas.width / 2, canvas.height - 12);

    // 更新详细信息DOM
    const infoDiv = document.getElementById(`${canvas.id}-info`);
    if (infoDiv) {
        infoDiv.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:11px;color:#64748b;">
                <div><strong>轮廓尺寸:</strong> ${origW.toFixed(1)} × ${origH.toFixed(1)} cm</div>
                <div><strong>缝份宽度:</strong> ${seamDist.toFixed(1)} cm</div>
                <div><strong>含缝份总尺寸:</strong> ${seamW.toFixed(1)} × ${seamH.toFixed(1)} cm</div>
                <div style="grid-column:span 2;">
                    <label style="margin-right:15px;cursor:pointer;"><input type="checkbox" checked disabled style="margin-right:4px;">净样（缝合线）</label>
                    <label style="cursor:pointer;"><input type="checkbox" checked disabled style="margin-right:4px;">毛样（裁剪线）</label>
                </div>
            </div>
        `;
    }
}

// 下载精确计算的排料图
function downloadCalcNestingSVG() {
    if (!window._calcNestingSVG) {
        alert('暂无排料图数据');
        return;
    }

    const svgData = window._calcNestingSVG;
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

    // 计算利用率
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
