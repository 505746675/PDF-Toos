<template>
  <div class="app-container">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="bg-shape"></div>
      <div class="bg-shape"></div>
      <div class="bg-shape"></div>
    </div>

    <div class="ios-container">
      <!-- 导航栏 -->
      <div class="ios-nav">
        <div class="ios-title">PDF Tools</div>
      </div>

      <div class="ios-main">
        <!-- 左侧面板：控制区域 -->
        <div class="ios-left-panel">
          <div class="panel-header">
            <span class="panel-title">控制面板</span>
            <span class="panel-badge">导入 & 操作</span>
          </div>

          <div class="scroll-area">
            <!-- 上传区域 -->
            <div 
              class="ios-upload-area" 
              :class="{ 'drag-over': isDragging }"
              @click="$refs.fileInput.click()"
              @dragover.prevent
              @drop.prevent="handleDrop"
              @dragenter="isDragging = true"
              @dragleave="isDragging = false"
            >
              <div class="ios-upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <div class="ios-upload-text">导入PDF文件</div>
              <div class="ios-upload-hint">点击此处或拖放文件到此处</div>
              <input 
                ref="fileInput" 
                type="file" 
                accept=".pdf" 
                multiple 
                @change="handleFileSelect" 
                style="display: none"
              />
            </div>

            <!-- 批量操作 -->
            <div class="ios-actions">
              <div class="ios-actions-title">批量操作</div>
              <div class="ios-actions-grid">
                <button 
                  class="ios-action-btn" 
                  @click="pdfStore.selectDeselectAll"
                  :disabled="!pdfStore.hasPages || pdfStore.replaceMode"
                  data-tooltip="全选/取消全选"
                >
                  <i class="fas fa-check-square"></i> 全选
                </button>
                <button 
                  class="ios-action-btn danger" 
                  @click="pdfStore.deleteSelected"
                  :disabled="!pdfStore.hasSelection || pdfStore.replaceMode"
                  data-tooltip="删除选中项"
                >
                  <i class="fas fa-trash"></i> 删除
                </button>
                <button 
                  class="ios-action-btn rotate" 
                  @click="pdfStore.rotateSelected(90)"
                  :disabled="!pdfStore.hasSelection || pdfStore.replaceMode"
                  data-tooltip="右旋90°"
                >
                  <i class="fas fa-redo"></i> 右旋
                </button>
                <button 
                  class="ios-action-btn rotate" 
                  @click="pdfStore.rotateSelected(270)"
                  :disabled="!pdfStore.hasSelection || pdfStore.replaceMode"
                  data-tooltip="左旋90°"
                >
                  <i class="fas fa-undo"></i> 左旋
                </button>
                <button 
                  class="ios-action-btn merge" 
                  @click="pdfStore.mergePages"
                  :disabled="!pdfStore.hasMultiplePages || pdfStore.replaceMode"
                  data-tooltip="合并所有页面"
                >
                  <i class="fas fa-link"></i> 合并
                </button>
                <button 
                  class="ios-action-btn compress" 
                  @click="pdfStore.openCompressModal"
                  :disabled="!pdfStore.hasPages || pdfStore.replaceMode"
                  data-tooltip="压缩PDF文件"
                >
                  <i class="fas fa-compress"></i> 压缩
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧面板：页面列表 -->
        <div class="ios-right-panel">
          <div class="panel-header">
            <span class="panel-title">页面列表</span>
            <span class="panel-badge">{{ pdfStore.totalPages }} 页</span>
          </div>

          <div class="scroll-area">
            <!-- 页面网格 -->
            <div v-if="pdfStore.pages.length > 0" class="ios-pages-grid">
              <div 
                v-for="page in pdfStore.pages" 
                :key="page.id"
                class="ios-page-card"
                :class="{
                  selected: pdfStore.replaceMode 
                    ? pdfStore.replaceTargetIds.has(page.id)
                    : pdfStore.selectedPages.has(page.id),
                  dragging: draggedId === page.id
                }"
                :draggable="!pdfStore.replaceMode"
                @click="handlePageClick(page.id, $event)"
                @dragstart="handleDragStart($event, page.id)"
                @dragover.prevent="handleDragOver($event)"
                @dragenter="handleDragEnter($event)"
                @dragleave="handleDragLeave($event)"
                @drop="handleDropPage($event, page.id)"
                @dragend="handleDragEnd"
              >
                <!-- 页面预览 -->
                <div 
                  class="ios-page-preview"
                  :class="{
                    'rotated-90': page.rotation === 90,
                    'rotated-180': page.rotation === 180,
                    'rotated-270': page.rotation === 270
                  }"
                >
                  <img :src="page.dataUrl" :alt="`Page ${page.pageIndex}`" />
                </div>

                <!-- 页面信息 -->
                <div class="ios-page-info">
                  <div class="ios-page-title" :title="page.fileName">{{ page.fileName }}</div>
                  <div class="ios-page-meta">
                    <span>页 {{ page.pageIndex }}</span>
                    <span>{{ page.rotation }}°</span>
                  </div>
                </div>

                <!-- 页面操作 -->
                <div class="ios-page-actions">
                  <!-- 替换模式下的操作 -->
                  <div v-if="pdfStore.replaceMode" class="ios-action-group">
                    <button 
                      class="ios-icon-btn select" 
                      data-tooltip="选择"
                      @click.stop="pdfStore.toggleReplaceTarget(page.id)"
                    >
                      <i 
                        class="fas"
                        :class="pdfStore.replaceTargetIds.has(page.id) ? 'fa-check-circle' : 'fa-circle'"
                      ></i>
                    </button>
                  </div>

                  <div v-if="pdfStore.replaceMode" class="ios-action-group">
                    <span style="color: #8E8E93; font-size: 11px; font-weight: 700;">替换模式</span>
                  </div>

                  <!-- 普通模式下的操作 -->
                  <template v-if="!pdfStore.replaceMode">
                    <div class="ios-action-group">
                      <button 
                        class="ios-icon-btn delete" 
                        data-tooltip="删除"
                        @click.stop="pdfStore.deletePage(page.id)"
                      >
                        <i class="fas fa-trash"></i>
                      </button>
                      <button 
                        class="ios-icon-btn rotate" 
                        data-tooltip="旋转"
                        @click.stop="pdfStore.rotatePage(page.id)"
                      >
                        <i class="fas fa-sync-alt"></i>
                      </button>
                    </div>

                    <div class="ios-action-group">
                      <button 
                        class="ios-icon-btn image" 
                        data-tooltip="转PNG"
                        @click.stop="handleConvertToImage(page.id, page.fileName)"
                      >
                        <i class="fas fa-image"></i>
                      </button>
                      <button 
                        class="ios-icon-btn replace" 
                        data-tooltip="替换"
                        @click.stop="handleQuickReplace(page.id)"
                      >
                        <i class="fas fa-exchange-alt"></i>
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else class="ios-empty-state">
              <div class="ios-empty-icon">
                <i class="fas fa-file-pdf"></i>
              </div>
              <div class="ios-empty-title">暂无PDF文件</div>
              <div class="ios-empty-text">
                请从左侧导入PDF文件开始处理<br />
                支持多个文件同时导入
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部栏 -->
      <div class="ios-footer">
        <div class="ios-footer-stats">
          <div class="ios-footer-stat">
            <i class="fas fa-layer-group"></i>
            <span>总页数:</span>
            <span class="ios-stat-value">{{ pdfStore.totalPages }}</span>
          </div>
          <div class="ios-footer-stat">
            <i class="fas fa-check-circle"></i>
            <span>选中:</span>
            <span class="ios-stat-value">{{ pdfStore.selectedCount }}</span>
          </div>
        </div>

        <div class="ios-footer-actions">
          <button 
            class="ios-footer-btn clear" 
            @click="pdfStore.clearAll"
            data-tooltip="清空所有页面"
            :disabled="!pdfStore.hasPages || pdfStore.replaceMode"
          >
            <i class="fas fa-trash-alt"></i> 清空
          </button>
          <button 
            class="ios-footer-btn download" 
            @click="pdfStore.downloadPDF"
            data-tooltip="生成并下载全部PDF"
            :disabled="!pdfStore.hasPages || pdfStore.replaceMode"
          >
            <i class="fas fa-download"></i> 下载全部
          </button>
          <button 
            class="ios-footer-btn download" 
            @click="pdfStore.downloadSelectedPages"
            data-tooltip="下载选中页面"
            :disabled="!pdfStore.hasSelection || pdfStore.replaceMode"
          >
            <i class="fas fa-file-download"></i> 下载选中
          </button>
        </div>

        <div class="ios-footer-status">
          {{ statusText }}
        </div>
      </div>

      <!-- 确认替换模态框 -->
      <div v-if="showReplaceModal" class="ios-modal" @click.self="closeReplaceModal">
        <div class="ios-modal-content">
          <div class="ios-modal-header">
            <div class="ios-modal-title">确认替换</div>
            <button class="ios-modal-close" @click="closeReplaceModal">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ios-modal-body">
            <p v-html="replaceModalText"></p>
            <div style="margin-top: 12px; padding: 12px; background: #F2F2F7; border-radius: 10px; font-size: 13px; border: 1px solid #E5E5EA">
              <div style="color: #1C1C1E; margin-bottom: 8px; font-weight: 700;">替换预览:</div>
              <div v-if="replacePreview" v-html="replacePreview"></div>
              <div v-else style="color: #8E8E93">等待选择文件...</div>
            </div>
          </div>
          <div class="ios-modal-actions">
            <button class="ios-btn ios-btn-secondary" @click="closeReplaceModal">
              <i class="fas fa-times"></i> 取消
            </button>
            <button class="ios-btn ios-btn-accent" @click="confirmReplace">
              <i class="fas fa-check"></i> 确认替换
            </button>
          </div>
        </div>
      </div>

      <!-- 图片质量选择模态框 -->
      <div v-if="showQualityModal" class="ios-modal" @click.self="closeQualityModal">
        <div class="ios-modal-content">
          <div class="ios-modal-header">
            <div class="ios-modal-title">选择图片质量</div>
            <button class="ios-modal-close" @click="closeQualityModal">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ios-modal-body">
            <p>请选择导出图片的质量（分辨率）：</p>
            <div class="quality-options">
              <div 
                class="quality-btn" 
                :class="{ selected: pdfStore.selectedQuality === 'low' }"
                @click="pdfStore.selectQuality('low')"
              >
                <i class="fas fa-image" style="color: #FF9500"></i>
                <span class="quality-label">低质量</span>
                <span class="quality-value">72 DPI</span>
              </div>
              <div 
                class="quality-btn" 
                :class="{ selected: pdfStore.selectedQuality === 'medium' }"
                @click="pdfStore.selectQuality('medium')"
              >
                <i class="fas fa-images" style="color: #007AFF"></i>
                <span class="quality-label">中等质量</span>
                <span class="quality-value">150 DPI</span>
              </div>
              <div 
                class="quality-btn" 
                :class="{ selected: pdfStore.selectedQuality === 'high' }"
                @click="pdfStore.selectQuality('high')"
              >
                <i class="fas fa-photo-video" style="color: #34C759"></i>
                <span class="quality-label">高质量</span>
                <span class="quality-value">300 DPI</span>
              </div>
            </div>
            <div style="text-align: center; color: #8E8E93; font-size: 12px; margin-top: 10px">
              当前页面: <span style="font-weight: 700; color: #1C1C1E">{{ currentConvertFileName }}</span>
            </div>
          </div>
          <div class="ios-modal-actions">
            <button class="ios-btn ios-btn-secondary" @click="closeQualityModal">
              <i class="fas fa-times"></i> 取消
            </button>
            <button class="ios-btn ios-btn-accent" @click="confirmConvert">
              <i class="fas fa-image"></i> 导出图片
            </button>
          </div>
        </div>
      </div>

      <!-- 压缩质量选择模态框 -->
      <div v-if="pdfStore.showCompressModal" class="ios-modal" @click.self="pdfStore.closeCompressModal">
        <div class="ios-modal-content">
          <div class="ios-modal-header">
            <div class="ios-modal-title">选择压缩质量</div>
            <button class="ios-modal-close" @click="pdfStore.closeCompressModal">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="ios-modal-body">
            <p>请选择PDF压缩的质量级别：</p>
            <div class="quality-options">
              <div 
                class="quality-btn" 
                :class="{ selected: pdfStore.compressQuality === 'high' }"
                @click="pdfStore.selectCompressQuality('high')"
              >
                <i class="fas fa-file-pdf" style="color: #34C759"></i>
                <span class="quality-label">高质量</span>
                <span class="quality-value">轻度压缩</span>
              </div>
              <div 
                class="quality-btn" 
                :class="{ selected: pdfStore.compressQuality === 'medium' }"
                @click="pdfStore.selectCompressQuality('medium')"
              >
                <i class="fas fa-file-pdf" style="color: #007AFF"></i>
                <span class="quality-label">中等质量</span>
                <span class="quality-value">平衡压缩</span>
              </div>
              <div 
                class="quality-btn" 
                :class="{ selected: pdfStore.compressQuality === 'low' }"
                @click="pdfStore.selectCompressQuality('low')"
              >
                <i class="fas fa-file-pdf" style="color: #FF9500"></i>
                <span class="quality-label">低质量</span>
                <span class="quality-value">最大压缩</span>
              </div>
            </div>
            <div style="text-align: center; color: #8E8E93; font-size: 12px; margin-top: 10px">
              当前文档: <span style="font-weight: 700; color: #1C1C1E">{{ pdfStore.totalPages }} 页</span>
            </div>
          </div>
          <div class="ios-modal-actions">
            <button class="ios-btn ios-btn-secondary" @click="pdfStore.closeCompressModal">
              <i class="fas fa-times"></i> 取消
            </button>
            <button class="ios-btn ios-btn-accent" @click="pdfStore.confirmCompressPDF">
              <i class="fas fa-compress"></i> 开始压缩
            </button>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="pdfStore.isLoading" class="ios-loading">
        <div class="ios-spinner"></div>
        <div class="ios-loading-text">{{ pdfStore.loadingText }}</div>
      </div>

      <!-- Toast 提示 -->
      <div 
        class="ios-toast" 
        :class="{ show: pdfStore.toast.show }"
      >
        {{ pdfStore.toast.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { usePDFStore } from './stores/pdfStore'

const pdfStore = usePDFStore()

// 状态
const isDragging = ref(false)
const draggedId = ref(null)
const showReplaceModal = ref(false)
const showQualityModal = ref(false)
const replaceModalText = ref('')
const replacePreview = ref('')
const currentConvertFileName = ref('')

// 监听压缩模态框状态同步
watch(() => pdfStore.showCompressModal, (newVal) => {
  if (!newVal) {
    // 模态框关闭时的清理逻辑
  }
})

// 计算属性
const statusText = computed(() => {
  if (pdfStore.totalPages === 0) {
    return '等待导入文件'
  }
  if (pdfStore.replaceMode) {
    return `替换模式: ${pdfStore.selectedCount} 个页面待替换`
  }
  if (pdfStore.selectedCount > 0) {
    return `${pdfStore.selectedCount} 项已选中`
  }
  return '就绪'
})

// 文件处理
const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  if (files.length > 0) {
    pdfStore.processFiles(files)
    event.target.value = ''
  }
}

const handleDrop = (event) => {
  const files = Array.from(event.dataTransfer.files).filter(f => f.type === 'application/pdf')
  if (files.length > 0) {
    pdfStore.processFiles(files)
  }
  isDragging.value = false
}

// 页面点击处理
const handlePageClick = (pageId, event) => {
  if (event.target.closest('.ios-icon-btn')) return
  
  if (pdfStore.replaceMode) {
    pdfStore.toggleReplaceTarget(pageId)
  } else {
    pdfStore.toggleSelectPage(pageId)
  }
}

// 拖拽处理
const handleDragStart = (event, pageId) => {
  if (pdfStore.replaceMode) return
  
  draggedId.value = pageId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('id', pageId)
  event.target.classList.add('dragging')
}

const handleDragOver = (event) => {
  if (pdfStore.replaceMode) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  
  const card = event.target.closest('.ios-page-card')
  if (card) {
    card.classList.add('drag-over')
  }
}

const handleDragEnter = (event) => {
  if (pdfStore.replaceMode) return
  const card = event.target.closest('.ios-page-card')
  if (card) {
    card.classList.add('drag-over')
  }
}

const handleDragLeave = (event) => {
  if (pdfStore.replaceMode) return
  const card = event.target.closest('.ios-page-card')
  if (card) {
    card.classList.remove('drag-over')
  }
}

const handleDropPage = (event, dropPageId) => {
  if (pdfStore.replaceMode) return
  
  event.preventDefault()
  const card = event.target.closest('.ios-page-card')
  if (card) {
    card.classList.remove('drag-over')
  }
  
  if (draggedId.value !== dropPageId) {
    pdfStore.reorderPages(draggedId.value, dropPageId)
  }
}

const handleDragEnd = () => {
  draggedId.value = null
  document.querySelectorAll('.ios-page-card').forEach(card => {
    card.classList.remove('dragging', 'drag-over')
  })
}

// 快速替换
const handleQuickReplace = async (pageId) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf'
  input.style.display = 'none'
  
  input.addEventListener('change', async (event) => {
    const file = event.target.files[0]
    if (file) {
      try {
        await pdfStore.quickReplacePage(pageId, file)
      } catch (error) {
        console.error('快速替换失败:', error)
        pdfStore.showToast('快速替换失败: ' + error.message)
      }
    }
    input.remove()
  })
  
  document.body.appendChild(input)
  input.click()
}

// 图片转换
const handleConvertToImage = (pageId, fileName) => {
  currentConvertFileName.value = fileName
  pdfStore.openImageQualityModal(pageId)
  showQualityModal.value = true
}

const closeQualityModal = () => {
  showQualityModal.value = false
  pdfStore.closeImageQualityModal()
}

const confirmConvert = async () => {
  await pdfStore.confirmConvertToImage()
  showQualityModal.value = false
}

// 替换模态框
const closeReplaceModal = () => {
  showReplaceModal.value = false
  replaceModalText.value = ''
  replacePreview.value = ''
}

const confirmReplace = async () => {
  await pdfStore.executeReplace()
  closeReplaceModal()
}

// 监听替换模式变化
onMounted(() => {
  // 这里可以添加更多的初始化逻辑
})
</script>

<style lang="scss" scoped>
.app-container {
  position: relative;
  width: 100%;
  min-height: 100vh;
}

.bg-decoration {
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: -1;
  overflow: hidden;
}

.bg-shape {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  background: #F2F2F7;
  animation: float 25s infinite ease-in-out;
  
  &:nth-child(1) {
    width: 280px;
    height: 280px;
    top: -80px;
    left: -80px;
    animation-delay: 0s;
  }
  
  &:nth-child(2) {
    width: 220px;
    height: 220px;
    bottom: -60px;
    right: -60px;
    animation-delay: 8s;
  }
  
  &:nth-child(3) {
    width: 200px;
    height: 200px;
    top: 60%;
    left: 20%;
    transform: translate(-50%, -50%);
    animation-delay: 16s;
  }
}

@keyframes float {
  0%, 100% {
    transform: translate(0) scale(1);
  }
  33% {
    transform: translate(40px, -20px) scale(1.1);
  }
  66% {
    transform: translate(-30px, 30px) scale(0.95);
  }
}

.ios-container {
  width: 100%;
  max-width: 1400px;
  height: 90vh;
  background: #FFFFFF;
  border-radius: 24px;
  border: 1px solid #E5E5EA;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  margin: 20px auto;
}

.ios-nav {
  background: #FFFFFF;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #E5E5EA;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.ios-title {
  font-size: 24px;
  font-weight: 700;
  color: #007aff;
  letter-spacing: 0.5px;
}

.ios-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.ios-left-panel {
  width: 40%;
  min-width: 350px;
  max-width: 450px;
  background: #F2F2F7;
  border-right: 1px solid #E5E5EA;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ios-right-panel {
  flex: 1;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 16px 20px;
  background: #FFFFFF;
  border-bottom: 1px solid #E5E5EA;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #1c1c1e;
  letter-spacing: 0.2px;
}

.panel-badge {
  background: #007AFF;
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #F2F2F7;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #E5E5EA;
    border-radius: 4px;
    
    &:hover {
      background: #d1d1d6;
    }
  }
}

.ios-upload-area {
  background: white;
  border: 2px dashed #E5E5EA;
  border-radius: 16px;
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  
  &:hover {
    border-color: #007aff;
    transform: translateY(-3px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
  
  &.drag-over {
    border-color: #007aff;
    background: rgba(0, 122, 255, 0.05);
    transform: scale(1.02);
  }
}

.ios-upload-icon {
  font-size: 48px;
  color: #007aff;
  margin-bottom: 12px;
}

.ios-upload-text {
  color: #1c1c1e;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}

.ios-upload-hint {
  color: #8e8e93;
  font-size: 13px;
  margin-bottom: 16px;
}

.ios-actions {
  background: white;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid #E5E5EA;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.ios-actions-title {
  color: #1c1c1e;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 12px;
  letter-spacing: 0.2px;
}

.ios-actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ios-action-btn {
  background: #F2F2F7;
  color: #1c1c1e;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #E5E5EA;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  
  &:hover {
    background: #e5e5ea;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  &.danger {
    background: rgba(255, 59, 48, 0.1);
    border-color: #ff3b304d;
    color: #ff3b30;
    
    &:hover {
      background: rgba(255, 59, 48, 0.15);
      border-color: #ff3b3080;
    }
  }
  
  &.rotate {
    background: rgba(255, 149, 0, 0.1);
    border-color: #ff95004d;
    color: #ff9500;
    
    &:hover {
      background: rgba(255, 149, 0, 0.15);
      border-color: #ff950080;
    }
  }
  
  &.merge {
    background: rgba(52, 199, 89, 0.1);
    border-color: #34c7594d;
    color: #34c759;
    
    &:hover {
      background: rgba(52, 199, 89, 0.15);
      border-color: #34c75980;
    }
  }
  
  &.compress {
    background: rgba(255, 20, 147, 0.1);
    border-color: #ff14934d;
    color: #ff1493;
    
    &:hover {
      background: rgba(255, 20, 147, 0.15);
      border-color: #ff149380;
    }
  }
}

.ios-pages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
  padding: 6px;
}

.ios-page-card {
  background: white;
  border-radius: 14px;
  border: 1px solid #E5E5EA;
  overflow: hidden;
  cursor: grab;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    border-color: #d1d1d6;
  }
  
  &.selected {
    border: 2px solid #007AFF;
    background: rgba(0, 122, 255, 0.03);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
  }
  
  &.dragging {
    opacity: 0.6;
    transform: scale(0.95);
    border-color: #007aff;
  }
  
  &::before {
    content: "";
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: #F2F2F7;
    border: 1px solid #E5E5EA;
    transition: all 0.25s ease;
    opacity: 0;
  }
  
  &.selected::before {
    opacity: 1;
    background: #007AFF;
    border-color: #007aff;
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
    
    &::after {
      content: "✓";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      font-size: 12px;
      font-weight: 900;
    }
  }
  
  &.drag-over {
    border-color: #007aff;
    background: rgba(0, 122, 255, 0.05);
    transform: scale(1.05);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  }
}

.ios-page-preview {
  height: 140px;
  background: #F2F2F7;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-bottom: 1px solid #E5E5EA;
  position: relative;
  
  img {
    max-width: 100%;
    max-height: 100%;
    transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
    border-radius: 4px;
  }
  
  &.rotated-90 img {
    transform: rotate(90deg);
  }
  
  &.rotated-180 img {
    transform: rotate(180deg);
  }
  
  &.rotated-270 img {
    transform: rotate(270deg);
  }
}

.ios-page-info {
  padding: 10px;
  background: white;
}

.ios-page-title {
  color: #1c1c1e;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ios-page-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #8e8e93;
  font-weight: 600;
}

.ios-page-actions {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: #F2F2F7;
  border-top: 1px solid #E5E5EA;
}

.ios-action-group {
  display: flex;
  gap: 6px;
}

.ios-icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid #E5E5EA;
  background: white;
  color: #1c1c1e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 12px;
  font-weight: 700;
  
  &:hover {
    background: #F2F2F7;
    transform: scale(1.1);
    border-color: #d1d1d6;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.delete:hover {
    background: rgba(255, 59, 48, 0.1);
    border-color: #ff3b30;
    color: #ff3b30;
  }
  
  &.rotate:hover {
    background: rgba(255, 149, 0, 0.1);
    border-color: #ff9500;
    color: #ff9500;
  }
  
  &.replace:hover {
    background: rgba(0, 122, 255, 0.1);
    border-color: #007aff;
    color: #007aff;
  }
  
  &.image:hover {
    background: rgba(108, 92, 231, 0.1);
    border-color: #6c5ce7;
    color: #6c5ce7;
  }
  
  &.select:hover {
    background: rgba(0, 122, 255, 0.1);
    border-color: #007aff;
    color: #007aff;
  }
}

.ios-empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #8e8e93;
  
  .ios-empty-icon {
    font-size: 64px;
    color: #d1d1d6;
    margin-bottom: 16px;
  }
  
  .ios-empty-title {
    font-size: 18px;
    font-weight: 700;
    color: #1c1c1e;
    margin-bottom: 8px;
  }
  
  .ios-empty-text {
    font-size: 14px;
    color: #8e8e93;
    line-height: 1.5;
  }
}

.ios-footer {
  background: #FFFFFF;
  padding: 12px 20px;
  border-top: 1px solid #E5E5EA;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #1c1c1e;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  gap: 16px;
}

.ios-footer-stats {
  display: flex;
  gap: 16px;
  font-weight: 600;
  flex: 1;
}

.ios-footer-stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ios-stat-value {
  background: #F2F2F7;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 700;
  min-width: 22px;
  text-align: center;
  border: 1px solid #E5E5EA;
}

.ios-footer-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
}

.ios-footer-btn {
  padding: 8px 14px;
  border-radius: 10px;
  border: none;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  white-space: nowrap;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  &.clear {
    background: #F2F2F7;
    color: #1c1c1e;
  }
  
  &.download {
    background: #007AFF;
    color: #fff;
    
    &:hover {
      background: #0051D5;
    }
    
    &:disabled {
      background: #F2F2F7;
      color: #8e8e93;
    }
  }
}

.ios-footer-status {
  color: #8e8e93;
  font-weight: 600;
  white-space: nowrap;
  flex: 1;
  text-align: right;
}

.ios-modal {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease;
  
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
}

.ios-modal-content {
  background: white;
  width: 90%;
  max-width: 460px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  
  @keyframes slideUp {
    0% {
      transform: translateY(25px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }
}

.ios-modal-header {
  padding: 20px;
  background: #F2F2F7;
  border-bottom: 1px solid #E5E5EA;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ios-modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #1c1c1e;
}

.ios-modal-close {
  background: white;
  border: 1px solid #E5E5EA;
  color: #8e8e93;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-weight: 700;
  
  &:hover {
    background: #F2F2F7;
    transform: scale(1.1);
  }
}

.ios-modal-body {
  padding: 24px;
  color: #1c1c1e;
  
  p {
    margin-bottom: 16px;
    line-height: 1.5;
    font-size: 14px;
  }
}

.ios-modal-actions {
  padding: 16px 24px;
  background: #F2F2F7;
  border-top: 1px solid #E5E5EA;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.ios-btn {
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &.ios-btn-secondary {
    background: white;
    color: #1c1c1e;
    border: 1px solid #E5E5EA;
    
    &:hover {
      background: #F2F2F7;
      border-color: #d1d1d6;
    }
  }
  
  &.ios-btn-accent {
    background: #007AFF;
    color: #fff;
    border: 1px solid rgba(0, 122, 255, 0.3);
    
    &:hover {
      background: #0051D5;
      border-color: rgba(0, 122, 255, 0.5);
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
    }
  }
}

.ios-loading {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  z-index: 3000;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.ios-spinner {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 4px solid #E5E5EA;
  border-top: 4px solid #007AFF;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
  
  @keyframes spin {
    0% { transform: rotate(0); }
    100% { transform: rotate(360deg); }
  }
}

.ios-loading-text {
  color: #1c1c1e;
  font-size: 16px;
  font-weight: 700;
}

.ios-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translate(-50%) translateY(120px);
  background: #1C1C1E;
  color: #fff;
  padding: 14px 24px;
  border-radius: 14px;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  z-index: 4000;
  pointer-events: none;
  
  &.show {
    opacity: 1;
    transform: translate(-50%) translateY(0);
  }
}

.quality-options {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 20px 0;
}

.quality-btn {
  padding: 12px 20px;
  border-radius: 12px;
  border: 2px solid #E5E5EA;
  background: white;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 100px;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
  
  &.selected {
    border-color: #007aff;
    background: rgba(0, 122, 255, 0.05);
    color: #007aff;
  }
  
  i {
    font-size: 20px;
  }
  
  .quality-label {
    font-size: 12px;
  }
  
  .quality-value {
    font-size: 14px;
    font-weight: 800;
  }
}

[data-tooltip] {
  position: relative;
  
  &:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translate(-50%);
    background: #1C1C1E;
    color: #fff;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    white-space: nowrap;
    margin-bottom: 8px;
    z-index: 100;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
}

// 响应式设计
@media (max-width: 968px) {
  .ios-main {
    flex-direction: column;
  }
  
  .ios-left-panel {
    width: 100%;
    max-width: none;
    min-width: auto;
    max-height: 45%;
    border-right: none;
    border-bottom: 1px solid #E5E5EA;
  }
  
  .ios-right-panel {
    max-height: 55%;
  }
  
  .ios-pages-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  
  .ios-footer {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }
  
  .ios-footer-stats {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .ios-footer-actions {
    width: 100%;
    order: -1;
  }
}

@media (max-width: 600px) {
  .ios-nav {
    padding: 14px 18px;
  }
  
  .ios-title {
    font-size: 18px;
  }
  
  .scroll-area {
    padding: 16px;
  }
  
  .ios-actions-grid {
    grid-template-columns: 1fr;
  }
  
  .ios-pages-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .ios-page-preview {
    height: 120px;
  }
  
  .ios-modal-content {
    max-width: 400px;
  }
  
  .ios-footer-btn {
    padding: 6px 12px;
    font-size: 11px;
  }
  
  .ios-footer-stats,
  .ios-footer-status {
    font-size: 11px;
  }
}
</style>
