/**
 * 面料用量快速计算系统 - 历史记录页面
 */

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
});

async function loadHistory() {
    try {
        const resp = await fetch('/api/history');
        const data = await resp.json();
        if (data.success) {
            renderHistory(data.data);
        }
    } catch (e) {
        console.error('加载历史记录失败:', e);
    }
}

function renderHistory(records) {
    const tbody = document.getElementById('history-tbody');

    if (!records || records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">暂无历史记录</td>
            </tr>
        `;
        return;
    }

    const CATEGORY_NAMES = {
        coat: '大衣', down_jacket: '羽绒服', jacket: '夹克',
        windbreaker: '风衣', cotton_padded: '棉服', pants: '裤子',
        skirt: '裙子', shirt: '衬衫', tshirt: 'T恤', custom: '自定义',
    };

    const MATERIAL_NAMES = {
        main: '主面料', lining: '里布', interlining: '衬布',
        filling_fabric_single: '胆料(单层)', filling_fabric_double: '胆料(双层)',
        rib: '罗纹', other: '其他',
    };

    tbody.innerHTML = records.map(record => {
        const typeLabels = { quick: '快速估算', precise: '精确计算', curved: '曲线计算' };
        const typeBadge = record.type === 'quick'
            ? '<span class="badge" style="background:#fef3c7;color:#d97706;">快速估算</span>'
            : record.type === 'curved'
            ? '<span class="badge" style="background:#ede9fe;color:#7c3aed;">曲线计算</span>'
            : '<span class="badge">精确计算</span>';

        let paramsStr = '';
        if (record.params) {
            if (record.params.garment_length) {
                paramsStr = `衣长${record.params.garment_length}cm 胸围${record.params.chest}cm`;
            } else if (record.params.fabric_width) {
                paramsStr = `门幅${record.params.fabric_width}cm`;
            }
        }

        let resultStr = '-';
        if (record.result) {
            // 优先显示材料用量汇总（长度）
            if (record.result.materials && Object.keys(record.result.materials).length > 0) {
                resultStr = Object.entries(record.result.materials)
                    .map(([name, usage]) => `${name}：${usage}m`)
                    .join('<br>');
            } else if (record.result.per_piece_length_m) {
                resultStr = `${record.result.per_piece_length_m} 米/件`;
            } else if (record.result.main_fabric_per_piece_m) {
                resultStr = `${record.result.main_fabric_per_piece_m} 米/件`;
            }
        }

        return `
            <tr>
                <td>${record.timestamp}</td>
                <td>${typeBadge}</td>
                <td>${CATEGORY_NAMES[record.category] || record.category || '-'}</td>
                <td style="font-size:12px;color:#64748b;">${paramsStr || '-'}</td>
                <td><strong>${resultStr}</strong></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="viewRecord('${record.id}')">查看</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteRecord('${record.id}')">删除</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function deleteRecord(id) {
    if (!confirm('确定删除此记录？')) return;
    try {
        await fetch(`/api/history/${id}`, { method: 'DELETE' });
        loadHistory();
    } catch (e) {
        alert('删除失败');
    }
}

async function clearHistory() {
    if (!confirm('确定清空所有历史记录？此操作不可恢复。')) return;
    try {
        await fetch('/api/history/clear', { method: 'POST' });
        loadHistory();
    } catch (e) {
        alert('清空失败');
    }
}

function viewRecord(id) {
    // 跳转到详情页面
    window.location.href = `/history/${id}`;
}

function refreshHistory() {
    loadHistory();
}
