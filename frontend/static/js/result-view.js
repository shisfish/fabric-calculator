/**
 * Shared calculation result view.
 * Used by both the live precise-calculation final step and history detail.
 */
(function () {
    function render(options) {
        const root = typeof options.root === 'string'
            ? document.querySelector(options.root)
            : options.root;
        if (!root) return;

        const record = options.record || {};
        const full = normalizeFullResult(options.result || record.full_result || {});
        const inputData = options.inputData || record.input_data || {};
        const params = full.params || record.params || inputData || {};
        const type = record.type || options.type || 'precise';
        const category = record.category || inputData.category || inputData.measurements?.category || params.category;
        const materials = getMaterials(full, params);

        root.innerHTML = `
            <div class="card detail-card">
                <h3>📋 基本信息</h3>
                <div class="detail-info-grid">
                    ${renderInfoItems(record, params, category, type, full)}
                </div>
            </div>

            <div class="section">
                <h3>📊 结果概览</h3>
                <div class="result-cards">
                    ${renderSummaryCards(record, full, params, materials)}
                </div>
            </div>

            ${materials.length ? `
            <div class="section">
                <h3>📦 材料分类汇总</h3>
                <div class="detail-material-list">
                    ${materials.map(renderMaterialCard).join('')}
                </div>
            </div>
            ` : ''}

            ${renderImages(full)}

            ${renderNestingData(full, materials)}

            ${renderPieces(full, record, inputData)}
        `;
    }

    function normalizeFullResult(result) {
        const full = { ...result };
        if (!full.material_breakdown && full.material_totals) {
            full.material_breakdown = {};
            Object.entries(full.material_totals).forEach(([material, item]) => {
                full.material_breakdown[material] = {
                    name: item.name || item.material_name || getMaterialName(material),
                    length_m: firstDefined(item.per_piece_length_m, item.production_length_m),
                    area_m2: firstDefined(item.per_piece_area_m2, item.total_area_m2),
                    weight_kg: item.weight_kg,
                    width_utilization: item.utilization_rate,
                    total_length_m: item.total_length_m,
                };
            });
        }
        return full;
    }

    function renderInfoItems(record, params, category, type, full) {
        const items = [
            record.id ? ['记录ID', record.id] : null,
            ['计算类型', getTypeLabel(type)],
            ['服装品类', getCategoryName(category)],
            record.timestamp ? ['记录时间', record.timestamp] : null,
            ['面料门幅', formatWithUnit(firstDefined(params.fabric_width, params.fabricWidth, full.metadata?.fabricWidth), 'cm')],
            ['订单数量', formatWithUnit(firstDefined(params.quantity, record.result?.quantity), '件')],
            ['面料克重', formatWithUnit(firstDefined(params.fabric_weight_gsm, params.fabricWeight), 'g/m²')],
            ['缩水率', formatPercent(firstDefined(params.shrinkage_rate, params.shrinkRate), true)],
            ['缝份', formatWithUnit(firstDefined(params.seam_allowance, params.seamAllowance, full.metadata?.seamAllowance), 'cm')],
            ['面料类型', firstDefined(params.fabric_type, params.fabricType)],
        ].filter(item => item && item[1] !== undefined && item[1] !== null && item[1] !== '');

        return items.map(([label, value]) => `
            <div class="detail-info-item">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(String(value))}</strong>
            </div>
        `).join('');
    }

    function renderSummaryCards(record, full, params, materials) {
        const quantity = Number(firstDefined(params.quantity, record.result?.quantity, 1)) || 1;
        const materialPerPieceLength = sum(materials.map(item => toNumber(item.length_m)));
        const rawPerPieceLength = firstDefined(
            full.per_piece_length_m,
            full.nesting?.per_piece_length_m,
            record.result?.per_piece_length_m
        );
        const perPieceLength = toNumber(rawPerPieceLength) > 0 ? rawPerPieceLength : materialPerPieceLength;
        const totalLength = sum(materials.map(item => toNumber(firstDefined(item.total_length_m, toNumber(item.length_m) * quantity))));
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

        return cards.map(([label, value], index) => `
            <div class="result-card ${index === 0 ? 'highlight' : ''}">
                <div class="result-value">${escapeHtml(String(value || '-'))}</div>
                <div class="result-label">${escapeHtml(label)}</div>
            </div>
        `).join('');
    }

    function renderMaterialCard(item) {
        return `
            <div class="card detail-material-card">
                <div class="detail-material-title">${escapeHtml(item.name || item.material || '未命名材料')}</div>
                <div class="detail-metric-grid">
                    ${metricCell('用料长度', formatWithUnit(item.length_m, 'm'))}
                    ${metricCell('面积', formatWithUnit(item.area_m2, 'm²'))}
                    ${metricCell('重量', formatWithUnit(item.weight_kg, 'kg'))}
                    ${metricCell('门幅利用率', formatPercent(item.width_utilization))}
                </div>
            </div>
        `;
    }

    function renderImages(full) {
        const pieceImages = normalizeImages(full.piece_images, '裁片图');
        const seamImages = normalizeImages(full.seam_images, '缝份图');
        const nestingImages = normalizeImages(full.nesting_images, '排料图');
        if (!pieceImages.length && !seamImages.length && !nestingImages.length) return '';

        return `
            <div class="section">
                <h3>🖼 图形展示</h3>
                ${renderImageGroup('裁片图', pieceImages, 'piece-image-card')}
                ${renderImageGroup('缝份图', seamImages, 'piece-image-card')}
                ${renderImageGroup('排料图', nestingImages, 'nesting-image-card')}
            </div>
        `;
    }

    function renderImageGroup(title, images, cardClass) {
        if (!images.length) return '';
        return `
            <h4 class="detail-subtitle">${escapeHtml(title)}</h4>
            <div class="detail-image-grid">
                ${images.map(image => {
                    const src = image.file_path || image.src;
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

    function renderNestingData(full, materials) {
        const rows = getNestingRows(full, materials);
        if (!rows.length) return '';
        return `
            <div class="section">
                <h3>📐 排料数据</h3>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>材料</th>
                                <th>单件用料</th>
                                <th>净长度</th>
                                <th>面积</th>
                                <th>利用率</th>
                                <th>裁片数</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <td>${escapeHtml(row.material_name || row.name || row.material || '未命名材料')}</td>
                                    <td>${escapeHtml(formatWithUnit(firstDefined(row.per_piece_length_m, row.length_m, row.production_length_m), 'm'))}</td>
                                    <td>${escapeHtml(formatWithUnit(firstDefined(row.net_length_m, row.marker_length_m), 'm'))}</td>
                                    <td>${escapeHtml(formatWithUnit(firstDefined(row.total_area_m2, row.area_m2), 'm²'))}</td>
                                    <td>${escapeHtml(formatPercent(firstDefined(row.utilization_rate, row.width_utilization)))}</td>
                                    <td>${escapeHtml(String(getPieceCount(row)))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderPieces(full, record, inputData) {
        const pieces = getPieces(full, record, inputData);
        if (!pieces.length) return '';
        return `
            <div class="section">
                <h3>✂ 裁片明细</h3>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>裁片名称</th>
                                <th>原始尺寸(cm)</th>
                                <th>含缝份尺寸(cm)</th>
                                <th>数量</th>
                                <th>面积(cm²)</th>
                                <th>材料</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pieces.map(piece => `
                                <tr>
                                    <td>${escapeHtml(piece.name || '-')}</td>
                                    <td>${escapeHtml(formatSize(firstDefined(piece.original_length, piece.length, piece.height, piece.originalSize?.height), firstDefined(piece.original_width, piece.width, piece.originalSize?.width)))}</td>
                                    <td>${escapeHtml(formatSize(piece.effective_length, piece.effective_width))}</td>
                                    <td>${escapeHtml(String(firstDefined(piece.count, piece.quantity, piece.cutCount, 1)))}</td>
                                    <td>${escapeHtml(formatNumber(firstDefined(piece.area_cm2, piece.area, piece.area_with_shrinkage_cm2)))}</td>
                                    <td>${escapeHtml(getMaterialName(piece.material || 'main'))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function getMaterials(full, params) {
        const quantity = Number(firstDefined(params.quantity, 1)) || 1;
        const breakdown = full.material_breakdown || {};
        if (Object.keys(breakdown).length) {
            return Object.entries(breakdown).map(([material, value]) => ({
                material,
                name: value.name || value.material_name || getMaterialName(material),
                length_m: firstDefined(value.length_m, value.per_piece_length_m, value.production_length_m),
                area_m2: firstDefined(value.area_m2, value.per_piece_area_m2, value.total_area_m2),
                weight_kg: value.weight_kg,
                width_utilization: firstDefined(value.width_utilization, value.utilization_rate),
                total_length_m: value.total_length_m || (toNumber(firstDefined(value.length_m, value.per_piece_length_m)) * quantity),
            }));
        }
        if (Array.isArray(full.nesting_groups) && full.nesting_groups.length) {
            return full.nesting_groups.map((group, index) => ({
                material: group.material || `material_${index}`,
                name: group.material_name || getMaterialName(group.material),
                length_m: firstDefined(group.per_piece_length_m, group.production_length_m),
                area_m2: group.total_area_m2,
                weight_kg: group.weight_kg,
                width_utilization: group.utilization_rate,
                total_length_m: toNumber(group.per_piece_length_m) * quantity,
            }));
        }
        return [];
    }

    function getNestingRows(full, materials) {
        if (Array.isArray(full.nesting_groups) && full.nesting_groups.length) return full.nesting_groups;
        if (full.nesting && (full.nesting.pieces || full.nesting.per_piece_length_m)) return [full.nesting];
        return materials;
    }

    function getPieces(full, record, inputData) {
        if (Array.isArray(full.pieces_detail) && full.pieces_detail.length) return full.pieces_detail;
        if (Array.isArray(full.pattern?.pieces) && full.pattern.pieces.length) return full.pattern.pieces;
        if (Array.isArray(record.pieces) && record.pieces.length) return record.pieces;
        if (Array.isArray(inputData.pieces) && inputData.pieces.length) return inputData.pieces;
        if (Array.isArray(inputData.measurements?.pieces)) return inputData.measurements.pieces;
        return [];
    }

    function getPieceCount(row) {
        if (Array.isArray(row.pieces)) {
            return row.pieces.reduce((total, piece) => total + (Number(firstDefined(piece.quantity, piece.count, piece.cutCount, 1)) || 0), 0);
        }
        return firstDefined(row.totalPieces, row.statistics?.totalPieces, '-');
    }

    function normalizeImages(images, fallbackName) {
        return (images || [])
            .map(image => {
                const src = firstDefined(image.file_path, image.src, image.image_base64);
                if (!src) return null;
                return {
                    ...image,
                    name: image.name || image.image_name || fallbackName,
                    file_path: normalizePath(src),
                };
            })
            .filter(Boolean);
    }

    function normalizePath(path) {
        if (!path) return '';
        const value = String(path).replaceAll('\\', '/');
        if (value.startsWith('data:')) return value;
        if (value.startsWith('/static/')) return value;
        if (value.startsWith('static/')) return `/${value}`;
        if (value.startsWith('/')) return value;
        return `/static/${value}`;
    }

    function getExportText(recordOrResult) {
        const record = recordOrResult.full_result ? recordOrResult : { full_result: recordOrResult };
        const full = normalizeFullResult(record.full_result || recordOrResult || {});
        const materials = getMaterials(full, full.params || record.params || {});
        return [
            '=== 面料用量计算结果 ===',
            '',
            record.id ? `记录ID: ${record.id}` : null,
            record.timestamp ? `记录时间: ${record.timestamp}` : null,
            `计算类型: ${getTypeLabel(record.type || 'precise')}`,
            '',
            '--- 材料汇总 ---',
            ...materials.map(item => `${item.name || item.material}: ${formatWithUnit(item.length_m, 'm')} / ${formatWithUnit(item.area_m2, 'm²')} / ${formatPercent(item.width_utilization)}`),
        ].filter(Boolean).join('\n');
    }

    function metricCell(label, value) {
        return `
            <div class="detail-metric">
                <div>${escapeHtml(label)}</div>
                <strong>${escapeHtml(String(value || '-'))}</strong>
            </div>
        `;
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
        if (window.DictManager?.getCategoryName) return DictManager.getCategoryName(category, category);
        return category;
    }

    function getMaterialName(material) {
        if (window.DictManager?.getMaterialName) return DictManager.getMaterialName(material, material);
        return {
            main: '主面料',
            rib: '罗纹',
            lining: '里布',
            interlining: '衬布',
            filling: '胆料',
            cotton: '棉花/填充',
            filling_fabric_single: '胆料(单层)',
            filling_fabric_double: '胆料(双层)',
            other: '其他',
        }[material] || material || '-';
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
        return values.length ? sum(values) / values.length : 0;
    }

    function normalizePercentValue(value) {
        const number = toNumber(value);
        if (!number) return 0;
        return number > 1 ? number : number * 100;
    }

    function formatPercent(value, alreadyPercent = false) {
        if (value === undefined || value === null || value === '') return '-';
        const number = Number(value);
        if (!Number.isFinite(number)) return '-';
        const percent = alreadyPercent ? number : normalizePercentValue(number);
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

    window.ResultView = {
        render,
        getExportText,
        normalizeFullResult,
    };
})();
