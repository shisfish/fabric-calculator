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
        
        // 每5分钟检查一次登录状态（防止session过期）
        setInterval(() => this.checkLoginStatus(), 5 * 60 * 1000);
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
                
                // 如果当前页面不是登录页面，跳转到登录页
                const currentPath = window.location.pathname;
                if (currentPath !== '/login' && currentPath !== '/') {
                    // 不自动跳转，让用户手动操作
                    console.log('[Auth] 未登录');
                }
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
