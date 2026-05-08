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
        const cached = localStorage.getItem(this.STORAGE_KEY);
        if (cached) {
            try {
                this.data = JSON.parse(cached);
                return;
            } catch (e) {
                console.warn('字典缓存解析失败，重新加载', e);
            }
        }
        await this.loadFromServer();
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
            console.warn('加载字典失败，使用本地默认值', e);
            this.useDefaults();
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

// ========================================
// 通用工具函数
// ========================================
window.showLoading = function(show) {
    const el = document.getElementById('loading');
    if (el) {
        el.style.display = show ? 'block' : 'none';
    }
};

// ========================================
// 立即初始化字典（同步使用默认值，后台异步更新）
// ========================================
window.DictManager.useDefaults();

// 页面加载完成后异步从服务器更新字典
document.addEventListener('DOMContentLoaded', () => {
    window.DictManager.init();
});
