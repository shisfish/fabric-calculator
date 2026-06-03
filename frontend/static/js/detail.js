/**
 * 历史记录详情页
 * 渲染保存时的计算结果快照，避免从旧历史字段反推详情。
 */

let currentRecord = null;
let currentRecordType = 'precise';

document.addEventListener('DOMContentLoaded', () => {
    loadDetail();
});

async function loadDetail() {
    try {
        const resp = await fetch(`/api/history/${RECORD_ID}`);
        const data = await resp.json();

        if (!data.success) {
            showError(data.message || '记录不存在');
            return;
        }

        renderDetail(data.data);
    } catch (error) {
        showError(`加载失败: ${error.message}`);
    }
}

function showError(message) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
    document.getElementById('error-msg').textContent = message;
}

function renderDetail(record) {
    currentRecord = record;
    currentRecordType = record.type || 'precise';

    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('detail-content').style.display = 'block';
    document.getElementById('top-actions').style.display = 'flex';
    document.getElementById('btn-export').style.display = '';
    document.getElementById('btn-quotation').style.display = '';

    if (record.input_data) {
        document.getElementById('btn-edit').style.display = '';
    }

    const full = getFullResult(record);
    const params = getParams(record, full);
    const categoryName = getCategoryName(record.category || params.category || params.category_id);
    const typeLabel = getTypeLabel(currentRecordType);

    document.getElementById('detail-title').textContent = `${typeLabel} - ${categoryName}`;
    document.getElementById('detail-subtitle').textContent = `记录时间: ${record.timestamp || '-'}`;

    renderInfo(record, params, categoryName, typeLabel);
    renderSummary(record, full, params);
    renderMaterials(full);
    renderImages(record, full);
    renderNestingData(full);
    renderPieces(record, full);
}

function getFullResult(record) {
    return record.full_result || {};
}

function getParams(record, full) {
    return full.params || record.params || record.input_data || {};
}

function renderInfo(record, params, categoryName, typeLabel) {
    const items = [
        ['记录ID', record.id],
        ['计算类型', typeLabel],
        ['服装品类', categoryName],
        ['记录时间', record.timestamp],
        ['面料门幅', formatWithUnit(firstDefined(params.fabric_width, params.fabricWidth), 'cm')],
        ['订单数量', formatWithUnit(firstDefined(params.quantity, record.result?.quantity), '件')],
        ['面料克重', formatWithUnit(firstDefined(params.fabric_weight_gsm, params.fabricWeight), 'g/m²')],
        ['缩水率', formatPercent(firstDefined(params.shrinkage_rate, params.shrinkRate), { alreadyPercent: true })],
        ['缝份', formatWithUnit(firstDefined(params.seam_allowance, params.seamAllowance), 'cm')],
        ['面料类型', firstDefined(params.fabric_type, params.fabricType)],
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');

    document.getElementById('info-grid').innerHTML = items.map(([label, value]) => `
        <div class="detail-info-item">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
        </div>
    `).join('');
}

function renderSummary(record, full, params) {
    const quantity = Number(firstDefined(params.quantity, record.result?.quantity, 1)) || 1;
    const materials = getMaterials(full);
    const totalLength = sum(materials.map(item => toNumber(firstDefined(item.total_length_m, item.length_m * quantity))));
    const materialPerPieceLength = sum(materials.map(item => toNumber(item.length_m)));
    const rawPerPieceLength = firstDefined(
        full.per_piece_length_m,
        full.nesting?.per_piece_length_m,
        record.result?.per_piece_length_m
    );
    const perPieceLength = toNumber(rawPerPieceLength) > 0 ? rawPerPieceLength : materialPerPieceLength;
    const totalArea = firstDefined(
        full.total_area_m2,
        record.result?.total_area_m2,
        sum(materials.map(item => toNumber(item.area_m2) * quantity))
    );
    const weight = firstDefined(
        full.fabric_weight_kg,
        record.result?.fabric_weight_kg,
        sum(materials.map(item => toNumber(item.weight_kg) * quantity))
    );
    const utilization = firstDefined(
        full.utilization_rate,
        full.nesting?.utilization_rate,
        record.result?.utilization_rate,
        average(materials.map(item => normalizePercentValue(item.width_utilization)).filter(value => value > 0))
    );

    const cards = [
        ['单件用料', formatWithUnit(perPieceLength, 'm')],
        ['订单总长度', formatWithUnit(totalLength || (toNumber(perPieceLength) * quantity), 'm')],
        ['总面积', formatWithUnit(totalArea, 'm²')],
        ['门幅利用率', formatPercent(utilization)],
        ['材料种类', `${materials.length || 0} 种`],
        ['总重量', formatWithUnit(weight, 'kg')],
    ];

    document.getElementById('summary-cards').innerHTML = cards.map(([label, value], index) => `
        <div class="result-card ${index === 0 ? 'highlight' : ''}">
            <div class="result-value">${escapeHtml(String(value || '-'))}</div>
            <div class="result-label">${escapeHtml(label)}</div>
        </div>
    `).join('');
}

function renderMaterials(full) {
    const materials = getMaterials(full);
    const section = document.getElementById('materials-section');
    const container = document.getElementById('material-cards');

    if (!materials.length) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    container.innerHTML = materials.map(item => `
        <div class="card detail-material-card">
            <div class="detail-material-title">${escapeHtml(item.name || item.material || '未命名材料')}</div>
            <div class="detail-metric-grid">
                ${metricCell('用料长度', formatWithUnit(item.length_m, 'm'))}
                ${metricCell('面积', formatWithUnit(item.area_m2, 'm²'))}
                ${metricCell('重量', formatWithUnit(item.weight_kg, 'kg'))}
                ${metricCell('门幅利用率', formatPercent(item.width_utilization))}
            </div>
        </div>
    `).join('');
}

function renderImages(record, full) {
    const pieceImages = normalizeImages(full.piece_images || record.piece_images || [], '裁片图');
    const seamImages = normalizeImages(full.seam_images || record.seam_images || [], '缝份图');
    const nestingImages = normalizeImages(full.nesting_images || record.nesting_images || [], '排料图');
    const hasImages = pieceImages.length || seamImages.length || nestingImages.length;

    document.getElementById('images-section').style.display = hasImages ? '' : 'none';
    renderImageGroup('piece-images', '裁片图', pieceImages, 'piece-image-card');
    renderImageGroup('seam-images', '缝份图', seamImages, 'piece-image-card');
    renderImageGroup('nesting-images', '排料图', nestingImages, 'nesting-image-card');
}

function renderImageGroup(containerId, title, images, cardClass) {
    const container = document.getElementById(containerId);
    if (!images.length) {
        container.style.display = 'none';
        return;
    }

    container.style.display = '';
    container.innerHTML = `
        <h4 class="detail-subtitle">${escapeHtml(title)}</h4>
        <div class="detail-image-grid">
            ${images.map(image => {
                const src = normalizePath(image.file_path);
                const name = image.material_name || image.name || title;
                return `
                    <div class="${cardClass}">
                        <div class="${cardClass === 'nesting-image-card' ? 'nesting-image-header' : 'piece-image-footer'}">
                            <span class="${cardClass === 'nesting-image-card' ? 'material-name' : 'piece-name'}">${escapeHtml(name)}</span>
                            <a class="btn-download" href="${escapeAttr(src)}" download>下载</a>
                        </div>
                        <img src="${escapeAttr(src)}" alt="${escapeAttr(name)}" onclick="window.open('${escapeJs(src)}', '_blank')">
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderNestingData(full) {
    const rows = getNestingRows(full);
    const section = document.getElementById('nesting-data-section');
    const tbody = document.getElementById('nesting-data-tbody');

    if (!rows.length) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    tbody.innerHTML = rows.map(row => `
        <tr>
            <td>${escapeHtml(row.material_name || row.name || row.material || '未命名材料')}</td>
            <td>${escapeHtml(formatWithUnit(firstDefined(row.per_piece_length_m, row.length_m, row.production_length_m), 'm'))}</td>
            <td>${escapeHtml(formatWithUnit(firstDefined(row.net_length_m, row.marker_length_m), 'm'))}</td>
            <td>${escapeHtml(formatWithUnit(firstDefined(row.total_area_m2, row.area_m2), 'm²'))}</td>
            <td>${escapeHtml(formatPercent(firstDefined(row.utilization_rate, row.width_utilization)))}</td>
            <td>${escapeHtml(String(getPieceCount(row)))}</td>
        </tr>
    `).join('');
}

function renderPieces(record, full) {
    const pieces = getPieces(record, full);
    const section = document.getElementById('pieces-section');
    const tbody = document.getElementById('pieces-tbody');

    if (!pieces.length) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    tbody.innerHTML = pieces.map(piece => `
        <tr>
            <td>${escapeHtml(piece.name || '-')}</td>
            <td>${escapeHtml(formatSize(firstDefined(piece.original_length, piece.length, piece.originalSize?.height), firstDefined(piece.original_width, piece.width, piece.originalSize?.width)))}</td>
            <td>${escapeHtml(formatSize(piece.effective_length, piece.effective_width))}</td>
            <td>${escapeHtml(String(firstDefined(piece.count, piece.quantity, piece.cutCount, 1)))}</td>
            <td>${escapeHtml(formatNumber(firstDefined(piece.area_cm2, piece.area, piece.area_with_shrinkage_cm2)))}</td>
            <td>${escapeHtml(getMaterialName(piece.material || 'main'))}</td>
        </tr>
    `).join('');
}

function editRecord() {
    if (!currentRecord || !currentRecord.input_data) return;

    const targets = {
        curved: '/curves',
        polygon: '/polygon-nesting',
        cad: '/cad',
        precise: '/',
    };
    window.location.href = `${targets[currentRecordType] || '/'}?edit=${RECORD_ID}`;
}

function exportDetailResult() {
    if (!currentRecord) {
        alert('暂无可导出的结果');
        return;
    }

    const full = getFullResult(currentRecord);
    const materials = getMaterials(full);
    const lines = [
        '=== 面料用量计算结果 ===',
        '',
        `记录ID: ${currentRecord.id}`,
        `记录时间: ${currentRecord.timestamp}`,
        `计算类型: ${getTypeLabel(currentRecordType)}`,
        `服装品类: ${getCategoryName(currentRecord.category)}`,
        '',
        '--- 材料汇总 ---',
        ...materials.map(item => `${item.name || item.material}: ${formatWithUnit(item.length_m, 'm')} / ${formatWithUnit(item.area_m2, 'm²')} / ${formatPercent(item.width_utilization)}`),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `用量计算_${currentRecord.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
}

function goToQuotationFromDetail() {
    if (currentRecord) {
        sessionStorage.setItem('consumptionData', JSON.stringify(currentRecord.full_result || currentRecord.result || {}));
    }
    window.location.href = '/quotation';
}

function getMaterials(full) {
    const breakdown = full.material_breakdown || {};
    if (Object.keys(breakdown).length) {
        return Object.entries(breakdown).map(([material, value]) => ({
            material,
            name: value.name || value.material_name || getMaterialName(material),
            length_m: firstDefined(value.length_m, value.per_piece_length_m, value.production_length_m),
            area_m2: firstDefined(value.area_m2, value.per_piece_area_m2, value.total_area_m2),
            weight_kg: value.weight_kg,
            width_utilization: firstDefined(value.width_utilization, value.utilization_rate),
            total_length_m: value.total_length_m,
        }));
    }

    const totals = full.material_totals || {};
    return Object.entries(totals).map(([material, value]) => ({
        material,
        name: value.name || value.material_name || getMaterialName(material),
        length_m: firstDefined(value.per_piece_length_m, value.production_length_m),
        area_m2: firstDefined(value.per_piece_area_m2, value.total_area_m2),
        weight_kg: value.weight_kg,
        width_utilization: value.utilization_rate,
        total_length_m: value.total_length_m,
    }));
}

function getNestingRows(full) {
    if (Array.isArray(full.nesting_groups) && full.nesting_groups.length) {
        return full.nesting_groups;
    }
    if (full.nesting && (full.nesting.pieces || full.nesting.per_piece_length_m)) {
        return [full.nesting];
    }
    return getMaterials(full);
}

function getPieces(record, full) {
    if (Array.isArray(full.pieces_detail) && full.pieces_detail.length) return full.pieces_detail;
    if (Array.isArray(full.pattern?.pieces) && full.pattern.pieces.length) return full.pattern.pieces;
    if (Array.isArray(record.pieces) && record.pieces.length) return record.pieces;
    if (Array.isArray(record.input_data?.pieces) && record.input_data.pieces.length) return record.input_data.pieces;
    if (Array.isArray(record.input_data?.measurements?.pieces)) return record.input_data.measurements.pieces;
    return [];
}

function getPieceCount(row) {
    if (Array.isArray(row.pieces)) {
        return row.pieces.reduce((sum, piece) => sum + (Number(firstDefined(piece.quantity, piece.count, piece.cutCount, 1)) || 0), 0);
    }
    return firstDefined(row.totalPieces, row.statistics?.totalPieces, '-');
}

function normalizeImages(images, fallbackName) {
    return (images || [])
        .filter(image => image && image.file_path)
        .map(image => ({
            ...image,
            name: image.name || image.image_name || fallbackName,
            file_path: normalizePath(image.file_path),
        }));
}

function normalizePath(path) {
    if (!path) return '';
    const normalized = String(path).replaceAll('\\', '/');
    if (normalized.startsWith('/static/')) return normalized;
    if (normalized.startsWith('static/')) return `/${normalized}`;
    if (normalized.startsWith('/')) return normalized;
    return `/static/${normalized}`;
}

function getTypeLabel(type) {
    return {
        quick: '快速估算',
        precise: '精确计算',
        curved: '曲线计算',
        polygon: '多边形排料',
        cad: 'CAD排料',
    }[type] || '精确计算';
}

function getCategoryName(category) {
    if (!category) return '-';
    if (window.DictManager?.getCategoryName) {
        return DictManager.getCategoryName(category, category);
    }
    return category;
}

function getMaterialName(material) {
    if (window.DictManager?.getMaterialName) {
        return DictManager.getMaterialName(material, material);
    }
    return {
        main: '主面料',
        rib: '罗纹',
        lining: '里布',
        interlining: '衬布',
        filling: '胆料',
        cotton: '棉花/填充',
    }[material] || material || '-';
}

function metricCell(label, value) {
    return `
        <div class="detail-metric">
            <div>${escapeHtml(label)}</div>
            <strong>${escapeHtml(String(value || '-'))}</strong>
        </div>
    `;
}

function firstDefined(...values) {
    return values.find(value => value !== undefined && value !== null && value !== '');
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function sum(values) {
    return values.reduce((total, value) => total + toNumber(value), 0);
}

function average(values) {
    if (!values.length) return 0;
    return sum(values) / values.length;
}

function normalizePercentValue(value) {
    const number = toNumber(value);
    if (!number) return 0;
    return number > 1 ? number : number * 100;
}

function formatPercent(value, options = {}) {
    if (value === undefined || value === null || value === '') return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const percent = options.alreadyPercent ? number : normalizePercentValue(number);
    return `${percent.toFixed(1)}%`;
}

function formatWithUnit(value, unit) {
    if (value === undefined || value === null || value === '') return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return `${value} ${unit}`;
    const digits = unit === 'm²' || unit === 'kg' ? 4 : 3;
    return `${formatNumber(number, digits)} ${unit}`;
}

function formatNumber(value, maxDigits = 2) {
    if (value === undefined || value === null || value === '') return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDigits,
    });
}

function formatSize(length, width) {
    if (!length && !width) return '-';
    return `${formatNumber(length)} × ${formatNumber(width)}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function escapeJs(value) {
    return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}
