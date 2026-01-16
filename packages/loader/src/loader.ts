/**
 * Bifrost Loader - Injects CMS content into static sites
 * Usage: <script src="https://bifrost.example.com/loader.js?key=API_KEY"></script>
 *
 * Markup:
 *   <div data-bifrost="hero-title">Fallback content</div>
 *   <div data-bifrost-collection="blog-posts" data-bifrost-template="#blog-template"></div>
 */

interface BifrostConfig {
  apiUrl: string
  apiKey: string
}

interface ContentResponse {
  success: boolean
  data: {
    content: Record<string, unknown>
    collections: Record<string, Array<{ id: string; data: Record<string, unknown>; position: number }>>
  }
}

class BifrostLoader {
  private config: BifrostConfig

  constructor() {
    this.config = this.parseConfig()
  }

  private parseConfig(): BifrostConfig {
    const script = document.currentScript as HTMLScriptElement
    const url = new URL(script.src)
    const apiKey = url.searchParams.get('key')

    if (!apiKey) {
      console.error('[Bifrost] Missing key parameter in script URL')
      throw new Error('Missing API key parameter')
    }

    // Allow custom API URL via data attribute or default to script origin
    const customApiUrl = script.getAttribute('data-api-url')

    return {
      apiUrl: customApiUrl || `${url.origin}/api`,
      apiKey,
    }
  }

  async load(): Promise<void> {
    try {
      const response = await this.fetchContent()
      this.injectFields(response.data.content)
      this.injectCollections(response.data.collections)
      this.dispatchEvent('bifrost:loaded', response.data)
    } catch (error) {
      console.warn('[Bifrost] Failed to load content:', error)
      this.dispatchEvent('bifrost:error', { error })
    }
  }

  private async fetchContent(): Promise<ContentResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
    }

    const response = await fetch(`${this.config.apiUrl}/public/all`, { headers })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return response.json()
  }

  private injectFields(fields: Record<string, unknown>): void {
    const elements = document.querySelectorAll('[data-bifrost]')

    elements.forEach((el) => {
      const fieldKey = el.getAttribute('data-bifrost')
      if (fieldKey && fields[fieldKey] !== undefined) {
        const value = fields[fieldKey]

        if (typeof value === 'string') {
          el.innerHTML = value
        } else if (typeof value === 'object' && value !== null && 'url' in value) {
          // Image field
          if (el.tagName === 'IMG') {
            ;(el as HTMLImageElement).src = (value as { url: string }).url
          } else {
            el.innerHTML = `<img src="${(value as { url: string }).url}" alt="" />`
          }
        } else {
          el.textContent = String(value)
        }
      }
    })
  }

  private injectCollections(
    collections: Record<string, Array<{ id: string; data: Record<string, unknown>; position: number }>>
  ): void {
    const elements = document.querySelectorAll('[data-bifrost-collection]')

    elements.forEach((el) => {
      const collectionType = el.getAttribute('data-bifrost-collection')
      const templateSelector = el.getAttribute('data-bifrost-template')

      if (!collectionType || !collections[collectionType]) return

      const items = collections[collectionType].sort((a, b) => a.position - b.position)
      const template = templateSelector ? document.querySelector(templateSelector) : null

      if (template && template instanceof HTMLTemplateElement) {
        el.innerHTML = ''
        items.forEach((item) => {
          const clone = template.content.cloneNode(true) as DocumentFragment
          this.fillTemplate(clone, item.data)
          el.appendChild(clone)
        })
      }
    })
  }

  private fillTemplate(fragment: DocumentFragment, data: Record<string, unknown>): void {
    const elements = fragment.querySelectorAll('[data-field]')
    elements.forEach((el) => {
      const fieldName = el.getAttribute('data-field')
      if (fieldName && data[fieldName] !== undefined) {
        el.textContent = String(data[fieldName])
      }
    })
  }

  private dispatchEvent(name: string, detail?: unknown): void {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new BifrostLoader().load())
} else {
  new BifrostLoader().load()
}
