/**
 * CAD排料页面逻辑
 * 输入：成衣裁片尺寸（实物测量数据）
 */

const CAD_CATEGORIES = [
    { id: 'tshirt', name: 'T恤', icon: '👕', available: true, message: '' },
    { id: 'shirt', name: '衬衫', icon: '👔', available: false, message: '衬衫CAD模块正在开发中，敬请期待' },
    { id: 'coat', name: '大衣', icon: '🧥', available: false, message: '大衣CAD模块正在开发中，敬请期待' },
    { id: 'jacket', name: '夹克', icon: '🧥', available: false, message: '夹克CAD模块正在开发中，敬请期待' },
    { id: 'pants', name: '裤子', icon: '👖', available: false, message: '裤子CAD模块正在开发中，敬请期待' },
    { id: 'skirt', name: '裙子', icon: '👗', available: false, message: '裙子CAD模块正在开发中，敬请期待' },
];

let currentCategory = null;
let currentResult = null;

document.addEventListener('DOMContentLoaded', () => {
    renderCategories();
    loadEditRecord();
});

function renderCategories() {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = CAD_CATEGORIES.map(cat => `
        <div class="category-card ${cat.available ? 'available' : 'disabled'}" 
             onclick="selectCategory('${cat.id}')"
             data-id="${cat.id}"
             style="position:relative;">
            <div class="cat-icon">${cat.icon}</div>
            <div class="cat-name">${cat.name}</div>
            <div class="cat-desc">${cat.available ? '参数化CAD排料' : '开发中'}</div>
            ${!cat.available ? '<span class="dev-badge">开发中</span>' : ''}
        </div>
    `).join('');
}

function selectCategory(catId) {
    const cat = CAD_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    if (!cat.available) {
        alert(cat.message || '该品类CAD模块正在开发中，敬请期待');
        return;
    }

    currentCategory = catId;

    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === catId);
    });

    setTimeout(() => goStep(2), 300);
}

function goStep(step) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    document.getElementById('panel-' + step).classList.add('active');
    document.querySelector(`[data-step="${step}"]`).classList.add('active');
}

function getGarmentInput() {
    return {
        chestWidth: parseFloat(document.getElementById('g-chestWidth').value) || 58,
        shoulderWidth: parseFloat(document.getElementById('g-shoulderWidth').value) || 24,
        bodyLength: parseFloat(document.getElementById('g-bodyLength').value) || 72,
        sleeveLength: parseFloat(document.getElementById('g-sleeveLength').value) || 22,
        neckWidth: parseFloat(document.getElementById('g-neckWidth').value) || 18,
        armholeDepth: parseFloat(document.getElementById('g-armholeDepth').value) || 26,
        cuffWidth: parseFloat(document.getElementById('g-cuffWidth').value) || 16,
        hemCurve: parseFloat(document.getElementById('g-hemCurve').value) || 0,
        shoulderSlope: parseFloat(document.getElementById('g-shoulderSlope').value) || 3,
    };
}

function getFrontPatternParams() {
    return {
        chestWidth: parseFloat(document.getElementById('g-chestWidth').value) || 58,
        bodyLength: parseFloat(document.getElementById('g-bodyLength').value) || 72,
        neckWidth: parseFloat(document.getElementById('g-neckWidth').value) || 18,
        armholeDepth: parseFloat(document.getElementById('g-armholeDepth').value) || 26,
        hemWidth: parseFloat(document.getElementById('g-hemWidth')?.value) || null,
        frontNeckDepth: parseFloat(document.getElementById('g-frontNeckDepth')?.value) || null,
        shoulderWidth: parseFloat(document.getElementById('g-shoulderWidth').value) || 24,
        shoulderSlope: parseFloat(document.getElementById('g-shoulderSlope').value) || 3
    };
}

function getFabricParams() {
    return {
        width: parseFloat(document.getElementById('fabric-width').value) || 145,
        weightGsm: parseFloat(document.getElementById('fabric-weight').value) || 0,
        shrinkageRate: parseFloat(document.getElementById('shrinkage-rate').value) || 3,
        wastageRate: parseFloat(document.getElementById('wastage-rate').value) || 8,
        quantity: parseInt(document.getElementById('quantity').value) || 100,
    };
}

async function calculateNesting() {
    if (!currentCategory) {
        alert('请先选择品类');
        return;
    }

    showLoading();

    try {
        const frontOnly = document.getElementById('front-only-mode')?.checked || false;
        const requestBody = {
            category: currentCategory,
            garmentInput: getGarmentInput(),
            fabricParams: getFabricParams(),
        };

        if (frontOnly) {
            requestBody.frontOnly = true;
            requestBody.frontParams = getFrontPatternParams();
        }

        const response = await fetch('/api/cad-nesting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || '计算失败');
        }

        currentResult = data.data;
        renderResult(data.data);
        goStep(4);

    } catch (error) {
        alert('计算错误: ' + error.message);
        console.error(error);
    } finally {
        hideLoading();
    }
}

function renderResult(result) {
    const params = result.params || {};

    const infoGrid = document.getElementById('result-info-grid');
    infoGrid.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">品类</span>
            <strong style="font-size:14px;">T恤</strong>
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
            <span style="color:var(--text-secondary);font-size:13px;">单件用料</span>
            <strong style="font-size:14px;color:var(--primary-color);">${result.per_piece_length_m} 米</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">总用料</span>
            <strong style="font-size:14px;">${result.total_length_m} 米</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">利用率</span>
            <strong style="font-size:14px;">${result.utilization_rate}%</strong>
        </div>
        ${params.fabric_weight_gsm > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料重量</span>
            <strong style="font-size:14px;">${result.fabric_weight_kg} kg</strong>
        </div>
        ` : ''}
    `;

    const matCards = document.getElementById('result-material-cards');
    const matBreakdown = result.material_breakdown || {};
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

    renderPiecePreviews(result);
    renderSeamAllowancePreviews(result);
    renderNestingWithReact(result, params.fabric_width);

    const piecesTbody = document.getElementById('result-pieces-tbody');
    const pieces = result.pieces_detail || [];
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

function renderPiecePreviews(result) {
    const container = document.getElementById('piece-previews-container');
    if (!container) return;

    let pieces = result.pieces || [];
    
    // 🔧 【工业标准】Preview模式只显示3个基础裁片（对称展示）
    // 不根据 cutCount 展开，cutCount 仅用于排料模式
    // 强制去重：如果收到重复的名称，只保留第一个
    const seenNames = new Set();
    pieces = pieces.filter(piece => {
        if (seenNames.has(piece.name)) {
            return false;  // 过滤掉重复的
        }
        seenNames.add(piece.name);
        return true;
    });
    
    console.log(`[CAD] 裁片预览: 过滤前=${result.pieces?.length || 0}个, 过滤后=${pieces.length}个`, 
                pieces.map(p => p.name));

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

        const svgContent = generatePieceSVG(pathOps, piece.name);
        const canvasId = `piece-canvas-${index}`;

        return `
            <div class="card" style="padding:16px;text-align:center;">
                <div style="font-size:15px;font-weight:700;margin-bottom:10px;color:#1e293b;">${piece.name}${piece.cutCount > 1 ? ' ×' + piece.cutCount : ''}</div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;min-height:380px;display:flex;align-items:center;justify-content:center;">
                    <canvas id="${canvasId}" width="320" height="400" style="max-width:100%;height:auto;"></canvas>
                </div>
                <div id="${canvasId}-info" style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.5;">
                </div>
            </div>
        `;
    }).join('');

    setTimeout(() => {
        pieces.forEach((piece, index) => {
            const pathOps = piece.pathOps || [];
            if (pathOps.length === 0) return;

            const canvas = document.getElementById(`piece-canvas-${index}`);
            if (!canvas) return;

            convertSVGToCanvas(canvas, pathOps, piece.name, piece);
        });
    }, 100);
}

function generatePieceSVG(pathOps, pieceName) {
    let d = '';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const op of pathOps) {
        switch (op.type) {
            case 'move':
                d += `M ${op.to.x} ${op.to.y} `;
                updateBounds(op.to.x, op.to.y);
                break;
            case 'line':
                d += `L ${op.to.x} ${op.to.y} `;
                updateBounds(op.to.x, op.to.y);
                break;
            case 'quad':
                d += `Q ${op.cp1.x} ${op.cp1.y} ${op.to.x} ${op.to.y} `;
                updateBounds(op.cp1.x, op.cp1.y);
                updateBounds(op.to.x, op.to.y);
                break;
            case 'curve':
                d += `C ${op.cp1.x} ${op.cp1.y} ${op.cp2.x} ${op.cp2.y} ${op.to.x} ${op.to.y} `;
                updateBounds(op.cp1.x, op.cp1.y);
                updateBounds(op.cp2.x, op.cp2.y);
                updateBounds(op.to.x, op.to.y);
                break;
            case 'close':
                d += 'Z ';
                break;
        }
    }

    function updateBounds(x, y) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    const padding = 10;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - padding} ${minY - padding} ${width} ${height}" width="${width}" height="${height}">
        <path d="${d.trim()}" fill="#e3f2fd" stroke="#1976d2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function convertSVGToCanvas(canvas, pathOps, pieceName, pieceData) {
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

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 暂时禁用尺寸线标注（避免遮挡裁片）
    // ctx.strokeStyle = '#ef4444';
    // ctx.lineWidth = 0.8 / scale;
    // ctx.setLineDash([2 / scale, 2 / scale]);

    // drawDimensionLine(ctx, minX, minY, maxX, minY, `${srcWidth.toFixed(1)}cm`, 'bottom');
    // drawDimensionLine(ctx, minX, minY, minX, maxY, `${srcHeight.toFixed(1)}cm`, 'left');

    // ctx.setLineDash([]);
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

    if (pieceData && pieceData.bbox) {
        const area = pieceData.area || 0;
        const infoDiv = document.getElementById(`${canvas.id}-info`);
        if (infoDiv) {
            infoDiv.innerHTML = `
                <div><strong>宽度:</strong> ${srcWidth.toFixed(1)} cm</div>
                <div><strong>高度:</strong> ${srcHeight.toFixed(1)} cm</div>
                <div><strong>面积:</strong> ${area.toFixed(1)} cm²</div>
                ${pieceData.onFold ? '<div style="color:#059669;">● 对折裁片</div>' : ''}
            `;
        }
    }
}

function drawDimensionLine(ctx, x1, y1, x2, y2, text, position) {
    // ⚠️ 尺寸线功能已禁用（避免显示异常）
    // 如需启用，请先修复 ctx.scale(1, -1) 导致的文字倒立问题
    return;
}

function renderSeamAllowancePreviews(result) {
    const container = document.getElementById('seam-allowance-container');
    if (!container) return;

    let pieces = result.pieces || [];
    
    // 🔧 【工业标准】缝份预览也只显示3个基础裁片（对称展示）
    const seenNames = new Set();
    pieces = pieces.filter(piece => {
        if (seenNames.has(piece.name)) {
            return false;
        }
        seenNames.add(piece.name);
        return true;
    });
    
    console.log(`[CAD] 缝份预览: 过滤前=${result.pieces?.length || 0}个, 过滤后=${pieces.length}个`,
                pieces.map(p => p.name));

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

        const canvasId = `seam-canvas-${index}`;

        return `
            <div class="card" style="padding:16px;text-align:center;">
                <div style="font-size:15px;font-weight:700;margin-bottom:10px;color:#1e293b;">
                    ${piece.name} - 缝份预览
                </div>
                <div style="background:#fefce8;border:2px solid #fbbf24;border-radius:8px;padding:10px;min-height:400px;display:flex;align-items:center;justify-content:center;">
                    <canvas id="${canvasId}" width="340" height="440" style="max-width:100%;height:auto;"></canvas>
                </div>
                <div id="${canvasId}-info" style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.6;">
                </div>
            </div>
        `;
    }).join('');

    setTimeout(() => {
        pieces.forEach((piece, index) => {
            const pathOps = piece.pathOps || [];
            const seamAllowanceOps = piece.seamAllowancePathOps || [];
            
            if (pathOps.length === 0) return;

            const canvas = document.getElementById(`seam-canvas-${index}`);
            if (!canvas) return;

            renderSeamAllowanceCanvas(canvas, pathOps, seamAllowanceOps, piece.name, piece);
        });
    }, 150);
}

function renderSeamAllowanceCanvas(canvas, outlineOps, seamOps, pieceName, pieceData) {
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

    // 绘制缝份区域（黄色填充）
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

    // 绘制原始轮廓（蓝色填充）
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

    // 绘制关键点
    ctx.fillStyle = '#dc2626';
    for (const op of outlineOps) {
        if (op.to) {
            ctx.beginPath();
            ctx.arc(op.to.x, op.to.y, 1.5 / scale, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();

    // 绘制尺寸线和标注
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 0.8 / scale;
    ctx.setLineDash([3 / scale, 3 / scale]);

    // 暂时禁用缝份预览的尺寸线标注
    // drawDimensionLine(ctx, minX, minY, maxX, minY, `${srcWidth.toFixed(1)}cm`, 'bottom');
    // drawDimensionLine(ctx, minX, minY, minX, maxY, `${srcHeight.toFixed(1)}cm`, 'left');

    // 缝份宽度标注已移除（避免显示异常）

    ctx.setLineDash([]);
    ctx.restore();

    // 底部信息文字 - 更大更醒目
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const infoText = `轮廓: ${srcWidth.toFixed(1)} × ${srcHeight.toFixed(1)} cm | 缝份: ${pieceData?.seamAllowance || 0} cm`;
    
    // 背景
    const infoMetrics = ctx.measureText(infoText);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(
        canvas.width / 2 - infoMetrics.width / 2 - 8,
        canvas.height - 26,
        infoMetrics.width + 16,
        24
    );
    
    // 红色文字
    ctx.fillStyle = '#dc2626';
    ctx.fillText(infoText, canvas.width / 2, canvas.height - 8);

    // 图例 - 更大更清晰
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    
    let legendX = 10;
    const legendY = 18;

    // 轮廓图例
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(legendX, legendY - 8, 12, 12);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY - 8, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('裁片轮廓', legendX + 16, legendY);

    // 缝份图例
    legendX += 80;
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(legendX, legendY - 8, 12, 12);
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(legendX, legendY - 8, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.fillText('缝份区域', legendX + 16, legendY);

    // 更新详细信息卡片
    if (pieceData) {
        const infoDiv = document.getElementById(`${canvas.id}-info`);
        if (infoDiv) {
            infoDiv.innerHTML = `
                <div><strong>轮廓尺寸:</strong> ${srcWidth.toFixed(1)} × ${srcHeight.toFixed(1)} cm</div>
                <div><strong>缝份宽度:</strong> <span style="color:#dc2626;font-weight:600;">${pieceData.seamAllowance || 0} cm</span></div>
                <div><strong>含缝份总尺寸:</strong> ${(srcWidth + (pieceData.seamAllowance || 0) * 2).toFixed(1)} × ${(srcHeight + (pieceData.seamAllowance || 0) * 2).toFixed(1)} cm</div>
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

function renderNestingWithReact(result, fabricWidth) {
    if (typeof window.renderNestingResult !== 'function') {
        console.warn('React组件未加载，使用PNG/SVG回退');
        const container = document.getElementById('nesting-svg-container');

        // 优先显示 PNG（最终排料图）
        if (result.nesting_png_base64) {
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">`
                + `<img src="${result.nesting_png_base64}" alt="排料图" `
                + `style="max-width:100%;height:auto;border:1px solid var(--border-color, #e0e0e0);border-radius:4px;"/>`
                + `<a href="${result.nesting_png_base64}" download="nesting_result.png" `
                + `style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;">下载排料图PNG</a>`
                + `</div>`;
        } else if (result.nesting_svg) {
            container.innerHTML = result.nesting_svg;
        } else {
            container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">暂无排料图</p>';
        }
        return;
    }

    const pieces = (result.pieces || []).map(p => {
        // 🔧 【工业标准】排料图使用展开后的完整形状（expandedPathOps）
        // 如果是 onFold 裁片且有 expandedPathOps，则使用展开后的数据
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
            height: (result.bounds?.height || result.per_piece_length_m * 100)
        },
        totalArea: result.total_area_m2 ? result.total_area_m2 * 10000 : (result.totalArea || 0),
        usedArea: result.total_area_m2 ? (result.total_area_m2 * 10000 * (result.utilization_rate || 0) / 100) : (result.usedArea || 0)
    };

    window.renderNestingResult(pieces, nestingResult, fabricWidth);

    // 同时在 SVG 容器中显示可下载的 PNG
    const svgContainer = document.getElementById('nesting-svg-container');
    if (svgContainer && result.nesting_png_base64) {
        svgContainer.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px;">`
            + `<img src="${result.nesting_png_base64}" alt="排料图" `
            + `style="max-width:100%;height:auto;border:1px solid var(--border-color, #e0e0e0);border-radius:4px;"/>`
            + `<a href="${result.nesting_png_base64}" download="nesting_result.png" `
            + `style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;">下载排料结果PNG</a>`
            + `</div>`;
    }
}

function exportResult() {
    if (!currentResult) {
        alert('暂无结果可导出');
        return;
    }

    const data = currentResult;
    const params = data.params || {};

    let text = '=== CAD排料计算结果 ===\n\n';
    text += `品类: T恤\n`;
    text += `面料门幅: ${params.fabric_width}cm\n`;
    text += `缩水率: ${params.shrinkage_rate}%\n`;
    text += `损耗率: ${params.wastage_rate}%\n`;
    text += `订单数量: ${params.quantity}件\n\n`;

    text += '--- 计算结果 ---\n';
    text += `单件用料长度: ${data.per_piece_length_m} 米\n`;
    text += `总用料长度: ${data.total_length_m} 米\n`;
    text += `面料利用率: ${data.utilization_rate}%\n`;
    if (data.fabric_weight_kg > 0) {
        text += `面料总重: ${data.fabric_weight_kg} kg\n`;
    }

    text += '\n--- 成衣尺寸 ---\n';
    const gi = params.garmentInput || {};
    text += `胸宽: ${gi.chestWidth}cm\n`;
    text += `肩宽: ${gi.shoulderWidth}cm\n`;
    text += `衣长: ${gi.bodyLength}cm\n`;
    text += `袖长: ${gi.sleeveLength}cm\n`;
    text += `领宽: ${gi.neckWidth}cm\n`;
    text += `袖窿深: ${gi.armholeDepth}cm\n`;
    text += `袖口宽: ${gi.cuffWidth}cm\n`;

    text += '\n--- 裁片明细 ---\n';
    (data.pieces_detail || []).forEach(p => {
        text += `${p.name}: ${p.original_length}×${p.original_width}cm × ${p.count} = ${p.area_with_shrinkage_cm2}cm²\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CAD排料_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

async function loadEditRecord() {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');

    if (!editId) return;

    showLoading();

    try {
        const response = await fetch(`/api/history/${editId}`);
        const data = await response.json();

        if (data.success && data.data && data.data.type === 'cad') {
            const record = data.data;
            const inputData = record.input_data || {};

            currentCategory = inputData.category || 'tshirt';

            const garmentInput = inputData.garmentInput || {};
            const measurements = inputData.measurements || {};
            const fabricParams = inputData.fabricParams || {};

            if (garmentInput.chestWidth) document.getElementById('g-chestWidth').value = garmentInput.chestWidth;
            if (garmentInput.shoulderWidth) document.getElementById('g-shoulderWidth').value = garmentInput.shoulderWidth;
            if (garmentInput.bodyLength) document.getElementById('g-bodyLength').value = garmentInput.bodyLength;
            if (garmentInput.sleeveLength) document.getElementById('g-sleeveLength').value = garmentInput.sleeveLength;
            if (garmentInput.neckWidth) document.getElementById('g-neckWidth').value = garmentInput.neckWidth;
            if (garmentInput.armholeDepth) document.getElementById('g-armholeDepth').value = garmentInput.armholeDepth;
            if (garmentInput.cuffWidth) document.getElementById('g-cuffWidth').value = garmentInput.cuffWidth;
            if (garmentInput.hemCurve !== undefined) document.getElementById('g-hemCurve').value = garmentInput.hemCurve;
            if (garmentInput.shoulderSlope) document.getElementById('g-shoulderSlope').value = garmentInput.shoulderSlope;

            if (measurements.chest && !garmentInput.chestWidth)
                document.getElementById('g-chestWidth').value = (measurements.chest * 0.52).toFixed(1);
            if (measurements.shoulderToShoulder && !garmentInput.shoulderWidth)
                document.getElementById('g-shoulderWidth').value = measurements.shoulderToShoulder;
            if (measurements.hpsToWaistBack && !garmentInput.bodyLength)
                document.getElementById('g-bodyLength').value = measurements.hpsToWaistBack;
            if (measurements.neck && !garmentInput.neckWidth)
                document.getElementById('g-neckWidth').value = (measurements.neck * 0.45).toFixed(1);
            if (measurements.biceps && !garmentInput.armholeDepth)
                document.getElementById('g-armholeDepth').value = (measurements.biceps * 0.55).toFixed(1);
            if (measurements.wrist && !garmentInput.cuffWidth)
                document.getElementById('g-cuffWidth').value = (measurements.wrist * 1.1).toFixed(1);
            if (measurements.shoulderSlope && !garmentInput.shoulderSlope)
                document.getElementById('g-shoulderSlope').value = measurements.shoulderSlope;

            if (fabricParams.width) document.getElementById('fabric-width').value = fabricParams.width;
            if (fabricParams.weightGsm) document.getElementById('fabric-weight').value = fabricParams.weightGsm;
            if (fabricParams.shrinkageRate) document.getElementById('shrinkage-rate').value = fabricParams.shrinkageRate;
            if (fabricParams.wastageRate) document.getElementById('wastage-rate').value = fabricParams.wastageRate;
            if (fabricParams.quantity) document.getElementById('quantity').value = fabricParams.quantity;

            document.querySelectorAll('.category-card').forEach(card => {
                card.classList.toggle('selected', card.dataset.id === currentCategory);
            });

            goStep(2);
        }
    } catch (error) {
        console.error('加载编辑记录失败:', error);
    } finally {
        hideLoading();
    }
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}
