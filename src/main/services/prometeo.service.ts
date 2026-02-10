import { authService } from './auth.service'
import { PROMETEO_BASE_URL, PROMETEO_SEARCH_URL } from '../lib/constants'
import type { PrometeoProduct, PrometeoProductFilter, TimeStep } from '@shared/types'

export interface ProductCatalogResult {
  products: PrometeoProduct[]
  categories: string[]
  types: string[]
  areas: string[]
}

export interface ChartUrlsResult {
  productName: string
  date: string
  steps: TimeStep[]
}

class PrometeoService {
  /**
   * Mutex queue to serialize all Prometeo page operations.
   * Only one fetchCatalog/fetchChartUrls can run at a time because
   * they all share the same BrowserWindow and change its state.
   */
  private mutexQueue: (() => void)[] = []
  private mutexLocked = false

  private async acquireLock(): Promise<void> {
    if (!this.mutexLocked) {
      this.mutexLocked = true
      return
    }
    return new Promise<void>((resolve) => {
      this.mutexQueue.push(resolve)
    })
  }

  private releaseLock(): void {
    const next = this.mutexQueue.shift()
    if (next) {
      next()
    } else {
      this.mutexLocked = false
    }
  }

  private getWindow() {
    return authService.getPrometeoWindow()
  }

  /**
   * Navigate to search page if not already there.
   * Uses window.location inside the page to avoid Electron loadURL ERR_ABORTED issues.
   * IMPORTANT: caller must hold the mutex lock.
   */
  private async ensureSearchPage(): Promise<Electron.BrowserWindow> {
    const status = authService.getStatus()
    if (!status.isLoggedIn) {
      throw new Error('Non connesso a Prometeo')
    }

    const win = this.getWindow()
    const currentUrl = win.webContents.getURL()
    console.log('[Prometeo] Current page:', currentUrl)

    if (!currentUrl.includes('ricercaProdotto')) {
      console.log('[Prometeo] Navigating to search page...')
      // Navigate using window.location to stay in same session context
      await win.webContents.executeJavaScript(
        `window.location.href = ${JSON.stringify(PROMETEO_SEARCH_URL)}; void 0;`
      )
      // Wait for page to finish loading
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 15000)
        win.webContents.once('did-finish-load', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
      // Wait for JS/select2 to initialize
      await this.delay(3000)
      console.log('[Prometeo] Search page loaded:', win.webContents.getURL())
    }

    return win
  }

  private async waitForCondition(
    win: Electron.BrowserWindow,
    jsCondition: string,
    maxWaitMs = 10000,
    intervalMs = 500
  ): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < maxWaitMs) {
      try {
        const result = await win.webContents.executeJavaScript(jsCondition)
        if (result) return true
      } catch {
        // Page might be navigating, ignore
      }
      await this.delay(intervalMs)
    }
    return false
  }

  /**
   * Track whether this is the first fetch of the session (cold start = slower Prometeo).
   */
  private fetchCount = 0

  /**
   * Wait for arrLinkImmagini to be populated AND stable (not still growing).
   * Returns the final count (0 if nothing loaded).
   * Strategy: wait at least minTotalWait before accepting, then require stability + confirmation.
   * Adaptive: first fetch of session gets longer timeouts (cold Prometeo / slow connection).
   */
  private async _waitForStableArray(win: Electron.BrowserWindow): Promise<number> {
    this.fetchCount++
    const isFirstFetch = this.fetchCount <= 2 // first 2 fetches get extra patience

    let lastCount = 0
    let stableChecks = 0
    const maxWait = isFirstFetch ? 30000 : 20000
    const minTotalWait = isFirstFetch ? 4000 : 2000
    const requiredStableChecks = 6 // 6 checks × 500ms = 3s of stability
    const start = Date.now()

    if (isFirstFetch) {
      console.log('[Prometeo] First fetch of session — using extended timeouts')
    }

    while (Date.now() - start < maxWait) {
      try {
        const count = await win.webContents.executeJavaScript(
          `typeof arrLinkImmagini !== 'undefined' ? arrLinkImmagini.length : 0`
        )
        if (count > 0) {
          if (count === lastCount) {
            stableChecks++
            const elapsed = Date.now() - start
            if (stableChecks >= requiredStableChecks && elapsed >= minTotalWait) {
              // Array stable for 3s AND we've waited at least minTotalWait
              // Do a final confirmation: wait 1.5s more and re-check
              console.log(
                '[Prometeo] arrLinkImmagini appears stable at',
                count,
                'entries after',
                elapsed,
                'ms, confirming...'
              )
              await this.delay(1500)
              const confirmCount = await win.webContents.executeJavaScript(
                `typeof arrLinkImmagini !== 'undefined' ? arrLinkImmagini.length : 0`
              )
              if (confirmCount === count) {
                console.log('[Prometeo] arrLinkImmagini confirmed stable at', count, 'entries')
                return count
              } else {
                // Still growing! Reset and continue
                console.log(
                  '[Prometeo] arrLinkImmagini grew from',
                  count,
                  'to',
                  confirmCount,
                  '- continuing'
                )
                stableChecks = 0
                lastCount = confirmCount
              }
            }
          } else {
            stableChecks = 0
            lastCount = count
          }
        }
      } catch {
        // Page might be loading
      }
      await this.delay(500)
    }

    // Timeout — check if we have any data at all
    const finalCount = await win.webContents.executeJavaScript(
      `typeof arrLinkImmagini !== 'undefined' ? arrLinkImmagini.length : 0`
    )
    if (finalCount > 0) {
      console.log('[Prometeo] arrLinkImmagini has', finalCount, 'entries (timeout but data present)')
      return finalCount
    }
    return 0
  }

  async fetchProductCatalog(filter: PrometeoProductFilter): Promise<ProductCatalogResult> {
    await this.acquireLock()
    try {
      return await this._fetchProductCatalog(filter)
    } finally {
      this.releaseLock()
    }
  }

  private async _fetchProductCatalog(filter: PrometeoProductFilter): Promise<ProductCatalogResult> {
    console.log('[Prometeo] fetchProductCatalog:', filter.productType)

    const win = await this.ensureSearchPage()

    // Map product type text to the value used by #slArea
    const typeValueMap: Record<string, string> = {
      CHARTS: '1',
      SATELLITE: '2',
      'FLIGHT CHARTS': '3',
      MESSAGES: '4',
      RADAR: '6',
      METGRAMS: '8',
      SOUNDINGS: '9',
      LIGHTNING: '10',
      SEASONAL: '11',
      'SPACE WEATHER': '12',
      SUBSEASONAL: '15'
    }

    const typeValue = typeValueMap[filter.productType] || '1'

    // Set product type via #slArea using jQuery (triggers AJAX reload of product list)
    // IMPORTANT: end with void 0 to avoid returning the jQuery object (not cloneable!)
    console.log('[Prometeo] Setting product type to:', filter.productType, '(value:', typeValue, ')')
    await win.webContents.executeJavaScript(`
      jQuery('#slArea').val('${typeValue}').trigger('change'); void 0;
    `)

    // Wait for the product list (#slListaImmagini) to be repopulated via AJAX
    const loaded = await this.waitForCondition(
      win,
      `document.getElementById('slListaImmagini') && document.getElementById('slListaImmagini').options.length > 10`,
      8000,
      500
    )
    console.log('[Prometeo] Product list loaded:', loaded)

    // Extra buffer for DOM updates
    await this.delay(500)

    // Extract products from #slListaImmagini
    // IMPORTANT: Return as JSON string to avoid "object could not be cloned" error
    // when the data is too large for Electron's structured clone
    const catalogJson = await win.webContents.executeJavaScript(`
      (function() {
        var products = [];
        var categories = [];
        var types = [];
        var areas = [];

        var sli = document.getElementById('slListaImmagini');
        if (sli) {
          var optgroups = sli.querySelectorAll('optgroup');
          if (optgroups.length > 0) {
            for (var g = 0; g < optgroups.length; g++) {
              var cat = optgroups[g].label || '';
              var opts = optgroups[g].querySelectorAll('option');
              for (var o = 0; o < opts.length; o++) {
                if (opts[o].value && opts[o].value !== '') {
                  products.push({ id: opts[o].value, name: opts[o].textContent.trim(), category: cat });
                }
              }
            }
          } else {
            for (var i = 0; i < sli.options.length; i++) {
              var opt = sli.options[i];
              if (opt.value && opt.value !== '') {
                products.push({ id: opt.value, name: opt.textContent.trim(), category: '' });
              }
            }
          }
        }

        var slCat = document.getElementById('slCategoria');
        if (slCat) {
          for (var i = 0; i < slCat.options.length; i++) {
            if (slCat.options[i].value) categories.push(slCat.options[i].textContent.trim());
          }
        }

        var slType = document.getElementById('slClasseTipologia');
        if (slType) {
          for (var i = 0; i < slType.options.length; i++) {
            if (slType.options[i].value) types.push(slType.options[i].textContent.trim());
          }
        }

        var slGeo = document.getElementById('slGeo');
        if (slGeo) {
          for (var i = 0; i < slGeo.options.length; i++) {
            if (slGeo.options[i].value) areas.push(slGeo.options[i].textContent.trim());
          }
        }

        return JSON.stringify({ products: products, categories: categories, types: types, areas: areas });
      })()
    `)
    const catalogData = JSON.parse(catalogJson)

    console.log(
      '[Prometeo] Catalog:',
      catalogData.products.length, 'products,',
      catalogData.categories.length, 'categories'
    )

    return {
      products: catalogData.products.map(
        (p: { id: string; name: string; category: string }) => ({
          id: p.id,
          name: p.name,
          productType: filter.productType,
          category: p.category,
          type: '',
          area: ''
        })
      ),
      categories: catalogData.categories || [],
      types: catalogData.types || [],
      areas: catalogData.areas || []
    }
  }

  async fetchChartUrls(productId: string): Promise<ChartUrlsResult> {
    await this.acquireLock()
    try {
      return await this._fetchChartUrls(productId)
    } finally {
      this.releaseLock()
    }
  }

  /**
   * Atomic catalog + chart URL fetch: holds the lock across both operations
   * so no other SearchBlock can change the product type in between.
   */
  async fetchCatalogAndChartUrls(
    filter: PrometeoProductFilter,
    productId: string
  ): Promise<{ catalog: ProductCatalogResult; chartUrls: ChartUrlsResult }> {
    await this.acquireLock()
    try {
      const catalog = await this._fetchProductCatalog(filter)
      const chartUrls = await this._fetchChartUrls(productId)
      return { catalog, chartUrls }
    } finally {
      this.releaseLock()
    }
  }

  /**
   * Lightweight chart URL fetch for PPT generation: only ensures the product type
   * is set (without full catalog reload if already correct), then fetches chart URLs.
   * Avoids unnecessary AJAX reloads that can interfere with product selection.
   */
  async fetchChartUrlsForPpt(
    productType: string,
    productId: string
  ): Promise<ChartUrlsResult> {
    await this.acquireLock()
    try {
      await this._ensureProductType(productType)
      return await this._fetchChartUrls(productId)
    } finally {
      this.releaseLock()
    }
  }

  /**
   * Ensure the product type dropdown (#slArea) is set to the given type.
   * If already set, does nothing (avoids unnecessary AJAX reload).
   * If different, triggers change and waits for the product list to reload.
   */
  private async _ensureProductType(productType: string): Promise<void> {
    const win = await this.ensureSearchPage()

    const typeValueMap: Record<string, string> = {
      CHARTS: '1',
      SATELLITE: '2',
      'FLIGHT CHARTS': '3',
      MESSAGES: '4',
      RADAR: '6',
      METGRAMS: '8',
      SOUNDINGS: '9',
      LIGHTNING: '10',
      SEASONAL: '11',
      'SPACE WEATHER': '12',
      SUBSEASONAL: '15'
    }
    const typeValue = typeValueMap[productType] || '1'

    // Check current value of #slArea
    const currentValue = await win.webContents.executeJavaScript(
      `jQuery('#slArea').val() || ''`
    )

    if (currentValue === typeValue) {
      console.log('[Prometeo] Product type already set to', productType, '- skipping reload')
      return
    }

    console.log(
      '[Prometeo] Switching product type from',
      currentValue,
      'to',
      productType,
      '(value:',
      typeValue,
      ')'
    )
    await win.webContents.executeJavaScript(`
      jQuery('#slArea').val('${typeValue}').trigger('change'); void 0;
    `)

    // Wait for the product list to be repopulated
    await this.waitForCondition(
      win,
      `document.getElementById('slListaImmagini') && document.getElementById('slListaImmagini').options.length > 10`,
      8000,
      500
    )
    await this.delay(500)
  }

  private async _fetchChartUrls(productId: string): Promise<ChartUrlsResult> {
    const win = await this.ensureSearchPage()
    console.log('[Prometeo] fetchChartUrls for product:', productId)

    // Reset arrLinkImmagini BEFORE selecting product to get a clean start
    await win.webContents.executeJavaScript(`
      if (typeof arrLinkImmagini !== 'undefined') arrLinkImmagini = [];
      void 0;
    `)

    // Select the product in #slListaImmagini via jQuery (select2)
    // This triggers the native Prometeo page load (AJAX to fetch step images)
    await win.webContents.executeJavaScript(`
      jQuery('#slListaImmagini').val(${JSON.stringify(productId)}).trigger('change'); void 0;
    `)

    // Verify the product was actually selected (might fail if dropdown wasn't ready)
    await this.delay(500)
    const selectedVal = await win.webContents.executeJavaScript(
      `jQuery('#slListaImmagini').val() || ''`
    )
    if (selectedVal !== productId) {
      console.warn(
        '[Prometeo] Product selection mismatch! Expected:',
        productId,
        'Got:',
        selectedVal,
        '- retrying...'
      )
      // Wait for dropdown to be ready and retry
      await this.delay(2000)
      await win.webContents.executeJavaScript(`
        jQuery('#slListaImmagini').val(${JSON.stringify(productId)}).trigger('change'); void 0;
      `)
      await this.delay(500)
      const retryVal = await win.webContents.executeJavaScript(
        `jQuery('#slListaImmagini').val() || ''`
      )
      console.log('[Prometeo] After retry, selected:', retryVal)
    }

    // Wait for arrLinkImmagini to be populated by the native page load.
    // The trigger('change') on #slListaImmagini causes the Prometeo page to load images
    // via its own AJAX — we just wait for the result to stabilize.
    let lastCount = await this._waitForStableArray(win)

    // If native load didn't populate arrLinkImmagini, try explicit cercaImmagini as fallback
    if (lastCount === 0) {
      console.log('[Prometeo] Native load returned 0 entries, trying cercaImmagini fallback...')
      await win.webContents.executeJavaScript(`
        if (typeof arrLinkImmagini !== 'undefined') arrLinkImmagini = [];
        if (typeof nascondiGalleria === 'function') nascondiGalleria();
        if (typeof cercaImmagini === 'function') cercaImmagini();
        void 0;
      `)
      await this.delay(1000)
      lastCount = await this._waitForStableArray(win)
    }

    if (lastCount === 0) {
      console.error('[Prometeo] arrLinkImmagini not populated after all attempts')
      return { productName: '', date: '', steps: [] }
    }

    // Wait for validity labels to appear in the DOM (they load after arrLinkImmagini)
    // We wait until the count of labels matches the count of arrLinkImmagini entries
    const expectedCount = lastCount || 1
    const labelWaitStart = Date.now()
    const labelMaxWait = 8000
    while (Date.now() - labelWaitStart < labelMaxWait) {
      const labelCount = await win.webContents.executeJavaScript(`
        document.querySelectorAll('td[onclick*="changeImgValidity"]').length
      `)
      if (labelCount >= expectedCount) {
        console.log('[Prometeo] Validity labels found:', labelCount, '(expected:', expectedCount, ')')
        break
      }
      if (labelCount > 0 && Date.now() - labelWaitStart > 4000) {
        // After 4s, accept what we have even if less than expected
        console.log('[Prometeo] Partial validity labels:', labelCount, 'of', expectedCount)
        break
      }
      await this.delay(500)
    }

    // Also check if arrLinkImmagini entries contain labels (after ---)
    const hasInlineLabels = await win.webContents.executeJavaScript(`
      (function() {
        if (typeof arrLinkImmagini === 'undefined' || arrLinkImmagini.length === 0) return false;
        var first = arrLinkImmagini[0];
        var parts = first.split('---');
        return parts.length > 1 && parts[1].trim().length > 0;
      })()
    `)
    console.log('[Prometeo] arrLinkImmagini has inline labels:', hasInlineLabels)

    // Extract image URLs and step labels (return as JSON string)
    const chartJson = await win.webContents.executeJavaScript(`
      (function() {
        var steps = [];
        var baseUrl = ${JSON.stringify(PROMETEO_BASE_URL)};
        var tds = document.querySelectorAll('td[onclick*="changeImgValidity"]');
        var validBtns = document.querySelectorAll('.validita-btn, .btn-validita, [class*="validit"]');

        // Log first few entries for debugging
        console.log('[Prometeo-DOM] arrLinkImmagini count:', arrLinkImmagini.length,
          'tds:', tds.length, 'validBtns:', validBtns.length);
        if (arrLinkImmagini.length > 0) {
          console.log('[Prometeo-DOM] Sample entry[0]:', arrLinkImmagini[0].substring(0, 200));
        }

        // Helper: extract date/time from image path as fallback label
        // Paths often contain patterns like: 2026020906 or 20260209_0600 or H500_2026020906
        function labelFromPath(path) {
          // Match YYYYMMDDHH or YYYYMMDD_HHMM pattern
          var m = path.match(/(\\d{4})(\\d{2})(\\d{2})(\\d{2})(\\d{2})?/);
          if (!m) return '';
          var year = m[1], month = m[2], day = m[3], hour = m[4], min = m[5] || '00';
          var d = new Date(year + '-' + month + '-' + day + 'T' + hour + ':' + min + ':00Z');
          if (isNaN(d.getTime())) return '';
          var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          return days[d.getUTCDay()] + ' ' + String(d.getUTCDate()).padStart(2,'0') + ' '
            + String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
        }

        for (var i = 0; i < arrLinkImmagini.length; i++) {
          var entry = arrLinkImmagini[i];
          var parts = entry.split('---');
          var relativePath = parts[0];
          var label = parts.length > 1 ? parts[1].trim() : '';

          if (!label) {
            if (tds[i] && tds[i].textContent.trim()) {
              label = tds[i].textContent.trim();
            } else if (validBtns[i] && validBtns[i].textContent.trim()) {
              label = validBtns[i].textContent.trim();
            } else {
              // Try to extract a date/time from the image path
              label = labelFromPath(relativePath);
              if (!label) {
                label = 'T+' + String(i).padStart(3, '0');
              }
            }
          }

          var imageUrl = relativePath;
          if (!relativePath.startsWith('http')) {
            imageUrl = baseUrl + '/' + relativePath;
          }

          steps.push({
            label: label,
            index: i,
            imageUrl: imageUrl
          });
        }

        var productName = '';
        var chosen = document.querySelector('#s2id_slListaImmagini .select2-chosen');
        if (chosen) productName = chosen.textContent.trim();

        var date = new Date().toISOString().split('T')[0];
        var updateEl = document.getElementById('lastUpdate');
        if (updateEl) {
          var m = updateEl.textContent.match(/(\\d{4}-\\d{2}-\\d{2})/);
          if (m) date = m[1];
        }

        return JSON.stringify({ productName: productName, date: date, steps: steps });
      })()
    `)
    const chartData = JSON.parse(chartJson)

    console.log('[Prometeo] Chart data:', chartData.productName, chartData.date, chartData.steps.length, 'steps')
    return chartData
  }

  /**
   * Fetch an image from Prometeo using the BrowserWindow session.
   * Uses Electron's session.fetch() so cookies are sent automatically.
   * Returns a base64 data URL for display in the renderer.
   */
  async fetchImage(imageUrl: string): Promise<string> {
    console.log('[Prometeo] fetchImage:', imageUrl)

    // Ensure the URL is absolute
    let url = imageUrl
    if (!url.startsWith('http')) {
      url = `${PROMETEO_BASE_URL}/${url.replace(/^\//, '')}`
    }

    console.log('[Prometeo] Fetching image URL:', url)

    // Use the Prometeo BrowserWindow's session to fetch (cookies sent automatically)
    const win = this.getWindow()
    const response = await win.webContents.session.fetch(url, {
      headers: {
        Referer: PROMETEO_BASE_URL
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    console.log('[Prometeo] fetchImage OK, size:', buffer.byteLength, 'bytes, type:', contentType)
    return `data:${contentType};base64,${base64}`
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const prometeoService = new PrometeoService()
