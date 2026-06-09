/**
 * 面料用量快速计算系统 - 精确计算页面
 */

// 全局状态
let currentCategory = null;
let categoryDetail = null;
let lastCalcResult = null;
const PRECISION_DRAFT_KEY = 'fabric_calculator_precise_draft';
let restoringDraft = false;
let pieceTemplateLoaded = false;  // 裁片模板是否已加载
let fabrics = [];
let fabricSequence = 0;

const DEFAULT_SHRINKAGE_RATE = 0.5;
const FABRIC_TYPE_OPTIONS = [
    { value: "woven", label: "梭织面料" },
    { value: "knit", label: "针织面料" },
    { value: "down_shell", label: "羽绒服面料" },
    { value: "lining", label: "里布" },
    { value: "interlining", label: "衬布/粘合衬" },
];

function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'flex' : 'none';
    }
}

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
const LEGACY_MATERIAL_NAMES = Object.fromEntries(MATERIAL_OPTIONS.map(item => [item.value, item.label]));

const CALCULATION_METHOD_OPTIONS = [
    { value: "nesting", label: "排料" },
    { value: "area", label: "面积法" },
];

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    setFabrics([createFabric({ id: 'main', name: '主面料' })]);
    loadCategories().then(() => {
        // 品类列表加载完成后，检查是否是编辑模式
        const urlParams = new URLSearchParams(window.location.search);
        const isNewCalculation = urlParams.get('new') === '1';
        const editId = urlParams.get('edit');
        if (isNewCalculation) {
            startNewPrecisionCalculation();
            return;
        }
        if (editId) {
            loadEditRecord(editId);
        } else {
            restorePrecisionDraft();
        }
    });

    document.addEventListener('input', handlePrecisionDraftChange);
    document.addEventListener('change', handlePrecisionDraftChange);
});

function startNewPrecisionCalculation() {
    clearPrecisionDraft();
    lastCalcResult = null;
    currentCategory = null;
    categoryDetail = null;
    pieceTemplateLoaded = false;
    setFabrics([createFabric({ id: 'main', name: '主面料' })]);
    window.history.replaceState(null, '', '/');
    goStep(1, true);
}

function createFabric(overrides = {}) {
    fabricSequence += 1;
    return {
        id: overrides.id || `fabric_${Date.now()}_${fabricSequence}`,
        name: overrides.name || `面料${fabricSequence}`,
        fabric_type: overrides.fabric_type || overrides.type || 'woven',
        fabric_width: Number(overrides.fabric_width ?? overrides.width ?? 145),
        shrinkage_rate: Number(overrides.shrinkage_rate ?? overrides.shrinkage ?? DEFAULT_SHRINKAGE_RATE),
    };
}

function normalizeFabric(fabric, index = 0) {
    return createFabric({
        id: fabric?.id || fabric?.material || (index === 0 ? 'main' : undefined),
        name: fabric?.name || fabric?.material_name || (index === 0 ? '主面料' : `面料${index + 1}`),
        fabric_type: fabric?.fabric_type || fabric?.fabricType || fabric?.type || 'woven',
        fabric_width: fabric?.fabric_width ?? fabric?.fabricWidth ?? fabric?.width ?? 145,
        shrinkage_rate: fabric?.shrinkage_rate ?? fabric?.shrinkRate ?? fabric?.shrinkage ?? DEFAULT_SHRINKAGE_RATE,
    });
}

function setFabrics(nextFabrics) {
    fabrics = (nextFabrics || []).map(normalizeFabric);
    if (fabrics.length === 0) {
        fabrics = [createFabric({ id: 'main', name: '主面料' })];
    }
    renderFabricList();
    refreshPieceMaterialOptions();
}

function renderFabricList() {
    const list = document.getElementById('fabric-list');
    if (!list) return;
    list.innerHTML = fabrics.map((fabric, index) => `
        <div class="fabric-card" data-fabric-id="${fabric.id}">
            <div class="form-group">
                <label>面料名称</label>
                <input type="text" value="${escapeAttribute(fabric.name)}" data-fabric-field="name" maxlength="50">
            </div>
            <div class="form-group">
                <label>面料门幅 (cm)</label>
                <input type="number" value="${fabric.fabric_width}" data-fabric-field="fabric_width" step="1" min="60" max="300">
            </div>
            <div class="form-group">
                <label>面料类型</label>
                <select data-fabric-field="fabric_type">
                    ${FABRIC_TYPE_OPTIONS.map(option => `<option value="${option.value}" ${option.value === fabric.fabric_type ? 'selected' : ''}>${option.label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>缩水率 (%)</label>
                <input type="number" value="${fabric.shrinkage_rate}" data-fabric-field="shrinkage_rate" step="0.1" min="0" max="50">
            </div>
            <div class="fabric-card-actions">
                <button class="btn btn-sm btn-danger" type="button" onclick="removeFabric('${fabric.id}')" ${fabrics.length === 1 ? 'disabled' : ''}>删除</button>
            </div>
        </div>
    `).join('');
}

function escapeAttribute(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function syncFabricsFromForm() {
    document.querySelectorAll('#fabric-list .fabric-card').forEach(card => {
        const fabric = fabrics.find(item => item.id === card.dataset.fabricId);
        if (!fabric) return;
        card.querySelectorAll('[data-fabric-field]').forEach(field => {
            const key = field.dataset.fabricField;
            fabric[key] = key === 'fabric_width' || key === 'shrinkage_rate'
                ? Number(field.value)
                : field.value.trim();
        });
    });
}

function addFabric() {
    syncFabricsFromForm();
    fabrics.push(createFabric({ name: `面料${fabrics.length + 1}` }));
    renderFabricList();
    refreshPieceMaterialOptions();
    savePrecisionDraft();
}

function removeFabric(fabricId) {
    if (fabrics.length <= 1) return;
    const usedBy = collectPieceRows({ includeEmpty: true }).filter(piece => piece.material === fabricId);
    if (usedBy.length > 0) {
        alert(`该面料已被 ${usedBy.length} 个裁片使用，请先为这些裁片选择其他面料。`);
        return;
    }
    fabrics = fabrics.filter(fabric => fabric.id !== fabricId);
    renderFabricList();
    refreshPieceMaterialOptions();
    savePrecisionDraft();
}

function getFabricOptions(selectedId) {
    const fallbackId = fabrics[0]?.id || 'main';
    const selected = fabrics.some(fabric => fabric.id === selectedId) ? selectedId : fallbackId;
    return fabrics.map(fabric =>
        `<option value="${fabric.id}" ${fabric.id === selected ? 'selected' : ''}>${fabric.name}</option>`
    ).join('');
}

function refreshPieceMaterialOptions() {
    syncFabricsFromForm();
    document.querySelectorAll('#pieces-tbody [data-field="material"]').forEach(select => {
        const selected = select.value;
        select.innerHTML = getFabricOptions(selected);
    });
}

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

async function loadEditRecord(recordId) {
    try {
        clearPrecisionDraft();
        const resp = await fetch(`/api/history/${recordId}`);
        const result = await resp.json();
        if (!result.success || !result.data) {
            alert('无法加载历史记录数据');
            return;
        }

        const record = result.data;
        const editData = normalizeEditRecord(record);
        if (!editData.category && editData.pieces.length === 0) {
            alert('历史记录缺少可编辑的输入数据');
            return;
        }

        await fillEditData(editData);
    } catch (e) {
        console.error('加载历史记录失败:', e);
        alert('加载历史记录失败');
    }
}

function normalizeEditRecord(record) {
    const input = record.input_data || {};
    const measurements = input.measurements || {};
    const params = record.params || record.full_result?.params || {};
    const rawPieces =
        input.pieces ||
        measurements.pieces ||
        record.pieces ||
        record.full_result?.pieces_detail ||
        record.full_result?.pattern?.pieces ||
        [];
    const storedFabrics = input.fabrics || params.fabrics || record.full_result?.fabrics || [];
    const legacyMaterialIds = [...new Set(rawPieces.map(piece => piece.material || 'main'))];
    const legacyFabrics = legacyMaterialIds.map((material, index) => ({
        id: material,
        name: LEGACY_MATERIAL_NAMES[material] || (index === 0 ? '主面料' : material),
        fabric_width: input.fabric_width ?? input.fabricWidth ?? measurements.fabricWidth ?? params.fabric_width ?? 145,
        fabric_type: material === 'lining' || material === 'interlining'
            ? material
            : (input.fabric_type ?? input.fabricType ?? params.fabric_type ?? 'woven'),
        shrinkage_rate: input.shrinkage_rate ?? input.shrinkRate ?? input.fabricShrinkage ?? params.shrinkage_rate ?? DEFAULT_SHRINKAGE_RATE,
    }));

    return {
        category: input.category || measurements.category || params.category || record.category || 'custom',
        fabrics: storedFabrics.length ? storedFabrics : (legacyFabrics.length ? legacyFabrics : [{
            id: 'main',
            name: '主面料',
            fabric_width: 145,
            fabric_type: 'woven',
            shrinkage_rate: DEFAULT_SHRINKAGE_RATE,
        }]),
        pieces: rawPieces.map(normalizeEditPiece),
    };
}

function normalizeEditPiece(piece) {
    const method = piece.calculation_method || piece.calculationMethod || piece.calc_method;
    return {
        id: piece.id || piece.piece_id || '',
        name: piece.name || piece.piece_name || '',
        length: piece.length ?? piece.height ?? piece.original_length ?? piece.originalSize?.height ?? '',
        width: piece.width ?? piece.original_width ?? piece.originalSize?.width ?? '',
        count: piece.count ?? piece.quantity ?? piece.cutCount ?? piece.piece_count ?? 1,
        calculation_method: method === 'area' ? 'area' : 'nesting',
        material: piece.material || 'main',
    };
}

async function fillEditData(data) {
    restoringDraft = true;
    try {
        const category = data.category || 'custom';
        await selectCategory(category, { skipAutoStep: true });

        applyFabricDraft(data.fabrics || []);

        const pieces = (data.pieces || []).map(normalizeEditPiece).map(piece => ({
            ...piece,
            material: resolveLegacyMaterialId(piece.material),
        }));

        if (pieces.length > 0) {
            renderPieceRows(pieces);
            pieceTemplateLoaded = true;
        } else if (categoryDetail) {
            loadPieceTemplate();
            pieceTemplateLoaded = true;
        }

        goStep(3, true);
    } finally {
        restoringDraft = false;
    }
}

function handlePrecisionDraftChange(event) {
    if (restoringDraft) return;
    const target = event.target;
    if (!target || !target.closest) return;
    if (target.closest('#panel-2') || target.closest('#panel-3')) {
        if (target.matches('[data-fabric-field]')) {
            syncFabricsFromForm();
            if (target.dataset.fabricField === 'name') {
                refreshPieceMaterialOptions();
            }
        }
        savePrecisionDraft();
    }
}

function collectPrecisionDraft() {
    syncFabricsFromForm();
    const activePanel = document.querySelector('.panel.active');
    return {
        category: currentCategory,
        step: activePanel?.id?.replace('panel-', '') || '1',
        fabrics: fabrics.map(fabric => ({ ...fabric })),
        pieces: collectPieceRows({ includeEmpty: true }),
        savedAt: Date.now(),
    };
}

function savePrecisionDraft() {
    if (restoringDraft) return;
    try {
        const draft = collectPrecisionDraft();
        if (!draft.category && draft.pieces.length === 0) {
            sessionStorage.removeItem(PRECISION_DRAFT_KEY);
            return;
        }
        sessionStorage.setItem(PRECISION_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
        console.warn('保存精确计算草稿失败:', e);
    }
}

function clearPrecisionDraft() {
    sessionStorage.removeItem(PRECISION_DRAFT_KEY);
}

async function restorePrecisionDraft() {
    const raw = sessionStorage.getItem(PRECISION_DRAFT_KEY);
    if (!raw) return;

    let draft;
    try {
        draft = JSON.parse(raw);
    } catch (e) {
        clearPrecisionDraft();
        return;
    }

    if (!draft || !draft.category) return;

    restoringDraft = true;
    try {
        await selectCategory(draft.category, { skipAutoStep: true });
        applyFabricDraft(draft.fabrics || (draft.fabric ? [{
            id: 'main',
            name: '主面料',
            fabric_width: draft.fabric.width,
            fabric_type: draft.fabric.type,
            shrinkage_rate: draft.fabric.shrinkage,
        }] : []));
        if (draft.pieces && draft.pieces.length > 0) {
            renderPieceRows(draft.pieces.map(piece => ({
                ...piece,
                material: resolveLegacyMaterialId(piece.material),
            })));
            pieceTemplateLoaded = true;
        }
        goStep(Number(draft.step || 3), true);
    } finally {
        restoringDraft = false;
    }
}

function applyFabricDraft(nextFabrics) {
    setFabrics(nextFabrics);
}

function resolveLegacyMaterialId(material) {
    if (fabrics.some(fabric => fabric.id === material)) return material;
    const legacyNames = {
        main: ['主面料', '面料'],
        lining: ['里布', '里料'],
        interlining: ['衬布', '粘合衬'],
        filling_fabric_single: ['胆料(单层)', '胆料（单层）'],
        filling_fabric_double: ['胆料(双层)', '胆料（双层）'],
        rib: ['罗纹', '螺纹'],
        other: ['其他'],
    };
    const candidates = legacyNames[material] || [];
    const matched = fabrics.find(fabric =>
        candidates.some(name => fabric.name.includes(name)) ||
        fabric.fabric_type === material
    );
    return matched?.id || fabrics[0]?.id || 'main';
}

// 选择品类
async function selectCategory(catId, options = {}) {
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
        }
    } catch (e) {
        console.error('加载品类详情失败:', e);
    }

    // 自动跳到下一步
    if (!options.skipAutoStep) {
        setTimeout(() => goStep(2), 300);
    }
    savePrecisionDraft();
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
    if ((step === 2 || step === 3) && !restoringDraft) {
        savePrecisionDraft();
    }
}

// 加载裁片模板
function loadPieceTemplate() {
    const tbody = document.getElementById('pieces-tbody');
    if (!categoryDetail.pieces || categoryDetail.pieces.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-row">自定义品类，请手动添加裁片</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = categoryDetail.pieces.map((piece, idx) => `
        <tr data-piece-id="${piece.id}">
            <td><input type="text" class="inline-input" value="${piece.name}" data-field="name"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.default_length || ''}" placeholder="测量值" data-field="length" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.default_width || ''}" placeholder="测量值" data-field="width" step="0.5" min="0"></td>
            <td>
                <input type="number" class="inline-input inline-input-sm" value="${piece.default_count || getDefaultCount(piece.id)}" data-field="count" min="1" step="1">
            </td>
            <td>
                <select class="inline-input" data-field="calculation_method">
                    ${CALCULATION_METHOD_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="inline-input" data-field="material">
                    ${getFabricOptions(getDefaultMaterial(piece.id))}
                </select>
            </td>
            <td>
                <button class="btn-delete" onclick="removePiece(this)" title="删除">✕</button>
            </td>
        </tr>
    `).join('');

}

function renderPieceRows(pieces) {
    const tbody = document.getElementById('pieces-tbody');
    tbody.innerHTML = pieces.map(piece => `
        <tr data-piece-id="${escapeHtml(piece.id || '')}">
            <td><input type="text" class="inline-input" value="${escapeHtml(piece.name || '')}" data-field="name"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.length || ''}" placeholder="0" data-field="length" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.width || ''}" placeholder="0" data-field="width" step="0.5" min="0"></td>
            <td><input type="number" class="inline-input inline-input-sm" value="${piece.count || 1}" data-field="count" min="1" step="1"></td>
            <td>
                <select class="inline-input" data-field="calculation_method">
                    ${CALCULATION_METHOD_OPTIONS.map(option => `<option value="${option.value}" ${option.value === (piece.calculation_method || 'nesting') ? 'selected' : ''}>${option.label}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="inline-input" data-field="material">
                    ${getFabricOptions(resolveLegacyMaterialId(piece.material || fabrics[0]?.id))}
                </select>
            </td>
            <td>
                <button class="btn-delete" onclick="removePiece(this)" title="删除">✕</button>
            </td>
        </tr>
    `).join('');
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[ch]));
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
        'big_sleeve': 2, 'small_sleeve': 2,
        'turtle_patch': 1, 'facing': 2,
        'pocket_welt': 2, 'sleeve_tab': 2,
    };
    return countMap[pieceId] || 1;
}

// 获取默认材料类型
function getDefaultMaterial(pieceId) {
    const materialMap = {
        'lining': 'lining', 'interlining': 'interlining',
        'filling_fabric_single': 'filling_fabric_single',
        'filling_fabric_double': 'filling_fabric_double',
        'down_filling': 'other', 'cotton_filling': 'other',
        'cuff': 'rib', 'bottom_rib': 'rib', 'collar_rib': 'rib',
    };
    const defaultMat = materialMap[pieceId] || 'main';
    return resolveLegacyMaterialId(defaultMat);
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
            <select class="inline-input" data-field="calculation_method">
                ${CALCULATION_METHOD_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
            </select>
        </td>
        <td>
            <select class="inline-input" data-field="material">
                ${getFabricOptions(fabrics[0]?.id)}
            </select>
        </td>
        <td>
            <button class="btn-delete" onclick="removePiece(this)" title="删除">✕</button>
        </td>
    `;
    tbody.appendChild(row);
    savePrecisionDraft();
}

// 删除裁片
function removePiece(btn) {
    btn.closest('tr').remove();
    savePrecisionDraft();
}

// 重置裁片
function resetPieces() {
    pieceTemplateLoaded = false;
    if (categoryDetail) {
        loadPieceTemplate();
        pieceTemplateLoaded = true;
    }
    savePrecisionDraft();
}

// 收集裁片数据
function collectPieceRows(options = {}) {
    const includeEmpty = options.includeEmpty === true;
    const rows = document.querySelectorAll('#pieces-tbody tr');
    const pieces = [];
    rows.forEach(row => {
        if (row.querySelector('.empty-row')) return;
        const name = row.querySelector('[data-field="name"]')?.value || '';
        const lengthValue = row.querySelector('[data-field="length"]')?.value || '';
        const length = parseFloat(lengthValue) || 0;
        const widthValue = row.querySelector('[data-field="width"]')?.value || '';
        const width = parseFloat(widthValue) || 0;
        if (!includeEmpty && (length <= 0 || width <= 0)) return; // 跳过空行

        pieces.push({
            id: row.dataset.pieceId || '',
            name: name,
            length: includeEmpty ? lengthValue : length,
            width: includeEmpty ? widthValue : width,
            count: parseInt(row.querySelector('[data-field="count"]')?.value) || 1,
            calculation_method: row.querySelector('[data-field="calculation_method"]')?.value || 'nesting',
            material: row.querySelector('[data-field="material"]')?.value || 'main',
        });
    });
    return pieces;
}

// 计算
function collectPieces() {
    return collectPieceRows();
}

async function calculate() {
    // ✅ 登录检查：未登录则跳转到登录页面
    if (!Auth.requireLogin('进行精确计算')) return;

    syncFabricsFromForm();
    const pieces = collectPieces();
    if (pieces.length === 0) {
        alert('请至少填写一个裁片的尺寸数据（高度和宽度都必须大于0）');
        return;
    }

    if (fabrics.length === 0) {
        alert('请至少设置一种面料');
        return;
    }
    const fabricNames = new Set();
    for (const fabric of fabrics) {
        if (!fabric.name) {
            alert('请填写面料名称');
            return;
        }
        if (fabricNames.has(fabric.name)) {
            alert(`面料名称“${fabric.name}”重复，请使用不同名称`);
            return;
        }
        fabricNames.add(fabric.name);
        if (!fabric.fabric_width || fabric.fabric_width < 60 || fabric.fabric_width > 300) {
            alert(`面料“${fabric.name}”的门幅应在 60-300 cm 之间`);
            return;
        }
        if (!Number.isFinite(fabric.shrinkage_rate) || fabric.shrinkage_rate < 0 || fabric.shrinkage_rate > 50) {
            alert(`面料“${fabric.name}”的缩水率应在 0-50% 之间`);
            return;
        }
    }

    // 校验裁片数据
    for (const p of pieces) {
        if (!p.name || p.name.trim() === '') {
            alert('请填写裁片名称');
            return;
        }
        if (p.length <= 0 || p.width <= 0) {
            alert(`裁片"${p.name}"的高度和宽度必须大于0`);
            return;
        }
        if (p.length > 500 || p.width > 500) {
            alert(`裁片"${p.name}"的尺寸异常（高度或宽度超过500cm），请检查`);
            return;
        }
        if (!p.count || p.count < 1) {
            alert(`裁片"${p.name}"的数量至少为1`);
            return;
        }
        if (!fabrics.some(fabric => fabric.id === p.material)) {
            alert(`裁片"${p.name}"选择的面料不存在，请重新选择`);
            return;
        }
    }

    const data = {
        category: currentCategory,
        fabrics: fabrics.map(fabric => ({ ...fabric })),
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
                    seamAllowance: 1.5,
                    pieces: data.pieces.map(p => ({
                        id: p.id,
                        name: p.name,
                        width: p.width,
                        height: p.length,
                        quantity: p.count,
                        material: p.material || 'main',
                        calculation_method: p.calculation_method || 'nesting',
                        onFold: false
                    }))
                },
                seamAllowance: 1.5,
                fabrics: data.fabrics
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const result = await resp.json();

        if (result.success) {
            lastCalcResult = result;
            clearPrecisionDraft();
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

function exportResult() {
    if (!lastCalcResult) {
        alert('暂无可导出的结果');
        return;
    }

    if (!window.ResultView?.exportReport) {
        alert('报告组件未加载，请刷新页面后重试');
        return;
    }
    ResultView.exportReport(lastCalcResult);
}

function goToQuotation() {
    if (lastCalcResult) {
        sessionStorage.setItem('consumptionData', JSON.stringify({
            ...lastCalcResult,
            source_type: 'precise',
        }));
    }
    window.location.href = '/quotation';
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
function formatMeterValue(value, maximumFractionDigits = 3) {
    const n = Number(value) || 0;
    return n.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits
    });
}
function renderCalcEngineResult(result, inputData) {
    if (window.ResultView) {
        const panel = document.getElementById('panel-4');
        if (panel) {
            Array.from(panel.children).forEach(child => {
                if (!child.classList.contains('result-actions-bar') && child.tagName !== 'H2') {
                    child.style.display = 'none';
                }
            });

            let root = document.getElementById('live-result-view');
            if (!root) {
                root = document.createElement('div');
                root.id = 'live-result-view';
                panel.appendChild(root);
            }
            root.style.display = '';

            const fullResult = ResultView.normalizeFullResult({
                ...result,
                params: {
                    category: inputData.category,
                    fabrics: inputData.fabrics,
                },
            });

            ResultView.render({
                root,
                result: fullResult,
                inputData,
                type: 'precise',
                mode: 'live',
            });
            return;
        }
    }

    const pattern = result.pattern || {};
    const seam = result.seam || {};
    const nesting = result.nesting || {};
    const nestingGroups = Array.isArray(result.nesting_groups) && result.nesting_groups.length
        ? result.nesting_groups
        : (nesting && nesting.pieces ? [nesting] : []);
    const hasMultipleMaterials = nestingGroups.length > 1;
    const materialByPieceName = new Map((inputData.pieces || []).map(p => [p.name, p.material || 'main']));
    const stats = nesting.statistics || {};
    const orderQuantity = parseInt(inputData.quantity) || 1;
    const netLengthCm =
        nesting.productionMarkerLength ||
        stats.productionFabricLength ||
        nesting.markerLength ||
        stats.displayFabricLength ||
        nesting.contentMarkerLength ||
        stats.contentFabricLength ||
        0;
    const perPieceLengthM = hasMultipleMaterials ? 0 : netLengthCm / 100;
    const totalOrderLengthM = perPieceLengthM * orderQuantity;

    // 计算利用率
    const utilization = hasMultipleMaterials ? 0 : (stats.utilization || (stats.usedArea && stats.totalArea ? (stats.usedArea / stats.totalArea * 100) : 0));

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
            <strong style="font-size:14px;">${formatMeterValue(perPieceLengthM, 3)} m / 件</strong>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">总用料长度</span>
            <strong style="font-size:14px;color:#16a34a;">${formatMeterValue(totalOrderLengthM, 1)} m</strong>
        </div>
        ${inputData.fabric_weight_gsm ? `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
            <span style="color:var(--text-secondary);font-size:13px;">面料克重</span>
            <strong style="font-size:14px;">${inputData.fabric_weight_gsm} g/m²</strong>
        </div>
        ` : ''}
    `;
    if (hasMultipleMaterials) {
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
                <span style="color:var(--text-secondary);font-size:13px;">面料种类</span>
                <strong style="font-size:14px;color:#1976d2;">${nestingGroups.length} 种</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
                <span style="color:var(--text-secondary);font-size:13px;">排料图</span>
                <strong style="font-size:14px;color:#16a34a;">${nestingGroups.length} 张</strong>
            </div>
            ${inputData.fabric_weight_gsm ? `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border-color);">
                <span style="color:var(--text-secondary);font-size:13px;">面料克重</span>
                <strong style="font-size:14px;">${inputData.fabric_weight_gsm} g/m²</strong>
            </div>
            ` : ''}
            <div style="grid-column:1/-1;padding:8px 0;color:var(--text-secondary);font-size:12px;">
                多面料已拆分排料，每种面料的长度、面积、利用率和排料图在下方单独展示。
            </div>
        `;
    }

    // 2. 材料分类汇总
    const matCards = document.getElementById('result-material-cards');
    if (pattern.pieces && pattern.pieces.length > 0) {
        const perPieceArea = pattern.pieces.reduce((sum, p) => sum + (p.area * p.quantity), 0);
        const totalArea = perPieceArea * orderQuantity;
        const totalLengthM = totalOrderLengthM;
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
                        <div style="font-size:15px;font-weight:600;">${formatMeterValue(totalLengthM, 1)} m</div>
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
    if (nestingGroups.length > 0) {
        matCards.style.display = 'block';
        matCards.innerHTML = nestingGroups.map((group, index) => {
            const material = group.material || 'main';
            const materialName = group.material_name || MATERIAL_NAMES[material] || material;
            const groupLengthM = Number(group.per_piece_length_m) || 0;
            const netLengthM = Number(group.net_length_m) || 0;
            const orderLengthM = groupLengthM * orderQuantity;
            const areaM2 = Number(group.total_area_m2) || 0;
            const orderAreaM2 = areaM2 * orderQuantity;
            const groupUtilization = Number(group.utilization_rate) || 0;
            const weightKg = inputData.fabric_weight_gsm ? (orderAreaM2 * inputData.fabric_weight_gsm / 1000) : 0;
            const color = ['#3b82f6', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed'][index % 5];
            const lengthDetails = group.marker_length_details || {};
            const intervals = Array.isArray(lengthDetails.intervals) ? lengthDetails.intervals : [];
            const netStart = Number(lengthDetails.netStartCm ?? 0);
            const netEnd = Number(lengthDetails.netEndCm ?? 0);
            const netLengthCm = Number(lengthDetails.netLengthCm ?? netLengthM * 100);
            const productionLengthCm = Number(lengthDetails.productionLengthCm ?? groupLengthM * 100);
            const spacingCm = Number(lengthDetails.spacingCm ?? 0.5);
            const seamAllowanceCm = Number(lengthDetails.seamAllowanceCm ?? 1.5);

            return `
                <div class="card" style="border-left:4px solid ${color};margin:0 0 10px 0;">
                    <div style="font-size:16px;font-weight:600;margin-bottom:10px;">${materialName}</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                        <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                            <div style="font-size:12px;color:var(--text-secondary);">实裁长度</div>
                            <div style="font-size:15px;font-weight:600;">${formatMeterValue(groupLengthM, 3)} m</div>
                        </div>
                        <div style="display:none;background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                            <div style="font-size:12px;color:var(--text-secondary);">净排料长</div>
                            <div style="font-size:15px;font-weight:600;">${formatMeterValue(netLengthM, 3)} m</div>
                        </div>
                        <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                            <div style="font-size:12px;color:var(--text-secondary);">订单长度</div>
                            <div style="font-size:15px;font-weight:600;">${formatMeterValue(orderLengthM, 1)} m</div>
                        </div>
                        <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                            <div style="font-size:12px;color:var(--text-secondary);">订单面积</div>
                            <div style="font-size:15px;font-weight:600;">${orderAreaM2.toFixed(4)} m²</div>
                        </div>
                        <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                            <div style="font-size:12px;color:var(--text-secondary);">利用率</div>
                            <div style="font-size:15px;font-weight:600;">${groupUtilization.toFixed(1)}%</div>
                        </div>
                        ${weightKg > 0 ? `
                        <div style="background:var(--bg-secondary);padding:8px 12px;border-radius:6px;">
                            <div style="font-size:12px;color:var(--text-secondary);">重量</div>
                            <div style="font-size:15px;font-weight:600;">${weightKg.toFixed(3)} kg</div>
                        </div>
                        ` : ''}
                    </div>
                    <div style="display:none;margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid var(--border-color);border-radius:6px;font-size:12px;color:#334155;line-height:1.7;">
                        <div><strong>净长公式:</strong> ${netEnd.toFixed(1)} - ${netStart.toFixed(1)} = ${netLengthCm.toFixed(1)} cm</div>
                        <div><strong>实裁长度:</strong> ${productionLengthCm.toFixed(1)} cm；裁片间距: ${spacingCm.toFixed(1)} cm；缝份: ${seamAllowanceCm.toFixed(1)} cm</div>
                        ${intervals.length ? `
                        <details style="margin-top:6px;">
                            <summary style="cursor:pointer;color:#2563eb;">查看裁片长度区间</summary>
                            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:4px;margin-top:6px;">
                                ${intervals.map(item => `
                                    <div>${item.pieceName}: ${Number(item.startCm).toFixed(1)} - ${Number(item.endCm).toFixed(1)} = ${Number(item.lengthCm).toFixed(1)} cm</div>
                                `).join('')}
                            </div>
                        </details>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

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

    // ✅ 调用CAD渲染逻辑展示裁片效果
    renderCalcPiecePreviews(patternForCAD);

    // 5. 🧵 缝份预览 (完全复制cad.js的renderSeamAllowancePreviews)
    const seamForCAD = {
        pieces: (seam.pieces || []).map(p => ({
            name: p.name,
            pathOps: p.pathOps || [],
            seamAllowancePathOps: p.seamAllowancePathOps || [],
            seamAllowance: p.seamAllowance || 1.5,
            cutCount: 1,
            onFold: p.onFold || false
        }))
    };

    // ✅ 调用CAD渲染逻辑展示缝份效果
    renderCalcSeamAllowancePreviews(seamForCAD);

    // 📐 排料图渲染（与CAD完全一致）
    if (nestingGroups.length > 1) {
        renderCalcNestingGroupsV4(nestingGroups, inputData.fabric_width);
    } else if (nesting.pieces && nesting.positions) {
        console.log('[精确计算] 准备排料图数据...');
        console.log('[精确计算] result.nesting:', {
            hasPieces: !!nesting.pieces,
            piecesCount: (nesting.pieces || []).length,
            hasPositions: !!nesting.positions,
            positionsCount: (nesting.positions || []).length,
            hasNestingSvg: !!nesting.nesting_svg,
            hasNestingPng: !!nesting.nesting_png_base64
        });

        // ✅ 调用CAD渲染逻辑展示排料图效果
        renderCalcNestingWithReact(nesting, inputData.fabric_width);
    } else {
        console.log('[精确计算] ⚠️ 无排料数据，跳过排料图渲染');
    }
}

// ============================================================
// 🎨 CAD裁片渲染函数（完全复制自cad.js，用于精确计算）
// ============================================================

function renderCalcPiecePreviews(result) {
    const container = document.getElementById('calc-piece-previews-container');
    if (!container) return;

    let pieces = result.pieces || [];

    // 🔧 【工业标准】Preview模式只显示基础裁片（对称展示）
    const seenNames = new Set();
    pieces = pieces.filter(piece => {
        if (seenNames.has(piece.name)) {
            return false;
        }
        seenNames.add(piece.name);
        return true;
    });

    console.log(`[精确计算] 裁片预览: 过滤前=${result.pieces?.length || 0}个, 过滤后=${pieces.length}个`,
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

            convertCalcSVGToCanvas(canvas, pathOps, piece.name, piece);
        });
    }, 100);
}

function convertCalcSVGToCanvas(canvas, pathOps, pieceName, pieceData) {
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

    if (pieceData) {
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

// ============================================================
// 🧵 CAD缝份预览函数（完全复制自cad.js，用于精确计算）
// ============================================================

function renderCalcSeamAllowancePreviews(result) {
    const container = document.getElementById('calc-seam-allowance-container');
    if (!container) return;

    let pieces = result.pieces || [];

    // 🔧 【工业标准】缝份预览也只显示基础裁片（对称展示）
    const seenNames = new Set();
    pieces = pieces.filter(piece => {
        if (seenNames.has(piece.name)) {
            return false;
        }
        seenNames.add(piece.name);
        return true;
    });

    console.log(`[精确计算] 缝份预览: 过滤前=${result.pieces?.length || 0}个, 过滤后=${pieces.length}个`,
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

    // 底部信息文字
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const infoText = `轮廓: ${srcWidth.toFixed(1)} × ${srcHeight.toFixed(1)} cm | 缝份: ${pieceData?.seamAllowance || 0} cm`;

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

    ctx.restore();

    // 更新详细信息卡片（与CAD完全一致）
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

// ============================================================
// 📐 CAD排料图渲染函数（完全复制自cad.js，用于精确计算）
// ============================================================

function renderCalcNestingGroupsV4(groups, fabricWidth) {
    const container = document.getElementById('calc-nesting-container');
    if (!container) return;

    container.innerHTML = groups.map((group) => {
        const material = group.material || 'main';
        const materialName = group.material_name || MATERIAL_NAMES[material] || material;
        const image = group.nesting_png_base64 || '';
        const ext = image.startsWith('data:image/svg') ? 'svg' : 'png';
        const details = group.marker_length_details || {};
        const spacingCm = Number(details.spacingCm ?? 0.5);
        const seamAllowanceCm = Number(details.seamAllowanceCm ?? 1.5);
        const productionLengthM = Number(group.per_piece_length_m) || 0;
        const utilization = Number(group.utilization_rate || 0);

        return `
            <div style="width:100%;margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap;">
                    <strong style="font-size:15px;">${materialName}</strong>
                    <span style="font-size:12px;color:var(--text-secondary);">
                        实裁 ${formatMeterValue(productionLengthM, 3)} m · 裁片间距 ${spacingCm.toFixed(1)} cm · 缝份 ${seamAllowanceCm.toFixed(1)} cm · ${utilization.toFixed(1)}%
                    </span>
                </div>
                ${image ? `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                        <img src="${image}" alt="${materialName} 排料图" style="max-width:100%;height:auto;border:1px solid var(--border-color, #e0e0e0);border-radius:4px;"/>
                        <a href="${image}" download="calc_nesting_${material}.${ext}" style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;padding:8px 16px;border:1px solid var(--primary,#3b82f6);border-radius:4px;display:inline-block;">下载排料图</a>
                    </div>
                ` : '<p style="color:var(--text-secondary);text-align:center;padding:20px;">暂无排料图</p>'}
            </div>
        `;
    }).join('');
}

function renderCalcNestingGroupsV3(groups, fabricWidth) {
    const container = document.getElementById('calc-nesting-container');
    if (!container) return;

    container.innerHTML = groups.map((group) => {
        const material = group.material || 'main';
        const materialName = group.material_name || MATERIAL_NAMES[material] || material;
        const image = group.nesting_png_base64 || '';
        const ext = image.startsWith('data:image/svg') ? 'svg' : 'png';
        const details = group.marker_length_details || {};
        const spacingCm = Number(details.spacingCm ?? 0.5);
        const seamAllowanceCm = Number(details.seamAllowanceCm ?? 1.5);
        const productionLengthM = Number(group.per_piece_length_m) || 0;
        const utilization = Number(group.utilization_rate || 0);

        return `
            <div style="width:100%;margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap;">
                    <strong style="font-size:15px;">${materialName}</strong>
                    <span style="font-size:12px;color:var(--text-secondary);">
                        实裁 ${formatMeterValue(productionLengthM, 3)} m · 裁片间距 ${spacingCm.toFixed(1)} cm · 缝份 ${seamAllowanceCm.toFixed(1)} cm · ${utilization.toFixed(1)}%
                    </span>
                </div>
                ${image ? `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                        <img src="${image}" alt="${materialName} 排料图" style="max-width:100%;height:auto;border:1px solid var(--border-color, #e0e0e0);border-radius:4px;"/>
                        <a href="${image}" download="calc_nesting_${material}.${ext}" style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;padding:8px 16px;border:1px solid var(--primary,#3b82f6);border-radius:4px;display:inline-block;">下载排料图</a>
                    </div>
                ` : '<p style="color:var(--text-secondary);text-align:center;padding:20px;">暂无排料图</p>'}
            </div>
        `;
    }).join('');
}

function renderCalcNestingGroupsV2(groups, fabricWidth) {
    const container = document.getElementById('calc-nesting-container');
    if (!container) return;

    container.innerHTML = groups.map((group) => {
        const material = group.material || 'main';
        const materialName = group.material_name || MATERIAL_NAMES[material] || material;
        const image = group.nesting_png_base64 || '';
        const ext = image.startsWith('data:image/svg') ? 'svg' : 'png';
        const netLengthM = Number(group.net_length_m) || 0;
        const productionLengthM = Number(group.per_piece_length_m) || 0;
        const details = group.marker_length_details || {};
        const netStart = Number(details.netStartCm ?? 0);
        const netEnd = Number(details.netEndCm ?? 0);

        return `
            <div style="width:100%;margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
                    <strong style="font-size:15px;">${materialName}</strong>
                    <span style="font-size:12px;color:var(--text-secondary);">
                        净 ${formatMeterValue(netLengthM, 3)} m (${netEnd.toFixed(1)} - ${netStart.toFixed(1)} cm) · 实裁 ${formatMeterValue(productionLengthM, 3)} m · ${Number(group.utilization_rate || 0).toFixed(1)}%
                    </span>
                </div>
                ${image ? `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                        <img src="${image}" alt="${materialName} 排料图" style="max-width:100%;height:auto;border:1px solid var(--border-color, #e0e0e0);border-radius:4px;"/>
                        <a href="${image}" download="calc_nesting_${material}.${ext}" style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;padding:8px 16px;border:1px solid var(--primary,#3b82f6);border-radius:4px;display:inline-block;">下载排料图</a>
                    </div>
                ` : '<p style="color:var(--text-secondary);text-align:center;padding:20px;">暂无排料图</p>'}
            </div>
        `;
    }).join('');
}

function renderCalcNestingGroups(groups, fabricWidth) {
    const container = document.getElementById('calc-nesting-container');
    if (!container) return;

    container.innerHTML = groups.map((group) => {
        const material = group.material || 'main';
        const materialName = group.material_name || MATERIAL_NAMES[material] || material;
        const image = group.nesting_png_base64 || '';
        const ext = image.startsWith('data:image/svg') ? 'svg' : 'png';
        const netLengthM = Number(group.net_length_m) || 0;
        const productionLengthM = Number(group.per_piece_length_m) || 0;

        return `
            <div style="width:100%;margin-bottom:18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;">
                    <strong style="font-size:15px;">${materialName}</strong>
                    <span style="font-size:12px;color:var(--text-secondary);">
                        净 ${formatMeterValue(netLengthM, 3)} m · 实裁 ${formatMeterValue(productionLengthM, 3)} m · ${Number(group.utilization_rate || 0).toFixed(1)}%
                    </span>
                </div>
                ${image ? `
                    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
                        <img src="${image}" alt="${materialName} 排料图" style="max-width:100%;height:auto;border:1px solid var(--border-color, #e0e0e0);border-radius:4px;"/>
                        <a href="${image}" download="calc_nesting_${material}.${ext}" style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;padding:8px 16px;border:1px solid var(--primary,#3b82f6);border-radius:4px;display:inline-block;">下载排料图</a>
                    </div>
                ` : '<p style="color:var(--text-secondary);text-align:center;padding:20px;">暂无排料图</p>'}
            </div>
        `;
    }).join('');
}

function renderCalcNestingWithReact(result, fabricWidth) {
    console.log('[精确计算] 📐 开始渲染排料图...');
    console.log('[精确计算] 输入数据:', {
        hasPieces: !!result.pieces,
        piecesCount: (result.pieces || []).length,
        hasPositions: !!result.positions,
        positionsCount: (result.positions || []).length,
        hasNestingSvg: !!result.nesting_svg,
        nestingSvgLength: (result.nesting_svg || '').length,
        hasNestingPng: !!result.nesting_png_base64,
        nestingPngLength: (result.nesting_png_base64 || '').length,
        fabricWidth: fabricWidth
    });

    const container = document.getElementById('calc-nesting-container');
    if (!container) {
        console.error('[精确计算] ❌ 找不到容器: calc-nesting-container');
        return;
    }

    console.log('[精确计算] ✅ 容器找到');

    if (typeof window.renderNestingResult !== 'function') {
        console.warn('[精确计算] React组件未加载，使用SVG/PNG回退模式');

        // ✅ 【修复】直接显示排料图（保持专业效果）
        if (result.nesting_png_base64) {
            const isSvgData = result.nesting_png_base64.startsWith('data:image/svg');
            const ext = isSvgData ? 'svg' : 'png';
            container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">`
                + `<img src="${result.nesting_png_base64}" alt="排料图" `
                + `style="max-width:100%;height:auto;border:1px solid var(--border-color, #e0e0e0);border-radius:4px;"/>`
                + `<a href="${result.nesting_png_base64}" download="calc_nesting_result.${ext}" `
                + `style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;padding:8px 16px;border:1px solid var(--primary,#3b82f6);border-radius:4px;display:inline-block;">`
                + `📥 下载排料结果`
                + `</a>`
                + `</div>`;
        } else if (result.nesting_svg && result.nesting_svg.trim()) {
            let html = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;overflow:visible;">`;
            
            // 移除SVG的内联max-width限制，确保完整显示
            let svg_content = result.nesting_svg;
            svg_content = svg_content.replace(
                /style="[^"]*max-width:100%[^"]*"/g,
                'style="width:auto;height:auto;display:block;"'
            );

            html += svg_content;

            // 添加下载按钮
            html += `<div style="margin-top:8px;">`
                + `<a href="data:text/plain;charset=utf-8," + encodeURIComponent(svg_content) download="calc_nesting_result.svg" `
                + `style="font-size:13px;color:var(--primary,#3b82f6);text-decoration:none;padding:8px 16px;border:1px solid var(--primary,#3b82f6);border-radius:4px;display:inline-block;">`
                + `📥 下载SVG源码`
                + `</a>`
                + `</div>`;

            html += `</div>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:20px;">暂无排料数据</p>';
        }
        return;
    }

    // ✅ 使用React组件渲染（与CAD完全一致）
    console.log('[精确计算] 📊 原始pieces数据:', JSON.stringify(result.pieces || [], null, 2));
    console.log('[精确计算] 📊 原始positions数据:', JSON.stringify(result.positions || [], null, 2));

    const pieces = (result.pieces || []).map(p => {
        // 🔧 【工业标准】排料图使用展开后的完整形状（expandedPathOps）
        const pathOps = (p.onFold && p.expandedPathOps) ? p.expandedPathOps : p.pathOps;
        if (!pathOps || pathOps.length === 0) {
            console.warn(`[精确计算] ⚠️ 裁片 ${p.name} 缺少pathOps数据:`, p);
        } else {
            console.log(`[精确计算] ✅ 裁片 ${p.name} 有${pathOps.length}条路径指令`);
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
            height: (result.bounds?.height || 135)
        },
        totalArea: result.total_area_m2 ? result.total_area_m2 * 10000 : (result.totalArea || 0),
        usedArea: result.total_area_m2 ? (result.total_area_m2 * 10000 * (result.utilization_rate || 0) / 100) : (result.usedArea || 0)
    };

    console.log('[精确计算] 📊 转换后的pieces:', JSON.stringify(pieces.map(p => ({
        name: p.name,
        hasPathOps: p.pathOps.length > 0,
        pathOpsCount: p.pathOps.length
    })), null, 2));
    console.log('[精确计算] 📊 nestingResult:', JSON.stringify({
        positionsCount: nestingResult.positions.length,
        utilization: nestingResult.utilization,
        bounds: nestingResult.bounds
    }, null, 2));

    console.log('[精确计算] 调用 window.renderNestingResult...');
    
    try {
        const reactResult = window.renderNestingResult(pieces, nestingResult, fabricWidth);
        console.log('[精确计算] ✅ renderNestingResult返回值:', reactResult);
        console.log('[精确计算] ✅ 容器innerHTML长度:', container.innerHTML.length);
        console.log('[精确计算] ✅ 容器子元素数量:', container.children.length);
        
        if (container.innerHTML.trim() === '' || container.children.length === 0) {
            console.error('[精确计算] ❌ React组件未渲染任何内容！使用回退模式');
            // 回退到SVG/PNG显示
            if (result.nesting_png_base64) {
                const isSvgData = result.nesting_png_base64.startsWith('data:image/svg');
                container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">`
                    + `<img src="${result.nesting_png_base64}" alt="排料图" `
                    + `style="max-width:100%;height:auto;border:1px solid #e0e0e0;border-radius:4px;"/>`
                    + `<a href="${result.nesting_png_base64}" download="calc_nesting_result.${isSvgData ? 'svg' : 'png'}" `
                    + `style="font-size:13px;color:#3b82f6;text-decoration:none;padding:8px 16px;border:1px solid #3b82f6;border-radius:4px;display:inline-block;">`
                    + `📥 下载排料结果`
                    + `</a>`
                    + `</div>`;
                console.log('[精确计算] ✅ 已使用PNG/SVG回退模式');
            }
        }
    } catch (error) {
        console.error('[精确计算] ❌ renderNestingResult执行出错:', error);
        // 出错时也回退到简单显示
        if (result.nesting_png_base64) {
            container.innerHTML = `<img src="${result.nesting_png_base64}" alt="排料图错误回退" style="max-width:100%"/>`;
        } else {
            container.innerHTML = `<p style="color:red;padding:20px;">排料图渲染失败: ${error.message}</p>`;
        }
    }

    console.log(`[精确计算] ✅ 排料图渲染完成`);
}

window.renderCalcPiecePreviews = renderCalcPiecePreviews;
window.renderCalcSeamAllowancePreviews = renderCalcSeamAllowancePreviews;
window.renderCalcNestingGroupsV4 = renderCalcNestingGroupsV4;
window.renderCalcNestingWithReact = renderCalcNestingWithReact;

