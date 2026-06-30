document.addEventListener('DOMContentLoaded', () => {

    // Global State
    let projectData = null;
    let flatNavList = [];
    let currentSectionId = null;

    // DOM Elements
    const navList = document.getElementById('nav-list');
    const contentContainer = document.getElementById('content-container');
    const searchInput = document.getElementById('search-input');
    const bottomNav = document.getElementById('bottom-nav');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const prevLabel = document.getElementById('prev-label');
    const nextLabel = document.getElementById('next-label');
    
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');
    const projectVersion = document.getElementById('project-version');

    // Theme Setup & LocalStorage
    const themeBtn = document.getElementById('theme-btn');
    const themeBtnMobile = document.getElementById('theme-btn-mobile');
    const tooltipDesktop = document.getElementById('theme-tooltip');
    const tooltipMobile = document.getElementById('theme-tooltip-mobile');
    
    const themes = [
        { class: 'theme-dark-orange', name: 'Dark Orange' },
        { class: 'theme-light-orange', name: 'Light Orange' },
        { class: 'theme-dark-blue', name: 'Dark Blue' },
        { class: 'theme-light-blue', name: 'Light Blue' },
        { class: 'theme-cosmic', name: 'Cosmic Purple' },
        { class: 'theme-cyberpunk', name: 'Cyberpunk' },
        { class: 'theme-royal', name: 'Royal Gold' },
        { class: 'theme-metal', name: 'Metal Green' },
        { class: 'theme-hc-gold', name: 'High Contrast Gold' }
    ];
    
    let currentThemeIndex = 0;
    
    // Load Saved Theme
    const savedTheme = localStorage.getItem('gasp_theme_idx');
    if (savedTheme !== null) {
        currentThemeIndex = parseInt(savedTheme, 10);
        if (currentThemeIndex >= themes.length || currentThemeIndex < 0) {
            currentThemeIndex = 0;
        }
    }
    
    // Apply theme immediately
    document.body.className = themes[currentThemeIndex].class;
    if(tooltipDesktop) tooltipDesktop.textContent = themes[currentThemeIndex].name;
    if(tooltipMobile) tooltipMobile.textContent = themes[currentThemeIndex].name;

    // 1. Initialization
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            projectData = data;
            if(data.title) {
                const match = data.title.match(/v\d+\.\d+/i);
                if(match) projectVersion.textContent = match[0];
                document.title = data.title + " - Docs";
            }
            buildFlatNavList(data.sections);
            renderSidebar(data.sections);
            if(flatNavList.length > 0) loadSection(flatNavList[0].id);
        })
        .catch(err => {
            console.error("Error loading JSON:", err);
            contentContainer.innerHTML = `<div class="welcome-screen"><h1>Error loading documentation</h1><p>Ensure data.json is present and valid.</p></div>`;
        });

    // Theme Cycling Logic
    function cycleTheme() {
        document.body.classList.remove(themes[currentThemeIndex].class);
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        document.body.classList.add(newTheme.class);
        
        localStorage.setItem('gasp_theme_idx', currentThemeIndex);
        
        const triggerTooltip = (el) => {
            if(!el) return;
            el.textContent = newTheme.name;
            el.classList.add('show');
            clearTimeout(el.timeout);
            el.timeout = setTimeout(() => el.classList.remove('show'), 1500);
        };
        triggerTooltip(tooltipDesktop);
        triggerTooltip(tooltipMobile);
    }
    
    if(themeBtn) themeBtn.addEventListener('click', cycleTheme);
    if(themeBtnMobile) themeBtnMobile.addEventListener('click', cycleTheme);

    // 2. Data Processing
    function buildFlatNavList(sections) {
        sections.forEach(section => {
            if (!section.id) section.id = 'sec-' + Math.random().toString(36).substr(2, 9);
            flatNavList.push(section);
            if (section.subsections && section.subsections.length > 0) buildFlatNavList(section.subsections);
        });
    }

    // 3. Sidebar Rendering
    function renderSidebar(sectionsToRender) {
        navList.innerHTML = '';
        
        const createNavItem = (section) => {
            const li = document.createElement('li');
            const itemDiv = document.createElement('div');
            itemDiv.className = 'nav-item';
            itemDiv.dataset.id = section.id;
            itemDiv.innerHTML = `<span>${section.title}</span>`;
            
            itemDiv.addEventListener('click', () => {
                loadSection(section.id);
                if(window.innerWidth <= 768) sidebar.classList.remove('open');
            });

            if (section.subsections && section.subsections.length > 0) {
                const icon = document.createElement('i');
                icon.className = 'ph ph-caret-right';
                itemDiv.appendChild(icon);

                const subContainer = document.createElement('ul');
                subContainer.className = 'nav-sub';
                
                icon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    itemDiv.classList.toggle('expanded');
                    subContainer.classList.toggle('open');
                });

                section.subsections.forEach(sub => subContainer.appendChild(createNavItem(sub)));

                li.appendChild(itemDiv);
                li.appendChild(subContainer);
            } else {
                li.appendChild(itemDiv);
            }
            return li;
        };

        sectionsToRender.forEach(sec => navList.appendChild(createNavItem(sec)));
    }

    function updateSidebarHighlight(activeId) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const activeItem = document.querySelector(`.nav-item[data-id="${activeId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
            let parent = activeItem.parentElement.closest('.nav-sub');
            while(parent) {
                parent.classList.add('open');
                const parentToggle = parent.previousElementSibling;
                if(parentToggle) parentToggle.classList.add('expanded');
                parent = parent.parentElement.closest('.nav-sub');
            }
        }
    }

    // 4. Search
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if(!query) {
            renderSidebar(projectData.sections);
            if(currentSectionId) updateSidebarHighlight(currentSectionId);
            return;
        }

        const filtered = [];
        const traverse = (list, prefix = '') => {
            list.forEach(sec => {
                const titleStr = prefix ? `${prefix} › ${sec.title}` : sec.title;
                let match = sec.title.toLowerCase().includes(query);
                
                if(!match && sec.content) {
                    match = sec.content.some(block => {
                        if(typeof block.value === 'string') return block.value.toLowerCase().includes(query);
                        if(Array.isArray(block.value)) return block.value.join(' ').toLowerCase().includes(query);
                        return false;
                    });
                }
                if(match) filtered.push({ ...sec, title: titleStr, subsections: null });
                if(sec.subsections) traverse(sec.subsections, titleStr);
            });
        };
        traverse(projectData.sections);
        renderSidebar(filtered);
    });

    // 5. Content Rendering
    function loadSection(id) {
        currentSectionId = id;
        updateSidebarHighlight(id);
        
        const section = flatNavList.find(s => s.id === id);
        if(!section) return;

        contentContainer.innerHTML = '';
        contentContainer.classList.remove('content-animate');
        void contentContainer.offsetWidth; 
        contentContainer.classList.add('content-animate');
        
        const title = document.createElement('h1');
        title.className = 'doc-title';
        title.innerHTML = section.title;
        contentContainer.appendChild(title);

        if (section.content) {
            let i = 0;
            while(i < section.content.length) {
                const block = section.content[i];

                if (block.type === 'image' && block.align === 'left' && i + 1 < section.content.length && section.content[i+1].type === 'image' && section.content[i+1].align === 'right') {
                    const row = document.createElement('div');
                    row.className = 'image-row';
                    const img1 = createSingleBlock(block); img1.className = 'img-wrap';
                    const img2 = createSingleBlock(section.content[i+1]); img2.className = 'img-wrap'; 
                    row.appendChild(img1); row.appendChild(img2);
                    contentContainer.appendChild(row);
                    i += 2; continue;
                }
                
                const el = createSingleBlock(block);
                if(el) contentContainer.appendChild(el);
                i++;
            }
        }

        if (section.subsections && section.subsections.length > 0) {
            const subGrid = document.createElement('div');
            subGrid.className = 'subsection-grid';
            
            section.subsections.forEach(sub => {
                const subCard = document.createElement('div');
                subCard.className = 'subsection-card';
                subCard.innerHTML = `<i class="ph ph-arrow-bend-down-right"></i><span>${sub.title}</span>`;
                subCard.addEventListener('click', () => loadSection(sub.id));
                subGrid.appendChild(subCard);
            });
            contentContainer.appendChild(subGrid);
        }

        updateBottomNav(id);
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function createSingleBlock(block) {
        let el;
        switch (block.type) {
            case 'header':
                el = document.createElement('h2');
                el.className = 'doc-header';
                el.innerHTML = block.value;
                break;
            case 'text':
                el = document.createElement('div');
                el.className = 'doc-text';
                el.innerHTML = parseArrayText(block.value);
                break;
            case 'note':
            case 'tip':
                el = document.createElement('div');
                el.className = `callout ${block.type}`;
                const iconClass = block.type === 'note' ? 'ph-info' : 'ph-lightbulb-filament';
                el.innerHTML = `
                    <i class="ph ${iconClass}" id="tip-icon"></i>
                    <div class="callout-content">${parseArrayText(block.value)}</div>
                `;
                break;
            case 'image':
                el = document.createElement('div');
                el.className = `img-wrap ${block.align || 'full'}`;
                el.innerHTML = `<img src="${block.src}" alt="${block.caption || ''}" onclick="window.openLightbox('${block.src}')">`;
                if(block.caption) el.innerHTML += `<span class="caption">${block.caption}</span>`;
                break;
            case 'table':
                el = document.createElement('div');
                el.className = 'table-container';
                let tableHTML = '<table class="doc-table">';
                if (block.headers) {
                    tableHTML += '<thead><tr>';
                    block.headers.forEach(h => tableHTML += `<th>${h}</th>`);
                    tableHTML += '</tr></thead>';
                }
                if (block.rows) {
                    tableHTML += '<tbody>';
                    block.rows.forEach(row => {
                        tableHTML += '<tr>';
                        row.forEach(cell => tableHTML += `<td>${parseArrayText(cell)}</td>`);
                        tableHTML += '</tr>';
                    });
                    tableHTML += '</tbody>';
                }
                tableHTML += '</table>';
                el.innerHTML = tableHTML;
                break;
            case 'roadmap':
                el = document.createElement('div');
                el.className = 'roadmap';
                
                // Identify the latest completed milestone index to expand it by default
                let latestCompletedIdx = 0;
                block.milestones.forEach((m, idx) => {
                    if (m.status.toLowerCase().trim() === 'completed') {
                        latestCompletedIdx = idx;
                    }
                });

                block.milestones.forEach((m, idx) => {
                    const statusCls = m.status.toLowerCase().replace(' ', '-');
                    const expandedCls = idx === latestCompletedIdx ? 'expanded' : '';
                    const item = document.createElement('div');
                    item.className = `roadmap-item ${statusCls} ${expandedCls}`;
                    
                    const header = document.createElement('div');
                    header.className = 'rm-header';
                    header.innerHTML = `
                        <div class="roadmap-marker"></div>
                        <span class="rm-version">${m.version}</span>
                        <span class="rm-date">${m.date}</span>
                        <span class="rm-status">${m.status}</span>
                        <i class="ph ph-caret-right rm-toggle-icon"></i>
                    `;
                    
                    header.addEventListener('click', () => item.classList.toggle('expanded'));
                    item.appendChild(header);

                    const content = document.createElement('div');
                    content.className = 'rm-content';
                    let fHTML = '<ul class="rm-features">';
                    m.features.forEach(f => fHTML += `<li><span>${f}</span></li>`);
                    fHTML += '</ul>';
                    content.innerHTML = fHTML;
                    
                    item.appendChild(content);
                    el.appendChild(item);
                });
                break;
        }
        return el;
    }

    function parseArrayText(val) {
        if (Array.isArray(val)) return val.join(' ');
        return val;
    }

    // 6. Bottom Navigation
    function updateBottomNav(currentId) {
        const index = flatNavList.findIndex(s => s.id === currentId);
        if (index > 0) {
            prevBtn.style.display = 'flex';
            prevLabel.textContent = flatNavList[index - 1].title;
            prevBtn.onclick = () => loadSection(flatNavList[index - 1].id);
        } else prevBtn.style.display = 'none';

        if (index < flatNavList.length - 1) {
            nextBtn.style.display = 'flex';
            nextLabel.textContent = flatNavList[index + 1].title;
            nextBtn.onclick = () => loadSection(flatNavList[index + 1].id);
        } else nextBtn.style.display = 'none';

        bottomNav.style.display = 'flex';
    }

    // 7. Utility Functions
    mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && e.target !== mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    window.openLightbox = function(src) {
        lightboxImg.src = src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    lightboxClose.addEventListener('click', closeLb);
    lightbox.addEventListener('click', (e) => { if(e.target === lightbox) closeLb(); });
    
    function closeLb() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => lightboxImg.src = '', 300);
    }
});