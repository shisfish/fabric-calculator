/**
 * 面料用量快速计算系统 - 历史记录页面
 */

// 确认对话框
function showConfirm(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-icon">${options.icon || '️'}</div>
                <div class="confirm-title">${options.title || '确认操作'}</div>
                <div class="confirm-message">${options.message || '确定要执行此操作吗？'}</div>
                <div class="confirm-actions">
                    <button class="btn btn-outline" id="confirm-cancel">取消</button>
                    <button class="btn btn-danger" id="confirm-ok">确定</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cleanup = () => {
            overlay.style.animation = 'fadeIn 0.15s ease reverse';
            setTimeout(() => overlay.remove(), 150);
        };

        overlay.querySelector('#confirm-cancel').addEventListener('click', () => {
            cleanup();
            resolve(false);
        });

        overlay.querySelector('#confirm-ok').addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup();
                resolve(false);
            }
        });
    });
}

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

    tbody.innerHTML = records.map(record => {
        const typeLabels = { quick: '快速估算', precise: '精确计算', curved: '曲线计算', polygon: '多边形排料', cad: 'CAD排料' };
        const typeBadge = record.type === 'quick'
            ? '<span class="badge" style="background:#fef3c7;color:#d97706;">快速估算</span>'
            : record.type === 'curved'
            ? '<span class="badge" style="background:#ede9fe;color:#7c3aed;">曲线计算</span>'
            : record.type === 'polygon'
            ? '<span class="badge" style="background:#dbeafe;color:#2563eb;">多边形排料</span>'
            : record.type === 'cad'
            ? '<span class="badge" style="background:#dcfce7;color:#16a34a;">CAD排料</span>'
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

        const categoryName = DictManager.getCategoryName(record.category, record.category || '-');

        return `
            <tr>
                <td>${record.timestamp}</td>
                <td>${typeBadge}</td>
                <td>${categoryName}</td>
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
    const confirmed = await showConfirm({
        icon: '️',
        title: '删除确认',
        message: '确定删除此记录？'
    });
    if (!confirmed) return;
    try {
        await fetch(`/api/history/${id}`, { method: 'DELETE' });
        loadHistory();
    } catch (e) {
        alert('删除失败');
    }
}

async function clearHistory() {
    const confirmed = await showConfirm({
        icon: '️',
        title: '清空确认',
        message: '确定清空所有历史记录？此操作不可恢复。'
    });
    if (!confirmed) return;
    try {
        await fetch('/api/history/clear', { method: 'POST' });
        loadHistory();
    } catch (e) {
        alert('清空失败');
    }
}

function viewRecord(id) {
    window.location.href = `/history/${id}`;
}

function refreshHistory() {
    loadHistory();
}
