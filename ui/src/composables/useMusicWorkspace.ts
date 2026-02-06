import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MusicCategory, MusicTrack } from '@/music/library'
import { createCategory, listCategories, listTracks, removeCategoryAndTracks, removeTrackById, uploadLocalFiles, upsertTracks } from '@/music/library'
import { useMusicSettings } from '@/music/settings'

export function useMusicWorkspace() {
  const { effectiveBoxName, effectiveFileBaseUrl } = useMusicSettings()

  const categories = ref<MusicCategory[]>([])
  const tracks = ref<MusicTrack[]>([])
  const activeCategoryId = ref('')
  const activeTrackId = ref('')
  const errorText = ref('')
  const expandedCategoryIds = ref<Set<string>>(new Set())
  const tracksByCategory = ref<Record<string, MusicTrack[]>>({})

  const filePickerVisible = ref(false)
  const filePickerType = ref<'file' | 'folder'>('file')
  const uploadSourceVisible = ref(false)
  const localFileInputRef = ref<HTMLInputElement | null>(null)
  const categoryModalVisible = ref(false)
  const categoryModalName = ref('')
  const uploadTargetCategoryId = ref('')

  const audioRef = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.8)
  const playingTrack = ref<MusicTrack | null>(null)

  const isPlayerPanelOpen = ref(false)
  const isMainViewCollapsed = ref(true)

  const activeTrack = computed(() => playingTrack.value)
  const canPickFiles = computed(() => !!effectiveBoxName.value)
  const canPickFolders = computed(() => !!effectiveBoxName.value)
  const canUploadLocal = computed(() => true)
  const timeText = computed(() => `${formatTime(currentTime.value)} / ${formatTime(duration.value)}`)
  const uploadTargetCategoryName = computed(() => {
    const id = uploadTargetCategoryId.value
    if (!id) return ''
    return categories.value.find(item => item._id === id)?.name || ''
  })

  function formatTime(value: number) {
    if (!Number.isFinite(value) || value <= 0) return '00:00'
    const total = Math.floor(value)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  function normalizePath(path: string) {
    const raw = String(path || '').trim()
    if (!raw) return ''
    return raw.startsWith('/') ? raw : `/${raw}`
  }

  function trimTrailingSlash(path: string) {
    return path.replace(/\/+$/, '')
  }

  function getCategoryNameFromFolderPath(path: string) {
    const normalized = trimTrailingSlash(normalizePath(path))
    const parts = normalized.split('/').filter(Boolean)
    return parts[parts.length - 1] || ''
  }

  function getCategoryNameFromFilePath(path: string) {
    const normalized = trimTrailingSlash(normalizePath(path))
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length >= 2) return parts[parts.length - 2] || ''
    return ''
  }

  function encodePath(path: string) {
    const normalized = normalizePath(path)
    if (!normalized) return ''
    return normalized
      .split('/')
      .map((seg, idx) => (idx === 0 ? '' : encodeURIComponent(seg)))
      .join('/')
  }

  function joinUrl(base: string, path: string) {
    const b = String(base || '').trim().replace(/\/+$/, '')
    const p = normalizePath(path)
    if (!b) return p
    if (!p) return b
    return `${b}${p}`
  }

  function resolveTrackUrl(track: MusicTrack) {
    if (String(track.path || '').startsWith('local:')) {
      const raw = String(track.path || '').slice(6)
      const trimmed = raw.replace(/^\/+/, '')
      const encoded = encodeURIComponent(trimmed)
      return `${window.origin}/api/music/files/${encoded}`
    }
    const base = effectiveFileBaseUrl.value
    if (!base) return ''
    const encoded = encodePath(track.path)
    return joinUrl(base, encoded)
  }

  function isAudioFile(path: string) {
    const lower = String(path || '').toLowerCase()
    return ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus'].some(ext => lower.endsWith(ext))
  }

  async function loadCategories() {
    categories.value = await listCategories()
    if (!activeCategoryId.value && categories.value.length) {
      activeCategoryId.value = categories.value[0]?._id || ''
    }
    const validIds = new Set(categories.value.map(item => item._id || '').filter(Boolean))
    const nextExpanded = new Set<string>()
    for (const id of expandedCategoryIds.value) {
      if (validIds.has(id)) nextExpanded.add(id)
    }
    expandedCategoryIds.value = nextExpanded
  }

  async function loadTracks() {
    if (!activeCategoryId.value) {
      tracks.value = []
      return
    }
    const items = await listTracks(activeCategoryId.value)
    tracks.value = items
    tracksByCategory.value = { ...tracksByCategory.value, [activeCategoryId.value]: items }
  }

  async function loadTracksForCategory(categoryId: string) {
    if (!categoryId) return
    const items = await listTracks(categoryId)
    tracksByCategory.value = { ...tracksByCategory.value, [categoryId]: items }
    if (activeCategoryId.value === categoryId) {
      tracks.value = items
    }
  }

  async function handleRemoveCategory(category: MusicCategory) {
    if (!category._id) return
    const ok = window.confirm(`确定删除分类“${category.name}”吗？该分类内音乐会一并移除。`)
    if (!ok) return
    await removeCategoryAndTracks(category._id)
    if (activeCategoryId.value === category._id) {
      activeCategoryId.value = ''
    }
    if (playingTrack.value?.categoryId === category._id) {
      stopPlayback()
      activeTrackId.value = ''
      playingTrack.value = null
    }
    const nextExpanded = new Set(expandedCategoryIds.value)
    nextExpanded.delete(category._id)
    expandedCategoryIds.value = nextExpanded
    const nextTracks = { ...tracksByCategory.value }
    delete nextTracks[category._id]
    tracksByCategory.value = nextTracks
    await loadCategories()
    await loadTracks()
  }

  function openUploadSourcePicker() {
    errorText.value = ''
    uploadTargetCategoryId.value = ''
    uploadSourceVisible.value = true
  }

  function closeUploadSourcePicker() {
    uploadSourceVisible.value = false
    uploadTargetCategoryId.value = ''
  }

  function openFilePicker(type: 'file' | 'folder') {
    errorText.value = ''
    if (!effectiveBoxName.value) {
      errorText.value = '请先在设置中配置 BoxName'
      uploadSourceVisible.value = false
      return
    }
    filePickerType.value = type
    filePickerVisible.value = true
    uploadSourceVisible.value = false
  }

  function closeFilePicker() {
    filePickerVisible.value = false
    uploadTargetCategoryId.value = ''
  }

  function triggerLocalFilePicker() {
    if (!canUploadLocal.value) return
    const input = localFileInputRef.value
    if (input) {
      uploadSourceVisible.value = false
      input.click()
    }
  }

  function openUploadSourcePickerForCategory(category: MusicCategory) {
    errorText.value = ''
    uploadTargetCategoryId.value = category?._id || ''
    if (category?._id) {
      activeCategoryId.value = category._id
    }
    uploadSourceVisible.value = true
  }

  function openCategoryModal() {
    errorText.value = ''
    categoryModalName.value = ''
    categoryModalVisible.value = true
  }

  function closeCategoryModal() {
    categoryModalVisible.value = false
  }

  async function submitCategoryModal() {
    const name = String(categoryModalName.value || '').trim()
    if (!name) {
      errorText.value = '请输入分类名称'
      return
    }
    try {
      await createCategory(name)
      categoryModalVisible.value = false
      await loadCategories()
    } catch (e: any) {
      errorText.value = String(e?.message || e || '创建分类失败')
    }
  }

  function buildCategoryCache() {
    const categoryCache = new Map<string, string>()
    for (const category of categories.value) {
      if (category._id) categoryCache.set(category.name, category._id)
    }
    return categoryCache
  }

  async function ensureCategoryId(name: string, cache: Map<string, string>) {
    const cleaned = String(name || '').trim()
    if (!cleaned) return ''
    const existing = cache.get(cleaned)
    if (existing) return existing
    const created = await createCategory(cleaned)
    const id = created?._id || ''
    if (id) cache.set(cleaned, id)
    return id
  }

  async function resolveFallbackCategoryId(cache: Map<string, string>, forceDefault: boolean) {
    let fallbackCategoryId = activeCategoryId.value
    if (!fallbackCategoryId && forceDefault) {
      fallbackCategoryId = await ensureCategoryId('默认分类', cache)
      if (fallbackCategoryId) activeCategoryId.value = fallbackCategoryId
    }
    return fallbackCategoryId
  }

  function extractFilesFromEvent(e: Event) {
    const raw = (e as CustomEvent)?.detail?.[0]
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  async function handleFilePickerSubmit(e: Event) {
    const files = extractFilesFromEvent(e)
    filePickerVisible.value = false
    uploadSourceVisible.value = false
    if (!files.length) return
    errorText.value = ''
    try {
      const existingPaths = new Set(tracks.value.map(t => t.path))
      const items: MusicTrack[] = []
      const categoryCache = buildCategoryCache()
      const targetCategoryId = uploadTargetCategoryId.value
      let fallbackCategoryId = targetCategoryId || (await resolveFallbackCategoryId(categoryCache, filePickerType.value === 'file'))

      for (const file of files) {
        const filename = String(file?.filename || file?.path || file?.name || '')
        if (!filename) continue
        const isDir = Boolean(file?.is_dir || file?.isDir || file?.dir || file?.type === 'dir' || file?.type === 'folder')
        if (filePickerType.value === 'folder' && isDir) {
          if (!targetCategoryId) {
            const categoryName = getCategoryNameFromFolderPath(filename)
            if (categoryName) await ensureCategoryId(categoryName, categoryCache)
          }
          continue
        }
        if (!isAudioFile(filename)) continue
        if (existingPaths.has(filename)) continue

        let categoryId = fallbackCategoryId
        if (filePickerType.value === 'folder' && !targetCategoryId) {
          const categoryName = getCategoryNameFromFilePath(filename) || getCategoryNameFromFolderPath(filename)
          categoryId = (await ensureCategoryId(categoryName, categoryCache)) || ''
          if (!categoryId) continue
        }
        if (!categoryId) continue
        const name = filename.split('/').pop() || filename
        items.push({
          _id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          categoryId,
          name,
          path: filename,
          size: Number(file?.size || 0) || undefined,
          mime: String(file?.mime || ''),
          createdAt: Date.now(),
        })
      }
      if (categoryCache.size !== categories.value.length) {
        await loadCategories()
      }
      if (!items.length) return
      await upsertTracks(items)
      await loadTracks()
      uploadTargetCategoryId.value = ''
    } catch (e: any) {
      errorText.value = String(e?.message || e || '添加音频失败')
    }
  }

  async function handleLocalFilesSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const fileList = Array.from(input?.files || [])
    input.value = ''
    uploadSourceVisible.value = false
    if (!fileList.length) return
    errorText.value = ''
    try {
      const existingPaths = new Set(tracks.value.map(t => t.path))
      const categoryCache = buildCategoryCache()
      const targetCategoryId = uploadTargetCategoryId.value
      const fallbackCategoryId = targetCategoryId || (await resolveFallbackCategoryId(categoryCache, true))
      if (!fallbackCategoryId) return
      const uploaded = await uploadLocalFiles(fileList)
      if (!uploaded.length) return
      const items: MusicTrack[] = []
      for (const file of uploaded) {
        const filename = String(file?.name || '')
        if (!filename) continue
        const name = filename.split('/').pop() || filename
        const localPath = `local:${String(file?.path || filename)}`
        if (existingPaths.has(localPath)) continue
        items.push({
          _id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          categoryId: fallbackCategoryId,
          name,
          path: localPath,
          size: Number(file?.size || 0) || undefined,
          mime: String(file?.mime || ''),
          createdAt: Date.now(),
        })
      }
      if (!items.length) return
      await upsertTracks(items)
      await loadTracks()
      uploadTargetCategoryId.value = ''
    } catch (err: any) {
      errorText.value = String(err?.message || err || '本地上传失败')
    }
  }

  function playTrack(track: MusicTrack) {
    const audio = audioRef.value
    if (!audio) return
    const url = resolveTrackUrl(track)
    if (!url) {
      if (String(track.path || '').startsWith('local:')) {
        errorText.value = '本地文件路径无效'
      } else {
        errorText.value = '请先在设置中填写网盘文件基础地址'
      }
      return
    }
    if (audio.src !== url) audio.src = url
    activeTrackId.value = track._id || ''
    playingTrack.value = track
    audio
      .play()
      .then(() => {
        isPlaying.value = true
      })
      .catch(() => {
        isPlaying.value = false
      })
  }

  function isCategoryExpanded(id: string) {
    return expandedCategoryIds.value.has(id)
  }

  async function toggleCategory(category: MusicCategory) {
    const id = category._id || ''
    if (!id) return
    const nextExpanded = new Set(expandedCategoryIds.value)
    if (nextExpanded.has(id)) {
      nextExpanded.delete(id)
    } else {
      nextExpanded.add(id)
      if (!tracksByCategory.value[id]) {
        await loadTracksForCategory(id)
      }
    }
    expandedCategoryIds.value = nextExpanded
  }

  async function selectCategory(category: MusicCategory) {
    const id = category._id || ''
    if (!id) return
    activeCategoryId.value = id
    if (!expandedCategoryIds.value.has(id)) {
      await toggleCategory(category)
    }
  }

  async function handleSelectTrack(categoryId: string, track: MusicTrack) {
    activeCategoryId.value = categoryId
    if (!tracksByCategory.value[categoryId]) {
      await loadTracksForCategory(categoryId)
    }
    playTrack(track)
  }

  function togglePlay() {
    const audio = audioRef.value
    if (!audio) return
    if (!activeTrack.value && tracks.value.length) {
      playTrack(tracks.value[0]!)
      return
    }
    if (audio.paused) {
      audio.play().then(() => (isPlaying.value = true)).catch(() => (isPlaying.value = false))
    } else {
      audio.pause()
      isPlaying.value = false
    }
  }

  function stopPlayback() {
    const audio = audioRef.value
    if (!audio) return
    audio.pause()
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
  }

  function playNext(offset = 1) {
    if (!tracks.value.length) return
    const idx = tracks.value.findIndex(t => t._id === activeTrackId.value)
    const nextIndex = idx >= 0 ? (idx + offset + tracks.value.length) % tracks.value.length : 0
    const next = tracks.value[nextIndex]
    if (next) playTrack(next)
  }

  function handleRemoveTrack(track: MusicTrack) {
    if (!track._id) return
    removeTrackById(track._id).then(() => loadTracks())
    if (playingTrack.value?._id === track._id) {
      stopPlayback()
      activeTrackId.value = ''
      playingTrack.value = null
    }
  }

  function getCategoryTracks(categoryId: string) {
    return tracksByCategory.value[categoryId] || (activeCategoryId.value === categoryId ? tracks.value : [])
  }

  function handleTimeUpdate() {
    const audio = audioRef.value
    if (!audio) return
    currentTime.value = audio.currentTime || 0
  }

  function handleLoadedMetadata() {
    const audio = audioRef.value
    if (!audio) return
    duration.value = audio.duration || 0
    if (Number.isFinite(volume.value)) audio.volume = volume.value
  }

  function handleEnded() {
    playNext(1)
  }

  function seekTo(value: number) {
    const audio = audioRef.value
    if (!audio) return
    const nextTime = Math.min(Math.max(value, 0), duration.value || 0)
    audio.currentTime = nextTime
    currentTime.value = nextTime
  }

  function togglePlayerPanel() {
    isPlayerPanelOpen.value = !isPlayerPanelOpen.value
  }

  function toggleMainView() {
    isMainViewCollapsed.value = !isMainViewCollapsed.value
  }

  function openPlayerPanel() {
    if (!isPlayerPanelOpen.value) {
      isPlayerPanelOpen.value = true
    }
  }

  function openMainView() {
    if (isMainViewCollapsed.value) {
      isMainViewCollapsed.value = false
    }
  }

  watch(activeCategoryId, () => {
    loadTracks()
  })

  watch(volume, v => {
    const audio = audioRef.value
    if (!audio) return
    audio.volume = v
  })

  onMounted(async () => {
    await loadCategories()
    await loadTracks()
  })

  onBeforeUnmount(() => {
    stopPlayback()
  })

  return {
    effectiveBoxName,
    effectiveFileBaseUrl,
    categories,
    tracks,
    activeCategoryId,
    activeTrackId,
    errorText,
    expandedCategoryIds,
    tracksByCategory,
    filePickerVisible,
    filePickerType,
    uploadSourceVisible,
    localFileInputRef,
    categoryModalVisible,
    categoryModalName,
    uploadTargetCategoryId,
    audioRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    isPlayerPanelOpen,
    isMainViewCollapsed,
    activeTrack,
    canPickFiles,
    canPickFolders,
    canUploadLocal,
    timeText,
    uploadTargetCategoryName,
    loadCategories,
    loadTracks,
    loadTracksForCategory,
    resolveTrackUrl,
    handleRemoveCategory,
    openUploadSourcePicker,
    closeUploadSourcePicker,
    openFilePicker,
    closeFilePicker,
    triggerLocalFilePicker,
    openUploadSourcePickerForCategory,
    openCategoryModal,
    closeCategoryModal,
    submitCategoryModal,
    handleFilePickerSubmit,
    handleLocalFilesSelected,
    playTrack,
    isCategoryExpanded,
    toggleCategory,
    selectCategory,
    handleSelectTrack,
    togglePlay,
    stopPlayback,
    playNext,
    handleRemoveTrack,
    getCategoryTracks,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleEnded,
    seekTo,
    togglePlayerPanel,
    toggleMainView,
    openPlayerPanel,
    openMainView,
  }
}
