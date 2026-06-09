(function () {
    'use strict';

    async function choose(options) {
        const overlay = document.createElement('div');
        overlay.className = 'export-format-overlay';
        overlay.innerHTML = `
            <div class="export-format-dialog" role="dialog" aria-modal="true" aria-label="选择导出格式">
                <div class="export-format-title">${escapeHtml(options.title || '选择导出格式')}</div>
                <div class="export-format-hint">Word 和 Excel 可继续修改，PDF 适合打印与发送。</div>
                <div class="export-format-options">
                    <button type="button" data-format="word"><strong>Word</strong><span>可编辑文档 .docx</span></button>
                    <button type="button" data-format="excel"><strong>Excel</strong><span>可编辑表格 .xlsx</span></button>
                    <button type="button" data-format="pdf"><strong>PDF</strong><span>打印或保存 PDF</span></button>
                </div>
                <button type="button" class="export-format-cancel">取消</button>
            </div>
        `;
        document.body.appendChild(overlay);

        return new Promise(resolve => {
            const close = value => {
                overlay.remove();
                resolve(value);
            };
            overlay.querySelectorAll('[data-format]').forEach(button => {
                button.addEventListener('click', async () => {
                    const format = button.dataset.format;
                    close(format);
                    if (format === 'pdf') {
                        options.onPdf?.();
                    } else if (options.document) {
                        await downloadDocument(format, options.document);
                    }
                });
            });
            overlay.querySelector('.export-format-cancel').addEventListener('click', () => close(null));
            overlay.addEventListener('click', event => {
                if (event.target === overlay) close(null);
            });
        });
    }

    async function downloadDocument(format, documentData) {
        try {
            const response = await fetch('/api/export/document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ format, document: documentData }),
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || '文件生成失败');
            }
            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition') || '';
            const matched = disposition.match(/filename\*=UTF-8''([^;]+)/i);
            const filename = matched ? decodeURIComponent(matched[1]) : `${documentData.filename || '导出文件'}.${format === 'word' ? 'docx' : 'xlsx'}`;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert(`导出失败: ${error.message}`);
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    window.ExportManager = { choose, downloadDocument };
})();
