/**
 * AI图片识别工具 - Canvas交互 + 测量逻辑
 * 
 * 工作流程：
 * 1. 上传图片 → 2. 框选参照物并输入实际长度 → 3. 框选各裁片 → 4. 自动计算尺寸 → 5. 填入表格
 */

// ============================================================
// 全局状态
// ============================================================
const ImageTool = {
    sessionId: null,
    image: null,           // HTMLImageElement
    imageWidth: 0,
    imageHeight: 0,
    pixelsPerCm: null,
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentRect: null,     // 当前正在绘制的矩形
    refRect: null,         // 参照物矩形
    measurements: [],      // 已测量的裁片 [{name, rect, lengthCm, widthCm}]
    mode: 'calibrate',     // 'calibrate' | 'measure'
    canvasScale: 1,        // canvas显示缩放比例
};

// 颜色配置
const COLORS = {
    ref: '#22c55e',        // 参照物 - 绿色
    pieces: ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316'],
};

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initUploadZone();
});

function initUploadZone() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('image-input');

    if (!zone || !input) return;

    // 点击上传
    zone.addEventListener('click', () => input.click());

    // 文件选择
    input.addEventListener('change', (e) => {
        if (e.target.files[0]) handleImageUpload(e.target.files[0]);
    });

    // 拖拽上传
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleImageUpload(e.dataTransfer.files[0]);
    });
}

// ============================================================
// 图片上传
// ============================================================
async function handleImageUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
    }

    showAiLoading(true, '上传图片中...');

    try {
        const formData = new FormData();
        formData.append('file', file);
        if (ImageTool.sessionId) {
            formData.append('session_id', ImageTool.sessionId);
        }

        const resp = await fetch('/api/image/upload', {
            method: 'POST',
            body: formData,
        });
        const result = await resp.json();
        if (result.success) {
            ImageTool.sessionId = result.data.session_id;
            ImageTool.imageWidth = result.data.image_width;
            ImageTool.imageHeight = result.data.image_height;

            // 加载图片到内存
            ImageTool.image = new Image();
            ImageTool.image.onload = () => {
                showAiStep('calibrate');
                initCalibrateCanvas();
                showAiLoading(false);
            };
            ImageTool.image.src = URL.createObjectURL(file);
        } else {
            alert('上传失败: ' + result.message);
            showAiLoading(false);
        }
    } catch (err) {
        alert('上传失败: ' + err.message);
        showAiLoading(false);
    }
}

// ============================================================
// 步骤切换
// ============================================================
function showAiStep(step) {
    document.querySelectorAll('.ai-step').forEach(s => s.style.display = 'none');
    document.getElementById(`ai-step-${step}`).style.display = 'block';
}

// ============================================================
// 标定参照物 - Canvas交互
// ============================================================
function initCalibrateCanvas() {
    const canvas = document.getElementById('calibrate-canvas');
    const container = document.getElementById('calibrate-canvas-container');
    if (!canvas || !container) return;

    // 计算缩放比例，使canvas适应容器宽度
    const containerWidth = container.clientWidth - 4;
    ImageTool.canvasScale = containerWidth / ImageTool.imageWidth;
    const displayWidth = containerWidth;
    const displayHeight = ImageTool.imageHeight * ImageTool.canvasScale;

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    ImageTool.mode = 'calibrate';
    ImageTool.refRect = null;
    ImageTool.currentRect = null;

    // 绘制图片
    const ctx = canvas.getContext('2d');
    ctx.drawImage(ImageTool.image, 0, 0, displayWidth, displayHeight);

    // 绑定鼠标事件
    canvas.onmousedown = (e) => onCanvasMouseDown(e, canvas);
    canvas.onmousemove = (e) => onCanvasMouseMove(e, canvas);
    canvas.onmouseup = (e) => onCanvasMouseUp(e, canvas);

    // 触摸事件支持
    canvas.ontouchstart = (e) => { e.preventDefault(); onCanvasMouseDown(touchToMouse(e), canvas); };
    canvas.ontouchmove = (e) => { e.preventDefault(); onCanvasMouseMove(touchToMouse(e), canvas); };
    canvas.ontouchend = (e) => { e.preventDefault(); onCanvasMouseUp(touchToMouse(e), canvas); };
}

function touchToMouse(e) {
    const touch = e.touches[0] || e.changedTouches[0];
    return { clientX: touch.clientX, clientY: touch.clientY, target: e.target };
}

function getCanvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}

function onCanvasMouseDown(e, canvas) {
    const coords = getCanvasCoords(e, canvas);
    ImageTool.isDrawing = true;
    ImageTool.startX = coords.x;
    ImageTool.startY = coords.y;
    ImageTool.currentRect = null;
}

function onCanvasMouseMove(e, canvas) {
    if (!ImageTool.isDrawing) return;
    const coords = getCanvasCoords(e, canvas);
    ImageTool.currentRect = {
        x1: ImageTool.startX,
        y1: ImageTool.startY,
        x2: coords.x,
        y2: coords.y,
    };
    redrawCanvas(canvas);
}

function onCanvasMouseUp(e, canvas) {
    if (!ImageTool.isDrawing) return;
    ImageTool.isDrawing = false;

    if (ImageTool.currentRect) {
        const r = normalizeRect(ImageTool.currentRect);
        // 忽略太小的框选
        if (r.x2 - r.x1 > 10 && r.y2 - r.y1 > 10) {
            if (ImageTool.mode === 'calibrate') {
                ImageTool.refRect = r;
            } else if (ImageTool.mode === 'measure') {
                ImageTool.currentRect = r;
            }
        }
    }
    redrawCanvas(canvas);
}

function normalizeRect(rect) {
    return {
        x1: Math.min(rect.x1, rect.x2),
        y1: Math.min(rect.y1, rect.y2),
        x2: Math.max(rect.x1, rect.x2),
        y2: Math.max(rect.y1, rect.y2),
    };
}

function redrawCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const scale = ImageTool.canvasScale;

    // 重绘图片
    ctx.drawImage(ImageTool.image, 0, 0, canvas.width, canvas.height);

    // 绘制参照物
    if (ImageTool.refRect) {
        const r = ImageTool.refRect;
        ctx.strokeStyle = COLORS.ref;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.ref;
        ctx.font = '13px sans-serif';
        ctx.fillText('参照物', r.x1, r.y1 - 6);
    }

    // 绘制已测量的裁片
    ImageTool.measurements.forEach((m, i) => {
        const r = m.displayRect;
        const color = COLORS.pieces[i % COLORS.pieces.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.fillStyle = color;
        ctx.font = '12px sans-serif';
        ctx.fillText(`${m.name}: ${m.lengthCm}×${m.widthCm}cm`, r.x1, r.y1 - 6);
    });

    // 绘制当前正在框选的矩形
    if (ImageTool.currentRect && ImageTool.isDrawing) {
        const r = ImageTool.currentRect;
        const color = ImageTool.mode === 'calibrate' ? COLORS.ref : COLORS.pieces[ImageTool.measurements.length % COLORS.pieces.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.setLineDash([]);

        // 显示实时尺寸
        if (ImageTool.pixelsPerCm && ImageTool.mode === 'measure') {
            const nr = normalizeRect(r);
            const dx = Math.abs(nr.x2 - nr.x1) / scale;
            const dy = Math.abs(nr.y2 - nr.y1) / scale;
            const lCm = (Math.max(dx, dy) / ImageTool.pixelsPerCm).toFixed(1);
            const wCm = (Math.min(dx, dy) / ImageTool.pixelsPerCm).toFixed(1);
            ctx.fillStyle = color;
            ctx.font = '13px sans-serif';
            ctx.fillText(`${lCm} × ${wCm} cm`, r.x1, r.y1 - 6);
        }
    }
}

// ============================================================
// 确认标定
// ============================================================
async function confirmCalibration() {
    if (!ImageTool.refRect) {
        alert('请先在图片上框选参照物区域');
        return;
    }

    const refLength = parseFloat(document.getElementById('ref-length').value);
    if (!refLength || refLength <= 0) {
        alert('请输入参照物的实际长度');
        return;
    }

    showAiLoading(true, '标定中...');

    try {
        // 将canvas坐标转换为图片坐标
        const scale = ImageTool.canvasScale;
        const refRect = {
            x1: Math.round(ImageTool.refRect.x1 / scale),
            y1: Math.round(ImageTool.refRect.y1 / scale),
            x2: Math.round(ImageTool.refRect.x2 / scale),
            y2: Math.round(ImageTool.refRect.y2 / scale),
        };

        const resp = await fetch('/api/image/calibrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: ImageTool.sessionId,
                ref_rect: refRect,
                ref_length_cm: refLength,
            }),
        });
        const result = await resp.json();
        if (result.success) {
            ImageTool.pixelsPerCm = result.data.pixels_per_cm;
            ImageTool.measurements = [];

            // 切换到测量模式
            showAiStep('measure');
            initMeasureCanvas();
            populatePieceSelect();

            if (result.data.accuracy_hint) {
                console.log('精度提示:', result.data.accuracy_hint);
            }
        } else {
            alert('标定失败: ' + result.message);
        }
    } catch (e) {
        alert('标定失败: ' + e.message);
    } finally {
        showAiLoading(false);
    }
}

// ============================================================
// 裁片测量 - Canvas交互
// ============================================================
function initMeasureCanvas() {
    const canvas = document.getElementById('measure-canvas');
    const container = document.getElementById('measure-canvas-container');
    if (!canvas || !container) return;

    const containerWidth = container.clientWidth - 4;
    ImageTool.canvasScale = containerWidth / ImageTool.imageWidth;
    const displayWidth = containerWidth;
    const displayHeight = ImageTool.imageHeight * ImageTool.canvasScale;

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    ImageTool.mode = 'measure';
    ImageTool.currentRect = null;

    // 绘制
    const ctx = canvas.getContext('2d');
    ctx.drawImage(ImageTool.image, 0, 0, displayWidth, displayHeight);

    // 绘制参照物
    if (ImageTool.refRect) {
        const r = ImageTool.refRect;
        ctx.strokeStyle = COLORS.ref;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(r.x1, r.y1, r.x2 - r.x1, r.y2 - r.y1);
        ctx.setLineDash([]);
    }

    // 绑定事件
    canvas.onmousedown = (e) => onCanvasMouseDown(e, canvas);
    canvas.onmousemove = (e) => onCanvasMouseMove(e, canvas);
    canvas.onmouseup = (e) => onCanvasMouseUp(e, canvas);
    canvas.ontouchstart = (e) => { e.preventDefault(); onCanvasMouseDown(touchToMouse(e), canvas); };
    canvas.ontouchmove = (e) => { e.preventDefault(); onCanvasMouseMove(touchToMouse(e), canvas); };
    canvas.ontouchend = (e) => { e.preventDefault(); onCanvasMouseUp(touchToMouse(e), canvas); };
}

function populatePieceSelect() {
    const select = document.getElementById('current-piece-select');
    if (!select || !categoryDetail) return;

    select.innerHTML = '<option value="">-- 选择裁片 --</option>';
    categoryDetail.pieces.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

// ============================================================
// 添加测量
// ============================================================
function addMeasurement() {
    const select = document.getElementById('current-piece-select');
    if (!select || !select.value) {
        alert('请先选择要测量的裁片名称');
        return;
    }

    if (!ImageTool.currentRect) {
        alert('请先在图片上框选裁片区域');
        return;
    }

    const pieceName = select.options[select.selectedIndex].text;
    const pieceId = select.value;
    const scale = ImageTool.canvasScale;

    // 转换为图片坐标
    const imgRect = {
        x1: Math.round(ImageTool.currentRect.x1 / scale),
        y1: Math.round(ImageTool.currentRect.y1 / scale),
        x2: Math.round(ImageTool.currentRect.x2 / scale),
        y2: Math.round(ImageTool.currentRect.y2 / scale),
    };

    // 计算尺寸
    const dx = Math.abs(imgRect.x2 - imgRect.x1);
    const dy = Math.abs(imgRect.y2 - imgRect.y1);
    const lengthCm = parseFloat((Math.max(dx, dy) / ImageTool.pixelsPerCm).toFixed(1));
    const widthCm = parseFloat((Math.min(dx, dy) / ImageTool.pixelsPerCm).toFixed(1));

    // 保存
    ImageTool.measurements.push({
        pieceId: pieceId,
        name: pieceName,
        rect: imgRect,
        displayRect: { ...ImageTool.currentRect },
        lengthCm: lengthCm,
        widthCm: widthCm,
    });

    ImageTool.currentRect = null;

    // 重绘
    const canvas = document.getElementById('measure-canvas');
    redrawCanvas(canvas);

    // 更新已测量列表
    updateMeasuredList();

    // 自动切换到下一个未测量的裁片
    autoSelectNextPiece(pieceId);
}

function autoSelectNextPiece(currentId) {
    const select = document.getElementById('current-piece-select');
    if (!select || !categoryDetail) return;

    // 找到下一个未测量的裁片
    const measuredIds = ImageTool.measurements.map(m => m.pieceId);
    const nextPiece = categoryDetail.pieces.find(p => !measuredIds.includes(p.id));
    if (nextPiece) {
        select.value = nextPiece.id;
    }
}

function undoMeasurement() {
    if (ImageTool.measurements.length === 0) return;
    ImageTool.measurements.pop();
    ImageTool.currentRect = null;

    const canvas = document.getElementById('measure-canvas');
    redrawCanvas(canvas);
    updateMeasuredList();
}

function updateMeasuredList() {
    const container = document.getElementById('measured-list');
    const items = document.getElementById('measured-items');
    if (!container || !items) return;

    if (ImageTool.measurements.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    items.innerHTML = ImageTool.measurements.map((m, i) => `
        <div class="measured-item">
            <span class="measured-color" style="background:${COLORS.pieces[i % COLORS.pieces.length]}"></span>
            <span class="measured-name">${m.name}</span>
            <span class="measured-size">${m.lengthCm} × ${m.widthCm} cm</span>
            <button class="btn-delete" onclick="removeMeasurement(${i})" title="删除">✕</button>
        </div>
    `).join('');
}

function removeMeasurement(index) {
    ImageTool.measurements.splice(index, 1);
    const canvas = document.getElementById('measure-canvas');
    redrawCanvas(canvas);
    updateMeasuredList();
}

// ============================================================
// 填入表格
// ============================================================
function applyToTable() {
    if (ImageTool.measurements.length === 0) {
        alert('请先测量至少一个裁片');
        return;
    }

    // 确保裁片模板已加载
    const tbody = document.getElementById('pieces-tbody');
    if (!tbody || tbody.children.length === 0) {
        if (categoryDetail) {
            loadPieceTemplate();
        }
    }

    // 等待DOM更新后填入
    setTimeout(() => {
        const rows = document.querySelectorAll('#pieces-tbody tr');
        let filledCount = 0;

        ImageTool.measurements.forEach(m => {
            // 查找匹配的行
            let targetRow = null;
            rows.forEach(row => {
                const nameInput = row.querySelector('[data-field="name"]');
                if (nameInput && nameInput.value === m.name) {
                    targetRow = row;
                }
            });

            // 如果没找到精确匹配，尝试按pieceId匹配
            if (!targetRow) {
                rows.forEach(row => {
                    if (row.dataset.pieceId === m.pieceId) {
                        targetRow = row;
                    }
                });
            }

            // 如果还是没找到，填入第一个空行
            if (!targetRow) {
                rows.forEach(row => {
                    const lengthInput = row.querySelector('[data-field="length"]');
                    if (lengthInput && !lengthInput.value && !targetRow) {
                        targetRow = row;
                    }
                });
            }

            if (targetRow) {
                const lengthInput = targetRow.querySelector('[data-field="length"]');
                const widthInput = targetRow.querySelector('[data-field="width"]');
                if (lengthInput) lengthInput.value = m.lengthCm;
                if (widthInput) widthInput.value = m.widthCm;
                filledCount++;
            }
        });

        // 高亮提示已填入的行
        rows.forEach(row => {
            const lengthInput = row.querySelector('[data-field="length"]');
            if (lengthInput && lengthInput.value) {
                row.style.background = '#dcfce7';
                setTimeout(() => { row.style.background = ''; }, 2000);
            }
        });

        alert(`已填入 ${filledCount} 个裁片的测量数据，请核实并修改。`);
    }, 100);
}

// ============================================================
// 重置
// ============================================================
function resetAi() {
    ImageTool.sessionId = null;
    ImageTool.image = null;
    ImageTool.pixelsPerCm = null;
    ImageTool.refRect = null;
    ImageTool.currentRect = null;
    ImageTool.measurements = [];
    ImageTool.isDrawing = false;

    showAiStep('upload');
    document.getElementById('image-input').value = '';
    document.getElementById('measured-list').style.display = 'none';
}

// ============================================================
// UI辅助
// ============================================================
function showAiLoading(show, text) {
    let overlay = document.getElementById('ai-loading');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'ai-loading';
        overlay.className = 'ai-loading';
        overlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text"></div>';
        document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-text').textContent = text || '处理中...';
    overlay.style.display = show ? 'flex' : 'none';
}
