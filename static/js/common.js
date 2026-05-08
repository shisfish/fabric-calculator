/**
 * 面料用量快速计算系统 - 公共模块
 * 
 * 包含：
 * 1. 字典缓存（品类、材料、形状名称映射）
 * 2. 品类图标映射
 * 3. 材料类型选项
 * 4. 形状选项
 * 5. 裁片默认值函数
 * 6. 通用工具函数
 */

// ========================================
// 字典缓存管理（从 API 获取，存入 localStorage）
// ========================================
const DictManager = {
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
// 品类图标映射
// ========================================
const CATEGORY_ICONS = {
    coat: "🧥", down_jacket: "🧥", jacket: "🧥",
    windbreaker: "🧥", cotton_padded: "🧥", pants: "👖",
    skirt: "👗", shirt: "👔", tshirt: "👕", custom: "✏️",
};

// ========================================
// 材料类型选项
// ========================================
const MATERIAL_OPTIONS = [
    { value: "main", label: "主面料" },
    { value: "lining", label: "里布" },
    { value: "interlining", label: "衬布" },
    { value: "filling_fabric_single", label: "胆料(单层)" },
    { value: "filling_fabric_double", label: "胆料(双层)" },
    { value: "rib", label: "罗纹" },
    { value: "other", label: "其他" },
];

// ========================================
// 形状选项
// ========================================
const SHAPE_OPTIONS = [
    { value: "rectangle", label: "矩形" },
    { value: "trapezoid", label: "梯形" },
    { value: "triangle", label: "三角形" },
    { value: "circle", label: "圆形" },
];

// ========================================
// 裁片默认值函数
// ========================================
function getDefaultPieceCount(pieceId) {
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
    };
    return countMap[pieceId] || 1;
}

function getDefaultMaterial(pieceId) {
    const materialMap = {
        'lining': 'lining', 'interlining': 'interlining',
        'filling_fabric_single': 'filling_fabric_single',
        'filling_fabric_double': 'filling_fabric_double',
        'down_filling': 'other', 'cotton_filling': 'other',
        'cuff': 'rib', 'bottom_rib': 'rib', 'collar_rib': 'rib',
    };
    return materialMap[pieceId] || 'main';
}

// ========================================
// 通用工具函数
// ========================================
function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) {
        el.style.display = show ? 'block' : 'none';
    }
}

async function loadCategories(onSuccess) {
    try {
        const resp = await fetch('/api/categories');
        const data = await resp.json();
        if (data.success && onSuccess) {
            onSuccess(data.data);
        }
    } catch (e) {
        console.error('加载品类失败:', e);
    }
}

function renderCategories(categories, onSelect) {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = categories.map(cat => `
        <div class="category-card" onclick="${onSelect}('${cat.id}')" data-id="${cat.id}">
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

// ========================================
// 页面初始化时自动加载字典
// ========================================
DictManager.useDefaults();
document.addEventListener('DOMContentLoaded', () => {
    DictManager.init();
});
