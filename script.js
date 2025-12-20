// 设置PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

// 应用状态
const state = {
    pages: [],
    selectedPages: new Set(),
    dragSrcEl: null,
    replaceMode: false,
    replaceTargetIds: new Set(),
    replaceFileBuffer: null,
    replaceFileName: '',
    // 新增：图片转换相关状态
    currentConvertPageId: null,
    selectedQuality: 'high' // 默认高质量
};

// DOM元素
const elements = {
    fileInput: document.getElementById('fileInput'),
    dropArea: document.getElementById('dropArea'),
    pagesGrid: document.getElementById('pagesGrid'),
    pagesCount: document.getElementById('pagesCount'),
    statusText: document.getElementById('statusText'),
    deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
    rotateRightBtn: document.getElementById('rotateRightBtn'),
    rotateLeftBtn: document.getElementById('rotateLeftBtn'),
    mergeBtn: document.getElementById('mergeBtn'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    toast: document.getElementById('toast'),
    totalPagesStat: document.getElementById('totalPagesStat'),
    selectedPagesStat: document.getElementById('selectedPagesStat'),
    footerTotal: document.getElementById('footerTotal'),
    footerSelected: document.getElementById('footerSelected'),
    downloadSelectedBtn: document.getElementById('downloadSelectedBtn'),
    // 底部新按钮
    footerClearBtn: document.getElementById('footerClearBtn'),
    footerDownloadBtn: document.getElementById('footerDownloadBtn'),
    // 替换相关元素
    replaceModeBtn: document.getElementById('replaceModeBtn'),
    replaceFileLabel: document.getElementById('replaceFileLabel'),
    replaceFileInput: document.getElementById('replaceFileInput'),
    replaceStatus: document.getElementById('replaceStatus'),
    replaceConfirmModal: document.getElementById('replaceConfirmModal'),
    replaceConfirmText: document.getElementById('replaceConfirmText'),
    replacePreviewContent: document.getElementById('replacePreviewContent'),
    // 新增：图片质量相关元素
    imageQualityModal: document.getElementById('imageQualityModal'),
    qualityPageName: document.getElementById('qualityPageName')
};

// 初始化事件监听
function initEventListeners() {
    elements.fileInput.addEventListener('change', handleFileSelect);

    const dropArea = elements.dropArea;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('drag-over'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    // 替换文件输入监听
    elements.replaceFileInput.addEventListener('change', handleReplaceFileSelect);

    // 点击模态框外部关闭
    elements.replaceConfirmModal.addEventListener('click', (e) => {
        if (e.target === elements.replaceConfirmModal) {
            closeReplaceConfirmModal();
        }
    });

    // 点击画质模态框外部关闭
    elements.imageQualityModal.addEventListener('click', (e) => {
        if (e.target === elements.imageQualityModal) {
            closeImageQualityModal();
        }
    });
}

// 处理文件选择
function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        processFiles(files);
        e.target.value = '';
    }
}

// 处理拖放
function handleDrop(e) {
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (files.length > 0) {
        processFiles(files);
    }
}

// 处理文件
async function processFiles(files) {
    showLoading('正在导入PDF文件...');

    try {
        for (const file of files) {
            await processPdfFile(file);
        }

        updateUI();
        showToast(`成功导入 ${files.length} 个PDF文件`);
    } catch (error) {
        console.error('处理文件时出错:', error);
        showToast('处理文件时出错: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 处理单个PDF
async function processPdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({scale: 0.5});
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const dataUrl = canvas.toDataURL('image/png');

        state.pages.push({
            id: generateId(),
            fileName: file.name,
            pageIndex: i,
            rotation: 0,
            originalDoc: arrayBuffer,
            originalPage: i,
            dataUrl: dataUrl
        });
    }
}

// 更新UI
function updateUI() {
    renderPages();
    updateStats();
    updateButtons();
}

// 渲染页面列表
function renderPages() {
    if (state.pages.length === 0) {
        elements.pagesGrid.innerHTML = `
            <div class="ios-empty-state">
                <div class="ios-empty-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div class="ios-empty-title">暂无PDF文件</div>
                <div class="ios-empty-text">请从左侧导入PDF文件开始处理<br>支持多个文件同时导入</div>
            </div>
        `;
        return;
    }

    elements.pagesGrid.innerHTML = '';

    state.pages.forEach((page, index) => {
        const card = document.createElement('div');

        // 根据模式设置不同的选中逻辑
        let isSelected = false;
        if (state.replaceMode) {
            isSelected = state.replaceTargetIds.has(page.id);
        } else {
            isSelected = state.selectedPages.has(page.id);
        }

        card.className = `ios-page-card ${isSelected ? 'selected' : ''}`;
        card.setAttribute('draggable', !state.replaceMode);
        card.dataset.id = page.id;
        card.dataset.index = index;

        let rotationClass = '';
        if (page.rotation === 90) rotationClass = 'rotated-90';
        else if (page.rotation === 180) rotationClass = 'rotated-180';
        else if (page.rotation === 270) rotationClass = 'rotated-270';

        // 根据模式显示不同的操作按钮
        let actionsHTML = '';
        if (state.replaceMode) {
            // 替换模式：只显示选择按钮
            actionsHTML = `
                <div class="ios-action-group">
                    <button class="ios-icon-btn select" data-tooltip="选择" onclick="toggleReplaceTarget('${page.id}')">
                        <i class="fas ${isSelected ? 'fa-check-circle' : 'fa-circle'}"></i>
                    </button>
                </div>
                <div class="ios-action-group">
                    <span style="color: #8E8E93; font-size: 11px; font-weight: 700;">替换模式</span>
                </div>
            `;
        } else {
            // 正常模式：显示所有操作（移除了选中按钮）
            actionsHTML = `
                <div class="ios-action-group">
                    <button class="ios-icon-btn delete" data-tooltip="删除" onclick="deletePage('${page.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="ios-icon-btn rotate" data-tooltip="旋转" onclick="rotatePage('${page.id}')">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div class="ios-action-group">
                    <button class="ios-icon-btn image" data-tooltip="转PNG" onclick="openImageQualityModal('${page.id}', '${page.fileName}')">
                        <i class="fas fa-image"></i>
                    </button>
                    <button class="ios-icon-btn replace" data-tooltip="替换" onclick="quickReplacePage('${page.id}')">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="ios-page-preview ${rotationClass}">
                <img src="${page.dataUrl}" alt="Page Preview">
            </div>
            <div class="ios-page-info">
                <div class="ios-page-title" title="${page.fileName}">${page.fileName}</div>
                <div class="ios-page-meta">
                    <span>页 ${page.pageIndex}</span>
                    <span>${page.rotation}°</span>
                </div>
            </div>
            <div class="ios-page-actions">
                ${actionsHTML}
            </div>
        `;

        // 点击卡片切换选中（除按钮外）
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.ios-icon-btn')) {
                if (state.replaceMode) {
                    toggleReplaceTarget(page.id);
                } else {
                    toggleSelectPage(page.id);
                }
            }
        });

        // 拖放事件（仅在非替换模式下）
        if (!state.replaceMode) {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragover', handleDragOver);
            card.addEventListener('dragenter', handleDragEnter);
            card.addEventListener('dragleave', handleDragLeave);
            card.addEventListener('drop', handleDropOnCard);
            card.addEventListener('dragend', handleDragEnd);
        }

        elements.pagesGrid.appendChild(card);
    });
}

// 更新统计
function updateStats() {
    const total = state.pages.length;
    const selected = state.replaceMode ? state.replaceTargetIds.size : state.selectedPages.size;

    elements.pagesCount.textContent = `${total} 页`;
    elements.totalPagesStat.textContent = total;
    elements.selectedPagesStat.textContent = selected;
    elements.footerTotal.textContent = total;
    elements.footerSelected.textContent = selected;

    if (total === 0) {
        elements.statusText.textContent = '等待导入文件';
    } else {
        if (state.replaceMode) {
            elements.statusText.textContent = `替换模式: ${selected} 个页面待替换`;
        } else {
            elements.statusText.textContent = selected > 0 ? `${selected} 项已选中` : '就绪';
        }
    }

    // 更新替换状态显示
    if (state.replaceMode) {
        elements.replaceStatus.textContent = `状态: 激活 - 已选择 ${state.replaceTargetIds.size} 个页面`;
        elements.replaceStatus.style.color = '#34C759';
        elements.replaceStatus.style.fontWeight = '700';
    } else {
        elements.replaceStatus.textContent = '状态: 未激活';
        elements.replaceStatus.style.color = '#8E8E93';
        elements.replaceStatus.style.fontWeight = '600';
    }
}

// 更新按钮状态
function updateButtons() {
    const hasPages = state.pages.length > 0;
    const hasSelection = state.selectedPages.size > 0;
    const hasMultiplePages = state.pages.length > 1;

    // 顶部按钮（已移除）
    elements.deleteSelectedBtn.disabled = !hasSelection || state.replaceMode;
    elements.rotateRightBtn.disabled = !hasSelection || state.replaceMode;
    elements.rotateLeftBtn.disabled = !hasSelection || state.replaceMode;
    elements.mergeBtn.disabled = !hasMultiplePages || state.replaceMode;
    elements.downloadSelectedBtn.disabled = !hasSelection || state.replaceMode;
    elements.selectAllBtn.disabled = state.replaceMode;

    // 底部按钮
    elements.footerClearBtn.disabled = !hasPages || state.replaceMode;
    elements.footerDownloadBtn.disabled = !hasPages || state.replaceMode;

    // 替换模式按钮状态
    if (state.replaceMode) {
        elements.replaceModeBtn.textContent = '退出替换';
        elements.replaceModeBtn.onclick = exitReplaceMode;
        elements.replaceFileLabel.style.display = 'inline-flex';
        elements.replaceFileLabel.style.opacity = state.replaceTargetIds.size > 0 ? '1' : '0.5';
        elements.replaceFileLabel.style.pointerEvents = state.replaceTargetIds.size > 0 ? 'auto' : 'none';
    } else {
        elements.replaceModeBtn.textContent = '启用替换';
        elements.replaceModeBtn.onclick = initReplaceMode;
        elements.replaceFileLabel.style.display = 'none';
    }
}

// 切换选中（正常模式）
function toggleSelectPage(id) {
    if (state.replaceMode) return;

    if (state.selectedPages.has(id)) {
        state.selectedPages.delete(id);
    } else {
        state.selectedPages.add(id);
    }
    updateUI();
}

// 全选/取消（正常模式）
function selectDeselectAll() {
    if (state.replaceMode) return;

    if (state.selectedPages.size === state.pages.length) {
        state.selectedPages.clear();
    } else {
        state.pages.forEach(page => state.selectedPages.add(page.id));
    }
    updateUI();
}

// 删除单个
function deletePage(id) {
    if (state.replaceMode) return;

    const index = state.pages.findIndex(p => p.id === id);
    if (index !== -1) {
        state.pages.splice(index, 1);
        state.selectedPages.delete(id);
        updateUI();
        showToast('页面已删除');
    }
}

// 删除选中
function deleteSelected() {
    if (state.selectedPages.size === 0 || state.replaceMode) return;

    if (confirm(`确定要删除选中的 ${state.selectedPages.size} 个页面吗？`)) {
        state.pages = state.pages.filter(page => !state.selectedPages.has(page.id));
        state.selectedPages.clear();
        updateUI();
        showToast('选中页面已删除');
    }
}

// 旋转单个
function rotatePage(id) {
    if (state.replaceMode) return;

    const page = state.pages.find(p => p.id === id);
    if (page) {
        page.rotation = (page.rotation + 90) % 360;
        updateUI();
    }
}

// 旋转选中
function rotateSelected(degrees) {
    if (state.selectedPages.size === 0 || state.replaceMode) return;

    state.pages.forEach(page => {
        if (state.selectedPages.has(page.id)) {
            page.rotation = (page.rotation + degrees) % 360;
        }
    });

    updateUI();
    showToast(`已旋转 ${state.selectedPages.size} 个页面`);
}

// 替换模式相关函数
function initReplaceMode() {
    state.replaceMode = true;
    state.replaceTargetIds.clear();
    state.replaceFileBuffer = null;
    state.replaceFileName = '';
    updateUI();
    showToast('替换模式已启用，请选择要替换的页面');
}

function exitReplaceMode() {
    state.replaceMode = false;
    state.replaceTargetIds.clear();
    state.replaceFileBuffer = null;
    state.replaceFileName = '';
    updateUI();
    showToast('已退出替换模式');
}

function toggleReplaceTarget(id) {
    if (state.replaceTargetIds.has(id)) {
        state.replaceTargetIds.delete(id);
    } else {
        state.replaceTargetIds.add(id);
    }
    updateUI();
}

// 快速替换（单个页面）
async function quickReplacePage(id) {
    // 创建隐藏的文件输入，仅用于选择文件
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = '.pdf';
    tempInput.style.display = 'none';

    tempInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await executeReplaceSingle(id, file);
        }
        tempInput.remove();
    });

    document.body.appendChild(tempInput);
    tempInput.click();
}

// 处理替换文件选择
function handleReplaceFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (state.replaceTargetIds.size === 0) {
        showToast('请先选择要替换的页面');
        e.target.value = '';
        return;
    }

    // 显示确认模态框
    showReplaceConfirm(file);
}

// 显示替换确认
async function showReplaceConfirm(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise;

        // 预览第一页
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({scale: 0.3});
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const previewDataUrl = canvas.toDataURL('image/png');

        elements.replaceConfirmText.innerHTML = `确定要用 <strong style="color: #007AFF; font-weight: 800;">${file.name}</strong> 的第一页替换选中的 <strong style="color: #FF9500; font-weight: 800;">${state.replaceTargetIds.size}</strong> 个页面吗？`;
        elements.replacePreviewContent.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                <img src="${previewDataUrl}" style="width: 70px; height: auto; border-radius: 8px; border: 2px solid #E5E5EA; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div>
                    <div style="font-weight: 800; font-size: 14px; color: #1C1C1E; margin-bottom: 2px;">${file.name}</div>
                    <div style="font-size: 11px; color: #8E8E93; font-weight: 600;">${pdfDoc.numPages} 页 (将使用第1页)</div>
                </div>
            </div>
        `;

        // 保存到状态
        state.replaceFileBuffer = arrayBuffer;
        state.replaceFileName = file.name;

        elements.replaceConfirmModal.style.display = 'flex';
    } catch (error) {
        console.error('预览替换文件时出错:', error);
        showToast('无法读取替换文件: ' + error.message);
    }
}

// 关闭替换确认
function closeReplaceConfirmModal() {
    elements.replaceConfirmModal.style.display = 'none';
    elements.replaceFileInput.value = '';
}

// 执行替换
async function executeReplace() {
    if (!state.replaceFileBuffer || state.replaceTargetIds.size === 0) {
        showToast('替换数据不完整');
        return;
    }

    closeReplaceConfirmModal();
    showLoading(`正在替换 ${state.replaceTargetIds.size} 个页面...`);

    try {
        // 加载替换文件的第一页
        const pdfDoc = await pdfjsLib.getDocument({data: state.replaceFileBuffer}).promise;
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({scale: 0.5});
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const newDataUrl = canvas.toDataURL('image/png');

        // 替换所有选中的页面
        let replaceCount = 0;
        state.pages.forEach(page => {
            if (state.replaceTargetIds.has(page.id)) {
                page.fileName = state.replaceFileName;
                page.pageIndex = 1;
                page.rotation = 0;
                page.originalDoc = state.replaceFileBuffer;
                page.originalPage = 1;
                page.dataUrl = newDataUrl;
                replaceCount++;
            }
        });

        updateUI();
        showToast(`成功替换 ${replaceCount} 个页面`);

        // 退出替换模式
        exitReplaceMode();

    } catch (error) {
        console.error('执行替换时出错:', error);
        showToast('替换失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 单个页面替换执行
async function executeReplaceSingle(targetId, file) {
    showLoading('正在替换页面...');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise;

        if (pdfDoc.numPages === 0) {
            showToast('所选PDF文件没有页面');
            return;
        }

        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({scale: 0.5});
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const dataUrl = canvas.toDataURL('image/png');

        const targetPage = state.pages.find(p => p.id === targetId);
        if (targetPage) {
            targetPage.fileName = file.name;
            targetPage.pageIndex = 1;
            targetPage.rotation = 0;
            targetPage.originalDoc = arrayBuffer;
            targetPage.originalPage = 1;
            targetPage.dataUrl = dataUrl;

            updateUI();
            showToast('页面已替换');
        }
    } catch (error) {
        console.error('替换页面时出错:', error);
        showToast('替换失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 合并页面
async function mergePages() {
    if (state.pages.length < 1 || state.replaceMode) {
        showToast('至少需要1个页面才能合并');
        return;
    }

    showLoading('正在合并PDF...');

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const page of state.pages) {
            const srcDoc = await PDFLib.PDFDocument.load(page.originalDoc);
            const [copiedPage] = await mergedPdf.copyPages(srcDoc, [page.originalPage - 1]);

            if (page.rotation !== 0) {
                copiedPage.setRotation(PDFLib.degrees(page.rotation));
            }

            mergedPdf.addPage(copiedPage);
        }

        const pdfBytes = await mergedPdf.save();
        downloadFile(pdfBytes, `merged_${Date.now()}.pdf`);

        showToast('PDF合并成功，正在下载...');
    } catch (error) {
        console.error('合并PDF时出错:', error);
        showToast('合并失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 下载PDF
async function downloadPDF() {
    if (state.pages.length === 0 || state.replaceMode) return;

    if (state.selectedPages.size > 0) {
        if (confirm('检测到选中项，是否只下载选中的页面？')) {
            await downloadSelectedPages();
            return;
        }
    }

    await mergePages();
}

// 下载选中页面
async function downloadSelectedPages() {
    if (state.replaceMode) return;

    const selectedPages = state.pages.filter(p => state.selectedPages.has(p.id));
    if (selectedPages.length === 0) {
        showToast('没有选中的页面');
        return;
    }

    showLoading('正在生成选中页面的PDF...');

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const page of selectedPages) {
            const srcDoc = await PDFLib.PDFDocument.load(page.originalDoc);
            const [copiedPage] = await mergedPdf.copyPages(srcDoc, [page.originalPage - 1]);

            if (page.rotation !== 0) {
                copiedPage.setRotation(PDFLib.degrees(page.rotation));
            }

            mergedPdf.addPage(copiedPage);
        }

        const pdfBytes = await mergedPdf.save();
        downloadFile(pdfBytes, `selected_${Date.now()}.pdf`);

        showToast(`已下载 ${selectedPages.length} 个选中页面`);
    } catch (error) {
        console.error('下载选中页面时出错:', error);
        showToast('下载失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 下载文件辅助函数
function downloadFile(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 清空所有
function clearAll() {
    if (state.pages.length === 0 || state.replaceMode) return;

    if (confirm('确定要清空所有页面吗？')) {
        state.pages = [];
        state.selectedPages.clear();
        updateUI();
        showToast('已清空所有内容');
    }
}

// 拖放排序
function handleDragStart(e) {
    this.classList.add('dragging');
    state.dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('id', this.dataset.id);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDropOnCard(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    this.classList.remove('drag-over');

    if (state.dragSrcEl !== this) {
        const srcId = e.dataTransfer.getData('id');
        const destId = this.dataset.id;

        const srcIndex = state.pages.findIndex(p => p.id === srcId);
        const destIndex = state.pages.findIndex(p => p.id === destId);

        if (srcIndex !== -1 && destIndex !== -1) {
            const [movedPage] = state.pages.splice(srcIndex, 1);
            state.pages.splice(destIndex, 0, movedPage);

            updateUI();
            showToast('页面顺序已更新');
        }
    }

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    const cards = document.querySelectorAll('.ios-page-card');
    cards.forEach(card => card.classList.remove('drag-over'));
}

// 工具函数
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showLoading(text = '正在处理...') {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ================= 新增：图片转换功能 =================

// 打开画质选择模态框
function openImageQualityModal(pageId, fileName) {
    state.currentConvertPageId = pageId;
    elements.qualityPageName.textContent = fileName;

    // 重置选中状态
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // 设置默认选中
    const defaultBtn = document.getElementById('quality' + state.selectedQuality.charAt(0).toUpperCase() + state.selectedQuality.slice(1));
    if (defaultBtn) defaultBtn.classList.add('selected');

    elements.imageQualityModal.style.display = 'flex';
}

// 关闭画质选择模态框
function closeImageQualityModal() {
    elements.imageQualityModal.style.display = 'none';
    state.currentConvertPageId = null;
}

// 选择画质
function selectQuality(quality) {
    state.selectedQuality = quality;

    // 更新UI选中状态
    document.querySelectorAll('.quality-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    const btnId = 'quality' + quality.charAt(0).toUpperCase() + quality.slice(1);
    const selectedBtn = document.getElementById(btnId);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
}

// 确认导出图片
function confirmConvertToImage() {
    if (!state.currentConvertPageId) return;

    const page = state.pages.find(p => p.id === state.currentConvertPageId);
    if (!page) return;

    closeImageQualityModal();
    convertPageToImage(page, state.selectedQuality);
}

// 转换页面为图片
async function convertPageToImage(page, quality) {
    showLoading('正在生成图片...');

    try {
        // 根据画质设置DPI
        let scale;
        switch(quality) {
            case 'low':
                scale = 0.6; // 约72 DPI
                break;
            case 'medium':
                scale = 1.2; // 约150 DPI
                break;
            case 'high':
                scale = 2.4; // 约300 DPI
                break;
            default:
                scale = 2.4;
        }

        // 使用pdf.js重新渲染原始页面（考虑旋转）
        const pdfDoc = await pdfjsLib.getDocument({data: page.originalDoc}).promise;
        const pdfPage = await pdfDoc.getPage(page.originalPage);

        // 应用旋转
        const viewport = pdfPage.getViewport({
            scale: scale,
            rotation: page.rotation
        });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await pdfPage.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // 转换为图片并下载
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // 生成文件名：原文件名_页码_质量.png
            const qualityLabel = quality === 'high' ? '高' : quality === 'medium' ? '中' : '低';
            link.download = `${page.fileName}_页${page.pageIndex}_${qualityLabel}质量.png`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast('图片已生成并下载');
        }, 'image/png');

    } catch (error) {
        console.error('生成图片失败:', error);
        showToast('生成图片失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 初始化
function initApp() {
    initEventListeners();
    updateUI();
    showToast('PDF Tools已就绪');
}

// 确保DOM加载完成后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
