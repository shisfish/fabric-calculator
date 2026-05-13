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

function renderNestingWithReact(result, fabricWidth) {
    if (typeof window.renderNestingResult !== 'function') {
        console.warn('React组件未加载，使用SVG回退');
        const svgContainer = document.getElementById('nesting-svg-container');
        if (result.nesting_svg) {
            svgContainer.innerHTML = result.nesting_svg;
        } else {
            svgContainer.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">暂无排料图</p>';
        }
        return;
    }

    const pieces = (result.pieces || []).map(p => {
        const pathOps = p.pathOps;
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
