/**
 * 面料用量快速计算系统 - 历史记录页面（支持分页和类型筛选）
 */

// 全局分页状态
let currentPage = 1;
let pageSize = 20;
let currentType = ''; // 当前筛选类型
let totalPages = 1;
let totalRecords = 0;

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
        // 构建查询参数
        const params = new URLSearchParams({
            page: currentPage,
            pageSize: pageSize,
        });

        if (currentType) {
            params.append('type', currentType);
        }

        const resp = await fetch(`/api/history?${params.toString()}`);
        const data = await resp.json();

        if (data.success) {
            // 更新分页状态
            if (data.pagination) {
                totalRecords = data.pagination.total;
                totalPages = data.pagination.totalPages;
                currentPage = data.pagination.page;
                pageSize = data.pagination.pageSize;
            }

            renderHistory(data.data);
            updatePaginationUI();
            updateRecordCount();
        }
    } catch (e) {
        console.error('加载历史记录失败:', e);
    }
}

function updateRecordCount() {
    const countEl = document.getElementById('record-count');
    if (countEl) {
        countEl.textContent = `共 ${totalRecords} 条记录`;
    }
}

function updatePaginationUI() {
    // 更新页码信息
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) {
        pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
    }

    // 更新上一页按钮
    const prevBtn = document.getElementById('btn-prev-page');
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }

    // 更新下一页按钮
    const nextBtn = document.getElementById('btn-next-page');
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }

    // 更新跳转输入框最大值
    const jumpInput = document.getElementById('page-jump-input');
    if (jumpInput) {
        jumpInput.max = totalPages;
        jumpInput.value = currentPage;
    }

    // 更新每页数量选择器
    const pageSizeSelect = document.getElementById('page-size-select');
    if (pageSizeSelect) {
        pageSizeSelect.value = pageSize;
    }
}

function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadHistory();
    }
}

function goToNextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadHistory();
    }
}

function jumpToPage() {
    const input = document.getElementById('page-jump-input');
    const page = parseInt(input?.value);

    if (page && page >= 1 && page <= totalPages) {
        currentPage = page;
        loadHistory();
    } else {
        alert(`请输入有效的页码 (1-${totalPages})`);
        if (input) input.value = currentPage;
    }
}

function onPageSizeChange() {
    const select = document.getElementById('page-size-select');
    if (select) {
        pageSize = parseInt(select.value);
        currentPage = 1; // 重置到第一页
        loadHistory();
    }
}

function onTypeFilterChange() {
    const select = document.getElementById('type-filter');
    if (select) {
        currentType = select.value;
        currentPage = 1; // 重置到第一页
        loadHistory();
    }
}

function refreshHistory() {
    currentPage = 1;
    loadHistory();
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
    // ✅ 登录检查：未登录则跳转到登录页面
    if (!Auth.requireLogin('删除记录')) return;

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
    // ✅ 登录检查：未登录则跳转到登录页面
    if (!Auth.requireLogin('查看详情')) return;

    window.location.href = `/history/${id}`;
}

function refreshHistory() {
    loadHistory();
}
