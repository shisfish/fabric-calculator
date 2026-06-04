/**
 * 用户认证管理模块 v3.0
 * 采用主流网站标准逻辑：
 * - 导航栏固定显示用户名（点击进入个人中心）
 * - 退出登录只在个人中心页面
 * - 页面切换时导航栏稳定不闪烁
 */

const Auth = {
    currentUser: null,
    
    /**
     * 初始化：优先从缓存读取，确保导航栏立即渲染
     */
    async init() {
        // 优先从缓存读取（毫秒级响应）
        const cachedUser = this.getCachedUser();
        
        if (cachedUser) {
            this.currentUser = cachedUser;
        } else {
            // 无缓存才请求API
            await this.checkLoginStatus();
        }
        
        // 立即渲染导航栏（无论是否有缓存）
        this.updateNavbar();
        
        // 后台静默验证（不影响UI）
        this.silentVerifySession();
        
        // 页面保护
        this.setupPageProtection();
        
        // 全局拦截器
        this.setupGlobalInterceptors();
        
        // 每10分钟静默验证一次
        setInterval(() => this.silentVerifySession(), 10 * 60 * 1000);
    },
    
    /**
     * 缓存管理
     */
    getCachedUser() {
        try {
            const data = localStorage.getItem('auth_user_info');
            if (!data) return null;
            
            const cacheTime = parseInt(localStorage.getItem('auth_cache_time') || '0');
            
            if (Date.now() - cacheTime > 30 * 60 * 1000) {
                this.clearCache();
                return null;
            }
            
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    },
    
    setCachedUser(user) {
        try {
            localStorage.setItem('auth_user_info', JSON.stringify(user));
            localStorage.setItem('auth_cache_time', Date.now().toString());
        } catch (e) {}
    },
    
    clearCache() {
        localStorage.removeItem('auth_user_info');
        localStorage.removeItem('auth_cache_time');
    },
    
    /**
     * 静默验证session
     */
    async silentVerifySession() {
        try {
            const response = await fetch('/api/auth/current-user', { 
                headers: { 'Cache-Control': 'no-cache' }
            });
            const data = await response.json();
            
            if (data.success && data.data) {
                this.currentUser = data.data;
                this.setCachedUser(data.data);
                
                // 只在用户名变化时更新UI（避免闪烁）
                const navName = document.querySelector('.nav-user-name');
                const newName = data.data.nickname || data.data.username;
                if (navName && navName.textContent !== newName) {
                    this.updateNavbar();
                }
            } else {
                this.currentUser = null;
                this.clearCache();
                this.updateNavbar();
            }
        } catch (error) {
            console.warn('[Auth] 静默验证失败:', error);
        }
    },
    
    /**
     * 更新导航栏 - 标准样式（固定显示，无下拉菜单）
     */
    updateNavbar() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;
        
        // 移除旧的认证元素
        navLinks.querySelectorAll('.auth-element').forEach(el => el.remove());
        
        if (this.currentUser) {
            // 已登录：显示用户名链接（点击进入个人中心）
            const userLink = document.createElement('a');
            userLink.className = 'nav-link nav-user-link auth-element';
            userLink.href = '/profile';
            userLink.innerHTML = `<span class="nav-user-icon">👤</span><span class="nav-user-name">${this.currentUser.nickname || this.currentUser.username}</span>`;
            
            navLinks.appendChild(userLink);
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
     * 页面级保护（智能横幅控制）
     */
    setupPageProtection() {
        if (this.isLoggedIn()) return;
        
        // 检查今天是否已显示过横幅
        const today = new Date().toDateString();
        if (sessionStorage.getItem('last_banner_date') === today) {
            return;  // 今天已显示过，跳过
        }
        
        sessionStorage.setItem('last_banner_date', today);
        
        // 禁用按钮
        this.disableActionButtons();
        
        // 显示横幅
        this.showLoginBanner();
    },
    
    disableActionButtons() {
        document.querySelectorAll(
            'button.btn-primary, button[type="submit"], .btn-calculate, .btn-nesting, [data-action]'
        ).forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled-login');
            
            const text = btn.textContent || btn.innerText;
            btn.dataset.originalText = text;
            btn.innerHTML = `🔒 ${text}`;
            
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
    
    showLoginBanner() {
        if (document.getElementById('login-banner')) return;
        
        const banner = document.createElement('div');
        banner.id = 'login-banner';
        banner.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;gap:16px;max-width:1200px;margin:0 auto;">
                <span style="font-size:20px;">⚠️</span>
                <span style="flex:1;text-align:center;font-size:15px;font-weight:500;">您尚未登录，部分功能受限</span>
                <a href="/login" style="background:white;color:#d97706;padding:6px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">立即登录</a>
                <span onclick="Auth.closeBanner()" style="cursor:pointer;font-size:18px;opacity:0.8;" onmouseover="this.opacity=1" onmouseout="this.opacity=0.8">✕</span>
            </div>
        `;
        
        banner.style.cssText = `
            position:fixed;top:0;left:0;right:0;
            background:linear-gradient(135deg,#f59e0b,#d97706);
            color:white;padding:12px 20px;z-index:99999;
            box-shadow:0 4px 12px rgba(245,158,11,0.4);
            animation:slideDown 0.4s ease-out;
            font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        `;
        
        if (!document.getElementById('banner-styles')) {
            const style = document.createElement('style');
            style.id = 'banner-styles';
            style.textContent = `
                @keyframes slideDown{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes slideUp{to{transform:translateY(-100%);opacity:0}}
                button.disabled-login{background:#94a3b8!important;cursor:not-allowed!important;}
            `;
            document.head.appendChild(style);
        }
        
        document.body.insertBefore(banner, document.body.firstChild);
        document.body.style.paddingTop = '60px';
    },
    
    closeBanner() {
        const banner = document.getElementById('login-banner');
        if (banner) {
            banner.style.animation = 'slideUp 0.3s ease-in forwards';
            setTimeout(() => {
                banner.remove();
                document.body.style.paddingTop = '';
            }, 300);
        }
    },
    
    setupGlobalInterceptors() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            
            if (response.status === 401 && !window.location.pathname.includes('/login')) {
                this.currentUser = null;
                this.clearCache();
                this.updateNavbar();
                setTimeout(() => window.location.href = '/login', 500);
            }
            
            return response;
        };
    },
    
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
            this.currentUser = null;
            return false;
        }
    },
    
    requireLogin(actionName = '此操作') {
        if (this.isLoggedIn()) return true;
        
        alert(`⚠️ 请先登录后再${actionName}\n\n即将跳转到登录页面...`);
        sessionStorage.setItem('redirect_after_login', window.location.href);
        window.location.href = '/login';
        return false;
    },
    
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
    
    async logout() {
        if (!confirm('确定要退出登录吗？')) return;
        
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {}
        
        this.currentUser = null;
        this.clearCache();
        window.location.href = '/';
    },
    
    isLoggedIn() {
        return this.currentUser !== null;
    },
    
    getUserId() {
        return this.currentUser ? this.currentUser.user_id : null;
    },
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
