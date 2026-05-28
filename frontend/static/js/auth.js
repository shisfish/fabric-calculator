/**
 * 用户认证管理模块
 * 处理登录状态、用户信息显示、会话管理等
 */

const Auth = {
    currentUser: null,
    
    /**
     * 初始化：检查登录状态并更新UI
     */
    async init() {
        await this.checkLoginStatus();
        this.updateNavbar();
        this.setupGlobalInterceptors();
        
        // ✅ 核心功能：页面级UI保护（未登录时立即禁用所有操作）
        this.setupPageProtection();
        
        // 每5分钟检查一次登录状态（防止session过期）
        setInterval(() => this.checkLoginStatus(), 5 * 60 * 1000);
    },
    
    /**
     * ✅ 页面级UI保护（未登录时禁用所有操作按钮）
     */
    setupPageProtection() {
        if (this.isLoggedIn()) return;  // 已登录，不执行
        
        console.log('[Auth] 🛡️ 未登录，启用页面级保护');
        
        // 1. 禁用所有主要操作按钮
        const actionButtons = document.querySelectorAll(
            'button.btn-primary, button[type="submit"], .btn-calculate, .btn-nesting, [data-action]'
        );
        
        actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled-login');  // 添加特殊样式类
            
            // 保存原始文本
            const originalText = btn.textContent || btn.innerText;
            btn.dataset.originalText = originalText;
            
            // 显示锁定图标和提示
            btn.innerHTML = `🔒 ${originalText}`;
            
            // 添加点击事件：跳转到登录页
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.requireLogin(this.getActionName(btn));
            });
        });
        
        // 2. 在页面顶部显示醒目的登录提示条
        this.showLoginBanner();
        
        // 3. 禁用所有表单输入（可选）
        // const inputs = document.querySelectorAll('input, select, textarea');
        // inputs.forEach(input => input.disabled = true);
    },
    
    /**
     * 获取操作的友好名称
     */
    getActionName(element) {
        const text = element.textContent || element.innerText || '';
        if (text.includes('计算')) return '进行计算';
        if (text.includes('排料')) return '进行排料';
        if (text.includes('查看')) return '查看详情';
        if (text.includes('删除')) return '删除记录';
        if (text.includes('保存')) return '保存数据';
        if (text.includes('提交')) return '提交数据';
        return '此操作';
    },
    
    /**
     * 显示顶部登录提示横幅
     */
    showLoginBanner() {
        if (document.getElementById('login-banner')) return;  // 避免重复创建
        
        const banner = document.createElement('div');
        banner.id = 'login-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">⚠️</span>
                <span class="banner-text">您尚未登录，部分功能受限</span>
                <a href="/login" class="banner-login-btn">立即登录</a>
                <span class="banner-close" onclick="this.parentElement.remove()">✕</span>
            </div>
        `;
        
        // 添加样式
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
            padding: 12px 20px;
            z-index: 99999;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
            animation: slideDown 0.4s ease-out;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            #login-banner .banner-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
                max-width: 1200px;
                margin: 0 auto;
            }
            #login-banner .banner-icon {
                font-size: 20px;
            }
            #login-banner .banner-text {
                font-size: 15px;
                font-weight: 500;
                flex: 1;
                text-align: center;
            }
            #login-banner .banner-login-btn {
                background: white;
                color: #d97706;
                padding: 6px 18px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            #login-banner .banner-login-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(255, 255, 255, 0.3);
            }
            #login-banner .banner-close {
                cursor: pointer;
                font-size: 18px;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            #login-banner .banner-close:hover {
                opacity: 1;
            }
            @keyframes slideDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            /* 禁用按钮的样式 */
            button.disabled-login {
                background: #94a3b8 !important;
                cursor: not-allowed !important;
                position: relative;
                overflow: hidden;
            }
            button.disabled-login::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(148, 163, 184, 0.1);
            }
        `;
        
        document.head.appendChild(style);
        document.body.insertBefore(banner, document.body.firstChild);
        
        // 给body增加padding-top，避免内容被遮挡
        document.body.style.paddingTop = '60px';
    },
    
    /**
     * 设置全局拦截器（拦截所有fetch请求）
     */
    setupGlobalInterceptors() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            
            // 如果返回401状态码，跳转到登录页
            if (response.status === 401 && !window.location.pathname.includes('/login')) {
                console.log('[Auth] Session过期或未登录，跳转到登录页面');
                this.currentUser = null;
                this.updateNavbar();
                
                // 延迟一点再跳转，让用户看到提示
                setTimeout(() => {
                    window.location.href = '/login';
                }, 500);
            }
            
            return response;
        };
    },
    
    /**
     * 检查当前登录状态
     */
    async checkLoginStatus() {
        try {
            const response = await fetch('/api/auth/current-user');
            const data = await response.json();
            
            if (data.success && data.data) {
                this.currentUser = data.data;
                localStorage.setItem('last_login_time', new Date().toLocaleString());
                return true;
            } else {
                this.currentUser = null;
                return false;
            }
        } catch (error) {
            console.error('[Auth] 检查登录状态失败:', error);
            this.currentUser = null;
            return false;
        }
    },
    
    /**
     * 更新导航栏（显示用户信息或登录按钮）
     */
    updateNavbar() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;
        
        // 移除旧的认证相关元素
        const oldAuthElements = navLinks.querySelectorAll('.auth-element');
        oldAuthElements.forEach(el => el.remove());
        
        if (this.currentUser) {
            // 已登录：显示用户信息 + 个人中心 + 退出按钮
            const userMenu = document.createElement('div');
            userMenu.className = 'auth-element';
            userMenu.style.cssText = 'display:flex;align-items:center;gap:12px;margin-left:16px;';
            
            userMenu.innerHTML = `
                <a href="/profile" class="nav-link" title="个人中心">
                    👤 ${this.currentUser.nickname || this.currentUser.username}
                </a>
                <button onclick="Auth.logout()" class="btn btn-sm btn-outline" style="padding:4px 12px;font-size:13px;">
                    退出
                </button>
            `;
            
            navLinks.appendChild(userMenu);
        } else {
            // 未登录：显示登录按钮
            const loginBtn = document.createElement('a');
            loginBtn.className = 'nav-link auth-element';
            loginBtn.href = '/login';
            loginBtn.textContent = '登录';
            loginBtn.style.background = '#2563eb';
            loginBtn.style.color = 'white';
            
            navLinks.appendChild(loginBtn);
        }
    },
    
    /**
     * ✅ 核心方法：要求登录后才能执行操作
     * @param {string} actionName - 操作名称（如"计算"、"保存"、"查看详情"）
     * @returns {boolean} 是否已登录（true=已登录可继续，false=未登录已拦截）
     */
    requireLogin(actionName = '此操作') {
        if (this.isLoggedIn()) {
            return true;  // 已登录，允许执行
        }
        
        // 未登录，显示提示并跳转
        alert(`⚠️ 请先登录后再${actionName}\n\n即将跳转到登录页面...`);
        
        // 记录当前URL，方便登录后返回
        sessionStorage.setItem('redirect_after_login', window.location.href);
        
        // 跳转到登录页
        window.location.href = '/login';
        
        return false;  // 未登录，已拦截
    },
    
    /**
     * 登录
     */
    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.data;
                localStorage.setItem('last_login_time', new Date().toLocaleString());
                this.updateNavbar();
                return { success: true };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('[Auth] 登录失败:', error);
            return { success: false, message: '网络错误' };
        }
    },
    
    /**
     * 登出
     */
    async logout() {
        if (!confirm('确定要退出登录吗？')) return;
        
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('[Auth] 登出请求失败:', error);
        }
        
        this.currentUser = null;
        localStorage.removeItem('last_login_time');
        window.location.href = '/login';
    },
    
    /**
     * 检查是否已登录（用于API调用前的验证）
     */
    isLoggedIn() {
        return this.currentUser !== null;
    },
    
    /**
     * 获取当前用户ID
     */
    getUserId() {
        return this.currentUser ? this.currentUser.user_id : null;
    },
    
    /**
     * 获取当前用户名
     */
    getUsername() {
        return this.currentUser ? this.currentUser.username : null;
    },
};

// 页面加载时自动初始化
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
