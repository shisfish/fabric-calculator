(function () {
    'use strict';

    const ICONS = {
        scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.7 8.3 11.8 7.2M8.7 15.7l11.8-7.2"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        shirt: '<path d="m8 4 4 2 4-2 5 4-3 4-2-1v10H8V11l-2 1-3-4z"/>',
        coat: '<path d="m9 3 3 3 3-3 4 4-2 4v10H7V11L5 7zM12 6v15M9 11h1M14 11h1"/>',
        pants: '<path d="M7 3h10l1 18h-5l-1-10-1 10H6z"/>',
        dress: '<path d="M9 3h6l1 5-2 2 5 11H5l5-11-2-2z"/>',
        pencil: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 6.5 17 10"/>',
        camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        refresh: '<path d="M20 7v5h-5M4 17v-5h5M6.1 8A7 7 0 0 1 18 6l2 6M18 16a7 7 0 0 1-11.9 2L4 12"/>',
        ruler: '<path d="m4 17 13-13 3 3L7 20H4zM13 8l3 3M10 11l2 2M7 14l3 3"/>',
        lightbulb: '<path d="M9 18h6M10 22h4M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2z"/>',
        calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 19h1M12 19h5"/>',
        download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
        money: '<circle cx="12" cy="12" r="9"/><path d="M16 8h-5a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H8M12 6v12"/>',
        clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/>',
        package: '<path d="m3 7 9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
        palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h3a6 6 0 0 0 0-12z"/><circle cx="8" cy="10" r=".7"/><circle cx="10" cy="7" r=".7"/><circle cx="14" cy="6" r=".7"/><circle cx="17" cy="9" r=".7"/>',
        thread: '<path d="M8 3h8l-1 4 1 4-1 4 1 4H8l1-4-1-4 1-4zM9 7h6M9 11h6M9 15h6"/>',
        layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M8 10h13"/>',
        tag: '<path d="M20 13 13 20 4 11V4h7z"/><circle cx="8.5" cy="8.5" r="1"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1A8 8 0 0 0 15 6l-.3-3h-4L10 6a8 8 0 0 0-1.5 1L6 6 4 9.5 6 11a7 7 0 0 0 0 2l-2 1.5L6 18l2.5-1a8 8 0 0 0 1.5 1l.7 3h4l.3-3a8 8 0 0 0 1.5-1l2.5 1 2-3.5-2-1.5a7 7 0 0 0 0-1z"/>',
        printer: '<path d="M6 9V3h12v6M6 18H4V10h16v8h-2M7 15h10v6H7zM17 12h1"/>',
        chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
        id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c1-2 5-2 6 0M14 10h4M14 14h4"/>',
        shield: '<path d="M12 3 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6zM9 12l2 2 4-4"/>',
        history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
        lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        alert: '<path d="M12 3 2 21h20zM12 9v5M12 18h.01"/>',
        help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.2-1 2.2M12 17h.01"/>',
        x: '<path d="m6 6 12 12M18 6 6 18"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
        rocket: '<path d="M14 4c3-2 6-1 6-1s1 3-1 6l-6 6-4-4zM9 11l-4 1-2 3 6 1M13 15l-1 4-3 2-1-6"/><circle cx="15.5" cy="7.5" r="1.5"/>',
        zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'
    };

    const EMOJI_ICONS = new Map([
        ['✂️', 'scissors'], ['✂', 'scissors'], ['👤', 'user'], ['🧥', 'coat'],
        ['👔', 'shirt'], ['👕', 'shirt'], ['👖', 'pants'], ['👗', 'dress'],
        ['✏️', 'pencil'], ['✏', 'pencil'], ['✎', 'pencil'], ['📷', 'camera'],
        ['📸', 'camera'], ['✅', 'check'], ['🔄', 'refresh'], ['📏', 'ruler'],
        ['💡', 'lightbulb'], ['🧮', 'calculator'], ['📥', 'download'], ['💰', 'money'],
        ['📋', 'clipboard'], ['📦', 'package'], ['🖼️', 'image'], ['🖼', 'image'],
        ['🎨', 'palette'], ['🧵', 'thread'], ['📐', 'layout'], ['🏷️', 'tag'],
        ['🏷', 'tag'], ['⚙️', 'settings'], ['⚙', 'settings'], ['🖨️', 'printer'],
        ['🖨', 'printer'], ['📊', 'chart'], ['📅', 'calendar'], ['🆔', 'id'],
        ['🛡️', 'shield'], ['🛡', 'shield'], ['📜', 'history'], ['🎯', 'target'],
        ['🚪', 'logout'], ['🔒', 'lock'], ['⚠️', 'alert'], ['⚠', 'alert'],
        ['❓', 'help'], ['❌', 'x'], ['✕', 'x'], ['🔍', 'search'],
        ['🚀', 'rocket'], ['⚡', 'zap']
    ]);

    function ensureSprite() {
        if (document.getElementById('app-icon-sprite')) return;
        const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        sprite.id = 'app-icon-sprite';
        sprite.setAttribute('aria-hidden', 'true');
        sprite.style.display = 'none';
        sprite.innerHTML = Object.entries(ICONS)
            .map(([name, body]) => `<symbol id="app-icon-${name}" viewBox="0 0 24 24">${body}</symbol>`)
            .join('');
        (document.body || document.documentElement).prepend(sprite);
    }

    function createIcon(name, className, label) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('app-icon');
        String(className || '').split(/\s+/).filter(Boolean).forEach(item => svg.classList.add(item));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('focusable', 'false');
        if (label) {
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', label);
        } else {
            svg.setAttribute('aria-hidden', 'true');
        }
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#app-icon-${ICONS[name] ? name : 'help'}`);
        svg.appendChild(use);
        return svg;
    }

    function replaceEmojiTextNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.nodeValue || parent.closest('script,style,textarea,input,pre,code,svg,[data-keep-emoji]')) return;
        const matches = Array.from(EMOJI_ICONS.keys()).filter(emoji => node.nodeValue.includes(emoji));
        if (!matches.length) return;

        const pattern = new RegExp(matches.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|'), 'g');
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        node.nodeValue.replace(pattern, (matched, offset) => {
            if (offset > cursor) fragment.appendChild(document.createTextNode(node.nodeValue.slice(cursor, offset)));
            fragment.appendChild(createIcon(EMOJI_ICONS.get(matched)));
            cursor = offset + matched.length;
            return matched;
        });
        if (cursor < node.nodeValue.length) fragment.appendChild(document.createTextNode(node.nodeValue.slice(cursor)));
        node.replaceWith(fragment);
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function upgrade(root) {
        ensureSprite();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(replaceEmojiTextNode);
    }

    function icon(name, className, label) {
        ensureSprite();
        return createIcon(name, className, label).outerHTML;
    }

    function ensureStyles() {
        if (document.getElementById('app-icon-styles')) return;
        const style = document.createElement('style');
        style.id = 'app-icon-styles';
        style.textContent = '.app-icon{width:1em;height:1em;display:inline-block;flex:0 0 auto;overflow:visible;vertical-align:-.14em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}';
        document.head.appendChild(style);
    }

    function initialize() {
        ensureStyles();
        if (!document.querySelector('link[rel~="icon"]')) {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/svg+xml';
            link.href = '/static/favicon.svg';
            document.head.appendChild(link);
        }
        upgrade(document.body);
        new MutationObserver(mutations => {
            mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) replaceEmojiTextNode(node);
                if (node.nodeType === Node.ELEMENT_NODE && node.id !== 'app-icon-sprite') upgrade(node);
            }));
        }).observe(document.body, { childList: true, subtree: true });
    }

    window.AppIcons = { icon, createIcon, upgrade };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
