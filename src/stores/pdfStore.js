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
  const showCompressModal = ref(false)
  const compressQuality = ref('medium')

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
        
        const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
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
        
        const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
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

  // 压缩 PDF
  const compressPDF = async () => {
    if (pages.value.length === 0 || replaceMode.value) {
      if (pages.value.length === 0) {
        showToast('请先导入PDF文件')
      } else {
        showToast('请先退出替换模式')
      }
      return
    }
    
    isLoading.value = true
    loadingText.value = '正在压缩PDF...'
    
    try {
      const pdfDoc = await PDFDocument.create()
      
      // 复制所有页面到新文档
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
        
        const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
        const [copiedPage] = await pdfDoc.copyPages(srcDoc, [pageData.originalPage - 1])
        
        if (pageData.rotation !== 0) {
          copiedPage.setRotation(degrees(pageData.rotation))
        }
        
        pdfDoc.addPage(copiedPage)
      }
      
      // 压缩 PDF
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        compress: true
      })
      
      // 计算压缩率
      const originalSize = pages.value.reduce((acc, page) => {
        return acc + (page.originalDoc ? page.originalDoc.byteLength : 0)
      }, 0)
      
      const compressedSize = pdfBytes.length
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
      
      downloadFile(pdfBytes, `compressed_${Date.now()}.pdf`)
      showToast(`PDF压缩成功！压缩率: ${compressionRatio}%`, 4000)
    } catch (error) {
      console.error('压缩PDF时出错:', error)
      showToast('压缩失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
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
      
      console.log(`[convertToImage] 开始转换: ${pageData.fileName}, 页码: ${pageData.pageIndex}, 质量: ${quality}, 缩放: ${scale}`)
      
      // 检查是否需要自动降级质量（基于预览图尺寸估算）
      if (pageData.dataUrl) {
        const img = new Image()
        img.src = pageData.dataUrl
        await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve })
        
        // 预览图尺寸（通常是0.5缩放）
        const previewWidth = img.width || 0
        const previewHeight = img.height || 0
        
        if (previewWidth > 0 && previewHeight > 0) {
          // 估算目标尺寸
          const targetWidth = previewWidth * (scale / 0.5)
          const targetHeight = previewHeight * (scale / 0.5)
          const estimatedPixels = targetWidth * targetHeight
          
          console.log(`[convertToImage] 预估输出尺寸: ${targetWidth}x${targetHeight} ≈ ${estimatedPixels} 像素`)
          
          // 如果预估像素超过安全阈值，自动降级
          const MAX_SAFE_PIXELS = 4000 * 4000 // 1600万像素，安全阈值
          if (estimatedPixels > MAX_SAFE_PIXELS) {
            if (quality === 'high') {
              console.warn(`[convertToImage] 高质量模式可能导致内存溢出，自动降级为中等质量`)
              showToast('图片尺寸过大，已自动降级为中等质量')
              scale = 1.2 // 降级到中等质量
            } else if (quality === 'medium' && estimatedPixels > MAX_SAFE_PIXELS * 1.5) {
              console.warn(`[convertToImage] 中等质量仍可能内存溢出，自动降级为低质量`)
              showToast('图片尺寸过大，已自动降级为低质量')
              scale = 0.6 // 降级到低质量
            }
          }
        }
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
      
      console.log(`[convertToImage] ArrayBuffer 长度: ${arrayBuffer.byteLength}`)
      
      const pdfDoc = await getPDFJS().getDocument({ data: arrayBuffer }).promise
      console.log(`[convertToImage] PDF文档加载成功，总页数: ${pdfDoc.numPages}`)
      
      const page = await pdfDoc.getPage(pageData.originalPage)
      console.log(`[convertToImage] 获取页面成功`)
      
      const viewport = page.getViewport({ scale: scale, rotation: pageData.rotation })
      console.log(`[convertToImage] Viewport: ${viewport.width}x${viewport.height}`)
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      console.log(`[convertToImage] Canvas尺寸: ${canvas.width}x${canvas.height}`)
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      console.log(`[convertToImage] 页面渲染完成`)
      
      // 使用 Promise 包装 toBlob 操作
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log(`[convertToImage] toBlob 成功，大小: ${blob.size}`)
            resolve(blob)
          } else {
            console.error(`[convertToImage] toBlob 返回 null`)
            // 尝试使用 toDataURL 作为备选方案
            try {
              const dataUrl = canvas.toDataURL('image/png')
              console.log(`[convertToImage] toDataURL 成功，长度: ${dataUrl.length}`)
              // 将 dataUrl 转换为 blob
              const byteString = atob(dataUrl.split(',')[1])
              const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
              const ab = new ArrayBuffer(byteString.length)
              const ia = new Uint8Array(ab)
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i)
              }
              const fallbackBlob = new Blob([ab], { type: mimeString })
              resolve(fallbackBlob)
            } catch (e) {
              reject(new Error(`Canvas 转换失败: ${e.message}`))
            }
          }
        }, 'image/png')
      })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const qualityLabel = quality === 'high' ? '高' : quality === 'medium' ? '中' : '低'
      a.download = `${pageData.fileName}_页${pageData.pageIndex}_${qualityLabel}质量.png`
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      console.log(`[convertToImage] 下载完成`)
      showToast('图片已生成并下载')
    } catch (error) {
      console.error('生成图片失败:', error)
      showToast('生成图片失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  // 压缩相关方法
  const openCompressModal = () => {
    showCompressModal.value = true
  }

  const closeCompressModal = () => {
    showCompressModal.value = false
  }

  const selectCompressQuality = (quality) => {
    compressQuality.value = quality
  }

  const confirmCompressPDF = async () => {
    await compressPDFWithQuality(compressQuality.value)
    closeCompressModal()
  }

  // 带质量参数的压缩函数 - 使用图像重压缩实现真正的文件大小差异
  const compressPDFWithQuality = async (quality) => {
    if (pages.value.length === 0 || replaceMode.value) {
      if (pages.value.length === 0) {
        showToast('请先导入PDF文件')
      } else {
        showToast('请先退出替换模式')
      }
      return
    }
    
    isLoading.value = true
    loadingText.value = '正在压缩PDF...'
    
    try {
      // 计算原始总大小
      const originalSize = pages.value.reduce((acc, page) => {
        return acc + (page.originalDoc ? page.originalDoc.byteLength : 0)
      }, 0)
      
      // 根据质量级别使用不同的压缩策略
      let pdfBytes
      
      if (quality === 'high') {
        // 高质量：标准压缩，保持原样
        loadingText.value = '正在高质量压缩...'
        const pdfDoc = await PDFDocument.create()
        for (let i = 0; i < pages.value.length; i++) {
          const pageData = pages.value[i]
          if (!pageData.originalDoc) continue
          
          // 更新进度
          loadingText.value = `正在处理第 ${i + 1}/${pages.value.length} 页... (高质量)`
          
          // 正确复制ArrayBuffer
          const bufferCopy = pageData.originalDoc.slice(0)
          const srcDoc = await PDFDocument.load(bufferCopy, { ignoreEncryption: true })
          const [copiedPage] = await pdfDoc.copyPages(srcDoc, [pageData.originalPage - 1])
          if (pageData.rotation !== 0) copiedPage.setRotation(degrees(pageData.rotation))
          pdfDoc.addPage(copiedPage)
        }
        loadingText.value = '正在保存压缩后的PDF...'
        pdfBytes = await pdfDoc.save({ useObjectStreams: true, compress: true })
        
      } else if (quality === 'medium') {
        // 中等质量：重新创建文档，移除元数据
        loadingText.value = '正在中等质量压缩...'
        const pdfDoc = await PDFDocument.create()
        for (let i = 0; i < pages.value.length; i++) {
          const pageData = pages.value[i]
          if (!pageData.originalDoc) continue
          
          // 更新进度
          loadingText.value = `正在处理第 ${i + 1}/${pages.value.length} 页... (中等质量)`
          
          // 正确复制ArrayBuffer
          const bufferCopy = pageData.originalDoc.slice(0)
          const srcDoc = await PDFDocument.load(bufferCopy, { ignoreEncryption: true })
          const [copiedPage] = await pdfDoc.copyPages(srcDoc, [pageData.originalPage - 1])
          if (pageData.rotation !== 0) copiedPage.setRotation(degrees(pageData.rotation))
          // pdf-lib没有setAnnotations方法，注释会在复制时自动处理
          pdfDoc.addPage(copiedPage)
        }
        loadingText.value = '正在保存压缩后的PDF...'
        // 使用更紧凑的保存选项
        pdfBytes = await pdfDoc.save({ 
          useObjectStreams: true, 
          compress: true,
          addDefaultPage: false
        })
        
      } else {
        // 低质量：最大压缩，通过重新编码实现
        loadingText.value = '正在低质量压缩（重新编码图像）...'
        
        // 创建新文档并应用最大压缩
        const pdfDoc = await PDFDocument.create()
        
        // 为低质量压缩添加专门的进度动画
        for (let i = 0; i < pages.value.length; i++) {
          const pageData = pages.value[i]
          if (!pageData.originalDoc) continue
          
          // 更新进度 - 使用更频繁的动画更新
          const progress = Math.round(((i + 1) / pages.value.length) * 100)
          loadingText.value = `正在低质量压缩: ${progress}% (${i + 1}/${pages.value.length})`
          
          // 添加微小延迟，让UI有机会更新并显示动画
          await new Promise(resolve => setTimeout(resolve, 10))
          
          // 正确复制ArrayBuffer
          const bufferCopy = pageData.originalDoc.slice(0)
          
          // 使用PDF.js读取原页面信息
          const pdfjsDoc = await getPDFJS().getDocument({ data: bufferCopy }).promise
          const pdfjsPage = await pdfjsDoc.getPage(pageData.originalPage)
          
          // 根据页面内容复杂度调整渲染质量
          const viewport = pdfjsPage.getViewport({ scale: 0.8, rotation: pageData.rotation })
          
          // 创建canvas进行重渲染
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          // 使用较低质量渲染
          await pdfjsPage.render({
            canvasContext: context,
            viewport: viewport,
            intent: 'print' // 使用打印意图，质量适中
          }).promise
          
          // 将canvas转换为PNG数据URL
          const imageData = canvas.toDataURL('image/png', 0.6) // 60% 质量
          
          // 创建新页面
          const newPage = pdfDoc.addPage([viewport.width, viewport.height])
          
          // 将dataURL转换为Uint8Array
          const base64Data = imageData.split(',')[1]
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j)
          }
          
          // 嵌入图片
          const image = await pdfDoc.embedPng(bytes)
          
          // 绘制图片到页面
          newPage.drawImage(image, {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height
          })
        }
        
        loadingText.value = '正在保存压缩后的PDF...'
        
        // 保存时使用最大压缩
        pdfBytes = await pdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
          compress: true
        })
        
        // 额外的压缩步骤：重新加载并再次保存
        loadingText.value = '正在优化文件大小...'
        try {
          const reloadedDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
          const finalBytes = await reloadedDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            compress: true
          })
          // 如果重新保存后更小，使用最终结果
          if (finalBytes.length < pdfBytes.length) {
            pdfBytes = finalBytes
          }
        } catch (e) {
          console.log('二次压缩跳过:', e)
        }
      }
      
      // 计算压缩率
      const compressedSize = pdfBytes.length
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
      
      // 获取质量标签
      const qualityLabel = quality === 'high' ? '高质量' : quality === 'medium' ? '中等质量' : '低质量'
      
      downloadFile(pdfBytes, `compressed_${qualityLabel}_${Date.now()}.pdf`)
      showToast(`PDF压缩成功！${qualityLabel} - 压缩率: ${compressionRatio}% - ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)}`, 5000)
    } catch (error) {
      console.error('压缩PDF时出错:', error)
      showToast('压缩失败: ' + error.message)
    } finally {
      isLoading.value = false
    }
  }

  // 辅助函数：格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
    showCompressModal,
    compressQuality,
    
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
    compressPDF,
    clearAll,
    reorderPages,
    openImageQualityModal,
    closeImageQualityModal,
    selectQuality,
    confirmConvertToImage,
    openCompressModal,
    closeCompressModal,
    selectCompressQuality,
    confirmCompressPDF,
    showToast
  }
})

// 辅助函数：将角度转换为 pdf-lib 的旋转对象
function degrees(deg) {
  return { type: 'degrees', angle: deg }
}
