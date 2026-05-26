/**
 * 精确排料计算 - quick-calc.js
 * 统一使用 calc-engine 进行精确计算
 */

// 品类名称映射
const CATEGORY_NAMES = {
    tshirt: 'T恤', shirt: '衬衫', jacket: '夹克',
    coat: '大衣', pants: '裤子', skirt: '裙子', custom: '自定义'
};

// 品类默认裁片模板
const CATEGORY_TEMPLATES = {
    tshirt: [
        { name: '前片', width: 29, height: 72, quantity: 1 },
        { name: '后片', width: 29, height: 74, quantity: 1 },
        { name: '袖子', width: 20, height: 60, quantity: 2 }
    ],
    shirt: [
        { name: '前片', width: 32, height: 75, quantity: 1 },
        { name: '后片', width: 34, height: 77, quantity: 1 },
        { name: '袖子', width: 22, height: 62, quantity: 2 },
        { name: '领子', width: 18, height: 8, quantity: 1 }
    ],
    jacket: [
        { name: '前片', width: 35, height: 80, quantity: 2 },
        { name: '后片', width: 38, height: 82, quantity: 1 },
        { name: '袖子', width: 25, height: 65, quantity: 2 },
        { name: '领子', width: 22, height: 10, quantity: 1 }
    ],
    coat: [
        { name: '前片', width: 40, height: 95, quantity: 2 },
        { name: '后片', width: 44, height: 98, quantity: 1 },
        { name: '袖子', width: 28, height: 75, quantity: 2 },
        { name: '领子', width: 26, height: 12, quantity: 1 }
    ],
    pants: [
        { name: '前裤片', width: 32, height: 100, quantity: 2 },
        { name: '后裤片', width: 38, height: 102, quantity: 2 },
        { name: '腰头', width: 70, height: 8, quantity: 1 }
    ],
    skirt: [
        { name: '前裙片', width: 35, height: 65, quantity: 2 },
        { name: '后裙片', width: 35, height: 67, quantity: 2 },
        { name: '腰头', width: 68, height: 6, quantity: 1 }
    ]
};

// 当前裁片列表
let pieces = [];

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    renderPiecesTable();
});

// 加载品类模板
function loadCategoryTemplate() {
    const category = document.getElementById('q-category').value;
    if (!category) return;

    const template = CATEGORY_TEMPLATES[category];
    if (template) {
        pieces = JSON.parse(JSON.stringify(template));
        renderPiecesTable();
    } else {
        pieces = [];
        renderPiecesTable();
    }
}

// 添加空白裁片
function addPiece() {
    pieces.push({
        name: `裁片${pieces.length + 1}`,
        width: 30,
        height: 50,
        quantity: 1
    });
    renderPiecesTable();
}

// 删除裁片
function removePiece(index) {
    pieces.splice(index, 1);
    renderPiecesTable();
}

// 渲染裁片表格
function renderPiecesTable() {
    const tbody = document.getElementById('pieces-tbody');
    
    if (pieces.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;color:#999;padding:20px;">
                    请选择品类或手动添加裁片
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pieces.map((p, i) => `
        <tr>
            <td><input type="text" value="${p.name}" onchange="updatePiece(${i}, 'name', this.value)" style="width:80px;"></td>
            <td><input type="number" value="${p.width}" step="0.5" min="1" onchange="updatePiece(${i}, 'width', this.value)" style="width:60px;"></td>
            <td><input type="number" value="${p.height}" step="0.5" min="1" onchange="updatePiece(${i}, 'height', this.value)" style="width:60px;"></td>
            <td><input type="number" value="${p.quantity}" step="1" min="1" onchange="updatePiece(${i}, 'quantity', this.value)" style="width:50px;"></td>
            <td><button class="btn btn-small btn-danger" onclick="removePiece(${i})">删除</button></td>
        </tr>
    `).join('');
}

// 更新裁片属性
function updatePiece(index, field, value) {
    if (field === 'name') {
        pieces[index][field] = value;
    } else {
        pieces[index][field] = parseFloat(value) || 0;
    }
}

// 显示/隐藏加载状态
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// 执行精确排料计算
async function calculateNesting() {
    // 校验输入
    const category = document.getElementById('q-category').value;
    if (!category) {
        alert('请选择服装品类');
        return;
    }

    if (pieces.length === 0) {
        alert('请添加至少一个裁片');
        return;
    }

    const fabricWidth = parseFloat(document.getElementById('q-fabric-width').value);
    if (!fabricWidth || fabricWidth < 60 || fabricWidth > 300) {
        alert('面料门幅应在 60-300cm 之间');
        return;
    }

    const seamAllowance = parseFloat(document.getElementById('q-seam-allowance').value) || 1.0;

    // 校验每个裁片
    for (const p of pieces) {
        if (!p.name || p.name.trim() === '') {
            alert('所有裁片必须有名称');
            return;
        }
        if (p.width <= 0 || p.height <= 0) {
            alert(`裁片"${p.name}"的尺寸必须大于0`);
            return;
        }
        if (p.quantity < 1) {
            alert(`裁片"${p.name}"的数量至少为1`);
            return;
        }
    }

    const requestData = {
        measurements: {
            category: category,
            fabricWidth: fabricWidth,
            seamAllowance: seamAllowance,
            pieces: pieces.map(p => ({
                name: p.name,
                width: p.width,
                height: p.height,
                quantity: p.quantity,
                onFold: false
            }))
        },
        fabricWidth: fabricWidth,
        seamAllowance: seamAllowance
    };

    showLoading(true);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const resp = await fetch('/api/calc/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData),
            signal: controller.signal
        });

        clearTimeout(timeout);

        const result = await resp.json();

        if (result.success) {
            renderCalcResult(result, requestData);
        } else {
            alert('计算失败: ' + (result.message || '未知错误'));
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            alert('请求超时，请重试');
        } else {
            alert('请求失败: ' + e.message);
        }
    } finally {
        showLoading(false);
    }
}

// 渲染计算结果
function renderCalcResult(result, inputData) {
    const pattern = result.pattern || {};
    const seam = result.seam || {};
    const nesting = result.nesting || {};
    const stats = nesting.statistics || {};

    // 计算利用率
    const utilization = stats.utilization || 
        (stats.usedArea && stats.totalArea ? (stats.usedArea / stats.totalArea * 100) : 0);

    const fabricWeight = parseFloat(document.getElementById('q-fabric-weight').value) || 0;
    const quantity = parseInt(document.getElementById('q-quantity').value) || 1;

    // 1. 基本信息
    const infoCard = document.getElementById('result-info-card');
    const infoGrid = document.getElementById('result-info-grid');
    infoCard.style.display = 'block';
    infoGrid.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;">
            <span style="color:#666;font-size:13px;">服装品类</span>
            <strong style="font-size:14px;">${CATEGORY_NAMES[inputData.measurements.category]}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;">
            <span style="color:#666;font-size:13px;">面料门幅</span>
            <strong style="font-size:14px;">${inputData.fabricWidth} cm</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;">
            <span style="color:#666;font-size:13px;">缝份宽度</span>
            <strong style="font-size:14px;">${inputData.seamAllowance} cm</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;">
            <span style="color:#666;font-size:13px;">利用率</span>
            <strong style="font-size:14px;color:#1976d2;">${utilization.toFixed(1)}%</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;">
            <span style="color:#666;font-size:13px;">单件用料长度</span>
            <strong style="font-size:14px;">${(stats.fabricLength || 0).toFixed(2)} cm</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed #ddd;">
            <span style="color:#666;font-size:13px;">订单数量</span>
            <strong style="font-size:14px;">${quantity} 件</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
            <span style="color:#666;font-size:13px;">总用料长度</span>
            <strong style="font-size:14px;color:#388e3c;">${((stats.fabricLength || 0) * quantity / 100).toFixed(3)} m</strong>
        </div>
    `;

    // 2. 材料汇总
    const materialCard = document.getElementById('result-material-card');
    const materialContent = document.getElementById('result-material-content');

    if (pattern.pieces && pattern.pieces.length > 0) {
        const totalArea = pattern.pieces.reduce((sum, p) => sum + (p.area * p.quantity), 0);
        const totalLengthM = (stats.fabricLength || 0) / 100 * quantity;
        const weightKg = fabricWeight ? (totalArea / 10000 * fabricWeight / 1000 * quantity) : 0;

        materialCard.style.display = 'block';
        materialContent.innerHTML = `
            <div style="background:#f8f9fa;padding:15px;border-radius:8px;border-left:4px solid #3b82f6;">
                <div style="font-weight:600;margin-bottom:12px;color:#333;">主面料</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
                    <div style="background:white;padding:10px;border-radius:6px;">
                        <div style="font-size:11px;color:#666;">总面积</div>
                        <div style="font-size:16px;font-weight:600;color:#1976d2;">${(totalArea * quantity / 10000).toFixed(4)} m²</div>
                    </div>
                    <div style="background:white;padding:10px;border-radius:6px;">
                        <div style="font-size:11px;color:#666;">总用料长度</div>
                        <div style="font-size:16px;font-weight:600;color:#388e3c;">${totalLengthM.toFixed(3)} m</div>
                    </div>
                    ${weightKg > 0 ? `
                    <div style="background:white;padding:10px;border-radius:6px;">
                        <div style="font-size:11px;color:#666;">总重量</div>
                        <div style="font-size:16px;font-weight:600;color:#f57c00;">${weightKg.toFixed(3)} kg</div>
                    </div>
                    ` : ''}
                    <div style="background:white;padding:10px;border-radius:6px;">
                        <div style="font-size:11px;color:#666;">门幅利用率</div>
                        <div style="font-size:16px;font-weight:600;color:#7b1fa2;">${utilization.toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        materialCard.style.display = 'none';
    }

    // 3. 裁片明细
    const piecesCard = document.getElementById('result-pieces-card');
    const piecesTbody = document.getElementById('result-pieces-tbody');

    if (pattern.pieces && pattern.pieces.length > 0) {
        piecesCard.style.display = 'block';
        piecesTbody.innerHTML = pattern.pieces.map(p => `
            <tr>
                <td>${p.name}</td>
                <td>${p.width} × ${p.height}</td>
                <td>${p.width + inputData.seamAllowance * 2} × ${p.height + inputData.seamAllowance * 2}</td>
                <td>${p.quantity}</td>
                <td>${p.area} cm²</td>
            </tr>
        `).join('');
    } else {
        piecesCard.style.display = 'none';
    }

    // 4. 裁片图
    const patternCard = document.getElementById('calc-pattern-card');
    const patternSvg = document.getElementById('calc-pattern-svg');
    if (pattern.svg) {
        patternSvg.innerHTML = pattern.svg;
        patternCard.style.display = 'block';
    } else {
        patternCard.style.display = 'none';
    }

    // 5. 缝份图
    const seamCard = document.getElementById('calc-seam-card');
    const seamSvg = document.getElementById('calc-seam-svg');
    if (seam.svg) {
        seamSvg.innerHTML = seam.svg;
        seamCard.style.display = 'block';
    } else {
        seamCard.style.display = 'none';
    }

    // 6. 排料图
    const nestingCard = document.getElementById('calc-nesting-card');
    const nestingSvg = document.getElementById('calc-nesting-svg');
    const nestingStats = document.getElementById('calc-nesting-stats');

    if (nesting.svg) {
        nestingSvg.innerHTML = nesting.svg;
        nestingCard.style.display = 'block';

        nestingStats.innerHTML = `
            <div style="background:#e3f2fd;padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:11px;color:#666;">利用率</div>
                <div style="font-size:18px;font-weight:bold;color:#1976d2;">${utilization.toFixed(1)}%</div>
            </div>
            <div style="background:#f3e5f5;padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:11px;color:#666;">裁片数量</div>
                <div style="font-size:18px;font-weight:bold;color:#7b1fa2;">${stats.totalPieces || 0}</div>
            </div>
            <div style="background:#e8f5e9;padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:11px;color:#666;">单件用料</div>
                <div style="font-size:18px;font-weight:bold;color:#388e3c;">${(stats.fabricLength || 0).toFixed(1)} cm</div>
            </div>
            <div style="background:#fff3e0;padding:10px;border-radius:6px;text-align:center;">
                <div style="font-size:11px;color:#666;">浪费面积</div>
                <div style="font-size:18px;font-weight:bold;color:#f57c00;">${(stats.wasteArea || 0).toFixed(0)} cm²</div>
            </div>
        `;
    } else {
        nestingCard.style.display = 'none';
    }
}