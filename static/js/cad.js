/**
 * CAD排料页面逻辑
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

function getMeasurements() {
    return {
        chest: parseFloat(document.getElementById('m-chest').value) || 100,
        waist: parseFloat(document.getElementById('m-waist').value) || 85,
        hips: parseFloat(document.getElementById('m-hips').value) || 95,
        neck: parseFloat(document.getElementById('m-neck').value) || 38,
        shoulderToShoulder: parseFloat(document.getElementById('m-shoulderToShoulder').value) || 42,
        shoulderSlope: parseFloat(document.getElementById('m-shoulderSlope').value) || 22,
        biceps: parseFloat(document.getElementById('m-biceps').value) || 32,
        wrist: parseFloat(document.getElementById('m-wrist').value) || 18,
        hpsToWaistFront: parseFloat(document.getElementById('m-hpsToWaistFront').value) || 42,
        hpsToWaistBack: parseFloat(document.getElementById('m-hpsToWaistBack').value) || 44,
        waistToHips: parseFloat(document.getElementById('m-waistToHips').value) || 20,
    };
}

function getOptions() {
    return {
        chestEase: parseFloat(document.getElementById('o-chestEase').value) || 15,
        waistEase: parseFloat(document.getElementById('o-waistEase').value) || 10,
        bicepsEase: parseFloat(document.getElementById('o-bicepsEase').value) || 20,
        collarEase: parseFloat(document.getElementById('o-collarEase').value) || 10,
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
        const response = await fetch('/api/cad-nesting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: currentCategory,
                measurements: getMeasurements(),
                options: getOptions(),
                fabricParams: getFabricParams(),
            }),
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
    
    const svgContainer = document.getElementById('nesting-svg-container');
    if (result.nesting_svg) {
        svgContainer.innerHTML = result.nesting_svg;
    } else {
        svgContainer.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">暂无排料图</p>';
    }
    
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
    
    text += '\n--- 人体参数 ---\n';
    const m = params.measurements || {};
    text += `胸围: ${m.chest}cm\n`;
    text += `腰围: ${m.waist}cm\n`;
    text += `肩宽: ${m.shoulderToShoulder}cm\n`;
    
    text += '\n--- 松量设置 ---\n';
    const o = params.options || {};
    text += `胸围松量: ${o.chestEase}%\n`;
    text += `腰围松量: ${o.waistEase}%\n`;
    
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
            
            const measurements = inputData.measurements || {};
            const options = inputData.options || {};
            const fabricParams = inputData.fabricParams || {};
            
            if (measurements.chest) document.getElementById('m-chest').value = measurements.chest;
            if (measurements.waist) document.getElementById('m-waist').value = measurements.waist;
            if (measurements.hips) document.getElementById('m-hips').value = measurements.hips;
            if (measurements.neck) document.getElementById('m-neck').value = measurements.neck;
            if (measurements.shoulderToShoulder) document.getElementById('m-shoulderToShoulder').value = measurements.shoulderToShoulder;
            if (measurements.shoulderSlope) document.getElementById('m-shoulderSlope').value = measurements.shoulderSlope;
            if (measurements.biceps) document.getElementById('m-biceps').value = measurements.biceps;
            if (measurements.wrist) document.getElementById('m-wrist').value = measurements.wrist;
            if (measurements.hpsToWaistFront) document.getElementById('m-hpsToWaistFront').value = measurements.hpsToWaistFront;
            if (measurements.hpsToWaistBack) document.getElementById('m-hpsToWaistBack').value = measurements.hpsToWaistBack;
            if (measurements.waistToHips) document.getElementById('m-waistToHips').value = measurements.waistToHips;
            
            if (options.chestEase) document.getElementById('o-chestEase').value = options.chestEase;
            if (options.waistEase) document.getElementById('o-waistEase').value = options.waistEase;
            if (options.bicepsEase) document.getElementById('o-bicepsEase').value = options.bicepsEase;
            if (options.collarEase) document.getElementById('o-collarEase').value = options.collarEase;
            
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
