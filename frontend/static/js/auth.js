/**
 * 用户认证管理模块 v2.0
 * 优化版本：
 * - 下拉菜单式用户中心（无独立退出按钮）
 * - localStorage 缓存用户信息（避免重复请求）
 * - 智能横幅控制（不重复弹窗）
 */

const Auth = {
    currentUser: null,
    _hasShownBanner: false,  // 标记是否已显示过横幅
    
    /**
     * 初始化：优先从缓存读取，失败后再请求API
     */
    async init() {
        // ✅ 优化1：先尝试从 localStorage 读取缓存
        const cachedUser = this.getCachedUser();
        
        if (cachedUser) {
            // 有缓存，直接使用（快速渲染）
            this.currentUser = cachedUser;
            this.updateNavbar();
            
            // 后台静默验证（不影响UI）
            this.silentVerifySession();
        } else {
            // 无缓存，需要请求API
            await this.checkLoginStatus();
            this.updateNavbar();
        }
        
        // 页面级保护
        this.setupPageProtection();
        
        // 全局拦截器
        this.setupGlobalInterceptors();
        
        // 定期验证（每10分钟一次）
        setInterval(() => this.silentVerifySession(), 10 * 60 * 1000);
    },
    
    /**
     * 从 localStorage 读取缓存的用户信息
     */
    getCachedUser() {
        try {
            const cachedData = localStorage.getItem('auth_user_info');
            if (!cachedData) return null;
            
            const user = JSON.parse(cachedData);
            
            // 检查缓存是否过期（30分钟）
            const cacheTime = parseInt(localStorage.getItem('auth_cache_time') || '0');
            const now = Date.now();
            
            if (now - cacheTime > 30 * 60 * 1000) {
                // 缓存过期，清除并返回null
                this.clearCache();
                return null;
            }
            
            return user;
        } catch (e) {
            console.warn('[Auth] 读取缓存失败:', e);
            return null;
        }
    },
    
    /**
     * 将用户信息写入 localStorage 缓存
     */
    setCachedUser(user) {
        try {
            localStorage.setItem('auth_user_info', JSON.stringify(user));
            localStorage.setItem('auth_cache_time', Date.now().toString());
        } catch (e) {
            console.warn('[Auth] 写入缓存失败:', e);
        }
    },
    
    /**
     * 清除缓存
     */
    clearCache() {
        localStorage.removeItem('auth_user_info');
        localStorage.removeItem('auth_cache_time');
    },
    
    /**
     * 静默验证session有效性（后台执行，不影响UI）
     */
    async silentVerifySession() {
        try {
            const response = await fetch('/api/auth/current-user', { 
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            
            if (data.success && data.data) {
                // session有效，更新缓存
                this.currentUser = data.data;
                this.setCachedUser(data.data);
                
                // 只有当UI中的用户名与当前不一致时才更新（避免闪烁）
                const navUserEl = document.querySelector('.nav-user-name');
                if (navUserEl && navUserEl.textContent !== (data.data.nickname || data.data.username)) {
                    this.updateNavbar();
                }
            } else {
                // session失效，清除缓存和当前用户
                this.currentUser = null;
                this.clearCache();
                this.updateNavbar();
            }
        } catch (error) {
            console.error('[Auth] 静默验证失败:', error);
            // 静默失败，保持现状（可能是网络问题）
        }
    },
    
    /**
     * 更新导航栏（下拉菜单样式）
     */
    updateNavbar() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;
        
        // 移除旧的认证元素
        const oldElements = navLinks.querySelectorAll('.auth-element');
        oldElements.forEach(el => el.remove());
        
        if (this.currentUser) {
            // ✅ 已登录：下拉菜单样式（无独立退出按钮）
            const userMenu = document.createElement('div');
            userMenu.className = 'auth-element';
            userMenu.style.cssText = 'position:relative;margin-left:16px;';
            
            userMenu.innerHTML = `
                <div class="user-dropdown-trigger" style="
                    display:flex;align-items:center;gap:8px;
                    padding:6px 12px;border-radius:8px;
                    cursor:pointer;transition:background 0.2s;
                    font-size:14px;color:#334155;font-weight:500;
                    border:1px solid #e2e8f0;background:white;
                " onmouseenter="this.parentElement.querySelector('.dropdown-menu').style.display='block'"
                   onmouseleave="this.parentElement.querySelector('.dropdown-menu').style.display='none'">
                    <span style="font-size:18px;">👤</span>
                    <span class="nav-user-name">${this.currentUser.nickname || this.currentUser.username}</span>
                    <span style="font-size:12px;color:#94a3b8;">▼</span>
                    
                    <!-- 下拉菜单 -->
                    <div class="dropdown-menu" style="
                        display:none;position:absolute;top:calc(100% + 4px);right:0;
                        min-width:180px;background:white;border-radius:10px;
                        box-shadow:0 4px 20px rgba(0,0,0,0.15);
                        border:1px solid #e2e8f0;z-index:9999;padding:8px 0;
                    ">
                        <a href="/profile" class="dropdown-item" style="
                            display:block;padding:10px 16px;text-decoration:none;
                            color:#334155;font-size:14px;transition:background 0.15s;
                        " onmouseover="this.style.background='#f8fafc'"
                           onmouseout="this.style.background='transparent'">
                            👤 个人中心
                        </a>
                        <div style="height:1px;background:#e2e8f0;margin:4px 0;"></div>
                        <a href="#" onclick="Auth.logout();return false;" class="dropdown-item" style="
                            display:block;padding:10px 16px;text-decoration:none;
                            color:#dc2626;font-size:14px;transition:background 0.15s;
                        " onmouseover="this.style.background='#fef2f2'"
                           onmouseout="this.style.background='transparent'">
                            🚪 退出登录
                        </a>
                    </div>
                </div>
            `;
            
            navLinks.appendChild(userMenu);
            
            // 添加下拉菜单样式到head
            if (!document.getElementById('dropdown-styles')) {
                const style = document.createElement('style');
                style.id = 'dropdown-styles';
                style.textContent = `
                    .user-dropdown-trigger:hover { background: #f8fafc !important; }
                    .dropdown-menu::before {
                        content:'';position:absolute;top:-6px;right:20px;
                        width:12px;height:12px;background:white;
                        border-left:1px solid #e2e8f0;
                        border-top:1px solid #e2e8f0;
                        transform:rotate(45deg);
                    }
                `;
                document.head.appendChild(style);
            }
        } else {
            // 未登录：显示登录按钮
            const loginBtn = document.createElement('a');
            loginBtn.className = 'nav-link auth-element';
            loginBtn.href = '/login';
            loginBtn.textContent = '登录';
            loginBtn.style.cssText = 'background:#2563eb;color:white;';
            
            navLinks.appendChild(loginBtn);
        }
    },
    
    /**
     * ✅ 页面级保护（智能横幅控制）
     */
    setupPageProtection() {
        if (this.isLoggedIn()) return;
        
        // ✅ 优化3：检查今天是否已经显示过横幅
        const today = new Date().toDateString();
        const lastBannerDate = sessionStorage.getItem('last_banner_date');
        
        if (lastBannerDate === today) {
            // 今天已经显示过，不再重复弹窗
            console.log('[Auth] 📅 今天已显示过登录提示，跳过');
            return;
        }
        
        // 首次显示，记录日期
        sessionStorage.setItem('last_banner_date', today);
        
        // 禁用操作按钮
        this.disableActionButtons();
        
        // 显示横幅（带关闭功能）
        this.showLoginBanner();
    },
    
    /**
     * 禁用所有操作按钮
     */
    disableActionButtons() {
        const actionButtons = document.querySelectorAll(
            'button.btn-primary, button[type="submit"], .btn-calculate, .btn-nesting, [data-action]'
        );
        
        actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled-login');
            
            const originalText = btn.textContent || btn.innerText;
            btn.dataset.originalText = originalText;
            btn.innerHTML = `🔒 ${originalText}`;
            
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.requireLogin(this.getActionName(btn));
            });
        });
    },
    
    getActionName(element) {
        const text = element.textContent || element.innerText || '';
        if (text.includes('计算')) return '进行计算';
        if (text.includes('排料')) return '进行排料';
        if (text.includes('查看')) return '查看详情';
        if (text.includes('删除')) return '删除记录';
        return '此操作';
    },
    
    /**
     * 显示登录提示横幅（可关闭，关闭后当天不再显示）
     */
    showLoginBanner() {
        if (document.getElementById('login-banner')) return;
        
        const banner = document.createElement('div');
        banner.id = 'login-banner';
        banner.innerHTML = `
            <div class="banner-content">
                <span class="banner-icon">⚠️</span>
                <span class="banner-text">您尚未登录，部分功能受限</span>
                <a href="/login" class="banner-login-btn">立即登录</a>
                <span class="banner-close" onclick="Auth.closeBanner()">✕</span>
            </div>
        `;
        
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
        style.id = 'banner-styles';
        style.textContent = `
            #login-banner .banner-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
                max-width: 1200px;
                margin: 0 auto;
            }
            #login-banner .banner-icon { font-size: 20px; }
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
            #login-banner .banner-close:hover { opacity: 1; }
            @keyframes slideDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            button.disabled-login {
                background: #94a3b8 !important;
                cursor: not-allowed !important;
                position: relative;
                overflow: hidden;
            }
        `;
        
        document.head.appendChild(style);
        document.body.insertBefore(banner, document.body.firstChild);
        document.body.style.paddingTop = '60px';
    },
    
    /**
     * 关闭横幅（并标记今天不再显示）
     */
    closeBanner() {
        const banner = document.getElementById('login-banner');
        if (banner) {
            banner.style.animation = 'slideUp 0.3s ease-in forwards';
            setTimeout(() => {
                banner.remove();
                document.body.style.paddingTop = '';
            }, 300);
        }
        
        // 关闭动画
        if (!document.getElementById('close-banner-animation')) {
            const style = document.createElement('style');
            style.id = 'close-banner-animation';
            style.textContent = '@keyframes slideUp { to { transform: translateY(-100%); opacity: 0; } }';
            document.head.appendChild(style);
        }
    },
    
    /**
     * 全局401拦截器
     */
    setupGlobalInterceptors() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            
            if (response.status === 401 && !window.location.pathname.includes('/login')) {
                this.currentUser = null;
                this.clearCache();
                this.updateNavbar();
                
                setTimeout(() => {
                    window.location.href = '/login';
                }, 500);
            }
            
            return response;
        };
    },
    
    /**
     * 检查登录状态（用于初始化或强制刷新）
     */
    async checkLoginStatus() {
        try {
            const response = await fetch('/api/auth/current-user');
            const data = await response.json();
            
            if (data.success && data.data) {
                this.currentUser = data.data;
                this.setCachedUser(data.data);
                return true;
            } else {
                this.currentUser = null;
                this.clearCache();
                return false;
            }
        } catch (error) {
            console.error('[Auth] 检查登录状态失败:', error);
            this.currentUser = null;
            return false;
        }
    },
    
    /**
     * 要求登录
     */
    requireLogin(actionName = '此操作') {
        if (this.isLoggedIn()) return true;
        
        alert(`⚠️ 请先登录后再${actionName}\n\n即将跳转到登录页面...`);
        
        sessionStorage.setItem('redirect_after_login', window.location.href);
        window.location.href = '/login';
        
        return false;
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
                this.setCachedUser(data.data);
                this.updateNavbar();
                return { success: true };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
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
        } catch (error) {}
        
        this.currentUser = null;
        this.clearCache();
        this.updateNavbar();
        window.location.href = '/';
    },
    
    isLoggedIn() {
        return this.currentUser !== null;
    },
    
    getUserId() {
        return this.currentUser ? this.currentUser.user_id : null;
    },
};

// 页面加载时自动初始化
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
