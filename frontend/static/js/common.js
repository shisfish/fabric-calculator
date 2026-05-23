/**
 * 面料用量快速计算系统 - 公共模块
 * 
 * 包含：
 * 1. 字典缓存（品类、材料、形状名称映射）
 * 2. 通用工具函数
 */

// ========================================
// 字典缓存管理（从 API 获取，存入 localStorage）
// ========================================
window.DictManager = {
    STORAGE_KEY: 'fabric_calculator_dict',
    data: null,

    async init() {
        try {
            const cached = localStorage.getItem(this.STORAGE_KEY);
            if (cached) {
                this.data = JSON.parse(cached);
            }
            await this.loadFromServer();
        } catch (e) {
            // 静默失败，不影响页面功能
            this.useDefaults();
        }
    },

    async loadFromServer() {
        try {
            const resp = await fetch('/api/dictionaries');
            const data = await resp.json();
            if (data.success) {
                this.data = data.data;
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            }
        } catch (e) {
            // 静默失败
        }
    },

    useDefaults() {
        this.data = {
            category: {
                'coat': '大衣', 'down_jacket': '羽绒服', 'jacket': '夹克',
                'windbreaker': '风衣', 'cotton_padded': '棉服', 'pants': '裤子',
                'skirt': '裙子', 'shirt': '衬衫', 'tshirt': 'T恤', 'custom': '自定义'
            },
            material: {
                'main': '主面料', 'lining': '里布', 'interlining': '衬布',
                'filling_fabric_single': '胆料(单层)', 'filling_fabric_double': '胆料(双层)',
                'rib': '罗纹', 'other': '其他'
            },
            shape: {
                'rectangle': '矩形', 'trapezoid': '梯形',
                'triangle': '三角形', 'circle': '圆形'
            }
        };
    },

    getCategoryName(key, defaultVal) {
        return this.data?.category?.[key] || defaultVal || key;
    },

    getMaterialName(key, defaultVal) {
        return this.data?.material?.[key] || defaultVal || key;
    },

    getShapeName(key, defaultVal) {
        return this.data?.shape?.[key] || defaultVal || key;
    }
};

// 立即初始化字典（同步使用默认值）
window.DictManager.useDefaults();

// 页面加载完成后异步从服务器更新字典（不影响页面功能）
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.DictManager.init(), 100);
});

// ========================================
// 统一弹窗组件
// ========================================
window.Dialog = {
    // 显示警告弹窗
    showAlert(message, title = '提示') {
        return new Promise((resolve) => {
            // 创建遮罩层
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                animation: fadeIn 0.2s ease;
            `;
            
            // 创建弹窗容器
            const dialog = document.createElement('div');
            dialog.className = 'dialog-container';
            dialog.style.cssText = `
                background: #1a1a1a;
                border-radius: 12px;
                padding: 24px;
                min-width: 320px;
                max-width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.3s ease;
            `;
            
            // 创建标题
            const titleEl = document.createElement('div');
            titleEl.style.cssText = `
                font-size: 16px;
                font-weight: 600;
                color: #fff;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            titleEl.innerHTML = `<span style="font-size: 20px;">⚠️</span>${title}`;
            
            // 创建内容
            const content = document.createElement('div');
            content.style.cssText = `
                font-size: 14px;
                color: rgba(255, 255, 255, 0.85);
                line-height: 1.6;
                margin-bottom: 20px;
            `;
            content.textContent = message;
            
            // 创建按钮
            const button = document.createElement('button');
            button.style.cssText = `
                width: 100%;
                height: 40px;
                background: linear-gradient(135deg, #4a6cf7, #3b5bdb);
                border: 1px solid rgba(74, 108, 247, 0.3);
                border-radius: 8px;
                color: #fff;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            `;
            button.innerHTML = '确定';
            
            button.onclick = () => {
                overlay.remove();
                resolve();
            };
            
            button.addEventListener('mouseenter', () => {
                button.style.background = 'linear-gradient(135deg, #3b5bdb, #2c4aab)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.background = 'linear-gradient(135deg, #4a6cf7, #3b5bdb)';
            });
            
            // 组装弹窗
            dialog.appendChild(titleEl);
            dialog.appendChild(content);
            dialog.appendChild(button);
            overlay.appendChild(dialog);
            
            // 添加动画样式
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(20px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
            `;
            document.head.appendChild(style);
            
            // 添加到页面
            document.body.appendChild(overlay);
            
            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve();
                }
            });
        });
    },
    
    // 显示确认弹窗
    async showConfirm(message, title = '确认') {
        return new Promise((resolve) => {
            // 创建遮罩层
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                animation: fadeIn 0.2s ease;
            `;
            
            // 创建弹窗容器
            const dialog = document.createElement('div');
            dialog.className = 'dialog-container';
            dialog.style.cssText = `
                background: #1a1a1a;
                border-radius: 12px;
                padding: 24px;
                min-width: 320px;
                max-width: 90%;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.3s ease;
            `;
            
            // 创建标题
            const titleEl = document.createElement('div');
            titleEl.style.cssText = `
                font-size: 16px;
                font-weight: 600;
                color: #fff;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            titleEl.innerHTML = `<span style="font-size: 20px;">❓</span>${title}`;
            
            // 创建内容
            const content = document.createElement('div');
            content.style.cssText = `
                font-size: 14px;
                color: rgba(255, 255, 255, 0.85);
                line-height: 1.6;
                margin-bottom: 20px;
            `;
            content.textContent = message;
            
            // 创建按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
            `;
            
            // 取消按钮
            const cancelBtn = document.createElement('button');
            cancelBtn.style.cssText = `
                flex: 1;
                height: 40px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: rgba(255, 255, 255, 0.7);
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            `;
            cancelBtn.innerHTML = '取消';
            cancelBtn.onclick = () => {
                overlay.remove();
                resolve(false);
            };
            
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            });
            
            // 确认按钮
            const confirmBtn = document.createElement('button');
            confirmBtn.style.cssText = `
                flex: 1;
                height: 40px;
                background: linear-gradient(135deg, #4a6cf7, #3b5bdb);
                border: 1px solid rgba(74, 108, 247, 0.3);
                border-radius: 8px;
                color: #fff;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            `;
            confirmBtn.innerHTML = '确认';
            confirmBtn.onclick = () => {
                overlay.remove();
                resolve(true);
            };
            
            confirmBtn.addEventListener('mouseenter', () => {
                confirmBtn.style.background = 'linear-gradient(135deg, #3b5bdb, #2c4aab)';
            });
            
            // 组装弹窗
            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);
            dialog.appendChild(titleEl);
            dialog.appendChild(content);
            dialog.appendChild(buttonContainer);
            overlay.appendChild(dialog);
            
            // 添加动画样式
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(20px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
            `;
            document.head.appendChild(style);
            
            // 添加到页面
            document.body.appendChild(overlay);
            
            // 点击遮罩关闭
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                    resolve(false);
                }
            });
        });
    }
};

// 替换全局 alert 为统一弹窗（保持向后兼容）
window._originalAlert = window.alert;
window.alert = async function(message) {
    await window.Dialog.showAlert(message);
};
