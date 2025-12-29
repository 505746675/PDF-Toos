import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { PDFDocument, rgb } from 'pdf-lib'

// 获取 PDF.js 实例
const getPDFJS = () => {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    return window.pdfjsLib
  }
  throw new Error('PDF.js 未加载，请确保在HTML中引入PDF.js库')
}

export const usePDFStore = defineStore('pdf', () => {
  // 状态
  const pages = ref([])
  const selectedPages = ref(new Set())
  const replaceMode = ref(false)
  const replaceTargetIds = ref(new Set())
  const replaceFileBuffer = ref(null)
  const replaceFileName = ref('')
  const currentConvertPageId = ref(null)
  const selectedQuality = ref('high')
  const isLoading = ref(false)
  const loadingText = ref('正在处理...')
  const toast = ref({ show: false, message: '' })

  // 计算属性
  const totalPages = computed(() => pages.value.length)
  const selectedCount = computed(() => 
    replaceMode.value ? replaceTargetIds.value.size : selectedPages.value.size
  )
  const hasPages = computed(() => pages.value.length > 0)
  const hasSelection = computed(() => selectedCount.value > 0)
  const hasMultiplePages = computed(() => pages.value.length > 1)

  // 工具函数
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

  const showToast = (message, duration = 3000) => {
    toast.value = { show: true, message }
    setTimeout(() => {
      toast.value.show = false
    }, duration)
  }

  // 导入 PDF 文件
  const processFiles = async (files) => {
    isLoading.value = true
    loadingText.value = '正在导入PDF文件...'
    
    try {
      for (const file of files) {
        await processSingleFile(file)
      }
      showToast(`成功导入 ${files.length} 个PDF文件`)
    } catch (error) {
      console.error('处理文件时出错:', error)
      showToast('处理文件时出错: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  const processSingleFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer()
    // 创建副本以避免 ArrayBuffer 被分离
    const bufferCopy = arrayBuffer.slice(0)
    const pdfDoc = await getPDFJS().getDocument({ data: bufferCopy }).promise
    
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i)
      const viewport = page.getViewport({ scale: 0.5 })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      const dataUrl = canvas.toDataURL('image/png')
      
      // 为每个页面创建独立的 ArrayBuffer 副本
      const pageBuffer = arrayBuffer.slice(0)
      
      pages.value.push({
        id: generateId(),
        fileName: file.name,
        pageIndex: i,
        rotation: 0,
        originalDoc: pageBuffer,
        originalPage: i,
        dataUrl: dataUrl
      })
    }
  }

  // 选择/取消选择页面
  const toggleSelectPage = (pageId) => {
    if (replaceMode.value) return
    
    if (selectedPages.value.has(pageId)) {
      selectedPages.value.delete(pageId)
    } else {
      selectedPages.value.add(pageId)
    }
  }

  // 全选/取消全选
  const selectDeselectAll = () => {
    if (replaceMode.value) return
    
    if (selectedPages.value.size === pages.value.length) {
      selectedPages.value.clear()
    } else {
      pages.value.forEach(page => selectedPages.value.add(page.id))
    }
  }

  // 删除页面
  const deletePage = (pageId) => {
    if (replaceMode.value) return
    
    const index = pages.value.findIndex(p => p.id === pageId)
    if (index !== -1) {
      pages.value.splice(index, 1)
      selectedPages.value.delete(pageId)
      showToast('页面已删除')
    }
  }

  // 删除选中页面
  const deleteSelected = () => {
    if (selectedPages.value.size === 0 || replaceMode.value) return
    
    if (confirm(`确定要删除选中的 ${selectedPages.value.size} 个页面吗？`)) {
      pages.value = pages.value.filter(p => !selectedPages.value.has(p.id))
      selectedPages.value.clear()
      showToast('选中页面已删除')
    }
  }

  // 旋转单个页面
  const rotatePage = (pageId) => {
    if (replaceMode.value) return
    
    const page = pages.value.find(p => p.id === pageId)
    if (page) {
      page.rotation = (page.rotation + 90) % 360
    }
  }

  // 旋转选中页面
  const rotateSelected = (degrees) => {
    if (selectedPages.value.size === 0 || replaceMode.value) return
    
    pages.value.forEach(page => {
      if (selectedPages.value.has(page.id)) {
        page.rotation = (page.rotation + degrees) % 360
      }
    })
    showToast(`已旋转 ${selectedPages.value.size} 个页面`)
  }

  // 替换模式
  const initReplaceMode = () => {
    replaceMode.value = true
    replaceTargetIds.value.clear()
    replaceFileBuffer.value = null
    replaceFileName.value = ''
    showToast('替换模式已启用，请选择要替换的页面')
  }

  const exitReplaceMode = () => {
    replaceMode.value = false
    replaceTargetIds.value.clear()
    replaceFileBuffer.value = null
    replaceFileName.value = ''
    showToast('已退出替换模式')
  }

  const toggleReplaceTarget = (pageId) => {
    if (replaceTargetIds.value.has(pageId)) {
      replaceTargetIds.value.delete(pageId)
    } else {
      replaceTargetIds.value.add(pageId)
    }
  }

  // 快速替换页面
  const quickReplacePage = async (pageId, file) => {
    isLoading.value = true
    loadingText.value = '正在替换页面...'
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const bufferCopy = arrayBuffer.slice(0)
      const pdfDoc = await getPDFJS().getDocument({ data: bufferCopy }).promise
      
      if (pdfDoc.numPages === 0) {
        showToast('所选PDF文件没有页面')
        return
      }
      
      const page = await pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 0.5 })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      const dataUrl = canvas.toDataURL('image/png')
      
      const targetPage = pages.value.find(p => p.id === pageId)
      if (targetPage) {
        targetPage.fileName = file.name
        targetPage.pageIndex = 1
        targetPage.rotation = 0
        targetPage.originalDoc = arrayBuffer.slice(0)
        targetPage.originalPage = 1
        targetPage.dataUrl = dataUrl
        showToast('页面已替换')
      }
    } catch (error) {
      console.error('替换页面时出错:', error)
      showToast('替换失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  // 执行批量替换
  const executeReplace = async () => {
    if (!replaceFileBuffer.value || replaceTargetIds.value.size === 0) {
      showToast('替换数据不完整')
      return
    }
    
    isLoading.value = true
    loadingText.value = `正在替换 ${replaceTargetIds.value.size} 个页面...`
    
    try {
      const arrayBuffer = new Uint8Array(replaceFileBuffer.value).slice(0).buffer
      const bufferCopy = arrayBuffer.slice(0)
      const pdfDoc = await getPDFJS().getDocument({ data: bufferCopy }).promise
      const page = await pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 0.5 })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      const dataUrl = canvas.toDataURL('image/png')
      
      let count = 0
      pages.value.forEach(p => {
        if (replaceTargetIds.value.has(p.id)) {
          p.fileName = replaceFileName.value
          p.pageIndex = 1
          p.rotation = 0
          p.originalDoc = arrayBuffer.slice(0)
          p.originalPage = 1
          p.dataUrl = dataUrl
          count++
        }
      })
      
      showToast(`成功替换 ${count} 个页面`)
      exitReplaceMode()
    } catch (error) {
      console.error('执行替换时出错:', error)
      showToast('替换失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  // 合并 PDF
  const mergePages = async () => {
    if (pages.value.length < 1 || replaceMode.value) {
      showToast('至少需要1个页面才能合并')
      return
    }
    
    isLoading.value = true
    loadingText.value = '正在合并PDF...'
    
    try {
      const pdfDoc = await PDFDocument.create()
      
      for (const pageData of pages.value) {
        if (!pageData.originalDoc || pageData.originalDoc.byteLength === 0) {
          console.warn(`页面 ${pageData.id} 的ArrayBuffer无效，跳过该页面`)
          continue
        }
        
        let arrayBuffer
        try {
          arrayBuffer = pageData.originalDoc.slice(0)
          if (arrayBuffer.byteLength === 0) {
            throw new Error('创建的副本长度为0')
          }
        } catch (error) {
          console.error('创建ArrayBuffer副本失败:', error)
          arrayBuffer = pageData.originalDoc
        }
        
        const srcDoc = await PDFDocument.load(arrayBuffer)
        const [copiedPage] = await pdfDoc.copyPages(srcDoc, [pageData.originalPage - 1])
        
        if (pageData.rotation !== 0) {
          copiedPage.setRotation(degrees(pageData.rotation))
        }
        
        pdfDoc.addPage(copiedPage)
      }
      
      const pdfBytes = await pdfDoc.save()
      downloadFile(pdfBytes, `merged_${Date.now()}.pdf`)
      showToast('PDF合并成功，正在下载...')
    } catch (error) {
      console.error('合并PDF时出错:', error)
      showToast('合并失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  // 下载 PDF
  const downloadPDF = async () => {
    if (pages.value.length === 0 || replaceMode.value) {
      if (pages.value.length === 0) {
        showToast('请先导入PDF文件')
      } else {
        showToast('请先退出替换模式')
      }
      return
    }
    
    await mergePages()
  }

  // 下载选中页面
  const downloadSelectedPages = async () => {
    if (replaceMode.value) return
    
    const selectedData = pages.value.filter(p => selectedPages.value.has(p.id))
    if (selectedData.length === 0) {
      showToast('没有选中的页面')
      return
    }
    
    isLoading.value = true
    loadingText.value = '正在生成选中页面的PDF...'
    
    try {
      const pdfDoc = await PDFDocument.create()
      
      for (const pageData of selectedData) {
        if (!pageData.originalDoc || pageData.originalDoc.byteLength === 0) {
          console.warn(`页面 ${pageData.id} 的ArrayBuffer无效，跳过该页面`)
          continue
        }
        
        let arrayBuffer
        try {
          arrayBuffer = pageData.originalDoc.slice(0)
          if (arrayBuffer.byteLength === 0) {
            throw new Error('创建的副本长度为0')
          }
        } catch (error) {
          console.error('创建ArrayBuffer副本失败:', error)
          arrayBuffer = pageData.originalDoc
        }
        
        const srcDoc = await PDFDocument.load(arrayBuffer)
        const [copiedPage] = await pdfDoc.copyPages(srcDoc, [pageData.originalPage - 1])
        
        if (pageData.rotation !== 0) {
          copiedPage.setRotation(degrees(pageData.rotation))
        }
        
        pdfDoc.addPage(copiedPage)
      }
      
      const pdfBytes = await pdfDoc.save()
      downloadFile(pdfBytes, `selected_${Date.now()}.pdf`)
      showToast(`已下载 ${selectedData.length} 个选中页面`)
    } catch (error) {
      console.error('下载选中页面时出错:', error)
      showToast('下载失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  // 下载文件辅助函数
  const downloadFile = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 清空所有
  const clearAll = () => {
    if (pages.value.length === 0 || replaceMode.value) return
    
    if (confirm('确定要清空所有页面吗？')) {
      pages.value = []
      selectedPages.value.clear()
      showToast('已清空所有内容')
    }
  }

  // 重新排序页面
  const reorderPages = (dragId, dropId) => {
    const dragIndex = pages.value.findIndex(p => p.id === dragId)
    const dropIndex = pages.value.findIndex(p => p.id === dropId)
    
    if (dragIndex !== -1 && dropIndex !== -1) {
      const [draggedPage] = pages.value.splice(dragIndex, 1)
      pages.value.splice(dropIndex, 0, draggedPage)
      showToast('页面顺序已更新')
    }
  }

  // 图片转换相关
  const openImageQualityModal = (pageId) => {
    currentConvertPageId.value = pageId
  }

  const closeImageQualityModal = () => {
    currentConvertPageId.value = null
  }

  const selectQuality = (quality) => {
    selectedQuality.value = quality
  }

  const confirmConvertToImage = async () => {
    if (!currentConvertPageId.value) return
    
    const page = pages.value.find(p => p.id === currentConvertPageId.value)
    if (!page) return
    
    await convertToImage(page, selectedQuality.value)
    closeImageQualityModal()
  }

  const convertToImage = async (pageData, quality) => {
    isLoading.value = true
    loadingText.value = '正在生成图片...'
    
    try {
      let scale
      switch (quality) {
        case 'low':
          scale = 0.6
          break
        case 'medium':
          scale = 1.2
          break
        case 'high':
          scale = 2.4
          break
        default:
          scale = 2.4
      }
      
      if (!pageData.originalDoc || pageData.originalDoc.byteLength === 0) {
        throw new Error('页面的ArrayBuffer无效，无法生成图片')
      }
      
      let arrayBuffer
      try {
        arrayBuffer = pageData.originalDoc.slice(0)
        if (arrayBuffer.byteLength === 0) {
          throw new Error('创建的副本长度为0')
        }
      } catch (error) {
        console.error('创建ArrayBuffer副本失败:', error)
        arrayBuffer = pageData.originalDoc
      }
      
      const pdfDoc = await getPDFJS().getDocument({ data: arrayBuffer }).promise
      const page = await pdfDoc.getPage(pageData.originalPage)
      const viewport = page.getViewport({ scale: scale, rotation: pageData.rotation })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        const qualityLabel = quality === 'high' ? '高' : quality === 'medium' ? '中' : '低'
        a.download = `${pageData.fileName}_页${pageData.pageIndex}_${qualityLabel}质量.png`
        
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        showToast('图片已生成并下载')
      }, 'image/png')
    } catch (error) {
      console.error('生成图片失败:', error)
      showToast('生成图片失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  return {
    // 状态
    pages,
    selectedPages,
    replaceMode,
    replaceTargetIds,
    replaceFileBuffer,
    replaceFileName,
    currentConvertPageId,
    selectedQuality,
    isLoading,
    loadingText,
    toast,
    
    // 计算属性
    totalPages,
    selectedCount,
    hasPages,
    hasSelection,
    hasMultiplePages,
    
    // 方法
    processFiles,
    toggleSelectPage,
    selectDeselectAll,
    deletePage,
    deleteSelected,
    rotatePage,
    rotateSelected,
    initReplaceMode,
    exitReplaceMode,
    toggleReplaceTarget,
    quickReplacePage,
    executeReplace,
    mergePages,
    downloadPDF,
    downloadSelectedPages,
    clearAll,
    reorderPages,
    openImageQualityModal,
    closeImageQualityModal,
    selectQuality,
    confirmConvertToImage,
    showToast
  }
})

// 辅助函数：将角度转换为 pdf-lib 的旋转对象
function degrees(deg) {
  return { type: 'degrees', angle: deg }
}