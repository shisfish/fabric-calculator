/**
 * 历史记录详情页
 * 详情内容与精确计算最后一步共用 ResultView。
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

    const full = record.full_result || {};
    const params = full.params || record.params || record.input_data || {};
    const category = record.category || params.category || record.input_data?.category;
    const categoryName = getCategoryName(category);
    const typeLabel = getTypeLabel(currentRecordType);

    document.getElementById('detail-title').textContent = `${typeLabel} - ${categoryName}`;
    document.getElementById('detail-subtitle').textContent = `记录时间: ${record.timestamp || '-'}`;

    ResultView.render({
        root: '#detail-content',
        record,
        result: full,
        inputData: record.input_data || {},
        type: currentRecordType,
        mode: 'history',
    });
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

    if (!window.ResultView?.printReport) {
        alert('报告组件未加载，请刷新页面后重试');
        return;
    }
    ResultView.printReport(currentRecord);
}

function goToQuotationFromDetail() {
    if (currentRecord) {
        sessionStorage.setItem('consumptionData', JSON.stringify(currentRecord));
    }
    window.location.href = '/quotation';
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
